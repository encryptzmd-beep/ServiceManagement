/* =============================================================================
   MainDB  ·  Platform administration (the "MainDB screen" of the UI)
   -----------------------------------------------------------------------------
   Everything that used to be set by hand in the MainDB tables:

     Companies            sp_Platform_GetCompanies / sp_Platform_SaveCompany
     Projects + their DB  sp_Platform_GetProjects  / sp_Platform_SaveProject
                          sp_Platform_GetProject
     Project access       sp_Platform_GetProjectAccess / sp_Platform_SetProjectAccess
     Menu tree            sp_Platform_GetMenus     / sp_Platform_SaveMenu

   Users, roles and menu permissions already have screens (Access Management,
   Roles) and their own procs. Locations live in each project's DB
   (ProjectDB/07_Locations_Admin.sql).

   Who may call what is decided by the API (platform admin = global role Admin;
   a company admin only reaches the own company).

   Run against MainDB. SAFE TO RE-RUN.
   ============================================================================= */

IF COL_LENGTH('dbo.MenuItems', 'Module') IS NULL
    ALTER TABLE dbo.MenuItems ADD Module NVARCHAR(50) NULL;
GO

/* =============================================================================
   Companies
   ============================================================================= */
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
        (SELECT COUNT(*) FROM dbo.Projects p      WHERE p.CompanyId = c.CompanyId AND p.IsActive = 1)   AS ProjectCount,
        (SELECT COUNT(*) FROM dbo.CompanyUsers cu WHERE cu.CompanyId = c.CompanyId AND cu.IsActive = 1) AS UserCount
    FROM dbo.Companies c
    WHERE ISNULL(@CompanyId, 0) = 0 OR c.CompanyId = @CompanyId
    ORDER BY c.CompanyName;
END
GO

/* A new company gets its creator as Admin member, so somebody can enter it and
   set it up. CompanyId = 0 in the result means nothing was saved. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SaveCompany
    @CompanyId   INT,
    @CompanyName NVARCHAR(200),
    @CompanyCode NVARCHAR(50),
    @Address     NVARCHAR(400) = NULL,
    @City        NVARCHAR(100) = NULL,
    @PhoneNumber NVARCHAR(30)  = NULL,
    @IsActive    BIT = 1,
    @SavedBy     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @CompanyId   = ISNULL(@CompanyId, 0);
    SET @CompanyName = LTRIM(RTRIM(ISNULL(@CompanyName, '')));
    SET @CompanyCode = UPPER(LTRIM(RTRIM(ISNULL(@CompanyCode, ''))));

    IF @CompanyName = '' OR @CompanyCode = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company name and code are required' AS Message, CAST(0 AS INT) AS CompanyId; RETURN;
    END
    IF EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyCode = @CompanyCode AND CompanyId <> @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company code is already used' AS Message, CAST(0 AS INT) AS CompanyId; RETURN;
    END

    BEGIN TRANSACTION;

    IF @CompanyId = 0
    BEGIN
        INSERT INTO dbo.Companies (CompanyName, CompanyCode, Address, City, PhoneNumber, IsActive)
        VALUES (@CompanyName, @CompanyCode, @Address, @City, @PhoneNumber, ISNULL(@IsActive, 1));
        SET @CompanyId = SCOPE_IDENTITY();

        IF @SavedBy IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @SavedBy)
            INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
            VALUES (@CompanyId, @SavedBy, 'Admin', @SavedBy, 1);

        COMMIT TRANSACTION;
        SELECT CAST(1 AS INT) AS Success, 'Company created' AS Message, @CompanyId AS CompanyId;
        RETURN;
    END

    UPDATE dbo.Companies
    SET CompanyName = @CompanyName, CompanyCode = @CompanyCode, Address = @Address,
        City = @City, PhoneNumber = @PhoneNumber, IsActive = ISNULL(@IsActive, 1)
    WHERE CompanyId = @CompanyId;

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message, CAST(0 AS INT) AS CompanyId; RETURN;
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS INT) AS Success, 'Company updated' AS Message, @CompanyId AS CompanyId;
END
GO

/* =============================================================================
   Projects + the database each one is routed to
   (the password is never returned; HasPassword tells whether one is stored)
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetProjects
    @CompanyId INT = NULL          -- NULL/0 = all (platform admin)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.ProjectId, p.CompanyId, c.CompanyName, p.ProjectName, p.ProjectKey, p.IsActive, p.CreatedAt,
        ISNULL(pc.ServerName, '')   AS ServerName,
        ISNULL(pc.DatabaseName, '') AS DatabaseName,
        ISNULL(pc.DbUser, '')       AS DbUser,
        ISNULL(pc.ExtraOptions, '') AS ExtraOptions,
        CAST(CASE WHEN ISNULL(pc.DbPasswordEnc, '') IN ('', '<ENCRYPTED_PW>') THEN 0 ELSE 1 END AS BIT) AS HasPassword,
        CAST(ISNULL(pc.IsActive, 0) AS BIT) AS ConnectionActive,
        (SELECT COUNT(*) FROM dbo.UserProjectAccess upa WHERE upa.ProjectId = p.ProjectId AND upa.IsActive = 1) AS UserCount
    FROM dbo.Projects p
    INNER JOIN dbo.Companies c ON c.CompanyId = p.CompanyId
    LEFT JOIN dbo.ProjectConnections pc ON pc.ProjectId = p.ProjectId
    WHERE ISNULL(@CompanyId, 0) = 0 OR p.CompanyId = @CompanyId
    ORDER BY c.CompanyName, p.ProjectName;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetProject
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.ProjectId, p.CompanyId, p.ProjectName, p.ProjectKey, p.IsActive
    FROM dbo.Projects p
    WHERE p.ProjectId = @ProjectId;
END
GO

/* @DbPasswordEnc NULL on update = keep the stored password.
   ProjectId = 0 in the result means nothing was saved. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SaveProject
    @ProjectId     INT,
    @CompanyId     INT,
    @ProjectName   NVARCHAR(200),
    @ProjectKey    NVARCHAR(50),
    @IsActive      BIT = 1,
    @ServerName    NVARCHAR(200),
    @DatabaseName  NVARCHAR(200),
    @DbUser        NVARCHAR(100),
    @DbPasswordEnc NVARCHAR(500) = NULL,
    @ExtraOptions  NVARCHAR(400) = NULL,
    @SavedBy       INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @OldKey NVARCHAR(50), @Message NVARCHAR(200);

    SET @ProjectId    = ISNULL(@ProjectId, 0);
    SET @ProjectName  = LTRIM(RTRIM(ISNULL(@ProjectName, '')));
    SET @ProjectKey   = UPPER(LTRIM(RTRIM(ISNULL(@ProjectKey, ''))));
    SET @ServerName   = LTRIM(RTRIM(ISNULL(@ServerName, '')));
    SET @DatabaseName = LTRIM(RTRIM(ISNULL(@DatabaseName, '')));
    SET @DbUser       = LTRIM(RTRIM(ISNULL(@DbUser, '')));
    SET @ExtraOptions = NULLIF(LTRIM(RTRIM(ISNULL(@ExtraOptions, ''))), '');
    SET @DbPasswordEnc = NULLIF(@DbPasswordEnc, '');

    IF @ProjectName = '' OR @ProjectKey = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Project name and key are required' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF @ServerName = '' OR @DatabaseName = '' OR @DbUser = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Server, database and database user are required' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF EXISTS (SELECT 1 FROM dbo.Projects WHERE ProjectKey = @ProjectKey AND ProjectId <> @ProjectId)
       OR EXISTS (SELECT 1 FROM dbo.ProjectConnections WHERE ProjectKey = @ProjectKey AND ProjectId <> @ProjectId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Project key is already used' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF @ProjectId > 0 AND NOT EXISTS (SELECT 1 FROM dbo.Projects WHERE ProjectId = @ProjectId AND CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Project not found in this company' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF @DbPasswordEnc IS NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.ProjectConnections
                       WHERE ProjectId = @ProjectId AND ISNULL(DbPasswordEnc, '') NOT IN ('', '<ENCRYPTED_PW>'))
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Database password is required' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END

    BEGIN TRANSACTION;

    IF @ProjectId = 0
    BEGIN
        INSERT INTO dbo.Projects (CompanyId, ProjectName, ProjectKey, IsActive)
        VALUES (@CompanyId, @ProjectName, @ProjectKey, ISNULL(@IsActive, 1));
        SET @ProjectId = SCOPE_IDENTITY();
        SET @Message = 'Project created';

        /* the creator can enter the new project (needs company membership too) */
        IF @SavedBy IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @SavedBy)
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @SavedBy)
                INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
                VALUES (@CompanyId, @SavedBy, 'Admin', @SavedBy, 1);

            INSERT INTO dbo.UserProjectAccess (UserId, ProjectId, IsActive, GrantedBy)
            VALUES (@SavedBy, @ProjectId, 1, @SavedBy);
        END
    END
    ELSE
    BEGIN
        SELECT @OldKey = ProjectKey FROM dbo.Projects WHERE ProjectId = @ProjectId;

        UPDATE dbo.Projects
        SET ProjectName = @ProjectName, ProjectKey = @ProjectKey, IsActive = ISNULL(@IsActive, 1)
        WHERE ProjectId = @ProjectId;
        SET @Message = 'Project updated';
    END

    IF EXISTS (SELECT 1 FROM dbo.ProjectConnections WHERE ProjectId = @ProjectId)
        UPDATE dbo.ProjectConnections
        SET ProjectKey    = @ProjectKey,
            ServerName    = @ServerName,
            DatabaseName  = @DatabaseName,
            DbUser        = @DbUser,
            DbPasswordEnc = ISNULL(@DbPasswordEnc, DbPasswordEnc),
            ExtraOptions  = @ExtraOptions,
            IsActive      = ISNULL(@IsActive, 1),
            UpdatedAt     = GETDATE()
        WHERE ProjectId = @ProjectId;
    ELSE
        INSERT INTO dbo.ProjectConnections (ProjectId, ProjectKey, ServerName, DatabaseName, DbUser, DbPasswordEnc, ExtraOptions, IsActive)
        VALUES (@ProjectId, @ProjectKey, @ServerName, @DatabaseName, @DbUser, @DbPasswordEnc, @ExtraOptions, ISNULL(@IsActive, 1));

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, @Message AS Message, @ProjectId AS ProjectId, ISNULL(@OldKey, '') AS OldProjectKey;
END
GO

/* =============================================================================
   Project access: the company's members, with whether they may enter the project
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetProjectAccess
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId, u.FullName, u.Email, ISNULL(u.MobileNumber, '') AS MobileNumber,
        cu.RoleInCompany,
        CAST(ISNULL(upa.IsActive, 0) AS BIT) AS HasAccess,
        upa.GrantedAt,
        ISNULL(gb.FullName, '') AS GrantedByName
    FROM dbo.Projects p
    INNER JOIN dbo.CompanyUsers cu ON cu.CompanyId = p.CompanyId AND cu.IsActive = 1
    INNER JOIN dbo.Users u         ON u.UserId = cu.UserId AND u.IsActive = 1
    LEFT JOIN dbo.UserProjectAccess upa ON upa.ProjectId = p.ProjectId AND upa.UserId = u.UserId
    LEFT JOIN dbo.Users gb         ON gb.UserId = upa.GrantedBy
    WHERE p.ProjectId = @ProjectId
    ORDER BY u.FullName;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Platform_SetProjectAccess
    @ProjectId INT,
    @UserId    INT,
    @HasAccess BIT,
    @GrantedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1
                   FROM dbo.Projects p
                   INNER JOIN dbo.CompanyUsers cu ON cu.CompanyId = p.CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1
                   WHERE p.ProjectId = @ProjectId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The user is not an active member of the project''s company' AS Message; RETURN;
    END

    IF @HasAccess = 0 AND @UserId = @GrantedBy
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You cannot remove your own access' AS Message; RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.UserProjectAccess WHERE ProjectId = @ProjectId AND UserId = @UserId)
        UPDATE dbo.UserProjectAccess
        SET IsActive = @HasAccess, GrantedBy = @GrantedBy, GrantedAt = GETDATE()
        WHERE ProjectId = @ProjectId AND UserId = @UserId;
    ELSE
        INSERT INTO dbo.UserProjectAccess (UserId, ProjectId, IsActive, GrantedBy)
        VALUES (@UserId, @ProjectId, @HasAccess, @GrantedBy);

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @HasAccess = 1 THEN 'Access granted' ELSE 'Access removed' END AS Message;
END
GO

/* =============================================================================
   Menu tree
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetMenus
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.MenuId, m.MenuName,
        ISNULL(m.MenuPath, '') AS MenuPath,
        ISNULL(m.Icon, '')     AS Icon,
        m.ParentMenuId,
        ISNULL(p.MenuName, '') AS ParentMenuName,
        m.SortOrder, m.IsActive,
        ISNULL(m.Module, '')   AS Module,
        (SELECT COUNT(*) FROM dbo.RoleMenuAccess rma WHERE rma.MenuId = m.MenuId AND rma.CanView = 1) AS RoleCount
    FROM dbo.MenuItems m
    LEFT JOIN dbo.MenuItems p ON p.MenuId = m.ParentMenuId
    ORDER BY ISNULL(p.SortOrder, m.SortOrder), ISNULL(m.ParentMenuId, m.MenuId),
             CASE WHEN m.ParentMenuId IS NULL THEN 0 ELSE 1 END, m.SortOrder, m.MenuId;
END
GO

/* A new menu is granted to the Admin role, otherwise nobody would see it.
   Other roles get it from Access Management. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SaveMenu
    @MenuId       INT,
    @MenuName     NVARCHAR(150),
    @MenuPath     NVARCHAR(300) = NULL,
    @Icon         NVARCHAR(100) = NULL,
    @ParentMenuId INT = NULL,
    @SortOrder    INT = 0,
    @IsActive     BIT = 1,
    @Module       NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @MenuId       = ISNULL(@MenuId, 0);
    SET @MenuName     = LTRIM(RTRIM(ISNULL(@MenuName, '')));
    SET @MenuPath     = NULLIF(LTRIM(RTRIM(ISNULL(@MenuPath, ''))), '');
    SET @ParentMenuId = NULLIF(@ParentMenuId, 0);
    SET @Module       = ISNULL(NULLIF(LTRIM(RTRIM(ISNULL(@Module, ''))), ''), 'Services');

    IF @MenuName = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Menu name is required' AS Message, CAST(0 AS INT) AS MenuId; RETURN;
    END
    IF @ParentMenuId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.MenuItems WHERE MenuId = @ParentMenuId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Parent menu not found' AS Message, CAST(0 AS INT) AS MenuId; RETURN;
    END
    IF @ParentMenuId IS NOT NULL AND @ParentMenuId = @MenuId
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'A menu cannot be its own parent' AS Message, CAST(0 AS INT) AS MenuId; RETURN;
    END
    /* the sidebar has two levels: a parent cannot itself be a child */
    IF @ParentMenuId IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.MenuItems WHERE MenuId = @ParentMenuId AND ParentMenuId IS NOT NULL)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose a top-level menu as parent' AS Message, CAST(0 AS INT) AS MenuId; RETURN;
    END
    IF @ParentMenuId IS NOT NULL AND @MenuId > 0
       AND EXISTS (SELECT 1 FROM dbo.MenuItems WHERE ParentMenuId = @MenuId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This menu has sub-menus and must stay top-level' AS Message, CAST(0 AS INT) AS MenuId; RETURN;
    END
    IF @MenuPath IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.MenuItems WHERE MenuPath = @MenuPath AND MenuId <> @MenuId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Another menu already uses this path' AS Message, CAST(0 AS INT) AS MenuId; RETURN;
    END

    BEGIN TRANSACTION;

    IF @MenuId = 0
    BEGIN
        INSERT INTO dbo.MenuItems (MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive, Module)
        VALUES (@MenuName, @MenuPath, @Icon, @ParentMenuId, ISNULL(@SortOrder, 0), ISNULL(@IsActive, 1), @Module);
        SET @MenuId = SCOPE_IDENTITY();

        INSERT INTO dbo.RoleMenuAccess (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
        SELECT r.RoleId, @MenuId, 1, 1, 1, 1 FROM dbo.Roles r WHERE r.RoleName = 'Admin';

        COMMIT TRANSACTION;
        SELECT CAST(1 AS INT) AS Success, 'Menu created' AS Message, @MenuId AS MenuId;
        RETURN;
    END

    UPDATE dbo.MenuItems
    SET MenuName = @MenuName, MenuPath = @MenuPath, Icon = @Icon, ParentMenuId = @ParentMenuId,
        SortOrder = ISNULL(@SortOrder, 0), IsActive = ISNULL(@IsActive, 1), Module = @Module
    WHERE MenuId = @MenuId;

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Menu not found' AS Message, CAST(0 AS INT) AS MenuId; RETURN;
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS INT) AS Success, 'Menu updated' AS Message, @MenuId AS MenuId;
END
GO

/* =============================================================================
   Menu entry for the new screen (under the same parent as Access Management)
   ============================================================================= */
IF NOT EXISTS (SELECT 1 FROM dbo.MenuItems WHERE MenuPath IN ('/settings/platform', 'settings/platform'))
BEGIN
    DECLARE @ParentId INT, @Sort INT, @Slash BIT = 1;

    SELECT TOP 1 @ParentId = ParentMenuId, @Sort = SortOrder + 1,
                 @Slash = CASE WHEN MenuPath LIKE '/%' THEN 1 ELSE 0 END
    FROM dbo.MenuItems
    WHERE MenuPath LIKE '%settings/access-management%'
    ORDER BY MenuId;

    INSERT INTO dbo.MenuItems (MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive, Module)
    VALUES ('Platform Admin',
            CASE WHEN @Slash = 1 THEN '/settings/platform' ELSE 'settings/platform' END,
            'admin_panel_settings', @ParentId, ISNULL(@Sort, 99), 1, 'Services');

    INSERT INTO dbo.RoleMenuAccess (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
    SELECT r.RoleId, SCOPE_IDENTITY(), 1, 1, 1, 1
    FROM dbo.Roles r WHERE r.RoleName IN ('Admin', 'CompanyAdmin');
END
GO

PRINT 'MainDB platform administration procs applied.';
GO
