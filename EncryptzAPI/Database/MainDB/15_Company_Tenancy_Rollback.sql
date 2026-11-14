/* =============================================================================
   MainDB · Company-level tenancy · ROLLBACK of 14_Company_Tenancy_Cutover.sql
   -----------------------------------------------------------------------------
   Run with the API STOPPED, then redeploy the previous API and UI.

     1. in ONE transaction: renames Projects_Old, ProjectConnections_Old,
        UserProjectAccess_Old back and, when it renamed at least one of them,
        carries module access back to project access (people whose Service access
        was removed after the cut-over lose project access, people who got it after
        the cut-over receive it) and attaches pending invitations created after the
        cut-over to the company's project. The restore and the carry-back happen
        together or not at all: on an error everything is rolled back, the *_Old
        tables are still there and the script can simply be run again. When the
        tables were already in place, project access is left as it is.
     2. restores the procedures as they were on 2026-10-11

   Still true afterwards: the new columns and tables (13_Company_Tenancy_Schema.sql)
   are left in place (the previous API ignores them). A company created after the
   cut-over has no project row and is not visible to the previous API.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;   -- same session options as the other tenancy scripts
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Companies') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

DECLARE @Restored BIT = 0, @RestoreError NVARCHAR(2048);

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.Projects') IS NULL AND OBJECT_ID('dbo.Projects_Old') IS NOT NULL
    BEGIN
        EXEC sp_rename 'dbo.Projects_Old', 'Projects';
        SET @Restored = 1;
    END
    IF OBJECT_ID('dbo.ProjectConnections') IS NULL AND OBJECT_ID('dbo.ProjectConnections_Old') IS NOT NULL
    BEGIN
        EXEC sp_rename 'dbo.ProjectConnections_Old', 'ProjectConnections';
        SET @Restored = 1;
    END
    IF OBJECT_ID('dbo.UserProjectAccess') IS NULL AND OBJECT_ID('dbo.UserProjectAccess_Old') IS NOT NULL
    BEGIN
        EXEC sp_rename 'dbo.UserProjectAccess_Old', 'UserProjectAccess';
        SET @Restored = 1;
    END

    /* Bring project access in line with module access as it is now, but only when
       this run restored tables: otherwise project access has been maintained by the
       previous API since and must not be overwritten. */
    IF @Restored = 1
       AND OBJECT_ID('dbo.fn_ModuleUsers') IS NOT NULL AND OBJECT_ID('dbo.UserModuleAccess') IS NOT NULL
       AND OBJECT_ID('dbo.Projects') IS NOT NULL AND OBJECT_ID('dbo.UserProjectAccess') IS NOT NULL
    BEGIN
        /* dynamic SQL: nothing here may be compiled before the tables above exist */
        EXEC sp_executesql N'
            /* removed after the cut-over: no project access */
            UPDATE upa SET IsActive = 0
            FROM dbo.UserProjectAccess upa
            INNER JOIN dbo.Projects p ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
            WHERE upa.IsActive = 1
              AND EXISTS (SELECT 1 FROM dbo.CompanyModules cm
                          INNER JOIN dbo.Modules m ON m.ModuleId = cm.ModuleId AND m.ModuleKey = ''SERVICE''
                          WHERE cm.CompanyId = p.CompanyId)   -- no row = never migrated: leave its grants alone
              AND NOT EXISTS (SELECT 1 FROM dbo.fn_ModuleUsers(p.CompanyId, ''SERVICE'') mu WHERE mu.UserId = upa.UserId);

            /* has the module now: project access again */
            UPDATE upa SET IsActive = 1
            FROM dbo.UserProjectAccess upa
            INNER JOIN dbo.Projects p ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
            WHERE upa.IsActive = 0
              AND EXISTS (SELECT 1 FROM dbo.fn_ModuleUsers(p.CompanyId, ''SERVICE'') mu WHERE mu.UserId = upa.UserId);

            /* added after the cut-over: a project access row */
            INSERT INTO dbo.UserProjectAccess (UserId, ProjectId, IsActive, GrantedBy, GrantedAt)
            SELECT mu.UserId, p.ProjectId, 1, NULL, GETDATE()
            FROM dbo.Projects p
            CROSS APPLY dbo.fn_ModuleUsers(p.CompanyId, ''SERVICE'') mu
            WHERE p.IsActive = 1
              AND NOT EXISTS (SELECT 1 FROM dbo.UserProjectAccess x WHERE x.UserId = mu.UserId AND x.ProjectId = p.ProjectId);

            /* invitations created after the cut-over have no project; the old procedures need one */
            UPDATE i SET i.ProjectId = p.ProjectId
            FROM dbo.Invitations i
            INNER JOIN dbo.Projects p ON p.CompanyId = i.CompanyId AND p.IsActive = 1
            WHERE i.ProjectId IS NULL AND i.Status = ''Pending'';';

        PRINT 'Module access carried back to project access.';
    END
    ELSE
        PRINT 'No project tables were restored in this run: project access was left as it is.';

    COMMIT TRANSACTION;

    IF @Restored = 1 PRINT 'Project tables restored.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    SET @RestoreError = ERROR_MESSAGE();
    RAISERROR('Restoring the project tables failed and was rolled back. Run this script again. %s', 16, 1, @RestoreError);
    SET NOEXEC ON;
END CATCH
GO

IF OBJECT_ID('dbo.Projects') IS NULL
   OR OBJECT_ID('dbo.ProjectConnections') IS NULL
   OR OBJECT_ID('dbo.UserProjectAccess') IS NULL
BEGIN
    RAISERROR('dbo.Projects, dbo.ProjectConnections and dbo.UserProjectAccess must all exist (or have a *_Old copy to restore).', 16, 1);
    SET NOEXEC ON;
END
GO



/* ===== sp_Company_AcceptInvitation ===== */
CREATE OR ALTER PROCEDURE dbo.sp_Company_AcceptInvitation
    @Token      UNIQUEIDENTIFIER,
    @UserId     INT,
    @projectId  INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CompanyId INT, @Role NVARCHAR(100), @InvitationProjectId INT,
            @InvitedEmail NVARCHAR(256), @InvitedBy INT;

    BEGIN TRY
        SELECT TOP 1
            @CompanyId = CompanyId,
            @Role = RoleInCompany,
            @InvitationProjectId = ProjectId,
            @InvitedEmail = Email,
            @InvitedBy = InvitedBy
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

        IF NOT EXISTS (SELECT 1 FROM dbo.Projects
                       WHERE ProjectId = @InvitationProjectId AND CompanyId = @CompanyId AND IsActive = 1)
        BEGIN
            SELECT CAST(0 AS INT) AS Success, 'Invitation does not have a valid project assigned' AS Message,
                   @CompanyId AS CompanyId, @Role AS RoleInCompany;
            RETURN;
        END

        /* The project is the invitation's; a different one sent by the client is refused */
        IF ISNULL(@projectId, 0) <> 0 AND @projectId <> @InvitationProjectId
        BEGIN
            SELECT CAST(0 AS INT) AS Success, 'Project does not match the invitation' AS Message,
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

        IF NOT EXISTS (SELECT 1 FROM dbo.UserProjectAccess WHERE UserId = @UserId AND ProjectId = @InvitationProjectId)
            INSERT INTO dbo.UserProjectAccess (UserId, ProjectId, IsActive, GrantedBy, GrantedAt)
            VALUES (@UserId, @InvitationProjectId, 1, @InvitedBy, GETDATE());
        ELSE
            UPDATE dbo.UserProjectAccess
            SET IsActive = 1, GrantedBy = @InvitedBy, GrantedAt = GETDATE()
            WHERE UserId = @UserId AND ProjectId = @InvitationProjectId;

        UPDATE dbo.Invitations
        SET Status = 'Accepted'
        WHERE Token = @Token AND Status = 'Pending';

        COMMIT TRANSACTION;

        SELECT CAST(1 AS INT) AS Success, 'Invitation accepted' AS Message,
               @CompanyId AS CompanyId, @Role AS RoleInCompany;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        SELECT CAST(0 AS INT) AS Success, ERROR_MESSAGE() AS Message,
               CAST(0 AS INT) AS CompanyId, CAST('' AS NVARCHAR(100)) AS RoleInCompany;
    END CATCH
END
GO

/* ===== sp_Company_ApproveRequest ===== */
/* Approval makes the user a member AND lets them into the company's projects
   (the company list at login is driven by project access). */
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

    IF NOT EXISTS (SELECT 1 FROM dbo.Projects WHERE CompanyId = @CompanyId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The company has no active project to give access to' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
        INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
        VALUES (@CompanyId, @UserId, @Role, @ReviewedBy, 1);
    ELSE
        UPDATE dbo.CompanyUsers SET RoleInCompany = @Role, IsActive = 1
        WHERE CompanyId = @CompanyId AND UserId = @UserId;

    UPDATE upa SET upa.IsActive = 1, upa.GrantedBy = @ReviewedBy, upa.GrantedAt = GETDATE()
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects p ON p.ProjectId = upa.ProjectId
    WHERE upa.UserId = @UserId AND p.CompanyId = @CompanyId AND p.IsActive = 1;

    INSERT INTO dbo.UserProjectAccess (UserId, ProjectId, IsActive, GrantedBy, GrantedAt)
    SELECT @UserId, p.ProjectId, 1, @ReviewedBy, GETDATE()
    FROM dbo.Projects p
    WHERE p.CompanyId = @CompanyId AND p.IsActive = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.UserProjectAccess x WHERE x.UserId = @UserId AND x.ProjectId = p.ProjectId);

    UPDATE dbo.JoinRequests SET Status = 'Approved', ReviewedBy = @ReviewedBy WHERE RequestId = @RequestId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Request approved' AS Message;
END
GO

/* ===== sp_Company_CreateTechnicianUser ===== */
/* -----------------------------------------------------------------------------
   sp_Company_CreateTechnicianUser
   Called by the Technicians page ("Add technician"). The technician is a MainDB
   user: reuse the account when the email/mobile is already registered, otherwise
   create it without a password (the technician sets one via Forgot Password).
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Company_CreateTechnicianUser
    @CompanyId    INT,
    @ProjectId    INT,
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

    IF NOT EXISTS (SELECT 1 FROM dbo.Projects WHERE ProjectId = @ProjectId AND CompanyId = @CompanyId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Project does not belong to this company' AS Message, CAST(0 AS INT) AS UserId;
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

        IF NOT EXISTS (SELECT 1 FROM dbo.UserProjectAccess WHERE UserId = @UserId AND ProjectId = @ProjectId)
            INSERT INTO dbo.UserProjectAccess (UserId, ProjectId, IsActive, GrantedBy, GrantedAt)
            VALUES (@UserId, @ProjectId, 1, @CreatedBy, GETDATE());
        ELSE
            UPDATE dbo.UserProjectAccess
            SET IsActive = 1
            WHERE UserId = @UserId AND ProjectId = @ProjectId;

        COMMIT TRANSACTION;

        SELECT CAST(1 AS INT) AS Success, 'Technician user ready' AS Message, @UserId AS UserId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, ERROR_MESSAGE() AS Message, CAST(0 AS INT) AS UserId;
    END CATCH
END
GO

/* ===== sp_Company_GetPendingInvitations ===== */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GetPendingInvitations
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT i.InvitationId, i.Email, i.RoleInCompany, i.Status, i.ExpiresAt, i.CreatedAt,
           ISNULL(u.FullName, 'System') AS CreatedByName,
           ISNULL(i.ProjectId, 0) AS ProjectId, ISNULL(p.ProjectName, '') AS ProjectName
    FROM dbo.Invitations i
    LEFT JOIN dbo.Users u    ON u.UserId = i.InvitedBy
    LEFT JOIN dbo.Projects p ON p.ProjectId = i.ProjectId
    WHERE i.CompanyId = @CompanyId AND i.Status = 'Pending' AND i.ExpiresAt > GETDATE()
    ORDER BY i.CreatedAt DESC;
END
GO

/* ===== sp_Company_InviteUser ===== */
/* =============================================================================
   4. Invitations
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Company_InviteUser
    @CompanyId     INT,
    @Email         NVARCHAR(256),
    @RoleInCompany NVARCHAR(100),
    @InvitedBy     INT,
    @projectID     INT,
    @Remarks       NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewId INT, @UserId INT;

    SET @Email = LTRIM(RTRIM(@Email));

    /* No project sent: only unambiguous when the company has exactly one */
    IF ISNULL(@projectID, 0) = 0
       AND (SELECT COUNT(*) FROM dbo.Projects WHERE CompanyId = @CompanyId AND IsActive = 1) = 1
        SELECT @projectID = ProjectId FROM dbo.Projects WHERE CompanyId = @CompanyId AND IsActive = 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Projects
                   WHERE ProjectId = @projectID AND CompanyId = @CompanyId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Select a project of this company for the invitation' AS Message,
               CAST(0 AS INT) AS InvitationId;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.Invitations
               WHERE CompanyId = @CompanyId AND Email = @Email AND ProjectId = @projectID
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
       AND EXISTS (SELECT 1 FROM dbo.UserProjectAccess
                   WHERE UserId = @UserId AND ProjectId = @projectID AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This user already has access to the project' AS Message,
               CAST(0 AS INT) AS InvitationId;
        RETURN;
    END

    /* Expired leftovers would block a new invitation in the UI lists */
    UPDATE dbo.Invitations SET Status = 'Expired'
    WHERE CompanyId = @CompanyId AND Email = @Email AND Status = 'Pending' AND ExpiresAt <= GETDATE();

    INSERT INTO dbo.Invitations (CompanyId, ProjectId, Email, RoleInCompany, Status, Remarks, InvitedBy, ExpiresAt)
    VALUES (@CompanyId, @projectID, @Email, @RoleInCompany, 'Pending', @Remarks, @InvitedBy,
            DATEADD(DAY, 7, GETDATE()));

    SET @NewId = SCOPE_IDENTITY();

    SELECT CAST(1 AS INT) AS Success, 'Invitation sent' AS Message, @NewId AS InvitationId;
END
GO

/* ===== sp_Company_RemoveUser ===== */
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

    UPDATE upa SET upa.IsActive = 0
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects p ON p.ProjectId = upa.ProjectId
    WHERE upa.UserId = @UserId AND p.CompanyId = @CompanyId;

    UPDATE dbo.UserSessions
    SET SelectedCompanyId = NULL, SelectedProjectId = NULL, SelectedLocationId = NULL
    WHERE UserId = @UserId AND SelectedCompanyId = @CompanyId;

    COMMIT TRANSACTION;

    SELECT @Removed AS RemovedCount;
END
GO

/* ===== sp_Mgmt_SaveUser ===== */
/* Saves the login and, when a company is given, the user's role in that company
   and access to the project the admin is working in. UserId = 0 in the result
   means nothing was saved and Status carries the reason. */
CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_SaveUser
    @UserId       INT,
    @FullName     NVARCHAR(200),
    @Email        NVARCHAR(256),
    @MobileNumber NVARCHAR(20),
    @RoleId       INT,
    @IsActive     BIT,
    @PasswordHash NVARCHAR(200) = NULL,
    @CompanyId    INT = NULL,
    @ProjectId    INT = NULL,
    @SavedBy      INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Status NVARCHAR(100), @RoleName NVARCHAR(100);

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
            INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
            VALUES (@CompanyId, @UserId, @RoleName, @SavedBy, @IsActive);
        ELSE
            UPDATE dbo.CompanyUsers
            SET RoleInCompany = @RoleName, IsActive = @IsActive
            WHERE CompanyId = @CompanyId AND UserId = @UserId;

        IF ISNULL(@ProjectId, 0) > 0
           AND EXISTS (SELECT 1 FROM dbo.Projects WHERE ProjectId = @ProjectId AND CompanyId = @CompanyId)
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.UserProjectAccess WHERE UserId = @UserId AND ProjectId = @ProjectId)
                INSERT INTO dbo.UserProjectAccess (UserId, ProjectId, IsActive, GrantedBy)
                VALUES (@UserId, @ProjectId, @IsActive, @SavedBy);
            ELSE IF @Status = 'Inserted' OR @IsActive = 0
                UPDATE dbo.UserProjectAccess SET IsActive = @IsActive
                WHERE UserId = @UserId AND ProjectId = @ProjectId;
        END
    END

    COMMIT TRANSACTION;

    SELECT @UserId AS UserId, @Status AS Status, @RoleName AS RoleName;
END
GO

/* ===== sp_Platform_GetCompanies ===== */
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

/* ===== sp_Platform_GetProject ===== */
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

/* ===== sp_Platform_GetProjectAccess ===== */
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

/* ===== sp_Platform_GetProjects ===== */
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

/* ===== sp_Platform_SaveProject ===== */
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

/* ===== sp_Platform_SetProjectAccess ===== */
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

/* ===== sp_Project_GetConnection ===== */
/* =============================================================================
   MainDB  ·  Routing + auth stored procedures  (per-project routing)
   -----------------------------------------------------------------------------
   Location procs are NOT here — locations live in each project's DB.
   ============================================================================= */


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

/* ===== sp_Project_GetUsersForSync ===== */
/* =============================================================================
   MainDB  ·  Tenant user sync + technician provisioning
   -----------------------------------------------------------------------------
   Users / roles / company membership / project access are owned by MainDB.
   A project's service DB only keeps a MIRROR of the users that may work in it
   (ProjectDB.dbo.Users.MainUserId -> MainDB.dbo.Users.UserId), which the API
   refreshes through ProjectDB.dbo.sp_Tenant_SyncUsers.

     sp_Project_GetUsersForSync       the users (with company role) of one project
     sp_Company_CreateTechnicianUser  "Add technician" -> creates/links the MainDB
                                      user, company membership and project access

   Run against MainDB. SAFE TO RE-RUN.
   ============================================================================= */

/* -----------------------------------------------------------------------------
   sp_Project_GetUsersForSync
   Table[0]: the project's routing info
   Table[1]: every active user who may enter the project, with the company role
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Project_GetUsersForSync
    @ProjectId INT,
    @UserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.ProjectId, p.ProjectKey, p.CompanyId
    FROM dbo.Projects p
    WHERE p.ProjectId = @ProjectId
      AND p.IsActive  = 1;

    SELECT
        u.UserId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        cu.RoleInCompany
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects p      ON p.ProjectId = upa.ProjectId
    INNER JOIN dbo.CompanyUsers cu ON cu.UserId = upa.UserId AND cu.CompanyId = p.CompanyId AND cu.IsActive = 1
    INNER JOIN dbo.Users u         ON u.UserId = upa.UserId AND u.IsActive = 1
    WHERE upa.ProjectId = @ProjectId
      AND upa.IsActive  = 1
      AND p.IsActive    = 1
            AND (@UserId IS NULL OR u.UserId = @UserId)
    ORDER BY u.UserId;
END
GO

/* ===== sp_User_GetCompanies ===== */
/* Only companies the user is an ACTIVE MEMBER of and has a project in */
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
        cu.RoleInCompany,
        CAST(CASE WHEN us.SelectedCompanyId = c.CompanyId THEN 1 ELSE 0 END AS BIT) AS IsLinked
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects  p ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
    INNER JOIN dbo.Companies c ON c.CompanyId = p.CompanyId   AND c.IsActive = 1
    INNER JOIN dbo.CompanyUsers cu ON cu.CompanyId = c.CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1
    LEFT  JOIN dbo.UserSessions us ON us.UserId = upa.UserId
    WHERE upa.UserId = @UserId
      AND upa.IsActive = 1;
END
GO

/* ===== sp_User_GetCurrentSessionCompany ===== */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetCurrentSessionCompany
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ISNULL(SelectedCompanyId, 0)  AS SelectedCompanyId,
           ISNULL(SelectedProjectId, 0)  AS SelectedProjectId,
           ISNULL(SelectedLocationId, 0) AS SelectedLocationId
    FROM dbo.UserSessions
    WHERE UserId = @UserId;
END
GO

/* ===== sp_User_GetPendingInvitations ===== */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetPendingInvitations
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        i.InvitationId,
        i.CompanyId,
        i.ProjectId,
        c.CompanyName,
        p.ProjectName,
        i.RoleInCompany,
        i.Token,
        i.ExpiresAt,
        ISNULL(u.FullName, 'System') AS InvitedByName
    FROM dbo.Invitations AS i
    INNER JOIN dbo.Companies AS c ON c.CompanyId = i.CompanyId
    INNER JOIN dbo.Projects  AS p ON p.ProjectId = i.ProjectId AND p.CompanyId = i.CompanyId
    LEFT  JOIN dbo.Users     AS u ON u.UserId = i.InvitedBy
    WHERE i.Email = @Email
      AND i.Status = 'Pending'
      AND i.ExpiresAt > GETDATE()
    ORDER BY i.ExpiresAt ASC;
END
GO

/* ===== sp_User_GetProjects ===== */
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

/* ===== sp_User_SelectCompany ===== */
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

/* ===== sp_User_UpdateSession ===== */
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

/* ===== sp_User_ValidateProject ===== */
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


PRINT 'Rollback complete. Redeploy the previous API and UI.';
GO
SET NOEXEC OFF;
GO
