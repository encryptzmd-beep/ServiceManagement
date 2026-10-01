/* =============================================================================
   ProjectDB · Customer portal procs
   -----------------------------------------------------------------------------
   Customers are business data of the project: they register / log in against
   the project's own DB (the API routes them by the X-Project-Key header, then by
   the ProjectKey in the customer token).

     1. Customer menus            seeded + resolved by ROLE NAME (was RoleId = 4)
     2. sp_Customer_Login         menus by role name
     3. sp_Customer_GetMenu       (was missing)
     4. sp_Customer_GetDashboardStats (was missing)
     5. sp_Customer_GetMyComplaints   + StatusName / StatusColor
     6. sp_Customer_GetComplaintDetail  complaints without a product, status,
                                        timeline in the shape the UI reads
     7. sp_Customer_UpdateComplaint / DeleteComplaint / ConfirmClosure
        (sp_ManageComplaintDetails has no DELETE_COMPLAINT / CONFIRM_CLOSURE
         operation and does not check that the complaint is the customer's)

   Run AFTER 04 and 05. SAFE TO RE-RUN.
   ============================================================================= */

/* =============================================================================
   1. Customer role + menus (ProjectId 0 = shared by every project in this DB)
   ============================================================================= */
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'Customer')
    INSERT INTO dbo.Roles (RoleName, Description, IsActive, CompanyId, ProjectId, LocationId)
    VALUES ('Customer', 'Customer portal user', 1, 0, 0, 0);
GO

CREATE OR ALTER PROCEDURE dbo.sp_Customer_Register
    @FullName NVARCHAR(150),
    @Email NVARCHAR(200) = NULL,
    @MobileNumber NVARCHAR(15),
    @PasswordHash NVARCHAR(500),
    @Address NVARCHAR(500) = NULL,
    @City NVARCHAR(100) = NULL,
    @State NVARCHAR(100) = NULL,
    @PinCode NVARCHAR(10) = NULL,
    @CompanyId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(LTRIM(RTRIM(@FullName)), '') = ''
    BEGIN
        SELECT 0 AS Success, 'Full name is required.' AS Message, NULL AS UserId, NULL AS CustomerId;
        RETURN;
    END

    IF ISNULL(LTRIM(RTRIM(@MobileNumber)), '') = ''
    BEGIN
        SELECT 0 AS Success, 'Mobile number is required.' AS Message, NULL AS UserId, NULL AS CustomerId;
        RETURN;
    END

    IF ISNULL(LTRIM(RTRIM(@PasswordHash)), '') = ''
    BEGIN
        SELECT 0 AS Success, 'Password is required.' AS Message, NULL AS UserId, NULL AS CustomerId;
        RETURN;
    END

    DECLARE @ExistingUserId INT;
    SELECT TOP 1 @ExistingUserId = UserId
    FROM dbo.Users
    WHERE Email = @Email OR MobileNumber = @MobileNumber;

    IF @ExistingUserId IS NOT NULL
    BEGIN
        SELECT 1 AS Success, 'UserAlreadyExists' AS Message, @ExistingUserId AS UserId, NULL AS CustomerId;
        RETURN;
    END

    DECLARE @CustomerRoleId INT;
    SELECT TOP 1 @CustomerRoleId = RoleId
    FROM dbo.Roles
    WHERE RoleName = N'Customer' AND IsActive = 1
    ORDER BY RoleId;

    IF @CustomerRoleId IS NULL
    BEGIN
        SELECT 0 AS Success, 'Customer role is not configured in this tenant.' AS Message, NULL AS UserId, NULL AS CustomerId;
        RETURN;
    END

    IF @CompanyId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId)
    BEGIN
        SELECT 0 AS Success, 'Invalid CompanyId.' AS Message, NULL AS UserId, NULL AS CustomerId;
        RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.Users
            (FullName, Email, MobileNumber, PasswordHash, RoleId, IsActive, CreatedAt, UpdatedAt, UserType)
        VALUES
            (@FullName, @Email, @MobileNumber, @PasswordHash, @CustomerRoleId, 1,
             DATEADD(MINUTE, 330, GETUTCDATE()), DATEADD(MINUTE, 330, GETUTCDATE()), 'Customer');

        DECLARE @UserId INT = SCOPE_IDENTITY();

        INSERT INTO dbo.Customers
            (UserId, CustomerName, MobileNumber, Email, Address, City, State, PinCode, CompanyId,
             IsActive, CreatedAt, UpdatedAt)
        VALUES
            (@UserId, @FullName, @MobileNumber, @Email, @Address, @City, @State, @PinCode, @CompanyId,
             1, DATEADD(MINUTE, 330, GETUTCDATE()), DATEADD(MINUTE, 330, GETUTCDATE()));

        DECLARE @CustomerId INT = SCOPE_IDENTITY();
        COMMIT TRANSACTION;

        SELECT 1 AS Success, 'Registration successful. Please login.' AS Message,
               @UserId AS UserId, @CustomerId AS CustomerId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message, NULL AS UserId, NULL AS CustomerId;
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Customer_ForgotPassword
    @CompanyId INT,
    @ProjectId INT,
    @LocationId INT,
    @Email NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Users u
        INNER JOIN dbo.Customers c ON c.UserId = u.UserId AND c.IsActive = 1
        WHERE u.Email = @Email AND u.IsActive = 1
    )
    BEGIN
        SELECT 1 AS Success, 'Reset request accepted' AS Message, CAST(NULL AS NVARCHAR(10)) AS OtpCode;
        RETURN;
    END

    DECLARE @OtpCode NVARCHAR(10) = RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS NVARCHAR(6)), 6);

    UPDATE dbo.EmailOtpLog
    SET IsUsed = 1
    WHERE Email = @Email AND Purpose = 'CustomerForgotPassword' AND IsUsed = 0
      AND CompanyId = @CompanyId AND ProjectId = @ProjectId;

    INSERT INTO dbo.EmailOtpLog
        (Email, OtpCode, Purpose, ExpiresAt, CreatedAt, IsUsed, CompanyId, ProjectId, LocationId)
    VALUES
        (@Email, @OtpCode, 'CustomerForgotPassword', DATEADD(MINUTE, 10, DATEADD(MINUTE, 330, GETUTCDATE())),
         GETUTCDATE(), 0, @CompanyId, @ProjectId, @LocationId);

    SELECT 1 AS Success, 'Reset code created' AS Message, @OtpCode AS OtpCode;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Customer_ResetPassword
    @CompanyId INT,
    @ProjectId INT,
    @LocationId INT,
    @Email NVARCHAR(255),
    @OtpCode NVARCHAR(10),
    @NewPasswordHash NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @OtpId INT, @UserId INT;
    SELECT TOP 1 @OtpId = OtpId
    FROM dbo.EmailOtpLog
    WHERE Email = @Email AND OtpCode = @OtpCode AND Purpose = 'CustomerForgotPassword'
      AND IsUsed = 0 AND ExpiresAt > DATEADD(MINUTE, 330, GETUTCDATE())
      AND CompanyId = @CompanyId AND ProjectId = @ProjectId
    ORDER BY OtpId DESC;

    SELECT TOP 1 @UserId = u.UserId
    FROM dbo.Users u
    INNER JOIN dbo.Customers c ON c.UserId = u.UserId AND c.IsActive = 1
    WHERE u.Email = @Email AND u.IsActive = 1;

    IF @OtpId IS NULL OR @UserId IS NULL
    BEGIN
        SELECT 0 AS Success, 'Invalid or expired reset code' AS Message;
        RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        UPDATE dbo.Users SET PasswordHash = @NewPasswordHash, UpdatedAt = GETDATE() WHERE UserId = @UserId;
        UPDATE dbo.EmailOtpLog SET IsUsed = 1 WHERE OtpId = @OtpId;

        COMMIT TRANSACTION;
        SELECT 1 AS Success, 'Password reset successfully' AS Message;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message;
    END CATCH
END
GO

DECLARE @menus TABLE (MenuName NVARCHAR(100), MenuPath NVARCHAR(200), Icon NVARCHAR(100), SortOrder INT);
INSERT INTO @menus VALUES
    ('My Complaints',   '/customer/complaints',     'assignment',  1),
    ('New Complaint',   '/customer/complaints/new', 'add_circle',  2),
    ('My Products',     '/customer/products',       'inventory_2', 3),
    ('My Profile',      '/customer/profile',        'person',      4);

INSERT INTO dbo.MenuItems (MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive, Module, CompanyId, ProjectId, LocationId)
SELECT s.MenuName, s.MenuPath, s.Icon, NULL, s.SortOrder, 1, 'Customer', 0, 0, 0
FROM @menus s
WHERE NOT EXISTS (SELECT 1 FROM dbo.MenuItems m WHERE m.MenuPath = s.MenuPath);

DECLARE @CustomerRoleId INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'Customer');

INSERT INTO dbo.RoleMenuAccess (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete, CompanyId, ProjectId, LocationId)
SELECT @CustomerRoleId, m.MenuId, 1, 1, 1, 1, 0, 0, 0
FROM dbo.MenuItems m
WHERE m.MenuPath LIKE '/customer/%'
  AND NOT EXISTS (SELECT 1 FROM dbo.RoleMenuAccess x WHERE x.RoleId = @CustomerRoleId AND x.MenuId = m.MenuId);
GO

/* =============================================================================
   2. Login
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_Login
    @Email NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    -- RESULT SET 1: Customer details (password is verified in C#)
    SELECT TOP 1
        u.UserId,
        u.PasswordHash,
        c.CustomerId,
        u.FullName,
        u.Email,
        u.MobileNumber,
        c.Address,
        c.City,
        c.State,
        c.PinCode,
        c.Latitude,
        c.Longitude,
        c.AlternatePhone,
        c.Landmark,
        u.RoleId,
        r.RoleName,
        u.IsActive,
        c.CompanyId,
        u.CreatedAt
    FROM dbo.Users u
    INNER JOIN dbo.Roles r     ON u.RoleId = r.RoleId
    INNER JOIN dbo.Customers c ON u.UserId = c.UserId
    WHERE u.Email = @Email
      AND u.IsActive = 1
      AND c.IsActive = 1
    ORDER BY c.CustomerId;

    -- RESULT SET 2: Customer menus (only if customer found)
    IF @@ROWCOUNT > 0
        SELECT
            m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, ISNULL(m.SortOrder, 0) AS SortOrder,
            ISNULL(rma.CanView, 0) AS CanView,
            ISNULL(rma.CanCreate, 0) AS CanCreate,
            ISNULL(rma.CanEdit, 0) AS CanEdit,
            ISNULL(rma.CanDelete, 0) AS CanDelete
        FROM dbo.MenuItems m
        INNER JOIN dbo.RoleMenuAccess rma ON rma.MenuId = m.MenuId
        INNER JOIN dbo.Roles r            ON r.RoleId = rma.RoleId AND r.RoleName = 'Customer'
        WHERE m.IsActive = 1
          AND rma.CanView = 1
          AND m.MenuPath LIKE '/customer/%'
        ORDER BY m.SortOrder;
END
GO

/* =============================================================================
   3. Menus
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_GetMenu
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, ISNULL(m.SortOrder, 0) AS SortOrder,
        ISNULL(rma.CanView, 0) AS CanView,
        ISNULL(rma.CanCreate, 0) AS CanCreate,
        ISNULL(rma.CanEdit, 0) AS CanEdit,
        ISNULL(rma.CanDelete, 0) AS CanDelete
    FROM dbo.MenuItems m
    INNER JOIN dbo.RoleMenuAccess rma ON rma.MenuId = m.MenuId
    INNER JOIN dbo.Roles r            ON r.RoleId = rma.RoleId AND r.RoleName = 'Customer'
    WHERE m.IsActive = 1
      AND rma.CanView = 1
      AND m.MenuPath LIKE '/customer/%'
      AND EXISTS (SELECT 1 FROM dbo.Customers c WHERE c.CustomerId = @CustomerId AND c.IsActive = 1)
    ORDER BY m.SortOrder;
END
GO

/* =============================================================================
   4. Dashboard
   Table[0]: one row of counters    Table[1]: latest 5 complaints
   "Resolved" = the terminal statuses used across the procs (Closed, WorkCompleted)
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_GetDashboardStats
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT
        (SELECT COUNT(*) FROM dbo.Complaints c
          WHERE c.CustomerId = @CustomerId AND ISNULL(c.IsActive, 1) = 1) AS TotalComplaints,

        (SELECT COUNT(*) FROM dbo.Complaints c
          LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = c.StatusId
          WHERE c.CustomerId = @CustomerId AND ISNULL(c.IsActive, 1) = 1
            AND ISNULL(cs.StatusName, '') NOT IN ('Closed', 'WorkCompleted', 'Cancelled')) AS ActiveComplaints,

        (SELECT COUNT(*) FROM dbo.Complaints c
          INNER JOIN dbo.ComplaintStatuses cs ON cs.StatusId = c.StatusId
          WHERE c.CustomerId = @CustomerId AND ISNULL(c.IsActive, 1) = 1
            AND cs.StatusName IN ('Closed', 'WorkCompleted')) AS ResolvedComplaints,

        (SELECT COUNT(*) FROM dbo.Products p
          WHERE p.CustomerId = @CustomerId AND ISNULL(p.IsActive, 1) = 1) AS TotalProducts,

        (SELECT COUNT(*) FROM dbo.Products p
          WHERE p.CustomerId = @CustomerId AND ISNULL(p.IsActive, 1) = 1
            AND p.WarrantyExpiryDate >= @Today) AS ActiveWarrantyProducts,

        (SELECT COUNT(*) FROM dbo.Products p
          WHERE p.CustomerId = @CustomerId AND ISNULL(p.IsActive, 1) = 1
            AND p.WarrantyExpiryDate < @Today) AS ExpiredWarrantyProducts;

    SELECT TOP 5
        c.ComplaintId, c.ComplaintNumber, c.Subject, c.Priority, c.StatusId,
        ISNULL(cs.StatusName, '')  AS StatusName,
        cs.StatusColor,
        c.CreatedAt,
        DATEDIFF(HOUR, c.CreatedAt, DATEADD(MINUTE, 330, GETUTCDATE())) AS HoursSinceCreated,
        (SELECT TOP 1 tu.FullName
         FROM dbo.TechnicianAssignments ta
         INNER JOIN dbo.Technicians t ON t.TechnicianId = ta.TechnicianId
         INNER JOIN dbo.Users tu      ON tu.UserId = t.UserId
         WHERE ta.ComplaintId = c.ComplaintId AND ta.Status IN ('Assigned', 'InProgress')
         ORDER BY CASE WHEN ta.AssignmentRole = 'Primary' THEN 0 ELSE 1 END, ta.AssignedAt DESC) AS AssignedTechnicianName
    FROM dbo.Complaints c
    LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = c.StatusId
    WHERE c.CustomerId = @CustomerId AND ISNULL(c.IsActive, 1) = 1
    ORDER BY c.CreatedAt DESC;
END
GO

/* =============================================================================
   5. My complaints
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_GetMyComplaints
    @CustomerId   INT,
    @StatusFilter INT = NULL,
    @PageNumber   INT = 1,
    @PageSize     INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    SELECT
        c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description,
        c.Priority, c.StatusId,
        ISNULL(cs.StatusName, '') AS StatusName,
        cs.StatusColor,
        c.SLADeadline, c.CreatedAt, ISNULL(c.UpdatedAt, c.CreatedAt) AS UpdatedAt,
        p.ProductName, p.SerialNumber, p.Brand,
        -- Primary technician info
        pt.TechnicianName,
        pt.TechnicianPhone,
        pt.AssignmentRole, pt.AssignmentStatus,
        pt.AssignedAt,
        COUNT(*) OVER() AS TotalCount
    FROM dbo.Complaints c
    LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = c.StatusId
    LEFT JOIN dbo.Products p ON c.ProductId = p.ProductId
    OUTER APPLY
    (
        -- one row per complaint even when several assignments are open
        SELECT TOP 1 tu.FullName AS TechnicianName, tu.MobileNumber AS TechnicianPhone,
               ta.AssignmentRole, ta.Status AS AssignmentStatus, ta.AssignedAt
        FROM dbo.TechnicianAssignments ta
        INNER JOIN dbo.Technicians t ON ta.TechnicianId = t.TechnicianId
        INNER JOIN dbo.Users tu      ON t.UserId = tu.UserId
        WHERE ta.ComplaintId = c.ComplaintId
          AND ta.Status IN ('Assigned', 'InProgress') AND ta.AssignmentRole = 'Primary'
        ORDER BY ta.AssignedAt DESC
    ) pt
    WHERE c.CustomerId = @CustomerId AND ISNULL(c.IsActive, 1) = 1
      AND (@StatusFilter IS NULL OR c.StatusId = @StatusFilter)
    ORDER BY c.CreatedAt DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* =============================================================================
   6. Complaint detail
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_GetComplaintDetail
    @ComplaintId INT,
    @CustomerId  INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Table 0: Complaint detail (quick complaints have no product)
    SELECT c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description,
        c.Priority, c.StatusId,
        ISNULL(cs.StatusName, '') AS StatusName, cs.StatusColor,
        c.SLADeadline, c.CreatedAt, c.UpdatedAt,
        ISNULL(c.IsCustomerConfirmed, 0) AS IsCustomerConfirmed,
        ISNULL(p.ProductName, c.Category) AS ProductName, p.SerialNumber,
        ISNULL(p.Brand, c.BrandName) AS Brand,
        cu.CustomerName, cu.MobileNumber, cu.City
    FROM dbo.Complaints c
    INNER JOIN dbo.Customers cu ON c.CustomerId = cu.CustomerId
    LEFT JOIN dbo.Products p ON c.ProductId = p.ProductId
    LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = c.StatusId
    WHERE c.ComplaintId = @ComplaintId AND c.CustomerId = @CustomerId;

    IF @@ROWCOUNT = 0
        RETURN;   -- not the customer's complaint: nothing else is returned

    -- Table 1: All assigned technicians
    SELECT ta.AssignmentId, ta.AssignmentRole, ta.Status, ta.AssignedAt, ta.CompletedAt,
        u.FullName AS TechnicianName, u.MobileNumber AS TechnicianPhone,
        tp.Specialization, ISNULL(tp.Rating, 0) AS Rating
    FROM dbo.TechnicianAssignments ta
    INNER JOIN dbo.Technicians t ON ta.TechnicianId = t.TechnicianId
    INNER JOIN dbo.Users u ON t.UserId = u.UserId
    LEFT JOIN dbo.TechnicianProfiles tp ON t.UserId = tp.UserId
    WHERE ta.ComplaintId = @ComplaintId
      AND ta.Status <> 'Removed'
    ORDER BY ta.AssignedAt DESC;

    -- Table 2: Timeline = status changes + technician assignment events
    SELECT x.TimelineId, x.AuditId, x.StatusName, x.StatusColor, x.Action, x.Remarks,
           x.ActionAt, x.ChangedAt, x.ActionByName, x.ChangedByName, x.TechnicianName, x.NewRole
    FROM
    (
        SELECT
            tl.TimelineId,
            tl.TimelineId                      AS AuditId,
            ISNULL(cs.StatusName, '')          AS StatusName,
            cs.StatusColor,
            ISNULL(cs.StatusName, 'Update')    AS Action,
            tl.Remarks,
            ISNULL(tl.ActionAt, tl.CreatedAt)  AS ActionAt,
            ISNULL(tl.ActionAt, tl.CreatedAt)  AS ChangedAt,
            ab.FullName                        AS ActionByName,
            ab.FullName                        AS ChangedByName,
            CAST(NULL AS NVARCHAR(150))        AS TechnicianName,
            CAST(NULL AS NVARCHAR(20))         AS NewRole
        FROM dbo.ComplaintTimeline tl
        LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = tl.StatusId
        LEFT JOIN dbo.Users ab ON ab.UserId = tl.ActionBy
        WHERE tl.ComplaintId = @ComplaintId

        UNION ALL

        SELECT
            -al.AuditId,                       -- negative: never clashes with a TimelineId
            al.AuditId,
            al.Action                          AS StatusName,
            CAST(NULL AS NVARCHAR(7))          AS StatusColor,
            al.Action,
            al.Remarks,
            ISNULL(al.ChangedAt, al.CreatedAt),
            ISNULL(al.ChangedAt, al.CreatedAt),
            cb.FullName,
            cb.FullName,
            nu.FullName,
            al.NewRole
        FROM dbo.AssignmentAuditLog al
        LEFT JOIN dbo.TechnicianAssignments ta ON ta.AssignmentId = al.AssignmentId
        LEFT JOIN dbo.Users cb       ON al.ChangedBy = cb.UserId
        LEFT JOIN dbo.Technicians nt ON al.NewTechnicianId = nt.TechnicianId
        LEFT JOIN dbo.Users nu       ON nt.UserId = nu.UserId
        WHERE ISNULL(al.ComplaintId, ta.ComplaintId) = @ComplaintId
    ) x
    ORDER BY x.ActionAt DESC;
END
GO

/* =============================================================================
   7. Customer actions on the own complaint
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_UpdateComplaint
    @UserId      INT,
    @ComplaintId INT,
    @Subject     NVARCHAR(200)  = NULL,
    @Description NVARCHAR(MAX)  = NULL,
    @Priority    NVARCHAR(20)   = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StatusName NVARCHAR(50);

    SELECT @StatusName = ISNULL(cs.StatusName, '')
    FROM dbo.Complaints c
    INNER JOIN dbo.Customers cu ON cu.CustomerId = c.CustomerId AND cu.UserId = @UserId
    LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = c.StatusId
    WHERE c.ComplaintId = @ComplaintId AND ISNULL(c.IsActive, 1) = 1;

    IF @StatusName IS NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, 'Complaint not found' AS Message; RETURN;
    END
    IF @StatusName IN ('Closed', 'WorkCompleted', 'Cancelled')
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, 'A ' + @StatusName + ' complaint cannot be changed' AS Message; RETURN;
    END

    UPDATE dbo.Complaints
    SET Subject     = ISNULL(NULLIF(@Subject, ''), Subject),
        Description = ISNULL(NULLIF(@Description, ''), Description),
        Priority    = ISNULL(NULLIF(@Priority, ''), Priority),
        UpdatedAt   = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ComplaintId = @ComplaintId;

    SELECT CAST(1 AS BIT) AS Success, 'Complaint updated successfully' AS Message;
END
GO

/* Soft delete (IsActive = 0): only before a technician started on it */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_DeleteComplaint
    @UserId      INT,
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1
                   FROM dbo.Complaints c
                   INNER JOIN dbo.Customers cu ON cu.CustomerId = c.CustomerId AND cu.UserId = @UserId
                   WHERE c.ComplaintId = @ComplaintId AND ISNULL(c.IsActive, 1) = 1)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, 'Complaint not found' AS Message; RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.TechnicianAssignments
               WHERE ComplaintId = @ComplaintId AND Status IN ('Assigned', 'InProgress', 'Active', 'Completed'))
    BEGIN
        SELECT CAST(0 AS BIT) AS Success,
               'A technician is already assigned to this complaint. Please contact support to cancel it.' AS Message;
        RETURN;
    END

    UPDATE dbo.Complaints
    SET IsActive = 0, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ComplaintId = @ComplaintId;

    INSERT INTO dbo.ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy, ActionAt)
    SELECT c.ComplaintId, c.StatusId, 'Complaint deleted by customer', @UserId, DATEADD(MINUTE, 330, GETUTCDATE())
    FROM dbo.Complaints c WHERE c.ComplaintId = @ComplaintId;

    SELECT CAST(1 AS BIT) AS Success, 'Complaint deleted successfully' AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Customer_ConfirmClosure
    @UserId      INT,
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ClosedStatusId INT, @StatusName NVARCHAR(50),
            @Now DATETIME2 = DATEADD(MINUTE, 330, GETUTCDATE());

    SELECT @StatusName = ISNULL(cs.StatusName, '')
    FROM dbo.Complaints c
    INNER JOIN dbo.Customers cu ON cu.CustomerId = c.CustomerId AND cu.UserId = @UserId
    LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = c.StatusId
    WHERE c.ComplaintId = @ComplaintId AND ISNULL(c.IsActive, 1) = 1;

    IF @StatusName IS NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, 'Complaint not found' AS Message; RETURN;
    END
    IF @StatusName = 'Closed'
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, 'Complaint is already closed' AS Message; RETURN;
    END

    SELECT @ClosedStatusId = StatusId FROM dbo.ComplaintStatuses WHERE StatusName = 'Closed';
    IF @ClosedStatusId IS NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, 'Status ''Closed'' is not configured' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    UPDATE dbo.Complaints
    SET StatusId = @ClosedStatusId, IsCustomerConfirmed = 1, ClosedAt = @Now, UpdatedAt = @Now
    WHERE ComplaintId = @ComplaintId;

    UPDATE dbo.TechnicianAssignments
    SET Status = 'Completed', CompletedAt = ISNULL(CompletedAt, @Now)
    WHERE ComplaintId = @ComplaintId AND Status IN ('Assigned', 'InProgress', 'Active');

    INSERT INTO dbo.ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy, ActionAt)
    VALUES (@ComplaintId, @ClosedStatusId, 'Closure confirmed by customer', @UserId, @Now);

    COMMIT TRANSACTION;

    SELECT CAST(1 AS BIT) AS Success, 'Complaint closed. Thank you for confirming.' AS Message;
END
GO

PRINT 'ProjectDB customer portal procs applied.';
GO
