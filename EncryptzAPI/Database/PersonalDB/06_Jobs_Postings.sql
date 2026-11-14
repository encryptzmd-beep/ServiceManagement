/* =============================================================================
   PersonalDB · 06 · Job Portal: job postings and applications
   -----------------------------------------------------------------------------
   Run AFTER 02_Jobs_Profile.sql, in the Personal DB. SAFE TO RE-RUN.
   It changes no table and no procedure of the scripts 02 to 05, and running
   script 02 again does not undo anything of this script.

     jobs.Postings        a job a company offers (Draft, Open, Closed)
     jobs.Applications    a person applied to a posting; one row per person and posting
     jobs.SavedPostings   postings a person keeps for later
     jobs.ProfileViews    a user of a company opened the profile or the resume of
                          an applicant

   Two kinds of procedure, and the rule of schema jobs holds for both:

     for a PERSON   (@UserId first)     every statement on jobs.Applications and
                                        jobs.SavedPostings names @UserId. Postings
                                        are read by everybody, but only open ones
                                        (or one the person applied to).
     for a COMPANY  (@CompanyId first)  every statement on jobs.Postings names
                                        @CompanyId, and an applicant is reached
                                        only through a posting of that company and
                                        an application that is not withdrawn.
                                        Anything else is "Not found".

   The caller (the API) has already made sure that @UserId is the person who is
   logged in and that they may act for @CompanyId.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL OR OBJECT_ID('jobs.Profiles') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 02_Jobs_Profile.sql in it before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
BEGIN
    RAISERROR('This database is not marked as the Personal DB. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

/* =============================================================================
   Tables
   ============================================================================= */
IF OBJECT_ID('jobs.Postings') IS NULL
CREATE TABLE jobs.Postings
(
    PostingId          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Postings PRIMARY KEY,
    CompanyId          INT            NOT NULL,   -- main database CompanyId (no foreign key: another database)
    CompanyName        NVARCHAR(200)  NOT NULL,   -- as it was when the posting was last saved
    Title              NVARCHAR(200)  NOT NULL,
    City               NVARCHAR(100)  NOT NULL,
    EmploymentType     NVARCHAR(20)   NOT NULL CONSTRAINT CK_jobs_Postings_Type CHECK (EmploymentType IN ('Full-time', 'Part-time', 'Contract', 'Internship')),
    WorkMode           NVARCHAR(20)   NOT NULL CONSTRAINT CK_jobs_Postings_Mode CHECK (WorkMode IN ('On-site', 'Remote', 'Hybrid')),
    ExperienceMinYears TINYINT        NULL,
    ExperienceMaxYears TINYINT        NULL,
    SalaryMin          INT            NULL,       -- per month
    SalaryMax          INT            NULL,
    Skills             NVARCHAR(400)  NOT NULL CONSTRAINT DF_jobs_Postings_Skills DEFAULT (''),
    Description        NVARCHAR(4000) NOT NULL,
    Status             NVARCHAR(10)   NOT NULL CONSTRAINT DF_jobs_Postings_Status DEFAULT ('Draft')
                                               CONSTRAINT CK_jobs_Postings_Status CHECK (Status IN ('Draft', 'Open', 'Closed')),
    ClosesOn           DATE           NULL,
    PostedBy           INT            NOT NULL,   -- main database UserId
    PublishedAt        DATETIME       NULL,
    CreatedAt          DATETIME       NOT NULL CONSTRAINT DF_jobs_Postings_CreatedAt DEFAULT (GETDATE()),
    UpdatedAt          DATETIME       NOT NULL CONSTRAINT DF_jobs_Postings_UpdatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Postings_Company' AND object_id = OBJECT_ID('jobs.Postings'))
    CREATE INDEX IX_jobs_Postings_Company ON jobs.Postings(CompanyId, Status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Postings_Open' AND object_id = OBJECT_ID('jobs.Postings'))
    CREATE INDEX IX_jobs_Postings_Open ON jobs.Postings(Status, PublishedAt DESC);
GO

IF OBJECT_ID('jobs.Applications') IS NULL
CREATE TABLE jobs.Applications
(
    ApplicationId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Applications PRIMARY KEY,
    PostingId     INT            NOT NULL CONSTRAINT FK_jobs_Applications_Postings REFERENCES jobs.Postings(PostingId),
    UserId        INT            NOT NULL,
    Note          NVARCHAR(1000) NOT NULL CONSTRAINT DF_jobs_Applications_Note DEFAULT (''),
    Status        NVARCHAR(12)   NOT NULL CONSTRAINT DF_jobs_Applications_Status DEFAULT ('Applied')
                                          CONSTRAINT CK_jobs_Applications_Status CHECK (Status IN ('Applied', 'Shortlisted', 'Rejected', 'Hired', 'Withdrawn')),
    AppliedAt     DATETIME       NOT NULL CONSTRAINT DF_jobs_Applications_AppliedAt DEFAULT (GETDATE()),
    StatusAt      DATETIME       NOT NULL CONSTRAINT DF_jobs_Applications_StatusAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_jobs_Applications_Posting_User UNIQUE (PostingId, UserId)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Applications_User' AND object_id = OBJECT_ID('jobs.Applications'))
    CREATE INDEX IX_jobs_Applications_User ON jobs.Applications(UserId, Status);
GO

IF OBJECT_ID('jobs.SavedPostings') IS NULL
CREATE TABLE jobs.SavedPostings
(
    UserId    INT      NOT NULL,
    PostingId INT      NOT NULL CONSTRAINT FK_jobs_SavedPostings_Postings REFERENCES jobs.Postings(PostingId),
    SavedAt   DATETIME NOT NULL CONSTRAINT DF_jobs_SavedPostings_SavedAt DEFAULT (GETDATE()),
    CONSTRAINT PK_jobs_SavedPostings PRIMARY KEY (UserId, PostingId)
);
GO

IF OBJECT_ID('jobs.ProfileViews') IS NULL
CREATE TABLE jobs.ProfileViews
(
    ViewId       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_ProfileViews PRIMARY KEY,
    CompanyId    INT          NOT NULL,
    ViewerUserId INT          NOT NULL,   -- the user of the company who looked
    UserId       INT          NOT NULL,   -- the person who was looked at
    PostingId    INT          NOT NULL,
    What         NVARCHAR(10) NOT NULL CONSTRAINT CK_jobs_ProfileViews_What CHECK (What IN ('Profile', 'Resume')),
    ViewedAt     DATETIME     NOT NULL CONSTRAINT DF_jobs_ProfileViews_ViewedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_ProfileViews_User' AND object_id = OBJECT_ID('jobs.ProfileViews'))
    CREATE INDEX IX_jobs_ProfileViews_User ON jobs.ProfileViews(UserId, ViewedAt DESC);
GO

/* =============================================================================
   PERSON · search. Open postings that are not past their closing date, newest
   first, one page. Each row says whether this person saved it or applied.
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Posting_Search
    @UserId         INT,
    @Query          NVARCHAR(100) = NULL,
    @City           NVARCHAR(100) = NULL,
    @EmploymentType NVARCHAR(20)  = NULL,
    @WorkMode       NVARCHAR(20)  = NULL,
    @Page           INT           = 1,
    @PageSize       INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    SET @Query          = LTRIM(RTRIM(ISNULL(@Query, '')));
    SET @City           = LTRIM(RTRIM(ISNULL(@City, '')));
    SET @EmploymentType = LTRIM(RTRIM(ISNULL(@EmploymentType, '')));
    SET @WorkMode       = LTRIM(RTRIM(ISNULL(@WorkMode, '')));
    SET @Page           = CASE WHEN ISNULL(@Page, 1) < 1 THEN 1 ELSE @Page END;
    SET @PageSize       = CASE WHEN ISNULL(@PageSize, 20) < 1 THEN 20 WHEN @PageSize > 50 THEN 50 ELSE @PageSize END;

    -- the wildcard characters of LIKE are taken literally
    SET @Query = REPLACE(REPLACE(REPLACE(@Query, '[', '[[]'), '%', '[%]'), '_', '[_]');
    SET @City  = REPLACE(REPLACE(REPLACE(@City,  '[', '[[]'), '%', '[%]'), '_', '[_]');

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT p.PostingId, p.Title, p.CompanyName, p.City, p.EmploymentType, p.WorkMode,
           p.ExperienceMinYears, p.ExperienceMaxYears, p.SalaryMin, p.SalaryMax, p.Skills,
           p.PublishedAt, p.ClosesOn,
           CAST(CASE WHEN s.PostingId IS NULL THEN 0 ELSE 1 END AS BIT) AS IsSaved,
           ISNULL(a.Status, '') AS MyStatus,
           CAST(1 AS BIT) AS IsOpen,
           COUNT(*) OVER () AS TotalCount
    FROM jobs.Postings p
    LEFT JOIN jobs.SavedPostings s ON s.PostingId = p.PostingId AND s.UserId = @UserId
    LEFT JOIN jobs.Applications a  ON a.PostingId = p.PostingId AND a.UserId = @UserId
    WHERE p.Status = 'Open'
      AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today)
      AND (@Query = '' OR p.Title LIKE '%' + @Query + '%' OR p.Skills LIKE '%' + @Query + '%'
                       OR p.CompanyName LIKE '%' + @Query + '%' OR p.Description LIKE '%' + @Query + '%')
      AND (@City = '' OR p.City LIKE '%' + @City + '%')
      AND (@EmploymentType = '' OR p.EmploymentType = @EmploymentType)
      AND (@WorkMode = '' OR p.WorkMode = @WorkMode)
    ORDER BY p.PublishedAt DESC, p.PostingId DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* One posting with its description: an open one, or one this person applied to
   (so that "My applications" can still show it after it closed). Never a draft. */
CREATE OR ALTER PROCEDURE jobs.sp_Posting_Get
    @UserId    INT,
    @PostingId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT p.PostingId, p.Title, p.CompanyName, p.City, p.EmploymentType, p.WorkMode,
           p.ExperienceMinYears, p.ExperienceMaxYears, p.SalaryMin, p.SalaryMax, p.Skills,
           p.Description, p.PublishedAt, p.ClosesOn,
           CAST(CASE WHEN s.PostingId IS NULL THEN 0 ELSE 1 END AS BIT) AS IsSaved,
           ISNULL(a.Status, '') AS MyStatus,
           CAST(CASE WHEN p.Status = 'Open' AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today) THEN 1 ELSE 0 END AS BIT) AS IsOpen
    FROM jobs.Postings p
    LEFT JOIN jobs.SavedPostings s ON s.PostingId = p.PostingId AND s.UserId = @UserId
    LEFT JOIN jobs.Applications a  ON a.PostingId = p.PostingId AND a.UserId = @UserId
    WHERE p.PostingId = @PostingId
      AND p.Status <> 'Draft'
      AND ((p.Status = 'Open' AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today)) OR a.ApplicationId IS NOT NULL);
END
GO

/* =============================================================================
   PERSON · apply and withdraw
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Application_Apply
    @UserId    INT,
    @PostingId INT,
    @Note      NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Note = LTRIM(RTRIM(ISNULL(@Note, '')));

    IF @UserId IS NULL OR @UserId = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM jobs.Profiles WHERE UserId = @UserId AND FullName <> '' AND Headline <> '')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Add your name and a headline to your profile before you apply' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM jobs.Postings WITH (UPDLOCK, HOLDLOCK)
                   WHERE PostingId = @PostingId AND Status = 'Open'
                     AND (ClosesOn IS NULL OR ClosesOn >= CAST(GETDATE() AS DATE)))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'This job no longer takes applications' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    DECLARE @ApplicationId INT, @Current NVARCHAR(12);

    SELECT @ApplicationId = ApplicationId, @Current = Status
    FROM jobs.Applications WITH (UPDLOCK, HOLDLOCK)
    WHERE PostingId = @PostingId AND UserId = @UserId;

    IF @ApplicationId IS NOT NULL AND @Current <> 'Withdrawn'
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'You have already applied' AS Message, @ApplicationId AS Id; RETURN;
    END

    IF (SELECT COUNT(*) FROM jobs.Applications WHERE UserId = @UserId AND Status <> 'Withdrawn') >= 200
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'You have 200 applications. Withdraw one you no longer need first' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @ApplicationId IS NOT NULL
        /* applying again after a withdrawal: the same row, from the start */
        UPDATE jobs.Applications
        SET Status = 'Applied', Note = @Note, AppliedAt = GETDATE(), StatusAt = GETDATE()
        WHERE ApplicationId = @ApplicationId AND UserId = @UserId;
    ELSE
    BEGIN
        INSERT INTO jobs.Applications (PostingId, UserId, Note) VALUES (@PostingId, @UserId, @Note);
        SET @ApplicationId = SCOPE_IDENTITY();
    END

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Application sent' AS Message, @ApplicationId AS Id;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Application_Withdraw
    @UserId        INT,
    @ApplicationId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE jobs.Applications
    SET Status = 'Withdrawn', StatusAt = GETDATE()
    WHERE ApplicationId = @ApplicationId AND UserId = @UserId AND Status <> 'Withdrawn';

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Application withdrawn' AS Message;
END
GO

/* The applications of the person, newest first; withdrawn ones are part of it. */
CREATE OR ALTER PROCEDURE jobs.sp_Application_ListMine
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT a.ApplicationId, a.PostingId, p.Title, p.CompanyName, p.City, p.EmploymentType, p.WorkMode,
           a.Status, a.Note, a.AppliedAt, a.StatusAt,
           CAST(CASE WHEN p.Status = 'Open' AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today) THEN 1 ELSE 0 END AS BIT) AS IsOpen
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId
    WHERE a.UserId = @UserId
    ORDER BY a.AppliedAt DESC, a.ApplicationId DESC;
END
GO

/* =============================================================================
   PERSON · saved postings
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Saved_Set
    @UserId    INT,
    @PostingId INT,
    @Saved     BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @UserId IS NULL OR @UserId = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    IF ISNULL(@Saved, 0) = 0
    BEGIN
        DELETE FROM jobs.SavedPostings WHERE UserId = @UserId AND PostingId = @PostingId;
        SELECT CAST(1 AS INT) AS Success, 'Removed from saved jobs' AS Message; RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM jobs.Postings
                   WHERE PostingId = @PostingId AND Status = 'Open'
                     AND (ClosesOn IS NULL OR ClosesOn >= CAST(GETDATE() AS DATE)))
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    IF EXISTS (SELECT 1 FROM jobs.SavedPostings WHERE UserId = @UserId AND PostingId = @PostingId)
    BEGIN
        SELECT CAST(1 AS INT) AS Success, 'Job saved' AS Message; RETURN;
    END

    IF (SELECT COUNT(*) FROM jobs.SavedPostings WHERE UserId = @UserId) >= 200
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You have 200 saved jobs. Remove one first' AS Message; RETURN;
    END

    INSERT INTO jobs.SavedPostings (UserId, PostingId) VALUES (@UserId, @PostingId);

    SELECT CAST(1 AS INT) AS Success, 'Job saved' AS Message;
END
GO

/* The saved postings of the person, also those that closed since (never a draft). */
CREATE OR ALTER PROCEDURE jobs.sp_Saved_ListMine
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT p.PostingId, p.Title, p.CompanyName, p.City, p.EmploymentType, p.WorkMode,
           p.ExperienceMinYears, p.ExperienceMaxYears, p.SalaryMin, p.SalaryMax, p.Skills,
           p.PublishedAt, p.ClosesOn,
           CAST(1 AS BIT) AS IsSaved,
           ISNULL(a.Status, '') AS MyStatus,
           CAST(CASE WHEN p.Status = 'Open' AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today) THEN 1 ELSE 0 END AS BIT) AS IsOpen
    FROM jobs.SavedPostings s
    INNER JOIN jobs.Postings p    ON p.PostingId = s.PostingId AND p.Status <> 'Draft'
    LEFT JOIN jobs.Applications a ON a.PostingId = p.PostingId AND a.UserId = @UserId
    WHERE s.UserId = @UserId
    ORDER BY s.SavedAt DESC, p.PostingId DESC;
END
GO

/* =============================================================================
   COMPANY · postings
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Posting_List
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.PostingId, p.Title, p.City, p.EmploymentType, p.WorkMode,
           p.ExperienceMinYears, p.ExperienceMaxYears, p.SalaryMin, p.SalaryMax, p.Skills,
           p.Status, p.ClosesOn, p.PublishedAt, p.CreatedAt,
           ISNULL(c.Applied, 0) AS Applied, ISNULL(c.Shortlisted, 0) AS Shortlisted,
           ISNULL(c.Rejected, 0) AS Rejected, ISNULL(c.Hired, 0) AS Hired
    FROM jobs.Postings p
    OUTER APPLY (SELECT SUM(CASE WHEN a.Status = 'Applied'     THEN 1 ELSE 0 END) AS Applied,
                        SUM(CASE WHEN a.Status = 'Shortlisted' THEN 1 ELSE 0 END) AS Shortlisted,
                        SUM(CASE WHEN a.Status = 'Rejected'    THEN 1 ELSE 0 END) AS Rejected,
                        SUM(CASE WHEN a.Status = 'Hired'       THEN 1 ELSE 0 END) AS Hired
                 FROM jobs.Applications a
                 WHERE a.PostingId = p.PostingId AND p.CompanyId = @CompanyId) c
    WHERE p.CompanyId = @CompanyId
    ORDER BY CASE p.Status WHEN 'Open' THEN 0 WHEN 'Draft' THEN 1 ELSE 2 END, p.CreatedAt DESC, p.PostingId DESC;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Company_Posting_Get
    @CompanyId INT,
    @PostingId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.PostingId, p.Title, p.City, p.EmploymentType, p.WorkMode,
           p.ExperienceMinYears, p.ExperienceMaxYears, p.SalaryMin, p.SalaryMax, p.Skills,
           p.Description, p.Status, p.ClosesOn, p.PublishedAt, p.CreatedAt
    FROM jobs.Postings p
    WHERE p.PostingId = @PostingId AND p.CompanyId = @CompanyId;
END
GO

/* Adds a posting as a draft, or changes one of the company. The state is changed
   by sp_Company_Posting_SetStatus only. */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Posting_Save
    @CompanyId          INT,
    @UserId             INT,
    @CompanyName        NVARCHAR(200),
    @PostingId          INT,
    @Title              NVARCHAR(200),
    @City               NVARCHAR(100),
    @EmploymentType     NVARCHAR(20),
    @WorkMode           NVARCHAR(20),
    @ExperienceMinYears TINYINT        = NULL,
    @ExperienceMaxYears TINYINT        = NULL,
    @SalaryMin          INT            = NULL,
    @SalaryMax          INT            = NULL,
    @Skills             NVARCHAR(400)  = NULL,
    @Description        NVARCHAR(4000) = NULL,
    @ClosesOn           DATE           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @CompanyName = LTRIM(RTRIM(ISNULL(@CompanyName, '')));
    SET @Title       = LTRIM(RTRIM(ISNULL(@Title, '')));
    SET @City        = LTRIM(RTRIM(ISNULL(@City, '')));
    SET @Skills      = LTRIM(RTRIM(ISNULL(@Skills, '')));
    SET @Description = LTRIM(RTRIM(ISNULL(@Description, '')));

    IF ISNULL(@CompanyId, 0) = 0 OR ISNULL(@UserId, 0) = 0 OR @CompanyName = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @Title = '' OR @City = '' OR @Description = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Enter the title, the city and the description of the job' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF ISNULL(@PostingId, 0) = 0
    BEGIN
        BEGIN TRANSACTION;

        IF (SELECT COUNT(*) FROM jobs.Postings WITH (UPDLOCK, HOLDLOCK) WHERE CompanyId = @CompanyId AND Status <> 'Closed') >= 100
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'The company has 100 jobs that are not closed. Close one first' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        INSERT INTO jobs.Postings (CompanyId, CompanyName, Title, City, EmploymentType, WorkMode, ExperienceMinYears, ExperienceMaxYears,
                                   SalaryMin, SalaryMax, Skills, Description, ClosesOn, PostedBy)
        VALUES (@CompanyId, @CompanyName, @Title, @City, @EmploymentType, @WorkMode, @ExperienceMinYears, @ExperienceMaxYears,
                @SalaryMin, @SalaryMax, @Skills, @Description, @ClosesOn, @UserId);

        DECLARE @NewId INT = SCOPE_IDENTITY();

        COMMIT TRANSACTION;

        SELECT CAST(1 AS INT) AS Success, 'Job saved as a draft' AS Message, @NewId AS Id; RETURN;
    END

    UPDATE jobs.Postings
    SET CompanyName = @CompanyName, Title = @Title, City = @City, EmploymentType = @EmploymentType, WorkMode = @WorkMode,
        ExperienceMinYears = @ExperienceMinYears, ExperienceMaxYears = @ExperienceMaxYears,
        SalaryMin = @SalaryMin, SalaryMax = @SalaryMax, Skills = @Skills, Description = @Description,
        ClosesOn = @ClosesOn, UpdatedAt = GETDATE()
    WHERE PostingId = @PostingId AND CompanyId = @CompanyId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Job saved' AS Message, @PostingId AS Id;
END
GO

/* Publish (Draft or Closed -> Open) or close (Open -> Closed). A posting never
   goes back to a draft. */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Posting_SetStatus
    @CompanyId INT,
    @PostingId INT,
    @Status    NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Current NVARCHAR(10), @ClosesOn DATE;

    BEGIN TRANSACTION;

    SELECT @Current = Status, @ClosesOn = ClosesOn
    FROM jobs.Postings WITH (UPDLOCK, HOLDLOCK)
    WHERE PostingId = @PostingId AND CompanyId = @CompanyId;

    IF @Current IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    IF NOT ((@Status = 'Open' AND @Current IN ('Draft', 'Closed')) OR (@Status = 'Closed' AND @Current = 'Open'))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success,
               CASE WHEN @Status = @Current THEN 'The job is already ' + LOWER(@Current) ELSE 'This change is not possible' END AS Message; RETURN;
    END

    IF @Status = 'Open' AND @ClosesOn IS NOT NULL AND @ClosesOn < CAST(GETDATE() AS DATE)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'The closing date has passed. Change it before you publish the job' AS Message; RETURN;
    END

    UPDATE jobs.Postings
    SET Status = @Status,
        PublishedAt = CASE WHEN @Status = 'Open' AND PublishedAt IS NULL THEN GETDATE() ELSE PublishedAt END,
        UpdatedAt = GETDATE()
    WHERE PostingId = @PostingId AND CompanyId = @CompanyId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, CASE WHEN @Status = 'Open' THEN 'The job is published' ELSE 'The job is closed' END AS Message;
END
GO

/* Removes a posting nobody applied to. One with applications is closed instead. */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Posting_Delete
    @CompanyId INT,
    @PostingId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM jobs.Postings WITH (UPDLOCK, HOLDLOCK) WHERE PostingId = @PostingId AND CompanyId = @CompanyId)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    IF EXISTS (SELECT 1 FROM jobs.Applications a
               INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
               WHERE a.PostingId = @PostingId)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'A job with applications cannot be removed. Close it instead' AS Message; RETURN;
    END

    DELETE s
    FROM jobs.SavedPostings s
    INNER JOIN jobs.Postings p ON p.PostingId = s.PostingId AND p.CompanyId = @CompanyId
    WHERE s.PostingId = @PostingId;

    DELETE FROM jobs.Postings WHERE PostingId = @PostingId AND CompanyId = @CompanyId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Job removed' AS Message;
END
GO

/* =============================================================================
   COMPANY · applicants. Reached only through a posting of the company and an
   application that is not withdrawn.
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Applicant_List
    @CompanyId INT,
    @PostingId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT a.ApplicationId, a.Status, a.Note, a.AppliedAt, a.StatusAt,
           ISNULL(pr.FullName, '') AS FullName, ISNULL(pr.Headline, '') AS Headline, ISNULL(pr.City, '') AS City,
           CAST(CASE WHEN EXISTS (SELECT 1 FROM jobs.Files f WHERE f.UserId = a.UserId AND f.Kind = 'Resume') THEN 1 ELSE 0 END AS BIT) AS HasResume
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p  ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    LEFT JOIN jobs.Profiles pr  ON pr.UserId = a.UserId
    WHERE a.PostingId = @PostingId AND a.Status <> 'Withdrawn'
    ORDER BY CASE a.Status WHEN 'Shortlisted' THEN 0 WHEN 'Applied' THEN 1 WHEN 'Hired' THEN 2 ELSE 3 END, a.AppliedAt DESC;
END
GO

/* The application (first result set; no row = not found), then the profile page
   of the applicant as jobs.sp_Profile_Get gives it. The look is written down. */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Applicant_Get
    @CompanyId     INT,
    @PostingId     INT,
    @ApplicationId INT,
    @ViewerUserId  INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Applicant INT;

    SELECT @Applicant = a.UserId
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE a.ApplicationId = @ApplicationId AND a.PostingId = @PostingId AND a.Status <> 'Withdrawn';

    SELECT a.ApplicationId, a.Status, a.Note, a.AppliedAt, a.StatusAt, p.Title
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE a.ApplicationId = @ApplicationId AND a.PostingId = @PostingId AND a.Status <> 'Withdrawn';

    IF @Applicant IS NULL RETURN;

    INSERT INTO jobs.ProfileViews (CompanyId, ViewerUserId, UserId, PostingId, What)
    VALUES (@CompanyId, ISNULL(@ViewerUserId, 0), @Applicant, @PostingId, 'Profile');

    EXEC jobs.sp_Profile_Get @UserId = @Applicant;
END
GO

/* The resume of an applicant, with its content. No row = not found or no resume. */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Applicant_Resume
    @CompanyId     INT,
    @PostingId     INT,
    @ApplicationId INT,
    @ViewerUserId  INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Applicant INT;

    SELECT @Applicant = a.UserId
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE a.ApplicationId = @ApplicationId AND a.PostingId = @PostingId AND a.Status <> 'Withdrawn';

    IF @Applicant IS NULL RETURN;

    IF NOT EXISTS (SELECT 1 FROM jobs.Files WHERE UserId = @Applicant AND Kind = 'Resume') RETURN;

    INSERT INTO jobs.ProfileViews (CompanyId, ViewerUserId, UserId, PostingId, What)
    VALUES (@CompanyId, ISNULL(@ViewerUserId, 0), @Applicant, @PostingId, 'Resume');

    SELECT TOP (1) f.FileName, f.ContentType, f.Content
    FROM jobs.Files f
    WHERE f.UserId = @Applicant AND f.Kind = 'Resume'
    ORDER BY f.FileId DESC;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Company_Applicant_SetStatus
    @CompanyId     INT,
    @PostingId     INT,
    @ApplicationId INT,
    @Status        NVARCHAR(12)
AS
BEGIN
    SET NOCOUNT ON;

    IF @Status NOT IN ('Applied', 'Shortlisted', 'Rejected', 'Hired')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This change is not possible' AS Message; RETURN;
    END

    UPDATE a
    SET a.Status = @Status, a.StatusAt = GETDATE()
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE a.ApplicationId = @ApplicationId AND a.PostingId = @PostingId AND a.Status <> 'Withdrawn';

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Marked as ' + LOWER(@Status) AS Message;
END
GO

PRINT 'Job Portal: job postings and applications are in place.';
GO
SET NOEXEC OFF;
GO
