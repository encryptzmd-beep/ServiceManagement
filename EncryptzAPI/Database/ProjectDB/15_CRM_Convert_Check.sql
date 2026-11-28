/* =============================================================================
   ProjectDB (company database) · CRM: convert check (follow-up to 14_CRM.sql)
   -----------------------------------------------------------------------------
   Adds the convert-check flag crm.Leads.ConvertNeedsCheck and the procedure
   crm.sp_Lead_MarkConvertUnknown, and replaces the crm procedures that read or
   write the convert marker so that they honour the flag. 14_CRM.sql is not
   changed: this file runs AFTER 14_CRM.sql in each company database.
   Run in EACH company database (select it in SSMS first; no USE on purpose).
   New company databases created by the API get it automatically after 14.
   ADDITIVE and SAFE TO RE-RUN. Changes no table, procedure or row of dbo.

   The convert marker: a lead whose ConvertingAt is set is busy. The marker is
   free only when it is older than 15 minutes AND ConvertNeedsCheck = 0, written
   the same way everywhere:
     (ConvertingAt IS NULL OR (ConvertingAt < DATEADD(MINUTE, -15, SYSUTCDATETIME()) AND ConvertNeedsCheck = 0))
   ConvertNeedsCheck = 1 (crm.sp_Lead_MarkConvertUnknown) means the order call
   was made and it is not known whether the order exists: the lead stays blocked
   until a manager links the order (sp_Lead_LinkOrder) or cancels the convert
   (sp_Lead_CancelConvert), which clear the marker and the flag.
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
ELSE IF OBJECT_ID('dbo.SchemaInfo') IS NOT NULL AND OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is the Personal DB. Select a company database.';
ELSE IF OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database (dbo.Locations is missing).';

IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('crm.Leads') IS NULL
BEGIN
    RAISERROR('crm.Leads is missing. Run 14_CRM.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('crm.Leads', 'ConvertNeedsCheck') IS NULL ALTER TABLE crm.Leads ADD ConvertNeedsCheck BIT NOT NULL CONSTRAINT DF_crm_Leads_ConvertNeedsCheck DEFAULT (0);
GO

CREATE OR ALTER PROCEDURE crm.sp_Lead_Get
    @CompanyId INT,
    @LeadId    INT,
    @UserId    INT,
    @IsManager BIT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT l.LeadId, l.LeadNo, l.LeadDate, l.ContactName, l.Mobile, l.Email, l.Address, l.City, l.[State], l.PinCode, l.Landmark,
           l.LeadSourceId, ISNULL(s.Name, N'') AS SourceName, l.ProductCategory, l.ModelRequirement, l.EstimatedQty,
           l.ExpectedPurchaseDate, l.OwnerUserId, ISNULL(u.FullName, N'') AS OwnerName, l.Priority, l.Status,
           l.LostReasonId, ISNULL(r.Name, N'') AS LostReasonName, l.LostNote, l.LostAt, l.NextFollowUpAt,
           l.CustomerId, l.SalesOrderId, so.OrderNo, l.ConvertedAt, l.ConvertingAt, l.ConvertNeedsCheck, l.Remarks, l.LocationId,
           l.CreatedBy, l.CreatedAt, l.UpdatedAt
    FROM crm.Leads l
    LEFT JOIN crm.LeadSources s ON s.LeadSourceId = l.LeadSourceId AND s.CompanyId = @CompanyId
    LEFT JOIN crm.LostReasons r ON r.LostReasonId = l.LostReasonId AND r.CompanyId = @CompanyId
    LEFT JOIN dbo.Users u ON u.UserId = l.OwnerUserId
    LEFT JOIN dbo.SalesOrders so ON so.SalesOrderId = l.SalesOrderId
    WHERE l.LeadId = @LeadId AND l.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Lead_SetStatus
    @CompanyId    INT,
    @LeadId       INT,
    @UserId       INT,
    @IsManager    BIT,
    @LocationId INT,
    @Status       NVARCHAR(20),
    @LostReasonId INT            = NULL,
    @LostNote     NVARCHAR(1000) = NULL,
    @Note         NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Status       = LTRIM(RTRIM(ISNULL(@Status, '')));
    SET @LostReasonId = NULLIF(@LostReasonId, 0);
    SET @Note         = LTRIM(RTRIM(ISNULL(@Note, '')));

    IF @Status NOT IN ('New', 'Contacted', 'Qualified', 'Quotation', 'Negotiation', 'Lost')
    BEGIN
        SELECT CAST(0 AS BIT) AS Success,
               CASE WHEN @Status = 'Converted' THEN N'A lead is converted with Convert to sales order' ELSE N'Choose the status from the list' END AS Message,
               CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @Current NVARCHAR(20), @Converting DATETIME2, @ConvertNeedsCheck BIT;
    SELECT @Current = Status, @Converting = ConvertingAt, @ConvertNeedsCheck = ConvertNeedsCheck FROM crm.Leads WITH (UPDLOCK, HOLDLOCK)
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId;

    IF @Current IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Lead not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF NOT (@Converting IS NULL OR (@Converting < DATEADD(MINUTE, -15, SYSUTCDATETIME()) AND @ConvertNeedsCheck = 0))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success,
               CASE WHEN @ConvertNeedsCheck = 1 THEN N'A manager must check the sales orders for this lead first'
                    ELSE N'This lead is being converted to a sale' END AS Message,
               CAST(0 AS INT) AS Id; RETURN;
    END

    IF @Current = 'Converted'
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'A converted lead cannot be changed' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @Current = @Status
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(1 AS BIT) AS Success, N'No change' AS Message, @LeadId AS Id; RETURN;
    END

    /* reopen a lost lead (managers only) */
    IF @Current = 'Lost'
    BEGIN
        IF ISNULL(@IsManager, 0) = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS BIT) AS Success, N'Only a CRM manager can reopen a lost lead' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        DECLARE @Previous NVARCHAR(20) =
            (SELECT TOP 1 FromStatus FROM crm.LeadStatusHistory
             WHERE CompanyId = @CompanyId AND LeadId = @LeadId AND ToStatus = 'Lost'
             ORDER BY LeadStatusHistoryId DESC);
        IF @Previous IS NULL OR @Previous IN ('Converted', 'Lost') SET @Previous = 'New';

        UPDATE crm.Leads
        SET Status = @Previous, LostReasonId = NULL, LostNote = N'', LostAt = NULL, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE LeadId = @LeadId AND CompanyId = @CompanyId;

        INSERT INTO crm.LeadStatusHistory (CompanyId, LeadId, FromStatus, ToStatus, ChangedBy, Note)
        VALUES (@CompanyId, @LeadId, 'Lost', @Previous, @UserId, CASE WHEN @Note = '' THEN N'Reopened' ELSE @Note END);

        COMMIT TRANSACTION;
        SELECT CAST(1 AS BIT) AS Success, N'Lead reopened' AS Message, @LeadId AS Id; RETURN;
    END

    IF @Status = 'Lost'
    BEGIN
        IF @LostReasonId IS NULL OR NOT EXISTS (SELECT 1 FROM crm.LostReasons WHERE LostReasonId = @LostReasonId AND CompanyId = @CompanyId)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS BIT) AS Success, N'Choose the reason the lead was lost' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        UPDATE crm.Leads
        SET Status = 'Lost', LostReasonId = @LostReasonId, LostNote = LTRIM(RTRIM(ISNULL(@LostNote, ''))),
            LostAt = DATEADD(MINUTE, 330, GETUTCDATE()), ConvertingAt = NULL, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND SalesOrderId IS NULL
          AND (ConvertingAt IS NULL OR (ConvertingAt < DATEADD(MINUTE, -15, SYSUTCDATETIME()) AND ConvertNeedsCheck = 0));

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS BIT) AS Success,
                   CASE WHEN EXISTS (SELECT 1 FROM crm.Leads WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND ConvertNeedsCheck = 1)
                        THEN N'A manager must check the sales orders for this lead first'
                        ELSE N'This lead is being converted to a sale' END AS Message,
                   CAST(0 AS INT) AS Id; RETURN;
        END
    END
    ELSE
        UPDATE crm.Leads
        SET Status = @Status, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE LeadId = @LeadId AND CompanyId = @CompanyId;

    INSERT INTO crm.LeadStatusHistory (CompanyId, LeadId, FromStatus, ToStatus, ChangedBy, Note)
    VALUES (@CompanyId, @LeadId, @Current, @Status, @UserId,
            CASE WHEN @Note <> '' THEN @Note WHEN @Status = 'Lost' THEN LTRIM(RTRIM(ISNULL(@LostNote, ''))) ELSE N'' END);

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Status changed to ' + @Status AS Message, @LeadId AS Id;
END
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
                                    TaxableTotal, CGST, SGST, IGST, GrandTotal, Terms, Status, CreatedBy)
        VALUES (@CompanyId, @LeadId, @QuotationNo, 1, @QuoteDate, @ValidUntil, ISNULL(@IsInterState, 0), ISNULL(@SubTotal, 0),
                ISNULL(@DiscountTotal, 0), ISNULL(@TaxableTotal, 0), ISNULL(@CGST, 0), ISNULL(@SGST, 0), ISNULL(@IGST, 0),
                ISNULL(@GrandTotal, 0), LTRIM(RTRIM(ISNULL(@Terms, ''))), 'Draft', @UserId);

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
            Terms = LTRIM(RTRIM(ISNULL(@Terms, ''))), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
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
                                TaxableTotal, CGST, SGST, IGST, GrandTotal, Terms, Status, CreatedBy)
    SELECT @CompanyId, LeadId, QuotationNo, RevisionNo + 1, CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE), ValidUntil, IsInterState,
           SubTotal, DiscountTotal, TaxableTotal, CGST, SGST, IGST, GrandTotal, Terms, 'Draft', @UserId
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

CREATE OR ALTER PROCEDURE crm.sp_Quotation_SetStatus
    @CompanyId   INT,
    @QuotationId INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId INT,
    @Status      NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Status = LTRIM(RTRIM(ISNULL(@Status, '')));

    IF @Status NOT IN ('Sent', 'Rejected')
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'A quotation can be marked sent or rejected' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @LeadId INT, @QuotationNo NVARCHAR(20), @Current NVARCHAR(20), @LeadStatus NVARCHAR(20), @Converting DATETIME2, @ConvertNeedsCheck BIT;
    SELECT @LeadId = q.LeadId, @QuotationNo = q.QuotationNo, @Current = q.Status, @LeadStatus = l.Status, @Converting = l.ConvertingAt,
           @ConvertNeedsCheck = l.ConvertNeedsCheck
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

    IF NOT ((@Status = 'Sent' AND @Current IN ('Draft', 'Rejected')) OR (@Status = 'Rejected' AND @Current = 'Sent'))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'A ' + LOWER(@Current) + N' quotation cannot be marked ' + LOWER(@Status) AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    UPDATE crm.Quotations
    SET Status = @Status, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE QuotationId = @QuotationId AND CompanyId = @CompanyId;

    IF @Status = 'Sent' AND @LeadStatus IN ('New', 'Contacted', 'Qualified')
    BEGIN
        UPDATE crm.Leads
        SET Status = 'Quotation', UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE LeadId = @LeadId AND CompanyId = @CompanyId;

        INSERT INTO crm.LeadStatusHistory (CompanyId, LeadId, FromStatus, ToStatus, ChangedBy, Note)
        VALUES (@CompanyId, @LeadId, @LeadStatus, 'Quotation', @UserId, N'Quotation ' + @QuotationNo + N' sent');
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Quotation marked ' + LOWER(@Status) AS Message, @QuotationId AS Id;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Lead_BeginConvert
    @CompanyId   INT,
    @LeadId      INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId INT,
    @QuotationId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM crm.Quotations q
                   INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId
                   WHERE q.QuotationId = @QuotationId AND q.LeadId = @LeadId AND q.CompanyId = @CompanyId
                     AND q.Status IN ('Draft', 'Sent')
                     AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Choose the latest draft or sent quotation of the lead' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    UPDATE crm.Leads
    SET ConvertingAt = SYSUTCDATETIME()
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND SalesOrderId IS NULL
      AND (ConvertingAt IS NULL OR (ConvertingAt < DATEADD(MINUTE, -15, SYSUTCDATETIME()) AND ConvertNeedsCheck = 0))
      AND Status IN ('Quotation','Negotiation')
      AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId
      AND EXISTS (SELECT 1 FROM crm.Quotations q
                  WHERE q.QuotationId = @QuotationId AND q.LeadId = @LeadId AND q.CompanyId = @CompanyId
                    AND q.Status IN ('Draft', 'Sent'));

    IF @@ROWCOUNT = 1
    BEGIN
        SELECT CAST(1 AS BIT) AS Success, N'Ready to convert' AS Message, @LeadId AS Id; RETURN;
    END

    SELECT CAST(0 AS BIT) AS Success,
           CASE WHEN l.LeadId IS NULL          THEN N'Lead not found'
                WHEN l.SalesOrderId IS NOT NULL THEN N'This lead already has a sales order'
                WHEN l.ConvertNeedsCheck = 1    THEN N'A manager must check the sales orders for this lead first'
                WHEN l.ConvertingAt >=DATEADD(MINUTE, -15, SYSUTCDATETIME()) THEN N'This lead is being converted to a sale. Try again in a minute'
                ELSE N'Only a lead in Quotation or Negotiation can be converted' END AS Message,
           CAST(0 AS INT) AS Id
    FROM (SELECT 1 AS One) x
    LEFT JOIN crm.Leads l ON l.LeadId = @LeadId AND l.CompanyId = @CompanyId AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Lead_FinishConvert
    @CompanyId    INT,
    @LeadId       INT,
    @UserId       INT,
    @LocationId   INT,
    @QuotationId  INT,
    @CustomerId   INT,
    @SalesOrderId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @OrderNo NVARCHAR(30) = (SELECT OrderNo FROM dbo.SalesOrders WHERE SalesOrderId = @SalesOrderId);
    IF @OrderNo IS NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'The sales order was not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @Previous TABLE (Status NVARCHAR(20));

    UPDATE crm.Leads
    SET CustomerId = @CustomerId, SalesOrderId = @SalesOrderId, ConvertedAt = DATEADD(MINUTE, 330, GETUTCDATE()),
        Status = 'Converted', ConvertingAt = NULL, ConvertNeedsCheck = 0, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    OUTPUT deleted.Status INTO @Previous (Status)
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND LocationId = @LocationId AND SalesOrderId IS NULL AND ConvertingAt IS NOT NULL
      AND EXISTS (SELECT 1 FROM crm.Quotations q
                  WHERE q.QuotationId = @QuotationId AND q.LeadId = @LeadId AND q.CompanyId = @CompanyId
                    AND q.Status IN ('Draft', 'Sent'))
      AND NOT EXISTS (SELECT 1 FROM crm.Leads o WITH (UPDLOCK, HOLDLOCK)
                      WHERE o.CompanyId = @CompanyId AND o.SalesOrderId = @SalesOrderId);

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success,
               N'Lead not found, it has a sales order already, its convert was not started, or the order is linked to another lead' AS Message,
               CAST(0 AS INT) AS Id; RETURN;
    END

    UPDATE crm.Quotations
    SET Status = 'Accepted', UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE QuotationId = @QuotationId AND LeadId = @LeadId AND CompanyId = @CompanyId;

    INSERT INTO crm.LeadStatusHistory (CompanyId, LeadId, FromStatus, ToStatus, ChangedBy, Note)
    SELECT @CompanyId, @LeadId, p.Status, 'Converted', @UserId, N'Converted to sales order ' + @OrderNo
    FROM @Previous p;

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Converted to sales order ' + @OrderNo AS Message, @LeadId AS Id;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Lead_CancelConvert
    @CompanyId  INT,
    @LeadId     INT,
    @UserId     INT,
    @IsManager  BIT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE crm.Leads
    SET ConvertingAt = NULL, ConvertNeedsCheck = 0
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND SalesOrderId IS NULL AND ConvertingAt IS NOT NULL
      AND (ConvertNeedsCheck = 0 OR ISNULL(@IsManager, 0) = 1)
      AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId;

    IF @@ROWCOUNT = 1
    BEGIN
        SELECT CAST(1 AS BIT) AS Success, N'Convert cancelled' AS Message, @LeadId AS Id; RETURN;
    END

    SELECT CAST(0 AS BIT) AS Success,
           CASE WHEN EXISTS (SELECT 1 FROM crm.Leads
                             WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND SalesOrderId IS NULL AND ConvertNeedsCheck = 1
                               AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId)
                THEN N'A manager must check the sales orders for this lead first'
                ELSE N'Nothing to cancel' END AS Message,
           CAST(0 AS INT) AS Id;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Lead_MarkConvertUnknown
    @CompanyId  INT,
    @LeadId     INT,
    @UserId     INT,
    @IsManager  BIT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE crm.Leads
    SET ConvertNeedsCheck = 1, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND SalesOrderId IS NULL AND ConvertingAt IS NOT NULL
      AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS BIT) AS Success, N'The lead holds no convert marker' AS Message, CAST(0 AS INT) AS Id;
    ELSE
        SELECT CAST(1 AS BIT) AS Success, N'A manager must check the sales orders for this lead first' AS Message, @LeadId AS Id;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Lead_LinkOrder
    @CompanyId   INT,
    @LeadId      INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId INT,
    @OrderNo     NVARCHAR(30),
    @QuotationId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @OrderNo = LTRIM(RTRIM(ISNULL(@OrderNo, '')));

    IF ISNULL(@IsManager, 0) = 0
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Only a CRM manager can link an order' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    DECLARE @SalesOrderId INT, @CustomerId INT;
    SELECT TOP 1 @SalesOrderId = SalesOrderId, @CustomerId = CustomerId
    FROM dbo.SalesOrders
    WHERE OrderNo = @OrderNo AND IsActive = 1
    ORDER BY SalesOrderId DESC;

    IF @SalesOrderId IS NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'No sales order has this number' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @OtherLead NVARCHAR(20) = (SELECT TOP 1 LeadNo FROM crm.Leads WITH (UPDLOCK, HOLDLOCK)
                                       WHERE CompanyId = @CompanyId AND SalesOrderId = @SalesOrderId);
    IF @OtherLead IS NOT NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'This order is linked to lead ' + @OtherLead + N' already' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    DECLARE @Previous TABLE (Status NVARCHAR(20));

    UPDATE crm.Leads
    SET CustomerId = @CustomerId, SalesOrderId = @SalesOrderId, ConvertedAt = DATEADD(MINUTE, 330, GETUTCDATE()),
        Status = 'Converted', ConvertingAt = NULL, ConvertNeedsCheck = 0, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    OUTPUT deleted.Status INTO @Previous (Status)
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND LocationId = @LocationId AND SalesOrderId IS NULL AND Status <> 'Lost';

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Only an open lead without an order can be linked' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF NULLIF(@QuotationId, 0) IS NOT NULL
        UPDATE crm.Quotations
        SET Status = 'Accepted', UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
        WHERE QuotationId = @QuotationId AND LeadId = @LeadId AND CompanyId = @CompanyId AND Status IN ('Draft', 'Sent');

    INSERT INTO crm.LeadStatusHistory (CompanyId, LeadId, FromStatus, ToStatus, ChangedBy, Note)
    SELECT @CompanyId, @LeadId, p.Status, 'Converted', @UserId, N'Linked to sales order ' + @OrderNo
    FROM @Previous p;

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Linked to sales order ' + @OrderNo AS Message, @LeadId AS Id;
END
GO

PRINT 'CRM convert check applied.';
GO
SET NOEXEC OFF;
GO
