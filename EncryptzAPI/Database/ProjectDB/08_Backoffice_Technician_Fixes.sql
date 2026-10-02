/* =============================================================================
   ProjectDB · Back-office / technician fixes
   -----------------------------------------------------------------------------
     1. Spare requests           cost + reject reason columns
     2. Schedule conflicts       table for conflicts found between assignments
     3. sp_Assignment_UpdateStatus   complaint status by NAME (it wrote the ids of
                                     another numbering: a job "InProgress" showed
                                     WorkCompleted, a completed one "Assigned")
     4. Complaint statuses left wrong by (3)   one-off repair, safe to re-run
     5. sp_Complaint_GetForAssignment          open complaints by status name
     6. Spare request approve / reject         stock check, cost, reject reason
     7. Spare request lists                    + cost / reject reason / catalog stock
     8. sp_Technician_GetById                  no longer fails on missing tables
     9. sp_ScheduleConflict_Detect / _Resolve  work on TechnicianAssignments (the
                                               TechnicianSchedules table never existed)
    10. sp_Report_SLACompliance                end date inclusive, status by name
    11. Warranty returns                       create works (was failing on a mandatory
                                               column), list / detail read dbo.Customers
    12. sp_WorkOrder_GetDetails                complaint number was empty

   Run AFTER 04-07. SAFE TO RE-RUN.
   ============================================================================= */

/* =============================================================================
   1. Spare requests: what the part costs (fixed at approval) and why it was rejected
   ============================================================================= */
IF COL_LENGTH('dbo.SparePartRequests', 'UnitPrice') IS NULL
    ALTER TABLE dbo.SparePartRequests ADD UnitPrice DECIMAL(10,2) NULL;
IF COL_LENGTH('dbo.SparePartRequests', 'RejectReason') IS NULL
    ALTER TABLE dbo.SparePartRequests ADD RejectReason NVARCHAR(500) NULL;
GO

/* =============================================================================
   2. Schedule conflicts between assignments
   ============================================================================= */
IF OBJECT_ID('dbo.AssignmentConflicts') IS NULL
BEGIN
    CREATE TABLE dbo.AssignmentConflicts
    (
        ConflictId     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AssignmentConflicts PRIMARY KEY,
        Assignment1Id  INT           NOT NULL,
        Assignment2Id  INT           NOT NULL,
        TechnicianId   INT           NOT NULL,
        ConflictDate   DATE          NOT NULL,
        Severity       INT           NOT NULL CONSTRAINT DF_AssignmentConflicts_Severity DEFAULT (2),   -- 1 critical, 2 warning
        IsResolved     BIT           NOT NULL CONSTRAINT DF_AssignmentConflicts_IsResolved DEFAULT (0),
        Resolution     NVARCHAR(500) NULL,
        ResolvedBy     INT           NULL,
        ResolvedAt     DATETIME2     NULL,
        CreatedAt      DATETIME2     NOT NULL CONSTRAINT DF_AssignmentConflicts_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
        -- scope: stamped from the API's SESSION_CONTEXT like every business table (04)
        CompanyId      INT NOT NULL CONSTRAINT DF_AssignmentConflicts_CompanyId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'CompanyId')), 0)),
        ProjectId      INT NOT NULL CONSTRAINT DF_AssignmentConflicts_ProjectId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'ProjectId')), 0)),
        LocationId     INT NOT NULL CONSTRAINT DF_AssignmentConflicts_LocationId DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'LocationId')), 0)),
        CONSTRAINT UQ_AssignmentConflicts_Pair UNIQUE (Assignment1Id, Assignment2Id)
    );
END
GO

/* the row filter (05) was built before this table existed */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantScopePolicy')
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.AssignmentConflicts'))
    EXEC ('ALTER SECURITY POLICY Security.TenantScopePolicy
               ADD FILTER PREDICATE Security.fn_LocationScope(ProjectId, LocationId) ON dbo.AssignmentConflicts');
GO

/* =============================================================================
   3. Technician starts / completes a work order
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Assignment_UpdateStatus
    @AssignmentId      INT,
    @Status            NVARCHAR(30),
    @UpdatedBy         INT,
    @Remarks           NVARCHAR(500)  = NULL,
    @WorkDone          NVARCHAR(1000) = NULL,
    @PartsUsed         NVARCHAR(500)  = NULL,
    @CustomerFeedback  NVARCHAR(500)  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.TechnicianAssignments
        WHERE AssignmentId = @AssignmentId
          AND Status NOT IN ('Removed', 'Completed')
    )
    BEGIN
        SELECT 0 AS Result, 'Assignment not found or already closed' AS [Message];
        RETURN;
    END

    IF @Status = 'Completed' AND ISNULL(LTRIM(RTRIM(@WorkDone)), '') = ''
    BEGIN
        SELECT 0 AS Result, 'Work performed is required to complete a work order' AS [Message];
        RETURN;
    END

    DECLARE @ComplaintId INT, @TechnicianId INT,
            @Now DATETIME2 = DATEADD(MINUTE, 330, GETUTCDATE());

    SELECT @ComplaintId = ComplaintId, @TechnicianId = TechnicianId
    FROM   dbo.TechnicianAssignments
    WHERE  AssignmentId = @AssignmentId;

    -- complaint statuses by NAME: the ids differ between databases
    DECLARE @StInProgress INT    = (SELECT TOP 1 StatusId FROM dbo.ComplaintStatuses WHERE StatusName = 'InProgress'),
            @StWorkCompleted INT = (SELECT TOP 1 StatusId FROM dbo.ComplaintStatuses WHERE StatusName = 'WorkCompleted');
    DECLARE @Open TABLE (StatusId INT);     -- statuses a complaint can still move on from
    INSERT INTO @Open (StatusId)
    SELECT StatusId FROM dbo.ComplaintStatuses WHERE StatusName IN ('New', 'Assigned', 'InProgress', 'OnHold');

    UPDATE dbo.TechnicianAssignments
    SET Status             = @Status,
        CompletedAt        = CASE WHEN @Status = 'Completed' THEN @Now ELSE CompletedAt END,
        WorkDone           = CASE WHEN @Status = 'Completed' THEN @WorkDone ELSE WorkDone END,
        PartsUsed          = CASE WHEN @Status = 'Completed' THEN @PartsUsed ELSE PartsUsed END,
        CustomerFeedback   = CASE WHEN @Status = 'Completed' THEN @CustomerFeedback ELSE CustomerFeedback END,
        CompletionRemarks  = CASE WHEN @Status = 'Completed' THEN @Remarks ELSE CompletionRemarks END,
        UpdatedAt          = @Now
    WHERE AssignmentId = @AssignmentId;

    INSERT INTO dbo.AssignmentAuditLog
        (AssignmentId, ComplaintId, Action, NewTechnicianId, NewRole, ChangedBy, Remarks)
    SELECT
        @AssignmentId, @ComplaintId,
        CASE @Status
            WHEN 'Completed'  THEN 'Completed'
            WHEN 'InProgress' THEN 'InProgress'
            ELSE 'Modified'
        END,
        @TechnicianId, AssignmentRole,
        @UpdatedBy,
        ISNULL(@Remarks, 'Status changed to ' + @Status)
    FROM dbo.TechnicianAssignments WHERE AssignmentId = @AssignmentId;

    -- work started: the complaint is in progress
    IF @Status = 'InProgress' AND @StInProgress IS NOT NULL
    BEGIN
        UPDATE dbo.Complaints
        SET StatusId     = @StInProgress,
            AssignedDate = ISNULL(AssignedDate, @Now),
            UpdatedAt    = @Now
        WHERE ComplaintId = @ComplaintId
          AND StatusId IN (SELECT StatusId FROM @Open);
    END

    IF @Status = 'Completed'
    BEGIN
        UPDATE dbo.TechnicianProfiles
        SET TotalCompletedJobs = ISNULL(TotalCompletedJobs, 0) + 1
        WHERE UserId = (SELECT UserId FROM dbo.Technicians WHERE TechnicianId = @TechnicianId);

        -- free the technician when nothing else is open
        IF NOT EXISTS (
            SELECT 1 FROM dbo.TechnicianAssignments
            WHERE TechnicianId = @TechnicianId
              AND Status NOT IN ('Removed', 'Completed')
              AND AssignmentId <> @AssignmentId
        )
        BEGIN
            UPDATE dbo.TechnicianProfiles
            SET AvailabilityStatus = 1  -- Available
            WHERE UserId = (SELECT UserId FROM dbo.Technicians WHERE TechnicianId = @TechnicianId);
        END

        -- every assignment of the complaint is done: the work is completed
        IF @StWorkCompleted IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM dbo.TechnicianAssignments
            WHERE ComplaintId = @ComplaintId
              AND Status NOT IN ('Removed', 'Completed')
        )
        BEGIN
            UPDATE dbo.Complaints
            SET StatusId     = @StWorkCompleted,
                ResolvedDate = @Now,
                UpdatedAt    = @Now
            WHERE ComplaintId = @ComplaintId
              AND StatusId IN (SELECT StatusId FROM @Open);
        END
    END

    SELECT 1 AS Result, 'Status updated to ' + @Status AS [Message];
END
GO

/* =============================================================================
   4. Repair the complaint statuses written by the old proc
      (a) every assignment completed, complaint still shown as "Assigned"
      (b) work only started, complaint already shown as "WorkCompleted"
   ============================================================================= */
DECLARE @StAssigned INT      = (SELECT TOP 1 StatusId FROM dbo.ComplaintStatuses WHERE StatusName = 'Assigned'),
        @StInProgress INT    = (SELECT TOP 1 StatusId FROM dbo.ComplaintStatuses WHERE StatusName = 'InProgress'),
        @StWorkCompleted INT = (SELECT TOP 1 StatusId FROM dbo.ComplaintStatuses WHERE StatusName = 'WorkCompleted');

IF @StAssigned IS NOT NULL AND @StWorkCompleted IS NOT NULL
BEGIN
    UPDATE c
    SET StatusId = @StWorkCompleted, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    FROM dbo.Complaints c
    WHERE c.StatusId = @StAssigned
      AND EXISTS (SELECT 1 FROM dbo.TechnicianAssignments a
                  WHERE a.ComplaintId = c.ComplaintId AND a.Status = 'Completed')
      AND NOT EXISTS (SELECT 1 FROM dbo.TechnicianAssignments a
                      WHERE a.ComplaintId = c.ComplaintId AND a.Status NOT IN ('Removed', 'Cancelled', 'Completed'));

    IF @@ROWCOUNT > 0 PRINT 'Complaint status repaired: completed work shown as Assigned -> WorkCompleted';
END

IF @StInProgress IS NOT NULL AND @StWorkCompleted IS NOT NULL
BEGIN
    UPDATE c
    SET StatusId = @StInProgress, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    FROM dbo.Complaints c
    WHERE c.StatusId = @StWorkCompleted
      AND EXISTS (SELECT 1 FROM dbo.TechnicianAssignments a
                  WHERE a.ComplaintId = c.ComplaintId AND a.Status = 'InProgress')
      AND NOT EXISTS (SELECT 1 FROM dbo.TechnicianAssignments a
                      WHERE a.ComplaintId = c.ComplaintId AND a.Status = 'Completed');

    IF @@ROWCOUNT > 0 PRINT 'Complaint status repaired: work in progress shown as WorkCompleted -> InProgress';
END
GO

/* =============================================================================
   5. Complaints that can still be assigned (search by number, subject, customer)
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Complaint_GetForAssignment
    @SearchTerm    NVARCHAR(100) = NULL,
    @IncludeClosed BIT           = 0     -- 1 = also completed / closed ones (warranty returns)
AS
BEGIN
    SET NOCOUNT ON;

    SET @SearchTerm = NULLIF(LTRIM(RTRIM(@SearchTerm)), '');

    SELECT TOP 20
        c.ComplaintId,
        c.ComplaintNumber,
        c.Subject,
        cu.CustomerName,
        cu.MobileNumber AS CustomerPhone,
        cu.City AS CustomerPlace,
        c.Priority,
        c.StatusId
    FROM dbo.Complaints c
    INNER JOIN dbo.Customers cu ON c.CustomerId = cu.CustomerId
    LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = c.StatusId
    WHERE (   (ISNULL(@IncludeClosed, 0) = 1 AND ISNULL(cs.StatusName, '') <> 'Cancelled')
           OR ISNULL(cs.StatusName, '') NOT IN ('WorkCompleted', 'Closed', 'Cancelled'))
      AND ISNULL(c.IsActive, 1) = 1
      AND (@SearchTerm IS NULL
           OR c.ComplaintNumber LIKE '%' + @SearchTerm + '%'
           OR c.Subject LIKE '%' + @SearchTerm + '%'
           OR cu.CustomerName LIKE '%' + @SearchTerm + '%'
           OR cu.MobileNumber LIKE '%' + @SearchTerm + '%')
    ORDER BY c.CreatedAt DESC;
END
GO

/* =============================================================================
   6. Approve / reject / dispatch a spare request
      Result: 1 done · 0 refused · 2 not enough stock (ask, then send @AllowNoStock = 1)
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_SparePart_UpdateRequestStatus
    @RequestId    INT,
    @Status       NVARCHAR(30),            -- Approved | Rejected | Dispatched | Used
    @ApprovedBy   INT,
    @RejectReason NVARCHAR(500)  = NULL,
    @UnitPrice    DECIMAL(10,2)  = NULL,   -- cost per unit, fixed at approval
    @AllowNoStock BIT            = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SparePartId INT, @Quantity INT, @Stock INT, @CatalogPrice DECIMAL(10,2),
            @PartName NVARCHAR(200), @Found BIT = 0,
            @Now DATETIME2 = DATEADD(MINUTE, 330, GETUTCDATE());

    SELECT @Found = 1, @SparePartId = r.SparePartId, @Quantity = r.Quantity,
           @Stock = sp.StockQuantity, @CatalogPrice = sp.UnitPrice,
           @PartName = ISNULL(r.PartName, sp.PartName)
    FROM dbo.SparePartRequests r
    LEFT JOIN dbo.SpareParts sp ON sp.SparePartId = r.SparePartId
    WHERE r.RequestId = @RequestId;

    IF @Found = 0
    BEGIN
        SELECT 0 AS Result, 'Request not found' AS [Message]; RETURN;
    END

    IF @Status = 'Rejected' AND ISNULL(LTRIM(RTRIM(@RejectReason)), '') = ''
    BEGIN
        SELECT 0 AS Result, 'A reason is required to reject a request' AS [Message]; RETURN;
    END

    -- a catalog part: is there enough of it? (custom parts have no stock to check)
    IF @Status = 'Approved' AND @SparePartId IS NOT NULL
       AND ISNULL(@Stock, 0) < @Quantity AND ISNULL(@AllowNoStock, 0) = 0
    BEGIN
        SELECT 2 AS Result,
               '''' + ISNULL(@PartName, 'This part') + ''' has ' + CAST(ISNULL(@Stock, 0) AS VARCHAR(12))
               + ' in stock, ' + CAST(@Quantity AS VARCHAR(12)) + ' requested.' AS [Message];
        RETURN;
    END

    UPDATE dbo.SparePartRequests
    SET Status       = @Status,
        ApprovedBy   = CASE WHEN @Status IN ('Approved', 'Rejected') THEN @ApprovedBy ELSE ApprovedBy END,
        ApprovedAt   = CASE WHEN @Status IN ('Approved', 'Rejected') THEN @Now ELSE ApprovedAt END,
        UnitPrice    = CASE WHEN @Status = 'Approved' THEN COALESCE(@UnitPrice, UnitPrice, @CatalogPrice) ELSE UnitPrice END,
        RejectReason = CASE WHEN @Status = 'Rejected' THEN LTRIM(RTRIM(@RejectReason)) ELSE RejectReason END,
        UpdatedAt    = @Now
    WHERE RequestId = @RequestId;

    SELECT 1 AS Result, 'Request ' + @Status AS [Message];
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_SparePart_BulkUpdateStatus
    @RequestIds   NVARCHAR(MAX),   -- comma-separated: '1,2,3'
    @Status       NVARCHAR(30),
    @ApprovedBy   INT,
    @RejectReason NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Status = 'Rejected' AND ISNULL(LTRIM(RTRIM(@RejectReason)), '') = ''
    BEGIN
        SELECT 0 AS UpdatedCount, 'A reason is required to reject requests' AS [Message]; RETURN;
    END

    DECLARE @Ids TABLE (RequestId INT PRIMARY KEY);
    INSERT INTO @Ids (RequestId)
    SELECT DISTINCT TRY_CAST(value AS INT) FROM STRING_SPLIT(@RequestIds, ',') WHERE TRY_CAST(value AS INT) IS NOT NULL;

    DECLARE @Now DATETIME2 = DATEADD(MINUTE, 330, GETUTCDATE()), @Updated INT, @Skipped INT = 0;

    -- catalog parts without enough stock are left for a one-by-one decision
    IF @Status = 'Approved'
    BEGIN
        DELETE i
        FROM @Ids i
        INNER JOIN dbo.SparePartRequests r ON r.RequestId = i.RequestId
        INNER JOIN dbo.SpareParts sp       ON sp.SparePartId = r.SparePartId
        WHERE ISNULL(sp.StockQuantity, 0) < r.Quantity;

        SET @Skipped = @@ROWCOUNT;
    END

    UPDATE r
    SET Status       = @Status,
        ApprovedBy   = CASE WHEN @Status IN ('Approved', 'Rejected') THEN @ApprovedBy ELSE r.ApprovedBy END,
        ApprovedAt   = CASE WHEN @Status IN ('Approved', 'Rejected') THEN @Now ELSE r.ApprovedAt END,
        UnitPrice    = CASE WHEN @Status = 'Approved' THEN COALESCE(r.UnitPrice, sp.UnitPrice) ELSE r.UnitPrice END,
        RejectReason = CASE WHEN @Status = 'Rejected' THEN LTRIM(RTRIM(@RejectReason)) ELSE r.RejectReason END,
        UpdatedAt    = @Now
    FROM dbo.SparePartRequests r
    INNER JOIN @Ids i            ON i.RequestId = r.RequestId
    LEFT JOIN dbo.SpareParts sp  ON sp.SparePartId = r.SparePartId;

    SET @Updated = @@ROWCOUNT;

    SELECT @Updated AS UpdatedCount,
           @Status + ' applied to ' + CAST(@Updated AS NVARCHAR(12)) + ' request(s)'
           + CASE WHEN @Skipped > 0
                  THEN '; ' + CAST(@Skipped AS NVARCHAR(12)) + ' not approved: not enough stock (approve them one by one)'
                  ELSE '' END AS [Message];
END
GO

/* =============================================================================
   7. Spare request lists: cost, reject reason, and "is it a catalog part at all"
      (StockQuantity is NULL for a custom part — it is not "0 in stock")
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_SparePart_GetAdminRequests
    @Status       NVARCHAR(30)  = NULL,   -- NULL = all
    @UrgencyLevel NVARCHAR(20)  = NULL,
    @ComplaintId  INT           = NULL,
    @PageNumber   INT           = 1,
    @PageSize     INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(@PageNumber, 0) < 1 SET @PageNumber = 1;
    IF ISNULL(@PageSize, 0)   < 1 SET @PageSize   = 20;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    SELECT
        r.RequestId,
        r.ComplaintId,
        c.ComplaintNumber,
        c.Subject             AS ComplaintSubject,
        r.SparePartId,
        ISNULL(r.PartName, sp.PartName)     AS PartName,
        ISNULL(r.PartNumber, sp.PartNumber) AS PartNumber,
        sp.StockQuantity,
        CAST(CASE WHEN sp.SparePartId IS NULL THEN 0 ELSE 1 END AS BIT) AS IsCatalogPart,
        sp.UnitPrice          AS CatalogUnitPrice,
        r.UnitPrice,
        r.RejectReason,
        r.Quantity,
        r.Status,
        r.UrgencyLevel,
        r.Remarks,
        r.RequestedAt,
        r.ApprovedBy,
        r.ApprovedAt,
        appr.FullName         AS ApprovedByName,
        tech_user.FullName    AS TechnicianName,
        r.TechnicianId,
        cu.CustomerName,
        cu.MobileNumber       AS CustomerPhone,
        COUNT(*) OVER()       AS TotalCount
    FROM  dbo.SparePartRequests     r
    LEFT JOIN dbo.SpareParts        sp   ON sp.SparePartId    = r.SparePartId
    INNER JOIN dbo.Complaints        c    ON c.ComplaintId     = r.ComplaintId
    INNER JOIN dbo.Customers         cu   ON cu.CustomerId     = c.CustomerId
    INNER JOIN dbo.Technicians       tech ON tech.TechnicianId = r.TechnicianId
    INNER JOIN dbo.Users             tech_user ON tech_user.UserId = tech.UserId
    LEFT  JOIN dbo.Users             appr ON appr.UserId       = r.ApprovedBy
    WHERE (@Status       IS NULL OR r.Status       = @Status)
      AND (@UrgencyLevel IS NULL OR r.UrgencyLevel = @UrgencyLevel)
      AND (@ComplaintId  IS NULL OR r.ComplaintId  = @ComplaintId)
    ORDER BY
        CASE r.UrgencyLevel
            WHEN 'Critical' THEN 1
            WHEN 'Urgent'   THEN 2
            ELSE 3
        END,
        r.RequestedAt DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_SparePart_GetByComplaint
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        r.RequestId,
        r.SparePartId,
        ISNULL(r.PartName,   sp.PartName)   AS PartName,
        ISNULL(r.PartNumber, sp.PartNumber) AS PartNumber,
        ISNULL(r.UnitPrice, sp.UnitPrice)   AS UnitPrice,     -- approved cost, else catalog price
        r.RejectReason,
        r.Quantity,
        r.Status,
        r.UrgencyLevel,
        r.Remarks,
        r.RequestedAt,
        r.ApprovedAt,
        tech_user.FullName  AS TechnicianName,
        appr.FullName       AS ApprovedByName
    FROM  dbo.SparePartRequests r
    LEFT JOIN dbo.SpareParts   sp        ON sp.SparePartId    = r.SparePartId
    INNER JOIN dbo.Technicians  tech      ON tech.TechnicianId = r.TechnicianId
    INNER JOIN dbo.Users        tech_user ON tech_user.UserId  = tech.UserId
    LEFT  JOIN dbo.Users        appr      ON appr.UserId       = r.ApprovedBy
    WHERE r.ComplaintId = @ComplaintId
    ORDER BY r.RequestedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_SparePart_GetRequests
    @TechnicianId INT = NULL,
    @ComplaintId  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        r.RequestId,
        r.ComplaintId,
        r.SparePartId,
        ISNULL(r.PartName, sp.PartName)       AS PartName,
        ISNULL(r.PartNumber, sp.PartNumber)   AS PartNumber,
        r.Quantity,
        r.Status,
        r.RequestedAt,
        r.Remarks,
        r.RejectReason,
        ISNULL(r.UnitPrice, sp.UnitPrice)     AS UnitPrice,
        r.UrgencyLevel,
        u.FullName  AS ApprovedByName,
        r.ApprovedAt
    FROM  dbo.SparePartRequests r
    LEFT JOIN dbo.SpareParts   sp ON sp.SparePartId = r.SparePartId
    LEFT JOIN dbo.Users        u  ON u.UserId       = r.ApprovedBy
    WHERE (@TechnicianId IS NULL OR r.TechnicianId = @TechnicianId)
      AND (@ComplaintId  IS NULL OR r.ComplaintId  = @ComplaintId)
    ORDER BY r.RequestedAt DESC;
END
GO

/* =============================================================================
   8. Technician profile by id (the skills / schedules tables are optional)
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Technician_GetById
    @TechnicianId INT       -- TechnicianProfiles.ProfileId
AS
BEGIN
    SET NOCOUNT ON;

    SELECT tp.*, u.FullName, u.Email, u.Phone, u.ProfileImage,
        (SELECT COUNT(*) FROM dbo.Complaints c
          WHERE c.AssignedTechnicianId = tp.UserId AND ISNULL(c.IsActive, 1) = 1) AS TotalAssigned,
        (SELECT COUNT(*) FROM dbo.Complaints c
          INNER JOIN dbo.ComplaintStatuses cs ON cs.StatusId = c.StatusId
          WHERE c.AssignedTechnicianId = tp.UserId AND ISNULL(c.IsActive, 1) = 1
            AND cs.StatusName IN ('WorkCompleted', 'Closed')) AS TotalResolved,
        (SELECT AVG(CAST(DATEDIFF(HOUR, c.AssignedDate, c.ResolvedDate) AS FLOAT)) FROM dbo.Complaints c
          WHERE c.AssignedTechnicianId = tp.UserId AND c.ResolvedDate IS NOT NULL) AS AvgResolutionHours
    FROM dbo.TechnicianProfiles tp
    INNER JOIN dbo.Users u ON tp.UserId = u.UserId
    WHERE tp.ProfileId = @TechnicianId;

    IF OBJECT_ID('dbo.TechnicianSkills') IS NOT NULL
        EXEC sp_executesql N'SELECT * FROM dbo.TechnicianSkills WHERE TechnicianProfileId = @Id',
                           N'@Id INT', @Id = @TechnicianId;
END
GO

/* =============================================================================
   9. Schedule conflicts: two open assignments of ONE technician that overlap
      on the day (by start / end time; by time slot when no times are set)
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_ScheduleConflict_Detect
    @ScheduleDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @ScheduleDate IS NULL
        SET @ScheduleDate = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT a.AssignmentId, a.TechnicianId, a.Priority,
           TRY_CONVERT(TIME, a.StartTime)      AS StartAt,
           TRY_CONVERT(TIME, a.EndTime)        AS EndAt,
           NULLIF(LTRIM(RTRIM(a.TimeSlot)), '') AS TimeSlot
    INTO #Slots
    FROM dbo.TechnicianAssignments a
    WHERE a.ScheduledDate = @ScheduleDate
      AND ISNULL(a.Status, '') NOT IN ('Removed', 'Cancelled', 'Completed');

    SELECT s1.AssignmentId AS Assignment1Id, s2.AssignmentId AS Assignment2Id, s1.TechnicianId,
           CASE WHEN 'Critical' IN (s1.Priority, s2.Priority) THEN 1 ELSE 2 END AS Severity
    INTO #Overlaps
    FROM #Slots s1
    INNER JOIN #Slots s2 ON s2.TechnicianId = s1.TechnicianId AND s1.AssignmentId < s2.AssignmentId
    WHERE (    s1.StartAt IS NOT NULL AND s1.EndAt IS NOT NULL
           AND s2.StartAt IS NOT NULL AND s2.EndAt IS NOT NULL
           AND s1.StartAt < s2.EndAt AND s1.EndAt > s2.StartAt)
       OR (   (s1.StartAt IS NULL OR s1.EndAt IS NULL OR s2.StartAt IS NULL OR s2.EndAt IS NULL)
           AND s1.TimeSlot IS NOT NULL AND s1.TimeSlot = s2.TimeSlot);

    -- an open conflict that was rescheduled away is gone
    DELETE ac
    FROM dbo.AssignmentConflicts ac
    WHERE ac.ConflictDate = @ScheduleDate AND ac.IsResolved = 0
      AND NOT EXISTS (SELECT 1 FROM #Overlaps o
                      WHERE o.Assignment1Id = ac.Assignment1Id AND o.Assignment2Id = ac.Assignment2Id);

    INSERT INTO dbo.AssignmentConflicts (Assignment1Id, Assignment2Id, TechnicianId, ConflictDate, Severity)
    SELECT o.Assignment1Id, o.Assignment2Id, o.TechnicianId, @ScheduleDate, o.Severity
    FROM #Overlaps o
    WHERE NOT EXISTS (SELECT 1 FROM dbo.AssignmentConflicts ac
                      WHERE ac.Assignment1Id = o.Assignment1Id AND ac.Assignment2Id = o.Assignment2Id);

    SELECT
        ac.ConflictId,
        ac.Assignment1Id                          AS Schedule1Id,
        ac.Assignment2Id                          AS Schedule2Id,
        ac.TechnicianId,
        u.FullName                                AS TechnicianName,
        ISNULL(tp.EmployeeCode, '')               AS EmployeeCode,
        ac.ConflictDate,
        1                                         AS ConflictType,
        ac.Severity,
        TRY_CONVERT(TIME, a1.StartTime)           AS Schedule1Start,
        TRY_CONVERT(TIME, a1.EndTime)             AS Schedule1End,
        1                                         AS Schedule1Type,
        TRY_CONVERT(TIME, a2.StartTime)           AS Schedule2Start,
        TRY_CONVERT(TIME, a2.EndTime)             AS Schedule2End,
        1                                         AS Schedule2Type,
        ISNULL(c1.ComplaintNumber, '')            AS Complaint1No,
        ISNULL(c2.ComplaintNumber, '')            AS Complaint2No,
        ac.IsResolved
    FROM dbo.AssignmentConflicts ac
    INNER JOIN dbo.TechnicianAssignments a1 ON a1.AssignmentId = ac.Assignment1Id
    INNER JOIN dbo.TechnicianAssignments a2 ON a2.AssignmentId = ac.Assignment2Id
    INNER JOIN dbo.Technicians t            ON t.TechnicianId  = ac.TechnicianId
    INNER JOIN dbo.Users u                  ON u.UserId        = t.UserId
    LEFT JOIN dbo.TechnicianProfiles tp     ON tp.UserId       = t.UserId
    LEFT JOIN dbo.Complaints c1             ON c1.ComplaintId  = a1.ComplaintId
    LEFT JOIN dbo.Complaints c2             ON c2.ComplaintId  = a2.ComplaintId
    WHERE ac.ConflictDate = @ScheduleDate
    ORDER BY ac.IsResolved ASC, ac.Severity ASC, ac.ConflictId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ScheduleConflict_Resolve
    @ConflictId  INT,
    @Resolution  NVARCHAR(500),
    @ResolvedBy  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.AssignmentConflicts WHERE ConflictId = @ConflictId)
    BEGIN
        SELECT 0 AS ConflictId, 'Conflict not found' AS [Message];
        RETURN;
    END

    UPDATE dbo.AssignmentConflicts
    SET IsResolved = 1,
        Resolution = @Resolution,
        ResolvedBy = @ResolvedBy,
        ResolvedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE ConflictId = @ConflictId;

    SELECT @ConflictId AS ConflictId, 'Conflict resolved' AS [Message];
END
GO

/* =============================================================================
   10. SLA compliance by priority
       - the end date is inclusive (complaints of that day were left out)
       - "resolved" = status WorkCompleted / Closed by name
       - CompliancePercent is NULL when there is nothing to measure (not 0 %)
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Report_SLACompliance
    @StartDate  DATETIME,
    @EndDate    DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @From DATETIME = CAST(CAST(@StartDate AS DATE) AS DATETIME),
            @Until DATETIME = DATEADD(DAY, 1, CAST(CAST(@EndDate AS DATE) AS DATETIME)),   -- exclusive
            @Now DATETIME = DATEADD(MINUTE, 330, GETUTCDATE());

    -- SLA target hours per priority
    DECLARE @SlaTargets TABLE (
        Priority    NVARCHAR(20),
        TargetHours INT,
        SortOrder   INT
    );
    INSERT INTO @SlaTargets VALUES
        ('Critical', 4,  1),
        ('High',     12, 2),
        ('Medium',   24, 3),
        ('Low',      48, 4);

    ;WITH ComplaintSla AS
    (
        SELECT
            c.ComplaintId,
            c.Priority,
            -- done: time until the work was completed; still open: time so far
            CASE
                WHEN cs.StatusName IN ('WorkCompleted', 'Closed')
                    THEN DATEDIFF(HOUR, c.CreatedAt, COALESCE(c.ResolvedDate, c.ClosedAt, c.UpdatedAt, @Now))
                ELSE DATEDIFF(HOUR, c.CreatedAt, @Now)
            END AS ResolutionHours
        FROM dbo.Complaints c
        LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = c.StatusId
        WHERE c.CreatedAt >= @From
          AND c.CreatedAt <  @Until
          AND ISNULL(c.IsActive, 1) = 1
    )
    SELECT
        st.Priority,
        COUNT(cs.ComplaintId)                                           AS Total,
        ISNULL(SUM(CASE
            WHEN cs.ResolutionHours <= st.TargetHours THEN 1 ELSE 0
        END), 0)                                                        AS WithinSla,
        ISNULL(SUM(CASE
            WHEN cs.ResolutionHours > st.TargetHours THEN 1 ELSE 0
        END), 0)                                                        AS Breached,
        CASE
            WHEN COUNT(cs.ComplaintId) = 0 THEN NULL
            ELSE CAST(
                SUM(CASE WHEN cs.ResolutionHours <= st.TargetHours THEN 1 ELSE 0 END)
                * 100.0 / COUNT(cs.ComplaintId) AS DECIMAL(5,1))
        END                                                             AS CompliancePercent,
        ISNULL(CAST(AVG(CAST(cs.ResolutionHours AS DECIMAL(10,1)))
            AS DECIMAL(10,1)), 0)                                       AS AvgResolutionHours,
        st.TargetHours                                                  AS SlaTargetHours
    FROM @SlaTargets st
    LEFT JOIN ComplaintSla cs ON cs.Priority = st.Priority
    GROUP BY st.Priority, st.TargetHours, st.SortOrder
    ORDER BY st.SortOrder;
END
GO

/* =============================================================================
   11. Warranty returns
       - a return is raised for a complaint, not for a spare part: SparePartId was
         mandatory but never filled, so every create failed
       - customer / product / warranty dates are taken from the complaint
       - the list joined the customer to dbo.Users instead of dbo.Customers
   ============================================================================= */
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.WarrantyReturns') AND name = 'SparePartId' AND is_nullable = 0)
    ALTER TABLE dbo.WarrantyReturns ALTER COLUMN SparePartId INT NULL;
GO

CREATE OR ALTER PROCEDURE dbo.sp_WarrantyReturn_Create
    @ComplaintId       INT,
    @CustomerId        INT           = NULL,
    @ProductId         INT           = NULL,
    @ProductSerialNo   VARCHAR(50)   = NULL,
    @WarrantyStartDate DATE          = NULL,
    @WarrantyEndDate   DATE          = NULL,
    @ReturnReason      NVARCHAR(500),
    @ReturnType        INT,
    @PickupAddress     NVARCHAR(500) = NULL,
    @CreatedBy         INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CmpCustomerId INT, @CmpProductId INT, @Found BIT = 0;
    SELECT @Found = 1, @CmpCustomerId = c.CustomerId, @CmpProductId = c.ProductId
    FROM dbo.Complaints c WHERE c.ComplaintId = @ComplaintId;

    IF @Found = 0
    BEGIN
        SELECT 0 AS ReturnId, CAST(NULL AS VARCHAR(20)) AS ReturnNo, 'Complaint not found' AS Message; RETURN;
    END
    IF ISNULL(LTRIM(RTRIM(@ReturnReason)), '') = ''
    BEGIN
        SELECT 0 AS ReturnId, CAST(NULL AS VARCHAR(20)) AS ReturnNo, 'Return reason is required' AS Message; RETURN;
    END
    IF ISNULL(@ReturnType, 0) NOT IN (1, 2, 3)
    BEGIN
        SELECT 0 AS ReturnId, CAST(NULL AS VARCHAR(20)) AS ReturnNo, 'Select a return type' AS Message; RETURN;
    END

    -- the complaint decides whose return it is and for which product
    SET @CustomerId = @CmpCustomerId;
    SET @ProductId  = ISNULL(@CmpProductId, NULLIF(@ProductId, 0));

    SELECT @ProductSerialNo   = ISNULL(NULLIF(LTRIM(RTRIM(@ProductSerialNo)), ''), LEFT(p.SerialNumber, 50)),
           @WarrantyStartDate = CASE WHEN @WarrantyStartDate IS NULL OR @WarrantyStartDate < '19000101' THEN p.PurchaseDate ELSE @WarrantyStartDate END,
           @WarrantyEndDate   = CASE WHEN @WarrantyEndDate   IS NULL OR @WarrantyEndDate   < '19000101' THEN p.WarrantyExpiryDate ELSE @WarrantyEndDate END
    FROM dbo.Products p WHERE p.ProductId = @ProductId;

    IF @WarrantyStartDate < '19000101' SET @WarrantyStartDate = NULL;
    IF @WarrantyEndDate   < '19000101' SET @WarrantyEndDate   = NULL;

    DECLARE @Now DATETIME = DATEADD(MINUTE, 330, GETUTCDATE()), @ReturnId INT, @ReturnNo VARCHAR(20);

    BEGIN TRANSACTION;

    INSERT INTO dbo.WarrantyReturns (ComplaintId, CustomerId, ProductId, ProductSerialNo, WarrantyStartDate, WarrantyEndDate,
                                     ReturnReason, ReturnType, StatusId, PickupAddress, CreatedBy, CreatedDate, IsActive)
    VALUES (@ComplaintId, @CustomerId, @ProductId, @ProductSerialNo, @WarrantyStartDate, @WarrantyEndDate,
            LTRIM(RTRIM(@ReturnReason)), @ReturnType, 1, @PickupAddress, @CreatedBy, @Now, 1);

    -- number from the row's own identity (unique across the projects sharing the database)
    SET @ReturnId = SCOPE_IDENTITY();
    SET @ReturnNo = 'WR-' + FORMAT(@Now, 'yyyyMMdd') + '-'
                  + CASE WHEN @ReturnId < 10000 THEN RIGHT('0000' + CAST(@ReturnId AS VARCHAR(10)), 4)
                         ELSE CAST(@ReturnId AS VARCHAR(10)) END;
    UPDATE dbo.WarrantyReturns SET ReturnNo = @ReturnNo WHERE ReturnId = @ReturnId;

    COMMIT TRANSACTION;

    SELECT @ReturnId AS ReturnId, @ReturnNo AS ReturnNo, 'Warranty return created' AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_WarrantyReturn_GetAll
    @SearchTerm NVARCHAR(100) = NULL,
    @StatusFilter INT = NULL,
    @ReturnTypeFilter INT = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    SET @SearchTerm = NULLIF(LTRIM(RTRIM(@SearchTerm)), '');
    IF ISNULL(@PageNumber, 0) < 1 SET @PageNumber = 1;
    IF ISNULL(@PageSize, 0)   < 1 SET @PageSize   = 10;

    SELECT wr.*,
        c.ComplaintNumber AS ComplaintNo, c.Subject AS ComplaintSubject,
        cu.CustomerName, cu.MobileNumber AS CustomerPhone,
        COUNT(*) OVER() AS TotalCount
    FROM dbo.WarrantyReturns wr
    INNER JOIN dbo.Complaints c ON wr.ComplaintId = c.ComplaintId
    LEFT JOIN dbo.Customers cu  ON cu.CustomerId = ISNULL(wr.CustomerId, c.CustomerId)
    WHERE ISNULL(wr.IsActive, 1) = 1
    AND (@SearchTerm IS NULL OR wr.ReturnNo LIKE '%'+@SearchTerm+'%' OR cu.CustomerName LIKE '%'+@SearchTerm+'%'
         OR wr.ProductSerialNo LIKE '%'+@SearchTerm+'%' OR c.ComplaintNumber LIKE '%'+@SearchTerm+'%')
    AND (@StatusFilter IS NULL OR wr.StatusId = @StatusFilter)
    AND (@ReturnTypeFilter IS NULL OR wr.ReturnType = @ReturnTypeFilter)
    ORDER BY wr.CreatedDate DESC, wr.ReturnId DESC
    OFFSET (@PageNumber-1)*@PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_WarrantyReturn_GetById
    @ReturnId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT wr.*, c.ComplaintNumber AS ComplaintNo, c.Subject AS ComplaintSubject, c.Description AS ComplaintDescription,
        cu.CustomerName, cu.Email AS CustomerEmail, cu.MobileNumber AS CustomerPhone
    FROM dbo.WarrantyReturns wr
    INNER JOIN dbo.Complaints c ON wr.ComplaintId = c.ComplaintId
    LEFT JOIN dbo.Customers cu  ON cu.CustomerId = ISNULL(wr.CustomerId, c.CustomerId)
    WHERE wr.ReturnId = @ReturnId;
END
GO

/* =============================================================================
   12. Work order detail: the complaint number was read from the unused column
       ComplaintNo and came back empty
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_WorkOrder_GetDetails
    @AssignmentId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Main Detail
    SELECT 
        a.AssignmentId,
        a.ComplaintId,
        ISNULL(c.ComplaintNumber, c.ComplaintNo) AS ComplaintNumber,
        c.Subject,
        c.Description,
        c.NatureOfJob,
        a.Priority,
        c.SLADeadline,
        c.CreatedAt as ComplaintCreatedAt,
        a.AssignmentRole,
        a.Status,
        st.StatusName,
        st.StatusColor,
        DATEADD(MINUTE, 330, a.AssignedAt) AS AssignedAt,
        a.CompletedAt,
        a.ScheduledDate,
        a.StartTime,
        a.EndTime,
        a.EstimatedDuration,
        a.TimeSlot,
        a.Notes,
        cust.CustomerName,
        cust.Address as CustomerAddress,
        cust.MobileNumber as CustomerPhone,
        cust.City,
        p.ProductName,
        p.SerialNumber,
        p.Brand,
        p.WarrantyExpiryDate,
        CASE WHEN c.SLADeadline < DATEADD(MINUTE, 330, GETUTCDATE()) AND a.Status <> 'Completed' THEN 1 ELSE 0 END as IsSLABreached
    FROM TechnicianAssignments a
    INNER JOIN Complaints c ON c.ComplaintId = a.ComplaintId
    LEFT JOIN Customers cust ON cust.CustomerId = c.CustomerId
    LEFT JOIN Products p ON p.ProductId = c.ProductId
    LEFT JOIN ComplaintStatuses st ON st.StatusId = c.StatusId
    WHERE a.AssignmentId = @AssignmentId;

    -- 2. Timeline (Audit Log)
    SELECT 
        al.AuditId,
        al.Action,
        al.Remarks,
        al.ChangedAt,
        u.FullName AS ChangedByName,
        t_old.FullName AS OldTechnicianName,
        t_new.FullName AS NewTechnicianName,
        al.OldRole,
        al.NewRole
    FROM AssignmentAuditLog al
    LEFT JOIN Users u ON u.UserId = al.ChangedBy
    LEFT JOIN Technicians tech_old ON tech_old.TechnicianId = al.OldTechnicianId
    LEFT JOIN Users t_old ON t_old.UserId = tech_old.UserId
    LEFT JOIN Technicians tech_new ON tech_new.TechnicianId = al.NewTechnicianId
    LEFT JOIN Users t_new ON t_new.UserId = tech_new.UserId
    WHERE al.AssignmentId = @AssignmentId
    ORDER BY al.ChangedAt ASC;

    -- 3. Service images
    SELECT 
        si.ImageId,
        si.ImageType,
        si.ImagePath,
        si.ImageData,
        si.UploadedAt
    FROM ServiceImages si
    WHERE si.ComplaintId = (SELECT ComplaintId FROM TechnicianAssignments WHERE AssignmentId = @AssignmentId)
    ORDER BY si.UploadedAt DESC;

    -- 4. Repair Details
    SELECT 
        r.RepairRequestId,
        r.PartName,
        r.PartSerialNumber,
        r.Notes,
        r.Status,
        r.CreatedAt,
        (SELECT COUNT(*) FROM RepairPartImages img WHERE img.RepairRequestId = r.RepairRequestId) as ImageCount
    FROM RepairPartRequests r
    WHERE r.AssignmentId = @AssignmentId
    ORDER BY r.CreatedAt DESC;
END
GO

PRINT 'ProjectDB back-office / technician fixes applied.';
GO
