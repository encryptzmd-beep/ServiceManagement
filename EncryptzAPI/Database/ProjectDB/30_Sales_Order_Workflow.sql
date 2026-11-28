/* =============================================================================
   ProjectDB (company database) · Sales order workflow
   -----------------------------------------------------------------------------
   A sales order now moves through
       Sales Order  ->  Sales Confirmed  ->  Billed  ->  Despatched
   (Cancelled at any step before Despatched). Before, every order was saved as
   Billed at once, so a CRM convert showed "Billed" while nothing was billed.

     Sales Order      a new order made on the Sales Order screen; can be changed
     Sales Confirmed  the customer has confirmed (a CRM convert starts here);
                      can still be changed
     Billed           set only when an Invoice PDF is attached (Documents); the
                      order is locked and goes to the Despatch screen
     Despatched       set by the despatch, as before

   CHANGES
     dbo.SalesOrders.[Status] default        'Sales Order' (was 'Billed')
     dbo.sp_SalesOrder_Save                  copied from 29_Document_Print.sql: new
                                             @Status (Sales Order / Sales Confirmed)
                                             for a new order; changes allowed only
                                             before Billed
     dbo.sp_Despatch_Create                  copied from 23_Sales_Documents_Despatch_Mode.sql:
                                             only a Billed order is despatched
     dbo.sp_SalesDocument_Delete             the last invoice of a billed order stays
   ADDS
     dbo.sp_SalesOrder_SetStatus             Sales Order -> Sales Confirmed -> Billed

   Existing orders keep their status: a Billed one stays Billed (pending despatch).

   Runs AFTER 29_Document_Print.sql. Run in EACH company database (select it in
   SSMS first; no USE on purpose). New company databases created by the API get
   it automatically. SAFE TO RE-RUN.
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
ELSE IF OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database (dbo.Locations is missing).';
ELSE IF OBJECT_ID('dbo.SalesOrders') IS NULL OR OBJECT_ID('dbo.SalesDocuments') IS NULL
    SET @problem = 'Run the sales scripts (09 and 23) first.';
ELSE IF COL_LENGTH('dbo.SalesOrders', 'WarrantyText') IS NULL
    SET @problem = 'Run 29_Document_Print.sql first.';
IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

/* a row inserted without a status is a Sales Order, not Billed */
IF EXISTS (SELECT 1 FROM sys.default_constraints
           WHERE parent_object_id = OBJECT_ID('dbo.SalesOrders') AND name = 'DF_SalesOrders_Status'
             AND definition <> N'(N''Sales Order'')')
    ALTER TABLE dbo.SalesOrders DROP CONSTRAINT DF_SalesOrders_Status;
GO
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints
               WHERE parent_object_id = OBJECT_ID('dbo.SalesOrders') AND name = 'DF_SalesOrders_Status')
    ALTER TABLE dbo.SalesOrders ADD CONSTRAINT DF_SalesOrders_Status DEFAULT (N'Sales Order') FOR [Status];
GO

/* copied from 29_Document_Print.sql; changed: @Status, the edit check and the messages */
CREATE OR ALTER PROCEDURE dbo.sp_SalesOrder_Save
    @SalesOrderId   INT = 0,
    @OrderDate      DATE,
    @CustomerId     INT,
    @PaymentMode    NVARCHAR(30)   = NULL,
    @ReferenceNo    NVARCHAR(100)  = NULL,
    @ContactNumber  NVARCHAR(20)   = NULL,
    @GSTIN          NVARCHAR(20)   = NULL,
    @BillingAddress NVARCHAR(500)  = NULL,
    @City           NVARCHAR(100)  = NULL,
    @State          NVARCHAR(100)  = NULL,
    @PinCode        NVARCHAR(10)   = NULL,
    @IsInterState   BIT            = 0,
    @Notes          NVARCHAR(2000) = NULL,
    @ItemsJson      NVARCHAR(MAX),
    @UserId         INT            = NULL,
    @PaymentDueDate DATE           = NULL,
    @Terms          NVARCHAR(4000) = NULL,
    @WarrantyText   NVARCHAR(4000) = NULL,
    @Status         NVARCHAR(20)   = 'Sales Order'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(7) = DATEADD(MINUTE, 330, GETUTCDATE());

    /* a new order starts as Sales Order, or as Sales Confirmed when the customer has already accepted
       (the CRM convert). Billed is set only by sp_SalesOrder_SetStatus, once the invoice is attached. */
    SET @Status = LTRIM(RTRIM(ISNULL(@Status, 'Sales Order')));
    IF @Status NOT IN ('Sales Order', 'Sales Confirmed')
    BEGIN SELECT 0 AS Success, 'A new sales order starts as Sales Order or Sales Confirmed.' AS Message, NULL AS SalesOrderId, NULL AS OrderNo; RETURN; END

    IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @CustomerId)
    BEGIN SELECT 0 AS Success, 'Select a customer first.' AS Message, NULL AS SalesOrderId, NULL AS OrderNo; RETURN; END

    IF @PaymentDueDate IS NOT NULL AND @PaymentDueDate < @OrderDate
    BEGIN SELECT 0 AS Success, 'The payment due date cannot be before the bill date.' AS Message, NULL AS SalesOrderId, NULL AS OrderNo; RETURN; END

    IF ISNULL(@ItemsJson, '') = '' OR ISJSON(@ItemsJson) = 0
    BEGIN SELECT 0 AS Success, 'Add at least one product line.' AS Message, NULL AS SalesOrderId, NULL AS OrderNo; RETURN; END

    DECLARE @Items TABLE
    (
        RowNo            INT IDENTITY(1,1),
        SalesOrderItemId INT,
        ProductMasterId  INT,
        ProductName      NVARCHAR(200),
        Brand            NVARCHAR(100),
        Model            NVARCHAR(100),
        Category         NVARCHAR(100),
        HsnSac           NVARCHAR(20),
        Qty              INT,
        Rate             DECIMAL(18,2),
        DiscountAmount   DECIMAL(18,2),
        GstPercent       DECIMAL(5,2),
        WarrantyMonths   INT,
        TaxableAmount    DECIMAL(18,2),
        GstAmount        DECIMAL(18,2),
        LineTotal        DECIMAL(18,2)
    );

    INSERT INTO @Items (SalesOrderItemId, ProductMasterId, ProductName, Brand, Model, Category, HsnSac,
                        Qty, Rate, DiscountAmount, GstPercent, WarrantyMonths)
    SELECT ISNULL(j.salesOrderItemId, 0),
           NULLIF(j.productMasterId, 0),
           ISNULL(NULLIF(LTRIM(RTRIM(j.productName)), ''), pm.ProductName),
           pm.Brand, pm.Model, pm.Category,
           NULLIF(LTRIM(RTRIM(j.hsnSac)), ''),
           CASE WHEN ISNULL(j.qty, 0) < 1 THEN 1 ELSE j.qty END,
           ISNULL(j.rate, 0),
           ISNULL(j.discountAmount, 0),
           ISNULL(j.gstPercent, 0),
           ISNULL(j.warrantyMonths, ISNULL(pm.WarrantyMonths, 12))
    FROM OPENJSON(@ItemsJson)
         WITH (salesOrderItemId INT           '$.salesOrderItemId',
               productMasterId  INT           '$.productMasterId',
               productName      NVARCHAR(200) '$.productName',
               hsnSac           NVARCHAR(20)  '$.hsnSac',
               qty              INT           '$.qty',
               rate             DECIMAL(18,2) '$.rate',
               discountAmount   DECIMAL(18,2) '$.discountAmount',
               gstPercent       DECIMAL(5,2)  '$.gstPercent',
               warrantyMonths   INT           '$.warrantyMonths') j
    LEFT JOIN dbo.ProductMaster pm ON pm.ProductMasterId = j.productMasterId;

    DELETE FROM @Items WHERE ProductName IS NULL;

    IF NOT EXISTS (SELECT 1 FROM @Items)
    BEGIN SELECT 0 AS Success, 'Add at least one product line.' AS Message, NULL AS SalesOrderId, NULL AS OrderNo; RETURN; END

    UPDATE @Items
    SET TaxableAmount = (Qty * Rate) - DiscountAmount;
    UPDATE @Items
    SET GstAmount = ROUND(TaxableAmount * GstPercent / 100.0, 2);
    UPDATE @Items
    SET LineTotal = TaxableAmount + GstAmount;

    IF EXISTS (SELECT 1 FROM @Items WHERE TaxableAmount < 0)
    BEGIN SELECT 0 AS Success, 'Discount cannot exceed the line amount.' AS Message, NULL AS SalesOrderId, NULL AS OrderNo; RETURN; END

    DECLARE @SubTotal DECIMAL(18,2), @DiscountTotal DECIMAL(18,2), @TaxableTotal DECIMAL(18,2), @GstTotal DECIMAL(18,2);
    SELECT @SubTotal      = SUM(Qty * Rate),
           @DiscountTotal = SUM(DiscountAmount),
           @TaxableTotal  = SUM(TaxableAmount),
           @GstTotal      = SUM(GstAmount)
    FROM @Items;

    DECLARE @CGST DECIMAL(18,2) = CASE WHEN ISNULL(@IsInterState, 0) = 1 THEN 0 ELSE ROUND(@GstTotal / 2.0, 2) END;
    DECLARE @SGST DECIMAL(18,2) = CASE WHEN ISNULL(@IsInterState, 0) = 1 THEN 0 ELSE @GstTotal - ROUND(@GstTotal / 2.0, 2) END;
    DECLARE @IGST DECIMAL(18,2) = CASE WHEN ISNULL(@IsInterState, 0) = 1 THEN @GstTotal ELSE 0 END;
    DECLARE @GrandTotal DECIMAL(18,2) = @TaxableTotal + @GstTotal;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @OrderNo NVARCHAR(30);

        IF ISNULL(@SalesOrderId, 0) = 0
        BEGIN
            /* number series from Settings > Sales (prefix, start number) */
            EXEC dbo.sp_Sales_NextNumber @Kind = 'Invoice', @Consume = 1, @Number = @OrderNo OUTPUT;

            INSERT INTO dbo.SalesOrders
                (OrderNo, OrderDate, CustomerId, PaymentMode, PaymentDueDate, ReferenceNo, ContactNumber, GSTIN, BillingAddress,
                 City, [State], PinCode, IsInterState, Notes, Terms, WarrantyText,
                 SubTotal, DiscountTotal, TaxableTotal, CGST, SGST, IGST, GrandTotal, [Status], CreatedBy, CreatedAt)
            VALUES
                (@OrderNo, @OrderDate, @CustomerId, @PaymentMode, @PaymentDueDate, @ReferenceNo, @ContactNumber, @GSTIN, @BillingAddress,
                 @City, @State, @PinCode, ISNULL(@IsInterState, 0), @Notes,
                 LTRIM(RTRIM(ISNULL(@Terms, ''))), LTRIM(RTRIM(ISNULL(@WarrantyText, ''))),
                 @SubTotal, @DiscountTotal, @TaxableTotal, @CGST, @SGST, @IGST, @GrandTotal, @Status, @UserId, @Now);
            SET @SalesOrderId = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            DECLARE @CurStatus NVARCHAR(20);
            SELECT @CurStatus = [Status], @OrderNo = OrderNo FROM dbo.SalesOrders WITH (UPDLOCK, HOLDLOCK) WHERE SalesOrderId = @SalesOrderId;

            IF @CurStatus IS NULL
            BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Sales order not found.' AS Message, NULL AS SalesOrderId, NULL AS OrderNo; RETURN; END
            IF @CurStatus NOT IN ('Sales Order', 'Sales Confirmed')
            BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'A ' + LOWER(@CurStatus) + ' sales order cannot be changed.' AS Message, NULL AS SalesOrderId, NULL AS OrderNo; RETURN; END

            UPDATE dbo.SalesOrders
            SET OrderDate = @OrderDate, CustomerId = @CustomerId, PaymentMode = @PaymentMode, PaymentDueDate = @PaymentDueDate, ReferenceNo = @ReferenceNo,
                ContactNumber = @ContactNumber, GSTIN = @GSTIN, BillingAddress = @BillingAddress,
                City = @City, [State] = @State, PinCode = @PinCode, IsInterState = ISNULL(@IsInterState, 0), Notes = @Notes,
                Terms = LTRIM(RTRIM(ISNULL(@Terms, ''))), WarrantyText = LTRIM(RTRIM(ISNULL(@WarrantyText, ''))),
                SubTotal = @SubTotal, DiscountTotal = @DiscountTotal, TaxableTotal = @TaxableTotal,
                CGST = @CGST, SGST = @SGST, IGST = @IGST, GrandTotal = @GrandTotal, UpdatedAt = @Now
            WHERE SalesOrderId = @SalesOrderId;

            DELETE FROM dbo.SalesOrderItems WHERE SalesOrderId = @SalesOrderId;
        END

        INSERT INTO dbo.SalesOrderItems
            (SalesOrderId, ProductMasterId, ProductName, Brand, Model, Category, HsnSac, Qty, Rate, DiscountAmount,
             GstPercent, TaxableAmount, GstAmount, LineTotal, WarrantyMonths, SortOrder)
        SELECT @SalesOrderId, ProductMasterId, ProductName, Brand, Model, Category, HsnSac, Qty, Rate, DiscountAmount,
               GstPercent, TaxableAmount, GstAmount, LineTotal, WarrantyMonths, RowNo
        FROM @Items ORDER BY RowNo;

        /* the billing details also update the customer master (phone / GSTIN / address) */
        UPDATE dbo.Customers
        SET GSTIN     = ISNULL(NULLIF(@GSTIN, ''), GSTIN),
            Address   = ISNULL(NULLIF(@BillingAddress, ''), Address),
            City      = ISNULL(NULLIF(@City, ''), City),
            [State]   = ISNULL(NULLIF(@State, ''), [State]),
            PinCode   = ISNULL(NULLIF(@PinCode, ''), PinCode),
            UpdatedAt = @Now
        WHERE CustomerId = @CustomerId;

        COMMIT TRANSACTION;

        SELECT 1 AS Success, 'Sales order ' + @OrderNo + ' saved.' AS Message, @SalesOrderId AS SalesOrderId, @OrderNo AS OrderNo;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message, NULL AS SalesOrderId, NULL AS OrderNo;
    END CATCH
END
GO

/* copied from 23_Sales_Documents_Despatch_Mode.sql; changed: only a Billed order is despatched */
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
    /* only a billed order (its invoice attached) comes to Despatch */
    IF @Status <> 'Billed'
    BEGIN SELECT 0 AS Success, 'Sales order ' + @OrderNo + ' is not billed yet. Attach its invoice and mark it billed first.' AS Message, NULL AS DespatchId, NULL AS DespatchNo, NULL AS ComplaintId, NULL AS ComplaintNumber; RETURN; END

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

/* Sales Order -> Sales Confirmed -> Billed. Billed needs an Invoice PDF in dbo.SalesDocuments;
   a billed order is what the Despatch screen lists as pending. */
CREATE OR ALTER PROCEDURE dbo.sp_SalesOrder_SetStatus
    @SalesOrderId INT,
    @Status       NVARCHAR(20),
    @UserId       INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Status = LTRIM(RTRIM(ISNULL(@Status, '')));
    IF @Status NOT IN ('Sales Confirmed', 'Billed')
    BEGIN SELECT 0 AS Success, 'A sales order can be marked Sales Confirmed or Billed.' AS Message; RETURN; END

    BEGIN TRANSACTION;

    DECLARE @Current NVARCHAR(20), @OrderNo NVARCHAR(30);
    SELECT @Current = [Status], @OrderNo = OrderNo
    FROM dbo.SalesOrders WITH (UPDLOCK, HOLDLOCK)
    WHERE SalesOrderId = @SalesOrderId AND IsActive = 1;

    IF @Current IS NULL
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Sales order not found.' AS Message; RETURN; END

    IF @Current = @Status
    BEGIN ROLLBACK TRANSACTION; SELECT 1 AS Success, 'Sales order ' + @OrderNo + ' is ' + @Status + ' already.' AS Message; RETURN; END

    IF NOT ((@Current = 'Sales Order' AND @Status = 'Sales Confirmed') OR (@Current = 'Sales Confirmed' AND @Status = 'Billed'))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT 0 AS Success,
               CASE WHEN @Current IN ('Billed', 'Despatched', 'Cancelled') THEN 'Sales order ' + @OrderNo + ' is ' + LOWER(@Current) + ' already.'
                    WHEN @Status = 'Billed' THEN 'Confirm the sale before marking it billed.'
                    ELSE 'The status moves from Sales Order to Sales Confirmed to Billed.' END AS Message;
        RETURN;
    END

    IF @Status = 'Billed'
       AND NOT EXISTS (SELECT 1 FROM dbo.SalesDocuments
                       WHERE SalesOrderId = @SalesOrderId AND DocumentType = 'Invoice' AND IsDeleted = 0)
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Attach the invoice PDF before marking the sales order billed.' AS Message; RETURN; END

    UPDATE dbo.SalesOrders
    SET [Status] = @Status, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE SalesOrderId = @SalesOrderId;

    COMMIT TRANSACTION;
    SELECT 1 AS Success,
           CASE WHEN @Status = 'Billed' THEN 'Sales order ' + @OrderNo + ' billed and sent to Despatch.'
                ELSE 'Sales order ' + @OrderNo + ' confirmed.' END AS Message;
END
GO

/* copied from 23_Sales_Documents_Despatch_Mode.sql: a billed (or despatched) order keeps at least one invoice */
CREATE OR ALTER PROCEDURE dbo.sp_SalesDocument_Delete
    @DocumentId INT,
    @UserId     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DECLARE @SalesOrderId INT, @DocumentType NVARCHAR(40), @OrderStatus NVARCHAR(20);
    SELECT @SalesOrderId = sd.SalesOrderId, @DocumentType = sd.DocumentType, @OrderStatus = so.[Status]
    FROM dbo.SalesDocuments sd
    INNER JOIN dbo.SalesOrders so WITH (UPDLOCK, HOLDLOCK) ON so.SalesOrderId = sd.SalesOrderId
    WHERE sd.DocumentId = @DocumentId AND sd.IsDeleted = 0;

    IF @SalesOrderId IS NULL
    BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Document not found.' AS Message; RETURN; END

    IF @DocumentType = 'Invoice' AND @OrderStatus IN ('Billed', 'Despatched')
       AND NOT EXISTS (SELECT 1 FROM dbo.SalesDocuments
                       WHERE SalesOrderId = @SalesOrderId AND DocumentType = 'Invoice' AND IsDeleted = 0 AND DocumentId <> @DocumentId)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT 0 AS Success, 'A billed sales order keeps its invoice. Add the corrected invoice first, then remove this one.' AS Message;
        RETURN;
    END

    UPDATE dbo.SalesDocuments
    SET IsDeleted = 1, DeletedBy = @UserId, DeletedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE DocumentId = @DocumentId AND IsDeleted = 0;

    COMMIT TRANSACTION;
    SELECT 1 AS Success, 'Document removed.' AS Message;
END
GO

PRINT 'Sales order workflow applied.';
GO
SET NOEXEC OFF;
GO
