/* =============================================================================
   ProjectDB (company database) · Job Consultancy: candidates the company adds itself
   -----------------------------------------------------------------------------
   A consultancy meets people who are not on Job Portal: walk-ins, referrals, CVs from
   e-mail. It can now keep them as its own candidates. They belong to the company: they
   live in its own database, nobody else sees them, they are never on Job Portal and never
   public.

   Run in EACH company database (select it in SSMS first; no USE on purpose), after
   11_Consultancy.sql. New company databases created by the API get this script
   automatically. ADDITIVE and SAFE TO RE-RUN.

     consult.Candidates   the company's own candidates, with a resume (optional)

   No duplicates: within a company, one candidate per e-mail and one per phone number.
   The API compares them as keys (EmailKey: trimmed, lower case; PhoneKey: the last 10
   digits, so "+91 98470 12345" and "098470-12345" are the same), and unique indexes
   keep it so even when two people save at the same moment.

   Every row carries the CompanyId; every procedure takes @CompanyId first and names it
   in every statement.
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
ELSE IF SCHEMA_ID('consult') IS NULL
    SET @problem = 'Run 11_Consultancy.sql in this company database first.';

IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. The table
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('consult.Candidates') IS NULL
CREATE TABLE consult.Candidates
(
    CandidateId     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_consult_Candidates PRIMARY KEY,
    CompanyId       INT            NOT NULL,
    FullName        NVARCHAR(200)  NOT NULL,
    Headline        NVARCHAR(200)  NOT NULL CONSTRAINT DF_consult_Candidates_Headline DEFAULT (''),
    Email           NVARCHAR(256)  NOT NULL CONSTRAINT DF_consult_Candidates_Email DEFAULT (''),
    EmailKey        NVARCHAR(256)  NOT NULL CONSTRAINT DF_consult_Candidates_EmailKey DEFAULT (''),
    Phone           NVARCHAR(30)   NOT NULL CONSTRAINT DF_consult_Candidates_Phone DEFAULT (''),
    PhoneKey        VARCHAR(15)    NOT NULL CONSTRAINT DF_consult_Candidates_PhoneKey DEFAULT (''),
    City            NVARCHAR(100)  NOT NULL CONSTRAINT DF_consult_Candidates_City DEFAULT (''),
    ExperienceYears DECIMAL(4, 1)  NULL,
    Skills          NVARCHAR(1000) NOT NULL CONSTRAINT DF_consult_Candidates_Skills DEFAULT (''),
    PreferredJobs   NVARCHAR(500)  NOT NULL CONSTRAINT DF_consult_Candidates_PreferredJobs DEFAULT (''),
    Source          NVARCHAR(30)   NOT NULL CONSTRAINT DF_consult_Candidates_Source DEFAULT (''),
    Stage           NVARCHAR(20)   NOT NULL CONSTRAINT DF_consult_Candidates_Stage DEFAULT ('New')
                                   CONSTRAINT CK_consult_Candidates_Stage CHECK (Stage IN ('New', 'Contacted', 'Interview', 'Placed', 'NotSuitable')),
    Notes           NVARCHAR(2000) NOT NULL CONSTRAINT DF_consult_Candidates_Notes DEFAULT (''),
    ResumeName      NVARCHAR(260)  NULL,
    ResumeType      NVARCHAR(100)  NULL,
    ResumeSize      INT            NULL,
    Resume          VARBINARY(MAX) NULL,
    CreatedBy       INT            NOT NULL CONSTRAINT DF_consult_Candidates_CreatedBy DEFAULT (0),
    CreatedAt       DATETIME       NOT NULL CONSTRAINT DF_consult_Candidates_CreatedAt DEFAULT (GETDATE()),
    UpdatedAt       DATETIME       NOT NULL CONSTRAINT DF_consult_Candidates_UpdatedAt DEFAULT (GETDATE()),
    /* a candidate can be reached: an e-mail or a phone */
    CONSTRAINT CK_consult_Candidates_Contact CHECK (EmailKey <> '' OR PhoneKey <> '')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_consult_Candidates_Company' AND object_id = OBJECT_ID('consult.Candidates'))
    CREATE INDEX IX_consult_Candidates_Company ON consult.Candidates(CompanyId, UpdatedAt DESC);
GO
/* no duplicates within a company: one per e-mail, one per phone */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_consult_Candidates_Email' AND object_id = OBJECT_ID('consult.Candidates'))
    CREATE UNIQUE INDEX UQ_consult_Candidates_Email ON consult.Candidates(CompanyId, EmailKey) WHERE EmailKey <> '';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_consult_Candidates_Phone' AND object_id = OBJECT_ID('consult.Candidates'))
    CREATE UNIQUE INDEX UQ_consult_Candidates_Phone ON consult.Candidates(CompanyId, PhoneKey) WHERE PhoneKey <> '';
GO

/* -----------------------------------------------------------------------------
   2. Procedures
   ----------------------------------------------------------------------------- */

/* The company's candidates, the latest change first; every word of @Query must be found
   in the name, headline, e-mail, phone, city, skills, the jobs they look for or the notes. */
CREATE OR ALTER PROCEDURE consult.sp_OwnCandidate_List
    @CompanyId INT,
    @Query     NVARCHAR(100) = NULL,
    @Page      INT           = 1,
    @PageSize  INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    SET @Query    = LTRIM(RTRIM(ISNULL(@Query, '')));
    SET @Page     = CASE WHEN ISNULL(@Page, 1) < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN ISNULL(@PageSize, 20) < 1 THEN 20 WHEN @PageSize > 50 THEN 50 ELSE @PageSize END;

    DECLARE @Words TABLE (Pat NVARCHAR(110) PRIMARY KEY);
    INSERT INTO @Words (Pat)
    SELECT DISTINCT TOP (10) '%' + REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(s.value)), '[', '[[]'), '%', '[%]'), '_', '[_]') + '%'
    FROM STRING_SPLIT(REPLACE(@Query, ',', ' '), ' ') s
    WHERE LTRIM(RTRIM(s.value)) <> '';

    SELECT c.CandidateId, c.FullName, c.Headline, c.Email, c.Phone, c.City, c.ExperienceYears, c.Skills, c.PreferredJobs,
           c.Source, c.Stage, c.Notes, ISNULL(c.ResumeName, '') AS ResumeName,
           CAST(CASE WHEN c.Resume IS NULL THEN 0 ELSE 1 END AS BIT) AS HasResume,
           c.CreatedAt, c.UpdatedAt,
           COUNT(*) OVER () AS TotalCount
    FROM consult.Candidates c
    WHERE c.CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0
      AND NOT EXISTS (SELECT 1 FROM @Words w
                      WHERE NOT (c.FullName LIKE w.Pat OR c.Headline LIKE w.Pat OR c.Email LIKE w.Pat OR c.Phone LIKE w.Pat
                                 OR c.City LIKE w.Pat OR c.Skills LIKE w.Pat OR c.PreferredJobs LIKE w.Pat OR c.Notes LIKE w.Pat))
    ORDER BY c.UpdatedAt DESC, c.CandidateId DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* Who of the company's candidates already has this e-mail or phone (another than @CandidateId):
   the form warns before saving. */
CREATE OR ALTER PROCEDURE consult.sp_OwnCandidate_Duplicates
    @CompanyId   INT,
    @CandidateId INT = NULL,
    @EmailKey    NVARCHAR(256) = NULL,
    @PhoneKey    VARCHAR(15)   = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @EmailKey = ISNULL(@EmailKey, '');
    SET @PhoneKey = ISNULL(@PhoneKey, '');

    SELECT TOP (5) c.CandidateId, c.FullName, c.Email, c.Phone,
           CASE WHEN @EmailKey <> '' AND c.EmailKey = @EmailKey THEN 'Email' ELSE 'Phone' END AS SameAs
    FROM consult.Candidates c
    WHERE c.CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0
      AND c.CandidateId <> ISNULL(@CandidateId, 0)
      AND ((@EmailKey <> '' AND c.EmailKey = @EmailKey) OR (@PhoneKey <> '' AND c.PhoneKey = @PhoneKey))
    ORDER BY c.UpdatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_OwnCandidate_Save
    @CompanyId       INT,
    @CandidateId     INT,
    @FullName        NVARCHAR(200),
    @Headline        NVARCHAR(200)  = NULL,
    @Email           NVARCHAR(256)  = NULL,
    @EmailKey        NVARCHAR(256)  = NULL,
    @Phone           NVARCHAR(30)   = NULL,
    @PhoneKey        VARCHAR(15)    = NULL,
    @City            NVARCHAR(100)  = NULL,
    @ExperienceYears DECIMAL(4, 1)  = NULL,
    @Skills          NVARCHAR(1000) = NULL,
    @PreferredJobs   NVARCHAR(500)  = NULL,
    @Source          NVARCHAR(30)   = NULL,
    @Stage           NVARCHAR(20)   = NULL,
    @Notes           NVARCHAR(2000) = NULL,
    @UserId          INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @FullName    = LTRIM(RTRIM(ISNULL(@FullName, '')));
    SET @EmailKey    = ISNULL(@EmailKey, '');
    SET @PhoneKey    = ISNULL(@PhoneKey, '');
    SET @CandidateId = ISNULL(@CandidateId, 0);
    SET @Stage       = CASE WHEN @Stage IN ('New', 'Contacted', 'Interview', 'Placed', 'NotSuitable') THEN @Stage ELSE 'New' END;

    IF ISNULL(@CompanyId, 0) = 0 OR @FullName = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Enter the name of the candidate' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END
    IF @EmailKey = '' AND @PhoneKey = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Enter an e-mail or a phone number' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @Same NVARCHAR(200), @SameAs NVARCHAR(10);
    SELECT TOP (1) @Same = c.FullName,
                   @SameAs = CASE WHEN @EmailKey <> '' AND c.EmailKey = @EmailKey THEN 'e-mail' ELSE 'phone number' END
    FROM consult.Candidates c WITH (UPDLOCK, HOLDLOCK)
    WHERE c.CompanyId = @CompanyId AND c.CandidateId <> @CandidateId
      AND ((@EmailKey <> '' AND c.EmailKey = @EmailKey) OR (@PhoneKey <> '' AND c.PhoneKey = @PhoneKey));

    IF @Same IS NOT NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'You already have this candidate: ' + @Same + ' has the same ' + @SameAs AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @CandidateId = 0
    BEGIN
        IF (SELECT COUNT(*) FROM consult.Candidates WHERE CompanyId = @CompanyId) >= 50000
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'You have 50,000 candidates. Remove ones you no longer need first' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        INSERT INTO consult.Candidates (CompanyId, FullName, Headline, Email, EmailKey, Phone, PhoneKey, City, ExperienceYears,
                                        Skills, PreferredJobs, Source, Stage, Notes, CreatedBy)
        VALUES (@CompanyId, @FullName, ISNULL(@Headline, ''), ISNULL(@Email, ''), @EmailKey, ISNULL(@Phone, ''), @PhoneKey,
                ISNULL(@City, ''), @ExperienceYears, ISNULL(@Skills, ''), ISNULL(@PreferredJobs, ''), ISNULL(@Source, ''),
                @Stage, ISNULL(@Notes, ''), ISNULL(@UserId, 0));

        DECLARE @NewId INT = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
        SELECT CAST(1 AS INT) AS Success, 'Candidate added' AS Message, @NewId AS Id; RETURN;
    END

    UPDATE consult.Candidates
    SET FullName = @FullName, Headline = ISNULL(@Headline, ''), Email = ISNULL(@Email, ''), EmailKey = @EmailKey,
        Phone = ISNULL(@Phone, ''), PhoneKey = @PhoneKey, City = ISNULL(@City, ''), ExperienceYears = @ExperienceYears,
        Skills = ISNULL(@Skills, ''), PreferredJobs = ISNULL(@PreferredJobs, ''), Source = ISNULL(@Source, ''),
        Stage = @Stage, Notes = ISNULL(@Notes, ''), UpdatedAt = GETDATE()
    WHERE CandidateId = @CandidateId AND CompanyId = @CompanyId;

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS INT) AS Success, 'Candidate saved' AS Message, @CandidateId AS Id;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_OwnCandidate_Delete
    @CompanyId   INT,
    @CandidateId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM consult.Candidates WHERE CandidateId = @CandidateId AND CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0;

    IF @@ROWCOUNT = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    SELECT CAST(1 AS INT) AS Success, 'Candidate removed' AS Message;
END
GO

/* The resume of a candidate: a new one replaces the old one; no content = removed. */
CREATE OR ALTER PROCEDURE consult.sp_OwnCandidate_Resume_Save
    @CompanyId   INT,
    @CandidateId INT,
    @FileName    NVARCHAR(260)  = NULL,
    @ContentType NVARCHAR(100)  = NULL,
    @SizeBytes   INT            = NULL,
    @Content     VARBINARY(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE consult.Candidates
    SET ResumeName = CASE WHEN @Content IS NULL THEN NULL ELSE @FileName END,
        ResumeType = CASE WHEN @Content IS NULL THEN NULL ELSE @ContentType END,
        ResumeSize = CASE WHEN @Content IS NULL THEN NULL ELSE @SizeBytes END,
        Resume     = @Content,
        UpdatedAt  = GETDATE()
    WHERE CandidateId = @CandidateId AND CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0;

    IF @@ROWCOUNT = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    SELECT CAST(1 AS INT) AS Success, CASE WHEN @Content IS NULL THEN 'Resume removed' ELSE 'Resume saved' END AS Message, @CandidateId AS Id;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_OwnCandidate_Resume_Get
    @CompanyId   INT,
    @CandidateId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.ResumeName AS FileName, c.ResumeType AS ContentType, c.Resume AS Content
    FROM consult.Candidates c
    WHERE c.CandidateId = @CandidateId AND c.CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0 AND c.Resume IS NOT NULL;
END
GO

PRINT 'Job Consultancy: the company''s own candidates are in place.';
GO
SET NOEXEC OFF;
GO
