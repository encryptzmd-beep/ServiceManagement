/* =============================================================================
   ProjectDB (company database) · 25 · One Despatch for sales and service
   -----------------------------------------------------------------------------
   Sales despatches stay in dbo.Despatches. A spare part or a repaired part that
   leaves for a job gets the same details (mode, reference, transporter) here:

     dbo.ServiceDespatches          one row per spare request or repair request
     dbo.sp_ServiceDespatch_List    waiting for despatch, or despatched
     dbo.sp_ServiceDespatch_Create  records the despatch and moves the request to
                                    Dispatched in one transaction
     dbo.sp_ServiceDespatch_AddDetails, dbo.sp_Despatch_AddDetails
                                    fill in the missing mode and reference of an older
                                    despatch; details already recorded are never changed

   Requests marked Dispatched before this script stay Dispatched and show without
   details until they are added. Stock is not changed by a despatch, as before.

   Runs AFTER 24_QA_Product_Job_Fixes.sql. Run in EACH company database (select it
   in SSMS first; no USE on purpose). SAFE TO RE-RUN.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

DECLARE @problem NVARCHAR(400);
IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
    SET @problem = 'You are connected to [' + DB_NAME() + ']. Select the company database first.';
ELSE IF OBJECT_ID('dbo.Companies') IS NOT NULL AND OBJECT_ID('dbo.CompanyUsers') IS NOT NULL AND OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is the SaaS main database. Select a company database.';
ELSE IF OBJECT_ID('dbo.Locations') IS NULL OR OBJECT_ID('dbo.SparePartRequests') IS NULL OR OBJECT_ID('dbo.RepairPartRequests') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database with spare and repair requests.';
ELSE IF COL_LENGTH('dbo.Despatches', 'DespatchMode') IS NULL
    SET @problem = 'Run 23_Sales_Documents_Despatch_Mode.sql first.';
IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.ServiceDespatches') IS NULL
BEGIN
    CREATE TABLE dbo.ServiceDespatches
    (
        ServiceDespatchId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ServiceDespatches PRIMARY KEY,
        DespatchNo      NVARCHAR(30)   NOT NULL,
        SourceType      NVARCHAR(10)   NOT NULL CONSTRAINT CK_ServiceDespatches_Source CHECK (SourceType IN ('Spare', 'Repair')),
        SourceId        INT            NOT NULL,
        ComplaintId     INT            NULL,
        DespatchDate    DATE           NOT NULL,
        DespatchMode    NVARCHAR(30)   NOT NULL,
        ReferenceNo     NVARCHAR(100)  NULL,
        ReferenceDate   DATE           NULL,
        TransporterName NVARCHAR(150)  NULL,
        VehicleNo       NVARCHAR(50)   NULL,
        DriverName      NVARCHAR(150)  NULL,
        Remarks         NVARCHAR(500)  NULL,
        CreatedBy       INT            NULL,
        CreatedAt       DATETIME2(7)   NOT NULL CONSTRAINT DF_ServiceDespatches_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
        CompanyId       INT            NOT NULL CONSTRAINT DF_ServiceDespatches_CompanyId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'CompanyId')), 0)),
        ProjectId       INT            NOT NULL CONSTRAINT DF_ServiceDespatches_ProjectId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'ProjectId')), 0)),
        LocationId      INT            NOT NULL CONSTRAINT DF_ServiceDespatches_LocationId DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'LocationId')), 0)),
        CONSTRAINT UQ_ServiceDespatches_Source UNIQUE (SourceType, SourceId)
    );
    CREATE UNIQUE INDEX UX_ServiceDespatches_No ON dbo.ServiceDespatches (ProjectId, LocationId, DespatchNo);
END
GO

/* details filled in later for a despatch made before they were required */
IF COL_LENGTH('dbo.ServiceDespatches', 'AddedLater') IS NULL
    ALTER TABLE dbo.ServiceDespatches ADD AddedLater BIT NOT NULL CONSTRAINT DF_ServiceDespatches_AddedLater DEFAULT (0);
GO
IF COL_LENGTH('dbo.Despatches', 'DetailsAddedBy') IS NULL
    ALTER TABLE dbo.Despatches ADD DetailsAddedBy INT NULL;
GO
IF COL_LENGTH('dbo.Despatches', 'DetailsAddedAt') IS NULL
    ALTER TABLE dbo.Despatches ADD DetailsAddedAt DATETIME2(7) NULL;
GO

/* location-scoped like the sales despatches */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantScopePolicy')
   AND OBJECT_ID('Security.fn_LocationScope') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.ServiceDespatches'))
    EXEC (N'ALTER SECURITY POLICY Security.TenantScopePolicy ADD FILTER PREDICATE Security.fn_LocationScope(ProjectId, LocationId) ON dbo.ServiceDespatches;');
GO

CREATE OR ALTER PROCEDURE dbo.sp_ServiceDespatch_List
    @Stage      NVARCHAR(12)  = 'Pending',   -- Pending | Despatched
    @SourceType NVARCHAR(10)  = NULL,        -- Spare | Repair | NULL = both
    @SearchTerm NVARCHAR(100) = NULL,
    @FromDate   DATE          = NULL,
    @ToDate     DATE          = NULL,
    @PageNumber INT           = 1,
    @PageSize   INT           = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET @SearchTerm = NULLIF(LTRIM(RTRIM(@SearchTerm)), '');
    SET @SourceType = NULLIF(LTRIM(RTRIM(@SourceType)), '');
    SET @PageNumber = CASE WHEN ISNULL(@PageNumber, 0) < 1 THEN 1 ELSE @PageNumber END;
    SET @PageSize   = CASE WHEN ISNULL(@PageSize, 0) BETWEEN 1 AND 200 THEN @PageSize ELSE 20 END;

    ;WITH Requests AS
    (
        SELECT 'Spare' AS SourceType, r.RequestId AS SourceId, r.ComplaintId, c.ComplaintNumber,
               ISNULL(r.PartName, sp.PartName) AS PartName, ISNULL(r.PartNumber, sp.PartNumber) AS PartReference,
               r.Quantity, r.UrgencyLevel, r.[Status], u.FullName AS TechnicianName,
               cu.CustomerName, cu.MobileNumber AS CustomerMobile,
               COALESCE(r.ApprovedAt, r.RequestedAt, r.CreatedAt) AS ReadyAt, r.UpdatedAt,
               CAST(COALESCE(r.UnitPrice, sp.UnitPrice) AS DECIMAL(18,2)) AS UnitPrice, sp.StockQuantity,
               CAST(r.Remarks AS NVARCHAR(1000)) AS RequestNotes, CAST(NULL AS NVARCHAR(1000)) AS StatusNotes,
               COALESCE(r.RequestedAt, r.CreatedAt) AS RequestedAt, r.ApprovedAt, appr.FullName AS ApprovedByName,
               c.Subject AS ComplaintSubject, pr.ProductName, pr.SerialNumber AS ProductSerial,
               cu.Address AS CustomerAddress, cu.City AS CustomerCity, u.MobileNumber AS TechnicianMobile
        FROM dbo.SparePartRequests r
        LEFT JOIN dbo.SpareParts sp  ON sp.SparePartId = r.SparePartId
        LEFT JOIN dbo.Complaints c   ON c.ComplaintId = r.ComplaintId
        LEFT JOIN dbo.Products pr    ON pr.ProductId = c.ProductId
        LEFT JOIN dbo.Customers cu   ON cu.CustomerId = c.CustomerId
        LEFT JOIN dbo.Technicians t  ON t.TechnicianId = r.TechnicianId
        LEFT JOIN dbo.Users u        ON u.UserId = t.UserId
        LEFT JOIN dbo.Users appr     ON appr.UserId = r.ApprovedBy
        WHERE (@Stage = 'Pending' AND r.[Status] = 'Approved')
           OR (@Stage = 'Despatched' AND r.[Status] IN ('Dispatched', 'Used'))

        UNION ALL

        SELECT 'Repair', r.RepairRequestId, r.ComplaintId, c.ComplaintNumber,
               r.PartName, r.PartSerialNumber,
               1, NULL, r.[Status], u.FullName,
               cu.CustomerName, cu.MobileNumber,
               ISNULL(r.UpdatedAt, r.CreatedAt), r.UpdatedAt,
               CAST(NULL AS DECIMAL(18,2)), CAST(NULL AS INT),
               CAST(r.Notes AS NVARCHAR(1000)), CAST(r.StatusNotes AS NVARCHAR(1000)),
               r.CreatedAt, NULL, NULL,
               c.Subject, pr.ProductName, pr.SerialNumber,
               cu.Address, cu.City, u.MobileNumber
        FROM dbo.RepairPartRequests r
        LEFT JOIN dbo.Complaints c   ON c.ComplaintId = r.ComplaintId
        LEFT JOIN dbo.Products pr    ON pr.ProductId = COALESCE(r.ProductId, c.ProductId)
        LEFT JOIN dbo.Customers cu   ON cu.CustomerId = COALESCE(r.CustomerId, c.CustomerId)
        LEFT JOIN dbo.Technicians t  ON t.TechnicianId = r.TechnicianId
        LEFT JOIN dbo.Users u        ON u.UserId = t.UserId
        WHERE (@Stage = 'Pending' AND r.[Status] = 'Repaired')
           OR (@Stage = 'Despatched' AND r.[Status] IN ('Dispatched', 'Delivered', 'Resolved'))
    )
    SELECT q.SourceType, q.SourceId, q.ComplaintId, q.ComplaintNumber, q.PartName, q.PartReference, q.Quantity,
           q.UrgencyLevel, q.[Status], q.TechnicianName, q.CustomerName, q.CustomerMobile, q.ReadyAt,
           d.ServiceDespatchId, d.DespatchNo, ISNULL(d.DespatchDate, CAST(q.UpdatedAt AS DATE)) AS DespatchDate,
           d.DespatchMode, d.ReferenceNo, d.ReferenceDate, d.TransporterName, d.VehicleNo, d.DriverName, d.Remarks,
           q.UnitPrice, q.StockQuantity, q.RequestNotes, q.StatusNotes, q.RequestedAt, q.ApprovedAt, q.ApprovedByName,
           q.ComplaintSubject, q.ProductName, q.ProductSerial, q.CustomerAddress, q.CustomerCity, q.TechnicianMobile,
           d.CreatedAt AS DespatchedAt, despatcher.FullName AS DespatchedByName, ISNULL(d.AddedLater, 0) AS AddedLater,
           COUNT(*) OVER() AS TotalCount
    FROM Requests q
    LEFT JOIN dbo.ServiceDespatches d ON d.SourceType = q.SourceType AND d.SourceId = q.SourceId
    LEFT JOIN dbo.Users despatcher ON despatcher.UserId = d.CreatedBy
    WHERE (@SourceType IS NULL OR q.SourceType = @SourceType)
      AND (@Stage = 'Pending' OR @FromDate IS NULL OR ISNULL(d.DespatchDate, CAST(q.UpdatedAt AS DATE)) >= @FromDate)
      AND (@Stage = 'Pending' OR @ToDate   IS NULL OR ISNULL(d.DespatchDate, CAST(q.UpdatedAt AS DATE)) <= @ToDate)
      AND (@SearchTerm IS NULL
           OR q.PartName        LIKE '%' + @SearchTerm + '%'
           OR q.PartReference   LIKE '%' + @SearchTerm + '%'
           OR q.ComplaintNumber LIKE '%' + @SearchTerm + '%'
           OR q.CustomerName    LIKE '%' + @SearchTerm + '%'
           OR q.CustomerMobile  LIKE '%' + @SearchTerm + '%'
           OR q.TechnicianName  LIKE '%' + @SearchTerm + '%'
           OR q.ComplaintSubject LIKE '%' + @SearchTerm + '%'
           OR q.ProductName     LIKE '%' + @SearchTerm + '%'
           OR q.ProductSerial   LIKE '%' + @SearchTerm + '%'
           OR q.CustomerCity    LIKE '%' + @SearchTerm + '%'
           OR d.DespatchNo      LIKE '%' + @SearchTerm + '%'
           OR d.ReferenceNo     LIKE '%' + @SearchTerm + '%')
    ORDER BY CASE WHEN @Stage = 'Pending' THEN q.ReadyAt END ASC,
             CASE WHEN @Stage = 'Despatched' THEN ISNULL(d.DespatchDate, CAST(q.UpdatedAt AS DATE)) END DESC,
             q.SourceType, q.SourceId DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ServiceDespatch_Create
    @SourceType      NVARCHAR(10),
    @SourceId        INT,
    @DespatchDate    DATE,
    @DespatchMode    NVARCHAR(30),
    @ReferenceNo     NVARCHAR(100) = NULL,
    @ReferenceDate   DATE          = NULL,
    @TransporterName NVARCHAR(150) = NULL,
    @VehicleNo       NVARCHAR(50)  = NULL,
    @DriverName      NVARCHAR(150) = NULL,
    @Remarks         NVARCHAR(500) = NULL,
    @UserId          INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(7) = DATEADD(MINUTE, 330, GETUTCDATE());
    DECLARE @Status NVARCHAR(50), @ComplaintId INT, @Earliest DATE, @Ready NVARCHAR(20);

    BEGIN TRANSACTION;

    IF @SourceType = 'Spare'
    BEGIN
        SET @Ready = 'Approved';
        SELECT @Status = [Status], @ComplaintId = ComplaintId, @Earliest = CAST(COALESCE(ApprovedAt, RequestedAt, CreatedAt) AS DATE)
        FROM dbo.SparePartRequests WITH (UPDLOCK, HOLDLOCK) WHERE RequestId = @SourceId;
    END
    ELSE IF @SourceType = 'Repair'
    BEGIN
        SET @Ready = 'Repaired';
        SELECT @Status = [Status], @ComplaintId = ComplaintId, @Earliest = CAST(CreatedAt AS DATE)
        FROM dbo.RepairPartRequests WITH (UPDLOCK, HOLDLOCK) WHERE RepairRequestId = @SourceId;
    END

    IF @Status IS NULL
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Request not found.' AS Message, NULL AS ServiceDespatchId, NULL AS DespatchNo; RETURN; END
    IF @Status <> @Ready
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Only a request that is ' + @Ready + ' can be despatched. This one is ' + @Status + '.' AS Message, NULL AS ServiceDespatchId, NULL AS DespatchNo; RETURN; END
    IF @Earliest IS NOT NULL AND @DespatchDate < @Earliest
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Despatch date cannot be before ' + CONVERT(NVARCHAR(11), @Earliest, 106) + '.' AS Message, NULL AS ServiceDespatchId, NULL AS DespatchNo; RETURN; END

    DECLARE @Prefix NVARCHAR(20) = 'SDP-' + CONVERT(NVARCHAR(8), CAST(@Now AS DATE), 112) + '-';
    DECLARE @Next INT = ISNULL((SELECT MAX(CAST(RIGHT(DespatchNo, 4) AS INT))
                                FROM dbo.ServiceDespatches WITH (UPDLOCK, HOLDLOCK)
                                WHERE DespatchNo LIKE @Prefix + '%'), 0) + 1;
    DECLARE @No NVARCHAR(30) = @Prefix + RIGHT('0000' + CAST(@Next AS NVARCHAR(10)), 4);

    INSERT INTO dbo.ServiceDespatches
        (DespatchNo, SourceType, SourceId, ComplaintId, DespatchDate, DespatchMode, ReferenceNo, ReferenceDate,
         TransporterName, VehicleNo, DriverName, Remarks, CreatedBy)
    VALUES
        (@No, @SourceType, @SourceId, @ComplaintId, @DespatchDate, @DespatchMode, @ReferenceNo, @ReferenceDate,
         @TransporterName, @VehicleNo, @DriverName, @Remarks, @UserId);
    DECLARE @Id INT = SCOPE_IDENTITY();

    IF @SourceType = 'Spare'
        UPDATE dbo.SparePartRequests SET [Status] = 'Dispatched', UpdatedAt = @Now WHERE RequestId = @SourceId;
    ELSE
        UPDATE dbo.RepairPartRequests SET [Status] = 'Dispatched', StatusNotes = ISNULL(@Remarks, 'Despatch ' + @No), UpdatedAt = @Now WHERE RepairRequestId = @SourceId;

    COMMIT TRANSACTION;
    SELECT 1 AS Success, 'Despatch ' + @No + ' saved.' AS Message, @Id AS ServiceDespatchId, @No AS DespatchNo;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Despatch_AddDetails
    @DespatchId      INT,
    @DespatchMode    NVARCHAR(30),
    @ReferenceNo     NVARCHAR(100),
    @ReferenceDate   DATE          = NULL,
    @TransporterName NVARCHAR(150) = NULL,
    @VehicleNo       NVARCHAR(50)  = NULL,
    @DriverName      NVARCHAR(150) = NULL,
    @UserId          INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @Mode NVARCHAR(30), @Reference NVARCHAR(100), @Found BIT = 0;

    BEGIN TRANSACTION;
    SELECT @Found = 1, @Mode = NULLIF(LTRIM(RTRIM(DespatchMode)), ''), @Reference = NULLIF(LTRIM(RTRIM(TrackingNo)), '')
    FROM dbo.Despatches WITH (UPDLOCK, HOLDLOCK) WHERE DespatchId = @DespatchId;

    IF @Found = 0
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Despatch not found.' AS Message; RETURN; END
    IF @Mode IS NOT NULL AND @Reference IS NOT NULL
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'This despatch already has its mode and reference.' AS Message; RETURN; END

    UPDATE dbo.Despatches
    SET DespatchMode    = ISNULL(@Mode, @DespatchMode),
        TrackingNo      = ISNULL(@Reference, @ReferenceNo),
        ReferenceDate   = ISNULL(ReferenceDate, @ReferenceDate),
        TransporterName = ISNULL(TransporterName, @TransporterName),
        VehicleNo       = ISNULL(VehicleNo, @VehicleNo),
        DriverName      = ISNULL(DriverName, @DriverName),
        DetailsAddedBy  = @UserId,
        DetailsAddedAt  = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE DespatchId = @DespatchId;

    COMMIT TRANSACTION;
    SELECT 1 AS Success, 'Despatch details added.' AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ServiceDespatch_AddDetails
    @SourceType      NVARCHAR(10),
    @SourceId        INT,
    @DespatchDate    DATE,
    @DespatchMode    NVARCHAR(30),
    @ReferenceNo     NVARCHAR(100),
    @ReferenceDate   DATE          = NULL,
    @TransporterName NVARCHAR(150) = NULL,
    @VehicleNo       NVARCHAR(50)  = NULL,
    @DriverName      NVARCHAR(150) = NULL,
    @Remarks         NVARCHAR(500) = NULL,
    @UserId          INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @Now DATETIME2(7) = DATEADD(MINUTE, 330, GETUTCDATE());
    DECLARE @Status NVARCHAR(50), @ComplaintId INT, @Earliest DATE, @RowId INT, @Reference NVARCHAR(100);

    BEGIN TRANSACTION;
    IF @SourceType = 'Spare'
        SELECT @Status = [Status], @ComplaintId = ComplaintId, @Earliest = CAST(COALESCE(ApprovedAt, RequestedAt, CreatedAt) AS DATE)
        FROM dbo.SparePartRequests WITH (UPDLOCK, HOLDLOCK) WHERE RequestId = @SourceId;
    ELSE IF @SourceType = 'Repair'
        SELECT @Status = [Status], @ComplaintId = ComplaintId, @Earliest = CAST(CreatedAt AS DATE)
        FROM dbo.RepairPartRequests WITH (UPDLOCK, HOLDLOCK) WHERE RepairRequestId = @SourceId;

    IF @Status IS NULL
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Request not found.' AS Message; RETURN; END
    IF NOT ((@SourceType = 'Spare' AND @Status IN ('Dispatched', 'Used'))
         OR (@SourceType = 'Repair' AND @Status IN ('Dispatched', 'Delivered', 'Resolved')))
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'This request has not been despatched.' AS Message; RETURN; END
    IF @Earliest IS NOT NULL AND @DespatchDate < @Earliest
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Despatch date cannot be before ' + CONVERT(NVARCHAR(11), @Earliest, 106) + '.' AS Message; RETURN; END

    SELECT @RowId = ServiceDespatchId, @Reference = NULLIF(LTRIM(RTRIM(ReferenceNo)), '')
    FROM dbo.ServiceDespatches WITH (UPDLOCK, HOLDLOCK) WHERE SourceType = @SourceType AND SourceId = @SourceId;

    IF @RowId IS NOT NULL AND @Reference IS NOT NULL
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'This despatch already has its mode and reference.' AS Message; RETURN; END

    IF @RowId IS NOT NULL
        UPDATE dbo.ServiceDespatches
        SET ReferenceNo     = @ReferenceNo,
            ReferenceDate   = ISNULL(ReferenceDate, @ReferenceDate),
            TransporterName = ISNULL(TransporterName, @TransporterName),
            VehicleNo       = ISNULL(VehicleNo, @VehicleNo),
            DriverName      = ISNULL(DriverName, @DriverName),
            Remarks         = ISNULL(Remarks, @Remarks),
            AddedLater      = 1
        WHERE ServiceDespatchId = @RowId;
    ELSE
    BEGIN
        DECLARE @Prefix NVARCHAR(20) = 'SDP-' + CONVERT(NVARCHAR(8), CAST(@Now AS DATE), 112) + '-';
        DECLARE @Next INT = ISNULL((SELECT MAX(CAST(RIGHT(DespatchNo, 4) AS INT))
                                    FROM dbo.ServiceDespatches WITH (UPDLOCK, HOLDLOCK)
                                    WHERE DespatchNo LIKE @Prefix + '%'), 0) + 1;
        INSERT INTO dbo.ServiceDespatches
            (DespatchNo, SourceType, SourceId, ComplaintId, DespatchDate, DespatchMode, ReferenceNo, ReferenceDate,
             TransporterName, VehicleNo, DriverName, Remarks, CreatedBy, AddedLater)
        VALUES
            (@Prefix + RIGHT('0000' + CAST(@Next AS NVARCHAR(10)), 4), @SourceType, @SourceId, @ComplaintId, @DespatchDate,
             @DespatchMode, @ReferenceNo, @ReferenceDate, @TransporterName, @VehicleNo, @DriverName, @Remarks, @UserId, 1);
    END

    COMMIT TRANSACTION;
    SELECT 1 AS Success, 'Despatch details added.' AS Message;
END
GO

SET NOEXEC OFF;
GO
