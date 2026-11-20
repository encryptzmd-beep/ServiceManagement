/* =============================================================================
   ProjectDB (company database) · CRM: delete a lead (soft delete)
   -----------------------------------------------------------------------------
   A lead is never removed: it is marked deleted and drops out of every list,
   the board, the dashboard, the reports and the quotation lists. The row, its
   follow-ups, status history and quotations stay, so it can be restored by hand
   (UPDATE crm.Leads SET IsDeleted = 0 ...).

     crm.Leads.IsDeleted / DeletedAt / DeletedBy   the mark
     crm.sp_Lead_Delete             the owner or a manager deletes a lead that is
                                    not converted and has no convert under way
     crm.sp_Lead_List, sp_Lead_Get, sp_Lead_Board, sp_Dashboard,
     sp_Report_Conversion, sp_Report_FollowUps, sp_Report_LostReasons,
     sp_Report_Pipeline, sp_Report_Sources, sp_Report_Team,
     sp_Quotation_List, sp_Quotation_Neighbours, sp_Quotation_Get
                                    copied from their latest script (14, 16, 17
                                    or 20) unchanged except that every read of
                                    crm.Leads adds  AND l.IsDeleted = 0

     crm.sp_Lead_StatusCounts       new: leads per status for the status tabs of the
                                    lead list (the list's filters, deleted leads skipped)
     crm.sp_Quotation_StatusCounts  new: the same for the quotation list

   crm.sp_Lead_NextNumber still reads every lead, deleted ones too, so a lead
   number is never given twice (crm.Leads keeps UQ_crm_Leads_Company_LeadNo).

   A later script that changes one of the procedures above must copy it from
   here and keep the IsDeleted filter.

   Runs AFTER 21_Product_Categories.sql. Run in EACH company database
   (select it in SSMS first; no USE on purpose). New company databases created by the
   API get it automatically after 21. SAFE TO RE-RUN.
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
ELSE IF OBJECT_ID('crm.Leads') IS NULL
    SET @problem = 'crm.Leads is missing. Run 14_CRM.sql first.';
ELSE IF COL_LENGTH('crm.Leads', 'ProductMasterId') IS NULL
    SET @problem = 'Run 17_CRM_Product_Fixes.sql first.';
ELSE IF OBJECT_ID('crm.sp_Quotation_Neighbours') IS NULL
    SET @problem = 'Run 20_Transaction_Toolbar.sql first.';
ELSE IF OBJECT_ID('dbo.sp_ProductCategory_List') IS NULL
    SET @problem = 'Run 21_Product_Categories.sql first.';

IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

/* 1. The mark */
IF COL_LENGTH('crm.Leads', 'IsDeleted') IS NULL
    ALTER TABLE crm.Leads ADD IsDeleted BIT NOT NULL CONSTRAINT DF_crm_Leads_IsDeleted DEFAULT (0);
GO
IF COL_LENGTH('crm.Leads', 'DeletedAt') IS NULL
    ALTER TABLE crm.Leads ADD DeletedAt DATETIME2(0) NULL;
GO
IF COL_LENGTH('crm.Leads', 'DeletedBy') IS NULL
    ALTER TABLE crm.Leads ADD DeletedBy INT NULL;   -- dbo.Users.UserId
GO

/* 2. Delete: the owner or a manager, same branch; never a converted lead or one being converted */
CREATE OR ALTER PROCEDURE crm.sp_Lead_Delete
    @CompanyId  INT,
    @LeadId     INT,
    @UserId     INT,
    @IsManager  BIT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @status NVARCHAR(20), @owner INT, @order INT, @converting DATETIME2;

    SELECT @status = l.Status, @owner = l.OwnerUserId, @order = l.SalesOrderId, @converting = l.ConvertingAt
    FROM crm.Leads l
    WHERE l.LeadId = @LeadId AND l.CompanyId = @CompanyId AND l.IsDeleted = 0 AND l.LocationId = @LocationId;

    IF @status IS NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Lead not found' AS Message, CAST(0 AS INT) AS Id;
        RETURN;
    END
    IF @IsManager = 0 AND @owner <> @UserId
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Only the owner of the lead or a manager can delete it' AS Message, CAST(0 AS INT) AS Id;
        RETURN;
    END
    IF @status = 'Converted' OR @order IS NOT NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'A converted lead cannot be deleted' AS Message, CAST(0 AS INT) AS Id;
        RETURN;
    END
    IF @converting IS NOT NULL
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'This lead is being converted to a sale. Try again in a minute' AS Message, CAST(0 AS INT) AS Id;
        RETURN;
    END

    UPDATE crm.Leads
    SET IsDeleted = 1, DeletedAt = DATEADD(MINUTE, 330, GETUTCDATE()), DeletedBy = @UserId,
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND IsDeleted = 0
      AND SalesOrderId IS NULL AND ConvertingAt IS NULL AND [Status] <> 'Converted';

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS BIT) AS Success, N'The lead changed meanwhile. Reload and try again' AS Message, CAST(0 AS INT) AS Id;
    ELSE
        SELECT CAST(1 AS BIT) AS Success, N'Lead deleted' AS Message, @LeadId AS Id;
END
GO

/* 3. Every read of leads skips the deleted ones (copies of the latest versions + the filter) */
/* The lead list. @Status may be one status or several, comma separated
   (e.g. 'Quotation,Negotiation'). @Due: 'Today', 'Overdue' or 'Pending' (any open
   lead with a next follow-up date). @From / @To are on the lead date. @ClosedFrom /
   @ClosedTo (dates, both ends included) keep Converted leads by ConvertedAt and Lost
   leads by LostAt, as the dashboard counts "this month"; other leads drop out. */
CREATE OR ALTER PROCEDURE crm.sp_Lead_List
    @CompanyId   INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId  INT,
    @Search      NVARCHAR(200) = NULL,
    @Status      NVARCHAR(200) = NULL,
    @SourceId    INT           = NULL,
    @OwnerUserId INT           = NULL,
    @From        DATE          = NULL,
    @To          DATE          = NULL,
    @Due         NVARCHAR(10)  = NULL,
    @Today       DATE          = NULL,
    @ClosedFrom  DATE          = NULL,
    @ClosedTo    DATE          = NULL,
    @Page        INT           = 1,
    @PageSize    INT           = 25
AS
BEGIN
    SET NOCOUNT ON;

    SET @Search      = NULLIF(LTRIM(RTRIM(@Search)), '');
    SET @Status      = NULLIF(LTRIM(RTRIM(@Status)), '');
    SET @SourceId    = NULLIF(@SourceId, 0);
    SET @OwnerUserId = NULLIF(@OwnerUserId, 0);
    SET @Due         = NULLIF(LTRIM(RTRIM(@Due)), '');
    SET @Today       = ISNULL(@Today, CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE));
    IF @ClosedFrom IS NOT NULL OR @ClosedTo IS NOT NULL
    BEGIN
        SET @ClosedFrom = ISNULL(@ClosedFrom, '19000101');
        SET @ClosedTo   = ISNULL(@ClosedTo, '99991230');
    END
    SET @Page        = CASE WHEN ISNULL(@Page, 1) < 1 THEN 1 ELSE @Page END;
    SET @PageSize    = CASE WHEN ISNULL(@PageSize, 25) < 1 THEN 25 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;

    SELECT l.LeadId, l.LeadNo, l.LeadDate, l.ContactName, l.Mobile, l.Email, l.City,
           l.LeadSourceId, ISNULL(s.Name, N'') AS SourceName, l.ProductCategory, l.ModelRequirement, l.EstimatedQty,
           l.OwnerUserId, ISNULL(u.FullName, N'') AS OwnerName, l.Priority, l.Status, l.NextFollowUpAt,
           l.SalesOrderId, so.OrderNo, l.ConvertedAt, l.LocationId, l.CreatedAt,
           COUNT(*) OVER () AS TotalCount
    FROM crm.Leads l
    LEFT JOIN crm.LeadSources s ON s.LeadSourceId = l.LeadSourceId AND s.CompanyId = @CompanyId
    LEFT JOIN dbo.Users u ON u.UserId = l.OwnerUserId
    LEFT JOIN dbo.SalesOrders so ON so.SalesOrderId = l.SalesOrderId
    WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND (@Search IS NULL OR l.LeadNo LIKE '%' + @Search + '%' OR l.ContactName LIKE '%' + @Search + '%'
                           OR l.Mobile LIKE '%' + @Search + '%' OR l.City LIKE '%' + @Search + '%')
      AND (@Status IS NULL OR l.Status IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@Status, ',')))
      AND (@SourceId IS NULL OR l.LeadSourceId = @SourceId)
      AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)
      AND (@From IS NULL OR l.LeadDate >= @From)
      AND (@To IS NULL OR l.LeadDate <= @To)
      AND (@Due IS NULL
           OR (l.Status NOT IN ('Converted', 'Lost') AND l.NextFollowUpAt IS NOT NULL
               AND (   (@Due = 'Today'   AND CAST(l.NextFollowUpAt AS DATE) = @Today)
                    OR (@Due = 'Overdue' AND CAST(l.NextFollowUpAt AS DATE) < @Today)
                    OR  @Due = 'Pending')))
      AND (@ClosedFrom IS NULL
           OR (l.Status = 'Converted' AND l.ConvertedAt >= @ClosedFrom AND l.ConvertedAt < DATEADD(DAY, 1, @ClosedTo))
           OR (l.Status = 'Lost' AND l.LostAt >= @ClosedFrom AND l.LostAt < DATEADD(DAY, 1, @ClosedTo)))
    ORDER BY l.LeadDate DESC, l.LeadId DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
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
           l.CreatedBy, l.CreatedAt, l.UpdatedAt,
           l.ProductMasterId, ISNULL(pm.ProductName, N'') AS ProductName
    FROM crm.Leads l
    LEFT JOIN crm.LeadSources s ON s.LeadSourceId = l.LeadSourceId AND s.CompanyId = @CompanyId
    LEFT JOIN crm.LostReasons r ON r.LostReasonId = l.LostReasonId AND r.CompanyId = @CompanyId
    LEFT JOIN dbo.Users u ON u.UserId = l.OwnerUserId
    LEFT JOIN dbo.SalesOrders so ON so.SalesOrderId = l.SalesOrderId
    LEFT JOIN dbo.ProductMaster pm ON pm.ProductMasterId = l.ProductMasterId
    WHERE l.LeadId = @LeadId AND l.CompanyId = @CompanyId AND l.IsDeleted = 0
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Lead_Board
    @CompanyId   INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId  INT,
    @OwnerUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now        DATETIME2(0) = DATEADD(MINUTE, 330, GETUTCDATE());
    DECLARE @Today      DATE         = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);
    DECLARE @MonthStart DATE         = DATEFROMPARTS(YEAR(@Today), MONTH(@Today), 1);
    DECLARE @NextMonth  DATE         = DATEADD(MONTH, 1, @MonthStart);
    SET @OwnerUserId = NULLIF(@OwnerUserId, 0);

    /* every open lead of the user's scope, with its flags */
    SELECT l.LeadId, l.LeadNo, l.ContactName, l.City, l.Status, l.Priority, l.OwnerUserId, ISNULL(u.FullName, N'') AS OwnerName,
           l.NextFollowUpAt, x.StatusSince, DATEDIFF(DAY, x.StatusSince, @Now) AS DaysInStage,
           lq.QuotationId, lq.QuotationNo, lq.Status AS QuotationStatus, lq.GrandTotal AS QuotationValue, lq.SentAt AS QuotationSentAt,
           CAST(CASE WHEN CAST(l.NextFollowUpAt AS DATE) < @Today THEN 1 ELSE 0 END AS BIT) AS IsOverdue,
           CAST(CASE WHEN CAST(l.NextFollowUpAt AS DATE) = @Today THEN 1 ELSE 0 END AS BIT) AS IsDueToday,
           CAST(CASE WHEN l.Status = 'New' AND l.CreatedAt < DATEADD(HOUR, -24, @Now) THEN 1 ELSE 0 END AS BIT) AS IsNewNotContacted,
           CAST(CASE WHEN l.NextFollowUpAt IS NULL THEN 1 ELSE 0 END AS BIT) AS HasNoFollowUp,
           CAST(CASE WHEN lq.Status = 'Sent' AND lq.SentAt < DATEADD(DAY, -7, @Now) THEN 1 ELSE 0 END AS BIT) AS IsQuotationWaiting,
           CAST(CASE WHEN x.StatusSince < DATEADD(DAY, -14, @Now) THEN 1 ELSE 0 END AS BIT) AS IsStuck
    INTO #Open
    FROM crm.Leads l
    LEFT JOIN dbo.Users u ON u.UserId = l.OwnerUserId
    OUTER APPLY (SELECT ISNULL(MAX(h.ChangedAt), l.CreatedAt) AS StatusSince
                 FROM crm.LeadStatusHistory h
                 WHERE h.CompanyId = @CompanyId AND h.LeadId = l.LeadId AND h.ToStatus = l.Status) x
    OUTER APPLY (SELECT TOP 1 q.QuotationId, q.QuotationNo, q.Status, q.GrandTotal, q.SentAt
                 FROM crm.Quotations q
                 WHERE q.CompanyId = @CompanyId AND q.LeadId = l.LeadId AND q.Status IN ('Draft', 'Sent')
                 ORDER BY q.QuotationId DESC) lq
    WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0 AND l.Status NOT IN ('Converted', 'Lost')
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId);

    SELECT TOP (500) LeadId, LeadNo, ContactName, City, Status, Priority, OwnerUserId, OwnerName, NextFollowUpAt, StatusSince, DaysInStage,
           QuotationId, QuotationNo, QuotationStatus, QuotationValue, QuotationSentAt,
           IsOverdue, IsDueToday, IsNewNotContacted, HasNoFollowUp, IsQuotationWaiting, IsStuck
    FROM #Open
    ORDER BY IsOverdue DESC, CASE WHEN NextFollowUpAt IS NULL THEN 1 ELSE 0 END, NextFollowUpAt, LeadId DESC;

    SELECT ISNULL(SUM(CAST(IsOverdue AS INT)), 0)          AS Overdue,
           ISNULL(SUM(CAST(IsDueToday AS INT)), 0)         AS DueToday,
           ISNULL(SUM(CAST(IsNewNotContacted AS INT)), 0)  AS NewNotContacted,
           ISNULL(SUM(CAST(HasNoFollowUp AS INT)), 0)      AS NoFollowUp,
           ISNULL(SUM(CAST(IsQuotationWaiting AS INT)), 0) AS QuotationWaiting,
           ISNULL(SUM(CAST(IsStuck AS INT)), 0)            AS Stuck,
           COUNT(*)                                        AS OpenLeads,
           (SELECT COUNT(*) FROM crm.Leads l
            WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0 AND l.Status = 'Converted' AND l.ConvertedAt >= @MonthStart AND l.ConvertedAt < @NextMonth
              AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
              AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)) AS ConvertedThisMonth,
           (SELECT COUNT(*) FROM crm.Leads l
            WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0 AND l.Status = 'Lost' AND l.LostAt >= @MonthStart AND l.LostAt < @NextMonth
              AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
              AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)) AS LostThisMonth
    FROM #Open;
END
GO

/* Two result sets: the counts, then the follow-ups due today or overdue. */
CREATE OR ALTER PROCEDURE crm.sp_Dashboard
    @CompanyId   INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId INT,
    @OwnerUserId INT  = NULL,
    @Today       DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @OwnerUserId = NULLIF(@OwnerUserId, 0);
    SET @Today       = ISNULL(@Today, CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE));

    DECLARE @MonthStart DATE = DATEFROMPARTS(YEAR(@Today), MONTH(@Today), 1);
    DECLARE @NextMonth  DATE = DATEADD(MONTH, 1, @MonthStart);

    SELECT
        ISNULL(SUM(CASE WHEN l.Status = 'New' THEN 1 ELSE 0 END), 0) AS NewLeads,
        ISNULL(SUM(CASE WHEN l.Status NOT IN ('Converted', 'Lost') AND l.NextFollowUpAt IS NOT NULL THEN 1 ELSE 0 END), 0) AS FollowUpPending,
        ISNULL(SUM(CASE WHEN l.Status NOT IN ('Converted', 'Lost') AND CAST(l.NextFollowUpAt AS DATE) = @Today THEN 1 ELSE 0 END), 0) AS TodayFollowUps,
        ISNULL(SUM(CASE WHEN l.Status NOT IN ('Converted', 'Lost') AND CAST(l.NextFollowUpAt AS DATE) < @Today THEN 1 ELSE 0 END), 0) AS Overdue,
        ISNULL(SUM(CASE WHEN l.Status = 'Qualified' THEN 1 ELSE 0 END), 0) AS Qualified,
        ISNULL(SUM(CASE WHEN l.Status IN ('Quotation', 'Negotiation') THEN 1 ELSE 0 END), 0) AS QuotationPending,
        ISNULL(SUM(CASE WHEN l.Status = 'Converted' AND l.ConvertedAt >= @MonthStart AND l.ConvertedAt < @NextMonth THEN 1 ELSE 0 END), 0) AS ConvertedThisMonth,
        ISNULL(SUM(CASE WHEN l.Status = 'Lost' AND l.LostAt >= @MonthStart AND l.LostAt < @NextMonth THEN 1 ELSE 0 END), 0) AS LostThisMonth
    FROM crm.Leads l
    WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId);

    SELECT TOP (200) l.LeadId, l.LeadNo, l.ContactName, l.Mobile, l.Status, l.Priority, l.NextFollowUpAt,
           ISNULL(f.NextAction, N'') AS NextAction, l.OwnerUserId, ISNULL(u.FullName, N'') AS OwnerName,
           CAST(CASE WHEN CAST(l.NextFollowUpAt AS DATE) < @Today THEN 1 ELSE 0 END AS BIT) AS IsOverdue
    FROM crm.Leads l
    OUTER APPLY (SELECT TOP 1 f1.NextAction FROM crm.FollowUps f1
                 WHERE f1.CompanyId = @CompanyId AND f1.LeadId = l.LeadId
                 ORDER BY f1.FollowUpId DESC) f
    LEFT JOIN dbo.Users u ON u.UserId = l.OwnerUserId
    WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)
      AND l.Status NOT IN ('Converted', 'Lost')
      AND l.NextFollowUpAt IS NOT NULL AND CAST(l.NextFollowUpAt AS DATE) <= @Today
    ORDER BY l.NextFollowUpAt, l.LeadId;
END
GO

/* Sales Conversion report for the leads dated between two dates. Three result
   sets: by source, by owner, by month. Each row: Leads, Converted,
   ConversionPct, ConvertedValue (the GrandTotal of the linked orders). */
CREATE OR ALTER PROCEDURE crm.sp_Report_Conversion
    @CompanyId   INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId INT,
    @From        DATE = NULL,
    @To          DATE = NULL,
    @OwnerUserId INT  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);
    SET @From        = ISNULL(@From, DATEFROMPARTS(YEAR(@Today), 1, 1));
    SET @To          = ISNULL(@To, @Today);
    SET @OwnerUserId = NULLIF(@OwnerUserId, 0);

    DECLARE @L TABLE (LeadId INT, LeadDate DATE, SourceName NVARCHAR(100), OwnerUserId INT, IsConverted BIT, OrderValue DECIMAL(18,2));

    INSERT INTO @L (LeadId, LeadDate, SourceName, OwnerUserId, IsConverted, OrderValue)
    SELECT l.LeadId, l.LeadDate, ISNULL(s.Name, N'(none)'), l.OwnerUserId,
           CAST(CASE WHEN l.Status = 'Converted' THEN 1 ELSE 0 END AS BIT),
           CASE WHEN l.Status = 'Converted' THEN ISNULL(so.GrandTotal, 0) ELSE 0 END
    FROM crm.Leads l
    LEFT JOIN crm.LeadSources s ON s.LeadSourceId = l.LeadSourceId AND s.CompanyId = @CompanyId
    LEFT JOIN dbo.SalesOrders so ON so.SalesOrderId = l.SalesOrderId
    WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND l.LeadDate >= @From AND l.LeadDate <= @To
      AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)

    SELECT x.SourceName, COUNT(*) AS Leads, SUM(CAST(x.IsConverted AS INT)) AS Converted,
           CAST(100.0 * SUM(CAST(x.IsConverted AS INT)) / COUNT(*) AS DECIMAL(5,1)) AS ConversionPct,
           SUM(x.OrderValue) AS ConvertedValue
    FROM @L x
    GROUP BY x.SourceName
    ORDER BY Leads DESC, x.SourceName;

    SELECT x.OwnerUserId, ISNULL(u.FullName, N'') AS OwnerName, COUNT(*) AS Leads, SUM(CAST(x.IsConverted AS INT)) AS Converted,
           CAST(100.0 * SUM(CAST(x.IsConverted AS INT)) / COUNT(*) AS DECIMAL(5,1)) AS ConversionPct,
           SUM(x.OrderValue) AS ConvertedValue
    FROM @L x
    LEFT JOIN dbo.Users u ON u.UserId = x.OwnerUserId
    GROUP BY x.OwnerUserId, u.FullName
    ORDER BY Leads DESC, u.FullName;

    SELECT CONVERT(CHAR(7), x.LeadDate, 126) AS [Month], COUNT(*) AS Leads, SUM(CAST(x.IsConverted AS INT)) AS Converted,
           CAST(100.0 * SUM(CAST(x.IsConverted AS INT)) / COUNT(*) AS DECIMAL(5,1)) AS ConversionPct,
           SUM(x.OrderValue) AS ConvertedValue
    FROM @L x
    GROUP BY CONVERT(CHAR(7), x.LeadDate, 126)
    ORDER BY [Month];
END
GO

/* Lead & Follow-up report: the follow-ups made between two dates. */
CREATE OR ALTER PROCEDURE crm.sp_Report_FollowUps
    @CompanyId   INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId INT,
    @From        DATE = NULL,
    @To          DATE = NULL,
    @OwnerUserId INT  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);
    SET @From        = ISNULL(@From, DATEFROMPARTS(YEAR(@Today), MONTH(@Today), 1));
    SET @To          = ISNULL(@To, @Today);
    SET @OwnerUserId = NULLIF(@OwnerUserId, 0);

    SELECT TOP (5000) f.FollowUpId, f.FollowUpAt, f.[Type], f.Notes, f.NextFollowUpAt, f.NextAction, f.Remarks,
           f.UserId, ISNULL(fu.FullName, N'') AS UserName,
           l.LeadId, l.LeadNo, l.ContactName, l.Mobile, l.City, l.Status AS LeadStatus,
           l.OwnerUserId, ISNULL(ou.FullName, N'') AS OwnerName, ISNULL(s.Name, N'') AS SourceName
    FROM crm.FollowUps f
    INNER JOIN crm.Leads l ON l.LeadId = f.LeadId AND l.CompanyId = @CompanyId AND l.IsDeleted = 0
    LEFT JOIN crm.LeadSources s ON s.LeadSourceId = l.LeadSourceId AND s.CompanyId = @CompanyId
    LEFT JOIN dbo.Users fu ON fu.UserId = f.UserId
    LEFT JOIN dbo.Users ou ON ou.UserId = l.OwnerUserId
    WHERE f.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND f.FollowUpAt >= @From AND f.FollowUpAt < DATEADD(DAY, 1, @To)
      AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)
    ORDER BY f.FollowUpAt DESC, f.FollowUpId DESC;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Report_LostReasons
    @CompanyId   INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId  INT,
    @From        DATE = NULL,
    @To          DATE = NULL,
    @OwnerUserId INT  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);
    SET @From        = ISNULL(@From, DATEFROMPARTS(YEAR(@Today), 1, 1));
    SET @To          = ISNULL(@To, @Today);
    SET @OwnerUserId = NULLIF(@OwnerUserId, 0);

    SELECT ISNULL(r.Name, N'(none)') AS ReasonName, COUNT(*) AS Leads,
           CAST(100.0 * COUNT(*) / SUM(COUNT(*)) OVER () AS DECIMAL(5,1)) AS PctOfLost,
           ISNULL(SUM(lq.GrandTotal), 0) AS ValueLost
    FROM crm.Leads l
    LEFT JOIN crm.LostReasons r ON r.LostReasonId = l.LostReasonId AND r.CompanyId = @CompanyId
    OUTER APPLY (SELECT TOP 1 q.GrandTotal
                 FROM crm.Quotations q
                 WHERE q.CompanyId = @CompanyId AND q.LeadId = l.LeadId AND q.Status <> 'Superseded'
                 ORDER BY q.QuotationId DESC) lq
    WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0 AND l.Status = 'Lost'
      AND CAST(l.LostAt AS DATE) >= @From AND CAST(l.LostAt AS DATE) <= @To
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)
    GROUP BY ISNULL(r.Name, N'(none)')
    ORDER BY Leads DESC, ReasonName;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Report_Pipeline
    @CompanyId   INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId  INT,
    @OwnerUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = DATEADD(MINUTE, 330, GETUTCDATE());
    SET @OwnerUserId = NULLIF(@OwnerUserId, 0);

    SELECT st.Status, COUNT(x.LeadId) AS Leads, ISNULL(SUM(x.QuotationValue), 0) AS QuotationValue,
           CAST(ISNULL(AVG(CAST(x.DaysInStage AS DECIMAL(18,2))), 0) AS DECIMAL(9,1)) AS AvgDaysInStage
    FROM (VALUES (1, 'New'), (2, 'Contacted'), (3, 'Qualified'), (4, 'Quotation'), (5, 'Negotiation')) st (Ord, Status)
    LEFT JOIN (SELECT l.LeadId, l.Status, ISNULL(lq.GrandTotal, 0) AS QuotationValue,
                      DATEDIFF(DAY, s.StatusSince, @Now) AS DaysInStage
               FROM crm.Leads l
               OUTER APPLY (SELECT ISNULL(MAX(h.ChangedAt), l.CreatedAt) AS StatusSince
                            FROM crm.LeadStatusHistory h
                            WHERE h.CompanyId = @CompanyId AND h.LeadId = l.LeadId AND h.ToStatus = l.Status) s
               OUTER APPLY (SELECT TOP 1 q.GrandTotal
                            FROM crm.Quotations q
                            WHERE q.CompanyId = @CompanyId AND q.LeadId = l.LeadId AND q.Status IN ('Draft', 'Sent')
                            ORDER BY q.QuotationId DESC) lq
               WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0 AND l.Status NOT IN ('Converted', 'Lost')
                 AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
                 AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)) x ON x.Status = st.Status
    GROUP BY st.Ord, st.Status
    ORDER BY st.Ord;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Report_Sources
    @CompanyId  INT,
    @UserId     INT,
    @IsManager  BIT,
    @LocationId INT,
    @From       DATE = NULL,
    @To         DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);
    SET @From = ISNULL(@From, DATEFROMPARTS(YEAR(@Today), 1, 1));
    SET @To   = ISNULL(@To, @Today);

    /* each figure is counted by its own event date: LeadDate, ConvertedAt, LostAt */
    SELECT x.SourceName,
           SUM(x.InLeads) AS Leads, SUM(x.InConverted) AS Converted, SUM(x.InLost) AS Lost, SUM(x.InOpen) AS OpenLeads,
           CAST(CASE WHEN SUM(x.InLeads) = 0 THEN 0 ELSE 100.0 * SUM(x.InConverted) / SUM(x.InLeads) END AS DECIMAL(7,1)) AS ConversionPct,
           ISNULL(SUM(x.ConvertedValue), 0) AS ConvertedValue
    FROM (SELECT ISNULL(s.Name, N'(none)') AS SourceName,
                 CASE WHEN l.LeadDate >= @From AND l.LeadDate <= @To THEN 1 ELSE 0 END AS InLeads,
                 CASE WHEN l.Status = 'Converted' AND CAST(l.ConvertedAt AS DATE) >= @From AND CAST(l.ConvertedAt AS DATE) <= @To THEN 1 ELSE 0 END AS InConverted,
                 CASE WHEN l.Status = 'Lost' AND CAST(l.LostAt AS DATE) >= @From AND CAST(l.LostAt AS DATE) <= @To THEN 1 ELSE 0 END AS InLost,
                 CASE WHEN l.LeadDate >= @From AND l.LeadDate <= @To AND l.Status NOT IN ('Converted', 'Lost') THEN 1 ELSE 0 END AS InOpen,
                 CASE WHEN l.Status = 'Converted' AND CAST(l.ConvertedAt AS DATE) >= @From AND CAST(l.ConvertedAt AS DATE) <= @To
                      THEN ISNULL(aq.GrandTotal, 0) ELSE 0 END AS ConvertedValue
          FROM crm.Leads l
          LEFT JOIN crm.LeadSources s ON s.LeadSourceId = l.LeadSourceId AND s.CompanyId = @CompanyId
          OUTER APPLY (SELECT TOP 1 q.GrandTotal
                       FROM crm.Quotations q
                       WHERE q.CompanyId = @CompanyId AND q.LeadId = l.LeadId AND q.Status = 'Accepted'
                       ORDER BY q.QuotationId DESC) aq
          WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0
            AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId) x
    GROUP BY x.SourceName
    HAVING SUM(x.InLeads) + SUM(x.InConverted) + SUM(x.InLost) > 0
    ORDER BY Leads DESC, x.SourceName;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Report_Team
    @CompanyId   INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId  INT,
    @From        DATE = NULL,
    @To          DATE = NULL,
    @OwnerUserId INT  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);
    SET @From        = ISNULL(@From, DATEFROMPARTS(YEAR(@Today), 1, 1));
    SET @To          = ISNULL(@To, @Today);
    SET @OwnerUserId = NULLIF(@OwnerUserId, 0);

    /* leads, converted, lost, value and overdue belong to the current owner; follow-ups to whoever logged them */
    SELECT x.OwnerUserId, ISNULL(u.FullName, N'') AS OwnerName,
           SUM(x.InLeads) AS Leads, SUM(x.Done) AS FollowUpsDone, SUM(x.Overdue) AS OverdueNow,
           SUM(x.InConverted) AS Converted, SUM(x.InLost) AS Lost, ISNULL(SUM(x.ConvertedValue), 0) AS ConvertedValue
    FROM (SELECT l.OwnerUserId,
                 CASE WHEN l.LeadDate >= @From AND l.LeadDate <= @To THEN 1 ELSE 0 END AS InLeads,
                 0 AS Done,
                 CASE WHEN l.Status NOT IN ('Converted', 'Lost') AND CAST(l.NextFollowUpAt AS DATE) < @Today THEN 1 ELSE 0 END AS Overdue,
                 CASE WHEN l.Status = 'Converted' AND CAST(l.ConvertedAt AS DATE) >= @From AND CAST(l.ConvertedAt AS DATE) <= @To THEN 1 ELSE 0 END AS InConverted,
                 CASE WHEN l.Status = 'Lost' AND CAST(l.LostAt AS DATE) >= @From AND CAST(l.LostAt AS DATE) <= @To THEN 1 ELSE 0 END AS InLost,
                 CASE WHEN l.Status = 'Converted' AND CAST(l.ConvertedAt AS DATE) >= @From AND CAST(l.ConvertedAt AS DATE) <= @To
                      THEN ISNULL(aq.GrandTotal, 0) ELSE 0 END AS ConvertedValue
          FROM crm.Leads l
          OUTER APPLY (SELECT TOP 1 q.GrandTotal
                       FROM crm.Quotations q
                       WHERE q.CompanyId = @CompanyId AND q.LeadId = l.LeadId AND q.Status = 'Accepted'
                       ORDER BY q.QuotationId DESC) aq
          WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0
            AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
            AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)
          UNION ALL
          SELECT f.UserId, 0, 1, 0, 0, 0, 0
          FROM crm.FollowUps f
          INNER JOIN crm.Leads l ON l.LeadId = f.LeadId AND l.CompanyId = @CompanyId AND l.IsDeleted = 0
          WHERE f.CompanyId = @CompanyId AND CAST(f.FollowUpAt AS DATE) >= @From AND CAST(f.FollowUpAt AS DATE) <= @To
            AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
            AND (@IsManager = 1 OR f.UserId = @UserId)
            AND (@OwnerUserId IS NULL OR f.UserId = @OwnerUserId)) x
    LEFT JOIN dbo.Users u ON u.UserId = x.OwnerUserId
    GROUP BY x.OwnerUserId, u.FullName
    HAVING SUM(x.InLeads) + SUM(x.Done) + SUM(x.Overdue) + SUM(x.InConverted) + SUM(x.InLost) > 0
    ORDER BY Leads DESC, u.FullName;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Quotation_List
    @CompanyId  INT,
    @UserId     INT,
    @IsManager  BIT,
    @LocationId INT,
    @Search     NVARCHAR(100) = NULL,
    @Status     NVARCHAR(20)  = NULL,
    @From       DATE          = NULL,
    @To         DATE          = NULL,
    @Page       INT           = 1,
    @PageSize   INT           = 25
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE);
    SET @Search   = NULLIF(LTRIM(RTRIM(ISNULL(@Search, ''))), '');
    SET @Status   = NULLIF(LTRIM(RTRIM(ISNULL(@Status, ''))), '');
    SET @Page     = CASE WHEN ISNULL(@Page, 1) < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN ISNULL(@PageSize, 25) < 1 THEN 25 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;

    SELECT q.QuotationId, q.QuotationNo, q.RevisionNo, q.QuoteDate, l.LeadId, l.LeadNo, l.ContactName,
           ISNULL(u.FullName, N'') AS OwnerName, q.Status, q.GrandTotal, q.SentAt,
           DATEDIFF(DAY, CAST(ISNULL(q.SentAt, q.QuoteDate) AS DATE), @Today) AS AgeDays,
           COUNT(*) OVER () AS TotalCount
    FROM crm.Quotations q
    INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId AND l.IsDeleted = 0
    LEFT JOIN dbo.Users u ON u.UserId = l.OwnerUserId
    WHERE q.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND (@Status IS NULL OR q.Status = @Status)
      AND (@From IS NULL OR q.QuoteDate >= @From)
      AND (@To IS NULL OR q.QuoteDate <= @To)
      AND (@Search IS NULL OR q.QuotationNo LIKE N'%' + @Search + N'%' OR l.LeadNo LIKE N'%' + @Search + N'%'
           OR l.ContactName LIKE N'%' + @Search + N'%' OR l.Mobile LIKE N'%' + @Search + N'%')
    ORDER BY q.QuotationId DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* 3. Previous / next quotation (latest revisions the caller may see; @QuotationId 0 = from a new one) */
CREATE OR ALTER PROCEDURE crm.sp_Quotation_Neighbours
    @CompanyId   INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId  INT,
    @QuotationId INT
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH visible AS (
        SELECT q.QuotationId
        FROM crm.Quotations q
        INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId AND l.IsDeleted = 0
        WHERE q.CompanyId = @CompanyId
          AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
          AND NOT EXISTS (SELECT 1 FROM crm.Quotations q2
                          WHERE q2.CompanyId = @CompanyId AND q2.QuotationNo = q.QuotationNo AND q2.RevisionNo > q.RevisionNo)
    )
    SELECT
        (SELECT MAX(QuotationId) FROM visible WHERE ISNULL(@QuotationId, 0) = 0 OR QuotationId < @QuotationId) AS PreviousId,
        CASE WHEN ISNULL(@QuotationId, 0) = 0 THEN NULL
             ELSE (SELECT MIN(QuotationId) FROM visible WHERE QuotationId > @QuotationId) END AS NextId;
END
GO

/* Two result sets: the quotation with its lead (for the editor and the print
   view), then its lines. Nothing when the lead is not the user's. */
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
           q.SubTotal, q.DiscountTotal, q.TaxableTotal, q.CGST, q.SGST, q.IGST, q.GrandTotal, q.Terms, q.Status,
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
           i.WarrantyMonths, i.TaxableAmount, i.GstAmount, i.LineTotal, i.SortOrder
    FROM crm.QuotationItems i
    INNER JOIN crm.Quotations q ON q.QuotationId = i.QuotationId AND q.CompanyId = @CompanyId
    INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId AND l.IsDeleted = 0
    WHERE i.QuotationId = @QuotationId AND i.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
    ORDER BY i.SortOrder, i.QuotationItemId;
END
GO

/* 4. The status tabs of the lead list: how many leads per status under the same filters as
   crm.sp_Lead_List, except @Status (the tabs are the status) and paging. */
CREATE OR ALTER PROCEDURE crm.sp_Lead_StatusCounts
    @CompanyId   INT,
    @UserId      INT,
    @IsManager   BIT,
    @LocationId  INT,
    @Search      NVARCHAR(200) = NULL,
    @SourceId    INT           = NULL,
    @OwnerUserId INT           = NULL,
    @From        DATE          = NULL,
    @To          DATE          = NULL,
    @Due         NVARCHAR(10)  = NULL,
    @Today       DATE          = NULL,
    @ClosedFrom  DATE          = NULL,
    @ClosedTo    DATE          = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @Search      = NULLIF(LTRIM(RTRIM(@Search)), '');
    SET @SourceId    = NULLIF(@SourceId, 0);
    SET @OwnerUserId = NULLIF(@OwnerUserId, 0);
    SET @Due         = NULLIF(LTRIM(RTRIM(@Due)), '');
    SET @Today       = ISNULL(@Today, CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE));
    IF @ClosedFrom IS NOT NULL OR @ClosedTo IS NOT NULL
    BEGIN
        SET @ClosedFrom = ISNULL(@ClosedFrom, '19000101');
        SET @ClosedTo   = ISNULL(@ClosedTo, '99991230');
    END

    SELECT l.Status, COUNT(*) AS [Count]
    FROM crm.Leads l
    WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND (@Search IS NULL OR l.LeadNo LIKE '%' + @Search + '%' OR l.ContactName LIKE '%' + @Search + '%'
                           OR l.Mobile LIKE '%' + @Search + '%' OR l.City LIKE '%' + @Search + '%')
      AND (@SourceId IS NULL OR l.LeadSourceId = @SourceId)
      AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)
      AND (@From IS NULL OR l.LeadDate >= @From)
      AND (@To IS NULL OR l.LeadDate <= @To)
      AND (@Due IS NULL
           OR (l.Status NOT IN ('Converted', 'Lost') AND l.NextFollowUpAt IS NOT NULL
               AND (   (@Due = 'Today'   AND CAST(l.NextFollowUpAt AS DATE) = @Today)
                    OR (@Due = 'Overdue' AND CAST(l.NextFollowUpAt AS DATE) < @Today)
                    OR  @Due = 'Pending')))
      AND (@ClosedFrom IS NULL
           OR (l.Status = 'Converted' AND l.ConvertedAt >= @ClosedFrom AND l.ConvertedAt < DATEADD(DAY, 1, @ClosedTo))
           OR (l.Status = 'Lost' AND l.LostAt >= @ClosedFrom AND l.LostAt < DATEADD(DAY, 1, @ClosedTo)))
    GROUP BY l.Status;
END
GO

/* 5. The status tabs of the quotation list: quotations per status under the same filters as
   crm.sp_Quotation_List, except @Status and paging. */
CREATE OR ALTER PROCEDURE crm.sp_Quotation_StatusCounts
    @CompanyId  INT,
    @UserId     INT,
    @IsManager  BIT,
    @LocationId INT,
    @Search     NVARCHAR(100) = NULL,
    @From       DATE          = NULL,
    @To         DATE          = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @Search = NULLIF(LTRIM(RTRIM(ISNULL(@Search, ''))), '');

    SELECT q.Status, COUNT(*) AS [Count]
    FROM crm.Quotations q
    INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId AND l.IsDeleted = 0
    WHERE q.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND (@From IS NULL OR q.QuoteDate >= @From)
      AND (@To IS NULL OR q.QuoteDate <= @To)
      AND (@Search IS NULL OR q.QuotationNo LIKE N'%' + @Search + N'%' OR l.LeadNo LIKE N'%' + @Search + N'%'
           OR l.ContactName LIKE N'%' + @Search + N'%' OR l.Mobile LIKE N'%' + @Search + N'%')
    GROUP BY q.Status;
END
GO

PRINT 'CRM lead delete applied.';
GO
SET NOEXEC OFF;
GO
