/* =============================================================================
   MainDB  ·  Control-plane procs brought in line with what the UI needs
   -----------------------------------------------------------------------------
   Fixes found by checking every AuthService / Auth+Company controller call
   against the deployed MainDB procs and the Angular screens:

     1. Otp            login OTP and password-reset OTP separated (Purpose/Email),
                       expiry computed on the SQL clock
     2. Login / menus  menus result set on login, parent menus of granted children
     3. Users          company-scoped user list, save with duplicate checks +
                       company role + project access
     4. Invitations    project must belong to the company, only the invited
                       email may accept/reject, NULL-safe lists
     5. Join requests  approval grants project access, "already a member" check,
                       status names the UI tests for
     6. Membership     removed users lose project access and drop out of lists

   Run against MainDB. SAFE TO RE-RUN.
   ============================================================================= */

/* =============================================================================
   1. OTP
   ============================================================================= */
IF COL_LENGTH('dbo.Otp', 'Purpose') IS NULL
    ALTER TABLE dbo.Otp ADD Purpose NVARCHAR(20) NOT NULL CONSTRAINT DF_Otp_Purpose DEFAULT ('Login');
GO
IF COL_LENGTH('dbo.Otp', 'Email') IS NULL
    ALTER TABLE dbo.Otp ADD Email NVARCHAR(256) NULL;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Auth_GenerateOtp
    @MobileNumber NVARCHAR(20),
    @OtpCode      NVARCHAR(10),
    @ExpiresAt    DATETIME = NULL      -- ignored: expiry is set on the SQL clock it is checked against
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Otp (MobileNumber, OtpCode, ExpiresAt, IsUsed, Purpose)
    VALUES (@MobileNumber, @OtpCode, DATEADD(MINUTE, 5, GETDATE()), 0, 'Login');
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Auth_ValidateOtp
    @MobileNumber NVARCHAR(20),
    @OtpCode      NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OtpId INT, @UserId INT, @RoleId INT;

    SELECT TOP 1 @OtpId = OtpId
    FROM dbo.Otp
    WHERE MobileNumber = @MobileNumber AND OtpCode = @OtpCode
      AND Purpose = 'Login'
      AND IsUsed = 0 AND ExpiresAt > GETDATE()
    ORDER BY OtpId DESC;

    IF @OtpId IS NULL
        RETURN;   -- no rows -> C# treats as invalid/expired

    SELECT TOP 1 @UserId = u.UserId, @RoleId = u.RoleId
    FROM dbo.Users u
    WHERE u.MobileNumber = @MobileNumber AND u.IsActive = 1;

    IF @UserId IS NULL
        RETURN;   -- mobile not registered: keep the OTP unused, report invalid

    UPDATE dbo.Otp SET IsUsed = 1 WHERE OtpId = @OtpId;

    -- Table[0]: user
    SELECT
        u.UserId,
        u.FullName,
        ISNULL(r.RoleName, '') AS Role,
        u.Email,
        u.MobileNumber
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    WHERE u.UserId = @UserId;

    -- Table[1]: menus for the user's role
    SELECT m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, m.SortOrder,
           rma.CanView, rma.CanCreate, rma.CanEdit, rma.CanDelete
    FROM dbo.MenuItems m
    INNER JOIN dbo.RoleMenuAccess rma ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId AND rma.CanView = 1
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.MenuId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_ForgotPassword
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT, @Mobile NVARCHAR(20);
    SELECT TOP 1 @UserId = UserId, @Mobile = MobileNumber
    FROM dbo.Users WHERE Email = @Email AND IsActive = 1;

    IF @UserId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email not found' AS Message, CAST(NULL AS NVARCHAR(10)) AS OtpCode;
        RETURN;
    END

    DECLARE @Otp NVARCHAR(10) = RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS VARCHAR(6)), 6);

    -- Keyed by email: works for users without a mobile number and cannot be used to log in
    INSERT INTO dbo.Otp (MobileNumber, Email, OtpCode, ExpiresAt, IsUsed, Purpose)
    VALUES (ISNULL(@Mobile, ''), @Email, @Otp, DATEADD(MINUTE, 10, GETDATE()), 0, 'Reset');

    SELECT CAST(1 AS INT) AS Success, 'OTP generated' AS Message, @Otp AS OtpCode;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_ResetPassword
    @Email           NVARCHAR(256),
    @OtpCode         NVARCHAR(10),
    @NewPasswordHash NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT, @OtpId INT;
    SELECT TOP 1 @UserId = UserId FROM dbo.Users WHERE Email = @Email AND IsActive = 1;

    IF @UserId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email not found' AS Message; RETURN;
    END

    SELECT TOP 1 @OtpId = OtpId FROM dbo.Otp
    WHERE Email = @Email AND Purpose = 'Reset' AND OtpCode = @OtpCode
      AND IsUsed = 0 AND ExpiresAt > GETDATE()
    ORDER BY OtpId DESC;

    IF @OtpId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Invalid or expired OTP' AS Message; RETURN;
    END

    UPDATE dbo.Otp SET IsUsed = 1 WHERE OtpId = @OtpId;
    UPDATE dbo.Users SET PasswordHash = @NewPasswordHash WHERE UserId = @UserId;

    SELECT CAST(1 AS INT) AS Success, 'Password reset successful' AS Message;
END
GO

/* =============================================================================
   2. Login + menus
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Auth_Login
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleId INT;
    SELECT TOP 1 @RoleId = u.RoleId FROM dbo.Users u WHERE u.Email = @Email AND u.IsActive = 1;

    -- Table[0]: user. technicianId is per project: it is resolved at set-scope.
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

    -- Table[1]: menus of the user's global role
    SELECT m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, m.SortOrder,
           rma.CanView, rma.CanCreate, rma.CanEdit, rma.CanDelete
    FROM dbo.MenuItems m
    INNER JOIN dbo.RoleMenuAccess rma ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId AND rma.CanView = 1
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.MenuId;
END
GO

/* Menus of the user's role in the company, plus the parent of every granted child
   (the sidebar flattens a child whose parent is missing). */
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

    ;WITH Granted AS
    (
        SELECT m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, m.SortOrder,
               rma.CanView, rma.CanCreate, rma.CanEdit, rma.CanDelete
        FROM dbo.MenuItems m
        INNER JOIN dbo.RoleMenuAccess rma
                ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId AND rma.CanView = 1
        WHERE m.IsActive = 1
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

/* =============================================================================
   3. Users (User Management screen)
   ============================================================================= */

/* @CompanyId given  -> the company's members, role = their role in the company
   @CompanyId NULL/0 -> every user with the global role (platform admin only) */
CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_GetUsers
    @CompanyId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(@CompanyId, 0) = 0
    BEGIN
        SELECT u.UserId, u.FullName, u.Email, ISNULL(u.MobileNumber, '') AS MobileNumber,
               ISNULL(u.RoleId, 0) AS RoleId, ISNULL(r.RoleName, '') AS RoleName,
               u.IsActive, u.CreatedAt
        FROM dbo.Users u
        LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
        ORDER BY u.FullName;
        RETURN;
    END

    SELECT u.UserId, u.FullName, u.Email, ISNULL(u.MobileNumber, '') AS MobileNumber,
           ISNULL(r.RoleId, 0) AS RoleId, cu.RoleInCompany AS RoleName,
           CAST(CASE WHEN u.IsActive = 1 AND cu.IsActive = 1 THEN 1 ELSE 0 END AS BIT) AS IsActive,
           u.CreatedAt
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u ON u.UserId = cu.UserId
    LEFT  JOIN dbo.Roles r ON r.RoleName = cu.RoleInCompany
    WHERE cu.CompanyId = @CompanyId
    ORDER BY u.FullName;
END
GO

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

CREATE OR ALTER PROCEDURE dbo.sp_User_SelfRegister
    @FullName      NVARCHAR(200),
    @Email         NVARCHAR(256),
    @MobileNumber  NVARCHAR(20),
    @PasswordHash  NVARCHAR(200),
    @AadhaarNumber NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @MobileNumber = NULLIF(LTRIM(RTRIM(@MobileNumber)), '');

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email already registered' AS Message, CAST(0 AS INT) AS UserId;
        RETURN;
    END
    IF @MobileNumber IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Mobile number already registered' AS Message, CAST(0 AS INT) AS UserId;
        RETURN;
    END

    -- No global role: what the user may do comes from the company role (CompanyUsers)
    INSERT INTO dbo.Users (FullName, Email, MobileNumber, PasswordHash, AadhaarNumber, IsActive)
    VALUES (@FullName, @Email, @MobileNumber, @PasswordHash, @AadhaarNumber, 1);

    SELECT CAST(1 AS INT) AS Success, 'Registration successful' AS Message, CAST(SCOPE_IDENTITY() AS INT) AS UserId;
END
GO

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

CREATE OR ALTER PROCEDURE dbo.sp_Company_CancelInvitation
    @InvitationId INT,
    @CancelledBy  INT,
    @CompanyId    INT = NULL       -- when given, the invitation must belong to it
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Invitations SET Status = 'Cancelled'
    WHERE InvitationId = @InvitationId AND Status = 'Pending'
      AND (ISNULL(@CompanyId, 0) = 0 OR CompanyId = @CompanyId);
    SELECT @@ROWCOUNT AS CancelledCount;
END
GO

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

CREATE OR ALTER PROCEDURE dbo.sp_Company_RejectInvitation
    @InvitationId INT,
    @UserId       INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE i SET i.Status = 'Rejected'
    FROM dbo.Invitations i
    INNER JOIN dbo.Users u ON u.Email = i.Email AND u.UserId = @UserId
    WHERE i.InvitationId = @InvitationId AND i.Status = 'Pending';

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Invitation not found or already handled' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Invitation rejected' AS Message;
END
GO

/* =============================================================================
   5. Join requests
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Company_CreateJoinRequest
    @UserId        INT,
    @CompanyId     INT,
    @RequestedRole NVARCHAR(100),
    @Remarks       NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message, CAST(0 AS INT) AS RequestId;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE UserId = @UserId AND CompanyId = @CompanyId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You are already a member of this company' AS Message,
               CAST(0 AS INT) AS RequestId;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.JoinRequests WHERE UserId = @UserId AND CompanyId = @CompanyId AND Status = 'Pending')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You already have a pending request for this company' AS Message,
               CAST(0 AS INT) AS RequestId;
        RETURN;
    END

    /* A join request can never hand out an administrator role */
    IF @RequestedRole IN ('Admin', 'CompanyAdmin')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This role cannot be requested' AS Message, CAST(0 AS INT) AS RequestId;
        RETURN;
    END

    DECLARE @NewId INT;
    INSERT INTO dbo.JoinRequests (UserId, CompanyId, RequestedRole, Remarks, Status)
    VALUES (@UserId, @CompanyId, @RequestedRole, @Remarks, 'Pending');
    SET @NewId = SCOPE_IDENTITY();

    SELECT CAST(1 AS INT) AS Success, 'Join request submitted' AS Message, @NewId AS RequestId;
END
GO

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

/* UserStatus values are the ones the company list screen tests for */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GetAllCompanies
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        c.CompanyId, c.CompanyName, c.CompanyCode, c.City,
        CASE
            WHEN EXISTS (SELECT 1 FROM dbo.CompanyUsers cu WHERE cu.CompanyId = c.CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1) THEN 'Member'
            WHEN EXISTS (SELECT 1 FROM dbo.JoinRequests jr WHERE jr.CompanyId = c.CompanyId AND jr.UserId = @UserId AND jr.Status = 'Pending') THEN 'Requested'
            ELSE 'Available'
        END AS UserStatus
    FROM dbo.Companies c
    WHERE c.IsActive = 1
    ORDER BY c.CompanyName;
END
GO

/* =============================================================================
   6. Membership
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GetUsersWithDetails
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT cu.CompanyUserId, u.UserId, u.FullName, u.Email, ISNULL(u.MobileNumber, '') AS MobileNumber,
           cu.RoleInCompany, cu.AssignedAt, ISNULL(ab.FullName, 'System') AS AssignedBy, cu.IsActive
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u ON u.UserId = cu.UserId
    LEFT  JOIN dbo.Users ab ON ab.UserId = cu.AssignedBy
    WHERE cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
    ORDER BY u.FullName;
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

CREATE OR ALTER PROCEDURE dbo.sp_Company_UpdateUserRole
    @CompanyId INT,
    @UserId    INT,
    @NewRole   NVARCHAR(100),
    @UpdatedBy INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = @NewRole AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS UpdatedCount;   -- unknown role: the user would get no menus
        RETURN;
    END

    UPDATE dbo.CompanyUsers SET RoleInCompany = @NewRole
    WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1;
    SELECT @@ROWCOUNT AS UpdatedCount;
END
GO

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

PRINT 'MainDB UI coverage fixes applied.';
GO
