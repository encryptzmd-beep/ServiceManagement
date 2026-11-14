/* =============================================================================
   PersonalDB · 26 · Job Portal: interviews, reasons for a rejection, the dashboards
   -----------------------------------------------------------------------------
   Run AFTER 25_Jobs_Invitations_In_Messages.sql, in the Personal DB. SAFE TO RE-RUN.
   Run it AGAIN every time script 06, 08, 12 or 16 is run again: they re-create the
   procedures below in an earlier form.

   Interviews. A company can set an interview for an applicant: when, how (in person,
   video or phone), where (an address or a link) and a note. The person is told and sees it
   in Job Portal. Setting an interview shortlists an application that is still new; it can
   be moved or called off while the application is open.

   Rejections. A company that rejects an applicant must say why (20 characters at least).
   The person reads the reason with the application. Every rejection is kept, with the
   skills the job asked for, for the platform administrator (Platform Admin, Rejections).

     jobs.Applications                   InterviewAt, InterviewMode, InterviewPlace, InterviewNote,
                                         RejectReason
     jobs.Rejections                     every rejection: the reason and the skills the job asked for
     jobs.sp_Company_Applicant_Interview set, move or call off the interview; the person is told
     jobs.sp_Company_Applicant_SetStatus as in script 12; a rejection needs a reason
     jobs.sp_Application_ListMine        as in script 06, and the interview and the reason
     jobs.sp_Company_Applicant_List      as in script 16, and the interview and the reason
     jobs.sp_Company_Dashboard           the company's coming interviews, latest applicants, counts
     jobs.sp_Admin_Rejection_List        the rejections, for the platform administrator
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR OBJECT_ID('jobs.Applications') IS NULL OR COL_LENGTH('jobs.Profiles', 'VerifiedAt') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 16_Jobs_Verified_Badges.sql in it before running this script.', 16, 1);
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
   The interview and the reason of a rejection, on the application
   ============================================================================= */
IF COL_LENGTH('jobs.Applications', 'InterviewAt') IS NULL
    ALTER TABLE jobs.Applications ADD InterviewAt DATETIME NULL;
IF COL_LENGTH('jobs.Applications', 'InterviewMode') IS NULL
    ALTER TABLE jobs.Applications ADD InterviewMode NVARCHAR(12) NOT NULL CONSTRAINT DF_jobs_Applications_InterviewMode DEFAULT ('');
IF COL_LENGTH('jobs.Applications', 'InterviewPlace') IS NULL
    ALTER TABLE jobs.Applications ADD InterviewPlace NVARCHAR(300) NOT NULL CONSTRAINT DF_jobs_Applications_InterviewPlace DEFAULT ('');
IF COL_LENGTH('jobs.Applications', 'InterviewNote') IS NULL
    ALTER TABLE jobs.Applications ADD InterviewNote NVARCHAR(500) NOT NULL CONSTRAINT DF_jobs_Applications_InterviewNote DEFAULT ('');
IF COL_LENGTH('jobs.Applications', 'RejectReason') IS NULL
    ALTER TABLE jobs.Applications ADD RejectReason NVARCHAR(1000) NOT NULL CONSTRAINT DF_jobs_Applications_RejectReason DEFAULT ('');
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_jobs_Applications_InterviewMode')
    ALTER TABLE jobs.Applications ADD CONSTRAINT CK_jobs_Applications_InterviewMode CHECK (InterviewMode IN ('', 'In person', 'Video', 'Phone'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Applications_Interview' AND object_id = OBJECT_ID('jobs.Applications'))
    CREATE INDEX IX_jobs_Applications_Interview ON jobs.Applications(InterviewAt) INCLUDE (PostingId, UserId, Status) WHERE InterviewAt IS NOT NULL;
GO

/* Every rejection, as it was: the skills are those the job asked for at that time. */
IF OBJECT_ID('jobs.Rejections') IS NULL
CREATE TABLE jobs.Rejections
(
    RejectionId   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Rejections PRIMARY KEY,
    ApplicationId INT            NOT NULL,
    PostingId     INT            NOT NULL,
    CompanyId     INT            NOT NULL,
    UserId        INT            NOT NULL,
    CompanyName   NVARCHAR(200)  NOT NULL,
    JobTitle      NVARCHAR(200)  NOT NULL,
    Skills        NVARCHAR(400)  NOT NULL,
    Reason        NVARCHAR(1000) NOT NULL,
    RejectedAt    DATETIME       NOT NULL CONSTRAINT DF_jobs_Rejections_RejectedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Rejections_RejectedAt' AND object_id = OBJECT_ID('jobs.Rejections'))
    CREATE INDEX IX_jobs_Rejections_RejectedAt ON jobs.Rejections(RejectedAt DESC);
GO

/* =============================================================================
   COMPANY · set, move or call off the interview (no @At = call it off)
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Applicant_Interview
    @CompanyId     INT,
    @PostingId     INT,
    @ApplicationId INT,
    @At            DATETIME      = NULL,
    @Mode          NVARCHAR(12)  = NULL,
    @Place         NVARCHAR(300) = NULL,
    @Note          NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Mode  = LTRIM(RTRIM(ISNULL(@Mode, '')));
    SET @Place = LTRIM(RTRIM(ISNULL(@Place, '')));
    SET @Note  = LTRIM(RTRIM(ISNULL(@Note, '')));

    IF @At IS NOT NULL AND @Mode NOT IN ('In person', 'Video', 'Phone')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose how the interview takes place' AS Message; RETURN;
    END
    IF @At IS NOT NULL AND (@At < GETDATE() OR @At > DATEADD(YEAR, 1, GETDATE()))
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose a time in the coming year' AS Message; RETURN;
    END

    DECLARE @Applicant INT, @Status NVARCHAR(12), @Old DATETIME, @Title NVARCHAR(200), @Company NVARCHAR(200);

    BEGIN TRANSACTION;

    SELECT @Applicant = a.UserId, @Status = a.Status, @Old = a.InterviewAt, @Title = p.Title, @Company = p.CompanyName
    FROM jobs.Applications a WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE a.ApplicationId = @ApplicationId AND a.PostingId = @PostingId AND a.Status <> 'Withdrawn';

    IF @Applicant IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END
    IF @At IS NOT NULL AND @Status NOT IN ('Applied', 'Shortlisted')
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'An interview can be set only for an open application' AS Message; RETURN;
    END
    IF @At IS NULL AND @Old IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(1 AS INT) AS Success, 'No interview was set' AS Message; RETURN;
    END

    UPDATE jobs.Applications
    SET InterviewAt    = @At,
        InterviewMode  = CASE WHEN @At IS NULL THEN '' ELSE @Mode END,
        InterviewPlace = CASE WHEN @At IS NULL THEN '' ELSE @Place END,
        InterviewNote  = CASE WHEN @At IS NULL THEN '' ELSE @Note END,
        Status         = CASE WHEN @At IS NOT NULL AND Status = 'Applied' THEN 'Shortlisted' ELSE Status END,
        StatusAt       = CASE WHEN @At IS NOT NULL AND Status = 'Applied' THEN GETDATE() ELSE StatusAt END
    WHERE ApplicationId = @ApplicationId;

    COMMIT TRANSACTION;

    DECLARE @When NVARCHAR(40) = CASE WHEN @At IS NULL THEN '' ELSE FORMAT(@At, 'd MMM yyyy, h:mm tt', 'en-US') END;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @At IS NULL THEN 'The interview is called off' WHEN @Old IS NULL THEN 'Interview set for ' + @When
                ELSE 'Interview moved to ' + @When END AS Message;

    SELECT 'User' AS Audience, @Applicant AS UserId, CAST(NULL AS INT) AS CompanyId, 'JOBPORTAL' AS App, 'Interview' AS Kind,
           CASE WHEN @At IS NULL THEN @Company + ' called off your interview for ' + @Title
                WHEN @Old IS NULL THEN 'Interview for ' + @Title + ' on ' + @When
                ELSE 'Your interview for ' + @Title + ' moved to ' + @When END AS Title,
           @Company + ' · ' + @Title + CASE WHEN @At IS NULL THEN '' ELSE ' · ' + @Mode + CASE WHEN @Place = '' THEN '' ELSE ' · ' + @Place END END AS Body,
           '/apps/jobs' AS Link;
END
GO

/* =============================================================================
   COMPANY · the state of an application, as in script 12. A rejection needs a reason
   (20 characters at least): the person reads it, and it is kept in jobs.Rejections.
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Applicant_SetStatus
    @CompanyId     INT,
    @PostingId     INT,
    @ApplicationId INT,
    @Status        NVARCHAR(12),
    @Reason        NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Reason = LTRIM(RTRIM(ISNULL(@Reason, '')));

    IF @Status NOT IN ('Applied', 'Shortlisted', 'Rejected', 'Hired')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This change is not possible' AS Message; RETURN;
    END
    IF @Status = 'Rejected' AND LEN(@Reason) < 20
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Say why the application is rejected (20 characters at least)' AS Message; RETURN;
    END

    DECLARE @Applicant INT, @Old NVARCHAR(12), @Title NVARCHAR(200), @Company NVARCHAR(200), @Skills NVARCHAR(400);

    BEGIN TRANSACTION;

    SELECT @Applicant = a.UserId, @Old = a.Status, @Title = p.Title, @Company = p.CompanyName, @Skills = p.Skills
    FROM jobs.Applications a WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE a.ApplicationId = @ApplicationId AND a.PostingId = @PostingId AND a.Status <> 'Withdrawn';

    IF @Applicant IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    UPDATE jobs.Applications
    SET Status       = @Status,
        StatusAt     = GETDATE(),
        RejectReason = CASE WHEN @Status = 'Rejected' THEN @Reason ELSE '' END
    WHERE ApplicationId = @ApplicationId;

    IF @Status = 'Rejected'
        INSERT INTO jobs.Rejections (ApplicationId, PostingId, CompanyId, UserId, CompanyName, JobTitle, Skills, Reason)
        VALUES (@ApplicationId, @PostingId, @CompanyId, @Applicant, @Company, @Title, ISNULL(@Skills, ''), @Reason);

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Marked as ' + LOWER(@Status) AS Message;

    /* the person hears of a decision, not of every click: back to Applied says nothing */
    SELECT 'User' AS Audience, @Applicant AS UserId, CAST(NULL AS INT) AS CompanyId, 'JOBPORTAL' AS App, @Status AS Kind,
           CASE @Status
               WHEN 'Shortlisted' THEN 'You are shortlisted for ' + @Title
               WHEN 'Hired'       THEN @Company + ' marked you as hired for ' + @Title
               ELSE                    @Company + ' will not go ahead with your application for ' + @Title
           END AS Title,
           @Company + ' · ' + @Title + CASE WHEN @Status = 'Rejected' THEN ' · ' + LEFT(@Reason, 300) ELSE '' END AS Body,
           '/apps/jobs/applications' AS Link
    WHERE (@Status <> @Old AND @Status IN ('Shortlisted', 'Rejected', 'Hired'));
END
GO

/* =============================================================================
   PERSON · my applications, as in script 06, and the interview and the reason
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Application_ListMine
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT a.ApplicationId, a.PostingId, p.Title, p.CompanyName, p.City, p.EmploymentType, p.WorkMode,
           a.Status, a.Note, a.AppliedAt, a.StatusAt,
           CAST(CASE WHEN p.Status = 'Open' AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today) THEN 1 ELSE 0 END AS BIT) AS IsOpen,
           a.InterviewAt, a.InterviewMode, a.InterviewPlace, a.InterviewNote, a.RejectReason
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId
    WHERE a.UserId = @UserId
    ORDER BY a.AppliedAt DESC, a.ApplicationId DESC;
END
GO

/* =============================================================================
   COMPANY · the applicants of a job, as in script 16, and the interview and the reason
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Applicant_List
    @CompanyId INT,
    @PostingId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT a.ApplicationId, a.Status, a.Note, a.AppliedAt, a.StatusAt,
           ISNULL(pr.FullName, '') AS FullName, ISNULL(pr.Headline, '') AS Headline, ISNULL(pr.City, '') AS City,
           CAST(CASE WHEN EXISTS (SELECT 1 FROM jobs.Files f WHERE f.UserId = a.UserId AND f.Kind = 'Resume') THEN 1 ELSE 0 END AS BIT) AS HasResume,
           CAST(CASE WHEN pr.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified,
           a.InterviewAt, a.InterviewMode, a.InterviewPlace, a.InterviewNote, a.RejectReason
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p  ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    LEFT JOIN jobs.Profiles pr  ON pr.UserId = a.UserId
    WHERE a.PostingId = @PostingId AND a.Status <> 'Withdrawn'
    ORDER BY CASE a.Status WHEN 'Shortlisted' THEN 0 WHEN 'Applied' THEN 1 WHEN 'Hired' THEN 2 ELSE 3 END, a.AppliedAt DESC;
END
GO

/* =============================================================================
   COMPANY · the dashboard: the coming interviews (next 30 days), the latest applicants,
   and the counts of this week and month
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Dashboard
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME = GETDATE();
    DECLARE @WeekAgo DATETIME = DATEADD(DAY, -7, @Now);
    DECLARE @MonthStart DATETIME = DATEFROMPARTS(YEAR(@Now), MONTH(@Now), 1);

    SELECT TOP (10) a.ApplicationId, a.PostingId, p.Title AS PostingTitle, ISNULL(pr.FullName, '') AS FullName,
           a.InterviewAt, a.InterviewMode, a.InterviewPlace
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    LEFT JOIN jobs.Profiles pr ON pr.UserId = a.UserId
    WHERE a.InterviewAt >= DATEADD(HOUR, -2, @Now) AND a.InterviewAt < DATEADD(DAY, 30, @Now)
      AND a.Status IN ('Applied', 'Shortlisted')
      AND ISNULL(@CompanyId, 0) <> 0
    ORDER BY a.InterviewAt;

    SELECT TOP (8) a.ApplicationId, a.PostingId, p.Title AS PostingTitle, ISNULL(pr.FullName, '') AS FullName,
           ISNULL(pr.Headline, '') AS Headline, a.Status, a.AppliedAt,
           CAST(CASE WHEN pr.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    LEFT JOIN jobs.Profiles pr ON pr.UserId = a.UserId
    WHERE a.Status <> 'Withdrawn' AND ISNULL(@CompanyId, 0) <> 0
    ORDER BY a.AppliedAt DESC, a.ApplicationId DESC;

    SELECT SUM(CASE WHEN a.AppliedAt >= @WeekAgo THEN 1 ELSE 0 END) AS NewThisWeek,
           SUM(CASE WHEN a.Status IN ('Applied', 'Shortlisted') AND a.InterviewAt >= @Now AND a.InterviewAt < DATEADD(DAY, 7, @Now) THEN 1 ELSE 0 END) AS InterviewsThisWeek,
           SUM(CASE WHEN a.Status = 'Hired' AND a.StatusAt >= @MonthStart THEN 1 ELSE 0 END) AS HiredThisMonth,
           SUM(CASE WHEN a.Status = 'Rejected' AND a.StatusAt >= @MonthStart THEN 1 ELSE 0 END) AS RejectedThisMonth
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE a.Status <> 'Withdrawn' AND ISNULL(@CompanyId, 0) <> 0;
END
GO

/* =============================================================================
   PLATFORM ADMIN · the rejections: the job, the skills it asked for, the reason
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Admin_Rejection_List
    @Query    NVARCHAR(100) = NULL,
    @Page     INT           = 1,
    @PageSize INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    SET @Query    = LTRIM(RTRIM(ISNULL(@Query, '')));
    SET @Page     = CASE WHEN ISNULL(@Page, 1) < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN ISNULL(@PageSize, 20) < 1 THEN 20 WHEN @PageSize > 50 THEN 50 ELSE @PageSize END;

    -- the wildcard characters of LIKE are taken literally
    SET @Query = REPLACE(REPLACE(REPLACE(@Query, '[', '[[]'), '%', '[%]'), '_', '[_]');

    SELECT r.RejectionId, r.RejectedAt, r.CompanyName, r.JobTitle, r.Skills, r.Reason,
           ISNULL(pr.FullName, '') AS CandidateName, ISNULL(pr.Headline, '') AS CandidateHeadline,
           COUNT(*) OVER () AS TotalCount
    FROM jobs.Rejections r
    LEFT JOIN jobs.Profiles pr ON pr.UserId = r.UserId
    WHERE @Query = '' OR r.CompanyName LIKE '%' + @Query + '%' OR r.JobTitle LIKE '%' + @Query + '%'
          OR r.Skills LIKE '%' + @Query + '%' OR r.Reason LIKE '%' + @Query + '%' OR pr.FullName LIKE '%' + @Query + '%'
    ORDER BY r.RejectedAt DESC, r.RejectionId DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

PRINT 'Job Portal: interviews, reasons for rejections and the dashboards are ready.';
GO
SET NOEXEC OFF;
GO
