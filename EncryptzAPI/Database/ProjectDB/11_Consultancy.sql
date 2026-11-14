/* =============================================================================
   ProjectDB (company database) · Job Consultancy: clients, candidate pool, placements
   -----------------------------------------------------------------------------
   Job Consultancy is a commercial application: what a company keeps about its
   clients, the candidates it works with and its placements is the company's own
   data and lives in the company's own database. (The Personal DB keeps only the
   data of free applications: the Job Portal profiles, job postings and
   applications that people use.)

   Run in EACH company database (select it in SSMS first; no USE on purpose).
   New company databases created by the API get this script automatically.
   ADDITIVE and SAFE TO RE-RUN: it adds the schema consult with four tables and
   its procedures, and changes no existing table, procedure or row.

     consult.Clients          the companies the consultancy recruits for
     consult.PostingClients   which job (Personal DB jobs.Postings.PostingId) is for
                              which client; never shown to people
     consult.Talent           the candidates the company works with, stage and note
     consult.Placements       who was placed where, the fee and the guarantee

   A candidate is named by the CandidateKey of their Job Portal profile (a random
   key); this database never holds a user id of the Personal DB. Every row carries
   the CompanyId and every procedure takes @CompanyId first and names it in every
   statement, so the database may be shared by companies.
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

IF SCHEMA_ID('consult') IS NULL EXEC('CREATE SCHEMA consult');
GO

/* -----------------------------------------------------------------------------
   1. Tables
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('consult.Clients') IS NULL
CREATE TABLE consult.Clients
(
    ClientId      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_consult_Clients PRIMARY KEY,
    CompanyId     INT            NOT NULL,
    Name          NVARCHAR(200)  NOT NULL,
    ContactPerson NVARCHAR(200)  NOT NULL CONSTRAINT DF_consult_Clients_Contact DEFAULT (''),
    Phone         NVARCHAR(30)   NOT NULL CONSTRAINT DF_consult_Clients_Phone DEFAULT (''),
    Email         NVARCHAR(256)  NOT NULL CONSTRAINT DF_consult_Clients_Email DEFAULT (''),
    City          NVARCHAR(100)  NOT NULL CONSTRAINT DF_consult_Clients_City DEFAULT (''),
    Industry      NVARCHAR(100)  NOT NULL CONSTRAINT DF_consult_Clients_Industry DEFAULT (''),
    Notes         NVARCHAR(2000) NOT NULL CONSTRAINT DF_consult_Clients_Notes DEFAULT (''),
    IsActive      BIT            NOT NULL CONSTRAINT DF_consult_Clients_IsActive DEFAULT (1),
    CreatedAt     DATETIME       NOT NULL CONSTRAINT DF_consult_Clients_CreatedAt DEFAULT (GETDATE()),
    UpdatedAt     DATETIME       NOT NULL CONSTRAINT DF_consult_Clients_UpdatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_consult_Clients_Company' AND object_id = OBJECT_ID('consult.Clients'))
    CREATE INDEX IX_consult_Clients_Company ON consult.Clients(CompanyId, Name);
GO

IF OBJECT_ID('consult.PostingClients') IS NULL
CREATE TABLE consult.PostingClients
(
    CompanyId INT      NOT NULL,
    PostingId INT      NOT NULL,   -- Personal DB jobs.Postings.PostingId (another database: no foreign key)
    ClientId  INT      NOT NULL CONSTRAINT FK_consult_PostingClients_Clients REFERENCES consult.Clients(ClientId),
    LinkedAt  DATETIME NOT NULL CONSTRAINT DF_consult_PostingClients_LinkedAt DEFAULT (GETDATE()),
    CONSTRAINT PK_consult_PostingClients PRIMARY KEY (CompanyId, PostingId)
);
GO

IF OBJECT_ID('consult.Talent') IS NULL
CREATE TABLE consult.Talent
(
    TalentId     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_consult_Talent PRIMARY KEY,
    CompanyId    INT              NOT NULL,
    CandidateKey UNIQUEIDENTIFIER NOT NULL,   -- Personal DB jobs.Profiles.CandidateKey
    Stage        NVARCHAR(20)     NOT NULL CONSTRAINT DF_consult_Talent_Stage DEFAULT ('New')
                                           CONSTRAINT CK_consult_Talent_Stage CHECK (Stage IN ('New', 'Contacted', 'Interview', 'Placed', 'NotSuitable')),
    Note         NVARCHAR(1000)   NOT NULL CONSTRAINT DF_consult_Talent_Note DEFAULT (''),
    AddedBy      INT              NOT NULL,   -- MainDB user id
    AddedAt      DATETIME         NOT NULL CONSTRAINT DF_consult_Talent_AddedAt DEFAULT (GETDATE()),
    UpdatedAt    DATETIME         NOT NULL CONSTRAINT DF_consult_Talent_UpdatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_consult_Talent_Company_Candidate UNIQUE (CompanyId, CandidateKey)
);
GO

IF OBJECT_ID('consult.Placements') IS NULL
CREATE TABLE consult.Placements
(
    PlacementId    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_consult_Placements PRIMARY KEY,
    CompanyId      INT              NOT NULL,
    ClientId       INT              NULL CONSTRAINT FK_consult_Placements_Clients REFERENCES consult.Clients(ClientId),
    PostingId      INT              NULL,   -- Personal DB jobs.Postings.PostingId
    CandidateKey   UNIQUEIDENTIFIER NULL,   -- when the candidate is on Job Portal
    CandidateName  NVARCHAR(200)    NOT NULL,
    JobTitle       NVARCHAR(200)    NOT NULL,
    JoinDate       DATE             NOT NULL,
    AnnualCtc      INT              NULL,
    FeeAmount      INT              NULL,
    FeeStatus      NVARCHAR(10)     NOT NULL CONSTRAINT DF_consult_Placements_FeeStatus DEFAULT ('Pending')
                                             CONSTRAINT CK_consult_Placements_FeeStatus CHECK (FeeStatus IN ('Pending', 'Invoiced', 'Paid')),
    GuaranteeUntil DATE             NULL,
    Notes          NVARCHAR(1000)   NOT NULL CONSTRAINT DF_consult_Placements_Notes DEFAULT (''),
    CreatedBy      INT              NOT NULL,
    CreatedAt      DATETIME         NOT NULL CONSTRAINT DF_consult_Placements_CreatedAt DEFAULT (GETDATE()),
    UpdatedAt      DATETIME         NOT NULL CONSTRAINT DF_consult_Placements_UpdatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_consult_Placements_Company' AND object_id = OBJECT_ID('consult.Placements'))
    CREATE INDEX IX_consult_Placements_Company ON consult.Placements(CompanyId, JoinDate DESC);
GO

/* -----------------------------------------------------------------------------
   2. Clients
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE consult.sp_Client_List
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.ClientId, c.Name, c.ContactPerson, c.Phone, c.Email, c.City, c.Industry, c.Notes, c.IsActive, c.CreatedAt,
           (SELECT COUNT(*) FROM consult.Placements pl WHERE pl.ClientId = c.ClientId AND pl.CompanyId = @CompanyId) AS Placements
    FROM consult.Clients c
    WHERE c.CompanyId = @CompanyId
    ORDER BY c.IsActive DESC, c.Name;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_Client_Save
    @CompanyId     INT,
    @ClientId      INT,
    @Name          NVARCHAR(200),
    @ContactPerson NVARCHAR(200)  = NULL,
    @Phone         NVARCHAR(30)   = NULL,
    @Email         NVARCHAR(256)  = NULL,
    @City          NVARCHAR(100)  = NULL,
    @Industry      NVARCHAR(100)  = NULL,
    @Notes         NVARCHAR(2000) = NULL,
    @IsActive      BIT            = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Name = LTRIM(RTRIM(ISNULL(@Name, '')));

    IF ISNULL(@CompanyId, 0) = 0 OR @Name = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Enter the name of the client' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM consult.Clients WITH (UPDLOCK, HOLDLOCK)
               WHERE CompanyId = @CompanyId AND Name = @Name AND ClientId <> ISNULL(@ClientId, 0))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'You already have a client of this name' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF ISNULL(@ClientId, 0) = 0
    BEGIN
        IF (SELECT COUNT(*) FROM consult.Clients WHERE CompanyId = @CompanyId) >= 1000
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'You have 1000 clients. Remove one you no longer need first' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        INSERT INTO consult.Clients (CompanyId, Name, ContactPerson, Phone, Email, City, Industry, Notes, IsActive)
        VALUES (@CompanyId, @Name, ISNULL(@ContactPerson, ''), ISNULL(@Phone, ''), ISNULL(@Email, ''), ISNULL(@City, ''),
                ISNULL(@Industry, ''), ISNULL(@Notes, ''), ISNULL(@IsActive, 1));

        DECLARE @NewId INT = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
        SELECT CAST(1 AS INT) AS Success, 'Client added' AS Message, @NewId AS Id; RETURN;
    END

    UPDATE consult.Clients
    SET Name = @Name, ContactPerson = ISNULL(@ContactPerson, ''), Phone = ISNULL(@Phone, ''), Email = ISNULL(@Email, ''),
        City = ISNULL(@City, ''), Industry = ISNULL(@Industry, ''), Notes = ISNULL(@Notes, ''), IsActive = ISNULL(@IsActive, 1),
        UpdatedAt = GETDATE()
    WHERE ClientId = @ClientId AND CompanyId = @CompanyId;

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS INT) AS Success, 'Client saved' AS Message, @ClientId AS Id;
END
GO

/* A client with placements stays (mark it inactive); its jobs lose the link. */
CREATE OR ALTER PROCEDURE consult.sp_Client_Delete
    @CompanyId INT,
    @ClientId  INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM consult.Clients WHERE ClientId = @ClientId AND CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    IF EXISTS (SELECT 1 FROM consult.Placements WHERE ClientId = @ClientId AND CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'A client with placements cannot be removed. Mark it inactive instead' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    DELETE FROM consult.PostingClients WHERE ClientId = @ClientId AND CompanyId = @CompanyId;
    DELETE FROM consult.Clients WHERE ClientId = @ClientId AND CompanyId = @CompanyId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Client removed' AS Message;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_PostingClient_List
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT pc.PostingId, c.ClientId, c.Name AS ClientName
    FROM consult.PostingClients pc
    INNER JOIN consult.Clients c ON c.ClientId = pc.ClientId AND c.CompanyId = @CompanyId
    WHERE pc.CompanyId = @CompanyId;
END
GO

/* The API has made sure the job is one of the company's. No client (NULL or 0) removes the link. */
CREATE OR ALTER PROCEDURE consult.sp_PostingClient_Set
    @CompanyId INT,
    @PostingId INT,
    @ClientId  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @ClientId = NULLIF(@ClientId, 0);

    IF @ClientId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM consult.Clients WHERE ClientId = @ClientId AND CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    DELETE FROM consult.PostingClients WHERE PostingId = @PostingId AND CompanyId = @CompanyId;

    IF @ClientId IS NOT NULL
        INSERT INTO consult.PostingClients (CompanyId, PostingId, ClientId) VALUES (@CompanyId, @PostingId, @ClientId);

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Client of the job saved' AS Message;
END
GO

/* -----------------------------------------------------------------------------
   3. Candidate pool. The API checks in the Personal DB that a candidate can be
      found before it is added; the pool is shown only for candidates that can
      still be found.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE consult.sp_Talent_List
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT t.CandidateKey, t.Stage, t.Note, t.UpdatedAt
    FROM consult.Talent t
    WHERE t.CompanyId = @CompanyId
    ORDER BY t.UpdatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_Talent_Save
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER,
    @Stage        NVARCHAR(20)   = NULL,
    @Note         NVARCHAR(1000) = NULL,
    @UserId       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Stage = ISNULL(NULLIF(LTRIM(RTRIM(@Stage)), ''), 'New');
    IF ISNULL(@CompanyId, 0) = 0 OR @CandidateKey IS NULL OR @Stage NOT IN ('New', 'Contacted', 'Interview', 'Placed', 'NotSuitable')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose the stage from the list' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    UPDATE consult.Talent
    SET Stage = @Stage, Note = LTRIM(RTRIM(ISNULL(@Note, ''))), UpdatedAt = GETDATE()
    WHERE CompanyId = @CompanyId AND CandidateKey = @CandidateKey;

    IF @@ROWCOUNT = 0
    BEGIN
        IF (SELECT COUNT(*) FROM consult.Talent WITH (UPDLOCK, HOLDLOCK) WHERE CompanyId = @CompanyId) >= 5000
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'Your pool has 5000 candidates. Remove some first' AS Message; RETURN;
        END

        INSERT INTO consult.Talent (CompanyId, CandidateKey, Stage, Note, AddedBy)
        VALUES (@CompanyId, @CandidateKey, @Stage, LTRIM(RTRIM(ISNULL(@Note, ''))), ISNULL(@UserId, 0));

        COMMIT TRANSACTION;
        SELECT CAST(1 AS INT) AS Success, 'Added to your candidates' AS Message; RETURN;
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS INT) AS Success, 'Candidate saved' AS Message;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_Talent_Remove
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM consult.Talent WHERE CompanyId = @CompanyId AND CandidateKey = @CandidateKey;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Removed from your candidates' AS Message;
END
GO

/* -----------------------------------------------------------------------------
   4. Placements. The API resolves the candidate (a key that can be found, or an
      applicant of one of the company's jobs) and checks the job before it saves.
      Two result sets for the list: the placements, then the figures.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE consult.sp_Placement_List
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT pl.PlacementId, pl.ClientId, ISNULL(c.Name, '') AS ClientName, pl.PostingId, pl.CandidateKey, pl.CandidateName, pl.JobTitle,
           pl.JoinDate, pl.AnnualCtc, pl.FeeAmount, pl.FeeStatus, pl.GuaranteeUntil, pl.Notes, pl.CreatedAt
    FROM consult.Placements pl
    LEFT JOIN consult.Clients c ON c.ClientId = pl.ClientId AND c.CompanyId = @CompanyId
    WHERE pl.CompanyId = @CompanyId
    ORDER BY pl.JoinDate DESC, pl.PlacementId DESC;

    SELECT
        (SELECT COUNT(*) FROM consult.Placements WHERE CompanyId = @CompanyId
           AND YEAR(JoinDate) = YEAR(GETDATE()) AND MONTH(JoinDate) = MONTH(GETDATE())) AS ThisMonth,
        (SELECT COUNT(*) FROM consult.Placements WHERE CompanyId = @CompanyId) AS Total,
        (SELECT ISNULL(SUM(CAST(FeeAmount AS BIGINT)), 0) FROM consult.Placements WHERE CompanyId = @CompanyId AND FeeStatus <> 'Paid') AS FeeOutstanding,
        (SELECT ISNULL(SUM(CAST(FeeAmount AS BIGINT)), 0) FROM consult.Placements WHERE CompanyId = @CompanyId AND FeeStatus = 'Paid'
           AND YEAR(JoinDate) = YEAR(GETDATE())) AS FeePaidThisYear;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_Placement_Save
    @CompanyId      INT,
    @PlacementId    INT,
    @UserId         INT,
    @CandidateKey   UNIQUEIDENTIFIER = NULL,
    @CandidateName  NVARCHAR(200),
    @ClientId       INT              = NULL,
    @PostingId      INT              = NULL,
    @JobTitle       NVARCHAR(200),
    @JoinDate       DATE,
    @AnnualCtc      INT              = NULL,
    @FeeAmount      INT              = NULL,
    @FeeStatus      NVARCHAR(10)     = 'Pending',
    @GuaranteeUntil DATE             = NULL,
    @Notes          NVARCHAR(1000)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @CandidateName = LTRIM(RTRIM(ISNULL(@CandidateName, '')));
    SET @JobTitle      = LTRIM(RTRIM(ISNULL(@JobTitle, '')));
    SET @ClientId      = NULLIF(@ClientId, 0);
    SET @PostingId     = NULLIF(@PostingId, 0);

    IF ISNULL(@CompanyId, 0) = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @ClientId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM consult.Clients WHERE ClientId = @ClientId AND CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @CandidateName = '' OR @JobTitle = '' OR @JoinDate IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Enter the candidate, the job and the joining date' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF ISNULL(@FeeStatus, '') NOT IN ('Pending', 'Invoiced', 'Paid')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose the state of the fee from the list' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    IF ISNULL(@PlacementId, 0) = 0
    BEGIN
        INSERT INTO consult.Placements (CompanyId, ClientId, PostingId, CandidateKey, CandidateName, JobTitle, JoinDate, AnnualCtc,
                                        FeeAmount, FeeStatus, GuaranteeUntil, Notes, CreatedBy)
        VALUES (@CompanyId, @ClientId, @PostingId, @CandidateKey, @CandidateName, @JobTitle, @JoinDate, @AnnualCtc,
                @FeeAmount, @FeeStatus, @GuaranteeUntil, LTRIM(RTRIM(ISNULL(@Notes, ''))), ISNULL(@UserId, 0));
        SET @PlacementId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE consult.Placements
        SET ClientId = @ClientId, PostingId = @PostingId, CandidateKey = ISNULL(@CandidateKey, CandidateKey), CandidateName = @CandidateName,
            JobTitle = @JobTitle, JoinDate = @JoinDate, AnnualCtc = @AnnualCtc, FeeAmount = @FeeAmount, FeeStatus = @FeeStatus,
            GuaranteeUntil = @GuaranteeUntil, Notes = LTRIM(RTRIM(ISNULL(@Notes, ''))), UpdatedAt = GETDATE()
        WHERE PlacementId = @PlacementId AND CompanyId = @CompanyId;

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END
    END

    /* the candidate in the pool of this company is placed now */
    IF @CandidateKey IS NOT NULL
        UPDATE consult.Talent SET Stage = 'Placed', UpdatedAt = GETDATE()
        WHERE CompanyId = @CompanyId AND CandidateKey = @CandidateKey;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Placement saved' AS Message, @PlacementId AS Id;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_Placement_Delete
    @CompanyId   INT,
    @PlacementId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM consult.Placements WHERE PlacementId = @PlacementId AND CompanyId = @CompanyId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Placement removed' AS Message;
END
GO

PRINT 'Job Consultancy: clients, candidate pool and placements are in place in this company database.';
GO
SET NOEXEC OFF;
GO
