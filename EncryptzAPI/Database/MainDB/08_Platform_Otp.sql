/* =============================================================================
   MainDB  ·  OTP lock of the Platform Admin screen
   -----------------------------------------------------------------------------
   Opening Platform Admin needs a 4-digit code that the API e-mails to the
   platform owner (appsettings: PlatformAdmin:OtpEmail). The code is stored here,
   hashed by the API, per requesting user.

     sp_Platform_CreateOtp   one live code per user, at most one request a minute
     sp_Platform_VerifyOtp   5 wrong attempts burn the code

   Needs 06_UI_Coverage_Fixes.sql (Otp.Purpose / Otp.Email). SAFE TO RE-RUN.
   ============================================================================= */

IF COL_LENGTH('dbo.Otp', 'Purpose') IS NULL
    ALTER TABLE dbo.Otp ADD Purpose NVARCHAR(20) NOT NULL CONSTRAINT DF_Otp_Purpose DEFAULT ('Login');
GO
IF COL_LENGTH('dbo.Otp', 'Email') IS NULL
    ALTER TABLE dbo.Otp ADD Email NVARCHAR(256) NULL;
GO
IF COL_LENGTH('dbo.Otp', 'UserId') IS NULL
    ALTER TABLE dbo.Otp ADD UserId INT NULL;
GO
IF COL_LENGTH('dbo.Otp', 'Attempts') IS NULL
    ALTER TABLE dbo.Otp ADD Attempts INT NOT NULL CONSTRAINT DF_Otp_Attempts DEFAULT (0);
GO
/* the platform code is stored as a hash, which does not fit OtpCode NVARCHAR(10) */
IF COL_LENGTH('dbo.Otp', 'CodeHash') IS NULL
    ALTER TABLE dbo.Otp ADD CodeHash NVARCHAR(200) NULL;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Platform_CreateOtp
    @UserId    INT,
    @Email     NVARCHAR(256),
    @CodeHash  NVARCHAR(200),
    @ValidMinutes INT = 5
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.Otp
               WHERE Purpose = 'Platform' AND UserId = @UserId
                 AND CreatedAt > DATEADD(SECOND, -60, GETDATE()))
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'A code was just sent. Please wait a minute before asking for a new one.' AS Message;
        RETURN;
    END

    /* only the newest code is valid */
    UPDATE dbo.Otp SET IsUsed = 1
    WHERE Purpose = 'Platform' AND UserId = @UserId AND IsUsed = 0;

    INSERT INTO dbo.Otp (MobileNumber, Email, OtpCode, CodeHash, ExpiresAt, IsUsed, Purpose, UserId)
    VALUES ('', @Email, '', @CodeHash, DATEADD(MINUTE, @ValidMinutes, GETDATE()), 0, 'Platform', @UserId);

    SELECT CAST(1 AS INT) AS Success, 'Code created' AS Message;
END
GO

/* Returns the live code's hash for the API to compare (Table[0] empty = no live code).
   @Matched is reported back with a second call. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetOtp
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1 OtpId, CodeHash, Attempts
    FROM dbo.Otp
    WHERE Purpose = 'Platform' AND UserId = @UserId
      AND IsUsed = 0 AND ExpiresAt > GETDATE()
    ORDER BY OtpId DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Platform_VerifyOtp
    @OtpId   INT,
    @UserId  INT,
    @Matched BIT
AS
BEGIN
    SET NOCOUNT ON;

    IF @Matched = 1
    BEGIN
        UPDATE dbo.Otp SET IsUsed = 1
        WHERE OtpId = @OtpId AND UserId = @UserId AND Purpose = 'Platform' AND IsUsed = 0;

        SELECT CAST(@@ROWCOUNT AS INT) AS Success, CAST(0 AS INT) AS AttemptsLeft;
        RETURN;
    END

    UPDATE dbo.Otp
    SET Attempts = Attempts + 1,
        IsUsed   = CASE WHEN Attempts + 1 >= 5 THEN 1 ELSE IsUsed END
    WHERE OtpId = @OtpId AND UserId = @UserId AND Purpose = 'Platform';

    SELECT CAST(0 AS INT) AS Success,
           ISNULL((SELECT CASE WHEN 5 - Attempts < 0 THEN 0 ELSE 5 - Attempts END
                   FROM dbo.Otp WHERE OtpId = @OtpId), 0) AS AttemptsLeft;
END
GO

PRINT 'MainDB platform OTP applied.';
GO
