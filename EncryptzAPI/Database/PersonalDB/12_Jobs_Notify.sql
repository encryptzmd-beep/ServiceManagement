/* =============================================================================
   PersonalDB · 12 · Job Portal and Job Consultancy tell the API whom to notify
   -----------------------------------------------------------------------------
   Run AFTER 11_Consultancy_Leaves.sql, in the Personal DB. SAFE TO RE-RUN.
   Run it AGAIN every time script 06, 08, 09 or 11 is run again: those re-create
   procedures below in their earlier form. Order: 06 -> 07 -> 08 -> 09 -> 11 -> 12.

   Notifications of every application live in the main database (MainDB script 24)
   and reach a person at once over SignalR. The procedures here no longer write
   jobs.Notifications: on success they answer a SECOND result set, "who is to be
   told what", which the API turns into notifications. That set never leaves the
   API.

     Audience  'User'            one person (UserId)
               'Company'         the members of CompanyId who may open Job Consultancy
               'PlatformAdmins'  the platform administrators
     UserId, CompanyId, App, Kind, Title, Body, Link

   Who is told what:
     a person applies / withdraws            -> the company of the job
     the company shortlists, rejects, hires  -> the applicant
     the company closes a job                -> the applicants still waiting
     a job is sent for review or changed     -> the platform administrators
     the platform administrator decides a job-> the company
     a certificate with a file waits         -> the platform administrators
     the platform administrator decides it   -> the person
     the company invites a candidate         -> the person

   jobs.Notifications stays as it is (nothing writes to it any more).
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR OBJECT_ID('jobs.CandidateInvitations') IS NULL OR COL_LENGTH('jobs.Postings', 'ReviewNote') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 09_Jobs_Verification.sql and 11_Consultancy_Leaves.sql in it before running this script.', 16, 1);
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
   PERSON · apply and withdraw; the company is told
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

    SELECT 'Company' AS Audience, CAST(NULL AS INT) AS UserId, p.CompanyId, 'JOBCONSULTANCY' AS App, 'NewApplicant' AS Kind,
           pr.FullName + ' applied for ' + p.Title AS Title,
           ISNULL(NULLIF(pr.Headline, ''), '') AS Body,
           '/consultancy/postings' AS Link
    FROM jobs.Postings p
    INNER JOIN jobs.Profiles pr ON pr.UserId = @UserId
    WHERE p.PostingId = @PostingId;
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
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    SELECT CAST(1 AS INT) AS Success, 'Application withdrawn' AS Message;

    SELECT 'Company' AS Audience, CAST(NULL AS INT) AS UserId, p.CompanyId, 'JOBCONSULTANCY' AS App, 'Withdrawn' AS Kind,
           pr.FullName + ' withdrew the application for ' + p.Title AS Title,
           '' AS Body, '/consultancy/postings' AS Link
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p  ON p.PostingId = a.PostingId
    INNER JOIN jobs.Profiles pr ON pr.UserId = a.UserId
    WHERE a.ApplicationId = @ApplicationId AND a.UserId = @UserId;
END
GO

/* =============================================================================
   COMPANY · the state of an application; the applicant is told of a decision
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Applicant_SetStatus
    @CompanyId     INT,
    @PostingId     INT,
    @ApplicationId INT,
    @Status        NVARCHAR(12)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Status NOT IN ('Applied', 'Shortlisted', 'Rejected', 'Hired')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This change is not possible' AS Message; RETURN;
    END

    DECLARE @Applicant INT, @Old NVARCHAR(12), @Title NVARCHAR(200), @Company NVARCHAR(200);

    BEGIN TRANSACTION;

    SELECT @Applicant = a.UserId, @Old = a.Status, @Title = p.Title, @Company = p.CompanyName
    FROM jobs.Applications a WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE a.ApplicationId = @ApplicationId AND a.PostingId = @PostingId AND a.Status <> 'Withdrawn';

    IF @Applicant IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    UPDATE a
    SET a.Status = @Status, a.StatusAt = GETDATE()
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE a.ApplicationId = @ApplicationId AND a.PostingId = @PostingId AND a.Status <> 'Withdrawn';

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Marked as ' + LOWER(@Status) AS Message;

    /* the person hears of a decision, not of every click: back to Applied says nothing */
    SELECT 'User' AS Audience, @Applicant AS UserId, CAST(NULL AS INT) AS CompanyId, 'JOBPORTAL' AS App, @Status AS Kind,
           CASE @Status
               WHEN 'Shortlisted' THEN 'You are shortlisted for ' + @Title
               WHEN 'Hired'       THEN @Company + ' marked you as hired for ' + @Title
               ELSE                    @Company + ' will not go ahead with your application for ' + @Title
           END AS Title,
           @Company + ' · ' + @Title AS Body,
           '/apps/jobs/applications' AS Link
    WHERE @Status <> @Old AND @Status IN ('Shortlisted', 'Rejected', 'Hired');
END
GO

/* =============================================================================
   COMPANY · a job: saved (a change of a public job is checked again), sent for
   review, closed
   ============================================================================= */
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

        SELECT CAST(1 AS INT) AS Success, 'Job saved as a draft' AS Message, @NewId AS Id;
        SELECT TOP (0) 'User' AS Audience, CAST(NULL AS INT) AS UserId, CAST(NULL AS INT) AS CompanyId, '' AS App, '' AS Kind, '' AS Title, '' AS Body, '' AS Link;
        RETURN;
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
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @Was IN ('Open', 'InReview')
        SELECT CAST(1 AS INT) AS Success, 'Job saved. It is checked again before people see the change' AS Message, @PostingId AS Id;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Job saved' AS Message, @PostingId AS Id;

    SELECT 'PlatformAdmins' AS Audience, CAST(NULL AS INT) AS UserId, @CompanyId AS CompanyId, 'PLATFORM' AS App, 'ReviewWaiting' AS Kind,
           @CompanyName + ' changed the job ' + @Title + ': it waits for review' AS Title,
           '' AS Body, '/settings/platform' AS Link
    WHERE @Was IN ('Open', 'InReview');
END
GO

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

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @Status = 'Open' THEN 'Sent for review. People find the job once it is approved' ELSE 'The job is closed' END AS Message;

    /* sent for review: the platform administrators; closed: the applicants still waiting */
    SELECT 'PlatformAdmins' AS Audience, CAST(NULL AS INT) AS UserId, p.CompanyId, 'PLATFORM' AS App, 'ReviewWaiting' AS Kind,
           p.CompanyName + ' wants to publish ' + p.Title AS Title, p.City AS Body, '/settings/platform' AS Link
    FROM jobs.Postings p
    WHERE @Status = 'Open' AND p.PostingId = @PostingId AND p.CompanyId = @CompanyId
    UNION ALL
    SELECT 'User', a.UserId, CAST(NULL AS INT), 'JOBPORTAL', 'JobClosed',
           p.CompanyName + ' closed the job ' + p.Title,
           'Your application stays. The company may still get back to you.',
           '/apps/jobs/applications'
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE @Status = 'Closed' AND a.PostingId = @PostingId AND a.Status IN ('Applied', 'Shortlisted');
END
GO

/* =============================================================================
   PLATFORM ADMINISTRATOR · a job is approved or returned; the company is told
   ============================================================================= */
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
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This job no longer waits for review' AS Message; RETURN;
    END

    SELECT CAST(1 AS INT) AS Success, CASE WHEN @Approved = 1 THEN 'Job approved. People can find it now' ELSE 'Job returned to the company' END AS Message;

    SELECT 'Company' AS Audience, CAST(NULL AS INT) AS UserId, p.CompanyId, 'JOBCONSULTANCY' AS App,
           CASE WHEN @Approved = 1 THEN 'JobApproved' ELSE 'JobReturned' END AS Kind,
           CASE WHEN @Approved = 1 THEN 'Your job ' + p.Title + ' is approved and people can find it'
                ELSE 'Your job ' + p.Title + ' was returned for a change' END AS Title,
           ISNULL(@Note, '') AS Body,
           '/consultancy/postings' AS Link
    FROM jobs.Postings p
    WHERE p.PostingId = @PostingId;
END
GO

/* =============================================================================
   PERSON · a certificate; one with a file to check is told to the administrators
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

    DECLARE @OldFileId INT, @NewFileId INT, @WasStatus NVARCHAR(30);

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
        SELECT @OldFileId = FileId, @WasStatus = Status FROM jobs.Certificates WHERE CertificateId = @CertificateId AND UserId = @UserId;

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

    /* a certificate with a file that waits now, and did not wait before: the administrators check it */
    SELECT 'PlatformAdmins' AS Audience, CAST(NULL AS INT) AS UserId, CAST(NULL AS INT) AS CompanyId, 'PLATFORM' AS App, 'CertificateWaiting' AS Kind,
           'A certificate waits for verification: ' + c.Title AS Title,
           ISNULL(pr.FullName, '') AS Body, '/settings/platform' AS Link
    FROM jobs.Certificates c
    LEFT JOIN jobs.Profiles pr ON pr.UserId = c.UserId
    WHERE c.CertificateId = @CertificateId AND c.UserId = @UserId
      AND c.Status = 'Uploaded' AND c.FileId IS NOT NULL AND ISNULL(@WasStatus, '') <> 'Uploaded';
END
GO

/* =============================================================================
   PLATFORM ADMINISTRATOR · a certificate is verified or not; the person is told
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Admin_Certificate_Decide
    @CertificateId INT,
    @Verified      BIT,
    @Note          NVARCHAR(500) = NULL,
    @AdminName     NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Note = NULLIF(LTRIM(RTRIM(ISNULL(@Note, ''))), '');

    IF ISNULL(@Verified, 0) = 0 AND @Note IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Say why the certificate is not verified' AS Message; RETURN;
    END

    UPDATE jobs.Certificates
    SET Status = CASE WHEN @Verified = 1 THEN 'Verified' ELSE 'Rejected' END,
        VerifiedBy = @AdminName, VerifiedAt = GETDATE(), VerificationNote = @Note
    WHERE CertificateId = @CertificateId AND Status = 'Uploaded' AND FileId IS NOT NULL;

    IF @@ROWCOUNT = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This certificate no longer waits. It was changed or decided already' AS Message; RETURN;
    END

    SELECT CAST(1 AS INT) AS Success, CASE WHEN @Verified = 1 THEN 'Certificate verified' ELSE 'Certificate not verified' END AS Message;

    SELECT 'User' AS Audience, c.UserId, CAST(NULL AS INT) AS CompanyId, 'JOBPORTAL' AS App,
           CASE WHEN @Verified = 1 THEN 'CertificateVerified' ELSE 'CertificateRejected' END AS Kind,
           CASE WHEN @Verified = 1 THEN 'Your certificate ' + c.Title + ' is verified'
                ELSE 'Your certificate ' + c.Title + ' could not be verified' END AS Title,
           ISNULL(@Note, '') AS Body, '/apps/jobs' AS Link
    FROM jobs.Certificates c
    WHERE c.CertificateId = @CertificateId;
END
GO

/* =============================================================================
   COMPANY · an invitation to apply; the person is told
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Candidate_Invite
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER,
    @PostingId    INT,
    @Message      NVARCHAR(500) = NULL,
    @UserId       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Person INT, @Title NVARCHAR(200), @Company NVARCHAR(200);
    SELECT @Person = pr.UserId FROM jobs.Profiles pr WHERE pr.CandidateKey = @CandidateKey AND pr.IsVisible = 1;
    SELECT @Title = p.Title, @Company = p.CompanyName
    FROM jobs.Postings p
    WHERE p.PostingId = @PostingId AND p.CompanyId = @CompanyId AND p.Status = 'Open'
      AND (p.ClosesOn IS NULL OR p.ClosesOn >= CAST(GETDATE() AS DATE));

    IF @Person IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END
    IF @Title IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose one of your open jobs' AS Message; RETURN;
    END
    IF EXISTS (SELECT 1 FROM jobs.Applications a INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
               WHERE a.PostingId = @PostingId AND a.UserId = @Person AND a.Status <> 'Withdrawn')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This candidate has already applied to the job' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM jobs.CandidateInvitations WITH (UPDLOCK, HOLDLOCK) WHERE PostingId = @PostingId AND UserId = @Person AND CompanyId = @CompanyId)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'This candidate was already invited to the job' AS Message; RETURN;
    END

    INSERT INTO jobs.CandidateInvitations (CompanyId, PostingId, UserId, Message, InvitedBy)
    VALUES (@CompanyId, @PostingId, @Person, LTRIM(RTRIM(ISNULL(@Message, ''))), ISNULL(@UserId, 0));

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Invitation sent' AS Message;

    SELECT 'User' AS Audience, pr.UserId, CAST(NULL AS INT) AS CompanyId, 'JOBPORTAL' AS App, 'Invitation' AS Kind,
           @Company + ' invites you to apply for ' + @Title AS Title,
           LTRIM(RTRIM(ISNULL(@Message, ''))) AS Body,
           '/apps/jobs/search?posting=' + CAST(@PostingId AS NVARCHAR(12)) AS Link
    FROM jobs.Profiles pr WHERE pr.UserId = @Person AND pr.IsVisible = 1;
END
GO

PRINT 'Job Portal and Job Consultancy tell the API whom to notify.';
GO
SET NOEXEC OFF;
GO
