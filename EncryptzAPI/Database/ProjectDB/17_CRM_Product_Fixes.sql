/* =============================================================================
   ProjectDB (company database) · CRM: product on the lead and report fixes (follow-up to 16_CRM_Board_Reports.sql)
   -----------------------------------------------------------------------------
   Adds the column crm.Leads.ProductMasterId (the product the lead is about, NULL
   when none), adds crm.sp_Product_Categories, and replaces crm.sp_Product_Search
   (category filter, HsnSac column: NULL, dbo.ProductMaster has no HSN column),
   crm.sp_Lead_Save (stores ProductMasterId, checked against active products),
   crm.sp_Lead_Get (returns ProductMasterId and ProductName), crm.sp_Report_Sources
   (ConversionPct wide enough: DECIMAL(7,1)), crm.sp_Report_Team (a member sees only
   the follow-ups they logged) and crm.sp_Lead_Board (owner 0 means all owners).
   14_CRM.sql, 15_CRM_Convert_Check.sql and 16_CRM_Board_Reports.sql are not changed:
   this file runs AFTER 16_CRM_Board_Reports.sql in each company database.
   Run in EACH company database (select it in SSMS first; no USE on purpose).
   New company databases created by the API get it automatically after 16.
   ADDITIVE and SAFE TO RE-RUN. Changes no table, procedure or row of dbo.
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

IF COL_LENGTH('crm.Quotations', 'SentAt') IS NULL
BEGIN
    RAISERROR('crm.Quotations.SentAt is missing. Run 16_CRM_Board_Reports.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('crm.Leads', 'ProductMasterId') IS NULL ALTER TABLE crm.Leads ADD ProductMasterId INT NULL;
GO

CREATE OR ALTER PROCEDURE crm.sp_Product_Categories
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT LTRIM(RTRIM(p.Category)) AS Category
    FROM dbo.ProductMaster p
    WHERE p.CompanyId = @CompanyId AND p.IsActive = 1 AND LTRIM(RTRIM(ISNULL(p.Category, ''))) <> ''
    ORDER BY Category;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Product_Search
    @CompanyId INT,
    @Search    NVARCHAR(200) = NULL,
    @Top       INT           = 20,
    @Category  NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @Search   = NULLIF(LTRIM(RTRIM(@Search)), '');
    SET @Category = NULLIF(LTRIM(RTRIM(ISNULL(@Category, ''))), '');
    SET @Top      = CASE WHEN ISNULL(@Top, 20) < 1 THEN 20 WHEN @Top > 100 THEN 100 ELSE @Top END;

    /* dbo.ProductMaster has no HSN column: HsnSac is NULL until it gets one */
    SELECT TOP (@Top) p.ProductMasterId, p.ProductCode, p.ProductName, p.Brand, p.Model, p.Category, p.MRP, p.WarrantyMonths,
           CAST(NULL AS NVARCHAR(20)) AS HsnSac
    FROM dbo.ProductMaster p
    WHERE p.IsActive = 1
      AND (@Category IS NULL OR LTRIM(RTRIM(p.Category)) = @Category)
      AND (@Search IS NULL OR p.ProductName LIKE '%' + @Search + '%' OR p.ProductCode LIKE '%' + @Search + '%'
                           OR p.Brand LIKE '%' + @Search + '%' OR p.Model LIKE '%' + @Search + '%')
    ORDER BY p.ProductName;
END
GO

/* Adds a lead (@LeadId 0) or changes one. A new lead is New, numbered LD-0001 per
   company and owned by the user, or by @OwnerUserId when a manager makes it for a
   member of the team. The owner of an existing lead changes only through
   sp_Lead_Reassign. @ProductMasterId (last, so older callers still work) is the
   product the lead is about; a product that is not active is dropped. */
CREATE OR ALTER PROCEDURE crm.sp_Lead_Save
    @CompanyId            INT,
    @LeadId               INT,
    @UserId               INT,
    @IsManager            BIT,
    @LocationId INT,
    @LeadDate             DATE           = NULL,
    @ContactName          NVARCHAR(200),
    @Mobile               NVARCHAR(20),
    @Email                NVARCHAR(256)  = NULL,
    @Address              NVARCHAR(500)  = NULL,
    @City                 NVARCHAR(100)  = NULL,
    @State                NVARCHAR(100)  = NULL,
    @PinCode              NVARCHAR(10)   = NULL,
    @Landmark             NVARCHAR(200)  = NULL,
    @LeadSourceId         INT            = NULL,
    @ProductCategory      NVARCHAR(100)  = NULL,
    @ModelRequirement     NVARCHAR(500)  = NULL,
    @EstimatedQty         INT            = NULL,
    @ExpectedPurchaseDate DATE           = NULL,
    @OwnerUserId          INT            = NULL,
    @Priority             NVARCHAR(10)   = 'Medium',
    @Remarks              NVARCHAR(2000) = NULL,
    @ProductMasterId      INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @ContactName  = LTRIM(RTRIM(ISNULL(@ContactName, '')));
    SET @Mobile       = LTRIM(RTRIM(ISNULL(@Mobile, '')));
    SET @Priority     = ISNULL(NULLIF(LTRIM(RTRIM(@Priority)), ''), 'Medium');
    SET @LeadSourceId = NULLIF(@LeadSourceId, 0);
    SET @OwnerUserId  = NULLIF(@OwnerUserId, 0);
    SET @ProductMasterId = NULLIF(@ProductMasterId, 0);
    SET @LeadDate     = ISNULL(@LeadDate, CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE));

    IF ISNULL(@CompanyId, 0) = 0 OR ISNULL(@UserId, 0) = 0
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Lead not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF ISNULL(@LocationId, 0) = 0
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Select a branch first' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @ContactName = '' OR @Mobile = ''
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Enter the name and the mobile number of the contact' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @Priority NOT IN ('Low', 'Medium', 'High')
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Choose the priority from the list' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @LeadSourceId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm.LeadSources WHERE LeadSourceId = @LeadSourceId AND CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Choose the source from the list' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF ISNULL(@EstimatedQty, 1) < 1
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Enter the quantity as a number, or leave it empty' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    /* a product that is not an active product is dropped, not an error */
    IF @ProductMasterId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.ProductMaster WHERE ProductMasterId = @ProductMasterId AND CompanyId = @CompanyId AND IsActive = 1)
        SET @ProductMasterId = NULL;

    IF ISNULL(@LeadId, 0) = 0
    BEGIN
        /* a sales user owns what they make; a manager may give it to a team member */
        IF ISNULL(@IsManager, 0) = 0 OR @OwnerUserId IS NULL SET @OwnerUserId = @UserId;

        IF @OwnerUserId <> @UserId
           AND NOT EXISTS (SELECT 1 FROM crm.Members WHERE CompanyId = @CompanyId AND UserId = @OwnerUserId AND IsActive = 1)
        BEGIN
            SELECT CAST(0 AS BIT) AS Success, N'Choose a member of the sales team' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        BEGIN TRANSACTION;

        DECLARE @n INT = 1 + ISNULL((SELECT MAX(TRY_CAST(SUBSTRING(LeadNo, 4, 20) AS INT)) FROM crm.Leads WITH (UPDLOCK, HOLDLOCK)
                                     WHERE CompanyId = @CompanyId AND LeadNo LIKE 'LD-%'), 0);
        DECLARE @LeadNo NVARCHAR(20) = 'LD-' + CASE WHEN @n < 10000 THEN RIGHT('0000' + CAST(@n AS VARCHAR(10)), 4) ELSE CAST(@n AS VARCHAR(10)) END;

        INSERT INTO crm.Leads (CompanyId, LeadNo, LeadDate, ContactName, Mobile, Email, Address, City, [State], PinCode, Landmark,
                               LeadSourceId, ProductCategory, ModelRequirement, EstimatedQty, ExpectedPurchaseDate, OwnerUserId,
                               Priority, Status, Remarks, LocationId, CreatedBy, ProductMasterId)
        VALUES (@CompanyId, @LeadNo, @LeadDate, @ContactName, @Mobile, LTRIM(RTRIM(ISNULL(@Email, ''))), LTRIM(RTRIM(ISNULL(@Address, ''))),
                LTRIM(RTRIM(ISNULL(@City, ''))), LTRIM(RTRIM(ISNULL(@State, ''))), LTRIM(RTRIM(ISNULL(@PinCode, ''))), LTRIM(RTRIM(ISNULL(@Landmark, ''))),
                @LeadSourceId, LTRIM(RTRIM(ISNULL(@ProductCategory, ''))), LTRIM(RTRIM(ISNULL(@ModelRequirement, ''))), @EstimatedQty,
                @ExpectedPurchaseDate, @OwnerUserId, @Priority, 'New', LTRIM(RTRIM(ISNULL(@Remarks, ''))), @LocationId, @UserId, @ProductMasterId);

        SET @LeadId = SCOPE_IDENTITY();

        INSERT INTO crm.LeadStatusHistory (CompanyId, LeadId, FromStatus, ToStatus, ChangedBy, Note)
        VALUES (@CompanyId, @LeadId, NULL, 'New', @UserId, N'Lead created');

        COMMIT TRANSACTION;
        SELECT CAST(1 AS BIT) AS Success, N'Lead ' + @LeadNo + N' added' AS Message, @LeadId AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @Current NVARCHAR(20);
    SELECT @Current = Status FROM crm.Leads WITH (UPDLOCK, HOLDLOCK)
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId;

    IF @Current IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Lead not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @Current IN ('Converted', 'Lost')
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'A converted or lost lead cannot be changed' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    UPDATE crm.Leads
    SET LeadDate = @LeadDate, ContactName = @ContactName, Mobile = @Mobile, Email = LTRIM(RTRIM(ISNULL(@Email, ''))),
        Address = LTRIM(RTRIM(ISNULL(@Address, ''))), City = LTRIM(RTRIM(ISNULL(@City, ''))), [State] = LTRIM(RTRIM(ISNULL(@State, ''))),
        PinCode = LTRIM(RTRIM(ISNULL(@PinCode, ''))), Landmark = LTRIM(RTRIM(ISNULL(@Landmark, ''))), LeadSourceId = @LeadSourceId,
        ProductCategory = LTRIM(RTRIM(ISNULL(@ProductCategory, ''))), ModelRequirement = LTRIM(RTRIM(ISNULL(@ModelRequirement, ''))),
        EstimatedQty = @EstimatedQty, ExpectedPurchaseDate = @ExpectedPurchaseDate, Priority = @Priority,
        Remarks = LTRIM(RTRIM(ISNULL(@Remarks, ''))), ProductMasterId = @ProductMasterId, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND LocationId = @LocationId;

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Lead saved' AS Message, @LeadId AS Id;
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
    WHERE l.LeadId = @LeadId AND l.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId;
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
          WHERE l.CompanyId = @CompanyId
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
          WHERE l.CompanyId = @CompanyId
            AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
            AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)
          UNION ALL
          SELECT f.UserId, 0, 1, 0, 0, 0, 0
          FROM crm.FollowUps f
          INNER JOIN crm.Leads l ON l.LeadId = f.LeadId AND l.CompanyId = @CompanyId
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
    WHERE l.CompanyId = @CompanyId AND l.Status NOT IN ('Converted', 'Lost')
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
            WHERE l.CompanyId = @CompanyId AND l.Status = 'Converted' AND l.ConvertedAt >= @MonthStart AND l.ConvertedAt < @NextMonth
              AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
              AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)) AS ConvertedThisMonth,
           (SELECT COUNT(*) FROM crm.Leads l
            WHERE l.CompanyId = @CompanyId AND l.Status = 'Lost' AND l.LostAt >= @MonthStart AND l.LostAt < @NextMonth
              AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
              AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)) AS LostThisMonth
    FROM #Open;
END
GO

PRINT 'CRM product on the lead and report fixes applied.';
GO
SET NOEXEC OFF;
GO
