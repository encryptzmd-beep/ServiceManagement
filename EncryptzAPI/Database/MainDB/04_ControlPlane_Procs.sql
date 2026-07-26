/* =============================================================================
   MainDBEncryptz · Control-plane stored procedures used by AuthService
   -----------------------------------------------------------------------------
   AuthService runs against MainDB (MainDBEncryptz). These are the procs it calls
   that are NOT in 02_Routing_Procs.sql. Each matches the C# caller's exact
   parameter names and returned column names.
   Run after 01_Schema.sql (+ 02, 03).
   ============================================================================= */
USE MainDBEncryptz;
GO

/* -----------------------------------------------------------------------------
   CustomerPortal table (end-customer self-service login; not modelled elsewhere)
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.CustomerPortal') IS NULL
CREATE TABLE dbo.CustomerPortal
(
    CustomerPortalId INT IDENTITY(1,1) PRIMARY KEY,
    FullName     NVARCHAR(200) NOT NULL,
    Email        NVARCHAR(256) NOT NULL,
    MobileNumber NVARCHAR(20)  NULL,
    PasswordHash NVARCHAR(200) NOT NULL,
    Address      NVARCHAR(400) NULL,
    City         NVARCHAR(100) NULL,
    IsActive     BIT NOT NULL CONSTRAINT DF_CP_IsActive DEFAULT (1),
    CreatedAt    DATETIME NOT NULL CONSTRAINT DF_CP_CreatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_CP_Email UNIQUE (Email)
);
GO

/* =============================================================================
   AUTH / OTP / REGISTER
   ============================================================================= */

CREATE OR ALTER PROCEDURE dbo.sp_Auth_GenerateOtp
    @MobileNumber NVARCHAR(20),
    @OtpCode      NVARCHAR(10),
    @ExpiresAt    DATETIME
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Otp (MobileNumber, OtpCode, ExpiresAt, IsUsed)
    VALUES (@MobileNumber, @OtpCode, @ExpiresAt, 0);
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
      AND IsUsed = 0 AND ExpiresAt > GETDATE()
    ORDER BY OtpId DESC;

    IF @OtpId IS NULL
        RETURN;   -- no rows -> C# treats as invalid/expired

    UPDATE dbo.Otp SET IsUsed = 1 WHERE OtpId = @OtpId;

    SELECT TOP 1 @UserId = u.UserId, @RoleId = u.RoleId
    FROM dbo.Users u
    WHERE u.MobileNumber = @MobileNumber AND u.IsActive = 1;

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

CREATE OR ALTER PROCEDURE dbo.sp_Auth_Register
    @FullName     NVARCHAR(200),
    @Email        NVARCHAR(256),
    @MobileNumber NVARCHAR(20),
    @PasswordHash NVARCHAR(200),
    @RoleId       INT,
    @UserId       INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber OR Email = @Email)
    BEGIN
        SET @UserId = 0;
        RETURN;
    END

    INSERT INTO dbo.Users (FullName, Email, MobileNumber, PasswordHash, RoleId, IsActive)
    VALUES (@FullName, @Email, @MobileNumber, @PasswordHash, @RoleId, 1);

    SET @UserId = SCOPE_IDENTITY();
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

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email already registered' AS Message;
        RETURN;
    END
    IF @MobileNumber IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Mobile number already registered' AS Message;
        RETURN;
    END

    INSERT INTO dbo.Users (FullName, Email, MobileNumber, PasswordHash, AadhaarNumber, IsActive)
    VALUES (@FullName, @Email, @MobileNumber, @PasswordHash, @AadhaarNumber, 1);

    SELECT CAST(1 AS INT) AS Success, 'Registration successful' AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetUserById
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber, ISNULL(r.RoleName, '') AS RoleName
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    WHERE u.UserId = @UserId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_CheckExists
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 UserId, FullName
    FROM dbo.Users
    WHERE Email = @Email AND IsActive = 1;
END
GO

/* =============================================================================
   PASSWORD (forgot / reset / change)
   ============================================================================= */

CREATE OR ALTER PROCEDURE dbo.sp_User_ForgotPassword
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Mobile NVARCHAR(20);
    SELECT TOP 1 @Mobile = MobileNumber FROM dbo.Users WHERE Email = @Email AND IsActive = 1;

    IF @Mobile IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email not found' AS Message, CAST(NULL AS NVARCHAR(10)) AS OtpCode;
        RETURN;
    END

    DECLARE @Otp NVARCHAR(10) = RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS VARCHAR(6)), 6);

    INSERT INTO dbo.Otp (MobileNumber, OtpCode, ExpiresAt, IsUsed)
    VALUES (@Mobile, @Otp, DATEADD(MINUTE, 10, GETDATE()), 0);

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

    DECLARE @UserId INT, @Mobile NVARCHAR(20), @OtpId INT;
    SELECT TOP 1 @UserId = UserId, @Mobile = MobileNumber FROM dbo.Users WHERE Email = @Email AND IsActive = 1;

    IF @UserId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email not found' AS Message; RETURN;
    END

    SELECT TOP 1 @OtpId = OtpId FROM dbo.Otp
    WHERE MobileNumber = @Mobile AND OtpCode = @OtpCode AND IsUsed = 0 AND ExpiresAt > GETDATE()
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

CREATE OR ALTER PROCEDURE dbo.sp_User_ChangePassword
    @UserId          INT,
    @NewPasswordHash NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users SET PasswordHash = @NewPasswordHash WHERE UserId = @UserId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'User not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Password changed successfully' AS Message;
END
GO

/* =============================================================================
   MENUS (by role) + MANAGEMENT (users / roles / menu access)
   ============================================================================= */

CREATE OR ALTER PROCEDURE dbo.sp_Auth_GetMenusByRole
    @RoleId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, m.SortOrder,
           rma.CanView, rma.CanCreate, rma.CanEdit, rma.CanDelete
    FROM dbo.MenuItems m
    INNER JOIN dbo.RoleMenuAccess rma ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId AND rma.CanView = 1
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.MenuId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_GetUsers
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber,
           ISNULL(u.RoleId, 0) AS RoleId, ISNULL(r.RoleName, '') AS RoleName,
           u.IsActive, u.CreatedAt
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    ORDER BY u.FullName;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_SaveUser
    @UserId       INT,
    @FullName     NVARCHAR(200),
    @Email        NVARCHAR(256),
    @MobileNumber NVARCHAR(20),
    @RoleId       INT,
    @IsActive     BIT,
    @PasswordHash NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @UserId IS NULL OR @UserId = 0
    BEGIN
        INSERT INTO dbo.Users (FullName, Email, MobileNumber, RoleId, IsActive, PasswordHash)
        VALUES (@FullName, @Email, @MobileNumber, @RoleId, @IsActive, @PasswordHash);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS UserId, 'Inserted' AS Status;
    END
    ELSE
    BEGIN
        UPDATE dbo.Users
        SET FullName = @FullName, Email = @Email, MobileNumber = @MobileNumber,
            RoleId = @RoleId, IsActive = @IsActive,
            PasswordHash = CASE WHEN @PasswordHash IS NULL THEN PasswordHash ELSE @PasswordHash END
        WHERE UserId = @UserId;
        SELECT @UserId AS UserId, 'Updated' AS Status;
    END
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_GetRoles
AS
BEGIN
    SET NOCOUNT ON;
    SELECT RoleId, RoleName, Description, IsActive, CreatedAt
    FROM dbo.Roles
    ORDER BY RoleName;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_SaveRole
    @RoleId      INT,
    @RoleName    NVARCHAR(100),
    @Description NVARCHAR(300) = NULL,
    @IsActive    BIT
AS
BEGIN
    SET NOCOUNT ON;

    IF @RoleId IS NULL OR @RoleId = 0
    BEGIN
        INSERT INTO dbo.Roles (RoleName, Description, IsActive)
        VALUES (@RoleName, @Description, @IsActive);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS RoleId, 'Inserted' AS Status;
    END
    ELSE
    BEGIN
        UPDATE dbo.Roles SET RoleName = @RoleName, Description = @Description, IsActive = @IsActive
        WHERE RoleId = @RoleId;
        SELECT @RoleId AS RoleId, 'Updated' AS Status;
    END
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_GetMenuAccess
    @RoleId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        m.MenuId, m.MenuName, m.MenuPath, m.ParentMenuId, m.SortOrder,
        ISNULL(rma.CanView, 0)   AS CanView,
        ISNULL(rma.CanCreate, 0) AS CanCreate,
        ISNULL(rma.CanEdit, 0)   AS CanEdit,
        ISNULL(rma.CanDelete, 0) AS CanDelete,
        CAST(CASE WHEN rma.RoleMenuAccessId IS NULL THEN 0 ELSE 1 END AS BIT) AS HasAccess
    FROM dbo.MenuItems m
    LEFT JOIN dbo.RoleMenuAccess rma ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.MenuId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_SaveMenuAccessBulk
    @RoleId     INT,
    @AccessJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH j AS (
        SELECT menuId, canView, canCreate, canEdit, canDelete
        FROM OPENJSON(@AccessJson)
        WITH (menuId INT '$.menuId', canView INT '$.canView', canCreate INT '$.canCreate',
              canEdit INT '$.canEdit', canDelete INT '$.canDelete')
    )
    MERGE dbo.RoleMenuAccess AS tgt
    USING j ON tgt.RoleId = @RoleId AND tgt.MenuId = j.menuId
    WHEN MATCHED THEN
        UPDATE SET CanView = j.canView, CanCreate = j.canCreate, CanEdit = j.canEdit, CanDelete = j.canDelete
    WHEN NOT MATCHED THEN
        INSERT (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
        VALUES (@RoleId, j.menuId, j.canView, j.canCreate, j.canEdit, j.canDelete);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Users_Search
    @SearchTerm NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber,
           ISNULL(u.RoleId, 0) AS RoleId, ISNULL(r.RoleName, '') AS RoleName, u.IsActive, u.CreatedAt
    FROM dbo.Users u
    LEFT JOIN dbo.Roles r ON r.RoleId = u.RoleId
    WHERE @SearchTerm IS NULL OR @SearchTerm = ''
       OR u.FullName LIKE '%' + @SearchTerm + '%'
       OR u.Email LIKE '%' + @SearchTerm + '%'
       OR u.MobileNumber LIKE '%' + @SearchTerm + '%'
    ORDER BY u.FullName;
END
GO

/* =============================================================================
   COMPANY · users, invitations, join requests
   ============================================================================= */

CREATE OR ALTER PROCEDURE dbo.sp_Company_InviteUser
    @CompanyId     INT,
    @Email         NVARCHAR(256),
    @RoleInCompany NVARCHAR(100),
    @InvitedBy     INT,
    @Remarks       NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.Invitations WHERE CompanyId = @CompanyId AND Email = @Email AND Status = 'Pending')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'An invitation is already pending for this email' AS Message,
               CAST(0 AS INT) AS InvitationId;
        RETURN;
    END

    DECLARE @NewId INT;
    INSERT INTO dbo.Invitations (CompanyId, Email, RoleInCompany, Status, Remarks, InvitedBy, ExpiresAt)
    VALUES (@CompanyId, @Email, @RoleInCompany, 'Pending', @Remarks, @InvitedBy, DATEADD(DAY, 7, GETDATE()));
    SET @NewId = SCOPE_IDENTITY();

    SELECT CAST(1 AS INT) AS Success, 'Invitation sent' AS Message, @NewId AS InvitationId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_RejectInvitation
    @InvitationId INT,
    @UserId       INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Invitations SET Status = 'Rejected' WHERE InvitationId = @InvitationId AND Status = 'Pending';
    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Invitation not found or already handled' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Invitation rejected' AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_AcceptInvitation
    @Token  UNIQUEIDENTIFIER,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CompanyId INT, @Role NVARCHAR(100);
    SELECT TOP 1 @CompanyId = CompanyId, @Role = RoleInCompany
    FROM dbo.Invitations
    WHERE Token = @Token AND Status = 'Pending' AND ExpiresAt > GETDATE();

    IF @CompanyId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Invitation invalid or expired' AS Message,
               CAST(0 AS INT) AS CompanyId, CAST('' AS NVARCHAR(100)) AS RoleInCompany;
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
        INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, IsActive)
        VALUES (@CompanyId, @UserId, @Role, 1);
    ELSE
        UPDATE dbo.CompanyUsers SET RoleInCompany = @Role, IsActive = 1
        WHERE CompanyId = @CompanyId AND UserId = @UserId;

    UPDATE dbo.Invitations SET Status = 'Accepted' WHERE Token = @Token;

    SELECT CAST(1 AS INT) AS Success, 'Invitation accepted' AS Message,
           @CompanyId AS CompanyId, @Role AS RoleInCompany;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_GetPendingInvitations
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT i.InvitationId, i.CompanyId, c.CompanyName, i.RoleInCompany, i.Token, i.ExpiresAt,
           ISNULL(u.FullName, 'System') AS InvitedByName
    FROM dbo.Invitations i
    INNER JOIN dbo.Companies c ON c.CompanyId = i.CompanyId
    LEFT  JOIN dbo.Users u ON u.UserId = i.InvitedBy
    WHERE i.Email = @Email AND i.Status = 'Pending' AND i.ExpiresAt > GETDATE();
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_GetUsers
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber, cu.RoleInCompany,
           cu.AssignedAt, ISNULL(ab.FullName, 'System') AS AssignedByName
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u ON u.UserId = cu.UserId
    LEFT  JOIN dbo.Users ab ON ab.UserId = cu.AssignedBy
    WHERE cu.CompanyId = @CompanyId AND cu.IsActive = 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_GetUsersWithDetails
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT cu.CompanyUserId, u.UserId, u.FullName, u.Email, u.MobileNumber, cu.RoleInCompany,
           cu.AssignedAt, ISNULL(ab.FullName, 'System') AS AssignedBy, cu.IsActive
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u ON u.UserId = cu.UserId
    LEFT  JOIN dbo.Users ab ON ab.UserId = cu.AssignedBy
    WHERE cu.CompanyId = @CompanyId;
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
    UPDATE dbo.CompanyUsers SET RoleInCompany = @NewRole
    WHERE CompanyId = @CompanyId AND UserId = @UserId;
    SELECT @@ROWCOUNT AS UpdatedCount;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_RemoveUser
    @CompanyId INT,
    @UserId    INT,
    @RemovedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.CompanyUsers SET IsActive = 0
    WHERE CompanyId = @CompanyId AND UserId = @UserId;
    SELECT @@ROWCOUNT AS RemovedCount;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_GetPendingInvitations
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT i.InvitationId, i.Email, i.RoleInCompany, i.Status, i.ExpiresAt, i.CreatedAt,
           ISNULL(u.FullName, 'System') AS CreatedByName
    FROM dbo.Invitations i
    LEFT JOIN dbo.Users u ON u.UserId = i.InvitedBy
    WHERE i.CompanyId = @CompanyId AND i.Status = 'Pending';
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_CancelInvitation
    @InvitationId INT,
    @CancelledBy  INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Invitations SET Status = 'Cancelled' WHERE InvitationId = @InvitationId AND Status = 'Pending';
    SELECT @@ROWCOUNT AS CancelledCount;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_CreateJoinRequest
    @UserId        INT,
    @CompanyId     INT,
    @RequestedRole NVARCHAR(100),
    @Remarks       NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.JoinRequests WHERE UserId = @UserId AND CompanyId = @CompanyId AND Status = 'Pending')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You already have a pending request for this company' AS Message,
               CAST(0 AS INT) AS RequestId;
        RETURN;
    END

    DECLARE @NewId INT;
    INSERT INTO dbo.JoinRequests (UserId, CompanyId, RequestedRole, Remarks, Status)
    VALUES (@UserId, @CompanyId, @RequestedRole, @Remarks, 'Pending');
    SET @NewId = SCOPE_IDENTITY();

    SELECT CAST(1 AS INT) AS Success, 'Join request submitted' AS Message, @NewId AS RequestId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_GetPendingRequests
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT jr.RequestId, jr.UserId, u.FullName AS UserName, u.Email AS UserEmail, u.MobileNumber,
           jr.RequestedRole, jr.Remarks, jr.RequestedAt, jr.Status
    FROM dbo.JoinRequests jr
    INNER JOIN dbo.Users u ON u.UserId = jr.UserId
    WHERE jr.CompanyId = @CompanyId AND jr.Status = 'Pending';
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_ApproveRequest
    @RequestId  INT,
    @CompanyId  INT,
    @ReviewedBy INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT, @Role NVARCHAR(100);
    SELECT @UserId = UserId, @Role = RequestedRole
    FROM dbo.JoinRequests
    WHERE RequestId = @RequestId AND CompanyId = @CompanyId AND Status = 'Pending';

    IF @UserId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Request not found or already handled' AS Message; RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
        INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
        VALUES (@CompanyId, @UserId, @Role, @ReviewedBy, 1);
    ELSE
        UPDATE dbo.CompanyUsers SET RoleInCompany = @Role, IsActive = 1
        WHERE CompanyId = @CompanyId AND UserId = @UserId;

    UPDATE dbo.JoinRequests SET Status = 'Approved', ReviewedBy = @ReviewedBy WHERE RequestId = @RequestId;

    SELECT CAST(1 AS INT) AS Success, 'Request approved' AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_RejectRequest
    @RequestId       INT,
    @CompanyId       INT,
    @ReviewedBy      INT,
    @RejectionReason NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.JoinRequests
    SET Status = 'Rejected', RejectionReason = @RejectionReason, ReviewedBy = @ReviewedBy
    WHERE RequestId = @RequestId AND CompanyId = @CompanyId AND Status = 'Pending';
    SELECT @@ROWCOUNT AS RejectedCount;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_GetAllCompanies
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        c.CompanyId, c.CompanyName, c.CompanyCode, c.City,
        CASE
            WHEN EXISTS (SELECT 1 FROM dbo.CompanyUsers cu WHERE cu.CompanyId = c.CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1) THEN 'Member'
            WHEN EXISTS (SELECT 1 FROM dbo.JoinRequests jr WHERE jr.CompanyId = c.CompanyId AND jr.UserId = @UserId AND jr.Status = 'Pending') THEN 'Pending'
            ELSE 'Available'
        END AS UserStatus
    FROM dbo.Companies c
    WHERE c.IsActive = 1
    ORDER BY c.CompanyName;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_GetMyJoinRequests
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT jr.RequestId, jr.CompanyId, c.CompanyName, jr.RequestedRole, jr.Remarks, jr.RequestedAt, jr.Status
    FROM dbo.JoinRequests jr
    INNER JOIN dbo.Companies c ON c.CompanyId = jr.CompanyId
    WHERE jr.UserId = @UserId AND jr.Status = 'Pending';
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_CancelJoinRequest
    @RequestId INT,
    @UserId    INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.JoinRequests SET Status = 'Cancelled'
    WHERE RequestId = @RequestId AND UserId = @UserId AND Status = 'Pending';
    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Request not found or already handled' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Request cancelled' AS Message;
END
GO

/* =============================================================================
   CUSTOMER PORTAL (end-customer self-service)
   ============================================================================= */

CREATE OR ALTER PROCEDURE dbo.sp_CustomerPortal_Register
    @FullName     NVARCHAR(200),
    @Email        NVARCHAR(256),
    @MobileNumber NVARCHAR(20),
    @PasswordHash NVARCHAR(200),
    @Address      NVARCHAR(400) = NULL,
    @City         NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.CustomerPortal WHERE Email = @Email)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email already registered' AS Message; RETURN;
    END
    INSERT INTO dbo.CustomerPortal (FullName, Email, MobileNumber, PasswordHash, Address, City)
    VALUES (@FullName, @Email, @MobileNumber, @PasswordHash, @Address, @City);
    SELECT CAST(1 AS INT) AS Success, 'Registration successful' AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_CustomerPortal_Login
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 CustomerPortalId, FullName, Email, PasswordHash
    FROM dbo.CustomerPortal
    WHERE Email = @Email AND IsActive = 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_CustomerPortal_GetDashboard
    @CustomerPortalId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Table[0]: profile
    SELECT CustomerPortalId, FullName, Email, MobileNumber, Address, City
    FROM dbo.CustomerPortal
    WHERE CustomerPortalId = @CustomerPortalId;

    -- Table[1]: menus (none by default)
    SELECT CAST(0 AS INT) AS MenuId, CAST('' AS NVARCHAR(150)) AS MenuName,
           CAST('' AS NVARCHAR(300)) AS MenuPath, CAST('' AS NVARCHAR(100)) AS Icon
    WHERE 1 = 0;
END
GO

PRINT 'MainDBEncryptz control-plane procs created.';
GO
