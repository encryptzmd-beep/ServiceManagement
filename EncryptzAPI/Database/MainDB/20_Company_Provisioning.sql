/* =============================================================================
   MainDB · Company creation and database provisioning
   -----------------------------------------------------------------------------
   Run AFTER 14_Company_Tenancy_Cutover.sql and 19_Module_Management.sql, with
   the new API. Run it AGAIN every time script 14 is run again: script 14
   re-creates dbo.sp_User_GetCompanies and dbo.sp_Platform_GetCompanies in their
   earlier form. It refuses to run while dbo.Projects exists (before script 14,
   or after a rollback with script 15).

   ADDS (nothing is removed, no existing row is changed):
     dbo.DbServers            SQL servers on which the API creates company databases
     dbo.PlatformSettings     MaxCompaniesPerUser (1), TenantLookupSourceDb ('')
     dbo.Companies            DbServerId, ProvisionError, ProvisionStartedAt,
                              CreatedBy, FirstBranchName,
                              ProvisionAttempt (NULL = queued, nobody is building;
                              a value = the attempt that is building, or was the
                              last to build)
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
ELSE IF OBJECT_ID('dbo.Companies') IS NOT NULL
   AND (   OBJECT_ID('dbo.Projects') IS NOT NULL
        OR OBJECT_ID('dbo.sp_Tenant_GetConnection') IS NULL
        OR OBJECT_ID('dbo.fn_ModuleUsers') IS NULL)
BEGIN
    /* the project tables are in use: the API that runs then does not know these objects,
       and sp_User_GetCompanies / sp_Platform_GetCompanies must stay as that API expects them */
    RAISERROR('Run 13_Company_Tenancy_Schema.sql and 14_Company_Tenancy_Cutover.sql first (this script must not run while dbo.Projects exists: before the cut-over or after a rollback).', 16, 1);
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
IF COL_LENGTH('dbo.Companies', 'ProvisionAttempt') IS NULL
    ALTER TABLE dbo.Companies ADD ProvisionAttempt UNIQUEIDENTIFIER NULL;  -- NULL = queued; a value = the attempt that is (or was last) building
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Companies_CreatedBy' AND object_id = OBJECT_ID('dbo.Companies'))
    CREATE INDEX IX_Companies_CreatedBy ON dbo.Companies(CreatedBy) WHERE CreatedBy IS NOT NULL;
GO

/* -----------------------------------------------------------------------------
   4. Creating a company
   ----------------------------------------------------------------------------- */

/* In this script a company "waiting for its first database" (PENDING) is always:
       DbServerId IS NOT NULL
       AND NULLIF(LTRIM(RTRIM(ISNULL(DatabaseName, ''))), '') IS NULL
   It was created here and never got a database. A company whose database was
   attached by hand has a database name (and no DbServerId) and is never pending,
   whatever its status. */

/* How many companies the user has created, the limit, whether a server is there
   and whether an earlier company of the user is waiting for a retry.
   A company whose set-up failed does not count, unless it has a database (one
   attached by hand and switched off). */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GetCreationState
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        (SELECT COUNT(*) FROM dbo.Companies c
         WHERE c.CreatedBy = @UserId
           AND (c.ProvisionStatus <> 'Failed'
                OR NULLIF(LTRIM(RTRIM(ISNULL(c.DatabaseName, ''))), '') IS NOT NULL))               AS Created,
        ISNULL((SELECT TRY_CAST(s.SettingValue AS INT) FROM dbo.PlatformSettings s
                WHERE s.SettingKey = 'MaxCompaniesPerUser'), 1)                                     AS Limit,
        CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.DbServers WHERE IsDefault = 1 AND IsActive = 1)
                  THEN 1 ELSE 0 END AS BIT)                                                         AS ServerAvailable,
        CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.Companies c
                               WHERE c.CreatedBy = @UserId AND c.IsActive = 1
                                 AND c.ProvisionStatus = 'Failed'
                                 AND c.DbServerId IS NOT NULL
                                 AND NULLIF(LTRIM(RTRIM(ISNULL(c.DatabaseName, ''))), '') IS NULL)
                  THEN 1 ELSE 0 END AS BIT)                                                         AS PendingRetry;
END
GO

/* The company, its creator as Admin and the Service module, in one transaction.
   The database is created afterwards by the API (status Provisioning, no
   ProvisionAttempt yet: the job is queued).
   Two requests of the same user wait for each other, so the limit holds. A user
   whose earlier company is waiting for a retry cannot create another one: failed
   companies do not count, so they could otherwise be used to pass the limit.
   ErrorNumber / ErrorDetail are for the API's log only, never for the caller. */
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
        SELECT CAST(0 AS INT) AS Success, 'User not found' AS Message, CAST(0 AS INT) AS CompanyId,
               CAST(0 AS INT) AS ErrorNumber, CAST('' AS NVARCHAR(4000)) AS ErrorDetail;
        RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        /* a negative result means the lock was NOT taken (time-out, deadlock): never go on without it */
        EXEC @LockResult = sp_getapplock @Resource = @Lock, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
        IF @LockResult < 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'The company could not be created. Please try again.' AS Message, CAST(0 AS INT) AS CompanyId,
                   CAST(0 AS INT) AS ErrorNumber, CAST('' AS NVARCHAR(4000)) AS ErrorDetail;
            RETURN;
        END

        SELECT @ServerId = DbServerId FROM dbo.DbServers WHERE IsDefault = 1 AND IsActive = 1;
        SELECT @ModuleId = ModuleId FROM dbo.Modules WHERE ModuleKey = 'SERVICE' AND IsActive = 1;

        SET @Limit = ISNULL((SELECT TRY_CAST(SettingValue AS INT) FROM dbo.PlatformSettings
                             WHERE SettingKey = 'MaxCompaniesPerUser'), 1);
        /* same count as sp_Company_GetCreationState */
        SET @Created = (SELECT COUNT(*) FROM dbo.Companies
                        WHERE CreatedBy = @CreatedBy
                          AND (ProvisionStatus <> 'Failed'
                               OR NULLIF(LTRIM(RTRIM(ISNULL(DatabaseName, ''))), '') IS NOT NULL));

        IF @ServerId IS NULL OR @ModuleId IS NULL OR (ISNULL(@IsPlatformAdmin, 0) = 0 AND @Limit <= 0)
            SET @Message = 'Company creation is not available right now';
        ELSE IF ISNULL(@IsPlatformAdmin, 0) = 0 AND @Created >= @Limit
            SET @Message = 'You have reached the number of companies you can create';
        ELSE IF ISNULL(@IsPlatformAdmin, 0) = 0
                AND EXISTS (SELECT 1 FROM dbo.Companies
                            WHERE CreatedBy = @CreatedBy AND IsActive = 1
                              AND ProvisionStatus = 'Failed'
                              AND DbServerId IS NOT NULL
                              AND NULLIF(LTRIM(RTRIM(ISNULL(DatabaseName, ''))), '') IS NULL)
            SET @Message = 'Your earlier company is waiting for a retry';
        ELSE IF EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyCode = @CompanyCode)
            SET @Message = 'This company code is already in use';

        IF @Message IS NOT NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, @Message AS Message, CAST(0 AS INT) AS CompanyId,
                   CAST(0 AS INT) AS ErrorNumber, CAST('' AS NVARCHAR(4000)) AS ErrorDetail;
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

        SELECT CAST(1 AS INT) AS Success, 'Company created. Its database is being set up.' AS Message, @CompanyId AS CompanyId,
               CAST(0 AS INT) AS ErrorNumber, CAST('' AS NVARCHAR(4000)) AS ErrorDetail;
    END TRY
    BEGIN CATCH
        /* read first: a ROLLBACK does not clear them, but nothing may come in between */
        DECLARE @ErrorNumber INT = ERROR_NUMBER(), @ErrorDetail NVARCHAR(4000) = ERROR_MESSAGE();

        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        /* 2627 / 2601 on the company code: it was taken by another request in the same
           moment. Any other unique key (the tenant key, a membership) is not the user's
           doing and gets the general message. */
        SELECT CAST(0 AS INT) AS Success,
               CASE WHEN @ErrorNumber IN (2627, 2601) AND @ErrorDetail LIKE '%UQ_Companies_Code%'
                    THEN 'This company code is already in use'
                    ELSE 'The company could not be created. Please try again.' END AS Message,
               CAST(0 AS INT) AS CompanyId,
               ISNULL(@ErrorNumber, 0) AS ErrorNumber, ISNULL(@ErrorDetail, '') AS ErrorDetail;
    END CATCH
END
GO

/* -----------------------------------------------------------------------------
   5. The provisioning job (called by the API's background worker)
   ----------------------------------------------------------------------------- */

/* A job is QUEUED while the company is Provisioning and ProvisionAttempt is
   NULL. sp_Provision_Begin claims it: it writes a new ProvisionAttempt and starts
   the clock (ProvisionStartedAt). Completing and failing name that attempt, so a
   late answer of an earlier attempt changes nothing. */

/* API-internal (background worker) only: claims the job and returns the encrypted server password. Never expose through an endpoint. */
CREATE OR ALTER PROCEDURE dbo.sp_Provision_Begin
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Attempt UNIQUEIDENTIFIER = NEWID(), @Claimed BIT = 0;

    /* The single UPDATE is the claim: of two runs for one company only one gets a
       row. Only a company that is waiting for its first database (see section 4). */
    UPDATE dbo.Companies
    SET ProvisionAttempt = @Attempt, ProvisionStartedAt = GETDATE()
    WHERE CompanyId = @CompanyId
      AND ProvisionStatus = 'Provisioning'
      AND ProvisionAttempt IS NULL
      AND DbServerId IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(ISNULL(DatabaseName, ''))), '') IS NULL;

    IF @@ROWCOUNT = 1 SET @Claimed = 1;

    /* one row when claimed, no row otherwise (same columns) */
    SELECT
        c.CompanyId, c.TenantScopeId,
        ISNULL(NULLIF(LTRIM(RTRIM(c.FirstBranchName)), ''), 'Head Office') AS FirstBranchName,
        c.ProvisionAttempt,
        ISNULL(s.ServerName, '')       AS ServerName,
        ISNULL(s.AdminUser, '')        AS AdminUser,
        ISNULL(s.AdminPasswordEnc, '') AS AdminPasswordEnc,
        ISNULL(s.ExtraOptions, '')     AS ExtraOptions,
        ISNULL((SELECT p.SettingValue FROM dbo.PlatformSettings p
                WHERE p.SettingKey = 'TenantLookupSourceDb'), '') AS LookupSourceDb
    FROM dbo.Companies c
    LEFT JOIN dbo.DbServers s ON s.DbServerId = c.DbServerId AND s.IsActive = 1
    WHERE @Claimed = 1
      AND c.CompanyId = @CompanyId
      AND c.ProvisionAttempt = @Attempt;
END
GO

/* The database is built: the company gets its connection (taken from its
   server row) and becomes Ready. Only for the attempt that owns the job, and
   only while the company is still Provisioning and still without a database:
   a job that was given up, retried or overtaken (a database attached by hand)
   must not become Ready through an old attempt. @ServerName / @AdminUser are
   what the attempt connected with: if the server row was edited meanwhile, the
   database was built somewhere else than the row now says, and nothing is saved. */
CREATE OR ALTER PROCEDURE dbo.sp_Provision_Complete
    @CompanyId    INT,
    @Attempt      UNIQUEIDENTIFIER,
    @DatabaseName NVARCHAR(200),
    @ServerName   NVARCHAR(200),
    @AdminUser    NVARCHAR(100)
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
      AND c.ProvisionStatus = 'Provisioning'
      AND c.ProvisionAttempt = @Attempt
      AND c.DbServerId IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(ISNULL(c.DatabaseName, ''))), '') IS NULL
      AND NULLIF(LTRIM(RTRIM(ISNULL(@DatabaseName, ''))), '') IS NOT NULL
      AND s.ServerName = @ServerName
      AND s.AdminUser  = @AdminUser;

    SELECT CAST(CASE WHEN @@ROWCOUNT = 1 THEN 1 ELSE 0 END AS INT) AS Success,
           ISNULL((SELECT TenantKey FROM dbo.Companies WHERE CompanyId = @CompanyId), '') AS TenantKey;
END
GO

/* Only the attempt that owns the job can fail it. */
CREATE OR ALTER PROCEDURE dbo.sp_Provision_Fail
    @CompanyId INT,
    @Attempt   UNIQUEIDENTIFIER,
    @Error     NVARCHAR(2000)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Companies
    SET ProvisionStatus = 'Failed',
        ProvisionError  = LEFT(ISNULL(@Error, ''), 2000)
    WHERE CompanyId = @CompanyId
      AND ProvisionStatus = 'Provisioning'
      AND ProvisionAttempt = @Attempt;
END
GO

/* For the worker, when the answer of sp_Provision_Complete was lost. No row when
   the company does not exist. */
CREATE OR ALTER PROCEDURE dbo.sp_Provision_GetStatus
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT ProvisionStatus, ProvisionAttempt
    FROM dbo.Companies
    WHERE CompanyId = @CompanyId;
END
GO

/* Jobs nobody has claimed, oldest first: after a restart the API has forgotten
   the ones it held in memory and picks them up from here. */
CREATE OR ALTER PROCEDURE dbo.sp_Provision_GetQueued
AS
BEGIN
    SET NOCOUNT ON;

    SELECT CompanyId
    FROM dbo.Companies
    WHERE ProvisionStatus = 'Provisioning'
      AND ProvisionAttempt IS NULL
    ORDER BY ProvisionStartedAt, CompanyId;
END
GO

/* Try again: only a Failed company that never got a database (see section 4),
   by a platform administrator, or by its creator while still an active member.
   A company whose database was attached by hand and then switched off is Failed
   too, but it HAS a database: it is never rebuilt here.
   The single UPDATE is the gate, so two retries cannot both start a job. It
   queues the job again (ProvisionAttempt NULL) on the current default server. */
CREATE OR ALTER PROCEDURE dbo.sp_Provision_Retry
    @CompanyId       INT,
    @UserId          INT,
    @IsPlatformAdmin BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ServerId INT = (SELECT DbServerId FROM dbo.DbServers WHERE IsDefault = 1 AND IsActive = 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies c
                   WHERE c.CompanyId = @CompanyId AND c.IsActive = 1
                     AND (   ISNULL(@IsPlatformAdmin, 0) = 1
                          OR (    c.CreatedBy = @UserId
                              AND EXISTS (SELECT 1 FROM dbo.CompanyUsers cu
                                          WHERE cu.CompanyId = c.CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1))))
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message; RETURN;
    END

    IF @ServerId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company creation is not available right now' AS Message; RETURN;
    END

    UPDATE dbo.Companies
    SET ProvisionStatus    = 'Provisioning',
        ProvisionStartedAt = GETDATE(),
        ProvisionAttempt   = NULL,
        ProvisionError     = NULL,
        DbServerId         = @ServerId
    WHERE CompanyId = @CompanyId
      AND ProvisionStatus = 'Failed'
      AND DbServerId IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(ISNULL(DatabaseName, ''))), '') IS NULL;

    IF @@ROWCOUNT = 1
        SELECT CAST(1 AS INT) AS Success, 'The database is being set up.' AS Message;
    ELSE
        SELECT CAST(0 AS INT) AS Success, 'This company is not waiting for a retry' AS Message;
END
GO

/* Gives up jobs that will not finish, so they can be retried:
     - a CLAIMED job (ProvisionAttempt set) whose attempt started more than
       @OlderThanMinutes ago: the run was interrupted (API restart, crash) or hangs.
       The clock starts when the job is claimed, not when the company was created,
       so a job that waited in the queue is not given up while it is being built;
     - a QUEUED job (ProvisionAttempt NULL) that nobody claimed for 8 times as long
       (2 hours with the default).
   ProvisionAttempt is left as it is: an attempt that is still running finds the
   company no longer Provisioning, cannot complete, and removes its own database. */
CREATE OR ALTER PROCEDURE dbo.sp_Provision_FailStuck
    @OlderThanMinutes INT = 15
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Minutes INT = ABS(ISNULL(@OlderThanMinutes, 15));
    IF @Minutes > 100000 SET @Minutes = 100000;   -- keeps 8 times the value inside DATEADD's range

    UPDATE dbo.Companies
    SET ProvisionStatus = 'Failed',
        ProvisionError  = 'The set-up did not finish (interrupted or timed out).'
    WHERE ProvisionStatus = 'Provisioning'
      AND (   (ProvisionAttempt IS NOT NULL
               AND ISNULL(ProvisionStartedAt, '19000101') < DATEADD(MINUTE, -@Minutes, GETDATE()))
           OR (ProvisionAttempt IS NULL
               AND ISNULL(ProvisionStartedAt, '19000101') < DATEADD(MINUTE, -8 * @Minutes, GETDATE())));

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

    BEGIN TRY
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
    END TRY
    BEGIN CATCH
        /* e.g. two administrators making two servers the default in the same moment */
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        SELECT CAST(0 AS INT) AS Success, 'The server could not be saved. Please try again.' AS Message, CAST(0 AS INT) AS DbServerId;
    END CATCH
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
