/* =============================================================================
   ProjectDB (company database) · Lead Excel import / export with Admin approval
   -----------------------------------------------------------------------------
   A company admin imports and exports freely. Anyone else asks; an admin approves
   or rejects. An approval is good for ONE import or export, within 24 hours.

     crm.LeadDataRequests
     crm.sp_LeadData_Access       what this person may do now
     crm.sp_LeadData_RequestAdd   asks (one open request per person and kind)
     crm.sp_LeadData_RequestList  the requests, for an admin
     crm.sp_LeadData_Decide       approves or rejects
     crm.sp_LeadData_Use          spends one approval
     crm.sp_Lead_Export           the leads the person may see, for the file
     crm.sp_Lead_ExistingMobiles  which mobiles of an import are leads already

   Runs AFTER 26_CRM_Lead_Products.sql. Run in EACH company database (select it
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
ELSE IF OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database (dbo.Locations is missing).';
ELSE IF OBJECT_ID('crm.LeadProducts') IS NULL
    SET @problem = 'Run 26_CRM_Lead_Products.sql first.';

IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('crm.LeadDataRequests') IS NULL
BEGIN
    CREATE TABLE crm.LeadDataRequests
    (
        RequestId    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeadDataRequests PRIMARY KEY,
        CompanyId    INT NOT NULL,
        RequestType  NVARCHAR(10) NOT NULL CONSTRAINT CK_LeadDataRequests_Type CHECK (RequestType IN ('Import', 'Export')),
        RequestedBy  INT NOT NULL,
        RequestedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_LeadDataRequests_At DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
        Note         NVARCHAR(500) NOT NULL CONSTRAINT DF_LeadDataRequests_Note DEFAULT (N''),
        Status       NVARCHAR(10) NOT NULL CONSTRAINT DF_LeadDataRequests_Status DEFAULT ('Pending')
                     CONSTRAINT CK_LeadDataRequests_Status CHECK (Status IN ('Pending', 'Approved', 'Rejected', 'Used')),
        DecidedBy    INT NULL,
        DecidedAt    DATETIME2(0) NULL,
        DecisionNote NVARCHAR(500) NOT NULL CONSTRAINT DF_LeadDataRequests_Decision DEFAULT (N''),
        UsedAt       DATETIME2(0) NULL
    );
    CREATE INDEX IX_LeadDataRequests_User ON crm.LeadDataRequests (CompanyId, RequestedBy, RequestType, Status);
END
GO

CREATE OR ALTER PROCEDURE crm.sp_LeadData_Access
    @CompanyId INT,
    @UserId    INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Since DATETIME2(0) = DATEADD(HOUR, -24, DATEADD(MINUTE, 330, GETUTCDATE()));

    SELECT
        CAST(CASE WHEN EXISTS (SELECT 1 FROM crm.LeadDataRequests WHERE CompanyId = @CompanyId AND RequestedBy = @UserId AND RequestType = 'Export' AND Status = 'Approved' AND DecidedAt >= @Since) THEN 1 ELSE 0 END AS BIT) AS ExportApproved,
        CAST(CASE WHEN EXISTS (SELECT 1 FROM crm.LeadDataRequests WHERE CompanyId = @CompanyId AND RequestedBy = @UserId AND RequestType = 'Import' AND Status = 'Approved' AND DecidedAt >= @Since) THEN 1 ELSE 0 END AS BIT) AS ImportApproved,
        CAST(CASE WHEN EXISTS (SELECT 1 FROM crm.LeadDataRequests WHERE CompanyId = @CompanyId AND RequestedBy = @UserId AND RequestType = 'Export' AND Status = 'Pending') THEN 1 ELSE 0 END AS BIT) AS ExportPending,
        CAST(CASE WHEN EXISTS (SELECT 1 FROM crm.LeadDataRequests WHERE CompanyId = @CompanyId AND RequestedBy = @UserId AND RequestType = 'Import' AND Status = 'Pending') THEN 1 ELSE 0 END AS BIT) AS ImportPending,
        (SELECT COUNT(*) FROM crm.LeadDataRequests WHERE CompanyId = @CompanyId AND Status = 'Pending') AS PendingCount;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_LeadData_RequestAdd
    @CompanyId   INT,
    @UserId      INT,
    @RequestType NVARCHAR(10),
    @Note        NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @RequestType NOT IN ('Import', 'Export') OR ISNULL(@UserId, 0) <= 0
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Choose import or export' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @Open INT = (SELECT TOP (1) RequestId FROM crm.LeadDataRequests WITH (UPDLOCK, HOLDLOCK)
                         WHERE CompanyId = @CompanyId AND RequestedBy = @UserId AND RequestType = @RequestType AND Status = 'Pending');
    IF @Open IS NOT NULL
    BEGIN
        COMMIT TRANSACTION;
        SELECT CAST(1 AS BIT) AS Success, N'Your request is already with the admin' AS Message, @Open AS Id; RETURN;
    END

    INSERT INTO crm.LeadDataRequests (CompanyId, RequestType, RequestedBy, Note)
    VALUES (@CompanyId, @RequestType, @UserId, LTRIM(RTRIM(ISNULL(@Note, N''))));
    DECLARE @Id INT = SCOPE_IDENTITY();

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Request sent to the admin' AS Message, @Id AS Id;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_LeadData_RequestList
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (100) r.RequestId, r.RequestType, r.RequestedBy, ISNULL(u.FullName, N'') AS RequestedByName, r.RequestedAt, r.Note,
           r.Status, ISNULL(d.FullName, N'') AS DecidedByName, r.DecidedAt, r.DecisionNote, r.UsedAt
    FROM crm.LeadDataRequests r
    LEFT JOIN dbo.Users u ON u.UserId = r.RequestedBy
    LEFT JOIN dbo.Users d ON d.UserId = r.DecidedBy
    WHERE r.CompanyId = @CompanyId
    ORDER BY CASE WHEN r.Status = 'Pending' THEN 0 ELSE 1 END, r.RequestedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_LeadData_Decide
    @CompanyId    INT,
    @RequestId    INT,
    @AdminId      INT,
    @Approve      BIT,
    @DecisionNote NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE crm.LeadDataRequests
    SET Status = CASE WHEN @Approve = 1 THEN 'Approved' ELSE 'Rejected' END, DecidedBy = @AdminId,
        DecidedAt = DATEADD(MINUTE, 330, GETUTCDATE()), DecisionNote = LTRIM(RTRIM(ISNULL(@DecisionNote, N'')))
    WHERE RequestId = @RequestId AND CompanyId = @CompanyId AND Status = 'Pending';

    IF @@ROWCOUNT = 0
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'This request was already decided' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    SELECT CAST(1 AS BIT) AS Success, CASE WHEN @Approve = 1 THEN N'Request approved' ELSE N'Request rejected' END AS Message, @RequestId AS Id;
END
GO

/* one approval, one file: two calls at once cannot both spend it */
CREATE OR ALTER PROCEDURE crm.sp_LeadData_Use
    @CompanyId   INT,
    @UserId      INT,
    @RequestType NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Now DATETIME2(0) = DATEADD(MINUTE, 330, GETUTCDATE());
    DECLARE @Used TABLE (RequestId INT);

    ;WITH next_one AS (
        SELECT TOP (1) * FROM crm.LeadDataRequests WITH (UPDLOCK, READPAST)
        WHERE CompanyId = @CompanyId AND RequestedBy = @UserId AND RequestType = @RequestType
          AND Status = 'Approved' AND DecidedAt >= DATEADD(HOUR, -24, @Now)
        ORDER BY DecidedAt
    )
    UPDATE next_one SET Status = 'Used', UsedAt = @Now
    OUTPUT inserted.RequestId INTO @Used;

    IF NOT EXISTS (SELECT 1 FROM @Used)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'This needs approval from your admin' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    SELECT CAST(1 AS BIT) AS Success, N'' AS Message, (SELECT TOP (1) RequestId FROM @Used) AS Id;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Lead_Export
    @CompanyId  INT,
    @UserId     INT,
    @IsManager  BIT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (10000) l.LeadNo, l.LeadDate, l.ContactName, l.Mobile, l.Email, l.Address, l.City, l.[State], l.PinCode, l.Landmark,
           ISNULL(s.Name, N'') AS SourceName, l.ProductCategory,
           ISNULL(STUFF((SELECT N', ' + p.ProductName + N' x ' + CAST(lp.Qty AS NVARCHAR(10))
                         FROM crm.LeadProducts lp
                         INNER JOIN dbo.ProductMaster p ON p.ProductMasterId = lp.ProductMasterId
                         WHERE lp.LeadId = l.LeadId
                         ORDER BY lp.SortOrder
                         FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, N''), N'') AS Products,
           l.ModelRequirement, l.EstimatedQty, l.ExpectedPurchaseDate, ISNULL(u.FullName, N'') AS OwnerName, l.Priority, l.Status, l.Remarks
    FROM crm.Leads l
    LEFT JOIN crm.LeadSources s ON s.LeadSourceId = l.LeadSourceId AND s.CompanyId = @CompanyId
    LEFT JOIN dbo.Users u ON u.UserId = l.OwnerUserId
    WHERE l.CompanyId = @CompanyId AND l.IsDeleted = 0 AND l.LocationId = @LocationId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId)
    ORDER BY l.LeadId DESC;
END
GO

/* @Mobiles: ["9000011201", ...] */
CREATE OR ALTER PROCEDURE crm.sp_Lead_ExistingMobiles
    @CompanyId  INT,
    @LocationId INT,
    @Mobiles    NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    IF ISJSON(ISNULL(@Mobiles, N'')) <> 1 RETURN;

    SELECT DISTINCT l.Mobile
    FROM crm.Leads l
    INNER JOIN OPENJSON(@Mobiles) WITH (Mobile NVARCHAR(20) '$') j ON j.Mobile = l.Mobile
    WHERE l.CompanyId = @CompanyId AND l.LocationId = @LocationId AND l.IsDeleted = 0;
END
GO

SET NOEXEC OFF;
GO
