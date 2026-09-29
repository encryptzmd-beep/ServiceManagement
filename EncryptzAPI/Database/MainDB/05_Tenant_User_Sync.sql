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
    @ProjectId INT
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
    ORDER BY u.UserId;
END
GO

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

PRINT 'MainDB tenant user sync procs applied.';
GO
