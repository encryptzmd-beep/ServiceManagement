/* =============================================================================
   ProjectDB (company database) · Transaction toolbar: quotation Cancelled, previous / next
   -----------------------------------------------------------------------------
   For the toolbar of the Sales Order and Quotation screens (New, Edit, Save, Print,
   Cancel, Previous, Next, Find):

     crm.Quotations.Status          allows 'Cancelled' (the quotation is void)
     crm.sp_Quotation_SetStatus     copied from 16_CRM_Board_Reports.sql; also cancels a
                                    Draft, Sent or Rejected quotation (not Accepted / Superseded)
     crm.sp_Quotation_Neighbours    previous / next latest revision the caller may see
     dbo.sp_SalesOrder_Neighbours   previous / next sales order

   Runs AFTER 19_Technician_Attendance_Optional.sql. Run in EACH company database
   (select it in SSMS first; no USE on purpose). New company databases created by the
   API get it automatically after 19. SAFE TO RE-RUN.
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
ELSE IF OBJECT_ID('crm.Quotations') IS NULL
    SET @problem = 'crm.Quotations is missing. Run 14_CRM.sql first.';
ELSE IF COL_LENGTH('dbo.Technicians', 'AttendanceRequired') IS NULL
    SET @problem = 'Run 19_Technician_Attendance_Optional.sql first.';
ELSE IF OBJECT_ID('dbo.SalesOrders') IS NULL
    SET @problem = 'dbo.SalesOrders is missing. Run 09_Sales_Order_Despatch.sql first.';

IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

/* 1. A quotation can be Cancelled (void) */
IF OBJECT_ID('crm.CK_crm_Quotations_Status') IS NOT NULL
    ALTER TABLE crm.Quotations DROP CONSTRAINT CK_crm_Quotations_Status;
GO
ALTER TABLE crm.Quotations WITH CHECK
    ADD CONSTRAINT CK_crm_Quotations_Status CHECK ([Status] IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Superseded', 'Cancelled'));
GO

/* 2. Set status: as in 16, plus Cancelled from Draft, Sent or Rejected */
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

    IF @Status NOT IN ('Sent', 'Rejected', 'Cancelled')
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'A quotation can be marked sent, rejected or cancelled' AS Message, CAST(0 AS INT) AS Id; RETURN;
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

    IF NOT ((@Status = 'Sent' AND @Current IN ('Draft', 'Rejected'))
         OR (@Status = 'Rejected' AND @Current = 'Sent')
         OR (@Status = 'Cancelled' AND @Current IN ('Draft', 'Sent', 'Rejected')))
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
        INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId
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

/* 4. Previous / next sales order (@SalesOrderId 0 = from a new one) */
CREATE OR ALTER PROCEDURE dbo.sp_SalesOrder_Neighbours
    @SalesOrderId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        (SELECT MAX(SalesOrderId) FROM dbo.SalesOrders WHERE ISNULL(@SalesOrderId, 0) = 0 OR SalesOrderId < @SalesOrderId) AS PreviousId,
        CASE WHEN ISNULL(@SalesOrderId, 0) = 0 THEN NULL
             ELSE (SELECT MIN(SalesOrderId) FROM dbo.SalesOrders WHERE SalesOrderId > @SalesOrderId) END AS NextId;
END
GO

PRINT 'Transaction toolbar applied.';
GO
SET NOEXEC OFF;
GO
