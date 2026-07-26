/* =============================================================================
   MainDBEncryptz · Grant a user Admin access to a company's project
   -----------------------------------------------------------------------------
   Makes the user an Admin of the company and grants access to its project, and
   sets the project registry's encrypted DB password so the project DB resolves.

   Current data (verified): User 1 = Adlin joe (joeadlin4@gmail.com),
   Company 1 = Felix Fitness (C001), Project 1 = Default Project (C001-P001)
   -> FelixServiceDB. Change the three keys below to target a different user/project.

   Idempotent — safe to re-run.
   ============================================================================= */
USE MainDBEncryptz;
GO

DECLARE @Email       NVARCHAR(256) = N'joeadlin4@gmail.com';   -- user to make admin
DECLARE @CompanyCode NVARCHAR(50)  = N'C001';                  -- Felix company
DECLARE @ProjectKey  NVARCHAR(50)  = N'C001-P001';             -- Felix project
DECLARE @Role        NVARCHAR(100) = N'Admin';

/* Encrypted ServiceDB password for the project registry.
   = Protect('Enc@h@m@123') using Tenant:SecretKey = 'CHANGE_ME_TenantRegistrySecret_ChangeInProduction'.
   If you change Tenant:SecretKey in appsettings, regenerate this value. */
DECLARE @DbPasswordEnc NVARCHAR(500) = N'koeueDzcfFCAHuTy//ZhNotTnYop5fwxA+eVWpll8U0=';

DECLARE @UserId    INT = (SELECT UserId    FROM dbo.Users     WHERE Email       = @Email);
DECLARE @CompanyId INT = (SELECT CompanyId FROM dbo.Companies WHERE CompanyCode = @CompanyCode);
DECLARE @ProjectId INT = (SELECT ProjectId FROM dbo.Projects  WHERE ProjectKey  = @ProjectKey);
DECLARE @RoleId    INT = (SELECT RoleId    FROM dbo.Roles     WHERE RoleName    = @Role);

IF @UserId IS NULL OR @CompanyId IS NULL OR @ProjectId IS NULL
BEGIN
    RAISERROR('User / Company / Project not found — check @Email/@CompanyCode/@ProjectKey.', 16, 1);
    RETURN;
END

/* Ensure the Admin role exists */
IF @RoleId IS NULL
BEGIN
    INSERT INTO dbo.Roles (RoleName, Description) VALUES (@Role, 'Full access');
    SET @RoleId = SCOPE_IDENTITY();
END

/* Optional: set the user's global role (login role) to Admin if not set */
UPDATE dbo.Users SET RoleId = @RoleId WHERE UserId = @UserId AND RoleId IS NULL;

/* Company membership as Admin */
IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
    INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, IsActive)
    VALUES (@CompanyId, @UserId, @Role, 1);
ELSE
    UPDATE dbo.CompanyUsers SET RoleInCompany = @Role, IsActive = 1
    WHERE CompanyId = @CompanyId AND UserId = @UserId;

/* Project access */
IF NOT EXISTS (SELECT 1 FROM dbo.UserProjectAccess WHERE UserId = @UserId AND ProjectId = @ProjectId)
    INSERT INTO dbo.UserProjectAccess (UserId, ProjectId, IsActive)
    VALUES (@UserId, @ProjectId, 1);
ELSE
    UPDATE dbo.UserProjectAccess SET IsActive = 1
    WHERE UserId = @UserId AND ProjectId = @ProjectId;

/* Fix the project registry password so ConnectionResolver can build the DB conn */
UPDATE dbo.ProjectConnections
SET DbPasswordEnc = @DbPasswordEnc, IsActive = 1, UpdatedAt = GETDATE()
WHERE ProjectKey = @ProjectKey;

/* Verify */
SELECT u.UserId, u.FullName, u.Email,
       c.CompanyName, cu.RoleInCompany,
       p.ProjectName, p.ProjectKey,
       pc.DatabaseName, pc.IsActive AS RegistryActive
FROM dbo.Users u
INNER JOIN dbo.CompanyUsers       cu ON cu.UserId = u.UserId AND cu.CompanyId = @CompanyId
INNER JOIN dbo.Companies          c  ON c.CompanyId = cu.CompanyId
INNER JOIN dbo.UserProjectAccess  upa ON upa.UserId = u.UserId AND upa.ProjectId = @ProjectId
INNER JOIN dbo.Projects           p  ON p.ProjectId = upa.ProjectId
LEFT  JOIN dbo.ProjectConnections pc ON pc.ProjectKey = p.ProjectKey
WHERE u.UserId = @UserId;
GO
