/* =============================================================================
   ProjectDB (company database) · CRM: board and reports (follow-up to 15_CRM_Convert_Check.sql)
   -----------------------------------------------------------------------------
   Adds the column crm.Quotations.SentAt (stamped when a quotation is marked sent,
   backfilled from UpdatedAt for quotations sent before), replaces
   crm.sp_Quotation_SetStatus so that it stamps SentAt, and adds the procedures
   crm.sp_Lead_Board (Kanban cards and attention counts) and crm.sp_Quotation_List
   (paged quotation list). 14_CRM.sql and 15_CRM_Convert_Check.sql are not changed:
   this file runs AFTER 15_CRM_Convert_Check.sql in each company database.
   Run in EACH company database (select it in SSMS first; no USE on purpose).
   New company databases created by the API get it automatically after 15.
   ADDITIVE and SAFE TO RE-RUN. Changes no table, procedure or row of dbo.

   Attention rules of the board (today and now are India time, UTC + 330 minutes):
     overdue            next follow-up date before today
     due today          next follow-up date is today
     new, not contacted status New for more than 24 hours
     no follow-up       no next follow-up date
     quotation waiting  latest quotation sent more than 7 days ago
     stuck              in the same stage for more than 14 days
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

IF COL_LENGTH('crm.Leads', 'ConvertNeedsCheck') IS NULL
BEGIN
    RAISERROR('crm.Leads.ConvertNeedsCheck is missing. Run 15_CRM_Convert_Check.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('crm.Quotations', 'SentAt') IS NULL ALTER TABLE crm.Quotations ADD SentAt DATETIME2(0) NULL;
GO

/* quotations sent before this script: the last change is the best known send time */
UPDATE crm.Quotations
SET SentAt = UpdatedAt
WHERE SentAt IS NULL AND Status IN ('Sent', 'Rejected', 'Accepted', 'Superseded');
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
    SET Status = @Status, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE()),
        SentAt = CASE WHEN @Status = 'Sent' THEN DATEADD(MINUTE, 330, GETUTCDATE()) ELSE SentAt END
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
    INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId
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
               WHERE l.CompanyId = @CompanyId AND l.Status NOT IN ('Converted', 'Lost')
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
           CAST(CASE WHEN SUM(x.InLeads) = 0 THEN 0 ELSE 100.0 * SUM(x.InConverted) / SUM(x.InLeads) END AS DECIMAL(5,1)) AS ConversionPct,
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
            AND (@OwnerUserId IS NULL OR f.UserId = @OwnerUserId)) x
    LEFT JOIN dbo.Users u ON u.UserId = x.OwnerUserId
    GROUP BY x.OwnerUserId, u.FullName
    HAVING SUM(x.InLeads) + SUM(x.Done) + SUM(x.Overdue) + SUM(x.InConverted) + SUM(x.InLost) > 0
    ORDER BY Leads DESC, u.FullName;
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
    WHERE l.CompanyId = @CompanyId AND l.Status = 'Lost'
      AND CAST(l.LostAt AS DATE) >= @From AND CAST(l.LostAt AS DATE) <= @To
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)
    GROUP BY ISNULL(r.Name, N'(none)')
    ORDER BY Leads DESC, ReasonName;
END
GO

PRINT 'CRM board and reports applied.';
GO
SET NOEXEC OFF;
GO
