/* =============================================================================
   MainDB · Make a user the administrator of a company
   -----------------------------------------------------------------------------
   Replaces Grant_ProjectAdmin.sql, which is for a main database BEFORE the
   cut-over (script 14): it reads dbo.Projects, which no longer exists.

   Since the cut-over there is no project access. A member whose role in the
   company is Admin (or CompanyAdmin) can open every application the company
   has, so making the user Admin of the company is all that is needed.

   FILL IN the two values below, then run. With @MakePlatformAdmin = 1 the user
   also becomes a platform administrator (global role Admin: manages EVERY
   company in Platform Admin). Leave it 0 for an administrator of one company.

   It changes: one row of dbo.CompanyUsers (added or updated) and, only with
   @MakePlatformAdmin = 1, dbo.Users.RoleId of that user. Nothing else.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose. SAFE TO RE-RUN.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Email             NVARCHAR(256) = N'';   -- e-mail of the user, e.g. N'someone@example.com'
DECLARE @CompanyCode       NVARCHAR(50)  = N'';   -- code of the company, e.g. N'C001'
DECLARE @MakePlatformAdmin BIT           = 0;     -- 1 = also a platform administrator (every company)

DECLARE @Role NVARCHAR(100) = N'Admin';
DECLARE @UserId INT, @CompanyId INT, @RoleId INT;

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Companies') IS NULL OR OBJECT_ID('dbo.CompanyUsers') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database before running this script.', 16, 1);
    RETURN;
END

SET @Email       = LTRIM(RTRIM(@Email));
SET @CompanyCode = LTRIM(RTRIM(@CompanyCode));

IF @Email = N'' OR @CompanyCode = N''
BEGIN
    RAISERROR('Fill in @Email and @CompanyCode at the top of the script first. Nothing was changed.', 16, 1);
    RETURN;
END

SELECT @UserId    = UserId    FROM dbo.Users     WHERE Email = @Email AND IsActive = 1;
SELECT @CompanyId = CompanyId FROM dbo.Companies WHERE CompanyCode = @CompanyCode;
SELECT @RoleId    = RoleId    FROM dbo.Roles     WHERE RoleName = @Role;

IF @UserId IS NULL
BEGIN
    RAISERROR('No active user has this e-mail. Nothing was changed.', 16, 1);
    RETURN;
END
IF @CompanyId IS NULL
BEGIN
    RAISERROR('No company has this code. Nothing was changed.', 16, 1);
    RETURN;
END
IF @RoleId IS NULL
BEGIN
    RAISERROR('The role Admin does not exist in dbo.Roles. Nothing was changed.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

/* Administrator of the company */
IF EXISTS (SELECT 1 FROM dbo.CompanyUsers WITH (UPDLOCK, HOLDLOCK) WHERE CompanyId = @CompanyId AND UserId = @UserId)
    UPDATE dbo.CompanyUsers
    SET RoleInCompany = @Role, IsActive = 1
    WHERE CompanyId = @CompanyId AND UserId = @UserId;
ELSE
    INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, IsActive)
    VALUES (@CompanyId, @UserId, @Role, 1);

/* Platform administrator, only when asked for */
IF @MakePlatformAdmin = 1
    UPDATE dbo.Users SET RoleId = @RoleId WHERE UserId = @UserId;

COMMIT TRANSACTION;

/* What it is now */
SELECT u.UserId, u.FullName, u.Email,
       ISNULL(r.RoleName, '') AS GlobalRole,
       c.CompanyName, c.CompanyCode, cu.RoleInCompany, cu.IsActive AS MemberActive,
       c.ProvisionStatus, ISNULL(c.DatabaseName, '') AS DatabaseName
FROM dbo.Users u
INNER JOIN dbo.CompanyUsers cu ON cu.UserId = u.UserId AND cu.CompanyId = @CompanyId
INNER JOIN dbo.Companies c     ON c.CompanyId = cu.CompanyId
LEFT  JOIN dbo.Roles r         ON r.RoleId = u.RoleId
WHERE u.UserId = @UserId;

PRINT 'The user is an administrator of the company. They must log in again to see it.';
