/* =============================================================================
   MainDB · 33 · Users & Roles of a company (outside the modules)
   -----------------------------------------------------------------------------
   Back up the main database before running it on a new environment.

   Run in the SaaS main database AFTER 14, 19, 21 and 23. Run it AGAIN every time
   script 14 or 19 is run again: they re-create two procedures changed here.
   SAFE TO RE-RUN.

   ADDS (no existing row is changed by running this script)
     dbo.CompanyRoles            the roles a company made for itself
     dbo.CompanyRoleModules      the modules of a role
     dbo.CompanyRoleMenuAccess   view / create / edit / delete per menu of a role
     dbo.CompanyUserRoles        which member has which roles (several allowed)
     dbo.CompanyAccessManagers   who may manage users and roles besides the admin
     sp_CompanyAccess_*          the procedures of the Users & Roles screen

   CHANGES TWO EXISTING PROCEDURES
     sp_User_GetMenusForCompany  a member WITH company roles gets the combined menus
                                 of those roles. Everybody else: exactly as before.
     sp_Company_GetUsersForSync  also mirrors members who have CRM without Service,
                                 so a CRM-only role can enter a branch.

   HOW IT FITS THE REST OF THE APPLICATION
     dbo.Roles stays global and untouched. The API checks built-in role names, so
     each company role says which built-in level it "works as". A member's
     CompanyUsers.RoleInCompany becomes the strongest level of their roles
     (Manager > ServiceManager > Storekeeper > Technician). A company role can
     never work as Admin or CompanyAdmin.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Companies') IS NULL OR OBJECT_ID('dbo.CompanyUsers') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Companies') IS NOT NULL
   AND (   OBJECT_ID('dbo.Modules') IS NULL
        OR OBJECT_ID('dbo.CompanyModules') IS NULL
        OR OBJECT_ID('dbo.UserModuleAccess') IS NULL
        OR COL_LENGTH('dbo.Modules', 'AppType') IS NULL
        OR COL_LENGTH('dbo.Modules', 'IsReleased') IS NULL
        OR COL_LENGTH('dbo.MenuItems', 'AppModuleId') IS NULL
        OR COL_LENGTH('dbo.Companies', 'CreatedBy') IS NULL)
BEGIN
    RAISERROR('Run scripts 13, 14, 19, 20 and 21 first. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. Tables
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.CompanyRoles') IS NULL
CREATE TABLE dbo.CompanyRoles
(
    CompanyRoleId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CompanyRoles PRIMARY KEY,
    CompanyId     INT NOT NULL CONSTRAINT FK_CompanyRoles_Company REFERENCES dbo.Companies(CompanyId),
    RoleName      NVARCHAR(100) NOT NULL,
    Description   NVARCHAR(300) NULL,
    AccessLevel   NVARCHAR(100) NOT NULL
        CONSTRAINT CK_CompanyRoles_Level CHECK (AccessLevel IN ('Manager', 'ServiceManager', 'Storekeeper', 'Technician')),
    IsActive      BIT NOT NULL CONSTRAINT DF_CompanyRoles_IsActive DEFAULT (1),
    CreatedBy     INT NULL CONSTRAINT FK_CompanyRoles_CreatedBy REFERENCES dbo.Users(UserId),
    CreatedAt     DATETIME NOT NULL CONSTRAINT DF_CompanyRoles_CreatedAt DEFAULT (GETDATE()),
    UpdatedAt     DATETIME NULL,
    CONSTRAINT UQ_CompanyRoles_Name UNIQUE (CompanyId, RoleName)
);
GO

IF OBJECT_ID('dbo.CompanyRoleModules') IS NULL
CREATE TABLE dbo.CompanyRoleModules
(
    CompanyRoleId INT NOT NULL CONSTRAINT FK_CRMod_Role REFERENCES dbo.CompanyRoles(CompanyRoleId),
    ModuleId      INT NOT NULL CONSTRAINT FK_CRMod_Module REFERENCES dbo.Modules(ModuleId),
    CONSTRAINT PK_CompanyRoleModules PRIMARY KEY (CompanyRoleId, ModuleId)
);
GO

IF OBJECT_ID('dbo.CompanyRoleMenuAccess') IS NULL
CREATE TABLE dbo.CompanyRoleMenuAccess
(
    CompanyRoleId INT NOT NULL CONSTRAINT FK_CRMA_Role REFERENCES dbo.CompanyRoles(CompanyRoleId),
    MenuId        INT NOT NULL CONSTRAINT FK_CRMA_Menu REFERENCES dbo.MenuItems(MenuId),
    CanView       BIT NOT NULL CONSTRAINT DF_CRMA_View   DEFAULT (0),
    CanCreate     BIT NOT NULL CONSTRAINT DF_CRMA_Create DEFAULT (0),
    CanEdit       BIT NOT NULL CONSTRAINT DF_CRMA_Edit   DEFAULT (0),
    CanDelete     BIT NOT NULL CONSTRAINT DF_CRMA_Delete DEFAULT (0),
    CONSTRAINT PK_CompanyRoleMenuAccess PRIMARY KEY (CompanyRoleId, MenuId)
);
GO

IF OBJECT_ID('dbo.CompanyUserRoles') IS NULL
CREATE TABLE dbo.CompanyUserRoles
(
    CompanyId     INT NOT NULL CONSTRAINT FK_CUR_Company REFERENCES dbo.Companies(CompanyId),
    UserId        INT NOT NULL CONSTRAINT FK_CUR_User REFERENCES dbo.Users(UserId),
    CompanyRoleId INT NOT NULL CONSTRAINT FK_CUR_Role REFERENCES dbo.CompanyRoles(CompanyRoleId),
    AssignedBy    INT NULL CONSTRAINT FK_CUR_AssignedBy REFERENCES dbo.Users(UserId),
    AssignedAt    DATETIME NOT NULL CONSTRAINT DF_CUR_AssignedAt DEFAULT (GETDATE()),
    CONSTRAINT PK_CompanyUserRoles PRIMARY KEY (CompanyId, UserId, CompanyRoleId)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CUR_Role' AND object_id = OBJECT_ID('dbo.CompanyUserRoles'))
    CREATE INDEX IX_CUR_Role ON dbo.CompanyUserRoles(CompanyRoleId);
GO

IF OBJECT_ID('dbo.CompanyAccessManagers') IS NULL
CREATE TABLE dbo.CompanyAccessManagers
(
    CompanyId INT NOT NULL CONSTRAINT FK_CAM_Company REFERENCES dbo.Companies(CompanyId),
    UserId    INT NOT NULL CONSTRAINT FK_CAM_User REFERENCES dbo.Users(UserId),
    GrantedBy INT NULL CONSTRAINT FK_CAM_GrantedBy REFERENCES dbo.Users(UserId),
    GrantedAt DATETIME NOT NULL CONSTRAINT DF_CAM_GrantedAt DEFAULT (GETDATE()),
    CONSTRAINT PK_CompanyAccessManagers PRIMARY KEY (CompanyId, UserId)
);
GO

/* -----------------------------------------------------------------------------
   2. Who is asking
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_CompanyAccess_GetActor
    @CompanyId INT,
    @UserId    INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        cu.RoleInCompany,
        CAST(CASE WHEN LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin') THEN 1 ELSE 0 END AS BIT) AS IsTenantAdmin,
        CAST(CASE WHEN cam.UserId IS NULL THEN 0 ELSE 1 END AS BIT) AS IsManager
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u     ON u.UserId = cu.UserId AND u.IsActive = 1
    INNER JOIN dbo.Companies c ON c.CompanyId = cu.CompanyId AND c.IsActive = 1
    LEFT  JOIN dbo.CompanyAccessManagers cam ON cam.CompanyId = cu.CompanyId AND cam.UserId = cu.UserId
    WHERE cu.CompanyId = @CompanyId
      AND cu.UserId = @UserId
      AND cu.IsActive = 1;
END
GO

/* -----------------------------------------------------------------------------
   3. Everything the screen shows (eight result sets, always in this order)
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_CompanyAccess_GetOverview
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- 0: the modules the company has
    SELECT m.ModuleId, m.ModuleKey, m.ModuleName, ISNULL(m.Icon, '') AS Icon, m.SortOrder
    FROM dbo.Modules m
    INNER JOIN dbo.CompanyModules cm ON cm.ModuleId = m.ModuleId AND cm.CompanyId = @CompanyId AND cm.IsEnabled = 1
    WHERE m.IsActive = 1 AND m.IsReleased = 1 AND m.AppType = 'Commercial'
    ORDER BY m.SortOrder, m.ModuleName;

    -- 1: the pages of those modules
    SELECT mi.MenuId, mi.MenuName, ISNULL(p.MenuName, '') AS GroupName, m.ModuleKey, mi.SortOrder
    FROM dbo.MenuItems mi
    INNER JOIN dbo.Modules m ON m.ModuleId = mi.AppModuleId AND m.IsActive = 1 AND m.IsReleased = 1 AND m.AppType = 'Commercial'
    INNER JOIN dbo.CompanyModules cm ON cm.ModuleId = m.ModuleId AND cm.CompanyId = @CompanyId AND cm.IsEnabled = 1
    LEFT  JOIN dbo.MenuItems p ON p.MenuId = mi.ParentMenuId
    WHERE mi.IsActive = 1 AND NULLIF(LTRIM(RTRIM(mi.MenuPath)), '') IS NOT NULL
    ORDER BY ISNULL(p.SortOrder, mi.SortOrder), mi.SortOrder, mi.MenuId;

    -- 2: the company's roles
    SELECT r.CompanyRoleId, r.RoleName, ISNULL(r.Description, '') AS Description, r.AccessLevel,
           (SELECT COUNT(*) FROM dbo.CompanyUserRoles x WHERE x.CompanyRoleId = r.CompanyRoleId) AS UserCount
    FROM dbo.CompanyRoles r
    WHERE r.CompanyId = @CompanyId AND r.IsActive = 1
    ORDER BY r.RoleName;

    -- 3: the modules of each role
    SELECT rm.CompanyRoleId, m.ModuleKey
    FROM dbo.CompanyRoleModules rm
    INNER JOIN dbo.CompanyRoles r ON r.CompanyRoleId = rm.CompanyRoleId AND r.CompanyId = @CompanyId AND r.IsActive = 1
    INNER JOIN dbo.Modules m ON m.ModuleId = rm.ModuleId;

    -- 4: the permissions of each role
    SELECT a.CompanyRoleId, a.MenuId, a.CanView, a.CanCreate, a.CanEdit, a.CanDelete
    FROM dbo.CompanyRoleMenuAccess a
    INNER JOIN dbo.CompanyRoles r ON r.CompanyRoleId = a.CompanyRoleId AND r.CompanyId = @CompanyId AND r.IsActive = 1;

    -- 5: the members
    SELECT u.UserId, u.FullName, u.Email, ISNULL(u.MobileNumber, '') AS MobileNumber, cu.RoleInCompany,
           CAST(CASE WHEN u.IsActive = 1 AND cu.IsActive = 1 THEN 1 ELSE 0 END AS BIT) AS IsActive,
           CAST(CASE WHEN LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin') THEN 1 ELSE 0 END AS BIT) AS IsTenantAdmin,
           CAST(CASE WHEN cam.UserId IS NULL THEN 0 ELSE 1 END AS BIT) AS CanManage
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u ON u.UserId = cu.UserId
    LEFT  JOIN dbo.CompanyAccessManagers cam ON cam.CompanyId = cu.CompanyId AND cam.UserId = cu.UserId
    WHERE cu.CompanyId = @CompanyId
    ORDER BY CASE WHEN LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin') THEN 0 ELSE 1 END, u.FullName;

    -- 6: who has which role
    SELECT cur.UserId, cur.CompanyRoleId
    FROM dbo.CompanyUserRoles cur
    INNER JOIN dbo.CompanyRoles r ON r.CompanyRoleId = cur.CompanyRoleId AND r.CompanyId = @CompanyId AND r.IsActive = 1
    WHERE cur.CompanyId = @CompanyId;

    -- 7: which modules each member can open
    SELECT uma.UserId, m.ModuleKey
    FROM dbo.UserModuleAccess uma
    INNER JOIN dbo.Modules m ON m.ModuleId = uma.ModuleId AND m.IsActive = 1 AND m.IsReleased = 1 AND m.AppType = 'Commercial'
    INNER JOIN dbo.CompanyModules cm ON cm.ModuleId = m.ModuleId AND cm.CompanyId = uma.CompanyId AND cm.IsEnabled = 1
    WHERE uma.CompanyId = @CompanyId;
END
GO

/* -----------------------------------------------------------------------------
   4. A member's level and module grants follow their roles.
      A member with no company role, and an administrator, are left alone.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_CompanyAccess_ApplyUserRoles
    @CompanyId INT,
    @UserId    INT,
    @ChangedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Level NVARCHAR(100);

    IF EXISTS (SELECT 1 FROM dbo.CompanyUsers
               WHERE CompanyId = @CompanyId AND UserId = @UserId
                 AND LTRIM(RTRIM(RoleInCompany)) IN ('Admin', 'CompanyAdmin'))
        RETURN;

    SELECT TOP 1 @Level = r.AccessLevel
    FROM dbo.CompanyUserRoles cur
    INNER JOIN dbo.CompanyRoles r ON r.CompanyRoleId = cur.CompanyRoleId AND r.CompanyId = @CompanyId AND r.IsActive = 1
    WHERE cur.CompanyId = @CompanyId AND cur.UserId = @UserId
    ORDER BY CASE r.AccessLevel WHEN 'Manager' THEN 1 WHEN 'ServiceManager' THEN 2 WHEN 'Storekeeper' THEN 3 ELSE 4 END;

    IF @Level IS NULL RETURN;

    BEGIN TRANSACTION;

    UPDATE dbo.CompanyUsers SET RoleInCompany = @Level
    WHERE CompanyId = @CompanyId AND UserId = @UserId;

    DELETE uma
    FROM dbo.UserModuleAccess uma
    INNER JOIN dbo.Modules m ON m.ModuleId = uma.ModuleId AND m.AppType = 'Commercial'
    WHERE uma.CompanyId = @CompanyId AND uma.UserId = @UserId
      AND NOT EXISTS (SELECT 1
                      FROM dbo.CompanyUserRoles cur
                      INNER JOIN dbo.CompanyRoles r ON r.CompanyRoleId = cur.CompanyRoleId AND r.IsActive = 1
                      INNER JOIN dbo.CompanyRoleModules rm ON rm.CompanyRoleId = r.CompanyRoleId
                      WHERE cur.CompanyId = @CompanyId AND cur.UserId = @UserId AND rm.ModuleId = uma.ModuleId);

    INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
    SELECT DISTINCT @CompanyId, @UserId, rm.ModuleId, @ChangedBy
    FROM dbo.CompanyUserRoles cur
    INNER JOIN dbo.CompanyRoles r ON r.CompanyRoleId = cur.CompanyRoleId AND r.CompanyId = @CompanyId AND r.IsActive = 1
    INNER JOIN dbo.CompanyRoleModules rm ON rm.CompanyRoleId = r.CompanyRoleId
    WHERE cur.CompanyId = @CompanyId AND cur.UserId = @UserId
      AND NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess x
                      WHERE x.CompanyId = @CompanyId AND x.UserId = @UserId AND x.ModuleId = rm.ModuleId);

    COMMIT TRANSACTION;
END
GO

/* -----------------------------------------------------------------------------
   5. Save a role: its modules and permissions; its members follow
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_CompanyAccess_SaveRole
    @CompanyId     INT,
    @CompanyRoleId INT,
    @RoleName      NVARCHAR(100),
    @Description   NVARCHAR(300) = NULL,
    @AccessLevel   NVARCHAR(100),
    @ModulesJson   NVARCHAR(MAX),
    @MenusJson     NVARCHAR(MAX),
    @SavedBy       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Modules TABLE (ModuleId INT PRIMARY KEY);
    DECLARE @Keys TABLE (ModuleKey NVARCHAR(50) PRIMARY KEY);
    DECLARE @Menus TABLE (MenuId INT PRIMARY KEY, CanView BIT, CanCreate BIT, CanEdit BIT, CanDelete BIT);
    DECLARE @Member INT;

    SET @RoleName = LTRIM(RTRIM(ISNULL(@RoleName, '')));
    SET @CompanyRoleId = ISNULL(@CompanyRoleId, 0);

    IF @RoleName = ''
    BEGIN SELECT CAST(0 AS INT) AS Success, 'Enter a role name' AS Message, 0 AS CompanyRoleId; RETURN; END

    IF @RoleName IN ('Admin', 'CompanyAdmin', 'Tenant Admin', 'Customer')
    BEGIN SELECT CAST(0 AS INT) AS Success, 'This role name is reserved' AS Message, 0 AS CompanyRoleId; RETURN; END

    IF @AccessLevel NOT IN ('Manager', 'ServiceManager', 'Storekeeper', 'Technician')
    BEGIN SELECT CAST(0 AS INT) AS Success, 'Choose what this role works as' AS Message, 0 AS CompanyRoleId; RETURN; END

    IF ISJSON(@ModulesJson) <> 1 OR ISJSON(@MenusJson) <> 1
    BEGIN SELECT CAST(0 AS INT) AS Success, 'The role could not be read' AS Message, 0 AS CompanyRoleId; RETURN; END

    IF @CompanyRoleId > 0 AND NOT EXISTS (SELECT 1 FROM dbo.CompanyRoles
                                          WHERE CompanyRoleId = @CompanyRoleId AND CompanyId = @CompanyId AND IsActive = 1)
    BEGIN SELECT CAST(0 AS INT) AS Success, 'Role not found' AS Message, 0 AS CompanyRoleId; RETURN; END

    INSERT INTO @Keys (ModuleKey)
    SELECT DISTINCT UPPER(LTRIM(RTRIM([value]))) FROM OPENJSON(@ModulesJson);

    INSERT INTO @Modules (ModuleId)
    SELECT m.ModuleId
    FROM @Keys k
    INNER JOIN dbo.Modules m ON m.ModuleKey = k.ModuleKey AND m.IsActive = 1 AND m.IsReleased = 1 AND m.AppType = 'Commercial'
    INNER JOIN dbo.CompanyModules cm ON cm.ModuleId = m.ModuleId AND cm.CompanyId = @CompanyId AND cm.IsEnabled = 1;

    IF NOT EXISTS (SELECT 1 FROM @Modules) OR (SELECT COUNT(*) FROM @Modules) <> (SELECT COUNT(*) FROM @Keys)
    BEGIN SELECT CAST(0 AS INT) AS Success, 'Choose modules your company has' AS Message, 0 AS CompanyRoleId; RETURN; END

    -- any other permission implies View; a row with nothing ticked is not stored
    INSERT INTO @Menus (MenuId, CanView, CanCreate, CanEdit, CanDelete)
    SELECT j.menuId,
           CAST(MAX(CASE WHEN ISNULL(j.canView, 0) = 1 OR ISNULL(j.canCreate, 0) = 1 OR ISNULL(j.canEdit, 0) = 1 OR ISNULL(j.canDelete, 0) = 1 THEN 1 ELSE 0 END) AS BIT),
           CAST(MAX(CASE WHEN ISNULL(j.canCreate, 0) = 1 THEN 1 ELSE 0 END) AS BIT),
           CAST(MAX(CASE WHEN ISNULL(j.canEdit, 0) = 1 THEN 1 ELSE 0 END) AS BIT),
           CAST(MAX(CASE WHEN ISNULL(j.canDelete, 0) = 1 THEN 1 ELSE 0 END) AS BIT)
    FROM OPENJSON(@MenusJson)
         WITH (menuId INT '$.menuId', canView INT '$.canView', canCreate INT '$.canCreate',
               canEdit INT '$.canEdit', canDelete INT '$.canDelete') j
    WHERE ISNULL(j.canView, 0) = 1 OR ISNULL(j.canCreate, 0) = 1 OR ISNULL(j.canEdit, 0) = 1 OR ISNULL(j.canDelete, 0) = 1
    GROUP BY j.menuId;

    IF EXISTS (SELECT 1 FROM @Menus x
               LEFT JOIN dbo.MenuItems mi ON mi.MenuId = x.MenuId AND mi.IsActive = 1
               LEFT JOIN @Modules m ON m.ModuleId = mi.AppModuleId
               WHERE m.ModuleId IS NULL)
    BEGIN SELECT CAST(0 AS INT) AS Success, 'A chosen page is not part of the selected modules' AS Message, 0 AS CompanyRoleId; RETURN; END

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM dbo.CompanyRoles WITH (UPDLOCK, HOLDLOCK)
               WHERE CompanyId = @CompanyId AND RoleName = @RoleName AND CompanyRoleId <> @CompanyRoleId)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'A role with this name already exists' AS Message, 0 AS CompanyRoleId; RETURN;
    END

    IF @CompanyRoleId = 0
    BEGIN
        INSERT INTO dbo.CompanyRoles (CompanyId, RoleName, Description, AccessLevel, CreatedBy)
        VALUES (@CompanyId, @RoleName, NULLIF(LTRIM(RTRIM(@Description)), ''), @AccessLevel, @SavedBy);
        SET @CompanyRoleId = SCOPE_IDENTITY();
    END
    ELSE
        UPDATE dbo.CompanyRoles
        SET RoleName = @RoleName, Description = NULLIF(LTRIM(RTRIM(@Description)), ''),
            AccessLevel = @AccessLevel, UpdatedAt = GETDATE()
        WHERE CompanyRoleId = @CompanyRoleId AND CompanyId = @CompanyId;

    DELETE FROM dbo.CompanyRoleModules WHERE CompanyRoleId = @CompanyRoleId;
    INSERT INTO dbo.CompanyRoleModules (CompanyRoleId, ModuleId)
    SELECT @CompanyRoleId, ModuleId FROM @Modules;

    DELETE FROM dbo.CompanyRoleMenuAccess WHERE CompanyRoleId = @CompanyRoleId;
    INSERT INTO dbo.CompanyRoleMenuAccess (CompanyRoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
    SELECT @CompanyRoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete FROM @Menus;

    DECLARE members CURSOR LOCAL FAST_FORWARD FOR
        SELECT UserId FROM dbo.CompanyUserRoles WHERE CompanyId = @CompanyId AND CompanyRoleId = @CompanyRoleId;
    OPEN members;
    FETCH NEXT FROM members INTO @Member;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC dbo.sp_CompanyAccess_ApplyUserRoles @CompanyId = @CompanyId, @UserId = @Member, @ChangedBy = @SavedBy;
        FETCH NEXT FROM members INTO @Member;
    END
    CLOSE members;
    DEALLOCATE members;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Role saved' AS Message, @CompanyRoleId AS CompanyRoleId;
END
GO

/* -----------------------------------------------------------------------------
   6. Delete a role nobody has
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_CompanyAccess_DeleteRole
    @CompanyId     INT,
    @CompanyRoleId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.CompanyRoles WITH (UPDLOCK, HOLDLOCK)
                   WHERE CompanyRoleId = @CompanyRoleId AND CompanyId = @CompanyId)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Role not found' AS Message; RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.CompanyUserRoles WITH (UPDLOCK, HOLDLOCK) WHERE CompanyRoleId = @CompanyRoleId)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'This role is assigned to users. Remove it from them first' AS Message; RETURN;
    END

    DELETE FROM dbo.CompanyRoleMenuAccess WHERE CompanyRoleId = @CompanyRoleId;
    DELETE FROM dbo.CompanyRoleModules WHERE CompanyRoleId = @CompanyRoleId;
    DELETE FROM dbo.CompanyRoles WHERE CompanyRoleId = @CompanyRoleId AND CompanyId = @CompanyId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Role deleted' AS Message;
END
GO

/* -----------------------------------------------------------------------------
   7. Add a person, or change a member's roles and status.
      The name, e-mail and password of an existing account are never changed
      here: one account can belong to several companies.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_CompanyAccess_SaveUser
    @CompanyId    INT,
    @UserId       INT,
    @FullName     NVARCHAR(200) = NULL,
    @Email        NVARCHAR(256) = NULL,
    @MobileNumber NVARCHAR(20)  = NULL,
    @PasswordHash NVARCHAR(200) = NULL,
    @IsActive     BIT,
    @RoleIdsJson  NVARCHAR(MAX),
    @SavedBy      INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Roles TABLE (CompanyRoleId INT PRIMARY KEY, AccessLevel NVARCHAR(100));
    DECLARE @Asked INT, @Level NVARCHAR(100), @GlobalRoleId INT, @Current NVARCHAR(100), @HadRoles BIT = 0;

    SET @UserId = ISNULL(@UserId, 0);
    SET @IsActive = ISNULL(@IsActive, 1);
    SET @FullName = NULLIF(LTRIM(RTRIM(@FullName)), '');
    SET @Email = NULLIF(LTRIM(RTRIM(@Email)), '');
    SET @MobileNumber = NULLIF(LTRIM(RTRIM(@MobileNumber)), '');

    IF ISJSON(@RoleIdsJson) <> 1
    BEGIN SELECT CAST(0 AS INT) AS Success, 'The roles could not be read' AS Message, 0 AS UserId; RETURN; END

    SELECT @Asked = COUNT(DISTINCT TRY_CAST([value] AS INT)) FROM OPENJSON(@RoleIdsJson);

    INSERT INTO @Roles (CompanyRoleId, AccessLevel)
    SELECT r.CompanyRoleId, r.AccessLevel
    FROM dbo.CompanyRoles r
    WHERE r.CompanyId = @CompanyId AND r.IsActive = 1
      AND r.CompanyRoleId IN (SELECT TRY_CAST([value] AS INT) FROM OPENJSON(@RoleIdsJson));

    IF (SELECT COUNT(*) FROM @Roles) <> @Asked
    BEGIN SELECT CAST(0 AS INT) AS Success, 'A chosen role does not belong to this company' AS Message, 0 AS UserId; RETURN; END

    SELECT TOP 1 @Level = AccessLevel FROM @Roles
    ORDER BY CASE AccessLevel WHEN 'Manager' THEN 1 WHEN 'ServiceManager' THEN 2 WHEN 'Storekeeper' THEN 3 ELSE 4 END;

    BEGIN TRANSACTION;

    IF @UserId = 0
    BEGIN
        IF @Email IS NULL OR @Level IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'Enter the email and choose at least one role' AS Message, 0 AS UserId; RETURN;
        END

        SELECT @UserId = UserId FROM dbo.Users WITH (UPDLOCK, HOLDLOCK) WHERE Email = @Email;

        IF ISNULL(@UserId, 0) = 0
        BEGIN
            IF @FullName IS NULL OR @PasswordHash IS NULL
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT CAST(0 AS INT) AS Success,
                       'This person has no account yet. Enter their name and a temporary password' AS Message, 0 AS UserId;
                RETURN;
            END

            IF @MobileNumber IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber)
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT CAST(0 AS INT) AS Success, 'This mobile number is already registered' AS Message, 0 AS UserId; RETURN;
            END

            SELECT @GlobalRoleId = RoleId FROM dbo.Roles WHERE RoleName = @Level;

            INSERT INTO dbo.Users (FullName, Email, MobileNumber, RoleId, IsActive, PasswordHash)
            VALUES (@FullName, @Email, @MobileNumber, @GlobalRoleId, 1, @PasswordHash);
            SET @UserId = SCOPE_IDENTITY();
        END
        ELSE IF EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'This person is already in the company' AS Message, 0 AS UserId; RETURN;
        END

        IF EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
        BEGIN
            IF EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId
                         AND LTRIM(RTRIM(RoleInCompany)) IN ('Admin', 'CompanyAdmin'))
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT CAST(0 AS INT) AS Success, 'A company administrator cannot be changed here' AS Message, 0 AS UserId; RETURN;
            END
            UPDATE dbo.CompanyUsers SET RoleInCompany = @Level, IsActive = 1, AssignedBy = @SavedBy
            WHERE CompanyId = @CompanyId AND UserId = @UserId;
        END
        ELSE
            INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
            VALUES (@CompanyId, @UserId, @Level, @SavedBy, 1);
    END
    ELSE
    BEGIN
        SELECT @Current = RoleInCompany FROM dbo.CompanyUsers WITH (UPDLOCK, HOLDLOCK)
        WHERE CompanyId = @CompanyId AND UserId = @UserId;

        IF @Current IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'This person is not in the company' AS Message, 0 AS UserId; RETURN;
        END

        IF LTRIM(RTRIM(@Current)) IN ('Admin', 'CompanyAdmin')
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'A company administrator cannot be changed here' AS Message, 0 AS UserId; RETURN;
        END

        IF EXISTS (SELECT 1 FROM dbo.CompanyUserRoles WHERE CompanyId = @CompanyId AND UserId = @UserId)
            SET @HadRoles = 1;

        IF @HadRoles = 1 AND @Level IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'Choose at least one role' AS Message, 0 AS UserId; RETURN;
        END

        UPDATE dbo.CompanyUsers SET IsActive = @IsActive
        WHERE CompanyId = @CompanyId AND UserId = @UserId;

        IF @IsActive = 0
            DELETE FROM dbo.CompanyAccessManagers WHERE CompanyId = @CompanyId AND UserId = @UserId;
    END

    -- a member who still has no company role keeps the access they had
    IF @Level IS NOT NULL
    BEGIN
        DELETE FROM dbo.CompanyUserRoles WHERE CompanyId = @CompanyId AND UserId = @UserId;
        INSERT INTO dbo.CompanyUserRoles (CompanyId, UserId, CompanyRoleId, AssignedBy)
        SELECT @CompanyId, @UserId, CompanyRoleId, @SavedBy FROM @Roles;

        EXEC dbo.sp_CompanyAccess_ApplyUserRoles @CompanyId = @CompanyId, @UserId = @UserId, @ChangedBy = @SavedBy;
    END

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'User saved' AS Message, @UserId AS UserId;
END
GO

/* -----------------------------------------------------------------------------
   8. Give / take "Can manage users & roles"
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_CompanyAccess_SetManager
    @CompanyId INT,
    @UserId    INT,
    @Enabled   BIT,
    @GrantedBy INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Role NVARCHAR(100);

    SELECT @Role = cu.RoleInCompany
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u ON u.UserId = cu.UserId AND u.IsActive = 1
    WHERE cu.CompanyId = @CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1;

    IF @Role IS NULL
    BEGIN SELECT CAST(0 AS INT) AS Success, 'The user is not an active member of the company' AS Message; RETURN; END

    IF LTRIM(RTRIM(@Role)) IN ('Admin', 'CompanyAdmin')
    BEGIN SELECT CAST(0 AS INT) AS Success, 'The tenant admin always has this access' AS Message; RETURN; END

    IF ISNULL(@Enabled, 0) = 1
        INSERT INTO dbo.CompanyAccessManagers (CompanyId, UserId, GrantedBy)
        SELECT @CompanyId, @UserId, @GrantedBy
        WHERE NOT EXISTS (SELECT 1 FROM dbo.CompanyAccessManagers WITH (UPDLOCK, HOLDLOCK)
                          WHERE CompanyId = @CompanyId AND UserId = @UserId);
    ELSE
        DELETE FROM dbo.CompanyAccessManagers WHERE CompanyId = @CompanyId AND UserId = @UserId;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN ISNULL(@Enabled, 0) = 1 THEN 'Access granted' ELSE 'Access removed' END AS Message;
END
GO

/* -----------------------------------------------------------------------------
   9. Menus: a member with company roles gets the combined menus of those roles.
      Everybody else is answered exactly as before this script.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetMenusForCompany
    @UserId    INT,
    @CompanyId INT,
    @ModuleKey NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleId INT, @ModuleId INT, @UseCompanyRoles BIT = 0;

    SELECT @RoleId = r.RoleId,
           @UseCompanyRoles = CASE
               WHEN LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin') THEN 0
               WHEN EXISTS (SELECT 1 FROM dbo.CompanyUserRoles cur
                            INNER JOIN dbo.CompanyRoles cr ON cr.CompanyRoleId = cur.CompanyRoleId
                                                          AND cr.CompanyId = cu.CompanyId AND cr.IsActive = 1
                            WHERE cur.CompanyId = cu.CompanyId AND cur.UserId = cu.UserId) THEN 1
               ELSE 0 END
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Roles r ON r.RoleName = cu.RoleInCompany
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1;

    IF NULLIF(@ModuleKey, '') IS NOT NULL
        SELECT @ModuleId = ModuleId FROM dbo.Modules WHERE ModuleKey = @ModuleKey;

    ;WITH Access AS
    (
        SELECT rma.MenuId, rma.CanView, rma.CanCreate, rma.CanEdit, rma.CanDelete
        FROM dbo.RoleMenuAccess rma
        WHERE @UseCompanyRoles = 0 AND rma.RoleId = @RoleId AND rma.CanView = 1

        UNION ALL

        SELECT a.MenuId,
               CAST(MAX(CAST(a.CanView   AS INT)) AS BIT),
               CAST(MAX(CAST(a.CanCreate AS INT)) AS BIT),
               CAST(MAX(CAST(a.CanEdit   AS INT)) AS BIT),
               CAST(MAX(CAST(a.CanDelete AS INT)) AS BIT)
        FROM dbo.CompanyUserRoles cur
        INNER JOIN dbo.CompanyRoles cr ON cr.CompanyRoleId = cur.CompanyRoleId AND cr.CompanyId = @CompanyId AND cr.IsActive = 1
        INNER JOIN dbo.CompanyRoleMenuAccess a ON a.CompanyRoleId = cr.CompanyRoleId AND a.CanView = 1
        WHERE @UseCompanyRoles = 1 AND cur.CompanyId = @CompanyId AND cur.UserId = @UserId
        GROUP BY a.MenuId
    ),
    Granted AS
    (
        SELECT m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, m.SortOrder,
               a.CanView, a.CanCreate, a.CanEdit, a.CanDelete
        FROM dbo.MenuItems m
        INNER JOIN Access a ON a.MenuId = m.MenuId
        WHERE m.IsActive = 1
          AND (@ModuleId IS NULL OR m.AppModuleId IS NULL OR m.AppModuleId = @ModuleId)
    )
    SELECT MenuId, MenuName, MenuPath, Icon, ParentMenuId, SortOrder,
           CanView, CanCreate, CanEdit, CanDelete
    FROM Granted

    UNION ALL

    SELECT p.MenuId, p.MenuName, p.MenuPath, p.Icon, p.ParentMenuId, p.SortOrder,
           CAST(1 AS BIT), CAST(0 AS BIT), CAST(0 AS BIT), CAST(0 AS BIT)
    FROM dbo.MenuItems p
    WHERE p.IsActive = 1
      AND p.MenuId IN (SELECT g.ParentMenuId FROM Granted g WHERE g.ParentMenuId IS NOT NULL)
      AND p.MenuId NOT IN (SELECT g.MenuId FROM Granted g)

    ORDER BY SortOrder, MenuId;
END
GO

/* -----------------------------------------------------------------------------
   10. The users the company database mirrors: re-created from script 19 so that a
       member with CRM but no Service can enter a branch. Anyone with a Service or
       CRM grant is mirrored while either module is on, so switching one of them
       off never deactivates a member in the company database.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GetUsersForSync
    @CompanyId INT,
    @UserId    INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @MirrorOn BIT = 0;

    DECLARE @Users TABLE
    (
        UserId        INT           NOT NULL,
        FullName      NVARCHAR(200) NULL,
        Email         NVARCHAR(256) NULL,
        MobileNumber  NVARCHAR(20)  NULL,
        RoleInCompany NVARCHAR(100) NULL
    );

    BEGIN TRANSACTION;

    SELECT @MirrorOn = 1
    FROM dbo.CompanyModules cm WITH (HOLDLOCK)
    INNER JOIN dbo.Modules m WITH (HOLDLOCK) ON m.ModuleId = cm.ModuleId
    WHERE cm.CompanyId = @CompanyId
      AND cm.IsEnabled = 1
      AND m.ModuleKey IN ('SERVICE', 'CRM')
      AND m.IsActive = 1;

    IF @MirrorOn = 1
        INSERT INTO @Users (UserId, FullName, Email, MobileNumber, RoleInCompany)
        SELECT u.UserId, u.FullName, u.Email, u.MobileNumber, cu.RoleInCompany
        FROM dbo.CompanyUsers cu
        INNER JOIN dbo.Users u ON u.UserId = cu.UserId AND u.IsActive = 1
        WHERE cu.CompanyId = @CompanyId
          AND cu.IsActive = 1
          AND (@UserId IS NULL OR u.UserId = @UserId)
          AND (   LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin')
               OR EXISTS (SELECT 1
                          FROM dbo.UserModuleAccess uma
                          INNER JOIN dbo.Modules m ON m.ModuleId = uma.ModuleId
                          WHERE uma.CompanyId = cu.CompanyId AND uma.UserId = cu.UserId
                            AND m.ModuleKey IN ('SERVICE', 'CRM') AND m.IsActive = 1));

    COMMIT TRANSACTION;

    SELECT c.CompanyId, c.TenantKey, c.TenantScopeId
    FROM dbo.Companies c
    WHERE c.CompanyId = @CompanyId
      AND c.IsActive = 1
      AND c.ProvisionStatus = 'Ready'
      AND @MirrorOn = 1;

    SELECT UserId, FullName, Email, MobileNumber, RoleInCompany
    FROM @Users
    ORDER BY UserId;
END
GO

PRINT 'Company users and roles are in place.';
GO
SET NOEXEC OFF;
GO
