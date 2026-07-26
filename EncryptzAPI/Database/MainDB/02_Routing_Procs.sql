/* =============================================================================
   MainDB  ·  Routing + auth stored procedures  (per-project routing)
   -----------------------------------------------------------------------------
   Location procs are NOT here — locations live in each project's DB.
   ============================================================================= */
USE MainDBEncryptz;
GO

/* -----------------------------------------------------------------------------
   sp_Project_GetConnection
   Used by IConnectionResolver to build a ProjectDB connection string.
   Returns the encrypted registry row for a given ProjectKey.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Project_GetConnection
    @ProjectKey NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        pc.ProjectId,
        pc.ProjectKey,
        pc.ServerName,
        pc.DatabaseName,
        pc.DbUser,
        pc.DbPasswordEnc,
        pc.ExtraOptions
    FROM dbo.ProjectConnections pc
    INNER JOIN dbo.Projects p ON p.ProjectId = pc.ProjectId
    WHERE pc.ProjectKey = @ProjectKey
      AND pc.IsActive = 1
      AND p.IsActive  = 1;
END
GO

/* -----------------------------------------------------------------------------
   sp_Auth_Login  (global login against MainDB)
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Auth_Login
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        u.UserId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        u.PasswordHash,
        ISNULL(r.RoleName, '')      AS Role,
        CAST(NULL AS INT)           AS technicianId
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    WHERE u.Email = @Email
      AND u.IsActive = 1;
END
GO

/* -----------------------------------------------------------------------------
   sp_User_GetCompanies
   Companies the user can reach — i.e. ONLY companies that contain at least one
   PROJECT the user has access to (UserProjectAccess). A company with no accessible
   project is not listed. Role comes from CompanyUsers when present.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetCompanies
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT
        c.CompanyId,
        c.CompanyName,
        c.CompanyCode,
        c.Address,
        c.City,
        c.PhoneNumber,
        ISNULL(cu.RoleInCompany, '') AS RoleInCompany,
        CAST(CASE WHEN us.SelectedCompanyId = c.CompanyId THEN 1 ELSE 0 END AS BIT) AS IsLinked
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects  p ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
    INNER JOIN dbo.Companies c ON c.CompanyId = p.CompanyId   AND c.IsActive = 1
    LEFT  JOIN dbo.CompanyUsers cu ON cu.CompanyId = c.CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1
    LEFT  JOIN dbo.UserSessions us ON us.UserId = upa.UserId
    WHERE upa.UserId = @UserId
      AND upa.IsActive = 1;
END
GO

/* -----------------------------------------------------------------------------
   sp_User_SelectCompany
   Returns the user's role for the chosen company (projects are fetched separately).
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_User_SelectCompany
    @UserId    INT,
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        c.CompanyId,
        c.CompanyName,
        c.CompanyCode,
        cu.RoleInCompany,
        ISNULL(cu.TechnicianId, 0) AS TechnicianId
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Companies c ON c.CompanyId = cu.CompanyId
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
      AND c.IsActive  = 1;
END
GO

/* -----------------------------------------------------------------------------
   sp_User_GetProjects
   PROJECTS THE USER CAN ACCESS within a company (per-user access from MainDB).
   Includes ProjectKey so the API can resolve that project's DB.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetProjects
    @UserId    INT,
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.ProjectId,
        p.CompanyId,
        p.ProjectName,
        p.ProjectKey
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects p ON p.ProjectId = upa.ProjectId
    WHERE upa.UserId = @UserId
      AND p.CompanyId = @CompanyId
      AND upa.IsActive = 1
      AND p.IsActive  = 1
    ORDER BY p.ProjectName;
END
GO

/* -----------------------------------------------------------------------------
   sp_User_ValidateProject
   Confirms a user may access a project and returns its ProjectKey (routing key).
   Location access is validated separately inside the project's own DB.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_User_ValidateProject
    @UserId    INT,
    @CompanyId INT,
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        p.ProjectId,
        p.ProjectKey,
        cu.RoleInCompany
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects p    ON p.ProjectId = upa.ProjectId
    INNER JOIN dbo.CompanyUsers cu ON cu.UserId = upa.UserId AND cu.CompanyId = p.CompanyId AND cu.IsActive = 1
    WHERE upa.UserId = @UserId
      AND upa.ProjectId = @ProjectId
      AND p.CompanyId = @CompanyId
      AND upa.IsActive = 1
      AND p.IsActive  = 1;
END
GO

/* -----------------------------------------------------------------------------
   sp_User_UpdateSession  (persist current company/project/location + token)
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_User_UpdateSession
    @UserId     INT,
    @CompanyId  INT,
    @AuthToken  NVARCHAR(MAX),
    @ProjectId  INT = NULL,
    @LocationId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dbo.UserSessions AS tgt
    USING (SELECT @UserId AS UserId) AS src
        ON tgt.UserId = src.UserId
    WHEN MATCHED THEN
        UPDATE SET SelectedCompanyId = @CompanyId,
                   SelectedProjectId = @ProjectId,
                   SelectedLocationId = @LocationId,
                   AuthToken = @AuthToken,
                   UpdatedAt = GETDATE()
    WHEN NOT MATCHED THEN
        INSERT (UserId, SelectedCompanyId, SelectedProjectId, SelectedLocationId, AuthToken)
        VALUES (@UserId, @CompanyId, @ProjectId, @LocationId, @AuthToken);
END
GO

/* -----------------------------------------------------------------------------
   sp_User_GetMenusForCompany  (global menu tree filtered by role in company)
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetMenusForCompany
    @UserId    INT,
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleId INT;

    SELECT @RoleId = r.RoleId
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Roles r ON r.RoleName = cu.RoleInCompany
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1;

    SELECT
        m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, m.SortOrder,
        rma.CanView, rma.CanCreate, rma.CanEdit, rma.CanDelete
    FROM dbo.MenuItems m
    INNER JOIN dbo.RoleMenuAccess rma
            ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId AND rma.CanView = 1
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.MenuId;
END
GO

/* -----------------------------------------------------------------------------
   sp_User_GetCurrentSessionCompany
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetCurrentSessionCompany
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SelectedCompanyId, SelectedProjectId, SelectedLocationId
    FROM dbo.UserSessions
    WHERE UserId = @UserId;
END
GO

PRINT 'MainDB routing/auth procs created (per-project).';
GO
