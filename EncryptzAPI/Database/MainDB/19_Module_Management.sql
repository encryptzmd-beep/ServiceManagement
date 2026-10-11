/* =============================================================================
   MainDB · Module management
   -----------------------------------------------------------------------------
   Run AFTER 14_Company_Tenancy_Cutover.sql, with the new API. Run it AGAIN
   every time script 14 is run again: script 14 re-creates
   dbo.sp_Company_GetUsersForSync in its earlier form.

     sp_Platform_GetCompanyModules   the catalogue with what a company has
     sp_Platform_SetCompanyModule    switch a module on / off for a company
     sp_Platform_GetModuleAccess     the company's members and who may open a module
     sp_Platform_SetModuleAccess     give / take a member's access to a module
     sp_Company_GetUsersForSync      re-created: a company whose Service module is
                                     switched off is NOT synchronised, so switching
                                     the module off never deactivates anybody in
                                     the company's own database

   Nothing here changes a table or any data. It changes nothing in any tenant
   database.

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
        OR OBJECT_ID('dbo.CompanyModules') IS NULL
        OR OBJECT_ID('dbo.UserModuleAccess') IS NULL
        OR OBJECT_ID('dbo.fn_ModuleUsers') IS NULL)
BEGIN
    RAISERROR('Run 13_Company_Tenancy_Schema.sql and 14_Company_Tenancy_Cutover.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   The catalogue, with what the company has and how many members can open each
   ----------------------------------------------------------------------------- */
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
        (SELECT COUNT(*) FROM dbo.fn_ModuleUsers(@CompanyId, m.ModuleKey)) AS UserCount
    FROM dbo.Modules m
    LEFT JOIN dbo.CompanyModules cm ON cm.ModuleId = m.ModuleId AND cm.CompanyId = @CompanyId
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* -----------------------------------------------------------------------------
   Switch a module on / off for a company (its subscription).
   Switching off keeps every member's grant: switching on again restores who
   could open it.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SetCompanyModule
    @CompanyId INT,
    @ModuleKey NVARCHAR(50),
    @IsEnabled BIT,
    @SavedBy   INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ModuleId INT, @ModuleName NVARCHAR(150);

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message; RETURN;
    END

    SELECT @ModuleId = ModuleId, @ModuleName = ModuleName
    FROM dbo.Modules
    WHERE ModuleKey = @ModuleKey AND IsActive = 1;

    IF @ModuleId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Module not found' AS Message; RETURN;
    END

    SET @IsEnabled = ISNULL(@IsEnabled, 0);

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

/* -----------------------------------------------------------------------------
   The company's active members, with whether they may open the module.
   Company administrators always may (no grant row needed).
   ----------------------------------------------------------------------------- */
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
    LEFT  JOIN dbo.Modules m ON m.ModuleKey = @ModuleKey AND m.IsActive = 1
    LEFT  JOIN dbo.UserModuleAccess uma
           ON uma.CompanyId = cu.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId
    LEFT  JOIN dbo.Users gb  ON gb.UserId = uma.GrantedBy
    WHERE cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
    ORDER BY u.FullName;
END
GO

/* -----------------------------------------------------------------------------
   Give / take a member's access to a module of the company
   ----------------------------------------------------------------------------- */
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

    SELECT @ModuleId = ModuleId FROM dbo.Modules WHERE ModuleKey = @ModuleKey AND IsActive = 1;

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
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess
                       WHERE CompanyId = @CompanyId AND UserId = @UserId AND ModuleId = @ModuleId)
            INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
            VALUES (@CompanyId, @UserId, @ModuleId, @GrantedBy);
    END
    ELSE
        DELETE FROM dbo.UserModuleAccess
        WHERE CompanyId = @CompanyId AND UserId = @UserId AND ModuleId = @ModuleId;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @HasAccess = 1 THEN 'Access granted' ELSE 'Access removed' END AS Message;
END
GO

/* -----------------------------------------------------------------------------
   The company's routing info and the users the tenant DB must mirror.
   RE-CREATED from script 14 with one change: the first result set is empty
   when the company does not have the Service module switched on. The API then
   skips the synchronisation, so nobody in the tenant database is deactivated
   because the module was switched off. (With the module on, the second result
   set is every active user who may open it, as before.)
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GetUsersForSync
    @CompanyId INT,
    @UserId    INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.CompanyId, c.TenantKey, c.TenantScopeId
    FROM dbo.Companies c
    WHERE c.CompanyId = @CompanyId
      AND c.IsActive = 1
      AND c.ProvisionStatus = 'Ready'
      AND EXISTS (SELECT 1
                  FROM dbo.CompanyModules cm
                  INNER JOIN dbo.Modules m ON m.ModuleId = cm.ModuleId
                  WHERE cm.CompanyId = c.CompanyId
                    AND cm.IsEnabled = 1
                    AND m.ModuleKey = 'SERVICE'
                    AND m.IsActive = 1);

    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber, mu.RoleInCompany
    FROM dbo.fn_ModuleUsers(@CompanyId, 'SERVICE') mu
    INNER JOIN dbo.Users u ON u.UserId = mu.UserId AND u.IsActive = 1
    WHERE @UserId IS NULL OR u.UserId = @UserId
    ORDER BY u.UserId;
END
GO

PRINT 'Module management procedures are in place.';
GO
SET NOEXEC OFF;
GO
