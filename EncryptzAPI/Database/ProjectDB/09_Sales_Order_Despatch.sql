/* =============================================================================
   ProjectDB · Sales Order → Despatch → Installation complaint → Warranty
   -----------------------------------------------------------------------------
   Flow
     1. Sales Order (bill) is entered against a customer of the customer master
        (an existing customer, or a new one created from the Sales Order screen:
        dbo.sp_Sales_Customer_Save writes Users + Customers, the same master the
        complaints and the customer portal use).
     2. Each bill line is a ProductMaster item; the warranty months of the master
        are copied to the line (editable on the bill).
     3. Despatch: every unit gets a serial number. For each unit a row is written
        to dbo.Products (the customer's installed base: PurchaseDate = bill date,
        WarrantyExpiryDate = despatch date + warranty months), and ONE
        "New Installation" complaint (NatureOfJob = 'Installation', IsWarranty = 1,
        StatusId = 1) is created so it shows on the dashboard like any other
        complaint and a technician can be assigned to it.
     4. Later complaints registered against that product show whether it is
        still under warranty (sp_Complaint_GetAll now returns WarrantyStatus;
        sp_ManageComplaintDetails already did for the detail popup);
        dbo.sp_Sales_WarrantyLookup finds a unit by serial / customer / bill.

   New tables (all stamped CompanyId / ProjectId / LocationId from SESSION_CONTEXT
   like every other business table, and added to the row-filter policy):
     SalesOrders, SalesOrderItems, Despatches, DespatchItems
   Changed: Customers + GSTIN column; sp_Complaint_GetAll (+ warranty columns).

   Run AFTER 08_Backoffice_Technician_Fixes.sql. SAFE TO RE-RUN.
   ============================================================================= */
SET NOCOUNT ON;
GO

/* =============================================================================
   1. Customers master: GSTIN (billing)
   ============================================================================= */
IF COL_LENGTH('dbo.Customers', 'GSTIN') IS NULL
    ALTER TABLE dbo.Customers ADD GSTIN NVARCHAR(20) NULL;
GO

/* =============================================================================
   2. Tables
   ============================================================================= */
IF OBJECT_ID('dbo.SalesOrders') IS NULL
BEGIN
    CREATE TABLE dbo.SalesOrders
    (
        SalesOrderId     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        OrderNo          NVARCHAR(30)   NOT NULL,
        OrderDate        DATE           NOT NULL,
        CustomerId       INT            NOT NULL,
        PaymentMode      NVARCHAR(30)   NULL,
        ReferenceNo      NVARCHAR(100)  NULL,
        ContactNumber    NVARCHAR(20)   NULL,
        GSTIN            NVARCHAR(20)   NULL,
        BillingAddress   NVARCHAR(500)  NULL,
        City             NVARCHAR(100)  NULL,
        [State]          NVARCHAR(100)  NULL,
        PinCode          NVARCHAR(10)   NULL,
        IsInterState     BIT            NOT NULL CONSTRAINT DF_SalesOrders_IsInterState DEFAULT (0),
        Notes            NVARCHAR(2000) NULL,
        SubTotal         DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrders_SubTotal DEFAULT (0),
        DiscountTotal    DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrders_DiscountTotal DEFAULT (0),
        TaxableTotal     DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrders_TaxableTotal DEFAULT (0),
        CGST             DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrders_CGST DEFAULT (0),
        SGST             DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrders_SGST DEFAULT (0),
        IGST             DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrders_IGST DEFAULT (0),
        GrandTotal       DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrders_GrandTotal DEFAULT (0),
        [Status]         NVARCHAR(20)   NOT NULL CONSTRAINT DF_SalesOrders_Status DEFAULT ('Billed'),   -- Billed / Despatched / Cancelled
        CreatedBy        INT            NULL,
        CreatedAt        DATETIME2(7)   NOT NULL CONSTRAINT DF_SalesOrders_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
        UpdatedAt        DATETIME2(7)   NULL,
        IsActive         BIT            NOT NULL CONSTRAINT DF_SalesOrders_IsActive DEFAULT (1),
        CompanyId        INT            NOT NULL CONSTRAINT DF_SalesOrders_CompanyId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'CompanyId')), 0)),
        ProjectId        INT            NOT NULL CONSTRAINT DF_SalesOrders_ProjectId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'ProjectId')), 0)),
        LocationId       INT            NOT NULL CONSTRAINT DF_SalesOrders_LocationId DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'LocationId')), 0))
    );
    CREATE INDEX IX_SalesOrders_Customer ON dbo.SalesOrders (CustomerId);
    CREATE INDEX IX_SalesOrders_OrderNo  ON dbo.SalesOrders (OrderNo);
    PRINT 'Table created: dbo.SalesOrders';
END
GO

IF OBJECT_ID('dbo.SalesOrderItems') IS NULL
BEGIN
    CREATE TABLE dbo.SalesOrderItems
    (
        SalesOrderItemId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SalesOrderId     INT            NOT NULL,
        ProductMasterId  INT            NULL,
        ProductName      NVARCHAR(200)  NOT NULL,
        Brand            NVARCHAR(100)  NULL,
        Model            NVARCHAR(100)  NULL,
        Category         NVARCHAR(100)  NULL,
        HsnSac           NVARCHAR(20)   NULL,
        Qty              INT            NOT NULL CONSTRAINT DF_SalesOrderItems_Qty DEFAULT (1),
        Rate             DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrderItems_Rate DEFAULT (0),
        DiscountAmount   DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrderItems_Discount DEFAULT (0),
        GstPercent       DECIMAL(5,2)   NOT NULL CONSTRAINT DF_SalesOrderItems_Gst DEFAULT (18),
        TaxableAmount    DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrderItems_Taxable DEFAULT (0),
        GstAmount        DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrderItems_GstAmt DEFAULT (0),
        LineTotal        DECIMAL(18,2)  NOT NULL CONSTRAINT DF_SalesOrderItems_LineTotal DEFAULT (0),
        WarrantyMonths   INT            NOT NULL CONSTRAINT DF_SalesOrderItems_Warranty DEFAULT (12),
        SortOrder        INT            NOT NULL CONSTRAINT DF_SalesOrderItems_Sort DEFAULT (0),
        CompanyId        INT            NOT NULL CONSTRAINT DF_SalesOrderItems_CompanyId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'CompanyId')), 0)),
        ProjectId        INT            NOT NULL CONSTRAINT DF_SalesOrderItems_ProjectId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'ProjectId')), 0)),
        LocationId       INT            NOT NULL CONSTRAINT DF_SalesOrderItems_LocationId DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'LocationId')), 0))
    );
    CREATE INDEX IX_SalesOrderItems_Order ON dbo.SalesOrderItems (SalesOrderId);
    PRINT 'Table created: dbo.SalesOrderItems';
END
GO

IF OBJECT_ID('dbo.Despatches') IS NULL
BEGIN
    CREATE TABLE dbo.Despatches
    (
        DespatchId              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DespatchNo              NVARCHAR(30)   NOT NULL,
        SalesOrderId            INT            NOT NULL,
        DespatchDate            DATE           NOT NULL,
        DeliveryAddress         NVARCHAR(500)  NULL,
        ContactPerson           NVARCHAR(150)  NULL,
        ContactNumber           NVARCHAR(20)   NULL,
        TransporterName         NVARCHAR(150)  NULL,
        VehicleNo               NVARCHAR(50)   NULL,
        DriverName              NVARCHAR(150)  NULL,
        TrackingNo              NVARCHAR(100)  NULL,
        Remarks                 NVARCHAR(1000) NULL,
        [Status]                NVARCHAR(20)   NOT NULL CONSTRAINT DF_Despatches_Status DEFAULT ('Despatched'),
        InstallationComplaintId INT            NULL,
        CreatedBy               INT            NULL,
        CreatedAt               DATETIME2(7)   NOT NULL CONSTRAINT DF_Despatches_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
        CompanyId               INT            NOT NULL CONSTRAINT DF_Despatches_CompanyId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'CompanyId')), 0)),
        ProjectId               INT            NOT NULL CONSTRAINT DF_Despatches_ProjectId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'ProjectId')), 0)),
        LocationId              INT            NOT NULL CONSTRAINT DF_Despatches_LocationId DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'LocationId')), 0))
    );
    CREATE INDEX IX_Despatches_Order ON dbo.Despatches (SalesOrderId);
    PRINT 'Table created: dbo.Despatches';
END
GO

IF OBJECT_ID('dbo.DespatchItems') IS NULL
BEGIN
    CREATE TABLE dbo.DespatchItems
    (
        DespatchItemId    INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DespatchId        INT            NOT NULL,
        SalesOrderItemId  INT            NOT NULL,
        ProductId         INT            NULL,          -- dbo.Products row of the customer (one per unit)
        SerialNumber      NVARCHAR(100)  NOT NULL,
        WarrantyMonths    INT            NOT NULL CONSTRAINT DF_DespatchItems_Warranty DEFAULT (12),
        WarrantyStartDate DATE           NULL,
        WarrantyEndDate   DATE           NULL,
        CompanyId         INT            NOT NULL CONSTRAINT DF_DespatchItems_CompanyId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'CompanyId')), 0)),
        ProjectId         INT            NOT NULL CONSTRAINT DF_DespatchItems_ProjectId  DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'ProjectId')), 0)),
        LocationId        INT            NOT NULL CONSTRAINT DF_DespatchItems_LocationId DEFAULT (ISNULL(CONVERT(INT, SESSION_CONTEXT(N'LocationId')), 0))
    );
    CREATE INDEX IX_DespatchItems_Despatch ON dbo.DespatchItems (DespatchId);
    CREATE INDEX IX_DespatchItems_Product  ON dbo.DespatchItems (ProductId);
    PRINT 'Table created: dbo.DespatchItems';
END
GO

/* =============================================================================
   3. Row filter: the new tables are location-scoped like the complaints
      (only when the policy of 05_Scope_RowFilter.sql exists)
   ============================================================================= */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantScopePolicy')
   AND OBJECT_ID('Security.fn_LocationScope') IS NOT NULL
BEGIN
    DECLARE @t SYSNAME, @sql NVARCHAR(MAX);
    DECLARE @new TABLE (Name SYSNAME);
    INSERT INTO @new (Name) VALUES ('SalesOrders'), ('SalesOrderItems'), ('Despatches'), ('DespatchItems');

    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT n.Name FROM @new n
        WHERE NOT EXISTS (SELECT 1
                          FROM sys.security_predicates sp
                          INNER JOIN sys.security_policies pol ON pol.object_id = sp.object_id
                          WHERE pol.name = 'TenantScopePolicy'
                            AND sp.target_object_id = OBJECT_ID('dbo.' + n.Name));
    OPEN cur; FETCH NEXT FROM cur INTO @t;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'ALTER SECURITY POLICY Security.TenantScopePolicy ADD FILTER PREDICATE Security.fn_LocationScope(ProjectId, LocationId) ON dbo.' + QUOTENAME(@t) + N';';
        EXEC sp_executesql @sql;
        PRINT 'Row filter added: dbo.' + @t;
        FETCH NEXT FROM cur INTO @t;
    END
    CLOSE cur; DEALLOCATE cur;
END
GO

/* =============================================================================
   3b. Settings (Settings > General Settings): invoice / despatch numbering and
       the print header / footer. Rows are only added, never overwritten.
   ============================================================================= */
/* DataType holds "select:none,text,image" (22 chars); the original column is VARCHAR(20) */
IF COL_LENGTH('dbo.SystemSettings', 'DataType') < 50
    ALTER TABLE dbo.SystemSettings ALTER COLUMN DataType VARCHAR(50) NULL;
GO

DECLARE @NextComplaint NVARCHAR(12) = CAST(ISNULL((SELECT MAX(ComplaintId) FROM dbo.Complaints), 0) + 1 AS NVARCHAR(12));

MERGE dbo.SystemSettings AS t
USING (VALUES
    ('Complaint.NumberPrefix',     N'CMP',  'Complaint', 'string', N'Prefix of the complaint number, e.g. CMP',                                      1),
    ('Complaint.IncludeDate',      N'true', 'Complaint', 'bool',   N'Put the date (yyyyMMdd) into the complaint number: CMP-20261009-0001',          1),
    ('Complaint.NextNumber',       @NextComplaint, 'Complaint', 'int', N'Running number of the NEXT complaint. Set the start number here; it moves on by itself', 1),
    ('Complaint.NumberPadding',    N'4',    'Complaint', 'int',    N'Digits of the running number (4 = 0001)',                                       1),
    ('Sales.InvoicePrefix',        N'INV',  'Sales', 'string',   N'Prefix of the bill (invoice) number, e.g. INV',                                   1),
    ('Sales.InvoiceIncludeDate',   N'true', 'Sales', 'bool',     N'Put the date (yyyyMMdd) into the bill number: INV-20261009-0001',                 1),
    ('Sales.InvoiceNextNumber',    N'1',    'Sales', 'int',      N'Running number of the NEXT bill. Set the start number here; it moves on by itself', 1),
    ('Sales.InvoiceNumberPadding', N'4',    'Sales', 'int',      N'Digits of the running number (4 = 0001)',                                        1),
    ('Sales.DespatchPrefix',       N'DSP',  'Sales', 'string',   N'Prefix of the despatch number, e.g. DSP',                                        1),
    ('Sales.DespatchNextNumber',   N'1',    'Sales', 'int',      N'Running number of the NEXT despatch',                                            1),
    ('Sales.DefaultInterState',    N'false','Sales', 'bool',     N'Tick "Inter-state supply (IGST)" by default on a new bill',                       1),
    ('Print.CompanyName',          N'',     'Print', 'string',   N'Company name printed on the invoice (blank = the company of the login)',          1),
    ('Print.CompanyAddress',       N'',     'Print', 'textarea', N'Company address lines printed on the invoice',                                   1),
    ('Print.CompanyGSTIN',         N'',     'Print', 'string',   N'Company GSTIN printed on the invoice',                                           1),
    ('Print.CompanyPhone',         N'',     'Print', 'string',   N'Company phone / e-mail printed on the invoice',                                  1),
    ('Print.HeaderMode',           N'none', 'Print', 'select:none,text,image', N'Invoice header: none, the header text, or the header image',        1),
    ('Print.HeaderText',           N'',     'Print', 'textarea', N'Header text printed on top of the invoice (Header Mode = text)',                 1),
    ('Print.HeaderImage',          N'',     'Print', 'image',    N'Header image / letterhead printed on top of the invoice (Header Mode = image)',   1),
    ('Print.FooterMode',           N'none', 'Print', 'select:none,text,image', N'Invoice footer: none, the footer text, or the footer image',        1),
    ('Print.FooterText',           N'',     'Print', 'textarea', N'Footer text / terms printed at the bottom of the invoice (Footer Mode = text)',  1),
    ('Print.FooterImage',          N'',     'Print', 'image',    N'Footer image printed at the bottom of the invoice (Footer Mode = image)',        1)
) AS s (SettingKey, SettingValue, SettingGroup, DataType, Description, IsEditable)
    ON t.SettingKey = s.SettingKey
WHEN NOT MATCHED THEN
    INSERT (SettingKey, SettingValue, SettingGroup, DataType, Description, IsEditable, ModifiedDate)
    VALUES (s.SettingKey, s.SettingValue, s.SettingGroup, s.DataType, s.Description, s.IsEditable, DATEADD(MINUTE, 330, GETUTCDATE()));

/* the earlier on/off switch is replaced by the header / footer modes */
IF EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE SettingKey = 'Print.ShowHeaderFooter')
BEGIN
    UPDATE dbo.SystemSettings SET SettingValue = 'text'
    WHERE SettingKey IN ('Print.HeaderMode', 'Print.FooterMode')
      AND SettingValue = 'none'
      AND EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE SettingKey = 'Print.ShowHeaderFooter' AND LOWER(SettingValue) IN ('true', '1', 'yes'));
    DELETE FROM dbo.SystemSettings WHERE SettingKey = 'Print.ShowHeaderFooter';
END
PRINT 'Settings: Complaint / Sales numbering + Print rows are in place.';
GO

/* Next bill / despatch / complaint number from the settings.
   @Kind 'Invoice' | 'Despatch' | 'Complaint' · @Consume 1 = take the number (the
   setting moves on), 0 = only show it. Format: PREFIX-[yyyyMMdd-]NNNN. Locks the
   setting row so two documents saved at the same moment never get the same number. */
CREATE OR ALTER PROCEDURE dbo.sp_Sales_NextNumber
    @Kind    NVARCHAR(20),
    @Consume BIT = 1,
    @Number  NVARCHAR(30) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @PrefixKey VARCHAR(100), @NextKey VARCHAR(100), @PadKey VARCHAR(100), @DateKey VARCHAR(100), @DefPrefix NVARCHAR(10);
    IF @Kind = 'Despatch'
        SELECT @PrefixKey = 'Sales.DespatchPrefix', @NextKey = 'Sales.DespatchNextNumber', @PadKey = 'Sales.InvoiceNumberPadding', @DateKey = 'Sales.InvoiceIncludeDate', @DefPrefix = N'DSP';
    ELSE IF @Kind = 'Complaint'
        SELECT @PrefixKey = 'Complaint.NumberPrefix', @NextKey = 'Complaint.NextNumber', @PadKey = 'Complaint.NumberPadding', @DateKey = 'Complaint.IncludeDate', @DefPrefix = N'CMP';
    ELSE
        SELECT @PrefixKey = 'Sales.InvoicePrefix', @NextKey = 'Sales.InvoiceNextNumber', @PadKey = 'Sales.InvoiceNumberPadding', @DateKey = 'Sales.InvoiceIncludeDate', @DefPrefix = N'INV';

    DECLARE @Prefix NVARCHAR(20), @Next INT, @Pad INT, @WithDate BIT;

    SELECT @Prefix = NULLIF(LTRIM(RTRIM(SettingValue)), '') FROM dbo.SystemSettings WHERE SettingKey = @PrefixKey;
    SELECT @Pad = TRY_CAST(SettingValue AS INT) FROM dbo.SystemSettings WHERE SettingKey = @PadKey;
    SELECT @WithDate = CASE WHEN LOWER(LTRIM(RTRIM(SettingValue))) IN ('true', '1', 'yes') THEN 1 ELSE 0 END
    FROM dbo.SystemSettings WHERE SettingKey = @DateKey;

    SET @Prefix   = ISNULL(@Prefix, @DefPrefix);
    SET @Pad      = CASE WHEN ISNULL(@Pad, 0) BETWEEN 1 AND 10 THEN @Pad ELSE 4 END;
    SET @WithDate = ISNULL(@WithDate, 1);

    /* the running number: read with a lock when it is consumed */
    IF @Consume = 1
        SELECT @Next = TRY_CAST(SettingValue AS INT) FROM dbo.SystemSettings WITH (UPDLOCK, HOLDLOCK) WHERE SettingKey = @NextKey;
    ELSE
        SELECT @Next = TRY_CAST(SettingValue AS INT) FROM dbo.SystemSettings WHERE SettingKey = @NextKey;

    IF @Next IS NULL
    BEGIN
        /* no setting yet: continue after the last row of the table */
        IF @Kind = 'Despatch'
            SELECT @Next = ISNULL(MAX(DespatchId), 0) + 1 FROM dbo.Despatches;
        ELSE IF @Kind = 'Complaint'
            SELECT @Next = ISNULL(MAX(ComplaintId), 0) + 1 FROM dbo.Complaints;
        ELSE
            SELECT @Next = ISNULL(MAX(SalesOrderId), 0) + 1 FROM dbo.SalesOrders;
    END
    IF @Next < 1 SET @Next = 1;

    SET @Number = @Prefix + '-'
                + CASE WHEN @WithDate = 1 THEN FORMAT(DATEADD(MINUTE, 330, GETUTCDATE()), 'yyyyMMdd') + '-' ELSE '' END
                + RIGHT(REPLICATE('0', @Pad) + CAST(@Next AS VARCHAR(12)), CASE WHEN LEN(CAST(@Next AS VARCHAR(12))) > @Pad THEN LEN(CAST(@Next AS VARCHAR(12))) ELSE @Pad END);

    IF @Consume = 1
    BEGIN
        /* a number already used (e.g. the start number was set back): skip ahead */
        WHILE (@Kind = 'Despatch'  AND EXISTS (SELECT 1 FROM dbo.Despatches  WHERE DespatchNo = @Number))
           OR (@Kind = 'Complaint' AND EXISTS (SELECT 1 FROM dbo.Complaints  WHERE ComplaintNumber = @Number))
           OR (@Kind NOT IN ('Despatch', 'Complaint') AND EXISTS (SELECT 1 FROM dbo.SalesOrders WHERE OrderNo = @Number))
        BEGIN
            SET @Next = @Next + 1;
            SET @Number = @Prefix + '-'
                        + CASE WHEN @WithDate = 1 THEN FORMAT(DATEADD(MINUTE, 330, GETUTCDATE()), 'yyyyMMdd') + '-' ELSE '' END
                        + RIGHT(REPLICATE('0', @Pad) + CAST(@Next AS VARCHAR(12)), CASE WHEN LEN(CAST(@Next AS VARCHAR(12))) > @Pad THEN LEN(CAST(@Next AS VARCHAR(12))) ELSE @Pad END);
        END

        IF EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE SettingKey = @NextKey)
            UPDATE dbo.SystemSettings SET SettingValue = CAST(@Next + 1 AS NVARCHAR(12)), ModifiedDate = DATEADD(MINUTE, 330, GETUTCDATE())
            WHERE SettingKey = @NextKey;
        ELSE
            INSERT INTO dbo.SystemSettings (SettingKey, SettingValue, SettingGroup, DataType, Description, IsEditable, ModifiedDate)
            VALUES (@NextKey, CAST(@Next + 1 AS NVARCHAR(12)), CASE WHEN @Kind = 'Complaint' THEN 'Complaint' ELSE 'Sales' END, 'int',
                    N'Running number of the next ' + LOWER(@Kind), 1, DATEADD(MINUTE, 330, GETUTCDATE()));
    END
END
GO

/* Complaint numbers (prefix / start number from Settings > Complaint) */
CREATE OR ALTER PROCEDURE dbo.sp_Complaint_NextNumber
    @Consume BIT = 1,
    @Number  NVARCHAR(30) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC dbo.sp_Sales_NextNumber @Kind = 'Complaint', @Consume = @Consume, @Number = @Number OUTPUT;
END
GO

/* =============================================================================
   4. Customer master from the Sales Order screen
   ============================================================================= */

/* Customer picker: name / mobile / e-mail / city */
CREATE OR ALTER PROCEDURE dbo.sp_Sales_Customer_Search
    @SearchTerm NVARCHAR(100) = NULL,
    @Top        INT = 50
AS
BEGIN
    SET NOCOUNT ON;
    SET @SearchTerm = NULLIF(LTRIM(RTRIM(@SearchTerm)), '');
    SET @Top = CASE WHEN ISNULL(@Top, 0) BETWEEN 1 AND 200 THEN @Top ELSE 50 END;

    SELECT TOP (@Top)
           c.CustomerId, c.CustomerName, c.MobileNumber, c.AlternatePhone, c.Email,
           c.Address, c.City, c.[State], c.PinCode, c.Landmark, c.GSTIN,
           c.Latitude, c.Longitude,
           (SELECT COUNT(*) FROM dbo.Products p WHERE p.CustomerId = c.CustomerId AND p.IsActive = 1) AS TotalProducts
    FROM dbo.Customers c
    WHERE c.IsActive = 1
      AND (@SearchTerm IS NULL
           OR c.CustomerName LIKE '%' + @SearchTerm + '%'
           OR c.MobileNumber LIKE '%' + @SearchTerm + '%'
           OR c.Email        LIKE '%' + @SearchTerm + '%'
           OR c.City         LIKE '%' + @SearchTerm + '%')
    ORDER BY c.CustomerName;
END
GO

/* Create / update a customer of the master.
   New customer: a Users row (role Customer) + a Customers row, exactly like
   sp_Customer_Create, so the customer can also use the portal later. A mobile
   number already in the master returns that customer (its details are updated). */
CREATE OR ALTER PROCEDURE dbo.sp_Sales_Customer_Save
    @CustomerId     INT = 0,
    @CustomerName   NVARCHAR(150),
    @MobileNumber   NVARCHAR(20),
    @Email          NVARCHAR(150) = NULL,
    @AlternatePhone NVARCHAR(15)  = NULL,
    @Address        NVARCHAR(500) = NULL,
    @City           NVARCHAR(100) = NULL,
    @State          NVARCHAR(100) = NULL,
    @PinCode        NVARCHAR(10)  = NULL,
    @Landmark       NVARCHAR(200) = NULL,
    @GSTIN          NVARCHAR(20)  = NULL,
    @Latitude       DECIMAL(9,6)  = NULL,
    @Longitude      DECIMAL(9,6)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @CustomerName   = NULLIF(LTRIM(RTRIM(@CustomerName)), '');
    SET @MobileNumber   = NULLIF(LTRIM(RTRIM(@MobileNumber)), '');
    SET @Email          = NULLIF(LTRIM(RTRIM(@Email)), '');
    SET @GSTIN          = NULLIF(UPPER(LTRIM(RTRIM(@GSTIN))), '');
    DECLARE @Now DATETIME2(7) = DATEADD(MINUTE, 330, GETUTCDATE());

    IF @CustomerName IS NULL
    BEGIN SELECT 0 AS Success, 'Customer name is required.' AS Message, NULL AS CustomerId, 0 AS IsNew; RETURN; END
    IF @MobileNumber IS NULL
    BEGIN SELECT 0 AS Success, 'Mobile number is required.' AS Message, NULL AS CustomerId, 0 AS IsNew; RETURN; END

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @IsNew BIT = 0;

        /* an existing customer with this mobile: update that one */
        IF ISNULL(@CustomerId, 0) = 0
            SELECT TOP 1 @CustomerId = CustomerId FROM dbo.Customers
            WHERE MobileNumber = @MobileNumber ORDER BY IsActive DESC, CustomerId;

        IF ISNULL(@CustomerId, 0) = 0
        BEGIN
            DECLARE @UserId INT;
            SELECT TOP 1 @UserId = UserId FROM dbo.Users WHERE MobileNumber = @MobileNumber;

            IF @UserId IS NULL
            BEGIN
                DECLARE @CustomerRoleId INT;
                SELECT TOP 1 @CustomerRoleId = RoleId FROM dbo.Roles WHERE RoleName = N'Customer' ORDER BY IsActive DESC, RoleId;
                IF @CustomerRoleId IS NULL
                    SELECT TOP 1 @CustomerRoleId = RoleId FROM dbo.Roles ORDER BY RoleId;

                INSERT INTO dbo.Users (FullName, Email, MobileNumber, RoleId, IsActive, CreatedAt, UpdatedAt, UserType)
                VALUES (@CustomerName, @Email, @MobileNumber, @CustomerRoleId, 1, @Now, @Now, 'Customer');
                SET @UserId = SCOPE_IDENTITY();
            END

            INSERT INTO dbo.Customers
                (UserId, CustomerName, MobileNumber, AlternatePhone, Email, Address, City, [State], PinCode,
                 Landmark, GSTIN, Latitude, Longitude, IsActive, CreatedAt, UpdatedAt)
            VALUES
                (@UserId, @CustomerName, @MobileNumber, @AlternatePhone, @Email, @Address, @City, @State, @PinCode,
                 @Landmark, @GSTIN, @Latitude, @Longitude, 1, @Now, @Now);
            SET @CustomerId = SCOPE_IDENTITY();
            SET @IsNew = 1;
        END
        ELSE
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @CustomerId)
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT 0 AS Success, 'Customer not found.' AS Message, NULL AS CustomerId, 0 AS IsNew; RETURN;
            END

            /* the mobile must stay unique in the master */
            IF EXISTS (SELECT 1 FROM dbo.Customers WHERE MobileNumber = @MobileNumber AND CustomerId <> @CustomerId)
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT 0 AS Success, 'Another customer already uses this mobile number.' AS Message, NULL AS CustomerId, 0 AS IsNew; RETURN;
            END

            UPDATE dbo.Customers
            SET CustomerName   = @CustomerName,
                MobileNumber   = @MobileNumber,
                AlternatePhone = ISNULL(@AlternatePhone, AlternatePhone),
                Email          = ISNULL(@Email, Email),
                Address        = ISNULL(@Address, Address),
                City           = ISNULL(@City, City),
                [State]        = ISNULL(@State, [State]),
                PinCode        = ISNULL(@PinCode, PinCode),
                Landmark       = ISNULL(@Landmark, Landmark),
                GSTIN          = ISNULL(@GSTIN, GSTIN),
                Latitude       = ISNULL(@Latitude, Latitude),
                Longitude      = ISNULL(@Longitude, Longitude),
                IsActive       = 1,
                UpdatedAt      = @Now
            WHERE CustomerId = @CustomerId;

            /* keep the login row in step (name / e-mail) */
            UPDATE u
            SET u.FullName = @CustomerName,
                u.Email    = ISNULL(@Email, u.Email),
                u.UpdatedAt = @Now
            FROM dbo.Users u
            INNER JOIN dbo.Customers c ON c.UserId = u.UserId
            WHERE c.CustomerId = @CustomerId;
        END

        COMMIT TRANSACTION;

        SELECT 1 AS Success,
               CASE WHEN @IsNew = 1 THEN 'Customer created.' ELSE 'Customer updated.' END AS Message,
               @CustomerId AS CustomerId, @IsNew AS IsNew;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message, NULL AS CustomerId, 0 AS IsNew;
    END CATCH
END
GO

/* =============================================================================
   5. Sales Order (bill)
   ============================================================================= */

/* Next bill number for the screen (the real one is taken again on save) */
CREATE OR ALTER PROCEDURE dbo.sp_SalesOrder_NextNumber
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @No NVARCHAR(30);
    EXEC dbo.sp_Sales_NextNumber @Kind = 'Invoice', @Consume = 0, @Number = @No OUTPUT;
    SELECT @No AS OrderNo;
END
GO

/* Insert / update a bill with its lines.
   @ItemsJson: [{ "salesOrderItemId":0, "productMasterId":12, "productName":"..", "hsnSac":"8415",
                  "qty":1, "rate":25000, "discountAmount":0, "gstPercent":18, "warrantyMonths":12 }, ...]
   Amounts are recomputed here; a despatched bill cannot be changed any more. */
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
    @UserId         INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(7) = DATEADD(MINUTE, 330, GETUTCDATE());

    IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @CustomerId)
    BEGIN SELECT 0 AS Success, 'Select a customer first.' AS Message, NULL AS SalesOrderId, NULL AS OrderNo; RETURN; END

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
                (OrderNo, OrderDate, CustomerId, PaymentMode, ReferenceNo, ContactNumber, GSTIN, BillingAddress,
                 City, [State], PinCode, IsInterState, Notes,
                 SubTotal, DiscountTotal, TaxableTotal, CGST, SGST, IGST, GrandTotal, [Status], CreatedBy, CreatedAt)
            VALUES
                (@OrderNo, @OrderDate, @CustomerId, @PaymentMode, @ReferenceNo, @ContactNumber, @GSTIN, @BillingAddress,
                 @City, @State, @PinCode, ISNULL(@IsInterState, 0), @Notes,
                 @SubTotal, @DiscountTotal, @TaxableTotal, @CGST, @SGST, @IGST, @GrandTotal, 'Billed', @UserId, @Now);
            SET @SalesOrderId = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            DECLARE @CurStatus NVARCHAR(20);
            SELECT @CurStatus = [Status], @OrderNo = OrderNo FROM dbo.SalesOrders WHERE SalesOrderId = @SalesOrderId;

            IF @CurStatus IS NULL
            BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'Bill not found.' AS Message, NULL AS SalesOrderId, NULL AS OrderNo; RETURN; END
            IF @CurStatus <> 'Billed'
            BEGIN ROLLBACK TRANSACTION; SELECT 0 AS Success, 'A ' + LOWER(@CurStatus) + ' bill cannot be changed.' AS Message, NULL AS SalesOrderId, NULL AS OrderNo; RETURN; END

            UPDATE dbo.SalesOrders
            SET OrderDate = @OrderDate, CustomerId = @CustomerId, PaymentMode = @PaymentMode, ReferenceNo = @ReferenceNo,
                ContactNumber = @ContactNumber, GSTIN = @GSTIN, BillingAddress = @BillingAddress,
                City = @City, [State] = @State, PinCode = @PinCode, IsInterState = ISNULL(@IsInterState, 0), Notes = @Notes,
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

        SELECT 1 AS Success, 'Bill ' + @OrderNo + ' saved.' AS Message, @SalesOrderId AS SalesOrderId, @OrderNo AS OrderNo;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message, NULL AS SalesOrderId, NULL AS OrderNo;
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_SalesOrder_Cancel
    @SalesOrderId INT,
    @UserId       INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CurStatus NVARCHAR(20);
    SELECT @CurStatus = [Status] FROM dbo.SalesOrders WHERE SalesOrderId = @SalesOrderId;

    IF @CurStatus IS NULL
    BEGIN SELECT 0 AS Success, 'Bill not found.' AS Message; RETURN; END
    IF @CurStatus = 'Despatched'
    BEGIN SELECT 0 AS Success, 'A despatched bill cannot be cancelled.' AS Message; RETURN; END

    UPDATE dbo.SalesOrders
    SET [Status] = 'Cancelled', UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE SalesOrderId = @SalesOrderId;

    SELECT 1 AS Success, 'Bill cancelled.' AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_SalesOrder_GetAll
    @SearchTerm NVARCHAR(100) = NULL,
    @Status     NVARCHAR(20)  = NULL,
    @FromDate   DATE          = NULL,
    @ToDate     DATE          = NULL,
    @PageNumber INT           = 1,
    @PageSize   INT           = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET @SearchTerm = NULLIF(LTRIM(RTRIM(@SearchTerm)), '');
    SET @Status     = NULLIF(LTRIM(RTRIM(@Status)), '');
    SET @PageNumber = CASE WHEN ISNULL(@PageNumber, 0) < 1 THEN 1 ELSE @PageNumber END;
    SET @PageSize   = CASE WHEN ISNULL(@PageSize, 0) BETWEEN 1 AND 200 THEN @PageSize ELSE 20 END;

    SELECT so.SalesOrderId, so.OrderNo, so.OrderDate, so.[Status], so.PaymentMode, so.ReferenceNo,
           so.CustomerId, c.CustomerName, c.MobileNumber AS CustomerMobile, so.City,
           so.SubTotal, so.DiscountTotal, so.CGST, so.SGST, so.IGST, so.GrandTotal,
           (SELECT COUNT(*) FROM dbo.SalesOrderItems i WHERE i.SalesOrderId = so.SalesOrderId) AS LineCount,
           (SELECT SUM(i.Qty) FROM dbo.SalesOrderItems i WHERE i.SalesOrderId = so.SalesOrderId)  AS TotalQty,
           d.DespatchId, d.DespatchNo, d.DespatchDate,
           d.InstallationComplaintId, cm.ComplaintNumber AS InstallationComplaintNo, cs.StatusName AS InstallationStatus,
           so.CreatedAt,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.SalesOrders so
    INNER JOIN dbo.Customers c ON c.CustomerId = so.CustomerId
    OUTER APPLY (SELECT TOP 1 d.DespatchId, d.DespatchNo, d.DespatchDate, d.InstallationComplaintId
                 FROM dbo.Despatches d WHERE d.SalesOrderId = so.SalesOrderId ORDER BY d.DespatchId DESC) d
    LEFT JOIN dbo.Complaints cm        ON cm.ComplaintId = d.InstallationComplaintId
    LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = cm.StatusId
    WHERE so.IsActive = 1
      AND (@Status IS NULL OR so.[Status] = @Status)
      AND (@FromDate IS NULL OR so.OrderDate >= @FromDate)
      AND (@ToDate   IS NULL OR so.OrderDate <= @ToDate)
      AND (@SearchTerm IS NULL
           OR so.OrderNo        LIKE '%' + @SearchTerm + '%'
           OR c.CustomerName    LIKE '%' + @SearchTerm + '%'
           OR c.MobileNumber    LIKE '%' + @SearchTerm + '%'
           OR so.ReferenceNo    LIKE '%' + @SearchTerm + '%'
           OR EXISTS (SELECT 1 FROM dbo.SalesOrderItems i WHERE i.SalesOrderId = so.SalesOrderId AND i.ProductName LIKE '%' + @SearchTerm + '%'))
    ORDER BY so.SalesOrderId DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* Table[0] bill + customer · Table[1] lines (+ warranty after despatch) · Table[2] despatch (+ complaint) */
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
           d.TransporterName, d.VehicleNo, d.DriverName, d.TrackingNo, d.Remarks, d.[Status],
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

/* =============================================================================
   6. Despatch
   ============================================================================= */

/* Despatch a bill: one serial number per unit.
   @ItemsJson: [{ "salesOrderItemId": 5, "serialNumber": "SN001" }, ...]  (Qty rows per line;
                a missing serial number is generated from the bill number)
   Writes dbo.Products for the customer (warranty = despatch date + months of the line),
   one "New Installation" complaint for the dashboard, and marks the bill Despatched. */
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
             TransporterName, VehicleNo, DriverName, TrackingNo, Remarks, [Status], CreatedBy, CreatedAt)
        VALUES
            (@DespatchNo, @SalesOrderId, @DespatchDate, @DeliveryAddress, @ContactPerson, @ContactNumber,
             @TransporterName, @VehicleNo, @DriverName, @TrackingNo, @Remarks, 'Despatched', @UserId, @Now);
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

    SELECT d.DespatchId, d.DespatchNo, d.DespatchDate, d.[Status], d.TransporterName, d.VehicleNo, d.TrackingNo,
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
           OR c.CustomerName   LIKE '%' + @SearchTerm + '%'
           OR c.MobileNumber   LIKE '%' + @SearchTerm + '%'
           OR cm.ComplaintNumber LIKE '%' + @SearchTerm + '%'
           OR EXISTS (SELECT 1 FROM dbo.DespatchItems di WHERE di.DespatchId = d.DespatchId AND di.SerialNumber LIKE '%' + @SearchTerm + '%'))
    ORDER BY d.DespatchId DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* Table[0] despatch + bill + customer + complaint · Table[1] units with warranty */
CREATE OR ALTER PROCEDURE dbo.sp_Despatch_GetById
    @DespatchId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT d.DespatchId, d.DespatchNo, d.DespatchDate, d.DeliveryAddress, d.ContactPerson, d.ContactNumber,
           d.TransporterName, d.VehicleNo, d.DriverName, d.TrackingNo, d.Remarks, d.[Status],
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

/* =============================================================================
   7. Warranty lookup: a unit by serial number / customer / bill
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Sales_WarrantyLookup
    @SearchTerm NVARCHAR(100) = NULL,
    @CustomerId INT = NULL,
    @OnlyActive BIT = NULL,          -- 1 = in warranty only · 0 = expired only · NULL = all
    @PageNumber INT = 1,
    @PageSize   INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET @SearchTerm = NULLIF(LTRIM(RTRIM(@SearchTerm)), '');
    SET @PageNumber = CASE WHEN ISNULL(@PageNumber, 0) < 1 THEN 1 ELSE @PageNumber END;
    SET @PageSize   = CASE WHEN ISNULL(@PageSize, 0) BETWEEN 1 AND 200 THEN @PageSize ELSE 20 END;
    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT p.ProductId, p.ProductName, p.SerialNumber, p.Brand, ISNULL(p.Model, p.ModelNumber) AS Model, p.Category,
           p.PurchaseDate, p.WarrantyExpiryDate,
           CASE WHEN p.WarrantyExpiryDate IS NULL THEN 'No Warranty'
                WHEN p.WarrantyExpiryDate >= @Today THEN 'In Warranty'
                ELSE 'Expired' END AS WarrantyStatus,
           CASE WHEN p.WarrantyExpiryDate IS NULL THEN NULL ELSE DATEDIFF(DAY, @Today, p.WarrantyExpiryDate) END AS WarrantyDaysLeft,
           c.CustomerId, c.CustomerName, c.MobileNumber AS CustomerMobile, c.City,
           so.SalesOrderId, so.OrderNo, so.OrderDate,
           d.DespatchId, d.DespatchNo, d.DespatchDate, di.WarrantyStartDate, di.WarrantyMonths,
           (SELECT COUNT(*) FROM dbo.Complaints cm WHERE cm.ProductId = p.ProductId AND ISNULL(cm.IsActive, 1) = 1) AS TotalComplaints,
           (SELECT COUNT(*) FROM dbo.Complaints cm
            INNER JOIN dbo.ComplaintStatuses cs ON cs.StatusId = cm.StatusId
            WHERE cm.ProductId = p.ProductId AND ISNULL(cm.IsActive, 1) = 1
              AND cs.StatusName NOT IN ('Closed', 'WorkCompleted', 'Cancelled')) AS OpenComplaints,
           lc.ComplaintNumber AS LastComplaintNo, lc.StatusName AS LastComplaintStatus, lc.CreatedAt AS LastComplaintAt, lc.NatureOfJob AS LastComplaintType,
           COUNT(*) OVER() AS TotalCount
    FROM dbo.Products p
    INNER JOIN dbo.Customers c ON c.CustomerId = p.CustomerId
    OUTER APPLY (SELECT TOP 1 di.DespatchId, di.WarrantyStartDate, di.WarrantyMonths
                 FROM dbo.DespatchItems di WHERE di.ProductId = p.ProductId ORDER BY di.DespatchItemId DESC) di
    LEFT JOIN dbo.Despatches d    ON d.DespatchId = di.DespatchId
    LEFT JOIN dbo.SalesOrders so  ON so.SalesOrderId = d.SalesOrderId
    OUTER APPLY (SELECT TOP 1 cm.ComplaintNumber, cs.StatusName, cm.CreatedAt, cm.NatureOfJob
                 FROM dbo.Complaints cm
                 LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = cm.StatusId
                 WHERE cm.ProductId = p.ProductId ORDER BY cm.ComplaintId DESC) lc
    WHERE p.IsActive = 1
      AND (@CustomerId IS NULL OR p.CustomerId = @CustomerId)
      AND (@OnlyActive IS NULL
           OR (@OnlyActive = 1 AND p.WarrantyExpiryDate >= @Today)
           OR (@OnlyActive = 0 AND (p.WarrantyExpiryDate IS NULL OR p.WarrantyExpiryDate < @Today)))
      AND (@SearchTerm IS NULL
           OR p.SerialNumber   LIKE '%' + @SearchTerm + '%'
           OR p.ProductName    LIKE '%' + @SearchTerm + '%'
           OR c.CustomerName   LIKE '%' + @SearchTerm + '%'
           OR c.MobileNumber   LIKE '%' + @SearchTerm + '%'
           OR so.OrderNo       LIKE '%' + @SearchTerm + '%'
           OR d.DespatchNo     LIKE '%' + @SearchTerm + '%')
    ORDER BY p.CreatedAt DESC, p.ProductId DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* =============================================================================
   8. Complaint list: job type + warranty of the product the complaint is about
      (same columns as before, plus NatureOfJob, IsWarranty, WarrantyExpiryDate,
       WarrantyStatus — the UI shows "Installation" and "In Warranty / Expired")
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Complaint_GetAll
    @StatusId INT = NULL,
    @Priority NVARCHAR(20) = NULL,
    @TechnicianId INT = NULL,
    @SearchTerm NVARCHAR(200) = NULL,
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @SLAStatus NVARCHAR(20) = NULL,
    @SortBy NVARCHAR(50) = 'CreatedAt',
    @SortOrder NVARCHAR(4) = 'DESC',
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Now DATETIME2(7) = DATEADD(MINUTE, 330, GETUTCDATE());
    DECLARE @Today DATE = CAST(@Now AS DATE);

    SELECT c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description, c.Priority,
           cs.StatusId, cs.StatusName, cs.StatusColor,
           cust.CustomerId, cust.CustomerName, cust.MobileNumber AS CustomerMobile, cust.City AS CustomerCity,
           p.ProductId, p.ProductName, p.SerialNumber, p.Brand,
           c.NatureOfJob,
           CAST(ISNULL(c.IsWarranty, 0) AS BIT) AS IsWarranty,
           p.WarrantyExpiryDate,
           CASE WHEN p.ProductId IS NULL THEN NULL
                WHEN p.WarrantyExpiryDate IS NULL THEN 'No Warranty'
                WHEN p.WarrantyExpiryDate >= @Today THEN 'In Warranty'
                ELSE 'Expired' END AS WarrantyStatus,
           c.SLADeadline,
           CASE WHEN cs.StatusName IN ('Closed','WorkCompleted') THEN 'Completed'
                WHEN c.SLADeadline < @Now THEN 'Breached'
                WHEN c.SLADeadline < DATEADD(HOUR, 2, @Now) THEN 'AtRisk'
                ELSE 'OnTrack' END AS SLAStatus,
           CAST(CASE WHEN cs.StatusName NOT IN ('Closed','WorkCompleted') AND c.SLADeadline < @Now THEN 1 ELSE 0 END AS BIT) AS IsSLABreached,
           DATEDIFF(MINUTE, c.CreatedAt, ISNULL(c.ClosedAt, @Now)) AS ElapsedMinutes,
           (SELECT STRING_AGG(u2.FullName, ', ')
            FROM TechnicianAssignments ta2
            JOIN Technicians t2 ON ta2.TechnicianId = t2.TechnicianId
            JOIN Users u2 ON t2.UserId = u2.UserId
            WHERE ta2.ComplaintId = c.ComplaintId
              AND ta2.Status NOT IN ('Cancelled', 'Removed')) AS AssignedTechnicians,
           c.ClosedAt, c.CreatedAt, c.UpdatedAt, COUNT(*) OVER() AS TotalCount
    FROM Complaints c
    JOIN ComplaintStatuses cs ON c.StatusId = cs.StatusId
    JOIN Customers cust ON c.CustomerId = cust.CustomerId
    LEFT JOIN Products p ON c.ProductId = p.ProductId
    LEFT JOIN TechnicianAssignments ta ON c.ComplaintId = ta.ComplaintId AND ta.Status != 'Cancelled'
    WHERE (@StatusId IS NULL OR c.StatusId = @StatusId)
    AND (@Priority IS NULL OR c.Priority = @Priority)
    AND (@TechnicianId IS NULL OR ta.TechnicianId = @TechnicianId)
    AND (@FromDate IS NULL OR CAST(c.CreatedAt AS DATE) >= @FromDate)
    AND (@ToDate IS NULL OR CAST(c.CreatedAt AS DATE) <= @ToDate)
    AND (@SearchTerm IS NULL OR c.ComplaintNumber LIKE '%' + @SearchTerm + '%' OR c.Subject LIKE '%' + @SearchTerm + '%'
         OR cust.CustomerName LIKE '%' + @SearchTerm + '%' OR p.SerialNumber LIKE '%' + @SearchTerm + '%')
    AND (@SLAStatus IS NULL
         OR (@SLAStatus = 'Breached' AND c.SLADeadline < @Now AND cs.StatusName NOT IN ('Closed','WorkCompleted'))
         OR (@SLAStatus = 'AtRisk' AND c.SLADeadline BETWEEN @Now AND DATEADD(HOUR, 2, @Now) AND cs.StatusName NOT IN ('Closed','WorkCompleted'))
         OR (@SLAStatus = 'OnTrack' AND c.SLADeadline > DATEADD(HOUR, 2, @Now) AND cs.StatusName NOT IN ('Closed','WorkCompleted')))
    GROUP BY c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description, c.Priority, cs.StatusId, cs.StatusName, cs.StatusColor,
             cust.CustomerId, cust.CustomerName, cust.MobileNumber, cust.City, p.ProductId, p.ProductName, p.SerialNumber, p.Brand,
             c.NatureOfJob, c.IsWarranty, p.WarrantyExpiryDate,
             c.SLADeadline, c.ClosedAt, c.CreatedAt, c.UpdatedAt
    ORDER BY CASE WHEN @SortBy='Priority' THEN CASE c.Priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END END ASC,
             c.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* =============================================================================
   9. Technician screen (Work Orders): serial number + warranty of the product
      (the detail proc sp_WorkOrder_GetDetails already returns WarrantyExpiryDate)
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Technician_GetWorkOrders
    @TechnicianId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT
        ta.AssignmentId,
        ta.ComplaintId,
        c.ComplaintNumber,
        c.Subject,
        c.NatureOfJob,
        cu.CustomerName,
        cu.Address           AS CustomerAddress,
        cu.MobileNumber      AS CustomerPhone,
        ISNULL(p.ProductName, pm.ProductName) AS ProductName,
        p.SerialNumber,
        p.WarrantyExpiryDate,
        CASE WHEN p.ProductId IS NULL THEN NULL
             WHEN p.WarrantyExpiryDate IS NULL THEN 'No Warranty'
             WHEN p.WarrantyExpiryDate >= @Today THEN 'In Warranty'
             ELSE 'Expired' END AS WarrantyStatus,
        CAST(ISNULL(c.IsWarranty, 0) AS BIT) AS IsWarranty,
        ta.AssignmentRole,
        ta.Status,
        ta.AssignedAt,
        ta.CompletedAt,
        ta.ScheduledDate,
        ta.StartTime,
        c.Latitude as latitude,
        c.Longitude as longitude,
        ta.EndTime,
        ta.EstimatedDuration,
        ta.TimeSlot,
        ta.Notes,
        ta.Priority
    FROM TechnicianAssignments ta
    INNER JOIN Complaints      c  ON c.ComplaintId  = ta.ComplaintId
    INNER JOIN Customers       cu ON cu.CustomerId  = c.CustomerId
    LEFT JOIN Products        p  ON   c.ProductId = p.ProductId
    LEFT  JOIN ProductMaster   pm ON c.ProductId  = pm.ProductMasterId
    WHERE ta.TechnicianId = @TechnicianId
      AND ta.Status NOT IN ('Removed')
    ORDER BY
        CASE ta.Status
            WHEN 'InProgress' THEN 1
            WHEN 'Assigned'   THEN 2
            WHEN 'Completed'  THEN 3
            ELSE 4
        END,
        ta.AssignedAt DESC;
END
GO

/* =============================================================================
   10. Customer portal: warranty of the product on the customer's complaints
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Customer_GetMyComplaints
    @CustomerId   INT,
    @StatusFilter INT = NULL,
    @PageNumber   INT = 1,
    @PageSize     INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(@PageNumber, 0) < 1 SET @PageNumber = 1;
    IF ISNULL(@PageSize, 0)   < 1 SET @PageSize   = 10;
    IF @PageSize > 100            SET @PageSize   = 100;

    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;
    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT
        c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description,
        c.Priority, c.StatusId,
        ISNULL(cs.StatusName, '') AS StatusName,
        cs.StatusColor,
        c.SLADeadline, c.CreatedAt, ISNULL(c.UpdatedAt, c.CreatedAt) AS UpdatedAt,
        p.ProductName, p.SerialNumber, p.Brand,
        c.NatureOfJob,
        CAST(ISNULL(c.IsWarranty, 0) AS BIT) AS IsWarranty,
        p.WarrantyExpiryDate,
        CASE WHEN p.ProductId IS NULL THEN NULL
             WHEN p.WarrantyExpiryDate IS NULL THEN 'No Warranty'
             WHEN p.WarrantyExpiryDate >= @Today THEN 'In Warranty'
             ELSE 'Expired' END AS WarrantyStatus,
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

CREATE OR ALTER PROCEDURE dbo.sp_Customer_GetComplaintDetail
    @ComplaintId INT,
    @CustomerId  INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    -- Table 0: Complaint detail (quick complaints have no product)
    SELECT c.ComplaintId, c.ComplaintNumber, c.Subject, c.Description,
        c.Priority, c.StatusId,
        ISNULL(cs.StatusName, '') AS StatusName, cs.StatusColor,
        c.SLADeadline, c.CreatedAt, c.UpdatedAt,
        ISNULL(c.IsCustomerConfirmed, 0) AS IsCustomerConfirmed,
        ISNULL(p.ProductName, c.Category) AS ProductName, p.SerialNumber,
        ISNULL(p.Brand, c.BrandName) AS Brand,
        c.NatureOfJob,
        CAST(ISNULL(c.IsWarranty, 0) AS BIT) AS IsWarranty,
        p.WarrantyExpiryDate,
        CASE WHEN p.ProductId IS NULL THEN NULL
             WHEN p.WarrantyExpiryDate IS NULL THEN 'No Warranty'
             WHEN p.WarrantyExpiryDate >= @Today THEN 'In Warranty'
             ELSE 'Expired' END AS WarrantyStatus,
        cu.CustomerName, cu.MobileNumber, cu.City
    FROM dbo.Complaints c
    INNER JOIN dbo.Customers cu ON c.CustomerId = cu.CustomerId
    LEFT JOIN dbo.Products p ON c.ProductId = p.ProductId
    LEFT JOIN dbo.ComplaintStatuses cs ON cs.StatusId = c.StatusId
    WHERE c.ComplaintId = @ComplaintId AND c.CustomerId = @CustomerId;

    IF @@ROWCOUNT = 0
        RETURN;

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
            -al.AuditId,
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
   11. Complaint registration: the complaint number comes from Settings > Complaint
       (prefix, start number). Same procs as 06_Customer_Portal.sql otherwise.
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Complaint_Create
    @CustomerId      INT,
    @ProductId       INT,
    @Subject         NVARCHAR(200),
    @Description     NVARCHAR(2000) = NULL,
    @Priority        NVARCHAR(20)   = 'Medium',
    @Latitude        DECIMAL(10,7)  = NULL,
    @Longitude       DECIMAL(10,7)  = NULL,
    @LocationAddress NVARCHAR(500)  = NULL,
    @PickedLocation  NVARCHAR(300)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Subject = LTRIM(RTRIM(ISNULL(@Subject, '')));
    IF @Subject = ''
    BEGIN
        SELECT 0 AS ComplaintId, CAST(NULL AS NVARCHAR(30)) AS ComplaintNumber, 'Subject is required' AS [Message]; RETURN;
    END

    -- the product must be one of the customer's own
    IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @ProductId AND CustomerId = @CustomerId)
    BEGIN
        SELECT 0 AS ComplaintId, CAST(NULL AS NVARCHAR(30)) AS ComplaintNumber, 'Product not found' AS [Message]; RETURN;
    END

    IF ISNULL(@Priority, '') NOT IN ('Low', 'Medium', 'High', 'Critical') SET @Priority = 'Medium';

    DECLARE @Now DATETIME2 = DATEADD(MINUTE, 330, GETUTCDATE());
    DECLARE @SLAHours INT = CASE @Priority
        WHEN 'Critical' THEN 4 WHEN 'High' THEN 12
        WHEN 'Medium' THEN 24 ELSE 48 END;
    DECLARE @StatusId INT = ISNULL((SELECT TOP 1 StatusId FROM dbo.ComplaintStatuses WHERE StatusName = 'New'), 1);
    DECLARE @NewId INT, @CmpNo NVARCHAR(30);

    BEGIN TRANSACTION;

    EXEC dbo.sp_Sales_NextNumber @Kind = 'Complaint', @Consume = 1, @Number = @CmpNo OUTPUT;

    INSERT INTO dbo.Complaints (
        ComplaintNumber, CustomerId, ProductId, Subject, Description,
        Priority, StatusId, SLADeadline, IsActive,
        CreatedAt, UpdatedAt,
        Latitude, Longitude, LocationAddress, LocationName
    )
    VALUES (
        @CmpNo,
        @CustomerId, @ProductId, @Subject, @Description,
        @Priority, @StatusId, DATEADD(HOUR, @SLAHours, @Now), 1,
        @Now, @Now,
        @Latitude, @Longitude, @LocationAddress, LEFT(@PickedLocation, 200)
    );

    SET @NewId = SCOPE_IDENTITY();

    COMMIT TRANSACTION;

    SELECT @NewId AS ComplaintId, @CmpNo AS ComplaintNumber, 'Complaint registered' AS [Message];
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_QuickComplaint_Create
    @CustomerId   INT,
    @Subject      NVARCHAR(200),
    @Description  NVARCHAR(2000) = NULL,
    @Category     NVARCHAR(100) = NULL,
    @BrandName    NVARCHAR(100) = NULL,
    @ModelNumber  NVARCHAR(100) = NULL,
    @Latitude     DECIMAL(10,7) = NULL,
    @Longitude    DECIMAL(10,7) = NULL,
    @LocationName NVARCHAR(200) = NULL,
    @ImageBase64  NVARCHAR(MAX) = NULL,
    @ImageName    NVARCHAR(200) = NULL,
    @ContentType  NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        IF LTRIM(RTRIM(ISNULL(@Subject, ''))) = ''
        BEGIN
            SELECT 0 AS ComplaintId, CAST(NULL AS NVARCHAR(30)) AS ComplaintNumber, 'Subject is required' AS [Message]; RETURN;
        END

        DECLARE @Now DATETIME2 = DATEADD(MINUTE, 330, GETUTCDATE());
        DECLARE @StatusId INT = ISNULL((SELECT TOP 1 StatusId FROM dbo.ComplaintStatuses WHERE StatusName = 'New'), 1);
        DECLARE @NewComplaintId INT, @CmpNo NVARCHAR(30);

        BEGIN TRANSACTION;

        EXEC dbo.sp_Sales_NextNumber @Kind = 'Complaint', @Consume = 1, @Number = @CmpNo OUTPUT;

        -- ProductId is NULL for quick complaints
        INSERT INTO dbo.Complaints (
            ComplaintNumber, CustomerId, ProductId, Subject, Description,
            Priority, StatusId, SLADeadline, IsActive,
            CreatedAt, UpdatedAt,
            Latitude, Longitude, LocationAddress,
            Category, BrandName, ModelNumber, LocationName
        )
        VALUES (
            @CmpNo,
            @CustomerId, NULL, LTRIM(RTRIM(@Subject)), @Description,
            'Medium', @StatusId, DATEADD(HOUR, 24, @Now), 1,
            @Now, @Now,
            @Latitude, @Longitude, @LocationName,
            @Category, @BrandName, @ModelNumber, @LocationName
        );

        SET @NewComplaintId = SCOPE_IDENTITY();

        IF @ImageBase64 IS NOT NULL AND @ImageBase64 != ''
        BEGIN
            -- UploadedBy references Users: the customer's login, not the customer id
            INSERT INTO dbo.ComplaintImages (
                ComplaintId, ImagePath, ImageType, UploadedAt,
                ImageData, ImageName, ContentType, UploadedBy
            )
            SELECT @NewComplaintId, 'Base64_Image', 1, @Now,
                   @ImageBase64, @ImageName, @ContentType,
                   (SELECT UserId FROM dbo.Customers WHERE CustomerId = @CustomerId);
        END

        COMMIT TRANSACTION;

        SELECT @NewComplaintId AS ComplaintId, @CmpNo AS ComplaintNumber,
               'Quick complaint registered successfully' AS [Message];
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT 0 AS ComplaintId, CAST(NULL AS NVARCHAR(30)) AS ComplaintNumber, ERROR_MESSAGE() AS [Message];
    END CATCH
END
GO

PRINT 'Sales Order / Despatch / Warranty objects are in place.';
GO
