/* =============================================================================
   MainDB · Company creation and database provisioning
   -----------------------------------------------------------------------------
   Run AFTER 14_Company_Tenancy_Cutover.sql and 19_Module_Management.sql, with
   the new API. Run it AGAIN every time script 14 is run again: script 14
   re-creates dbo.sp_User_GetCompanies and dbo.sp_Platform_GetCompanies in their
   earlier form.

   ADDS (nothing is removed, no existing row is changed):
     dbo.DbServers            SQL servers on which the API creates company databases
     dbo.PlatformSettings     MaxCompaniesPerUser (1), TenantLookupSourceDb ('')
     dbo.Companies            DbServerId, ProvisionError, ProvisionStartedAt,
                              CreatedBy, FirstBranchName
     procedures               sp_Company_Create, sp_Company_GetCreationState,
                              sp_Provision_*, sp_Platform_*DbServer*, sp_Platform_*Setting*
   RE-CREATES with extra columns at the end:
     sp_User_GetCompanies     + IsCreator
     sp_Platform_GetCompanies + ProvisionStatus, ProvisionError, DatabaseName

   dbo.DbServers starts EMPTY. Until a platform administrator adds an active
   default server in the application, nobody can create a company and the API
   creates no database.

   This script creates no database and changes nothing in any tenant database.
   Select the SaaS main database in SSMS before running. No USE statement on
   purpose. SAFE TO RE-RUN.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;   -- required by the filtered index below
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Companies') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Companies') IS NOT NULL
   AND (   COL_LENGTH('dbo.Companies', 'ProvisionStatus') IS NULL
        OR COL_LENGTH('dbo.Companies', 'TenantKey') IS NULL
        OR OBJECT_ID('dbo.Modules') IS NULL
        OR OBJECT_ID('dbo.CompanyModules') IS NULL
        OR OBJECT_ID('dbo.UserModuleAccess') IS NULL)
BEGIN
    RAISERROR('Run 13_Company_Tenancy_Schema.sql and 14_Company_Tenancy_Cutover.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. Servers on which company databases are created
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.DbServers') IS NULL
CREATE TABLE dbo.DbServers
(
    DbServerId       INT IDENTITY(1,1) PRIMARY KEY,
    ServerName       NVARCHAR(200) NOT NULL,
    AdminUser        NVARCHAR(100) NOT NULL,          -- creates the database AND is its connection login
    AdminPasswordEnc NVARCHAR(500) NOT NULL,          -- ENCRYPTED (ITenantSecretProtector)
    ExtraOptions     NVARCHAR(400) NULL,
    IsDefault        BIT NOT NULL CONSTRAINT DF_DbServers_IsDefault DEFAULT (0),
    IsActive         BIT NOT NULL CONSTRAINT DF_DbServers_IsActive  DEFAULT (1),
    CreatedAt        DATETIME NOT NULL CONSTRAINT DF_DbServers_CreatedAt DEFAULT (GETDATE())
);
GO

/* at most one default server */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_DbServers_Default' AND object_id = OBJECT_ID('dbo.DbServers'))
    CREATE UNIQUE INDEX UX_DbServers_Default ON dbo.DbServers(IsDefault) WHERE IsDefault = 1;
GO

/* -----------------------------------------------------------------------------
   2. Platform settings
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.PlatformSettings') IS NULL
CREATE TABLE dbo.PlatformSettings
(
    SettingKey   NVARCHAR(100) NOT NULL CONSTRAINT PK_PlatformSettings PRIMARY KEY,
    SettingValue NVARCHAR(400) NOT NULL,
    UpdatedAt    DATETIME NOT NULL CONSTRAINT DF_PlatformSettings_UpdatedAt DEFAULT (GETDATE()),
    UpdatedBy    INT NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.PlatformSettings WHERE SettingKey = 'MaxCompaniesPerUser')
    INSERT INTO dbo.PlatformSettings (SettingKey, SettingValue) VALUES ('MaxCompaniesPerUser', '1');
IF NOT EXISTS (SELECT 1 FROM dbo.PlatformSettings WHERE SettingKey = 'TenantLookupSourceDb')
    INSERT INTO dbo.PlatformSettings (SettingKey, SettingValue) VALUES ('TenantLookupSourceDb', '');
GO

/* -----------------------------------------------------------------------------
   3. Companies: who created it and how its database is coming along
   ----------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.Companies', 'DbServerId') IS NULL
    ALTER TABLE dbo.Companies ADD DbServerId INT NULL;                 -- NULL = database attached by hand
IF COL_LENGTH('dbo.Companies', 'ProvisionError') IS NULL
    ALTER TABLE dbo.Companies ADD ProvisionError NVARCHAR(2000) NULL;  -- platform administrators only
IF COL_LENGTH('dbo.Companies', 'ProvisionStartedAt') IS NULL
    ALTER TABLE dbo.Companies ADD ProvisionStartedAt DATETIME NULL;
IF COL_LENGTH('dbo.Companies', 'CreatedBy') IS NULL
    ALTER TABLE dbo.Companies ADD CreatedBy INT NULL;
IF COL_LENGTH('dbo.Companies', 'FirstBranchName') IS NULL
    ALTER TABLE dbo.Companies ADD FirstBranchName NVARCHAR(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Companies_CreatedBy' AND object_id = OBJECT_ID('dbo.Companies'))
    CREATE INDEX IX_Companies_CreatedBy ON dbo.Companies(CreatedBy) WHERE CreatedBy IS NOT NULL;
GO

/* -----------------------------------------------------------------------------
   4. Creating a company
   ----------------------------------------------------------------------------- */

/* How many companies the user has created, the limit and whether a server is
   there. Companies whose database failed do not count. */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GetCreationState
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        (SELECT COUNT(*) FROM dbo.Companies c
         WHERE c.CreatedBy = @UserId AND c.ProvisionStatus <> 'Failed')                            AS Created,
        ISNULL((SELECT TRY_CAST(s.SettingValue AS INT) FROM dbo.PlatformSettings s
                WHERE s.SettingKey = 'MaxCompaniesPerUser'), 1)                                     AS Limit,
        CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.DbServers WHERE IsDefault = 1 AND IsActive = 1)
                  THEN 1 ELSE 0 END AS BIT)                                                         AS ServerAvailable;
END
GO

/* The company, its creator as Admin and the Service module, in one transaction.
   The database is created afterwards by the API (status Provisioning).
   Two requests of the same user wait for each other, so the limit holds. */
CREATE OR ALTER PROCEDURE dbo.sp_Company_Create
    @CompanyName     NVARCHAR(200),
    @CompanyCode     NVARCHAR(50),
    @Address         NVARCHAR(400) = NULL,
    @City            NVARCHAR(100) = NULL,
    @PhoneNumber     NVARCHAR(30)  = NULL,
    @FirstBranchName NVARCHAR(200),
    @CreatedBy       INT,
    @IsPlatformAdmin BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CompanyId INT, @ServerId INT, @ModuleId INT, @Limit INT, @Created INT, @LockResult INT,
            @Lock NVARCHAR(100) = N'CompanyCreate:' + CAST(@CreatedBy AS NVARCHAR(20)),
            @Message NVARCHAR(200);

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @CreatedBy AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'User not found' AS Message, CAST(0 AS INT) AS CompanyId; RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        /* a negative result means the lock was NOT taken (time-out, deadlock): never go on without it */
        EXEC @LockResult = sp_getapplock @Resource = @Lock, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
        IF @LockResult < 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'The company could not be created. Please try again.' AS Message, CAST(0 AS INT) AS CompanyId;
            RETURN;
        END

        SELECT @ServerId = DbServerId FROM dbo.DbServers WHERE IsDefault = 1 AND IsActive = 1;
        SELECT @ModuleId = ModuleId FROM dbo.Modules WHERE ModuleKey = 'SERVICE' AND IsActive = 1;

        SET @Limit = ISNULL((SELECT TRY_CAST(SettingValue AS INT) FROM dbo.PlatformSettings
                             WHERE SettingKey = 'MaxCompaniesPerUser'), 1);
        SET @Created = (SELECT COUNT(*) FROM dbo.Companies
                        WHERE CreatedBy = @CreatedBy AND ProvisionStatus <> 'Failed');

        IF @ServerId IS NULL OR @ModuleId IS NULL OR (ISNULL(@IsPlatformAdmin, 0) = 0 AND @Limit <= 0)
            SET @Message = 'Company creation is not available right now';
        ELSE IF ISNULL(@IsPlatformAdmin, 0) = 0 AND @Created >= @Limit
            SET @Message = 'You have reached the number of companies you can create';
        ELSE IF EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyCode = @CompanyCode)
            SET @Message = 'This company code is already in use';

        IF @Message IS NOT NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, @Message AS Message, CAST(0 AS INT) AS CompanyId;
            RETURN;
        END

        INSERT INTO dbo.Companies
               (CompanyName, CompanyCode, Address, City, PhoneNumber, IsActive,
                TenantScopeId, ProvisionStatus, ProvisionStartedAt, CreatedBy, FirstBranchName, DbServerId)
        VALUES (@CompanyName, @CompanyCode, @Address, @City, @PhoneNumber, 1,
                1, 'Provisioning', GETDATE(), @CreatedBy, @FirstBranchName, @ServerId);

        SET @CompanyId = SCOPE_IDENTITY();

        /* the routing key carried in tokens: made from the id, never from typed text */
        UPDATE dbo.Companies
        SET TenantKey = 'T' + CASE WHEN @CompanyId < 1000000
                                   THEN RIGHT('000000' + CAST(@CompanyId AS VARCHAR(10)), 6)
                                   ELSE CAST(@CompanyId AS VARCHAR(10)) END
        WHERE CompanyId = @CompanyId;

        INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
        VALUES (@CompanyId, @CreatedBy, 'Admin', @CreatedBy, 1);

        INSERT INTO dbo.CompanyModules (CompanyId, ModuleId, IsEnabled)
        VALUES (@CompanyId, @ModuleId, 1);

        INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
        VALUES (@CompanyId, @CreatedBy, @ModuleId, @CreatedBy);

        COMMIT TRANSACTION;

        SELECT CAST(1 AS INT) AS Success, 'Company created. Its database is being set up.' AS Message, @CompanyId AS CompanyId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        /* 2627 / 2601: the code was taken by another request in the same moment */
        SELECT CAST(0 AS INT) AS Success,
               CASE WHEN ERROR_NUMBER() IN (2627, 2601) THEN 'This company code is already in use'
                    ELSE 'The company could not be created. Please try again.' END AS Message,
               CAST(0 AS INT) AS CompanyId;
    END CATCH
END
GO

/* -----------------------------------------------------------------------------
   5. The provisioning job (called by the API's background worker)
   ----------------------------------------------------------------------------- */

/* What the worker needs to build the database of a company. */
CREATE OR ALTER PROCEDURE dbo.sp_Provision_GetJob
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.CompanyId, c.TenantScopeId,
        ISNULL(NULLIF(LTRIM(RTRIM(c.FirstBranchName)), ''), 'Head Office') AS FirstBranchName,
        c.ProvisionStatus,
        ISNULL(s.ServerName, '')       AS ServerName,
        ISNULL(s.AdminUser, '')        AS AdminUser,
        ISNULL(s.AdminPasswordEnc, '') AS AdminPasswordEnc,
        ISNULL(s.ExtraOptions, '')     AS ExtraOptions,
        ISNULL((SELECT p.SettingValue FROM dbo.PlatformSettings p
                WHERE p.SettingKey = 'TenantLookupSourceDb'), '') AS LookupSourceDb
    FROM dbo.Companies c
    LEFT JOIN dbo.DbServers s ON s.DbServerId = c.DbServerId AND s.IsActive = 1
    WHERE c.CompanyId = @CompanyId;
END
GO

/* The database is built: the company gets its connection (taken from its
   server row) and becomes Ready. Only a company that is still Provisioning:
   a job that was given up (marked Failed) must not become Ready later. */
CREATE OR ALTER PROCEDURE dbo.sp_Provision_Complete
    @CompanyId    INT,
    @DatabaseName NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE c
    SET c.ServerName      = s.ServerName,
        c.DatabaseName    = @DatabaseName,
        c.DbUser          = s.AdminUser,
        c.DbPasswordEnc   = s.AdminPasswordEnc,
        c.ExtraOptions    = s.ExtraOptions,
        c.ProvisionStatus = 'Ready',
        c.ProvisionError  = NULL
    FROM dbo.Companies c
    INNER JOIN dbo.DbServers s ON s.DbServerId = c.DbServerId
    WHERE c.CompanyId = @CompanyId
      AND c.ProvisionStatus = 'Provisioning';

    SELECT CAST(CASE WHEN @@ROWCOUNT = 1 THEN 1 ELSE 0 END AS INT) AS Success,
           ISNULL((SELECT TenantKey FROM dbo.Companies WHERE CompanyId = @CompanyId), '') AS TenantKey;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Provision_Fail
    @CompanyId INT,
    @Error     NVARCHAR(2000)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Companies
    SET ProvisionStatus = 'Failed',
        ProvisionError  = LEFT(ISNULL(@Error, ''), 2000)
    WHERE CompanyId = @CompanyId
      AND ProvisionStatus = 'Provisioning';
END
GO

/* Try again: only a Failed company, by its creator or a platform administrator.
   The single UPDATE is the gate, so two retries cannot both start a job. */
CREATE OR ALTER PROCEDURE dbo.sp_Provision_Retry
    @CompanyId       INT,
    @UserId          INT,
    @IsPlatformAdmin BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ServerId INT = (SELECT DbServerId FROM dbo.DbServers WHERE IsDefault = 1 AND IsActive = 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies
                   WHERE CompanyId = @CompanyId AND IsActive = 1
                     AND (ISNULL(@IsPlatformAdmin, 0) = 1 OR CreatedBy = @UserId))
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message; RETURN;
    END

    IF @ServerId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company creation is not available right now' AS Message; RETURN;
    END

    UPDATE dbo.Companies
    SET ProvisionStatus = 'Provisioning', ProvisionStartedAt = GETDATE(), DbServerId = @ServerId
    WHERE CompanyId = @CompanyId
      AND ProvisionStatus = 'Failed';

    IF @@ROWCOUNT = 1
        SELECT CAST(1 AS INT) AS Success, 'The database is being set up.' AS Message;
    ELSE
        SELECT CAST(0 AS INT) AS Success, 'This company is not waiting for a retry' AS Message;
END
GO

/* Jobs that were interrupted (API restart, crash): give them up so the user
   can retry. */
CREATE OR ALTER PROCEDURE dbo.sp_Provision_FailStuck
    @OlderThanMinutes INT = 15
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Companies
    SET ProvisionStatus = 'Failed',
        ProvisionError  = 'The set-up did not finish (interrupted or timed out).'
    WHERE ProvisionStatus = 'Provisioning'
      AND ISNULL(ProvisionStartedAt, '19000101') < DATEADD(MINUTE, -ABS(ISNULL(@OlderThanMinutes, 15)), GETDATE());

    SELECT @@ROWCOUNT AS Failed;
END
GO

/* -----------------------------------------------------------------------------
   6. Platform Admin: database servers and settings
   ----------------------------------------------------------------------------- */

/* The password is never returned; HasPassword tells whether one is stored. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetDbServers
AS
BEGIN
    SET NOCOUNT ON;

    SELECT s.DbServerId, s.ServerName, s.AdminUser, ISNULL(s.ExtraOptions, '') AS ExtraOptions,
           s.IsDefault, s.IsActive, s.CreatedAt,
           CAST(CASE WHEN ISNULL(s.AdminPasswordEnc, '') = '' THEN 0 ELSE 1 END AS BIT) AS HasPassword,
           (SELECT COUNT(*) FROM dbo.Companies c WHERE c.DbServerId = s.DbServerId)     AS CompanyCount
    FROM dbo.DbServers s
    ORDER BY s.IsDefault DESC, s.ServerName;
END
GO

/* For the API only (connection test with the stored password). */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetDbServerSecret
    @DbServerId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT ServerName, AdminUser, AdminPasswordEnc, ISNULL(ExtraOptions, '') AS ExtraOptions
    FROM dbo.DbServers
    WHERE DbServerId = @DbServerId;
END
GO

/* @AdminPasswordEnc NULL or '' on an edit keeps the stored password.
   Making a server the default takes the mark from the previous one. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SaveDbServer
    @DbServerId       INT = 0,
    @ServerName       NVARCHAR(200),
    @AdminUser        NVARCHAR(100),
    @AdminPasswordEnc NVARCHAR(500) = NULL,
    @ExtraOptions     NVARCHAR(400) = NULL,
    @IsDefault        BIT = 0,
    @IsActive         BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @ServerName = LTRIM(RTRIM(ISNULL(@ServerName, '')));
    SET @AdminUser  = LTRIM(RTRIM(ISNULL(@AdminUser, '')));
    SET @IsActive   = ISNULL(@IsActive, 1);
    SET @IsDefault  = CASE WHEN @IsActive = 1 THEN ISNULL(@IsDefault, 0) ELSE 0 END;   -- an inactive server cannot be the default

    IF @ServerName = '' OR @AdminUser = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Server and login are required' AS Message, CAST(0 AS INT) AS DbServerId; RETURN;
    END

    IF ISNULL(@DbServerId, 0) = 0 AND ISNULL(@AdminPasswordEnc, '') = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Enter the password' AS Message, CAST(0 AS INT) AS DbServerId; RETURN;
    END

    IF ISNULL(@DbServerId, 0) > 0 AND NOT EXISTS (SELECT 1 FROM dbo.DbServers WHERE DbServerId = @DbServerId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Server not found' AS Message, CAST(0 AS INT) AS DbServerId; RETURN;
    END

    BEGIN TRANSACTION;

    IF @IsDefault = 1
        UPDATE dbo.DbServers WITH (UPDLOCK, HOLDLOCK) SET IsDefault = 0
        WHERE IsDefault = 1 AND DbServerId <> ISNULL(@DbServerId, 0);

    IF ISNULL(@DbServerId, 0) = 0
    BEGIN
        INSERT INTO dbo.DbServers (ServerName, AdminUser, AdminPasswordEnc, ExtraOptions, IsDefault, IsActive)
        VALUES (@ServerName, @AdminUser, @AdminPasswordEnc, NULLIF(LTRIM(RTRIM(@ExtraOptions)), ''), @IsDefault, @IsActive);

        SET @DbServerId = SCOPE_IDENTITY();
    END
    ELSE
        UPDATE dbo.DbServers
        SET ServerName       = @ServerName,
            AdminUser        = @AdminUser,
            AdminPasswordEnc = CASE WHEN ISNULL(@AdminPasswordEnc, '') = '' THEN AdminPasswordEnc ELSE @AdminPasswordEnc END,
            ExtraOptions     = NULLIF(LTRIM(RTRIM(@ExtraOptions)), ''),
            IsDefault        = @IsDefault,
            IsActive         = @IsActive
        WHERE DbServerId = @DbServerId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Server saved' AS Message, @DbServerId AS DbServerId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetSettings
AS
BEGIN
    SET NOCOUNT ON;

    SELECT s.SettingKey, s.SettingValue, s.UpdatedAt, ISNULL(u.FullName, '') AS UpdatedByName
    FROM dbo.PlatformSettings s
    LEFT JOIN dbo.Users u ON u.UserId = s.UpdatedBy
    ORDER BY s.SettingKey;
END
GO

/* The API has already checked the key and the value. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SaveSetting
    @SettingKey   NVARCHAR(100),
    @SettingValue NVARCHAR(400),
    @UpdatedBy    INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.PlatformSettings
    SET SettingValue = ISNULL(@SettingValue, ''), UpdatedAt = GETDATE(), UpdatedBy = @UpdatedBy
    WHERE SettingKey = @SettingKey;

    IF @@ROWCOUNT = 1
        SELECT CAST(1 AS INT) AS Success, 'Setting saved' AS Message;
    ELSE
        SELECT CAST(0 AS INT) AS Success, 'Unknown setting' AS Message;
END
GO

/* -----------------------------------------------------------------------------
   7. RE-CREATED from script 14 with extra columns at the end
   ----------------------------------------------------------------------------- */

/* Companies the user is an ACTIVE MEMBER of (a company whose database is not
   ready yet is listed too, with its status). + IsCreator: may retry the set-up. */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetCompanies
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.CompanyId, c.CompanyName, c.CompanyCode, c.Address, c.City, c.PhoneNumber,
        cu.RoleInCompany,
        CAST(CASE WHEN us.SelectedCompanyId = c.CompanyId THEN 1 ELSE 0 END AS BIT) AS IsLinked,
        c.ProvisionStatus,
        CAST(CASE WHEN c.CreatedBy = @UserId THEN 1 ELSE 0 END AS BIT) AS IsCreator
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Companies c     ON c.CompanyId = cu.CompanyId AND c.IsActive = 1
    LEFT  JOIN dbo.UserSessions us ON us.UserId = cu.UserId
    WHERE cu.UserId = @UserId
      AND cu.IsActive = 1
    ORDER BY c.CompanyName;
END
GO

/* + ProvisionStatus, ProvisionError, DatabaseName (the API blanks the last two
   for anyone who is not a platform administrator). */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetCompanies
    @CompanyId INT = NULL          -- NULL/0 = all (platform admin)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.CompanyId, c.CompanyName, c.CompanyCode,
        ISNULL(c.Address, '')     AS Address,
        ISNULL(c.City, '')        AS City,
        ISNULL(c.PhoneNumber, '') AS PhoneNumber,
        c.IsActive, c.CreatedAt,
        CASE WHEN c.ProvisionStatus = 'None' THEN 0 ELSE 1 END AS ProjectCount,
        (SELECT COUNT(*) FROM dbo.CompanyUsers cu WHERE cu.CompanyId = c.CompanyId AND cu.IsActive = 1) AS UserCount,
        c.ProvisionStatus,
        ISNULL(c.ProvisionError, '') AS ProvisionError,
        ISNULL(c.DatabaseName, '')   AS DatabaseName
    FROM dbo.Companies c
    WHERE ISNULL(@CompanyId, 0) = 0 OR c.CompanyId = @CompanyId
    ORDER BY c.CompanyName;
END
GO

PRINT 'Company creation and provisioning objects are in place. dbo.DbServers is empty until a server is added in Platform Admin.';
GO
SET NOEXEC OFF;
GO
