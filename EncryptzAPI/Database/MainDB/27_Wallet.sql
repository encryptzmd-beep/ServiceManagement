/* =============================================================================
   MainDB · 27 · Wallet: credits ledger and referrals for individuals
   -----------------------------------------------------------------------------
   Run in MainDBEncryptz AFTER 26_Platform_Database_State.sql. SAFE TO RE-RUN: tables,
   settings and the app row are created only when missing; procedures are CREATE OR ALTER.
   A wallet error at statement level never refuses a user save; a deadlock or a transaction
   already doomed still rolls back the caller (SQL Server cannot prevent that).
   The ledger is append-only: this script never updates or deletes a ledger row.

     dbo.WalletLedger        one row per credit (Amount <> 0), Kind Welcome | ReferralJoined | ReferralInviter
     dbo.Referrals           one invite per (inviter, e-mail); Status Sent -> Joined -> Credited
     dbo.PlatformSettings    WelcomeCredits (0), ReferralCredits (0)  0 = reward off
                             WalletStartedAt (written once; only users created after it are paid)
     dbo.Modules             WALLET, a released Personal app
     dbo.fn_Wallet_IsOnboarded      the one definition of "onboarded" (name and mobile)
     dbo.sp_Wallet_OnUserOnboarded  pays welcome / referral credits, safe to call again
     dbo.TR_Users_Wallet            calls it for a new user or a changed name / mobile; raises no error of its own
     dbo.sp_User_SelfRegister       as script 06 plus @ReferralToken
     dbo.sp_Wallet_GetBalance / GetLedger / GetReferrals / SaveReferral
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

IF OBJECT_ID('dbo.PlatformSettings') IS NULL OR OBJECT_ID('dbo.Modules') IS NULL
   OR COL_LENGTH('dbo.Modules', 'AppType') IS NULL OR COL_LENGTH('dbo.Users', 'CreatedAt') IS NULL
BEGIN
    RAISERROR('Run scripts 20 and 21 in this database first. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. Tables
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Referrals') IS NULL
CREATE TABLE dbo.Referrals
(
    ReferralId    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Referrals PRIMARY KEY,
    InviterUserId INT NOT NULL CONSTRAINT FK_Referrals_Inviter REFERENCES dbo.Users (UserId),
    Email         NVARCHAR(256) NOT NULL,                      -- stored trimmed and lower case
    Token         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Referrals_Token DEFAULT (NEWID()) CONSTRAINT UQ_Referrals_Token UNIQUE,
    Status        VARCHAR(10) NOT NULL CONSTRAINT DF_Referrals_Status DEFAULT ('Sent')
                  CONSTRAINT CK_Referrals_Status CHECK (Status IN ('Sent', 'Joined', 'Credited')),
    FriendUserId  INT NULL CONSTRAINT FK_Referrals_Friend REFERENCES dbo.Users (UserId),
    SentAt        DATETIME2 NOT NULL CONSTRAINT DF_Referrals_SentAt DEFAULT (SYSDATETIME()),   -- first send, never changed
    LastSentAt    DATETIME2 NULL,                              -- latest send (a resend moves this, not SentAt)
    JoinedAt      DATETIME2 NULL,
    CreditedAt    DATETIME2 NULL
);
GO

IF COL_LENGTH('dbo.Referrals', 'LastSentAt') IS NULL
    ALTER TABLE dbo.Referrals ADD LastSentAt DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Referrals_Inviter_Email' AND object_id = OBJECT_ID('dbo.Referrals'))
    CREATE UNIQUE INDEX UX_Referrals_Inviter_Email ON dbo.Referrals (InviterUserId, Email);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Referrals_Friend' AND object_id = OBJECT_ID('dbo.Referrals'))
    CREATE UNIQUE INDEX UX_Referrals_Friend ON dbo.Referrals (FriendUserId) WHERE FriendUserId IS NOT NULL;
-- the e-mail fallback of sp_Wallet_OnUserOnboarded seeks here (Email is stored normalized)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Referrals_Email' AND object_id = OBJECT_ID('dbo.Referrals'))
    CREATE INDEX IX_Referrals_Email ON dbo.Referrals (Email) INCLUDE (Status, SentAt);
GO

IF OBJECT_ID('dbo.WalletLedger') IS NULL
CREATE TABLE dbo.WalletLedger
(
    EntryId    BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WalletLedger PRIMARY KEY,
    UserId     INT NOT NULL CONSTRAINT FK_WalletLedger_User REFERENCES dbo.Users (UserId),
    Amount     INT NOT NULL CONSTRAINT CK_WalletLedger_Amount CHECK (Amount <> 0),
    Kind       VARCHAR(20) NOT NULL,
    ReferralId INT NULL CONSTRAINT FK_WalletLedger_Referral REFERENCES dbo.Referrals (ReferralId),
    Note       NVARCHAR(200) NULL,
    CreatedAt  DATETIME2 NOT NULL CONSTRAINT DF_WalletLedger_CreatedAt DEFAULT (SYSDATETIME())
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_WalletLedger_Kind' AND parent_object_id = OBJECT_ID('dbo.WalletLedger'))
    ALTER TABLE dbo.WalletLedger ADD CONSTRAINT CK_WalletLedger_Kind
        CHECK (Kind IN ('Welcome', 'ReferralJoined', 'ReferralInviter', 'Redeem', 'Adjustment'));
GO

-- the ledger is append-only: a correction is a new entry. This trigger does not touch dbo.Users, so raising is fine.
CREATE OR ALTER TRIGGER dbo.TR_WalletLedger_NoChange
ON dbo.WalletLedger
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50000, 'Wallet entries cannot be changed or deleted; add a correcting entry.', 1;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WalletLedger_User' AND object_id = OBJECT_ID('dbo.WalletLedger'))
    CREATE INDEX IX_WalletLedger_User ON dbo.WalletLedger (UserId, EntryId DESC);
-- the same payment can never be written twice, whatever the code does
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_WalletLedger_Welcome' AND object_id = OBJECT_ID('dbo.WalletLedger'))
    CREATE UNIQUE INDEX UX_WalletLedger_Welcome ON dbo.WalletLedger (UserId) WHERE Kind = 'Welcome';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_WalletLedger_Referral' AND object_id = OBJECT_ID('dbo.WalletLedger'))
    CREATE UNIQUE INDEX UX_WalletLedger_Referral ON dbo.WalletLedger (ReferralId, Kind) WHERE ReferralId IS NOT NULL;
GO

/* -----------------------------------------------------------------------------
   2. Settings and the app row (only when missing)
   ----------------------------------------------------------------------------- */
INSERT INTO dbo.PlatformSettings (SettingKey, SettingValue)
SELECT 'WelcomeCredits', '0'
WHERE NOT EXISTS (SELECT 1 FROM dbo.PlatformSettings WHERE SettingKey = 'WelcomeCredits');

INSERT INTO dbo.PlatformSettings (SettingKey, SettingValue)
SELECT 'ReferralCredits', '0'
WHERE NOT EXISTS (SELECT 1 FROM dbo.PlatformSettings WHERE SettingKey = 'ReferralCredits');

INSERT INTO dbo.PlatformSettings (SettingKey, SettingValue)
SELECT 'WalletStartedAt', CONVERT(VARCHAR(19), GETDATE(), 126)
WHERE NOT EXISTS (SELECT 1 FROM dbo.PlatformSettings WHERE SettingKey = 'WalletStartedAt');
GO

INSERT INTO dbo.Modules (ModuleKey, ModuleName, Description, Icon, Family, AppType, RoutePath, SortOrder, IsReleased, IsActive)
SELECT N'WALLET', N'Wallet', N'Your credits and invites.', N'account_balance_wallet', NULL, N'Personal', N'apps/wallet', 3, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE ModuleKey = N'WALLET');
GO

/* -----------------------------------------------------------------------------
   3. Onboarded: the one place that decides it
   ----------------------------------------------------------------------------- */
CREATE OR ALTER FUNCTION dbo.fn_Wallet_IsOnboarded (@UserId INT)
RETURNS BIT
AS
BEGIN
    RETURN ISNULL((SELECT CAST(CASE WHEN LTRIM(RTRIM(ISNULL(u.FullName, ''))) <> ''
                                     AND LTRIM(RTRIM(ISNULL(u.MobileNumber, ''))) <> ''
                                    THEN 1 ELSE 0 END AS BIT)
                   FROM dbo.Users u WHERE u.UserId = @UserId), 0);
END
GO

/* -----------------------------------------------------------------------------
   4. Pay welcome / referral credits. No result set. Every "nothing to do" case returns
      quietly; every payment is guarded twice (NOT EXISTS under a lock + unique index).
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

        -- a friend who came through an invite: by the link's token first, else by e-mail
        IF NOT EXISTS (SELECT 1 FROM dbo.Referrals WITH (UPDLOCK, HOLDLOCK) WHERE FriendUserId = @UserId)
        BEGIN
            DECLARE @Token UNIQUEIDENTIFIER =
                TRY_CONVERT(UNIQUEIDENTIFIER, CAST(SESSION_CONTEXT(N'ReferralToken') AS NVARCHAR(50)));
            DECLARE @ReferralId INT = NULL;

            IF @Token IS NOT NULL
                SELECT @ReferralId = ReferralId FROM dbo.Referrals WITH (UPDLOCK, HOLDLOCK)
                WHERE Token = @Token AND Status = 'Sent' AND InviterUserId <> @UserId;

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

        -- referral credits: the friend and the inviter, once
        DECLARE @RefId INT, @InviterId INT, @InviterName NVARCHAR(200);
        SELECT @RefId = r.ReferralId, @InviterId = r.InviterUserId, @InviterName = LTRIM(RTRIM(i.FullName))
        FROM dbo.Referrals r WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Users i ON i.UserId = r.InviterUserId
        WHERE r.FriendUserId = @UserId AND r.Status = 'Joined';

        IF @RefId IS NOT NULL
        BEGIN
            IF @Reward > 0
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM dbo.WalletLedger WITH (UPDLOCK, HOLDLOCK) WHERE ReferralId = @RefId AND Kind = 'ReferralJoined')
                    INSERT INTO dbo.WalletLedger (UserId, Amount, Kind, ReferralId, Note)
                    VALUES (@UserId, @Reward, 'ReferralJoined', @RefId, LEFT(N'Joined with an invite from ' + ISNULL(NULLIF(@InviterName, N''), N'a friend'), 200));

                IF NOT EXISTS (SELECT 1 FROM dbo.WalletLedger WITH (UPDLOCK, HOLDLOCK) WHERE ReferralId = @RefId AND Kind = 'ReferralInviter')
                    INSERT INTO dbo.WalletLedger (UserId, Amount, Kind, ReferralId, Note)
                    VALUES (@InviterId, @Reward, 'ReferralInviter', @RefId, LEFT(N'Your friend ' + ISNULL(NULLIF(@FullName, N''), N'a friend') + N' joined', 200));
            END

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

/* -----------------------------------------------------------------------------
   5. The trigger: a user save is never refused because of the wallet
      A statement-level error in the wallet is swallowed and the next save pays what is still due.
      XACT_ABORT is OFF here so the swallowed error leaves the caller's transaction usable.
      A deadlock or an already doomed transaction still rolls the caller back.
      Only a new user or a changed name / mobile enters the wallet: a password change does not.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER TRIGGER dbo.TR_Users_Wallet
ON dbo.Users
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT OFF;   -- a wallet error rethrown into the CATCH below must not doom the caller's transaction

    IF TRIGGER_NESTLEVEL(@@PROCID) > 1 RETURN;

    IF EXISTS (SELECT 1 FROM deleted) AND NOT (UPDATE(FullName) OR UPDATE(MobileNumber)) RETURN;

    DECLARE @UserId INT;
    DECLARE Touched CURSOR LOCAL FAST_FORWARD FOR
        SELECT UserId FROM inserted;

    OPEN Touched;
    FETCH NEXT FROM Touched INTO @UserId;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            EXEC dbo.sp_Wallet_OnUserOnboarded @UserId = @UserId;
        END TRY
        BEGIN CATCH
            -- never block the save
        END CATCH
        FETCH NEXT FROM Touched INTO @UserId;
    END
    CLOSE Touched;
    DEALLOCATE Touched;
END
GO

/* -----------------------------------------------------------------------------
   6. Self registration: script 06 version + the referral token of the sign-up link
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_User_SelfRegister
    @FullName      NVARCHAR(200),
    @Email         NVARCHAR(256),
    @MobileNumber  NVARCHAR(20),
    @PasswordHash  NVARCHAR(200),
    @AadhaarNumber NVARCHAR(20) = NULL,
    @ReferralToken UNIQUEIDENTIFIER = NULL
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

    -- the wallet trigger reads the token while the user is inserted
    EXEC sp_set_session_context N'ReferralToken', @ReferralToken;

    DECLARE @NewUserId INT;
    BEGIN TRY
        -- No global role: what the user may do comes from the company role (CompanyUsers)
        INSERT INTO dbo.Users (FullName, Email, MobileNumber, PasswordHash, AadhaarNumber, IsActive)
        VALUES (@FullName, @Email, @MobileNumber, @PasswordHash, @AadhaarNumber, 1);

        SET @NewUserId = CAST(SCOPE_IDENTITY() AS INT);
        EXEC sp_set_session_context N'ReferralToken', NULL;
    END TRY
    BEGIN CATCH
        EXEC sp_set_session_context N'ReferralToken', NULL;
        THROW;
    END CATCH

    SELECT CAST(1 AS INT) AS Success, 'Registration successful' AS Message, @NewUserId AS UserId;
END
GO

/* -----------------------------------------------------------------------------
   7. Reads
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Wallet_GetBalance
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CAST(ISNULL(SUM(Amount), 0) AS INT) AS Balance
    FROM dbo.WalletLedger WHERE UserId = @UserId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Wallet_GetLedger
    @UserId   INT,
    @Page     INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF @Page < 1 SET @Page = 1;
    IF @PageSize < 1 SET @PageSize = 20;
    IF @PageSize > 100 SET @PageSize = 100;

    SELECT EntryId, Amount, Kind, Note, CreatedAt,
           COUNT(*) OVER () AS TotalCount
    FROM dbo.WalletLedger
    WHERE UserId = @UserId
    ORDER BY EntryId DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Wallet_GetReferrals
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT r.ReferralId, r.Email, r.Status, r.SentAt, r.JoinedAt, r.CreditedAt,
           f.FullName AS FriendName
    FROM dbo.Referrals r
    LEFT JOIN dbo.Users f ON f.UserId = r.FriendUserId
    WHERE r.InviterUserId = @UserId
    ORDER BY r.SentAt DESC, r.ReferralId DESC;
END
GO

/* -----------------------------------------------------------------------------
   8. Invite a friend by e-mail
      Result: Created | Resent | Self | HasAccount | Limit.
      A resend (only while Sent) moves LastSentAt, not SentAt, and counts toward the 20 invites a day.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Wallet_SaveReferral
    @InviterUserId INT,
    @Email         NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Email = LOWER(LTRIM(RTRIM(ISNULL(@Email, ''))));

    DECLARE @InviterName NVARCHAR(200), @InviterEmail NVARCHAR(256);
    SELECT @InviterName = FullName, @InviterEmail = LOWER(LTRIM(RTRIM(ISNULL(Email, ''))))
    FROM dbo.Users WHERE UserId = @InviterUserId;

    IF @InviterEmail IS NULL OR @Email = N''
    BEGIN
        SELECT CAST('Invalid' AS VARCHAR(20)) AS Result, CAST(NULL AS UNIQUEIDENTIFIER) AS Token, @InviterName AS InviterName;
        RETURN;
    END

    IF @Email = @InviterEmail
    BEGIN
        SELECT CAST('Self' AS VARCHAR(20)) AS Result, CAST(NULL AS UNIQUEIDENTIFIER) AS Token, @InviterName AS InviterName;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email)   -- sargable, no scan (the column collation is case-insensitive)
    BEGIN
        SELECT CAST('HasAccount' AS VARCHAR(20)) AS Result, CAST(NULL AS UNIQUEIDENTIFIER) AS Token, @InviterName AS InviterName;
        RETURN;
    END

    DECLARE @Token UNIQUEIDENTIFIER, @Result VARCHAR(20), @OldStatus VARCHAR(10);

    BEGIN TRANSACTION;

    SELECT @OldStatus = Status, @Token = Token FROM dbo.Referrals WITH (UPDLOCK, HOLDLOCK)
    WHERE InviterUserId = @InviterUserId AND Email = @Email;

    IF @OldStatus IS NOT NULL AND @OldStatus <> 'Sent'      -- the friend has joined: nothing to resend
        SET @Result = 'HasAccount';
    ELSE IF (SELECT COUNT(*) FROM dbo.Referrals WITH (UPDLOCK, HOLDLOCK)
        WHERE InviterUserId = @InviterUserId AND ISNULL(LastSentAt, SentAt) >= CAST(CAST(SYSDATETIME() AS DATE) AS DATETIME2)) >= 20
        SET @Result = 'Limit';
    ELSE IF @OldStatus = 'Sent'
    BEGIN
        UPDATE dbo.Referrals SET LastSentAt = SYSDATETIME()      -- SentAt stays the first send
        WHERE InviterUserId = @InviterUserId AND Email = @Email;
        SET @Result = 'Resent';
    END
    ELSE
    BEGIN
        SET @Token = NEWID();
        INSERT INTO dbo.Referrals (InviterUserId, Email, Token, LastSentAt) VALUES (@InviterUserId, @Email, @Token, SYSDATETIME());
        SET @Result = 'Created';
    END

    COMMIT TRANSACTION;

    SELECT @Result AS Result, CASE WHEN @Result IN ('Created', 'Resent') THEN @Token END AS Token, @InviterName AS InviterName;
END
GO
