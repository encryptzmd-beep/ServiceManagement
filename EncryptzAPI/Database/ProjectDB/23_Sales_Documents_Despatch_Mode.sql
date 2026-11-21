/* =============================================================================
   ProjectDB (company database) · Sales documents and the mode of despatch
   -----------------------------------------------------------------------------
   NOT YET EXECUTED ANYWHERE. Rehearse on a copy of a company database first.

   ADDS
     dbo.Despatches.DespatchMode, ReferenceDate   how it left; TrackingNo is its reference
     dbo.SalesDocuments             PDF files of a bill (invoice, e-way bill, ...), added
                                    from the Sales Order or the Despatch screen and seen on both
     dbo.sp_SalesDocument_List / _Save / _GetFile / _Delete

   CHANGES (copied from 09_Sales_Order_Despatch.sql, only the new columns added)
     dbo.sp_Despatch_Create, sp_Despatch_GetAll, sp_Despatch_GetById, sp_SalesOrder_GetById

   A removed document is only marked (IsDeleted): the file stays in the table.

   Runs AFTER 22_CRM_Lead_Delete.sql. Run in EACH company database (select it in SSMS
   first; no USE on purpose). New company databases created by the API get it
   automatically. SAFE TO RE-RUN.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Despatches') IS NULL OR OBJECT_ID('dbo.SalesOrders') IS NULL
BEGIN
    RAISERROR('Select a company database that has the Sales tables (script 09) first.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.Despatches', 'DespatchMode') IS NULL
    ALTER TABLE dbo.Despatches ADD DespatchMode NVARCHAR(30) NULL;
GO
IF COL_LENGTH('dbo.Despatches', 'ReferenceDate') IS NULL
    ALTER TABLE dbo.Despatches ADD ReferenceDate DATE NULL;
GO

IF OBJECT_ID('dbo.SalesDocuments') IS NULL
BEGIN
    CREATE TABLE dbo.SalesDocuments
    (
        DocumentId   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SalesDocuments PRIMARY KEY,
        SalesOrderId INT            NOT NULL CONSTRAINT FK_SalesDocuments_Order REFERENCES dbo.SalesOrders(SalesOrderId),
        DespatchId   INT            NULL     CONSTRAINT FK_SalesDocuments_Despatch REFERENCES dbo.Despatches(DespatchId),
        DocumentType NVARCHAR(40)   NOT NULL,
        FileName     NVARCHAR(200)  NOT NULL,
        FileSize     INT            NOT NULL,
        Content      VARBINARY(MAX) NOT NULL,
        UploadedBy   INT            NULL,
        UploadedAt   DATETIME2(7)   NOT NULL CONSTRAINT DF_SalesDocuments_UploadedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
        IsDeleted    BIT            NOT NULL CONSTRAINT DF_SalesDocuments_IsDeleted DEFAULT (0),
        DeletedBy    INT            NULL,
        DeletedAt    DATETIME2(7)   NULL,
        CompanyId    INT            NOT NULL CONSTRAINT DF_SalesDocuments_CompanyId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'CompanyId')), 0)),
        ProjectId    INT            NOT NULL CONSTRAINT DF_SalesDocuments_ProjectId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'ProjectId')), 0)),
        LocationId   INT            NOT NULL CONSTRAINT DF_SalesDocuments_LocationId DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'LocationId')), 0))
    );
    CREATE INDEX IX_SalesDocuments_Order ON dbo.SalesDocuments (SalesOrderId, IsDeleted);
END
GO

/* location-scoped like the bills */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantScopePolicy')
   AND OBJECT_ID('Security.fn_LocationScope') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.SalesDocuments'))
    EXEC (N'ALTER SECURITY POLICY Security.TenantScopePolicy ADD FILTER PREDICATE Security.fn_LocationScope(ProjectId, LocationId) ON dbo.SalesDocuments;');
GO

CREATE OR ALTER PROCEDURE dbo.sp_SalesDocument_List
    @SalesOrderId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT sd.DocumentId, sd.SalesOrderId, sd.DespatchId, d.DespatchNo, sd.DocumentType, sd.FileName, sd.FileSize, sd.UploadedAt,
           u.FullName AS UploadedByName
    FROM dbo.SalesDocuments sd
    LEFT JOIN dbo.Despatches d ON d.DespatchId = sd.DespatchId
    LEFT JOIN dbo.Users u ON u.UserId = sd.UploadedBy
    WHERE sd.SalesOrderId = @SalesOrderId AND sd.IsDeleted = 0
    ORDER BY sd.DocumentId DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_SalesDocument_Save
    @SalesOrderId INT,
    @DespatchId   INT = NULL,
    @DocumentType NVARCHAR(40),
    @FileName     NVARCHAR(200),
    @Content      VARBINARY(MAX),
    @UserId       INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Status NVARCHAR(20);
    BEGIN TRANSACTION;

    SELECT @Status = [Status] FROM dbo.SalesOrders WITH (UPDLOCK, HOLDLOCK) WHERE SalesOrderId = @SalesOrderId;

    IF @Status IS NULL
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Bill not found.' AS Message, 0 AS DocumentId; RETURN; END
    IF @Status = 'Cancelled'
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'This bill is cancelled.' AS Message, 0 AS DocumentId; RETURN; END
    IF @DespatchId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Despatches WHERE DespatchId = @DespatchId AND SalesOrderId = @SalesOrderId)
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Despatch not found on this bill.' AS Message, 0 AS DocumentId; RETURN; END
    IF (SELECT COUNT(*) FROM dbo.SalesDocuments WHERE SalesOrderId = @SalesOrderId AND IsDeleted = 0) >= 20
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'A bill can have at most 20 documents.' AS Message, 0 AS DocumentId; RETURN; END

    INSERT INTO dbo.SalesDocuments (SalesOrderId, DespatchId, DocumentType, FileName, FileSize, Content, UploadedBy)
    VALUES (@SalesOrderId, @DespatchId, @DocumentType, @FileName, DATALENGTH(@Content), @Content, @UserId);
    DECLARE @Id INT = SCOPE_IDENTITY();

    COMMIT TRANSACTION;
    SELECT 1 AS Success, 'Document added.' AS Message, @Id AS DocumentId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_SalesDocument_GetFile
    @DocumentId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT FileName, Content FROM dbo.SalesDocuments WHERE DocumentId = @DocumentId AND IsDeleted = 0;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_SalesDocument_Delete
    @DocumentId INT,
    @UserId     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.SalesDocuments
    SET IsDeleted = 1, DeletedBy = @UserId, DeletedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE DocumentId = @DocumentId AND IsDeleted = 0;

    IF @@ROWCOUNT = 0
        SELECT 0 AS Success, 'Document not found.' AS Message;
    ELSE
        SELECT 1 AS Success, 'Document removed.' AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Despatch_Create
    @SalesOrderId                INT,
    @DespatchDate                DATE           = NULL,
    @DeliveryAddress             NVARCHAR(500)  = NULL,
    @ContactPerson               NVARCHAR(150)  = NULL,
    @ContactNumber               NVARCHAR(20)   = NULL,
    @TransporterName             NVARCHAR(150)  = NULL,
    @VehicleNo                   NVARCHAR(50)   = NULL,
    @DriverName                  NVARCHAR(150)  = NULL,
    @TrackingNo                  NVARCHAR(100)  = NULL,
    @Remarks                     NVARCHAR(1000) = NULL,
    @DespatchMode                NVARCHAR(30)   = NULL,
    @ReferenceDate               DATE           = NULL,
    @ItemsJson                   NVARCHAR(MAX),
    @CreateInstallationComplaint BIT            = 1,
    @Priority                    NVARCHAR(20)   = 'Medium',
    @PreferredDate               DATE           = NULL,
    @UserId                      INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(7) = DATEADD(MINUTE, 330, GETUTCDATE());
    SET @DespatchDate = ISNULL(@DespatchDate, CAST(@Now AS DATE));
    SET @Priority = CASE WHEN @Priority IN ('Critical', 'High', 'Medium', 'Low') THEN @Priority ELSE 'Medium' END;

    DECLARE @OrderNo NVARCHAR(30), @OrderDate DATE, @CustomerId INT, @Status NVARCHAR(20),
            @BillAddress NVARCHAR(500), @BillCity NVARCHAR(100), @BillState NVARCHAR(100), @BillPin NVARCHAR(10), @BillContact NVARCHAR(20);
    SELECT @OrderNo = OrderNo, @OrderDate = OrderDate, @CustomerId = CustomerId, @Status = [Status],
           @BillAddress = BillingAddress, @BillCity = City, @BillState = [State], @BillPin = PinCode, @BillContact = ContactNumber
    FROM dbo.SalesOrders WHERE SalesOrderId = @SalesOrderId;

    IF @OrderNo IS NULL
    BEGIN SELECT 0 AS Success, 'Bill not found.' AS Message, NULL AS DespatchId, NULL AS DespatchNo, NULL AS ComplaintId, NULL AS ComplaintNumber; RETURN; END
    IF @Status = 'Despatched'
    BEGIN SELECT 0 AS Success, 'Bill ' + @OrderNo + ' is already despatched.' AS Message, NULL AS DespatchId, NULL AS DespatchNo, NULL AS ComplaintId, NULL AS ComplaintNumber; RETURN; END
    IF @Status = 'Cancelled'
    BEGIN SELECT 0 AS Success, 'Bill ' + @OrderNo + ' is cancelled.' AS Message, NULL AS DespatchId, NULL AS DespatchNo, NULL AS ComplaintId, NULL AS ComplaintNumber; RETURN; END

    DECLARE @CustomerName NVARCHAR(150), @CustomerMobile NVARCHAR(20), @CustLat DECIMAL(9,6), @CustLng DECIMAL(9,6);
    SELECT @CustomerName = CustomerName, @CustomerMobile = MobileNumber, @CustLat = Latitude, @CustLng = Longitude
    FROM dbo.Customers WHERE CustomerId = @CustomerId;

    /* units: the serial numbers sent, filled up to Qty with generated ones */
    DECLARE @Units TABLE
    (
        UnitNo           INT IDENTITY(1,1),
        SalesOrderItemId INT,
        SerialNumber     NVARCHAR(100),
        ProductName      NVARCHAR(200),
        Brand            NVARCHAR(100),
        Model            NVARCHAR(100),
        Category         NVARCHAR(100),
        WarrantyMonths   INT,
        ProductId        INT NULL
    );

    DECLARE @Sent TABLE (SalesOrderItemId INT, SerialNumber NVARCHAR(100), Seq INT);
    IF ISNULL(@ItemsJson, '') <> '' AND ISJSON(@ItemsJson) = 1
        INSERT INTO @Sent (SalesOrderItemId, SerialNumber, Seq)
        SELECT j.salesOrderItemId, NULLIF(LTRIM(RTRIM(j.serialNumber)), ''),
               ROW_NUMBER() OVER (PARTITION BY j.salesOrderItemId ORDER BY (SELECT NULL))
        FROM OPENJSON(@ItemsJson)
             WITH (salesOrderItemId INT '$.salesOrderItemId', serialNumber NVARCHAR(100) '$.serialNumber') j
        WHERE j.salesOrderItemId IS NOT NULL;

    ;WITH N AS (SELECT TOP (1000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n FROM sys.all_objects)
    INSERT INTO @Units (SalesOrderItemId, SerialNumber, ProductName, Brand, Model, Category, WarrantyMonths)
    SELECT i.SalesOrderItemId,
           ISNULL(s.SerialNumber, 'AUTO-' + @OrderNo + '-' + CAST(i.SalesOrderItemId AS VARCHAR(10)) + '-' + CAST(N.n AS VARCHAR(10))),
           i.ProductName, i.Brand, i.Model, i.Category, i.WarrantyMonths
    FROM dbo.SalesOrderItems i
    INNER JOIN N ON N.n <= i.Qty
    LEFT JOIN @Sent s ON s.SalesOrderItemId = i.SalesOrderItemId AND s.Seq = N.n
    WHERE i.SalesOrderId = @SalesOrderId
      -- a service line (no product from the master, no warranty) gets no serial number
      AND (i.ProductMasterId IS NOT NULL OR i.WarrantyMonths > 0)
    ORDER BY i.SortOrder, i.SalesOrderItemId, N.n;

    IF NOT EXISTS (SELECT 1 FROM @Units)
    BEGIN SELECT 0 AS Success, 'The bill has no product lines.' AS Message, NULL AS DespatchId, NULL AS DespatchNo, NULL AS ComplaintId, NULL AS ComplaintNumber; RETURN; END

    /* a serial number is one unit */
    IF EXISTS (SELECT SerialNumber FROM @Units GROUP BY SerialNumber HAVING COUNT(*) > 1)
    BEGIN
        DECLARE @Dup NVARCHAR(100) = (SELECT TOP 1 SerialNumber FROM @Units GROUP BY SerialNumber HAVING COUNT(*) > 1);
        SELECT 0 AS Success, 'Serial number ' + @Dup + ' is entered more than once.' AS Message, NULL AS DespatchId, NULL AS DespatchNo, NULL AS ComplaintId, NULL AS ComplaintNumber; RETURN;
    END
    IF EXISTS (SELECT 1 FROM @Units u INNER JOIN dbo.Products p ON p.SerialNumber = u.SerialNumber AND p.IsActive = 1)
    BEGIN
        DECLARE @Used NVARCHAR(100) = (SELECT TOP 1 u.SerialNumber FROM @Units u INNER JOIN dbo.Products p ON p.SerialNumber = u.SerialNumber AND p.IsActive = 1);
        SELECT 0 AS Success, 'Serial number ' + @Used + ' is already registered to a customer.' AS Message, NULL AS DespatchId, NULL AS DespatchNo, NULL AS ComplaintId, NULL AS ComplaintNumber; RETURN;
    END

    SET @DeliveryAddress = ISNULL(NULLIF(LTRIM(RTRIM(@DeliveryAddress)), ''),
                                  NULLIF(CONCAT_WS(', ', NULLIF(@BillAddress, ''), NULLIF(@BillCity, ''), NULLIF(@BillState, ''), NULLIF(@BillPin, '')), ''));
    SET @ContactNumber = ISNULL(NULLIF(LTRIM(RTRIM(@ContactNumber)), ''), ISNULL(NULLIF(@BillContact, ''), @CustomerMobile));
    SET @ContactPerson = ISNULL(NULLIF(LTRIM(RTRIM(@ContactPerson)), ''), @CustomerName);

    BEGIN TRY
        BEGIN TRANSACTION;

        /* 1. despatch header (number series from Settings > Sales) */
        DECLARE @DespatchNo NVARCHAR(30);
        EXEC dbo.sp_Sales_NextNumber @Kind = 'Despatch', @Consume = 1, @Number = @DespatchNo OUTPUT;

        INSERT INTO dbo.Despatches
            (DespatchNo, SalesOrderId, DespatchDate, DeliveryAddress, ContactPerson, ContactNumber,
             TransporterName, VehicleNo, DriverName, TrackingNo, DespatchMode, ReferenceDate, Remarks, [Status], CreatedBy, CreatedAt)
        VALUES
            (@DespatchNo, @SalesOrderId, @DespatchDate, @DeliveryAddress, @ContactPerson, @ContactNumber,
             @TransporterName, @VehicleNo, @DriverName, @TrackingNo, NULLIF(LTRIM(RTRIM(@DespatchMode)), ''), @ReferenceDate, @Remarks, 'Despatched', @UserId, @Now);
        DECLARE @DespatchId INT = SCOPE_IDENTITY();

        /* 2. one Products row (installed base of the customer) per unit */
        DECLARE @UnitNo INT, @ItemId INT, @Serial NVARCHAR(100), @PName NVARCHAR(200), @PBrand NVARCHAR(100),
                @PModel NVARCHAR(100), @PCategory NVARCHAR(100), @Months INT, @ProductId INT, @WarrantyEnd DATE;

        DECLARE units CURSOR LOCAL FAST_FORWARD FOR
            SELECT UnitNo, SalesOrderItemId, SerialNumber, ProductName, Brand, Model, Category, WarrantyMonths FROM @Units ORDER BY UnitNo;
        OPEN units; FETCH NEXT FROM units INTO @UnitNo, @ItemId, @Serial, @PName, @PBrand, @PModel, @PCategory, @Months;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @WarrantyEnd = DATEADD(MONTH, ISNULL(@Months, 0), @DespatchDate);

            INSERT INTO dbo.Products
                (CustomerId, ProductName, SerialNumber, Brand, Model, ModelNumber, Category,
                 PurchaseDate, WarrantyExpiryDate, IsActive, CreatedAt, UpdatedAt)
            VALUES
                (@CustomerId, @PName, @Serial, @PBrand, @PModel, @PModel, @PCategory,
                 @OrderDate, @WarrantyEnd, 1, @Now, @Now);
            SET @ProductId = SCOPE_IDENTITY();

            INSERT INTO dbo.DespatchItems
                (DespatchId, SalesOrderItemId, ProductId, SerialNumber, WarrantyMonths, WarrantyStartDate, WarrantyEndDate)
            VALUES
                (@DespatchId, @ItemId, @ProductId, @Serial, ISNULL(@Months, 0), @DespatchDate, @WarrantyEnd);

            UPDATE @Units SET ProductId = @ProductId WHERE UnitNo = @UnitNo;

            FETCH NEXT FROM units INTO @UnitNo, @ItemId, @Serial, @PName, @PBrand, @PModel, @PCategory, @Months;
        END
        CLOSE units; DEALLOCATE units;

        /* 3. the installation complaint (shows on the dashboard like any other complaint) */
        DECLARE @ComplaintId INT = NULL, @ComplaintNo NVARCHAR(30) = NULL;

        IF ISNULL(@CreateInstallationComplaint, 1) = 1
        BEGIN
            DECLARE @FirstProductId INT, @FirstName NVARCHAR(200), @FirstBrand NVARCHAR(100), @FirstModel NVARCHAR(100), @FirstCategory NVARCHAR(100), @UnitCount INT;
            SELECT TOP 1 @FirstProductId = ProductId, @FirstName = ProductName, @FirstBrand = Brand, @FirstModel = Model, @FirstCategory = Category
            FROM @Units ORDER BY UnitNo;
            SELECT @UnitCount = COUNT(*) FROM @Units;

            DECLARE @Subject NVARCHAR(200) = LEFT('New Installation - ' + @FirstName
                + CASE WHEN @UnitCount > 1 THEN ' (+' + CAST(@UnitCount - 1 AS VARCHAR(10)) + ' more)' ELSE '' END, 200);

            DECLARE @Lines NVARCHAR(MAX);
            SELECT @Lines = STRING_AGG(CAST(
                       u.ProductName + ISNULL(' ' + u.Model, '') + ' | SN: ' + u.SerialNumber
                       + ' | Warranty ' + CAST(u.WarrantyMonths AS VARCHAR(10)) + ' months till '
                       + FORMAT(DATEADD(MONTH, u.WarrantyMonths, @DespatchDate), 'dd-MMM-yyyy') AS NVARCHAR(MAX)), CHAR(10))
                   WITHIN GROUP (ORDER BY u.UnitNo)
            FROM @Units u;

            DECLARE @Description NVARCHAR(2000) = LEFT(
                'Installation of products despatched against bill ' + @OrderNo + ' (despatch ' + @DespatchNo + ', '
                + FORMAT(@DespatchDate, 'dd-MMM-yyyy') + ').' + CHAR(10) + ISNULL(@Lines, '')
                + CASE WHEN ISNULL(@Remarks, '') <> '' THEN CHAR(10) + 'Remarks: ' + @Remarks ELSE '' END, 2000);

            /* complaint number series from Settings > Complaint */
            EXEC dbo.sp_Sales_NextNumber @Kind = 'Complaint', @Consume = 1, @Number = @ComplaintNo OUTPUT;

            DECLARE @SLAHours INT = CASE @Priority WHEN 'Critical' THEN 4 WHEN 'High' THEN 12 WHEN 'Medium' THEN 24 ELSE 48 END;

            INSERT INTO dbo.Complaints
                (ComplaintNumber, CustomerId, ProductId, [Subject], [Description], Priority, StatusId, SLADeadline,
                 IsActive, CreatedAt, UpdatedAt, CreatedDate, ContactNumber, PreferredDate,
                 Latitude, Longitude, LocationAddress, LocationName,
                 Category, BrandName, ModelNumber, NatureOfJob, IsWarranty, IsCustomerConfirmed)
            VALUES
                (@ComplaintNo, @CustomerId, @FirstProductId, @Subject, @Description, @Priority, 1, DATEADD(HOUR, @SLAHours, @Now),
                 1, @Now, @Now, @Now, @ContactNumber, @PreferredDate,
                 @CustLat, @CustLng, @DeliveryAddress, @DeliveryAddress,
                 @FirstCategory, @FirstBrand, @FirstModel, 'Installation', 1, 0);
            SET @ComplaintId = SCOPE_IDENTITY();

            IF OBJECT_ID('dbo.ComplaintTimeline') IS NOT NULL
                INSERT INTO dbo.ComplaintTimeline (ComplaintId, StatusId, Remarks, ActionBy, ActionAt, CreatedAt, UpdatedAt)
                VALUES (@ComplaintId, 1, 'Installation request created from despatch ' + @DespatchNo + ' of bill ' + @OrderNo, @UserId, @Now, @Now, @Now);

            UPDATE dbo.Despatches SET InstallationComplaintId = @ComplaintId WHERE DespatchId = @DespatchId;
        END

        /* 4. the bill */
        UPDATE dbo.SalesOrders SET [Status] = 'Despatched', UpdatedAt = @Now WHERE SalesOrderId = @SalesOrderId;

        COMMIT TRANSACTION;

        SELECT 1 AS Success,
               'Despatch ' + @DespatchNo + ' saved'
               + CASE WHEN @ComplaintNo IS NOT NULL THEN '; installation complaint ' + @ComplaintNo + ' created.' ELSE '.' END AS Message,
               @DespatchId AS DespatchId, @DespatchNo AS DespatchNo, @ComplaintId AS ComplaintId, @ComplaintNo AS ComplaintNumber;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message, NULL AS DespatchId, NULL AS DespatchNo, NULL AS ComplaintId, NULL AS ComplaintNumber;
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Despatch_GetAll
    @SearchTerm NVARCHAR(100) = NULL,
    @FromDate   DATE          = NULL,
    @ToDate     DATE          = NULL,
    @PageNumber INT           = 1,
    @PageSize   INT           = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET @SearchTerm = NULLIF(LTRIM(RTRIM(@SearchTerm)), '');
    SET @PageNumber = CASE WHEN ISNULL(@PageNumber, 0) < 1 THEN 1 ELSE @PageNumber END;
    SET @PageSize   = CASE WHEN ISNULL(@PageSize, 0) BETWEEN 1 AND 200 THEN @PageSize ELSE 20 END;
    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT d.DespatchId, d.DespatchNo, d.DespatchDate, d.[Status], d.TransporterName, d.VehicleNo, d.TrackingNo, d.DespatchMode, d.ReferenceDate,
           so.SalesOrderId, so.OrderNo, so.OrderDate, so.GrandTotal,
           c.CustomerId, c.CustomerName, c.MobileNumber AS CustomerMobile, so.City,
           (SELECT COUNT(*) FROM dbo.DespatchItems di WHERE di.DespatchId = d.DespatchId) AS UnitCount,
           (SELECT MIN(di.WarrantyEndDate) FROM dbo.DespatchItems di WHERE di.DespatchId = d.DespatchId) AS WarrantyEndDate,
           CASE WHEN (SELECT MIN(di.WarrantyEndDate) FROM dbo.DespatchItems di WHERE di.DespatchId = d.DespatchId) >= @Today
                THEN 'In Warranty' ELSE 'Expired' END AS WarrantyStatus,
           d.InstallationComplaintId, cm.ComplaintNumber AS InstallationComplaintNo,
           cs.StatusName AS InstallationStatus, cs.StatusColor AS InstallationStatusColor,
           (SELECT STRING_AGG(u2.FullName, ', ')
            FROM dbo.TechnicianAssignments ta2
            INNER JOIN dbo.Technicians t2 ON ta2.TechnicianId = t2.TechnicianId
            INNER JOIN dbo.Users u2 ON t2.UserId = u2.UserId
            WHERE ta2.ComplaintId = cm.ComplaintId AND ta2.[Status] NOT IN ('Cancelled', 'Removed')) AS AssignedTechnicians,
           d.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Despatches d
    INNER JOIN dbo.SalesOrders so      ON so.SalesOrderId = d.SalesOrderId
    INNER JOIN dbo.Customers c         ON c.CustomerId = so.CustomerId
    LEFT JOIN dbo.Complaints cm        ON cm.ComplaintId = d.InstallationComplaintId
    LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = cm.StatusId
    WHERE (@FromDate IS NULL OR d.DespatchDate >= @FromDate)
      AND (@ToDate   IS NULL OR d.DespatchDate <= @ToDate)
      AND (@SearchTerm IS NULL
           OR d.DespatchNo     LIKE '%' + @SearchTerm + '%'
           OR so.OrderNo       LIKE '%' + @SearchTerm + '%'
           OR d.TrackingNo     LIKE '%' + @SearchTerm + '%'
           OR c.CustomerName   LIKE '%' + @SearchTerm + '%'
           OR c.MobileNumber   LIKE '%' + @SearchTerm + '%'
           OR cm.ComplaintNumber LIKE '%' + @SearchTerm + '%'
           OR EXISTS (SELECT 1 FROM dbo.DespatchItems di WHERE di.DespatchId = d.DespatchId AND di.SerialNumber LIKE '%' + @SearchTerm + '%'))
    ORDER BY d.DespatchId DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Despatch_GetById
    @DespatchId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT d.DespatchId, d.DespatchNo, d.DespatchDate, d.DeliveryAddress, d.ContactPerson, d.ContactNumber,
           d.TransporterName, d.VehicleNo, d.DriverName, d.TrackingNo, d.DespatchMode, d.ReferenceDate, d.Remarks, d.[Status],
           so.SalesOrderId, so.OrderNo, so.OrderDate, so.GrandTotal, so.PaymentMode,
           c.CustomerId, c.CustomerName, c.MobileNumber AS CustomerMobile, c.Email AS CustomerEmail,
           d.InstallationComplaintId, cm.ComplaintNumber AS InstallationComplaintNo,
           cs.StatusName AS InstallationStatus, cs.StatusColor AS InstallationStatusColor,
           (SELECT STRING_AGG(u2.FullName, ', ')
            FROM dbo.TechnicianAssignments ta2
            INNER JOIN dbo.Technicians t2 ON ta2.TechnicianId = t2.TechnicianId
            INNER JOIN dbo.Users u2 ON t2.UserId = u2.UserId
            WHERE ta2.ComplaintId = cm.ComplaintId AND ta2.[Status] NOT IN ('Cancelled', 'Removed')) AS AssignedTechnicians,
           d.CreatedAt
    FROM dbo.Despatches d
    INNER JOIN dbo.SalesOrders so      ON so.SalesOrderId = d.SalesOrderId
    INNER JOIN dbo.Customers c         ON c.CustomerId = so.CustomerId
    LEFT JOIN dbo.Complaints cm        ON cm.ComplaintId = d.InstallationComplaintId
    LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = cm.StatusId
    WHERE d.DespatchId = @DespatchId;

    SELECT di.DespatchItemId, di.SalesOrderItemId, di.ProductId, di.SerialNumber,
           i.ProductName, i.Brand, i.Model, i.Category, i.HsnSac,
           di.WarrantyMonths, di.WarrantyStartDate, di.WarrantyEndDate,
           CASE WHEN di.WarrantyEndDate >= @Today THEN 'In Warranty' ELSE 'Expired' END AS WarrantyStatus,
           DATEDIFF(DAY, @Today, di.WarrantyEndDate) AS WarrantyDaysLeft
    FROM dbo.DespatchItems di
    INNER JOIN dbo.SalesOrderItems i ON i.SalesOrderItemId = di.SalesOrderItemId
    WHERE di.DespatchId = @DespatchId
    ORDER BY di.DespatchItemId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_SalesOrder_GetById
    @SalesOrderId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT so.SalesOrderId, so.OrderNo, so.OrderDate, so.[Status], so.PaymentMode, so.ReferenceNo,
           so.CustomerId, c.CustomerName, c.MobileNumber AS CustomerMobile, c.Email AS CustomerEmail,
           so.ContactNumber, so.GSTIN, so.BillingAddress, so.City, so.[State], so.PinCode, so.IsInterState, so.Notes,
           so.SubTotal, so.DiscountTotal, so.TaxableTotal, so.CGST, so.SGST, so.IGST, so.GrandTotal,
           so.CreatedAt, so.UpdatedAt
    FROM dbo.SalesOrders so
    INNER JOIN dbo.Customers c ON c.CustomerId = so.CustomerId
    WHERE so.SalesOrderId = @SalesOrderId;

    SELECT i.SalesOrderItemId, i.SalesOrderId, i.ProductMasterId, i.ProductName, i.Brand, i.Model, i.Category, i.HsnSac,
           i.Qty, i.Rate, i.DiscountAmount, i.GstPercent, i.TaxableAmount, i.GstAmount, i.LineTotal, i.WarrantyMonths,
           (SELECT COUNT(*) FROM dbo.DespatchItems di WHERE di.SalesOrderItemId = i.SalesOrderItemId) AS DespatchedQty,
           (SELECT STRING_AGG(di.SerialNumber, ', ') FROM dbo.DespatchItems di WHERE di.SalesOrderItemId = i.SalesOrderItemId) AS SerialNumbers,
           (SELECT MIN(di.WarrantyStartDate) FROM dbo.DespatchItems di WHERE di.SalesOrderItemId = i.SalesOrderItemId) AS WarrantyStartDate,
           (SELECT MAX(di.WarrantyEndDate)   FROM dbo.DespatchItems di WHERE di.SalesOrderItemId = i.SalesOrderItemId) AS WarrantyEndDate
    FROM dbo.SalesOrderItems i
    WHERE i.SalesOrderId = @SalesOrderId
    ORDER BY i.SortOrder, i.SalesOrderItemId;

    SELECT d.DespatchId, d.DespatchNo, d.DespatchDate, d.DeliveryAddress, d.ContactPerson, d.ContactNumber,
           d.TransporterName, d.VehicleNo, d.DriverName, d.TrackingNo, d.DespatchMode, d.ReferenceDate, d.Remarks, d.[Status],
           d.InstallationComplaintId, cm.ComplaintNumber AS InstallationComplaintNo,
           cs.StatusName AS InstallationStatus, cs.StatusColor AS InstallationStatusColor,
           (SELECT STRING_AGG(u2.FullName, ', ')
            FROM dbo.TechnicianAssignments ta2
            INNER JOIN dbo.Technicians t2 ON ta2.TechnicianId = t2.TechnicianId
            INNER JOIN dbo.Users u2 ON t2.UserId = u2.UserId
            WHERE ta2.ComplaintId = cm.ComplaintId AND ta2.[Status] NOT IN ('Cancelled', 'Removed')) AS AssignedTechnicians,
           d.CreatedAt
    FROM dbo.Despatches d
    LEFT JOIN dbo.Complaints cm        ON cm.ComplaintId = d.InstallationComplaintId
    LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = cm.StatusId
    WHERE d.SalesOrderId = @SalesOrderId
    ORDER BY d.DespatchId DESC;
END
GO

PRINT 'Sales documents and despatch mode are in place.';
GO
SET NOEXEC OFF;
GO
