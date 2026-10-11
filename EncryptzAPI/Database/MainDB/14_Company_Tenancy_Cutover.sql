/* =============================================================================
   MainDB · Company-level tenancy · 2 of 2 · CUT-OVER
   -----------------------------------------------------------------------------
   Run during the release, with the API STOPPED, after
   13_Company_Tenancy_Schema.sql.

     1. copies each company's project connection onto its Companies row
     2. turns project access into SERVICE module access
     3. replaces the login / membership / platform procedures
     4. renames Projects, ProjectConnections, UserProjectAccess to *_Old

   It stops WITHOUT changing anything when a company has more than one active
   project or a database is shared by two companies.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose. SAFE TO RE-RUN (after the rename it only refreshes the procedures).
   Undo: 15_Company_Tenancy_Rollback.sql
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;   -- needed by the filtered index and indexed objects this script touches
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
   OR OBJECT_ID('dbo.Companies') IS NULL
   OR OBJECT_ID('dbo.Modules') IS NULL
   OR OBJECT_ID('dbo.CompanyModules') IS NULL
   OR OBJECT_ID('dbo.UserModuleAccess') IS NULL
   OR COL_LENGTH('dbo.Companies', 'TenantKey') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database and run 13_Company_Tenancy_Schema.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

/* a separate batch: dbo.Modules may not exist when the guard above fired */
IF OBJECT_ID('dbo.Modules') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE ModuleKey = 'SERVICE')
BEGIN
    RAISERROR('The SERVICE module is not seeded: run 13_Company_Tenancy_Schema.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   0. Pre-check: the data must already be one company = one database
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Projects') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.Projects WHERE IsActive = 1 GROUP BY CompanyId HAVING COUNT(*) > 1)
    BEGIN
        SELECT 'Company with more than one active project' AS Problem, p.CompanyId, p.ProjectId, p.ProjectName, p.ProjectKey
        FROM dbo.Projects p
        WHERE p.IsActive = 1
          AND p.CompanyId IN (SELECT CompanyId FROM dbo.Projects WHERE IsActive = 1 GROUP BY CompanyId HAVING COUNT(*) > 1);

        RAISERROR('A company has more than one active project. Nothing was changed.', 16, 1);
        SET NOEXEC ON;
    END

    IF EXISTS (SELECT 1
               FROM dbo.ProjectConnections pc
               INNER JOIN dbo.Projects p ON p.ProjectId = pc.ProjectId AND p.IsActive = 1
               WHERE pc.IsActive = 1
               GROUP BY pc.ServerName, pc.DatabaseName
               HAVING COUNT(DISTINCT p.CompanyId) > 1)
    BEGIN
        SELECT 'Database shared by more than one company' AS Problem, pc.ServerName, pc.DatabaseName, p.CompanyId, p.ProjectKey
        FROM dbo.ProjectConnections pc
        INNER JOIN dbo.Projects p ON p.ProjectId = pc.ProjectId AND p.IsActive = 1
        WHERE pc.IsActive = 1;

        RAISERROR('A database is shared by more than one company. Nothing was changed.', 16, 1);
        SET NOEXEC ON;
    END

    IF EXISTS (SELECT 1
               FROM dbo.ProjectConnections pc
               INNER JOIN dbo.Projects p ON p.ProjectId = pc.ProjectId AND p.IsActive = 1
               GROUP BY pc.ProjectId
               HAVING COUNT(*) > 1)
    BEGIN
        SELECT 'Active project with more than one connection row' AS Problem, p.CompanyId, p.ProjectId, p.ProjectKey, pc.ServerName, pc.DatabaseName, pc.IsActive
        FROM dbo.ProjectConnections pc
        INNER JOIN dbo.Projects p ON p.ProjectId = pc.ProjectId AND p.IsActive = 1
        WHERE pc.ProjectId IN (SELECT pc2.ProjectId FROM dbo.ProjectConnections pc2
                               INNER JOIN dbo.Projects p2 ON p2.ProjectId = pc2.ProjectId AND p2.IsActive = 1
                               GROUP BY pc2.ProjectId HAVING COUNT(*) > 1);

        RAISERROR('A project has more than one connection row. Nothing was changed.', 16, 1);
        SET NOEXEC ON;
    END
END
GO

/* -----------------------------------------------------------------------------
   1. Copy connection + access (only while the project tables still exist)
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Projects') IS NOT NULL
BEGIN
    DECLARE @CopyError NVARCHAR(2000);

    BEGIN TRY
    BEGIN TRANSACTION;

    /* 1a. The company's routing key is its project key, so tokens issued before
           the release keep routing to the same database. */
    UPDATE c
    SET c.TenantKey       = p.ProjectKey,
        c.TenantScopeId   = p.ProjectId,
        c.ServerName      = pc.ServerName,
        c.DatabaseName    = pc.DatabaseName,
        c.DbUser          = pc.DbUser,
        c.DbPasswordEnc   = pc.DbPasswordEnc,
        c.ExtraOptions    = pc.ExtraOptions,
        c.ProvisionStatus = CASE WHEN pc.ProjectId IS NOT NULL AND pc.IsActive = 1
                                  AND ISNULL(pc.DbPasswordEnc, '') NOT IN ('', '<ENCRYPTED_PW>')
                                 THEN 'Ready' ELSE 'None' END
    FROM dbo.Companies c
    INNER JOIN dbo.Projects p            ON p.CompanyId = c.CompanyId AND p.IsActive = 1
    LEFT  JOIN dbo.ProjectConnections pc ON pc.ProjectId = p.ProjectId;

    /* 1b. Every company with a database has the Service module */
    INSERT INTO dbo.CompanyModules (CompanyId, ModuleId, IsEnabled)
    SELECT c.CompanyId, m.ModuleId, 1
    FROM dbo.Companies c
    CROSS JOIN dbo.Modules m
    WHERE m.ModuleKey = 'SERVICE'
      AND c.ProvisionStatus = 'Ready'
      AND NOT EXISTS (SELECT 1 FROM dbo.CompanyModules x WHERE x.CompanyId = c.CompanyId AND x.ModuleId = m.ModuleId);

    /* 1c. Whoever could enter the company's project can open the Service module */
    INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy, GrantedAt)
    SELECT p.CompanyId, upa.UserId, m.ModuleId, MAX(g.UserId), MIN(upa.GrantedAt)
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects p      ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
    INNER JOIN dbo.CompanyUsers cu ON cu.CompanyId = p.CompanyId AND cu.UserId = upa.UserId
    LEFT  JOIN dbo.Users g         ON g.UserId = upa.GrantedBy      -- keeps GrantedBy only when that user still exists
    CROSS JOIN dbo.Modules m
    WHERE m.ModuleKey = 'SERVICE'
      AND upa.IsActive = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess x
                      WHERE x.CompanyId = p.CompanyId AND x.UserId = upa.UserId AND x.ModuleId = m.ModuleId)
    GROUP BY p.CompanyId, upa.UserId, m.ModuleId;

    COMMIT TRANSACTION;

    /* 1d. For information only: project grants of people who are not members.
           They could not enter before and cannot enter now. */
    SELECT 'Project grant without company membership (not migrated)' AS Info,
           p.CompanyId, upa.UserId, u.Email
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects p ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
    LEFT  JOIN dbo.Users u    ON u.UserId = upa.UserId
    WHERE upa.IsActive = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers cu WHERE cu.CompanyId = p.CompanyId AND cu.UserId = upa.UserId);

    PRINT 'Connections and access copied to the company level.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @CopyError = ERROR_MESSAGE();
        RAISERROR('The data copy failed and was rolled back. Nothing was renamed. %s', 16, 1, @CopyError);
        SET NOEXEC ON;
    END CATCH
END
ELSE
    PRINT 'Project tables are already renamed: data copy skipped, procedures refreshed.';
GO

/* -----------------------------------------------------------------------------
   1e. Verify the copy before anything is replaced or renamed
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Projects') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1
               FROM dbo.Companies c
               INNER JOIN dbo.Projects p ON p.CompanyId = c.CompanyId AND p.IsActive = 1
               WHERE ISNULL(c.TenantKey, '') <> ISNULL(p.ProjectKey, '')
                  OR c.TenantScopeId <> p.ProjectId)
    BEGIN
        SELECT 'Company routing key / scope differs from its project' AS Problem,
               c.CompanyId, c.TenantKey, p.ProjectKey, c.TenantScopeId, p.ProjectId
        FROM dbo.Companies c
        INNER JOIN dbo.Projects p ON p.CompanyId = c.CompanyId AND p.IsActive = 1
        WHERE ISNULL(c.TenantKey, '') <> ISNULL(p.ProjectKey, '')
           OR c.TenantScopeId <> p.ProjectId;

        RAISERROR('The copied data does not match the project tables. Nothing was renamed.', 16, 1);
        SET NOEXEC ON;
    END

    IF EXISTS (SELECT 1
               FROM dbo.UserProjectAccess upa
               INNER JOIN dbo.Projects p      ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
               INNER JOIN dbo.CompanyUsers cu ON cu.CompanyId = p.CompanyId AND cu.UserId = upa.UserId
               CROSS JOIN dbo.Modules m
               WHERE m.ModuleKey = 'SERVICE'
                 AND upa.IsActive = 1
                 AND NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess x
                                 WHERE x.CompanyId = p.CompanyId AND x.UserId = upa.UserId AND x.ModuleId = m.ModuleId))
    BEGIN
        SELECT 'Project access without Service module access' AS Problem,
               p.CompanyId, upa.UserId, p.ProjectId
        FROM dbo.UserProjectAccess upa
        INNER JOIN dbo.Projects p      ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
        INNER JOIN dbo.CompanyUsers cu ON cu.CompanyId = p.CompanyId AND cu.UserId = upa.UserId
        CROSS JOIN dbo.Modules m
        WHERE m.ModuleKey = 'SERVICE'
          AND upa.IsActive = 1
          AND NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess x
                          WHERE x.CompanyId = p.CompanyId AND x.UserId = upa.UserId AND x.ModuleId = m.ModuleId);

        RAISERROR('The copied data does not match the project tables. Nothing was renamed.', 16, 1);
        SET NOEXEC ON;
    END
END
GO

/* =============================================================================
   2. Routing + login
   ============================================================================= */

/* Members who may open a module of a company: the company has it, and the member
   is a company administrator or was granted it. Same rule as
   EncryptzBL.Common.Tenant.ModuleAccess — change both together. */
CREATE OR ALTER FUNCTION dbo.fn_ModuleUsers (@CompanyId INT, @ModuleKey NVARCHAR(50))
RETURNS TABLE
AS
RETURN
    SELECT cu.UserId, cu.RoleInCompany
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Modules m         ON m.ModuleKey = @ModuleKey AND m.IsActive = 1
    INNER JOIN dbo.CompanyModules cm ON cm.CompanyId = cu.CompanyId AND cm.ModuleId = m.ModuleId AND cm.IsEnabled = 1
    WHERE cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
      AND (   LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin')
           OR EXISTS (SELECT 1 FROM dbo.UserModuleAccess uma
                      WHERE uma.CompanyId = cu.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId));
GO

/* Used by IConnectionResolver: the registry row of a tenant key.
   Only an active company whose database is Ready is routable. */
CREATE OR ALTER PROCEDURE dbo.sp_Tenant_GetConnection
    @TenantKey NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        c.CompanyId, c.CompanyName, c.TenantKey, c.TenantScopeId,
        c.ServerName, c.DatabaseName, c.DbUser, c.DbPasswordEnc, c.ExtraOptions
    FROM dbo.Companies c
    WHERE c.TenantKey = @TenantKey
      AND c.IsActive = 1
      AND c.ProvisionStatus = 'Ready';
END
GO

/* Companies the user is an ACTIVE MEMBER of (a company whose database is not
   ready yet is listed too, with its status). */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetCompanies
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.CompanyId, c.CompanyName, c.CompanyCode, c.Address, c.City, c.PhoneNumber,
        cu.RoleInCompany,
        CAST(CASE WHEN us.SelectedCompanyId = c.CompanyId THEN 1 ELSE 0 END AS BIT) AS IsLinked,
        c.ProvisionStatus
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Companies c     ON c.CompanyId = cu.CompanyId AND c.IsActive = 1
    LEFT  JOIN dbo.UserSessions us ON us.UserId = cu.UserId
    WHERE cu.UserId = @UserId
      AND cu.IsActive = 1
    ORDER BY c.CompanyName;
END
GO

/* The whole catalogue, with what the API needs to decide each module's state.
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
        ISNULL(cu.RoleInCompany, '')                                  AS RoleInCompany
    FROM dbo.Modules m
    LEFT JOIN dbo.CompanyModules cm    ON cm.ModuleId = m.ModuleId AND cm.CompanyId = @CompanyId
    LEFT JOIN dbo.UserModuleAccess uma ON uma.ModuleId = m.ModuleId AND uma.CompanyId = @CompanyId AND uma.UserId = @UserId
    LEFT JOIN dbo.CompanyUsers cu      ON cu.CompanyId = @CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* One row when the user is an active member of an active company and the module
   exists; the API decides from the flags. No row = not a member / unknown module. */
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
        CAST(CASE WHEN uma.UserId IS NULL THEN 0 ELSE 1 END AS BIT) AS UserGranted
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Companies c         ON c.CompanyId = cu.CompanyId AND c.IsActive = 1
    INNER JOIN dbo.Modules m           ON m.ModuleKey = @ModuleKey AND m.IsActive = 1
    LEFT  JOIN dbo.CompanyModules cm   ON cm.CompanyId = c.CompanyId AND cm.ModuleId = m.ModuleId
    LEFT  JOIN dbo.UserModuleAccess uma ON uma.CompanyId = c.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1;
END
GO

/* Persist the current company / branch + token. @ProjectId is accepted and
   ignored (projects no longer exist). */
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
                   SelectedProjectId = NULL,
                   SelectedLocationId = @LocationId,
                   AuthToken = @AuthToken,
                   UpdatedAt = GETDATE()
    WHEN NOT MATCHED THEN
        INSERT (UserId, SelectedCompanyId, SelectedProjectId, SelectedLocationId, AuthToken)
        VALUES (@UserId, @CompanyId, NULL, @LocationId, @AuthToken);
END
GO

/* Menus of the user's role in the company, limited to one module when given,
   plus the parent of every granted child (the sidebar flattens a child whose
   parent is missing). */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetMenusForCompany
    @UserId    INT,
    @CompanyId INT,
    @ModuleKey NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleId INT, @ModuleId INT;

    SELECT @RoleId = r.RoleId
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Roles r ON r.RoleName = cu.RoleInCompany
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1;

    IF NULLIF(@ModuleKey, '') IS NOT NULL
        SELECT @ModuleId = ModuleId FROM dbo.Modules WHERE ModuleKey = @ModuleKey;

    ;WITH Granted AS
    (
        SELECT m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, m.SortOrder,
               rma.CanView, rma.CanCreate, rma.CanEdit, rma.CanDelete
        FROM dbo.MenuItems m
        INNER JOIN dbo.RoleMenuAccess rma
                ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId AND rma.CanView = 1
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

/* The company's routing info and the users the tenant DB must mirror:
   every active user who may open the Service module. */
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
      AND c.ProvisionStatus = 'Ready';

    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber, mu.RoleInCompany
    FROM dbo.fn_ModuleUsers(@CompanyId, 'SERVICE') mu
    INNER JOIN dbo.Users u ON u.UserId = mu.UserId AND u.IsActive = 1
    WHERE @UserId IS NULL OR u.UserId = @UserId
    ORDER BY u.UserId;
END
GO

/* =============================================================================
   3. Membership: invitations, join requests, users, technicians
   ============================================================================= */

/* Gives a member every module the company has that they do not have yet. */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GrantDefaultModules
    @CompanyId INT,
    @UserId    INT,
    @GrantedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
    SELECT cm.CompanyId, @UserId, cm.ModuleId, @GrantedBy
    FROM dbo.CompanyModules cm
    WHERE cm.CompanyId = @CompanyId
      AND cm.IsEnabled = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess x
                      WHERE x.CompanyId = cm.CompanyId AND x.UserId = @UserId AND x.ModuleId = cm.ModuleId);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_InviteUser
    @CompanyId     INT,
    @Email         NVARCHAR(256),
    @RoleInCompany NVARCHAR(100),
    @InvitedBy     INT,
    @Remarks       NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewId INT, @UserId INT;

    SET @Email = LTRIM(RTRIM(@Email));

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message, CAST(0 AS INT) AS InvitationId;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.Invitations
               WHERE CompanyId = @CompanyId AND Email = @Email
                 AND Status = 'Pending' AND ExpiresAt > GETDATE())
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'An invitation is already pending for this email' AS Message,
               CAST(0 AS INT) AS InvitationId;
        RETURN;
    END

    SELECT @UserId = UserId FROM dbo.Users WHERE Email = @Email;

    IF @UserId IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.CompanyUsers
                   WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This user is already a member of the company' AS Message,
               CAST(0 AS INT) AS InvitationId;
        RETURN;
    END

    /* Expired leftovers would block a new invitation in the UI lists */
    UPDATE dbo.Invitations SET Status = 'Expired'
    WHERE CompanyId = @CompanyId AND Email = @Email AND Status = 'Pending' AND ExpiresAt <= GETDATE();

    INSERT INTO dbo.Invitations (CompanyId, Email, RoleInCompany, Status, Remarks, InvitedBy, ExpiresAt)
    VALUES (@CompanyId, @Email, @RoleInCompany, 'Pending', @Remarks, @InvitedBy, DATEADD(DAY, 7, GETDATE()));

    SET @NewId = SCOPE_IDENTITY();

    SELECT CAST(1 AS INT) AS Success, 'Invitation sent' AS Message, @NewId AS InvitationId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_AcceptInvitation
    @Token  UNIQUEIDENTIFIER,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CompanyId INT, @Role NVARCHAR(100), @InvitedEmail NVARCHAR(256), @InvitedBy INT;

    BEGIN TRY
        SELECT TOP 1
            @CompanyId = CompanyId, @Role = RoleInCompany,
            @InvitedEmail = Email, @InvitedBy = InvitedBy
        FROM dbo.Invitations
        WHERE Token = @Token
          AND Status = 'Pending'
          AND ExpiresAt > GETDATE();

        IF @CompanyId IS NULL
        BEGIN
            SELECT CAST(0 AS INT) AS Success, 'Invitation invalid or expired' AS Message,
                   CAST(0 AS INT) AS CompanyId, CAST('' AS NVARCHAR(100)) AS RoleInCompany;
            RETURN;
        END

        /* Only the invited person may accept */
        IF NOT EXISTS (SELECT 1 FROM dbo.Users
                       WHERE UserId = @UserId AND IsActive = 1 AND Email = @InvitedEmail)
        BEGIN
            SELECT CAST(0 AS INT) AS Success, 'This invitation was sent to a different email' AS Message,
                   @CompanyId AS CompanyId, @Role AS RoleInCompany;
            RETURN;
        END

        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
            INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
            VALUES (@CompanyId, @UserId, @Role, @InvitedBy, 1);
        ELSE
            UPDATE dbo.CompanyUsers
            SET RoleInCompany = @Role, IsActive = 1
            WHERE CompanyId = @CompanyId AND UserId = @UserId;

        EXEC dbo.sp_Company_GrantDefaultModules @CompanyId = @CompanyId, @UserId = @UserId, @GrantedBy = @InvitedBy;

        UPDATE dbo.Invitations
        SET Status = 'Accepted'
        WHERE Token = @Token AND Status = 'Pending';

        COMMIT TRANSACTION;

        SELECT CAST(1 AS INT) AS Success, 'Invitation accepted' AS Message,
               @CompanyId AS CompanyId, @Role AS RoleInCompany;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        SELECT CAST(0 AS INT) AS Success, 'Could not accept the invitation' AS Message,
               CAST(0 AS INT) AS CompanyId, CAST('' AS NVARCHAR(100)) AS RoleInCompany;
    END CATCH
END
GO

/* ProjectId / ProjectName stay in the result (0 / '') for the deployed UI. */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GetPendingInvitations
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT i.InvitationId, i.Email, i.RoleInCompany, i.Status, i.ExpiresAt, i.CreatedAt,
           ISNULL(u.FullName, 'System') AS CreatedByName,
           CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(200)) AS ProjectName
    FROM dbo.Invitations i
    LEFT JOIN dbo.Users u ON u.UserId = i.InvitedBy
    WHERE i.CompanyId = @CompanyId AND i.Status = 'Pending' AND i.ExpiresAt > GETDATE()
    ORDER BY i.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_GetPendingInvitations
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        i.InvitationId, i.CompanyId,
        CAST(0 AS INT) AS ProjectId,
        c.CompanyName,
        CAST('' AS NVARCHAR(200)) AS ProjectName,
        i.RoleInCompany, i.Token, i.ExpiresAt,
        ISNULL(u.FullName, 'System') AS InvitedByName
    FROM dbo.Invitations AS i
    INNER JOIN dbo.Companies AS c ON c.CompanyId = i.CompanyId AND c.IsActive = 1
    LEFT  JOIN dbo.Users     AS u ON u.UserId = i.InvitedBy
    WHERE i.Email = @Email
      AND i.Status = 'Pending'
      AND i.ExpiresAt > GETDATE()
    ORDER BY i.ExpiresAt ASC;
END
GO

/* Approval makes the user a member and gives them the company's modules. */
CREATE OR ALTER PROCEDURE dbo.sp_Company_ApproveRequest
    @RequestId  INT,
    @CompanyId  INT,
    @ReviewedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UserId INT, @Role NVARCHAR(100);
    SELECT @UserId = UserId, @Role = RequestedRole
    FROM dbo.JoinRequests
    WHERE RequestId = @RequestId AND CompanyId = @CompanyId AND Status = 'Pending';

    IF @UserId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Request not found or already handled' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
        INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
        VALUES (@CompanyId, @UserId, @Role, @ReviewedBy, 1);
    ELSE
        UPDATE dbo.CompanyUsers SET RoleInCompany = @Role, IsActive = 1
        WHERE CompanyId = @CompanyId AND UserId = @UserId;

    EXEC dbo.sp_Company_GrantDefaultModules @CompanyId = @CompanyId, @UserId = @UserId, @GrantedBy = @ReviewedBy;

    UPDATE dbo.JoinRequests SET Status = 'Approved', ReviewedBy = @ReviewedBy WHERE RequestId = @RequestId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Request approved' AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_RemoveUser
    @CompanyId INT,
    @UserId    INT,
    @RemovedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Removed INT;

    IF @UserId = @RemovedBy
    BEGIN
        SELECT CAST(0 AS INT) AS RemovedCount;   -- an admin cannot remove themselves
        RETURN;
    END

    BEGIN TRANSACTION;

    UPDATE dbo.CompanyUsers SET IsActive = 0
    WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1;
    SET @Removed = @@ROWCOUNT;

    DELETE FROM dbo.UserModuleAccess
    WHERE CompanyId = @CompanyId AND UserId = @UserId;

    UPDATE dbo.UserSessions
    SET SelectedCompanyId = NULL, SelectedProjectId = NULL, SelectedLocationId = NULL
    WHERE UserId = @UserId AND SelectedCompanyId = @CompanyId;

    COMMIT TRANSACTION;

    SELECT @Removed AS RemovedCount;
END
GO

/* Called by the Technicians page ("Add technician"). The technician is a MainDB
   user: reuse the account when the email is already registered, otherwise create
   it without a password (the technician sets one via Forgot Password). */
CREATE OR ALTER PROCEDURE dbo.sp_Company_CreateTechnicianUser
    @CompanyId    INT,
    @FullName     NVARCHAR(200),
    @Email        NVARCHAR(256),
    @MobileNumber NVARCHAR(20),
    @CreatedBy    INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UserId INT, @ExistingRole NVARCHAR(100);

    IF NULLIF(LTRIM(RTRIM(@Email)), '') IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email is required to create a technician login' AS Message, CAST(0 AS INT) AS UserId;
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message, CAST(0 AS INT) AS UserId;
        RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT TOP 1 @UserId = UserId FROM dbo.Users WHERE Email = @Email;

        IF @UserId IS NULL AND NULLIF(LTRIM(RTRIM(@MobileNumber)), '') IS NOT NULL
        BEGIN
            IF EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber)
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT CAST(0 AS INT) AS Success, 'Mobile number is already registered with a different email' AS Message, CAST(0 AS INT) AS UserId;
                RETURN;
            END
        END

        IF @UserId IS NULL
        BEGIN
            INSERT INTO dbo.Users (FullName, Email, MobileNumber, PasswordHash, RoleId, IsActive)
            VALUES (@FullName, @Email, NULLIF(LTRIM(RTRIM(@MobileNumber)), ''), NULL,
                    (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleName = 'Technician'), 1);

            SET @UserId = SCOPE_IDENTITY();
        END

        SELECT @ExistingRole = RoleInCompany
        FROM dbo.CompanyUsers
        WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1;

        IF @ExistingRole IS NOT NULL AND @ExistingRole <> 'Technician'
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success,
                   'This user is already a ' + @ExistingRole + ' in the company. Change the role from User Management instead.' AS Message,
                   CAST(0 AS INT) AS UserId;
            RETURN;
        END

        IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
            INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
            VALUES (@CompanyId, @UserId, 'Technician', @CreatedBy, 1);
        ELSE
            UPDATE dbo.CompanyUsers
            SET RoleInCompany = 'Technician', IsActive = 1
            WHERE CompanyId = @CompanyId AND UserId = @UserId;

        /* A technician works in the Service module */
        INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
        SELECT @CompanyId, @UserId, m.ModuleId, @CreatedBy
        FROM dbo.Modules m
        WHERE m.ModuleKey = 'SERVICE'
          AND NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess x
                          WHERE x.CompanyId = @CompanyId AND x.UserId = @UserId AND x.ModuleId = m.ModuleId);

        COMMIT TRANSACTION;

        SELECT CAST(1 AS INT) AS Success, 'Technician user ready' AS Message, @UserId AS UserId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Could not create the technician user' AS Message, CAST(0 AS INT) AS UserId;
    END CATCH
END
GO

/* Saves the login and, when a company is given, the user's role in that company.
   A member added here gets the company's modules; a member saved as inactive loses
   their module access (reactivating does not restore it). UserId = 0 in the result means
   nothing was saved and Status carries the reason. */
CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_SaveUser
    @UserId       INT,
    @FullName     NVARCHAR(200),
    @Email        NVARCHAR(256),
    @MobileNumber NVARCHAR(20),
    @RoleId       INT,
    @IsActive     BIT,
    @PasswordHash NVARCHAR(200) = NULL,
    @CompanyId    INT = NULL,
    @SavedBy      INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Status NVARCHAR(100), @RoleName NVARCHAR(100), @NewMember BIT = 0;

    SET @UserId       = ISNULL(@UserId, 0);
    SET @MobileNumber = NULLIF(LTRIM(RTRIM(@MobileNumber)), '');
    SELECT @RoleName = RoleName FROM dbo.Roles WHERE RoleId = @RoleId;

    IF NULLIF(LTRIM(RTRIM(@Email)), '') IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS UserId, 'Email is required' AS Status, CAST('' AS NVARCHAR(100)) AS RoleName; RETURN;
    END
    IF @RoleName IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS UserId, 'Role not found' AS Status, CAST('' AS NVARCHAR(100)) AS RoleName; RETURN;
    END
    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email AND UserId <> @UserId)
    BEGIN
        SELECT CAST(0 AS INT) AS UserId, 'Email already registered' AS Status, @RoleName AS RoleName; RETURN;
    END
    IF @MobileNumber IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber AND UserId <> @UserId)
    BEGIN
        SELECT CAST(0 AS INT) AS UserId, 'Mobile number already registered' AS Status, @RoleName AS RoleName; RETURN;
    END
    /* A company admin may only edit members of the own company */
    IF @UserId > 0 AND ISNULL(@CompanyId, 0) > 0
       AND NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
    BEGIN
        SELECT CAST(0 AS INT) AS UserId, 'User does not belong to this company' AS Status, @RoleName AS RoleName; RETURN;
    END

    BEGIN TRANSACTION;

    IF @UserId = 0
    BEGIN
        INSERT INTO dbo.Users (FullName, Email, MobileNumber, RoleId, IsActive, PasswordHash)
        VALUES (@FullName, @Email, @MobileNumber, @RoleId, @IsActive, @PasswordHash);
        SET @UserId = SCOPE_IDENTITY();
        SET @Status = 'Inserted';
    END
    ELSE
    BEGIN
        UPDATE dbo.Users
        SET FullName = @FullName, Email = @Email, MobileNumber = @MobileNumber,
            IsActive = @IsActive,
            -- the global role is only changed from the platform (no company) context
            RoleId = CASE WHEN ISNULL(@CompanyId, 0) = 0 THEN @RoleId ELSE ISNULL(RoleId, @RoleId) END,
            PasswordHash = CASE WHEN @PasswordHash IS NULL THEN PasswordHash ELSE @PasswordHash END
        WHERE UserId = @UserId;
        SET @Status = 'Updated';
    END

    IF ISNULL(@CompanyId, 0) > 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
        BEGIN
            INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
            VALUES (@CompanyId, @UserId, @RoleName, @SavedBy, @IsActive);
            SET @NewMember = 1;
        END
        ELSE
            UPDATE dbo.CompanyUsers
            SET RoleInCompany = @RoleName, IsActive = @IsActive
            WHERE CompanyId = @CompanyId AND UserId = @UserId;

        /* A deactivated member loses module access. Reactivating does not give it
           back: an administrator grants it again, as it was with project access. */
        IF @IsActive = 0
            DELETE FROM dbo.UserModuleAccess WHERE CompanyId = @CompanyId AND UserId = @UserId;

        /* Only a NEW member gets the modules: an administrator may have taken a
           module away from an existing member on purpose. */
        IF @NewMember = 1
            EXEC dbo.sp_Company_GrantDefaultModules @CompanyId = @CompanyId, @UserId = @UserId, @GrantedBy = @SavedBy;
    END

    COMMIT TRANSACTION;

    SELECT @UserId AS UserId, @Status AS Status, @RoleName AS RoleName;
END
GO

/* =============================================================================
   4. Platform administration
      The procedure and column names still say "project": the deployed Platform
      Admin screen reads them. A "project" is now the company's Service database
      and its id is the CompanyId.
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
        CASE WHEN c.ProvisionStatus = 'None' THEN 0 ELSE 1 END AS ProjectCount,
        (SELECT COUNT(*) FROM dbo.CompanyUsers cu WHERE cu.CompanyId = c.CompanyId AND cu.IsActive = 1) AS UserCount
    FROM dbo.Companies c
    WHERE ISNULL(@CompanyId, 0) = 0 OR c.CompanyId = @CompanyId
    ORDER BY c.CompanyName;
END
GO

/* @ProjectId is a CompanyId */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetProject
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.CompanyId AS ProjectId, c.CompanyId,
           CAST('Service Management' AS NVARCHAR(200)) AS ProjectName,
           ISNULL(c.TenantKey, '') AS ProjectKey,
           c.IsActive, c.TenantScopeId
    FROM dbo.Companies c
    WHERE c.CompanyId = @ProjectId;
END
GO

/* One row per company that has a database
   (the password is never returned; HasPassword tells whether one is stored). */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetProjects
    @CompanyId INT = NULL          -- NULL/0 = all (platform admin)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.CompanyId AS ProjectId, c.CompanyId, c.CompanyName,
        CAST('Service Management' AS NVARCHAR(200)) AS ProjectName,
        ISNULL(c.TenantKey, '') AS ProjectKey,
        /* "project active" is what sp_Platform_SaveProject stores as the database status */
        CAST(CASE WHEN c.ProvisionStatus = 'Ready' THEN 1 ELSE 0 END AS BIT) AS IsActive,
        c.CreatedAt,
        ISNULL(c.ServerName, '')   AS ServerName,
        ISNULL(c.DatabaseName, '') AS DatabaseName,
        ISNULL(c.DbUser, '')       AS DbUser,
        ISNULL(c.ExtraOptions, '') AS ExtraOptions,
        CAST(CASE WHEN ISNULL(c.DbPasswordEnc, '') IN ('', '<ENCRYPTED_PW>') THEN 0 ELSE 1 END AS BIT) AS HasPassword,
        CAST(CASE WHEN c.ProvisionStatus = 'Ready' THEN 1 ELSE 0 END AS BIT) AS ConnectionActive,
        (SELECT COUNT(*) FROM dbo.fn_ModuleUsers(c.CompanyId, 'SERVICE')) AS UserCount
    FROM dbo.Companies c
    WHERE (ISNULL(@CompanyId, 0) = 0 OR c.CompanyId = @CompanyId)
      AND c.ProvisionStatus <> 'None'
    ORDER BY c.CompanyName;
END
GO

/* Attaches / changes the database of a company.
   @ProjectId is ignored (the company is the key). @ProjectKey sets the routing
   key only while the company has none: a key in use must stay stable.
   @DbPasswordEnc NULL = keep the stored password.
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

    DECLARE @CurrentKey NVARCHAR(50), @Message NVARCHAR(200), @HadDatabase BIT;

    SET @ProjectKey   = UPPER(LTRIM(RTRIM(ISNULL(@ProjectKey, ''))));
    SET @ServerName   = LTRIM(RTRIM(ISNULL(@ServerName, '')));
    SET @DatabaseName = LTRIM(RTRIM(ISNULL(@DatabaseName, '')));
    SET @DbUser       = LTRIM(RTRIM(ISNULL(@DbUser, '')));
    SET @ExtraOptions = NULLIF(LTRIM(RTRIM(ISNULL(@ExtraOptions, ''))), '');
    SET @DbPasswordEnc = NULLIF(@DbPasswordEnc, '');

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END

    SELECT @CurrentKey = NULLIF(TenantKey, ''),
           @HadDatabase = CASE WHEN ProvisionStatus = 'None' THEN 0 ELSE 1 END
    FROM dbo.Companies WHERE CompanyId = @CompanyId;

    IF @CurrentKey IS NULL AND @ProjectKey = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'A key is required' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF @ServerName = '' OR @DatabaseName = '' OR @DbUser = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Server, database and database user are required' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF @CurrentKey IS NULL
       AND EXISTS (SELECT 1 FROM dbo.Companies WHERE TenantKey = @ProjectKey AND CompanyId <> @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The key is already used' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF EXISTS (SELECT 1 FROM dbo.Companies
               WHERE CompanyId <> @CompanyId AND ServerName = @ServerName AND DatabaseName = @DatabaseName)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This database already belongs to another company' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF @DbPasswordEnc IS NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.Companies
                       WHERE CompanyId = @CompanyId AND ISNULL(DbPasswordEnc, '') NOT IN ('', '<ENCRYPTED_PW>'))
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Database password is required' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END

    BEGIN TRANSACTION;

    UPDATE dbo.Companies
    SET TenantKey       = ISNULL(@CurrentKey, @ProjectKey),
        ServerName      = @ServerName,
        DatabaseName    = @DatabaseName,
        DbUser          = @DbUser,
        DbPasswordEnc   = ISNULL(@DbPasswordEnc, DbPasswordEnc),
        ExtraOptions    = @ExtraOptions,
        ProvisionStatus = CASE WHEN ISNULL(@IsActive, 1) = 1 THEN 'Ready' ELSE 'Failed' END
    WHERE CompanyId = @CompanyId;

    SET @Message = CASE WHEN @HadDatabase = 1 THEN 'Database updated' ELSE 'Database attached' END;

    /* a company with a database has the Service module (idempotent) */
    INSERT INTO dbo.CompanyModules (CompanyId, ModuleId, IsEnabled)
    SELECT @CompanyId, m.ModuleId, 1
    FROM dbo.Modules m
    WHERE m.ModuleKey = 'SERVICE'
      AND NOT EXISTS (SELECT 1 FROM dbo.CompanyModules x WHERE x.CompanyId = @CompanyId AND x.ModuleId = m.ModuleId);

    IF @HadDatabase = 0
    BEGIN
        /* whoever attaches it can enter it */
        IF @SavedBy IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @SavedBy)
           AND NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @SavedBy)
            INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
            VALUES (@CompanyId, @SavedBy, 'Admin', @SavedBy, 1);
    END

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, @Message AS Message, @CompanyId AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey;
END
GO

/* The company's members, with whether they may open the Service module.
   @ProjectId is a CompanyId. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetProjectAccess
    @ProjectId INT
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
    INNER JOIN dbo.Users u    ON u.UserId = cu.UserId AND u.IsActive = 1
    LEFT  JOIN dbo.Modules m  ON m.ModuleKey = 'SERVICE'
    LEFT  JOIN dbo.UserModuleAccess uma ON uma.CompanyId = cu.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId
    LEFT  JOIN dbo.Users gb   ON gb.UserId = uma.GrantedBy
    WHERE cu.CompanyId = @ProjectId
      AND cu.IsActive = 1
    ORDER BY u.FullName;
END
GO

/* @ProjectId is a CompanyId */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SetProjectAccess
    @ProjectId INT,
    @UserId    INT,
    @HasAccess BIT,
    @GrantedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Role NVARCHAR(100), @ModuleId INT;

    SELECT @Role = RoleInCompany
    FROM dbo.CompanyUsers
    WHERE CompanyId = @ProjectId AND UserId = @UserId AND IsActive = 1;

    IF @Role IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The user is not an active member of the company' AS Message; RETURN;
    END

    IF @HasAccess = 0 AND @UserId = @GrantedBy
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You cannot remove your own access' AS Message; RETURN;
    END

    IF @HasAccess = 0 AND LTRIM(RTRIM(@Role)) IN ('Admin', 'CompanyAdmin')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company administrators always have access. Change the role instead.' AS Message; RETURN;
    END

    SELECT @ModuleId = ModuleId FROM dbo.Modules WHERE ModuleKey = 'SERVICE';

    IF @ModuleId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The Service module is not set up' AS Message; RETURN;
    END

    IF @HasAccess = 1
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess WHERE CompanyId = @ProjectId AND UserId = @UserId AND ModuleId = @ModuleId)
            INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
            VALUES (@ProjectId, @UserId, @ModuleId, @GrantedBy);
    END
    ELSE
        DELETE FROM dbo.UserModuleAccess
        WHERE CompanyId = @ProjectId AND UserId = @UserId AND ModuleId = @ModuleId;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @HasAccess = 1 THEN 'Access granted' ELSE 'Access removed' END AS Message;
END
GO

/* =============================================================================
   5. Retire the project tables (kept as *_Old for the rollback script)
   ============================================================================= */
IF OBJECT_ID('dbo.Projects') IS NOT NULL
BEGIN
    DECLARE @RenameError NVARCHAR(2000);

    BEGIN TRY
        BEGIN TRANSACTION;

        /* UserSessions.SelectedProjectId no longer points anywhere. The foreign key
           UserSessions -> Projects is left alone: it follows the renamed table, and
           NULL satisfies it. */
        UPDATE dbo.UserSessions SET SelectedProjectId = NULL WHERE SelectedProjectId IS NOT NULL;

        EXEC sp_rename 'dbo.UserProjectAccess',  'UserProjectAccess_Old';
        EXEC sp_rename 'dbo.ProjectConnections', 'ProjectConnections_Old';
        EXEC sp_rename 'dbo.Projects',           'Projects_Old';

        COMMIT TRANSACTION;

        PRINT 'Projects, ProjectConnections and UserProjectAccess renamed to *_Old.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @RenameError = ERROR_MESSAGE();
        RAISERROR('Renaming the project tables failed and was rolled back. Run this script again. %s', 16, 1, @RenameError);
        SET NOEXEC ON;
    END CATCH
END
GO

/* The procedures below read the renamed tables and are no longer called. They are
   dropped only once the tables are really renamed. */
IF OBJECT_ID('dbo.Projects') IS NULL AND OBJECT_ID('dbo.Projects_Old') IS NOT NULL
BEGIN
    DROP PROCEDURE IF EXISTS dbo.sp_Project_GetConnection;
    DROP PROCEDURE IF EXISTS dbo.sp_Project_GetUsersForSync;
    DROP PROCEDURE IF EXISTS dbo.sp_User_GetProjects;
    DROP PROCEDURE IF EXISTS dbo.sp_User_ValidateProject;
END
GO

SELECT CompanyId, CompanyName, CompanyCode, TenantKey, TenantScopeId, DatabaseName, ProvisionStatus,
       (SELECT COUNT(*) FROM dbo.fn_ModuleUsers(c.CompanyId, 'SERVICE')) AS ServiceUsers
FROM dbo.Companies c
ORDER BY CompanyId;

PRINT 'Company-level tenancy cut-over complete.';
GO
SET NOEXEC OFF;
GO
