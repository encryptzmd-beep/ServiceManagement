/* =============================================================================
   MainDB · Applications: personal and commercial
   -----------------------------------------------------------------------------
   Run AFTER 20_Company_Provisioning.sql. Run it AGAIN every time script 14 or
   script 19 is run again: they re-create sp_User_GetModules,
   sp_User_ValidateScope and the sp_Platform_*Module* procedures in their
   earlier form.

   An application is a row of dbo.Modules.

   ADDS (nothing is removed):
     dbo.Modules   AppType     'Personal' | 'Commercial' (existing rows: Commercial)
                   RoutePath   where the UI opens a personal application
                   IsReleased  0 = "Coming soon": listed, cannot be opened or
                               subscribed (rows that exist before the first run: 1)
                   Family      category, free text
     rows          INVENTORY, CRM, ACCOUNTS, PAYROLL, JOBCONSULTANCY, SCHOOL
                   (commercial) and JOBPORTAL, EXPENSE (personal), all "Coming
                   soon"; only when the key is not there yet
     procedures    sp_Platform_GetModules, sp_Platform_SaveModule,
                   sp_User_GetPersonalApps
   RE-CREATES, limited to commercial applications:
     sp_User_GetModules (+ IsReleased, Family), sp_User_ValidateScope (+ IsReleased),
     sp_Platform_GetCompanyModules (+ IsReleased, Family),
     sp_Platform_SetCompanyModule (refuses an application that is not released),
     sp_Platform_GetModuleAccess, sp_Platform_SetModuleAccess

   It changes nothing in any tenant database.
   Select the SaaS main database in SSMS before running. No USE statement on
   purpose. SAFE TO RE-RUN.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
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
   AND (   OBJECT_ID('dbo.Modules') IS NULL
        OR OBJECT_ID('dbo.fn_ModuleUsers') IS NULL
        OR OBJECT_ID('dbo.sp_Platform_GetCompanyModules') IS NULL
        OR OBJECT_ID('dbo.sp_Company_GetCreationState') IS NULL)
BEGIN
    RAISERROR('Run 14_Company_Tenancy_Cutover.sql, 19_Module_Management.sql and 20_Company_Provisioning.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. Columns
   ----------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.Modules', 'AppType') IS NULL
    ALTER TABLE dbo.Modules ADD AppType NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Modules_AppType DEFAULT ('Commercial');
IF COL_LENGTH('dbo.Modules', 'RoutePath') IS NULL
    ALTER TABLE dbo.Modules ADD RoutePath NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Modules', 'Family') IS NULL
    ALTER TABLE dbo.Modules ADD Family NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Modules', 'IsReleased') IS NULL
BEGIN
    /* One transaction: a column that exists with every row at 0 would lock every
       company out of the Service application, and the next run would skip this block. */
    BEGIN TRANSACTION;

    ALTER TABLE dbo.Modules ADD IsReleased BIT NOT NULL
        CONSTRAINT DF_Modules_IsReleased DEFAULT (0);
    /* what exists before the first run is built (the Service application).
       Dynamic: the column does not exist when this batch is compiled. */
    EXEC('UPDATE dbo.Modules SET IsReleased = 1');

    COMMIT TRANSACTION;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Modules_AppType' AND parent_object_id = OBJECT_ID('dbo.Modules'))
    ALTER TABLE dbo.Modules ADD CONSTRAINT CK_Modules_AppType CHECK (AppType IN ('Personal', 'Commercial'));
GO

/* -----------------------------------------------------------------------------
   2. Seed: listed as "Coming soon"; a key that is there is left as it is
   ----------------------------------------------------------------------------- */
INSERT INTO dbo.Modules (ModuleKey, ModuleName, Description, Icon, SortOrder, AppType, IsReleased)
SELECT v.ModuleKey, v.ModuleName, v.Description, v.Icon, v.SortOrder, v.AppType, 0
FROM (VALUES
    (N'INVENTORY',      N'Inventory',       N'Stock, purchases and warehouses.',                 N'inventory_2',     2, N'Commercial'),
    (N'CRM',            N'CRM',             N'Leads, customers and follow-ups.',                 N'handshake',       3, N'Commercial'),
    (N'ACCOUNTS',       N'Accounts',        N'Ledgers, invoices and payments.',                  N'account_balance', 4, N'Commercial'),
    (N'PAYROLL',        N'Payroll',         N'Employees, salaries and hiring.',                  N'payments',        5, N'Commercial'),
    (N'JOBCONSULTANCY', N'Job Consultancy', N'Clients, openings and placements.',                N'work',            6, N'Commercial'),
    (N'SCHOOL',         N'School',          N'Students, classes, fees and results.',             N'school',          7, N'Commercial'),
    (N'JOBPORTAL',      N'Job Portal',      N'Your profile, skills and resume.',                 N'badge',           1, N'Personal'),
    (N'EXPENSE',        N'Expense Manager', N'Your own income and expenses.',                    N'savings',         2, N'Personal')
) v (ModuleKey, ModuleName, Description, Icon, SortOrder, AppType)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Modules m WHERE m.ModuleKey = v.ModuleKey);
GO

/* =============================================================================
   3. The catalogue (platform administrator)
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetModules
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.ModuleId, m.ModuleKey, m.ModuleName,
        ISNULL(m.Description, '') AS Description,
        ISNULL(m.Icon, '')        AS Icon,
        ISNULL(m.Family, '')      AS Family,
        m.AppType,
        ISNULL(m.RoutePath, '')   AS RoutePath,
        m.SortOrder, m.IsReleased, m.IsActive,
        (SELECT COUNT(*) FROM dbo.CompanyModules cm WHERE cm.ModuleId = m.ModuleId AND cm.IsEnabled = 1) AS CompanyCount
    FROM dbo.Modules m
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* ModuleId = 0 in the result means nothing was saved. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SaveModule
    @ModuleId    INT,
    @ModuleKey   NVARCHAR(50),
    @ModuleName  NVARCHAR(150),
    @Description NVARCHAR(400) = NULL,
    @Icon        NVARCHAR(100) = NULL,
    @Family      NVARCHAR(100) = NULL,
    @AppType     NVARCHAR(20),
    @RoutePath   NVARCHAR(200) = NULL,
    @SortOrder   INT = 0,
    @IsReleased  BIT = 0,
    @IsActive    BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CurrentKey NVARCHAR(50), @CurrentType NVARCHAR(20);

    SET @ModuleId    = ISNULL(@ModuleId, 0);
    SET @ModuleKey   = UPPER(LTRIM(RTRIM(ISNULL(@ModuleKey, ''))));
    SET @ModuleName  = LTRIM(RTRIM(ISNULL(@ModuleName, '')));
    SET @Description = NULLIF(LTRIM(RTRIM(ISNULL(@Description, ''))), '');
    SET @Icon        = NULLIF(LTRIM(RTRIM(ISNULL(@Icon, ''))), '');
    SET @Family      = NULLIF(LTRIM(RTRIM(ISNULL(@Family, ''))), '');
    SET @RoutePath   = NULLIF(LTRIM(RTRIM(ISNULL(@RoutePath, ''))), '');
    SET @IsReleased  = ISNULL(@IsReleased, 0);
    SET @IsActive    = ISNULL(@IsActive, 1);

    IF @ModuleKey = '' OR @ModuleName = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Key and name are required' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END
    IF ISNULL(@AppType, '') NOT IN ('Personal', 'Commercial')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose Personal or Commercial' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END
    /* every new company is subscribed to SERVICE (sp_Company_Create): it must stay subscribable */
    IF @ModuleKey = 'SERVICE' AND @AppType <> 'Commercial'
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The Service application is commercial' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END
    IF @AppType = 'Personal' AND @IsReleased = 1 AND @RoutePath IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'A personal application needs a route before it is released' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END

    BEGIN TRANSACTION;

    IF @ModuleId = 0
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.Modules WITH (UPDLOCK, HOLDLOCK) WHERE ModuleKey = @ModuleKey)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'The key is already used' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
        END

        INSERT INTO dbo.Modules (ModuleKey, ModuleName, Description, Icon, Family, AppType, RoutePath, SortOrder, IsReleased, IsActive)
        VALUES (@ModuleKey, @ModuleName, @Description, @Icon, @Family, @AppType, @RoutePath, ISNULL(@SortOrder, 0), @IsReleased, @IsActive);

        SET @ModuleId = SCOPE_IDENTITY();

        COMMIT TRANSACTION;
        SELECT CAST(1 AS INT) AS Success, 'Application added' AS Message, @ModuleId AS ModuleId; RETURN;
    END

    SELECT @CurrentKey = ModuleKey, @CurrentType = AppType
    FROM dbo.Modules WITH (UPDLOCK, HOLDLOCK)
    WHERE ModuleId = @ModuleId;

    IF @CurrentKey IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Application not found' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END
    IF @CurrentKey <> @ModuleKey
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'The key of an application cannot be changed' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END
    IF @CurrentType <> @AppType
       AND EXISTS (SELECT 1 FROM dbo.CompanyModules WHERE ModuleId = @ModuleId)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'The type cannot be changed while a company is subscribed' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END

    UPDATE dbo.Modules
    SET ModuleName = @ModuleName, Description = @Description, Icon = @Icon, Family = @Family,
        AppType = @AppType, RoutePath = @RoutePath, SortOrder = ISNULL(@SortOrder, 0),
        IsReleased = @IsReleased, IsActive = @IsActive
    WHERE ModuleId = @ModuleId;

    COMMIT TRANSACTION;
    SELECT CAST(1 AS INT) AS Success, 'Application saved' AS Message, @ModuleId AS ModuleId;
END
GO

/* Personal applications: every active user may open a released one. */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetPersonalApps
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.ModuleId, m.ModuleKey, m.ModuleName,
        ISNULL(m.Description, '') AS Description,
        ISNULL(m.Icon, '')        AS Icon,
        ISNULL(m.Family, '')      AS Family,
        ISNULL(m.RoutePath, '')   AS RoutePath,
        m.SortOrder, m.IsReleased
    FROM dbo.Modules m
    WHERE m.IsActive = 1
      AND m.AppType = 'Personal'
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* =============================================================================
   4. Re-created from script 14: commercial applications only
   ============================================================================= */

/* The commercial catalogue, with what the API needs to decide each state.
   RoleInCompany is '' when the user is not an active member. */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetModules
    @UserId    INT,
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.ModuleId, m.ModuleKey, m.ModuleName,
        ISNULL(m.Description, '') AS Description,
        ISNULL(m.Icon, '')        AS Icon,
        m.SortOrder,
        CAST(ISNULL(cm.IsEnabled, 0) AS BIT)                         AS CompanyEnabled,
        CAST(CASE WHEN uma.UserId IS NULL THEN 0 ELSE 1 END AS BIT)   AS UserGranted,
        ISNULL(cu.RoleInCompany, '')                                  AS RoleInCompany,
        m.IsReleased,
        ISNULL(m.Family, '')                                          AS Family
    FROM dbo.Modules m
    LEFT JOIN dbo.CompanyModules cm    ON cm.ModuleId = m.ModuleId AND cm.CompanyId = @CompanyId
    LEFT JOIN dbo.UserModuleAccess uma ON uma.ModuleId = m.ModuleId AND uma.CompanyId = @CompanyId AND uma.UserId = @UserId
    LEFT JOIN dbo.CompanyUsers cu      ON cu.CompanyId = @CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1
    WHERE m.IsActive = 1
      AND m.AppType = 'Commercial'
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* One row when the user is an active member of an active company and the
   commercial application exists; the API decides from the flags. */
CREATE OR ALTER PROCEDURE dbo.sp_User_ValidateScope
    @UserId    INT,
    @CompanyId INT,
    @ModuleKey NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        c.CompanyId,
        ISNULL(c.TenantKey, '') AS TenantKey,
        c.TenantScopeId,
        c.ProvisionStatus,
        cu.RoleInCompany,
        m.ModuleName,
        CAST(ISNULL(cm.IsEnabled, 0) AS BIT)                       AS CompanyEnabled,
        CAST(CASE WHEN uma.UserId IS NULL THEN 0 ELSE 1 END AS BIT) AS UserGranted,
        m.IsReleased
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Companies c         ON c.CompanyId = cu.CompanyId AND c.IsActive = 1
    INNER JOIN dbo.Modules m           ON m.ModuleKey = @ModuleKey AND m.IsActive = 1 AND m.AppType = 'Commercial'
    LEFT  JOIN dbo.CompanyModules cm   ON cm.CompanyId = c.CompanyId AND cm.ModuleId = m.ModuleId
    LEFT  JOIN dbo.UserModuleAccess uma ON uma.CompanyId = c.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1;
END
GO

/* =============================================================================
   5. Re-created from script 19: commercial applications only
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetCompanyModules
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.ModuleId, m.ModuleKey, m.ModuleName,
        ISNULL(m.Description, '') AS Description,
        ISNULL(m.Icon, '')        AS Icon,
        m.SortOrder,
        CAST(ISNULL(cm.IsEnabled, 0) AS BIT) AS IsEnabled,
        (SELECT COUNT(*) FROM dbo.fn_ModuleUsers(@CompanyId, m.ModuleKey)) AS UserCount,
        m.IsReleased,
        ISNULL(m.Family, '')      AS Family
    FROM dbo.Modules m
    LEFT JOIN dbo.CompanyModules cm ON cm.ModuleId = m.ModuleId AND cm.CompanyId = @CompanyId
    WHERE m.IsActive = 1
      AND m.AppType = 'Commercial'
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* Switching off keeps every member's grant. An application that is not released
   can be switched off, never on. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SetCompanyModule
    @CompanyId INT,
    @ModuleKey NVARCHAR(50),
    @IsEnabled BIT,
    @SavedBy   INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ModuleId INT, @ModuleName NVARCHAR(150), @IsReleased BIT;

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message; RETURN;
    END

    SELECT @ModuleId = ModuleId, @ModuleName = ModuleName, @IsReleased = IsReleased
    FROM dbo.Modules
    WHERE ModuleKey = @ModuleKey AND IsActive = 1 AND AppType = 'Commercial';

    IF @ModuleId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Module not found' AS Message; RETURN;
    END

    SET @IsEnabled = ISNULL(@IsEnabled, 0);

    IF @IsEnabled = 1 AND @IsReleased = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This application is not available yet' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM dbo.CompanyModules WITH (UPDLOCK, HOLDLOCK)
               WHERE CompanyId = @CompanyId AND ModuleId = @ModuleId)
        UPDATE dbo.CompanyModules
        SET IsEnabled = @IsEnabled, UpdatedAt = GETDATE()
        WHERE CompanyId = @CompanyId AND ModuleId = @ModuleId;
    ELSE
        INSERT INTO dbo.CompanyModules (CompanyId, ModuleId, IsEnabled)
        VALUES (@CompanyId, @ModuleId, @IsEnabled);

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success,
           @ModuleName + CASE WHEN @IsEnabled = 1 THEN ' switched on' ELSE ' switched off' END AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetModuleAccess
    @CompanyId INT,
    @ModuleKey NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId, u.FullName, u.Email, ISNULL(u.MobileNumber, '') AS MobileNumber,
        cu.RoleInCompany,
        CAST(CASE WHEN LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin') OR uma.UserId IS NOT NULL
                  THEN 1 ELSE 0 END AS BIT) AS HasAccess,
        uma.GrantedAt,
        ISNULL(gb.FullName, '') AS GrantedByName
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u   ON u.UserId = cu.UserId AND u.IsActive = 1
    INNER JOIN dbo.Modules m ON m.ModuleKey = @ModuleKey AND m.IsActive = 1 AND m.AppType = 'Commercial'
    LEFT  JOIN dbo.UserModuleAccess uma
           ON uma.CompanyId = cu.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId
    LEFT  JOIN dbo.Users gb  ON gb.UserId = uma.GrantedBy
    WHERE cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
    ORDER BY u.FullName;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Platform_SetModuleAccess
    @CompanyId INT,
    @ModuleKey NVARCHAR(50),
    @UserId    INT,
    @HasAccess BIT,
    @GrantedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Role NVARCHAR(100), @ModuleId INT;

    SELECT @ModuleId = ModuleId FROM dbo.Modules
    WHERE ModuleKey = @ModuleKey AND IsActive = 1 AND AppType = 'Commercial';

    IF @ModuleId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Module not found' AS Message; RETURN;
    END

    SELECT @Role = RoleInCompany
    FROM dbo.CompanyUsers
    WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1;

    IF @Role IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The user is not an active member of the company' AS Message; RETURN;
    END

    SET @HasAccess = ISNULL(@HasAccess, 0);

    IF @HasAccess = 0 AND @UserId = @GrantedBy
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You cannot remove your own access' AS Message; RETURN;
    END

    IF @HasAccess = 0 AND LTRIM(RTRIM(@Role)) IN ('Admin', 'CompanyAdmin')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company administrators always have access. Change the role instead.' AS Message; RETURN;
    END

    IF @HasAccess = 1
        -- one statement: the check and the insert cannot be separated by another caller
        INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
        SELECT @CompanyId, @UserId, @ModuleId, @GrantedBy
        WHERE NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess WITH (UPDLOCK, HOLDLOCK)
                          WHERE CompanyId = @CompanyId AND UserId = @UserId AND ModuleId = @ModuleId);
    ELSE
        DELETE FROM dbo.UserModuleAccess
        WHERE CompanyId = @CompanyId AND UserId = @UserId AND ModuleId = @ModuleId;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @HasAccess = 1 THEN 'Access granted' ELSE 'Access removed' END AS Message;
END
GO

PRINT 'Applications are in place. Run this script again after script 14 or script 19.';
GO
SET NOEXEC OFF;
GO
