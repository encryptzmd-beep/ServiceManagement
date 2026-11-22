/* =============================================================================
   ProjectDB (company database) · Quotation and sales order print
   -----------------------------------------------------------------------------
   Adds what the printed quotation and sales order show:
     crm.Quotations     ReferenceNo, PaymentDueDate, CustomerGstin, PricesIncludeGst,
                        WarrantyText
     dbo.SalesOrders    PaymentDueDate, Terms, WarrantyText
     Settings > Print   logo, MSME, e-mail, bank, seal, warranty, terms, optional
                        items, closing message and signatory (blank until filled)
   Procedures: crm.sp_Quotation_Save / _Revise / _Get,
               dbo.sp_SalesOrder_Save / _GetById

   Runs AFTER 28_Transporter_Master.sql and BEFORE the API of this release. Run in
   EACH company database (select it in SSMS first; no USE on purpose).
   Existing values are never changed. SAFE TO RE-RUN.
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
ELSE IF OBJECT_ID('dbo.Transporters') IS NULL
    SET @problem = 'Run 28_Transporter_Master.sql first.';
ELSE IF OBJECT_ID('crm.Quotations') IS NULL OR OBJECT_ID('dbo.SalesOrders') IS NULL
    SET @problem = 'Run the CRM and sales scripts first.';
IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('crm.Quotations', 'ReferenceNo') IS NULL
    ALTER TABLE crm.Quotations ADD ReferenceNo NVARCHAR(100) NULL;
IF COL_LENGTH('crm.Quotations', 'PaymentDueDate') IS NULL
    ALTER TABLE crm.Quotations ADD PaymentDueDate DATE NULL;
IF COL_LENGTH('crm.Quotations', 'CustomerGstin') IS NULL
    ALTER TABLE crm.Quotations ADD CustomerGstin NVARCHAR(20) NULL;
IF COL_LENGTH('crm.Quotations', 'PricesIncludeGst') IS NULL
    ALTER TABLE crm.Quotations ADD PricesIncludeGst BIT NOT NULL CONSTRAINT DF_crm_Quotations_PricesIncludeGst DEFAULT (0);
IF COL_LENGTH('crm.Quotations', 'WarrantyText') IS NULL
    ALTER TABLE crm.Quotations ADD WarrantyText NVARCHAR(4000) NOT NULL CONSTRAINT DF_crm_Quotations_WarrantyText DEFAULT (N'');
IF COL_LENGTH('dbo.SalesOrders', 'PaymentDueDate') IS NULL
    ALTER TABLE dbo.SalesOrders ADD PaymentDueDate DATE NULL;
IF COL_LENGTH('dbo.SalesOrders', 'Terms') IS NULL
    ALTER TABLE dbo.SalesOrders ADD Terms NVARCHAR(4000) NOT NULL CONSTRAINT DF_SalesOrders_Terms DEFAULT (N'');
IF COL_LENGTH('dbo.SalesOrders', 'WarrantyText') IS NULL
    ALTER TABLE dbo.SalesOrders ADD WarrantyText NVARCHAR(4000) NOT NULL CONSTRAINT DF_SalesOrders_WarrantyText DEFAULT (N'');
GO

MERGE dbo.SystemSettings AS t
USING (VALUES
    ('Print.CompanyLogo', N'', 'Print', 'image', N'Company or brand logo printed at the top right of quotations and sales orders', 1),
    ('Print.CompanyEmail', N'', 'Print', 'string', N'Company e-mail printed under the address', 1),
    ('Print.CompanyMSME', N'', 'Print', 'string', N'MSME / Udyam number, e.g. UDYAM-KL-02-0000000 [Micro]', 1),
    ('Print.BankAccountHolder', N'', 'Print', 'string', N'Bank details: account holder', 1),
    ('Print.BankAccountNo', N'', 'Print', 'string', N'Bank details: account number', 1),
    ('Print.BankIFSC', N'', 'Print', 'string', N'Bank details: IFS code', 1),
    ('Print.BankName', N'', 'Print', 'string', N'Bank details: bank and branch', 1),
    ('Print.SealImage', N'', 'Print', 'image', N'Company seal and signature image', 1),
    ('Print.ItemsNote', N'', 'Print', 'string', N'Line printed under the products, e.g. what is included with the unit', 1),
    ('Print.OptionalItems', N'', 'Print', 'textarea', N'IF REQUIRED table. One item per line: Description | Price | Quantity and unit, e.g. Outdoor Stand | 1200 | 1 Nos', 1),
    ('Print.Warranty', N'', 'Print', 'textarea', N'Default warranty, one point per line. Loaded into each new quotation and sales order, where it can be changed', 1),
    ('Print.Terms', N'', 'Print', 'textarea', N'Default terms, one point per line. Loaded into each new quotation and sales order, where they can be changed', 1),
    ('Print.ClosingMessage', N'', 'Print', 'textarea', N'Closing message printed above the signature', 1),
    ('Print.SignatoryName', N'', 'Print', 'string', N'Name under Thanks & Regards (blank = the company name)', 1),
    ('Print.SignatoryMobile', N'', 'Print', 'string', N'Mobile number under Thanks & Regards', 1)
) AS s (SettingKey, SettingValue, SettingGroup, DataType, Description, IsEditable)
    ON t.SettingKey = s.SettingKey
WHEN NOT MATCHED THEN
    INSERT (SettingKey, SettingValue, SettingGroup, DataType, Description, IsEditable, ModifiedDate)
    VALUES (s.SettingKey, s.SettingValue, s.SettingGroup, s.DataType, s.Description, s.IsEditable, DATEADD(MINUTE, 330, GETUTCDATE()));
GO

CREATE OR ALTER PROCEDURE crm.sp_Quotation_Save
    @CompanyId     INT,
    @QuotationId   INT,
    @LeadId        INT,
    @UserId        INT,
    @IsManager     BIT,
    @LocationId INT,
    @QuoteDate     DATE           = NULL,
    @ValidUntil    DATE           = NULL,
    @IsInterState  BIT            = 0,
    @SubTotal      DECIMAL(18,2)  = 0,
    @DiscountTotal DECIMAL(18,2)  = 0,
    @TaxableTotal  DECIMAL(18,2)  = 0,
    @CGST          DECIMAL(18,2)  = 0,
    @SGST          DECIMAL(18,2)  = 0,
    @IGST          DECIMAL(18,2)  = 0,
    @GrandTotal    DECIMAL(18,2)  = 0,
    @Terms         NVARCHAR(4000) = NULL,
    @ReferenceNo   NVARCHAR(100)  = NULL,
    @PaymentDueDate DATE          = NULL,
    @CustomerGstin NVARCHAR(20)   = NULL,
    @PricesIncludeGst BIT         = 0,
    @WarrantyText  NVARCHAR(4000) = NULL,
    @ItemsJson     NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @QuoteDate = ISNULL(@QuoteDate, CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE));

    IF @ValidUntil IS NOT NULL AND @ValidUntil < @QuoteDate
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'The quotation cannot be valid until a day before its date' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @PaymentDueDate IS NOT NULL AND @PaymentDueDate < @QuoteDate
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'The payment due date cannot be before the quotation date' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    SET @ReferenceNo   = NULLIF(LTRIM(RTRIM(@ReferenceNo)), '');
    SET @CustomerGstin = NULLIF(UPPER(LTRIM(RTRIM(@CustomerGstin))), '');

    DECLARE @Items TABLE
    (
        ProductMasterId INT, ProductName NVARCHAR(200), HsnSac NVARCHAR(20), Qty INT, Rate DECIMAL(18,2),
        DiscountAmount DECIMAL(18,2), GstPercent DECIMAL(5,2), WarrantyMonths INT, TaxableAmount DECIMAL(18,2),
        GstAmount DECIMAL(18,2), LineTotal DECIMAL(18,2), SortOrder INT
    );

    IF ISNULL(@ItemsJson, '') <> '' AND ISJSON(@ItemsJson) = 1
        INSERT INTO @Items (ProductMasterId, ProductName, HsnSac, Qty, Rate, DiscountAmount, GstPercent, WarrantyMonths,
                            TaxableAmount, GstAmount, LineTotal, SortOrder)
        SELECT NULLIF(i.productMasterId, 0), LTRIM(RTRIM(i.productName)), NULLIF(LTRIM(RTRIM(i.hsnSac)), ''),
               CASE WHEN ISNULL(i.qty, 0) < 1 THEN 1 ELSE i.qty END, ISNULL(i.rate, 0), ISNULL(i.discountAmount, 0),
               ISNULL(i.gstPercent, 0), ISNULL(i.warrantyMonths, 12), ISNULL(i.taxableAmount, 0), ISNULL(i.gstAmount, 0),
               ISNULL(i.lineTotal, 0), ISNULL(i.sortOrder, CAST(a.[key] AS INT) + 1)
        FROM OPENJSON(@ItemsJson) a
        CROSS APPLY OPENJSON(a.value)
             WITH (productMasterId INT           '$.productMasterId',
                   productName     NVARCHAR(200) '$.productName',
                   hsnSac          NVARCHAR(20)  '$.hsnSac',
                   qty             INT           '$.qty',
                   rate            DECIMAL(18,2) '$.rate',
                   discountAmount  DECIMAL(18,2) '$.discountAmount',
                   gstPercent      DECIMAL(5,2)  '$.gstPercent',
                   warrantyMonths  INT           '$.warrantyMonths',
                   taxableAmount   DECIMAL(18,2) '$.taxableAmount',
                   gstAmount       DECIMAL(18,2) '$.gstAmount',
                   lineTotal       DECIMAL(18,2) '$.lineTotal',
                   sortOrder       INT           '$.sortOrder') i
        WHERE NULLIF(LTRIM(RTRIM(i.productName)), '') IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM @Items)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Add at least one product line' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @LeadStatus NVARCHAR(20), @Converting DATETIME2, @ConvertNeedsCheck BIT;
    SELECT @LeadStatus = Status, @Converting = ConvertingAt, @ConvertNeedsCheck = ConvertNeedsCheck FROM crm.Leads WITH (UPDLOCK, HOLDLOCK)
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId;

    IF @LeadStatus IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Lead not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @LeadStatus IN ('Converted', 'Lost')
       OR NOT (@Converting IS NULL OR (@Converting < DATEADD(MINUTE, -15, SYSUTCDATETIME()) AND @ConvertNeedsCheck = 0))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success,
               CASE WHEN @ConvertNeedsCheck = 1 THEN N'A manager must check the sales orders for this lead first'
                    ELSE N'A converted or lost lead cannot be changed' END AS Message,
               CAST(0 AS INT) AS Id; RETURN;
    END

    IF ISNULL(@QuotationId, 0) = 0
    BEGIN
        DECLARE @n INT = 1 + ISNULL((SELECT MAX(TRY_CAST(SUBSTRING(QuotationNo, 4, 20) AS INT)) FROM crm.Quotations WITH (UPDLOCK, HOLDLOCK)
                                     WHERE CompanyId = @CompanyId AND QuotationNo LIKE 'QT-%'), 0);
        DECLARE @QuotationNo NVARCHAR(20) = 'QT-' + CASE WHEN @n < 10000 THEN RIGHT('0000' + CAST(@n AS VARCHAR(10)), 4) ELSE CAST(@n AS VARCHAR(10)) END;

        INSERT INTO crm.Quotations (CompanyId, LeadId, QuotationNo, RevisionNo, QuoteDate, ValidUntil, IsInterState, SubTotal, DiscountTotal,
                                    TaxableTotal, CGST, SGST, IGST, GrandTotal, Terms, ReferenceNo, PaymentDueDate, CustomerGstin, PricesIncludeGst, WarrantyText, Status, CreatedBy)
        VALUES (@CompanyId, @LeadId, @QuotationNo, 1, @QuoteDate, @ValidUntil, ISNULL(@IsInterState, 0), ISNULL(@SubTotal, 0),
                ISNULL(@DiscountTotal, 0), ISNULL(@TaxableTotal, 0), ISNULL(@CGST, 0), ISNULL(@SGST, 0), ISNULL(@IGST, 0),
                ISNULL(@GrandTotal, 0), LTRIM(RTRIM(ISNULL(@Terms, ''))), @ReferenceNo, @PaymentDueDate, @CustomerGstin, ISNULL(@PricesIncludeGst, 0),
                LTRIM(RTRIM(ISNULL(@WarrantyText, ''))), 'Draft', @UserId);

        SET @QuotationId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        DECLARE @QuotationStatus NVARCHAR(20);
        SELECT @QuotationStatus = Status FROM crm.Quotations WITH (UPDLOCK, HOLDLOCK)
        WHERE QuotationId = @QuotationId AND LeadId = @LeadId AND CompanyId = @CompanyId;

        IF @QuotationStatus IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS BIT) AS Success, N'Quotation not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        IF @QuotationStatus <> 'Draft'
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS BIT) AS Success, N'Only a draft quotation can be changed. Revise it instead' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        UPDATE crm.Quotations
        SET QuoteDate = @QuoteDate, ValidUntil = @ValidUntil, IsInterState = ISNULL(@IsInterState, 0), SubTotal = ISNULL(@SubTotal, 0),
            DiscountTotal = ISNULL(@DiscountTotal, 0), TaxableTotal = ISNULL(@TaxableTotal, 0), CGST = ISNULL(@CGST, 0),
            SGST = ISNULL(@SGST, 0), IGST = ISNULL(@IGST, 0), GrandTotal = ISNULL(@GrandTotal, 0),
            Terms = LTRIM(RTRIM(ISNULL(@Terms, ''))), ReferenceNo = @ReferenceNo,
            PaymentDueDate = @PaymentDueDate, CustomerGstin = @CustomerGstin,
            PricesIncludeGst = ISNULL(@PricesIncludeGst, 0), WarrantyText = LTRIM(RTRIM(ISNULL(@WarrantyText, ''))), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE QuotationId = @QuotationId AND CompanyId = @CompanyId;

        DELETE FROM crm.QuotationItems WHERE QuotationId = @QuotationId AND CompanyId = @CompanyId;
    END

    INSERT INTO crm.QuotationItems (CompanyId, QuotationId, ProductMasterId, ProductName, HsnSac, Qty, Rate, DiscountAmount, GstPercent,
                                    WarrantyMonths, TaxableAmount, GstAmount, LineTotal, SortOrder)
    SELECT @CompanyId, @QuotationId, ProductMasterId, ProductName, HsnSac, Qty, Rate, DiscountAmount, GstPercent,
           WarrantyMonths, TaxableAmount, GstAmount, LineTotal, SortOrder
    FROM @Items;

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Quotation saved' AS Message, @QuotationId AS Id;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Quotation_Revise
    @CompanyId   INT,
    @QuotationId INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DECLARE @LeadId INT, @QuotationNo NVARCHAR(20), @RevisionNo INT, @Status NVARCHAR(20), @LeadStatus NVARCHAR(20), @Converting DATETIME2, @ConvertNeedsCheck BIT;
    SELECT @LeadId = q.LeadId, @QuotationNo = q.QuotationNo, @RevisionNo = q.RevisionNo, @Status = q.Status,
           @LeadStatus = l.Status, @Converting = l.ConvertingAt, @ConvertNeedsCheck = l.ConvertNeedsCheck
    FROM crm.Quotations q WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN crm.Leads l WITH (UPDLOCK, HOLDLOCK) ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId
    WHERE q.QuotationId = @QuotationId AND q.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId;

    IF @LeadId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Quotation not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @LeadStatus IN ('Converted', 'Lost')
       OR NOT (@Converting IS NULL OR (@Converting < DATEADD(MINUTE, -15, SYSUTCDATETIME()) AND @ConvertNeedsCheck = 0))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success,
               CASE WHEN @ConvertNeedsCheck = 1 THEN N'A manager must check the sales orders for this lead first'
                    ELSE N'A converted or lost lead cannot be changed' END AS Message,
               CAST(0 AS INT) AS Id; RETURN;
    END

    IF @Status = 'Draft'
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'This quotation is a draft: change it directly' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @Status NOT IN ('Sent', 'Rejected')
       OR EXISTS (SELECT 1 FROM crm.Quotations WHERE CompanyId = @CompanyId AND QuotationNo = @QuotationNo AND RevisionNo > @RevisionNo)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Only the latest sent or rejected revision can be revised' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    INSERT INTO crm.Quotations (CompanyId, LeadId, QuotationNo, RevisionNo, QuoteDate, ValidUntil, IsInterState, SubTotal, DiscountTotal,
                                TaxableTotal, CGST, SGST, IGST, GrandTotal, Terms, ReferenceNo, PaymentDueDate, CustomerGstin, PricesIncludeGst, WarrantyText, Status, CreatedBy)
    SELECT @CompanyId, LeadId, QuotationNo, RevisionNo + 1, CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE), ValidUntil, IsInterState,
           SubTotal, DiscountTotal, TaxableTotal, CGST, SGST, IGST, GrandTotal, Terms, ReferenceNo, PaymentDueDate, CustomerGstin, PricesIncludeGst, WarrantyText, 'Draft', @UserId
    FROM crm.Quotations
    WHERE QuotationId = @QuotationId AND CompanyId = @CompanyId;

    DECLARE @NewId INT = SCOPE_IDENTITY();

    INSERT INTO crm.QuotationItems (CompanyId, QuotationId, ProductMasterId, ProductName, HsnSac, Qty, Rate, DiscountAmount, GstPercent,
                                    WarrantyMonths, TaxableAmount, GstAmount, LineTotal, SortOrder)
    SELECT @CompanyId, @NewId, ProductMasterId, ProductName, HsnSac, Qty, Rate, DiscountAmount, GstPercent,
           WarrantyMonths, TaxableAmount, GstAmount, LineTotal, SortOrder
    FROM crm.QuotationItems
    WHERE QuotationId = @QuotationId AND CompanyId = @CompanyId
    ORDER BY SortOrder, QuotationItemId;

    UPDATE crm.Quotations
    SET Status = 'Superseded', UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE QuotationId = @QuotationId AND CompanyId = @CompanyId;

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Revision ' + CAST(@RevisionNo + 1 AS NVARCHAR(10)) + N' made' AS Message, @NewId AS Id;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Quotation_Get
    @CompanyId   INT,
    @QuotationId INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT q.QuotationId, q.LeadId, q.QuotationNo, q.RevisionNo, q.QuoteDate, q.ValidUntil, q.IsInterState,
           q.SubTotal, q.DiscountTotal, q.TaxableTotal, q.CGST, q.SGST, q.IGST, q.GrandTotal, q.Terms, q.ReferenceNo, q.PaymentDueDate, q.CustomerGstin, q.PricesIncludeGst, q.WarrantyText, q.Status,
           q.CreatedBy, ISNULL(u.FullName, N'') AS CreatedByName, q.CreatedAt, q.UpdatedAt,
           l.LeadNo, l.ContactName, l.Mobile, l.Email, l.Address, l.City, l.[State], l.PinCode, l.Status AS LeadStatus,
           CAST(CASE WHEN NOT EXISTS (SELECT 1 FROM crm.Quotations q2
                                      WHERE q2.CompanyId = @CompanyId AND q2.QuotationNo = q.QuotationNo AND q2.RevisionNo > q.RevisionNo)
                     THEN 1 ELSE 0 END AS BIT) AS IsLatest
    FROM crm.Quotations q
    INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId AND l.IsDeleted = 0
    LEFT JOIN dbo.Users u ON u.UserId = q.CreatedBy
    WHERE q.QuotationId = @QuotationId AND q.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId;

    SELECT i.QuotationItemId, i.ProductMasterId, i.ProductName, i.HsnSac, i.Qty, i.Rate, i.DiscountAmount, i.GstPercent,
           i.WarrantyMonths, i.TaxableAmount, i.GstAmount, i.LineTotal, i.SortOrder,
           pm.Description AS ProductDescription, pm.MRP AS Mrp
    FROM crm.QuotationItems i
    INNER JOIN crm.Quotations q ON q.QuotationId = i.QuotationId AND q.CompanyId = @CompanyId
    INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId AND l.IsDeleted = 0
    LEFT JOIN dbo.ProductMaster pm ON pm.ProductMasterId = i.ProductMasterId
    WHERE i.QuotationId = @QuotationId AND i.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
    ORDER BY i.SortOrder, i.QuotationItemId;
END
GO

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
    @WarrantyText   NVARCHAR(4000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(7) = DATEADD(MINUTE, 330, GETUTCDATE());

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

        SELECT 1 AS Success, 'Bill ' + @OrderNo + ' saved.' AS Message, @SalesOrderId AS SalesOrderId, @OrderNo AS OrderNo;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success, ERROR_MESSAGE() AS Message, NULL AS SalesOrderId, NULL AS OrderNo;
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_SalesOrder_GetById
    @SalesOrderId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);

    SELECT so.SalesOrderId, so.OrderNo, so.OrderDate, so.[Status], so.PaymentMode, so.PaymentDueDate, so.ReferenceNo,
           so.CustomerId, c.CustomerName, c.MobileNumber AS CustomerMobile, c.Email AS CustomerEmail,
           so.ContactNumber, so.GSTIN, so.BillingAddress, so.City, so.[State], so.PinCode, so.IsInterState, so.Notes, so.Terms, so.WarrantyText,
           so.SubTotal, so.DiscountTotal, so.TaxableTotal, so.CGST, so.SGST, so.IGST, so.GrandTotal,
           so.CreatedAt, so.UpdatedAt
    FROM dbo.SalesOrders so
    INNER JOIN dbo.Customers c ON c.CustomerId = so.CustomerId
    WHERE so.SalesOrderId = @SalesOrderId;

    SELECT i.SalesOrderItemId, i.SalesOrderId, i.ProductMasterId, i.ProductName, i.Brand, i.Model, i.Category, i.HsnSac,
           i.Qty, i.Rate, i.DiscountAmount, i.GstPercent, i.TaxableAmount, i.GstAmount, i.LineTotal, i.WarrantyMonths,
           pm.Description AS ProductDescription, pm.MRP AS Mrp,
           (SELECT COUNT(*) FROM dbo.DespatchItems di WHERE di.SalesOrderItemId = i.SalesOrderItemId) AS DespatchedQty,
           (SELECT STRING_AGG(di.SerialNumber, ', ') FROM dbo.DespatchItems di WHERE di.SalesOrderItemId = i.SalesOrderItemId) AS SerialNumbers,
           (SELECT MIN(di.WarrantyStartDate) FROM dbo.DespatchItems di WHERE di.SalesOrderItemId = i.SalesOrderItemId) AS WarrantyStartDate,
           (SELECT MAX(di.WarrantyEndDate)   FROM dbo.DespatchItems di WHERE di.SalesOrderItemId = i.SalesOrderItemId) AS WarrantyEndDate
    FROM dbo.SalesOrderItems i
    LEFT JOIN dbo.ProductMaster pm ON pm.ProductMasterId = i.ProductMasterId
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

PRINT 'Quotation and sales order print is in place.';
GO
SET NOEXEC OFF;
GO
