/* =============================================================================
   ProjectDB (company database) · CRM: Lead Management (phase 1)
   -----------------------------------------------------------------------------
   CRM is a commercial application: a company's leads, follow-ups and quotations
   are the company's own data and live in the company's own database, in the
   schema crm. The Service application is not touched: this script changes no
   table, procedure or row of dbo. The crm procedures only READ dbo.Users (names),
   dbo.ProductMaster (the product picker) and dbo.SalesOrders (the order of a
   converted lead). The sale itself is made by the existing Sales Order
   procedures, called by the API.

   Run in EACH company database (select it in SSMS first; no USE on purpose).
   New company databases created by the API get this script automatically.
   ADDITIVE and SAFE TO RE-RUN.

     crm.Members            who is on the sales team, and who is a CRM manager
     crm.LeadSources        editable master (seeded per company by sp_Masters_Ensure)
     crm.LostReasons        editable master (seeded per company by sp_Masters_Ensure)
     crm.Leads              the enquiries, LD-0001 per company
     crm.LeadStatusHistory  every status change and every reassignment
     crm.FollowUps          calls, visits and meetings, with the next date and action
     crm.Quotations         QT-0001 per company, with revisions 1, 2, ...
     crm.QuotationItems     the lines of a quotation, as the Sales Order lines

   Every row carries the CompanyId and every procedure takes @CompanyId first
   and names it in every statement, so the database may be shared by companies.
   A sales user sees only own leads: the procedures take @UserId and @IsManager
   (company admins are passed as managers by the API).

   Times are the local (India) time, DATEADD(MINUTE, 330, GETUTCDATE()), as in
   the Sales Order script; ConvertingAt is a UTC marker (SYSUTCDATETIME()).
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

IF SCHEMA_ID('crm') IS NULL EXEC('CREATE SCHEMA crm');
GO

/* -----------------------------------------------------------------------------
   1. Tables
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('crm.Members') IS NULL
CREATE TABLE crm.Members
(
    MemberId  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_crm_Members PRIMARY KEY,
    CompanyId INT          NOT NULL,
    UserId    INT          NOT NULL,   -- dbo.Users.UserId of this database
    IsManager BIT          NOT NULL CONSTRAINT DF_crm_Members_IsManager DEFAULT (0),
    IsActive  BIT          NOT NULL CONSTRAINT DF_crm_Members_IsActive DEFAULT (1),
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_crm_Members_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_crm_Members_UpdatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
    CONSTRAINT UQ_crm_Members_Company_User UNIQUE (CompanyId, UserId)
);
GO

IF OBJECT_ID('crm.LeadSources') IS NULL
CREATE TABLE crm.LeadSources
(
    LeadSourceId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_crm_LeadSources PRIMARY KEY,
    CompanyId    INT           NOT NULL,
    Name         NVARCHAR(100) NOT NULL,
    SortOrder    INT           NOT NULL CONSTRAINT DF_crm_LeadSources_SortOrder DEFAULT (0),
    IsActive     BIT           NOT NULL CONSTRAINT DF_crm_LeadSources_IsActive DEFAULT (1),
    CreatedAt    DATETIME2(0)  NOT NULL CONSTRAINT DF_crm_LeadSources_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
    CONSTRAINT UQ_crm_LeadSources_Company_Name UNIQUE (CompanyId, Name)
);
GO

IF OBJECT_ID('crm.LostReasons') IS NULL
CREATE TABLE crm.LostReasons
(
    LostReasonId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_crm_LostReasons PRIMARY KEY,
    CompanyId    INT           NOT NULL,
    Name         NVARCHAR(100) NOT NULL,
    SortOrder    INT           NOT NULL CONSTRAINT DF_crm_LostReasons_SortOrder DEFAULT (0),
    IsActive     BIT           NOT NULL CONSTRAINT DF_crm_LostReasons_IsActive DEFAULT (1),
    CreatedAt    DATETIME2(0)  NOT NULL CONSTRAINT DF_crm_LostReasons_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
    CONSTRAINT UQ_crm_LostReasons_Company_Name UNIQUE (CompanyId, Name)
);
GO

IF OBJECT_ID('crm.Leads') IS NULL
CREATE TABLE crm.Leads
(
    LeadId               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_crm_Leads PRIMARY KEY,
    CompanyId            INT            NOT NULL,
    LeadNo               NVARCHAR(20)   NOT NULL,   -- LD-0001, per company
    LeadDate             DATE           NOT NULL,
    ContactName          NVARCHAR(200)  NOT NULL,
    Mobile               NVARCHAR(20)   NOT NULL,
    Email                NVARCHAR(256)  NOT NULL CONSTRAINT DF_crm_Leads_Email DEFAULT (''),
    Address              NVARCHAR(500)  NOT NULL CONSTRAINT DF_crm_Leads_Address DEFAULT (''),
    City                 NVARCHAR(100)  NOT NULL CONSTRAINT DF_crm_Leads_City DEFAULT (''),
    [State]              NVARCHAR(100)  NOT NULL CONSTRAINT DF_crm_Leads_State DEFAULT (''),
    PinCode              NVARCHAR(10)   NOT NULL CONSTRAINT DF_crm_Leads_PinCode DEFAULT (''),
    Landmark             NVARCHAR(200)  NOT NULL CONSTRAINT DF_crm_Leads_Landmark DEFAULT (''),
    LeadSourceId         INT            NULL CONSTRAINT FK_crm_Leads_LeadSources REFERENCES crm.LeadSources(LeadSourceId),
    ProductCategory      NVARCHAR(100)  NOT NULL CONSTRAINT DF_crm_Leads_ProductCategory DEFAULT (''),
    ModelRequirement     NVARCHAR(500)  NOT NULL CONSTRAINT DF_crm_Leads_ModelRequirement DEFAULT (''),
    EstimatedQty         INT            NULL,
    ExpectedPurchaseDate DATE           NULL,
    OwnerUserId          INT            NOT NULL,   -- the sales person, dbo.Users.UserId
    Priority             NVARCHAR(10)   NOT NULL CONSTRAINT DF_crm_Leads_Priority DEFAULT ('Medium')
                                                 CONSTRAINT CK_crm_Leads_Priority CHECK (Priority IN ('Low', 'Medium', 'High')),
    [Status]             NVARCHAR(20)   NOT NULL CONSTRAINT DF_crm_Leads_Status DEFAULT ('New')
                                                 CONSTRAINT CK_crm_Leads_Status CHECK ([Status] IN ('New', 'Contacted', 'Qualified', 'Quotation', 'Negotiation', 'Converted', 'Lost')),
    LostReasonId         INT            NULL CONSTRAINT FK_crm_Leads_LostReasons REFERENCES crm.LostReasons(LostReasonId),
    LostNote             NVARCHAR(1000) NOT NULL CONSTRAINT DF_crm_Leads_LostNote DEFAULT (''),
    LostAt               DATETIME2(0)   NULL,
    NextFollowUpAt       DATETIME2(0)   NULL,       -- copy of the latest follow-up's next date
    CustomerId           INT            NULL,       -- dbo.Customers.CustomerId (by value, no foreign key)
    SalesOrderId         INT            NULL,       -- dbo.SalesOrders.SalesOrderId (by value, no foreign key)
    ConvertedAt          DATETIME2(0)   NULL,
    ConvertingAt         DATETIME2      NULL,       -- UTC marker: a convert is under way
    Remarks              NVARCHAR(2000) NOT NULL CONSTRAINT DF_crm_Leads_Remarks DEFAULT (''),
    LocationId           INT            NOT NULL,   -- the branch, dbo.Locations
    CreatedBy            INT            NOT NULL,
    CreatedAt            DATETIME2(0)   NOT NULL CONSTRAINT DF_crm_Leads_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
    UpdatedAt            DATETIME2(0)   NOT NULL CONSTRAINT DF_crm_Leads_UpdatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
    CONSTRAINT UQ_crm_Leads_Company_LeadNo UNIQUE (CompanyId, LeadNo)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_crm_Leads_Company_Owner' AND object_id = OBJECT_ID('crm.Leads'))
    CREATE INDEX IX_crm_Leads_Company_Owner ON crm.Leads(CompanyId, OwnerUserId, [Status]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_crm_Leads_Company_NextFollowUp' AND object_id = OBJECT_ID('crm.Leads'))
    CREATE INDEX IX_crm_Leads_Company_NextFollowUp ON crm.Leads(CompanyId, NextFollowUpAt);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_crm_Leads_Company_Mobile' AND object_id = OBJECT_ID('crm.Leads'))
    CREATE INDEX IX_crm_Leads_Company_Mobile ON crm.Leads(CompanyId, Mobile);
GO
/* one lead per sales order */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_crm_Leads_Company_SalesOrder' AND object_id = OBJECT_ID('crm.Leads'))
    CREATE UNIQUE INDEX UX_crm_Leads_Company_SalesOrder ON crm.Leads(CompanyId, SalesOrderId) WHERE SalesOrderId IS NOT NULL;
GO

IF OBJECT_ID('crm.LeadStatusHistory') IS NULL
CREATE TABLE crm.LeadStatusHistory
(
    LeadStatusHistoryId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_crm_LeadStatusHistory PRIMARY KEY,
    CompanyId           INT            NOT NULL,
    LeadId              INT            NOT NULL CONSTRAINT FK_crm_LeadStatusHistory_Leads REFERENCES crm.Leads(LeadId),
    FromStatus          NVARCHAR(20)   NULL,
    ToStatus            NVARCHAR(20)   NOT NULL,
    ChangedBy           INT            NOT NULL,
    ChangedAt           DATETIME2(0)   NOT NULL CONSTRAINT DF_crm_LeadStatusHistory_ChangedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
    Note                NVARCHAR(1000) NOT NULL CONSTRAINT DF_crm_LeadStatusHistory_Note DEFAULT ('')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_crm_LeadStatusHistory_Lead' AND object_id = OBJECT_ID('crm.LeadStatusHistory'))
    CREATE INDEX IX_crm_LeadStatusHistory_Lead ON crm.LeadStatusHistory(CompanyId, LeadId, ChangedAt);
GO

IF OBJECT_ID('crm.FollowUps') IS NULL
CREATE TABLE crm.FollowUps
(
    FollowUpId     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_crm_FollowUps PRIMARY KEY,
    CompanyId      INT            NOT NULL,
    LeadId         INT            NOT NULL CONSTRAINT FK_crm_FollowUps_Leads REFERENCES crm.Leads(LeadId),
    FollowUpAt     DATETIME2(0)   NOT NULL,
    [Type]         NVARCHAR(20)   NOT NULL CONSTRAINT CK_crm_FollowUps_Type CHECK ([Type] IN ('Phone Call', 'Meeting', 'Site Visit', 'WhatsApp', 'Email', 'Other')),
    Notes          NVARCHAR(2000) NOT NULL CONSTRAINT DF_crm_FollowUps_Notes DEFAULT (''),
    NextFollowUpAt DATETIME2(0)   NULL,
    NextAction     NVARCHAR(500)  NOT NULL CONSTRAINT DF_crm_FollowUps_NextAction DEFAULT (''),
    UserId         INT            NOT NULL,
    Remarks        NVARCHAR(1000) NOT NULL CONSTRAINT DF_crm_FollowUps_Remarks DEFAULT (''),
    CreatedAt      DATETIME2(0)   NOT NULL CONSTRAINT DF_crm_FollowUps_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE()))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_crm_FollowUps_Lead' AND object_id = OBJECT_ID('crm.FollowUps'))
    CREATE INDEX IX_crm_FollowUps_Lead ON crm.FollowUps(CompanyId, LeadId, FollowUpAt DESC);
GO

IF OBJECT_ID('crm.Quotations') IS NULL
CREATE TABLE crm.Quotations
(
    QuotationId   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_crm_Quotations PRIMARY KEY,
    CompanyId     INT            NOT NULL,
    LeadId        INT            NOT NULL CONSTRAINT FK_crm_Quotations_Leads REFERENCES crm.Leads(LeadId),
    QuotationNo   NVARCHAR(20)   NOT NULL,   -- QT-0001, per company; the same for every revision
    RevisionNo    INT            NOT NULL CONSTRAINT DF_crm_Quotations_RevisionNo DEFAULT (1),
    QuoteDate     DATE           NOT NULL,
    ValidUntil    DATE           NULL,
    IsInterState  BIT            NOT NULL CONSTRAINT DF_crm_Quotations_IsInterState DEFAULT (0),
    SubTotal      DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_Quotations_SubTotal DEFAULT (0),
    DiscountTotal DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_Quotations_DiscountTotal DEFAULT (0),
    TaxableTotal  DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_Quotations_TaxableTotal DEFAULT (0),
    CGST          DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_Quotations_CGST DEFAULT (0),
    SGST          DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_Quotations_SGST DEFAULT (0),
    IGST          DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_Quotations_IGST DEFAULT (0),
    GrandTotal    DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_Quotations_GrandTotal DEFAULT (0),
    Terms         NVARCHAR(4000) NOT NULL CONSTRAINT DF_crm_Quotations_Terms DEFAULT (''),
    [Status]      NVARCHAR(20)   NOT NULL CONSTRAINT DF_crm_Quotations_Status DEFAULT ('Draft')
                                          CONSTRAINT CK_crm_Quotations_Status CHECK ([Status] IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Superseded')),
    CreatedBy     INT            NOT NULL,
    CreatedAt     DATETIME2(0)   NOT NULL CONSTRAINT DF_crm_Quotations_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
    UpdatedAt     DATETIME2(0)   NOT NULL CONSTRAINT DF_crm_Quotations_UpdatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
    CONSTRAINT UQ_crm_Quotations_Company_No_Revision UNIQUE (CompanyId, QuotationNo, RevisionNo)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_crm_Quotations_Lead' AND object_id = OBJECT_ID('crm.Quotations'))
    CREATE INDEX IX_crm_Quotations_Lead ON crm.Quotations(CompanyId, LeadId);
GO

IF OBJECT_ID('crm.QuotationItems') IS NULL
CREATE TABLE crm.QuotationItems
(
    QuotationItemId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_crm_QuotationItems PRIMARY KEY,
    CompanyId       INT            NOT NULL,
    QuotationId     INT            NOT NULL CONSTRAINT FK_crm_QuotationItems_Quotations REFERENCES crm.Quotations(QuotationId),
    ProductMasterId INT            NULL,   -- dbo.ProductMaster (by value)
    ProductName     NVARCHAR(200)  NOT NULL,
    HsnSac          NVARCHAR(20)   NULL,
    Qty             INT            NOT NULL CONSTRAINT DF_crm_QuotationItems_Qty DEFAULT (1),
    Rate            DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_QuotationItems_Rate DEFAULT (0),
    DiscountAmount  DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_QuotationItems_Discount DEFAULT (0),
    GstPercent      DECIMAL(5,2)   NOT NULL CONSTRAINT DF_crm_QuotationItems_Gst DEFAULT (18),
    WarrantyMonths  INT            NOT NULL CONSTRAINT DF_crm_QuotationItems_Warranty DEFAULT (12),
    TaxableAmount   DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_QuotationItems_Taxable DEFAULT (0),
    GstAmount       DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_QuotationItems_GstAmt DEFAULT (0),
    LineTotal       DECIMAL(18,2)  NOT NULL CONSTRAINT DF_crm_QuotationItems_LineTotal DEFAULT (0),
    SortOrder       INT            NOT NULL CONSTRAINT DF_crm_QuotationItems_Sort DEFAULT (0)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_crm_QuotationItems_Quotation' AND object_id = OBJECT_ID('crm.QuotationItems'))
    CREATE INDEX IX_crm_QuotationItems_Quotation ON crm.QuotationItems(CompanyId, QuotationId, SortOrder);
GO

/* -----------------------------------------------------------------------------
   2. Masters (lead sources, lost reasons) and the sales team
   ----------------------------------------------------------------------------- */

/* The seeds of a company, put in the first time CRM is used. A company that has
   rows already (its own, or edited seeds) is left as it is. */
CREATE OR ALTER PROCEDURE crm.sp_Masters_Ensure
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(@CompanyId, 0) = 0 RETURN;

    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM crm.LeadSources WITH (UPDLOCK, HOLDLOCK) WHERE CompanyId = @CompanyId)
        INSERT INTO crm.LeadSources (CompanyId, Name, SortOrder)
        VALUES (@CompanyId, N'Walk-in', 1), (@CompanyId, N'Phone Call', 2), (@CompanyId, N'Website', 3), (@CompanyId, N'Referral', 4),
               (@CompanyId, N'Dealer', 5), (@CompanyId, N'Social Media', 6), (@CompanyId, N'Existing Customer', 7), (@CompanyId, N'Other', 8);

    IF NOT EXISTS (SELECT 1 FROM crm.LostReasons WITH (UPDLOCK, HOLDLOCK) WHERE CompanyId = @CompanyId)
        INSERT INTO crm.LostReasons (CompanyId, Name, SortOrder)
        VALUES (@CompanyId, N'Price', 1), (@CompanyId, N'Bought Elsewhere', 2), (@CompanyId, N'Not Interested', 3),
               (@CompanyId, N'No Response', 4), (@CompanyId, N'Other', 5);

    COMMIT TRANSACTION;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Source_List
    @CompanyId  INT,
    @ActiveOnly BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    EXEC crm.sp_Masters_Ensure @CompanyId = @CompanyId;

    SELECT s.LeadSourceId, s.Name, s.SortOrder, s.IsActive
    FROM crm.LeadSources s
    WHERE s.CompanyId = @CompanyId AND (ISNULL(@ActiveOnly, 0) = 0 OR s.IsActive = 1)
    ORDER BY s.IsActive DESC, s.SortOrder, s.Name;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_Source_Save
    @CompanyId    INT,
    @LeadSourceId INT,
    @Name         NVARCHAR(100),
    @SortOrder    INT = 0,
    @IsActive     BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Name = LTRIM(RTRIM(ISNULL(@Name, '')));
    IF ISNULL(@CompanyId, 0) = 0 OR @Name = ''
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Enter the name of the source' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM crm.LeadSources WITH (UPDLOCK, HOLDLOCK)
               WHERE CompanyId = @CompanyId AND Name = @Name AND LeadSourceId <> ISNULL(@LeadSourceId, 0))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'You already have a source of this name' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF ISNULL(@LeadSourceId, 0) = 0
    BEGIN
        INSERT INTO crm.LeadSources (CompanyId, Name, SortOrder, IsActive)
        VALUES (@CompanyId, @Name, ISNULL(@SortOrder, 0), ISNULL(@IsActive, 1));
        SET @LeadSourceId = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
        SELECT CAST(1 AS BIT) AS Success, N'Source added' AS Message, @LeadSourceId AS Id; RETURN;
    END

    UPDATE crm.LeadSources
    SET Name = @Name, SortOrder = ISNULL(@SortOrder, 0), IsActive = ISNULL(@IsActive, 1)
    WHERE LeadSourceId = @LeadSourceId AND CompanyId = @CompanyId;

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Source saved' AS Message, @LeadSourceId AS Id;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_LostReason_List
    @CompanyId  INT,
    @ActiveOnly BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    EXEC crm.sp_Masters_Ensure @CompanyId = @CompanyId;

    SELECT r.LostReasonId, r.Name, r.SortOrder, r.IsActive
    FROM crm.LostReasons r
    WHERE r.CompanyId = @CompanyId AND (ISNULL(@ActiveOnly, 0) = 0 OR r.IsActive = 1)
    ORDER BY r.IsActive DESC, r.SortOrder, r.Name;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_LostReason_Save
    @CompanyId    INT,
    @LostReasonId INT,
    @Name         NVARCHAR(100),
    @SortOrder    INT = 0,
    @IsActive     BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Name = LTRIM(RTRIM(ISNULL(@Name, '')));
    IF ISNULL(@CompanyId, 0) = 0 OR @Name = ''
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Enter the reason' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM crm.LostReasons WITH (UPDLOCK, HOLDLOCK)
               WHERE CompanyId = @CompanyId AND Name = @Name AND LostReasonId <> ISNULL(@LostReasonId, 0))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'You already have this reason' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF ISNULL(@LostReasonId, 0) = 0
    BEGIN
        INSERT INTO crm.LostReasons (CompanyId, Name, SortOrder, IsActive)
        VALUES (@CompanyId, @Name, ISNULL(@SortOrder, 0), ISNULL(@IsActive, 1));
        SET @LostReasonId = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
        SELECT CAST(1 AS BIT) AS Success, N'Reason added' AS Message, @LostReasonId AS Id; RETURN;
    END

    UPDATE crm.LostReasons
    SET Name = @Name, SortOrder = ISNULL(@SortOrder, 0), IsActive = ISNULL(@IsActive, 1)
    WHERE LostReasonId = @LostReasonId AND CompanyId = @CompanyId;

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Reason saved' AS Message, @LostReasonId AS Id;
END
GO

/* Two result sets: the members of the sales team, then the active users of the
   database that are not members yet (to add one). */
CREATE OR ALTER PROCEDURE crm.sp_Member_List
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT m.MemberId, m.UserId, ISNULL(u.FullName, N'') AS FullName, u.Email, u.MobileNumber, m.IsManager, m.IsActive
    FROM crm.Members m
    LEFT JOIN dbo.Users u ON u.UserId = m.UserId
    WHERE m.CompanyId = @CompanyId
    ORDER BY m.IsActive DESC, u.FullName;

    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber
    FROM dbo.Users u
    WHERE ISNULL(u.IsActive, 1) = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.Roles r WHERE r.RoleId = u.RoleId AND r.RoleName = N'Customer')
      AND NOT EXISTS (SELECT 1 FROM crm.Members m WHERE m.UserId = u.UserId AND m.CompanyId = @CompanyId)
    ORDER BY u.FullName;
END
GO

/* Adds a user to the sales team, or changes a member. @MemberUserId is the user
   being saved (dbo.Users.UserId). */
CREATE OR ALTER PROCEDURE crm.sp_Member_Save
    @CompanyId       INT,
    @MemberUserId    INT,
    @MemberIsManager BIT = 0,
    @IsActive        BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(@CompanyId, 0) = 0 OR NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @MemberUserId)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Choose a user of the company' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    UPDATE crm.Members
    SET IsManager = ISNULL(@MemberIsManager, 0), IsActive = ISNULL(@IsActive, 1), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE CompanyId = @CompanyId AND UserId = @MemberUserId;

    IF @@ROWCOUNT = 0
        INSERT INTO crm.Members (CompanyId, UserId, IsManager, IsActive)
        VALUES (@CompanyId, @MemberUserId, ISNULL(@MemberIsManager, 0), ISNULL(@IsActive, 1));

    DECLARE @MemberId INT = (SELECT MemberId FROM crm.Members WHERE CompanyId = @CompanyId AND UserId = @MemberUserId);

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Team member saved' AS Message, @MemberId AS Id;
END
GO

/* Is the user an active CRM manager? (A company admin is a manager too: the API
   checks that from ModuleAccess.) */
CREATE OR ALTER PROCEDURE crm.sp_IsManager
    @CompanyId INT,
    @UserId    INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT CAST(CASE WHEN EXISTS (SELECT 1 FROM crm.Members
                                  WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1 AND IsManager = 1)
                     THEN 1 ELSE 0 END AS BIT) AS IsManager;
END
GO

/* -----------------------------------------------------------------------------
   3. Leads. A sales user lists, opens and changes only own leads
      (@IsManager = 1 OR OwnerUserId = @UserId), and only in the branch the user
      selected (LocationId = @LocationId). Converted and Lost leads are
      read-only; a manager may reopen a Lost lead.
   ----------------------------------------------------------------------------- */

/* The number the next lead of the company will get (shown on the new-lead form). */
CREATE OR ALTER PROCEDURE crm.sp_Lead_NextNumber
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @n INT = 1 + ISNULL((SELECT MAX(TRY_CAST(SUBSTRING(LeadNo, 4, 20) AS INT)) FROM crm.Leads
                                 WHERE CompanyId = @CompanyId AND LeadNo LIKE 'LD-%'), 0);

    SELECT 'LD-' + CASE WHEN @n < 10000 THEN RIGHT('0000' + CAST(@n AS VARCHAR(10)), 4) ELSE CAST(@n AS VARCHAR(10)) END AS LeadNo;
END
GO

/* Adds a lead (@LeadId 0) or changes one. A new lead is New, numbered LD-0001 per
   company and owned by the user, or by @OwnerUserId when a manager makes it for a
   member of the team. The owner of an existing lead changes only through
   sp_Lead_Reassign. */
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
    @Remarks              NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @ContactName  = LTRIM(RTRIM(ISNULL(@ContactName, '')));
    SET @Mobile       = LTRIM(RTRIM(ISNULL(@Mobile, '')));
    SET @Priority     = ISNULL(NULLIF(LTRIM(RTRIM(@Priority)), ''), 'Medium');
    SET @LeadSourceId = NULLIF(@LeadSourceId, 0);
    SET @OwnerUserId  = NULLIF(@OwnerUserId, 0);
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
                               Priority, Status, Remarks, LocationId, CreatedBy)
        VALUES (@CompanyId, @LeadNo, @LeadDate, @ContactName, @Mobile, LTRIM(RTRIM(ISNULL(@Email, ''))), LTRIM(RTRIM(ISNULL(@Address, ''))),
                LTRIM(RTRIM(ISNULL(@City, ''))), LTRIM(RTRIM(ISNULL(@State, ''))), LTRIM(RTRIM(ISNULL(@PinCode, ''))), LTRIM(RTRIM(ISNULL(@Landmark, ''))),
                @LeadSourceId, LTRIM(RTRIM(ISNULL(@ProductCategory, ''))), LTRIM(RTRIM(ISNULL(@ModelRequirement, ''))), @EstimatedQty,
                @ExpectedPurchaseDate, @OwnerUserId, @Priority, 'New', LTRIM(RTRIM(ISNULL(@Remarks, ''))), @LocationId, @UserId);

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
        Remarks = LTRIM(RTRIM(ISNULL(@Remarks, ''))), UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND LocationId = @LocationId;

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Lead saved' AS Message, @LeadId AS Id;
END
GO

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
    WHERE l.CompanyId = @CompanyId
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

/* One lead, with the names of its source, reason, owner and order. No row when the
   lead is not the user's (and the user is not a manager). */
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
           l.CustomerId, l.SalesOrderId, so.OrderNo, l.ConvertedAt, l.ConvertingAt, l.Remarks, l.LocationId,
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

/* Moves a lead in the flow New, Contacted, Qualified, Quotation, Negotiation, or
   marks it Lost (a reason is needed). Converted is reached only through the
   convert. A Lost lead is read-only, except that a manager may reopen it: any
   other status asked for a Lost lead by a manager reopens it to the status it had
   before it was lost. */
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
               CASE WHEN @Status = 'Converted' THEN N'A lead is converted with Convert to Sale' ELSE N'Choose the status from the list' END AS Message,
               CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @Current NVARCHAR(20), @Converting DATETIME2;
    SELECT @Current = Status, @Converting = ConvertingAt FROM crm.Leads WITH (UPDLOCK, HOLDLOCK)
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId;

    IF @Current IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Lead not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @Converting IS NOT NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'This lead is being converted to a sale' AS Message, CAST(0 AS INT) AS Id; RETURN;
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
        WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND SalesOrderId IS NULL AND ConvertingAt IS NULL;

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS BIT) AS Success, N'This lead is being converted to a sale' AS Message, CAST(0 AS INT) AS Id; RETURN;
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

/* A manager gives a lead to another member of the sales team. The API notifies
   the new owner. */
CREATE OR ALTER PROCEDURE crm.sp_Lead_Reassign
    @CompanyId      INT,
    @LeadId         INT,
    @UserId         INT,
    @IsManager      BIT,
    @LocationId INT,
    @NewOwnerUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(@IsManager, 0) = 0
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Only a CRM manager can reassign a lead' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM crm.Members WHERE CompanyId = @CompanyId AND UserId = @NewOwnerUserId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Choose a member of the sales team' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @Current NVARCHAR(20), @OldOwner INT;
    SELECT @Current = Status, @OldOwner = OwnerUserId FROM crm.Leads WITH (UPDLOCK, HOLDLOCK)
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND LocationId = @LocationId;

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

    IF @OldOwner = @NewOwnerUserId
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(1 AS BIT) AS Success, N'No change' AS Message, @LeadId AS Id; RETURN;
    END

    UPDATE crm.Leads
    SET OwnerUserId = @NewOwnerUserId, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId;

    DECLARE @OldName NVARCHAR(150) = ISNULL((SELECT FullName FROM dbo.Users WHERE UserId = @OldOwner), N'?');
    DECLARE @NewName NVARCHAR(150) = ISNULL((SELECT FullName FROM dbo.Users WHERE UserId = @NewOwnerUserId), N'?');

    INSERT INTO crm.LeadStatusHistory (CompanyId, LeadId, FromStatus, ToStatus, ChangedBy, Note)
    VALUES (@CompanyId, @LeadId, @Current, @Current, @UserId, N'Reassigned from ' + @OldName + N' to ' + @NewName);

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Lead reassigned to ' + @NewName AS Message, @LeadId AS Id;
END
GO

/* The status changes and reassignments of a lead, oldest first. */
CREATE OR ALTER PROCEDURE crm.sp_Lead_History
    @CompanyId INT,
    @LeadId    INT,
    @UserId    INT,
    @IsManager BIT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT h.LeadStatusHistoryId, h.FromStatus, h.ToStatus, h.ChangedBy, ISNULL(u.FullName, N'') AS ChangedByName, h.ChangedAt, h.Note
    FROM crm.LeadStatusHistory h
    INNER JOIN crm.Leads l ON l.LeadId = h.LeadId AND l.CompanyId = @CompanyId
    LEFT JOIN dbo.Users u ON u.UserId = h.ChangedBy
    WHERE h.CompanyId = @CompanyId AND h.LeadId = @LeadId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
    ORDER BY h.ChangedAt, h.LeadStatusHistoryId;
END
GO

/* -----------------------------------------------------------------------------
   4. Follow-ups. Adding one copies its next date to the lead (NULL when none)
      and moves a New lead to Contacted.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE crm.sp_FollowUp_Add
    @CompanyId      INT,
    @LeadId         INT,
    @UserId         INT,
    @IsManager      BIT,
    @LocationId INT,
    @FollowUpAt     DATETIME2(0)   = NULL,
    @Type           NVARCHAR(20),
    @Notes          NVARCHAR(2000) = NULL,
    @NextFollowUpAt DATETIME2(0)   = NULL,
    @NextAction     NVARCHAR(500)  = NULL,
    @Remarks        NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Type       = LTRIM(RTRIM(ISNULL(@Type, '')));
    SET @FollowUpAt = ISNULL(@FollowUpAt, DATEADD(MINUTE, 330, GETUTCDATE()));

    IF @Type NOT IN ('Phone Call', 'Meeting', 'Site Visit', 'WhatsApp', 'Email', 'Other')
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Choose the type of follow-up from the list' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @NextFollowUpAt IS NOT NULL AND @NextFollowUpAt < @FollowUpAt
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'The next follow-up cannot be before this one' AS Message, CAST(0 AS INT) AS Id; RETURN;
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

    INSERT INTO crm.FollowUps (CompanyId, LeadId, FollowUpAt, [Type], Notes, NextFollowUpAt, NextAction, UserId, Remarks)
    VALUES (@CompanyId, @LeadId, @FollowUpAt, @Type, LTRIM(RTRIM(ISNULL(@Notes, ''))), @NextFollowUpAt,
            LTRIM(RTRIM(ISNULL(@NextAction, ''))), @UserId, LTRIM(RTRIM(ISNULL(@Remarks, ''))));

    DECLARE @FollowUpId INT = SCOPE_IDENTITY();

    UPDATE crm.Leads
    SET NextFollowUpAt = @NextFollowUpAt,
        Status = CASE WHEN Status = 'New' THEN 'Contacted' ELSE Status END,
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId;

    IF @Current = 'New'
        INSERT INTO crm.LeadStatusHistory (CompanyId, LeadId, FromStatus, ToStatus, ChangedBy, Note)
        VALUES (@CompanyId, @LeadId, 'New', 'Contacted', @UserId, N'First follow-up');

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Follow-up added' AS Message, @FollowUpId AS Id;
END
GO

CREATE OR ALTER PROCEDURE crm.sp_FollowUp_List
    @CompanyId INT,
    @LeadId    INT,
    @UserId    INT,
    @IsManager BIT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT f.FollowUpId, f.LeadId, f.FollowUpAt, f.[Type], f.Notes, f.NextFollowUpAt, f.NextAction,
           f.UserId, ISNULL(u.FullName, N'') AS UserName, f.Remarks, f.CreatedAt
    FROM crm.FollowUps f
    INNER JOIN crm.Leads l ON l.LeadId = f.LeadId AND l.CompanyId = @CompanyId
    LEFT JOIN dbo.Users u ON u.UserId = f.UserId
    WHERE f.CompanyId = @CompanyId AND f.LeadId = @LeadId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
    ORDER BY f.FollowUpAt DESC, f.FollowUpId DESC;
END
GO

/* -----------------------------------------------------------------------------
   5. Quotations. Numbered QT-0001 per company; a revision keeps the number and
      gets RevisionNo + 1. Only a Draft is edited. The API computes the totals
      (as the Sales Order screen does) and sends the lines as JSON, camelCase:
      [{ "productMasterId", "productName", "hsnSac", "qty", "rate",
         "discountAmount", "gstPercent", "warrantyMonths", "taxableAmount",
         "gstAmount", "lineTotal", "sortOrder" }]
   ----------------------------------------------------------------------------- */
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

    DECLARE @LeadStatus NVARCHAR(20), @Converting DATETIME2;
    SELECT @LeadStatus = Status, @Converting = ConvertingAt FROM crm.Leads WITH (UPDLOCK, HOLDLOCK)
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId;

    IF @LeadStatus IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Lead not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @LeadStatus IN ('Converted', 'Lost') OR @Converting IS NOT NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'A converted or lost lead cannot be changed' AS Message, CAST(0 AS INT) AS Id; RETURN;
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
    INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId
    LEFT JOIN dbo.Users u ON u.UserId = q.CreatedBy
    WHERE q.QuotationId = @QuotationId AND q.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId;

    SELECT i.QuotationItemId, i.ProductMasterId, i.ProductName, i.HsnSac, i.Qty, i.Rate, i.DiscountAmount, i.GstPercent,
           i.WarrantyMonths, i.TaxableAmount, i.GstAmount, i.LineTotal, i.SortOrder
    FROM crm.QuotationItems i
    INNER JOIN crm.Quotations q ON q.QuotationId = i.QuotationId AND q.CompanyId = @CompanyId
    INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId
    WHERE i.QuotationId = @QuotationId AND i.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
    ORDER BY i.SortOrder, i.QuotationItemId;
END
GO

/* Every quotation and revision of a lead, newest first. */
CREATE OR ALTER PROCEDURE crm.sp_Quotation_ListForLead
    @CompanyId INT,
    @LeadId    INT,
    @UserId    INT,
    @IsManager BIT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT q.QuotationId, q.LeadId, q.QuotationNo, q.RevisionNo, q.QuoteDate, q.ValidUntil, q.IsInterState,
           q.TaxableTotal, q.GrandTotal, q.Status, q.CreatedAt, q.UpdatedAt,
           CAST(CASE WHEN NOT EXISTS (SELECT 1 FROM crm.Quotations q2
                                      WHERE q2.CompanyId = @CompanyId AND q2.QuotationNo = q.QuotationNo AND q2.RevisionNo > q.RevisionNo)
                     THEN 1 ELSE 0 END AS BIT) AS IsLatest
    FROM crm.Quotations q
    INNER JOIN crm.Leads l ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId
    WHERE q.LeadId = @LeadId AND q.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
    ORDER BY q.QuotationNo DESC, q.RevisionNo DESC;
END
GO

/* Copies the latest revision (Sent or Rejected) to RevisionNo + 1 as a Draft and
   marks the old one Superseded. A Draft is changed directly instead. */
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

    DECLARE @LeadId INT, @QuotationNo NVARCHAR(20), @RevisionNo INT, @Status NVARCHAR(20), @LeadStatus NVARCHAR(20), @Converting DATETIME2;
    SELECT @LeadId = q.LeadId, @QuotationNo = q.QuotationNo, @RevisionNo = q.RevisionNo, @Status = q.Status,
           @LeadStatus = l.Status, @Converting = l.ConvertingAt
    FROM crm.Quotations q WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN crm.Leads l WITH (UPDLOCK, HOLDLOCK) ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId
    WHERE q.QuotationId = @QuotationId AND q.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId;

    IF @LeadId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Quotation not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @LeadStatus IN ('Converted', 'Lost') OR @Converting IS NOT NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'A converted or lost lead cannot be changed' AS Message, CAST(0 AS INT) AS Id; RETURN;
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

/* Marks a quotation Sent (from Draft or Rejected) or Rejected (from Sent).
   Accepted is set by the convert and Superseded by a revision. Sending moves the
   lead to Quotation when it is earlier in the flow. */
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

    DECLARE @LeadId INT, @QuotationNo NVARCHAR(20), @Current NVARCHAR(20), @LeadStatus NVARCHAR(20), @Converting DATETIME2;
    SELECT @LeadId = q.LeadId, @QuotationNo = q.QuotationNo, @Current = q.Status, @LeadStatus = l.Status, @Converting = l.ConvertingAt
    FROM crm.Quotations q WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN crm.Leads l WITH (UPDLOCK, HOLDLOCK) ON l.LeadId = q.LeadId AND l.CompanyId = @CompanyId
    WHERE q.QuotationId = @QuotationId AND q.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId;

    IF @LeadId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Quotation not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @LeadStatus IN ('Converted', 'Lost') OR @Converting IS NOT NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'A converted or lost lead cannot be changed' AS Message, CAST(0 AS INT) AS Id; RETURN;
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

/* -----------------------------------------------------------------------------
   6. Convert to Sale. The API:
        1. sp_Lead_BeginConvert  marks the lead (one UPDATE: only one convert can
                                 win, and never for a lead that has an order)
        2. makes the customer and the order with the existing Sales procedures
        3. sp_Lead_FinishConvert links the order, Converted, quotation Accepted
      or sp_Lead_CancelConvert when step 2 failed (no order was made).
      sp_Lead_LinkOrder lets a manager link an order that exists already (when
      step 3 failed after the order was made).
   ----------------------------------------------------------------------------- */
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
      AND (ConvertingAt IS NULL OR ConvertingAt < DATEADD(MINUTE, -15, SYSUTCDATETIME()))
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
                WHEN l.ConvertingAt >= DATEADD(MINUTE, -15, SYSUTCDATETIME()) THEN N'This lead is being converted to a sale. Try again in a minute'
                ELSE N'Only a lead in Quotation or Negotiation can be converted' END AS Message,
           CAST(0 AS INT) AS Id
    FROM (SELECT 1 AS One) x
    LEFT JOIN crm.Leads l ON l.LeadId = @LeadId AND l.CompanyId = @CompanyId AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId;
END
GO

/* The order is made: the lead is Converted and linked, the quotation Accepted. */
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
        Status = 'Converted', ConvertingAt = NULL, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
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

/* No order was made: the lead may be converted again. */
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
    SET ConvertingAt = NULL
    WHERE LeadId = @LeadId AND CompanyId = @CompanyId AND SalesOrderId IS NULL AND ConvertingAt IS NOT NULL
      AND (@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS BIT) AS Success, N'Nothing to cancel' AS Message, CAST(0 AS INT) AS Id;
    ELSE
        SELECT CAST(1 AS BIT) AS Success, N'Convert cancelled' AS Message, @LeadId AS Id;
END
GO

/* A manager links an order that exists already, found by its number. */
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
        Status = 'Converted', ConvertingAt = NULL, UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
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

/* -----------------------------------------------------------------------------
   7. The product picker of the quotation editor (read only, active products).
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE crm.sp_Product_Search
    @CompanyId INT,
    @Search    NVARCHAR(200) = NULL,
    @Top       INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), '');
    SET @Top    = CASE WHEN ISNULL(@Top, 20) < 1 THEN 20 WHEN @Top > 100 THEN 100 ELSE @Top END;

    SELECT TOP (@Top) p.ProductMasterId, p.ProductCode, p.ProductName, p.Brand, p.Model, p.Category, p.MRP, p.WarrantyMonths
    FROM dbo.ProductMaster p
    WHERE p.IsActive = 1
      AND (@Search IS NULL OR p.ProductName LIKE '%' + @Search + '%' OR p.ProductCode LIKE '%' + @Search + '%'
                           OR p.Brand LIKE '%' + @Search + '%' OR p.Model LIKE '%' + @Search + '%')
    ORDER BY p.ProductName;
END
GO

/* -----------------------------------------------------------------------------
   8. Dashboard and reports, with the same owner rule as the lead list.
   ----------------------------------------------------------------------------- */

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
    WHERE l.CompanyId = @CompanyId
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
    WHERE l.CompanyId = @CompanyId
      AND (@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId
      AND (@OwnerUserId IS NULL OR l.OwnerUserId = @OwnerUserId)
      AND l.Status NOT IN ('Converted', 'Lost')
      AND l.NextFollowUpAt IS NOT NULL AND CAST(l.NextFollowUpAt AS DATE) <= @Today
    ORDER BY l.NextFollowUpAt, l.LeadId;
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
    INNER JOIN crm.Leads l ON l.LeadId = f.LeadId AND l.CompanyId = @CompanyId
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
    WHERE l.CompanyId = @CompanyId
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

PRINT 'CRM: leads, follow-ups and quotations are in place in this company database.';
GO
SET NOEXEC OFF;
GO
