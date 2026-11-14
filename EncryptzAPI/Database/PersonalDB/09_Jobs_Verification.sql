/* =============================================================================
   PersonalDB · 09 · Job Portal: the platform administrator verifies certificates
                     and job postings; a date of birth is needed to apply
   -----------------------------------------------------------------------------
   Run AFTER 08_Jobs_Notifications.sql, in the Personal DB. SAFE TO RE-RUN.
   Run it AGAIN every time script 02, 06 or 08 is run again: those scripts re-create
   procedures below in their earlier form. The order is always 06 -> 07 -> 08 -> 09.

   Certificates
     A certificate with a file waits for the platform administrator ('Uploaded').
     It becomes 'Verified' or 'Rejected' (with a note). Changing the title, the
     issuer, the date or the file sends it back to 'Uploaded'.

   Job postings
     Publishing no longer opens a job: it goes 'InReview'. The platform administrator
     approves it ('Open', people find it) or returns it ('Draft', with a note for the
     company). Changing a job that is open or in review sends it to review again; its
     applications stay.

   Applying needs a name, a headline and a date of birth.

   The procedures for the platform administrator are named sp_Admin_*. They take no
   user or company: the API lets only a platform administrator, with the screen
   unlocked, reach them. They name who decided (@AdminName) on every decision.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL OR OBJECT_ID('jobs.Notifications') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 08_Jobs_Notifications.sql in it before running this script.', 16, 1);
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
   Columns and states
   ============================================================================= */
IF COL_LENGTH('jobs.Certificates', 'VerificationNote') IS NULL
    ALTER TABLE jobs.Certificates ADD VerificationNote NVARCHAR(500) NULL;
GO
IF COL_LENGTH('jobs.Postings', 'ReviewNote') IS NULL
    ALTER TABLE jobs.Postings ADD ReviewNote NVARCHAR(500) NULL, ReviewedBy NVARCHAR(200) NULL, ReviewedAt DATETIME NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_jobs_Postings_Status' AND definition NOT LIKE '%InReview%')
    ALTER TABLE jobs.Postings DROP CONSTRAINT CK_jobs_Postings_Status;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_jobs_Postings_Status')
    ALTER TABLE jobs.Postings ADD CONSTRAINT CK_jobs_Postings_Status CHECK (Status IN ('Draft', 'InReview', 'Open', 'Closed'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_jobs_Notifications_Kind' AND definition NOT LIKE '%Certificate%')
    ALTER TABLE jobs.Notifications DROP CONSTRAINT CK_jobs_Notifications_Kind;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_jobs_Notifications_Kind')
    ALTER TABLE jobs.Notifications ADD CONSTRAINT CK_jobs_Notifications_Kind CHECK (Kind IN ('Application', 'JobClosed', 'Certificate'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_jobs_Certificates_Status')
    ALTER TABLE jobs.Certificates WITH NOCHECK ADD CONSTRAINT CK_jobs_Certificates_Status CHECK (Status IN ('Uploaded', 'Verified', 'Rejected'));
GO

/* =============================================================================
   PERSON · a certificate; a change sends it back to be checked
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Certificate_Save
    @UserId        INT,
    @CertificateId INT,
    @Title         NVARCHAR(200),
    @Issuer        NVARCHAR(200) = NULL,
    @IssuedOn      DATE = NULL,
    @FileName      NVARCHAR(260) = NULL,
    @ContentType   NVARCHAR(100) = NULL,
    @SizeBytes     INT = NULL,
    @Content       VARBINARY(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @OldFileId INT, @NewFileId INT;

    SET @CertificateId = ISNULL(@CertificateId, 0);
    SET @Issuer        = LTRIM(RTRIM(ISNULL(@Issuer, '')));

    IF @CertificateId = 0
       AND (SELECT COUNT(*) FROM jobs.Certificates WHERE UserId = @UserId) >= 30
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You can keep up to 30 certificates. Remove one first' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @CertificateId > 0
       AND NOT EXISTS (SELECT 1 FROM jobs.Certificates WHERE CertificateId = @CertificateId AND UserId = @UserId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    IF @Content IS NOT NULL
    BEGIN
        INSERT INTO jobs.Files (UserId, Kind, FileName, ContentType, SizeBytes, Content)
        VALUES (@UserId, 'Certificate', @FileName, @ContentType, @SizeBytes, @Content);

        SET @NewFileId = SCOPE_IDENTITY();
    END

    IF @CertificateId = 0
    BEGIN
        INSERT INTO jobs.Certificates (UserId, Title, Issuer, IssuedOn, FileId)
        VALUES (@UserId, @Title, @Issuer, @IssuedOn, @NewFileId);

        SET @CertificateId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        SELECT @OldFileId = FileId FROM jobs.Certificates WHERE CertificateId = @CertificateId AND UserId = @UserId;

        /* what was checked is no longer what is shown: it is checked again */
        UPDATE jobs.Certificates
        SET Status = CASE WHEN Title = @Title AND Issuer = @Issuer
                               AND ISNULL(IssuedOn, '19000101') = ISNULL(@IssuedOn, '19000101')
                               AND @NewFileId IS NULL
                          THEN Status ELSE 'Uploaded' END,
            VerifiedBy = CASE WHEN Title = @Title AND Issuer = @Issuer
                                   AND ISNULL(IssuedOn, '19000101') = ISNULL(@IssuedOn, '19000101')
                                   AND @NewFileId IS NULL
                              THEN VerifiedBy ELSE NULL END,
            VerifiedAt = CASE WHEN Title = @Title AND Issuer = @Issuer
                                   AND ISNULL(IssuedOn, '19000101') = ISNULL(@IssuedOn, '19000101')
                                   AND @NewFileId IS NULL
                              THEN VerifiedAt ELSE NULL END,
            VerificationNote = CASE WHEN Title = @Title AND Issuer = @Issuer
                                         AND ISNULL(IssuedOn, '19000101') = ISNULL(@IssuedOn, '19000101')
                                         AND @NewFileId IS NULL
                                    THEN VerificationNote ELSE NULL END,
            Title = @Title, Issuer = @Issuer, IssuedOn = @IssuedOn, FileId = ISNULL(@NewFileId, FileId)
        WHERE CertificateId = @CertificateId AND UserId = @UserId;

        -- the file that was replaced is not kept
        IF @NewFileId IS NOT NULL AND @OldFileId IS NOT NULL
            DELETE FROM jobs.Files WHERE FileId = @OldFileId AND UserId = @UserId AND Kind = 'Certificate';
    END

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Certificate saved' AS Message, @CertificateId AS Id;
END
GO

/* =============================================================================
   PERSON · applying needs a date of birth too
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

    IF NOT EXISTS (SELECT 1 FROM jobs.Profiles WHERE UserId = @UserId AND FullName <> '' AND Headline <> '' AND DateOfBirth IS NOT NULL)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Add your name, a headline and your date of birth to your profile before you apply' AS Message, CAST(0 AS INT) AS Id; RETURN;
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

/* =============================================================================
   COMPANY · the jobs, with the review state and the note of the reviewer
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Posting_List
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.PostingId, p.Title, p.City, p.EmploymentType, p.WorkMode,
           p.ExperienceMinYears, p.ExperienceMaxYears, p.SalaryMin, p.SalaryMax, p.Skills,
           p.Status, p.ClosesOn, p.PublishedAt, p.CreatedAt, ISNULL(p.ReviewNote, '') AS ReviewNote,
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
    ORDER BY CASE p.Status WHEN 'Open' THEN 0 WHEN 'InReview' THEN 1 WHEN 'Draft' THEN 2 ELSE 3 END, p.CreatedAt DESC, p.PostingId DESC;
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
           p.Description, p.Status, p.ClosesOn, p.PublishedAt, p.CreatedAt, ISNULL(p.ReviewNote, '') AS ReviewNote
    FROM jobs.Postings p
    WHERE p.PostingId = @PostingId AND p.CompanyId = @CompanyId;
END
GO

/* Adds a job as a draft, or changes one of the company. A job that is open or in
   review goes to review again: what people see is always what was checked. */
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

    DECLARE @Was NVARCHAR(10);
    SELECT @Was = Status FROM jobs.Postings WHERE PostingId = @PostingId AND CompanyId = @CompanyId;

    UPDATE jobs.Postings
    SET CompanyName = @CompanyName, Title = @Title, City = @City, EmploymentType = @EmploymentType, WorkMode = @WorkMode,
        ExperienceMinYears = @ExperienceMinYears, ExperienceMaxYears = @ExperienceMaxYears,
        SalaryMin = @SalaryMin, SalaryMax = @SalaryMax, Skills = @Skills, Description = @Description,
        ClosesOn = @ClosesOn,
        Status = CASE WHEN Status IN ('Open', 'InReview') THEN 'InReview' ELSE Status END,
        ReviewNote = CASE WHEN Status IN ('Open', 'InReview') THEN NULL ELSE ReviewNote END,
        UpdatedAt = GETDATE()
    WHERE PostingId = @PostingId AND CompanyId = @CompanyId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id;
    ELSE IF @Was IN ('Open', 'InReview')
        SELECT CAST(1 AS INT) AS Success, 'Job saved. It is checked again before people see the change' AS Message, @PostingId AS Id;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Job saved' AS Message, @PostingId AS Id;
END
GO

/* Publish (Draft or Closed -> InReview: the platform administrator checks it first)
   or close (Open or InReview -> Closed; the open applications are told). */
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

    IF NOT ((@Status = 'Open' AND @Current IN ('Draft', 'Closed')) OR (@Status = 'Closed' AND @Current IN ('Open', 'InReview')))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success,
               CASE WHEN @Current = 'InReview' AND @Status = 'Open' THEN 'The job is already waiting for review'
                    WHEN @Status = @Current THEN 'The job is already ' + LOWER(@Current)
                    ELSE 'This change is not possible' END AS Message; RETURN;
    END

    IF @Status = 'Open' AND @ClosesOn IS NOT NULL AND @ClosesOn < CAST(GETDATE() AS DATE)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'The closing date has passed. Change it before you publish the job' AS Message; RETURN;
    END

    UPDATE jobs.Postings
    SET Status = CASE WHEN @Status = 'Open' THEN 'InReview' ELSE 'Closed' END,
        ReviewNote = CASE WHEN @Status = 'Open' THEN NULL ELSE ReviewNote END,
        UpdatedAt = GETDATE()
    WHERE PostingId = @PostingId AND CompanyId = @CompanyId;

    IF @Status = 'Closed'
        INSERT INTO jobs.Notifications (UserId, Kind, Title, Body, Link)
        SELECT a.UserId, 'JobClosed',
               p.CompanyName + ' closed the job ' + p.Title,
               'Your application stays. The company may still get back to you.',
               '/apps/jobs/applications'
        FROM jobs.Applications a
        INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
        WHERE a.PostingId = @PostingId AND a.Status IN ('Applied', 'Shortlisted');

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @Status = 'Open' THEN 'Sent for review. People find the job once it is approved' ELSE 'The job is closed' END AS Message;
END
GO

/* =============================================================================
   PLATFORM ADMINISTRATOR · what waits to be checked
   Two result sets: certificates with a file that wait, then jobs in review.
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Admin_Verification_List
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (200)
           c.CertificateId, c.Title, c.Issuer, c.IssuedOn,
           ISNULL(f.FileName, '') AS FileName, f.UploadedAt AS SubmittedAt,
           ISNULL(pr.FullName, '') AS PersonName, ISNULL(pr.Headline, '') AS PersonHeadline
    FROM jobs.Certificates c
    INNER JOIN jobs.Files f    ON f.FileId = c.FileId AND f.UserId = c.UserId
    LEFT JOIN jobs.Profiles pr ON pr.UserId = c.UserId
    WHERE c.Status = 'Uploaded'
    ORDER BY f.UploadedAt, c.CertificateId;

    SELECT TOP (200)
           p.PostingId, p.CompanyName, p.Title, p.City, p.EmploymentType, p.WorkMode,
           p.ExperienceMinYears, p.ExperienceMaxYears, p.SalaryMin, p.SalaryMax, p.Skills, p.Description,
           p.ClosesOn, p.UpdatedAt AS SubmittedAt,
           CAST(CASE WHEN p.PublishedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS WasPublished
    FROM jobs.Postings p
    WHERE p.Status = 'InReview'
    ORDER BY p.UpdatedAt, p.PostingId;
END
GO

/* The file of a certificate that waits, to look at it. */
CREATE OR ALTER PROCEDURE jobs.sp_Admin_Certificate_File
    @CertificateId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT f.FileName, f.ContentType, f.Content
    FROM jobs.Certificates c
    INNER JOIN jobs.Files f ON f.FileId = c.FileId AND f.UserId = c.UserId
    WHERE c.CertificateId = @CertificateId;
END
GO

/* Verified or rejected; the person is told. Only a certificate that waits. */
CREATE OR ALTER PROCEDURE jobs.sp_Admin_Certificate_Decide
    @CertificateId INT,
    @Verified      BIT,
    @Note          NVARCHAR(500) = NULL,
    @AdminName     NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Note = NULLIF(LTRIM(RTRIM(ISNULL(@Note, ''))), '');

    IF ISNULL(@Verified, 0) = 0 AND @Note IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Say why the certificate is not verified' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    UPDATE jobs.Certificates
    SET Status = CASE WHEN @Verified = 1 THEN 'Verified' ELSE 'Rejected' END,
        VerifiedBy = @AdminName, VerifiedAt = GETDATE(), VerificationNote = @Note
    WHERE CertificateId = @CertificateId AND Status = 'Uploaded' AND FileId IS NOT NULL;

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'This certificate no longer waits. It was changed or decided already' AS Message; RETURN;
    END

    INSERT INTO jobs.Notifications (UserId, Kind, Title, Body, Link)
    SELECT c.UserId, 'Certificate',
           CASE WHEN @Verified = 1 THEN 'Your certificate ' + c.Title + ' is verified'
                ELSE 'Your certificate ' + c.Title + ' could not be verified' END,
           ISNULL(@Note, ''),
           '/apps/jobs'
    FROM jobs.Certificates c
    WHERE c.CertificateId = @CertificateId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, CASE WHEN @Verified = 1 THEN 'Certificate verified' ELSE 'Certificate not verified' END AS Message;
END
GO

/* Approved (people find it) or returned to the company as a draft with the note. */
CREATE OR ALTER PROCEDURE jobs.sp_Admin_Posting_Decide
    @PostingId INT,
    @Approved  BIT,
    @Note      NVARCHAR(500) = NULL,
    @AdminName NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Note = NULLIF(LTRIM(RTRIM(ISNULL(@Note, ''))), '');

    IF ISNULL(@Approved, 0) = 0 AND @Note IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Say why the job is returned, so that the company can correct it' AS Message; RETURN;
    END

    UPDATE jobs.Postings
    SET Status      = CASE WHEN @Approved = 1 THEN 'Open' ELSE 'Draft' END,
        PublishedAt = CASE WHEN @Approved = 1 AND PublishedAt IS NULL THEN GETDATE() ELSE PublishedAt END,
        ReviewNote  = CASE WHEN @Approved = 1 THEN NULL ELSE @Note END,
        ReviewedBy  = @AdminName, ReviewedAt = GETDATE(), UpdatedAt = GETDATE()
    WHERE PostingId = @PostingId AND Status = 'InReview';

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'This job no longer waits for review' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, CASE WHEN @Approved = 1 THEN 'Job approved. People can find it now' ELSE 'Job returned to the company' END AS Message;
END
GO

PRINT 'Job Portal: verification by the platform administrator is in place.';
GO
SET NOEXEC OFF;
GO
