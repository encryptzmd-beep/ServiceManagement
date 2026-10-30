/* =============================================================================
   MainDB · 29 · Wallet: an invite link of one's own; referral credits go to the inviter only
   -----------------------------------------------------------------------------
   Run in MainDBEncryptz AFTER 27_Wallet.sql (and 28). SAFE TO RE-RUN: the table is created only
   when missing; procedures are CREATE OR ALTER. Ledger rows already written are not touched.

   - Every person has one invite key (random, 12 letters/digits; it is not the user id and does
     not reveal it). The link /register?inv=<key> may be shared with anyone: whoever signs up
     with it is the inviter's friend, as if invited by e-mail.
   - Referral credits are paid to the inviter only. The friend gets the welcome credits.

     dbo.WalletInviteKeys           one key per user (made on first use)
     dbo.sp_Wallet_GetInviteKey     the key of a user, made when missing
     dbo.sp_User_SelfRegister       as script 27 plus @InviterKey
     dbo.sp_Wallet_OnUserOnboarded  links by the mail link's token, else the invite key, else the
                                    e-mail; pays ReferralInviter only
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Users') IS NULL
BEGIN
    RAISERROR('Select MainDBEncryptz before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.WalletLedger') IS NULL OR OBJECT_ID('dbo.Referrals') IS NULL OR COL_LENGTH('dbo.Referrals', 'LastSentAt') IS NULL
BEGIN
    RAISERROR('Run 27_Wallet.sql in this database first. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. The invite key of each person
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.WalletInviteKeys') IS NULL
CREATE TABLE dbo.WalletInviteKeys
(
    UserId    INT NOT NULL CONSTRAINT PK_WalletInviteKeys PRIMARY KEY
              CONSTRAINT FK_WalletInviteKeys_User REFERENCES dbo.Users (UserId),
    InviteKey VARCHAR(16) NOT NULL CONSTRAINT UQ_WalletInviteKeys_Key UNIQUE,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_WalletInviteKeys_CreatedAt DEFAULT (SYSDATETIME())
);
GO

/* The key of a user; made on first use: 12 characters from an alphabet without look-alikes
   (no 0/O, 1/I/L), from CRYPT_GEN_RANDOM, so it cannot be guessed or traced to the user. */
CREATE OR ALTER PROCEDURE dbo.sp_Wallet_GetInviteKey
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @UserId)
    BEGIN
        SELECT CAST(NULL AS VARCHAR(16)) AS InviteKey;
        RETURN;
    END

    DECLARE @Alphabet CHAR(31) = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    DECLARE @Key VARCHAR(16), @Bytes VARBINARY(12), @i INT, @Tries INT = 0;

    WHILE NOT EXISTS (SELECT 1 FROM dbo.WalletInviteKeys WHERE UserId = @UserId) AND @Tries < 5
    BEGIN
        SET @Tries += 1;
        SET @Bytes = CRYPT_GEN_RANDOM(12);
        SET @Key = '';
        SET @i = 1;
        WHILE @i <= 12
        BEGIN
            SET @Key += SUBSTRING(@Alphabet, (CAST(SUBSTRING(@Bytes, @i, 1) AS INT) % 31) + 1, 1);
            SET @i += 1;
        END

        BEGIN TRY
            INSERT INTO dbo.WalletInviteKeys (UserId, InviteKey)
            SELECT @UserId, @Key
            WHERE NOT EXISTS (SELECT 1 FROM dbo.WalletInviteKeys WITH (UPDLOCK, HOLDLOCK) WHERE UserId = @UserId);
        END TRY
        BEGIN CATCH
            -- 2627/2601: the key was taken (or a parallel call made this user's key): try again
            IF ERROR_NUMBER() NOT IN (2601, 2627) THROW;
        END CATCH
    END

    SELECT InviteKey FROM dbo.WalletInviteKeys WHERE UserId = @UserId;
END
GO

/* -----------------------------------------------------------------------------
   2. Self registration: script 27 version + the inviter's key of a shared link
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_User_SelfRegister
    @FullName      NVARCHAR(200),
    @Email         NVARCHAR(256),
    @MobileNumber  NVARCHAR(20),
    @PasswordHash  NVARCHAR(200),
    @AadhaarNumber NVARCHAR(20) = NULL,
    @ReferralToken UNIQUEIDENTIFIER = NULL,
    @InviterKey    VARCHAR(16) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @MobileNumber = NULLIF(LTRIM(RTRIM(@MobileNumber)), '');

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email already registered' AS Message, CAST(0 AS INT) AS UserId;
        RETURN;
    END
    IF @MobileNumber IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Mobile number already registered' AS Message, CAST(0 AS INT) AS UserId;
        RETURN;
    END

    -- the wallet trigger reads both while the user is inserted
    EXEC sp_set_session_context N'ReferralToken', @ReferralToken;
    EXEC sp_set_session_context N'InviterKey', @InviterKey;

    DECLARE @NewUserId INT;
    BEGIN TRY
        -- No global role: what the user may do comes from the company role (CompanyUsers)
        INSERT INTO dbo.Users (FullName, Email, MobileNumber, PasswordHash, AadhaarNumber, IsActive)
        VALUES (@FullName, @Email, @MobileNumber, @PasswordHash, @AadhaarNumber, 1);

        SET @NewUserId = CAST(SCOPE_IDENTITY() AS INT);
        EXEC sp_set_session_context N'ReferralToken', NULL;
        EXEC sp_set_session_context N'InviterKey', NULL;
    END TRY
    BEGIN CATCH
        EXEC sp_set_session_context N'ReferralToken', NULL;
        EXEC sp_set_session_context N'InviterKey', NULL;
        THROW;
    END CATCH

    SELECT CAST(1 AS INT) AS Success, 'Registration successful' AS Message, @NewUserId AS UserId;
END
GO

/* -----------------------------------------------------------------------------
   3. Pay welcome / referral credits (as script 27, with the invite key and inviter-only pay).
      No result set. Every "nothing to do" case returns quietly; every payment is guarded
      twice (NOT EXISTS under a lock + unique index).
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Wallet_OnUserOnboarded
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT OFF;   -- an error rolls back to the savepoint below, not the caller's transaction

    DECLARE @Welcome INT = ISNULL((SELECT TRY_CAST(SettingValue AS INT) FROM dbo.PlatformSettings WHERE SettingKey = 'WelcomeCredits'), 0);
    DECLARE @Reward  INT = ISNULL((SELECT TRY_CAST(SettingValue AS INT) FROM dbo.PlatformSettings WHERE SettingKey = 'ReferralCredits'), 0);
    DECLARE @Started DATETIME = (SELECT TRY_CONVERT(DATETIME, SettingValue) FROM dbo.PlatformSettings WHERE SettingKey = 'WalletStartedAt');

    IF @Started IS NULL RETURN;
    IF dbo.fn_Wallet_IsOnboarded(@UserId) <> 1 RETURN;

    DECLARE @Email NVARCHAR(256), @FullName NVARCHAR(200), @CreatedAt DATETIME;
    SELECT @Email = LOWER(LTRIM(RTRIM(ISNULL(Email, '')))), @FullName = LTRIM(RTRIM(FullName)), @CreatedAt = CreatedAt
    FROM dbo.Users WHERE UserId = @UserId;

    IF @CreatedAt IS NULL OR @CreatedAt < @Started RETURN;

    DECLARE @OwnTran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    BEGIN TRY
        IF @OwnTran = 1 BEGIN TRANSACTION; ELSE SAVE TRANSACTION WalletOnboarded;

        -- a friend who came through an invite: the mail link's token, else the shared link's key, else the e-mail
        IF NOT EXISTS (SELECT 1 FROM dbo.Referrals WITH (UPDLOCK, HOLDLOCK) WHERE FriendUserId = @UserId)
        BEGIN
            DECLARE @Token UNIQUEIDENTIFIER =
                TRY_CONVERT(UNIQUEIDENTIFIER, CAST(SESSION_CONTEXT(N'ReferralToken') AS NVARCHAR(50)));
            DECLARE @Key VARCHAR(16) = NULLIF(LTRIM(RTRIM(CAST(SESSION_CONTEXT(N'InviterKey') AS VARCHAR(16)))), '');
            DECLARE @ReferralId INT = NULL;

            IF @Token IS NOT NULL
                SELECT @ReferralId = ReferralId FROM dbo.Referrals WITH (UPDLOCK, HOLDLOCK)
                WHERE Token = @Token AND Status = 'Sent' AND InviterUserId <> @UserId;

            -- the shared link: the inviter's own e-mail invite to this address if there is one, else a new row
            IF @ReferralId IS NULL AND @Key IS NOT NULL AND @Email <> ''
            BEGIN
                DECLARE @KeyOwner INT = (SELECT UserId FROM dbo.WalletInviteKeys WHERE InviteKey = @Key);
                IF @KeyOwner IS NOT NULL AND @KeyOwner <> @UserId
                BEGIN
                    DECLARE @OldStatus VARCHAR(10);
                    SELECT @ReferralId = ReferralId, @OldStatus = Status FROM dbo.Referrals WITH (UPDLOCK, HOLDLOCK)
                    WHERE InviterUserId = @KeyOwner AND Email = @Email;

                    IF @ReferralId IS NULL
                    BEGIN
                        INSERT INTO dbo.Referrals (InviterUserId, Email, Status)
                        VALUES (@KeyOwner, @Email, 'Sent');
                        SET @ReferralId = CAST(SCOPE_IDENTITY() AS INT);
                    END
                    ELSE IF @OldStatus <> 'Sent'
                        SET @ReferralId = NULL;
                END
            END

            IF @ReferralId IS NULL AND @Email <> ''
                SELECT TOP (1) @ReferralId = ReferralId FROM dbo.Referrals WITH (UPDLOCK, HOLDLOCK)
                WHERE Status = 'Sent' AND InviterUserId <> @UserId
                  AND Email = @Email            -- stored normalized; @Email is LOWER(LTRIM(RTRIM(..))) above
                ORDER BY SentAt, ReferralId;

            IF @ReferralId IS NOT NULL
                UPDATE dbo.Referrals
                SET Status = 'Joined', FriendUserId = @UserId, JoinedAt = SYSDATETIME()
                WHERE ReferralId = @ReferralId AND Status = 'Sent';
        END

        -- welcome credits, once
        IF @Welcome > 0
           AND NOT EXISTS (SELECT 1 FROM dbo.WalletLedger WITH (UPDLOCK, HOLDLOCK) WHERE UserId = @UserId AND Kind = 'Welcome')
            INSERT INTO dbo.WalletLedger (UserId, Amount, Kind, Note)
            VALUES (@UserId, @Welcome, 'Welcome', N'Welcome to Encryptz');

        -- referral credits: the inviter only, once
        DECLARE @RefId INT, @InviterId INT;
        SELECT @RefId = r.ReferralId, @InviterId = r.InviterUserId
        FROM dbo.Referrals r WITH (UPDLOCK, HOLDLOCK)
        WHERE r.FriendUserId = @UserId AND r.Status = 'Joined';

        IF @RefId IS NOT NULL
        BEGIN
            IF @Reward > 0
               AND NOT EXISTS (SELECT 1 FROM dbo.WalletLedger WITH (UPDLOCK, HOLDLOCK) WHERE ReferralId = @RefId AND Kind = 'ReferralInviter')
                INSERT INTO dbo.WalletLedger (UserId, Amount, Kind, ReferralId, Note)
                VALUES (@InviterId, @Reward, 'ReferralInviter', @RefId, LEFT(N'Your friend ' + ISNULL(NULLIF(@FullName, N''), N'a friend') + N' joined', 200));

            UPDATE dbo.Referrals SET Status = 'Credited', CreditedAt = SYSDATETIME()
            WHERE ReferralId = @RefId AND Status = 'Joined';
        END

        IF @OwnTran = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @OwnTran = 1
        BEGIN
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        END
        ELSE IF XACT_STATE() = 1
            ROLLBACK TRANSACTION WalletOnboarded;
        THROW;
    END CATCH
END
GO

PRINT 'Wallet: invite links, and referral credits for the inviter only.';
GO
SET NOEXEC OFF;
GO
