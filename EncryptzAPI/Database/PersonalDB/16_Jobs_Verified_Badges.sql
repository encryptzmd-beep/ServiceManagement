/* =============================================================================
   PersonalDB · 16 · Job Portal: a Verified tick on jobs and on people
   -----------------------------------------------------------------------------
   Run AFTER 15_Jobs_Interests_And_Social_Links.sql, in the Personal DB. SAFE TO RE-RUN.
   Run it AGAIN every time script 02, 06, 07, 09, 11, 12 or 13 is run again: those
   scripts re-create procedures below in their earlier form (without the tick).

   Jobs
     A job the platform administrator approved carries jobs.Postings.VerifiedAt and
     VerifiedBy (set by jobs.sp_Admin_Posting_Decide on approval only). A job that is
     open or closed and was approved answers IsVerified = 1. Jobs that are open now
     and were approved before this script get the date of that approval.

   People
     The platform administrator verifies a person (jobs.Profiles.VerifiedAt and
     VerifiedBy) or takes the tick away again, with a reason the person reads.
     Changing the name or the date of birth takes the tick away: what was checked is
     no longer what the profile says.

     jobs.sp_Admin_Person_List     people with a name and a headline, to verify;
                                   @Show 'waiting' (not verified), 'verified' or 'all'
     jobs.sp_Admin_Person_Decide   verified, or the tick taken away; the person is told

   IsVerified is answered by
     jobs.sp_Profile_Get           the person's own page, and through it the candidate
                                   (sp_Candidate_Get) and the applicant (sp_Company_Applicant_Get)
     jobs.sp_Candidate_Search      the candidates of Job Consultancy
     jobs.sp_Company_Applicant_List  the applicants of a job
     jobs.sp_Posting_Search, jobs.sp_Posting_Get, jobs.sp_Saved_ListMine  the job board
     jobs.sp_Company_Posting_List  the company's own jobs

   The procedures for the platform administrator are named sp_Admin_*. They take no
   user or company: the API lets only a platform administrator, with the screen
   unlocked, reach them. A person is named by CandidateKey, never by a user id.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR OBJECT_ID('jobs.SubSkills') IS NULL OR OBJECT_ID('jobs.CandidateInvitations') IS NULL
   OR COL_LENGTH('jobs.Postings', 'ReviewedAt') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run scripts 09 to 15 in it before running this script.', 16, 1);
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
   Columns
   ============================================================================= */
IF COL_LENGTH('jobs.Profiles', 'VerifiedAt') IS NULL
    ALTER TABLE jobs.Profiles ADD VerifiedAt DATETIME NULL, VerifiedBy NVARCHAR(200) NULL;
GO
IF COL_LENGTH('jobs.Postings', 'VerifiedAt') IS NULL
    ALTER TABLE jobs.Postings ADD VerifiedAt DATETIME NULL, VerifiedBy NVARCHAR(200) NULL;
GO

/* a job is open only after an approval (script 09): an open job with a review was approved */
UPDATE jobs.Postings
SET VerifiedAt = ReviewedAt, VerifiedBy = ReviewedBy
WHERE Status = 'Open' AND ReviewedAt IS NOT NULL AND VerifiedAt IS NULL;
GO

/* =============================================================================
   PERSON · the profile; a new name or date of birth takes the tick away
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Profile_Save
    @UserId       INT,
    @FullName     NVARCHAR(200),
    @Headline     NVARCHAR(200),
    @Summary      NVARCHAR(2000) = NULL,
    @City         NVARCHAR(100)  = NULL,
    @ContactEmail NVARCHAR(256)  = NULL,
    @ContactPhone NVARCHAR(30)   = NULL,
    @DateOfBirth  DATE           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @FullName     = LTRIM(RTRIM(ISNULL(@FullName, '')));
    SET @Headline     = LTRIM(RTRIM(ISNULL(@Headline, '')));
    SET @Summary      = LTRIM(RTRIM(ISNULL(@Summary, '')));
    SET @City         = LTRIM(RTRIM(ISNULL(@City, '')));
    SET @ContactEmail = LTRIM(RTRIM(ISNULL(@ContactEmail, '')));
    SET @ContactPhone = LTRIM(RTRIM(ISNULL(@ContactPhone, '')));

    IF @UserId IS NULL OR @UserId = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM jobs.Profiles WITH (UPDLOCK, HOLDLOCK) WHERE UserId = @UserId)
        /* a profile without a name or a headline is never visible; the tick belongs to the
           name and the date of birth that were checked (compared exactly, case included) */
        UPDATE jobs.Profiles
        SET IsVisible  = CASE WHEN @FullName = '' OR @Headline = '' THEN 0 ELSE IsVisible END,
            VerifiedAt = CASE WHEN FullName COLLATE Latin1_General_BIN2 <> @FullName COLLATE Latin1_General_BIN2
                                   OR ISNULL(DateOfBirth, '1900-01-01') <> ISNULL(@DateOfBirth, '1900-01-01')
                              THEN NULL ELSE VerifiedAt END,
            VerifiedBy = CASE WHEN FullName COLLATE Latin1_General_BIN2 <> @FullName COLLATE Latin1_General_BIN2
                                   OR ISNULL(DateOfBirth, '1900-01-01') <> ISNULL(@DateOfBirth, '1900-01-01')
                              THEN NULL ELSE VerifiedBy END,
            FullName = @FullName, Headline = @Headline, Summary = @Summary, City = @City,
            ContactEmail = @ContactEmail, ContactPhone = @ContactPhone, DateOfBirth = @DateOfBirth,
            UpdatedAt = GETDATE()
        WHERE UserId = @UserId;
    ELSE
        INSERT INTO jobs.Profiles (UserId, FullName, Headline, Summary, City, ContactEmail, ContactPhone, DateOfBirth)
        VALUES (@UserId, @FullName, @Headline, @Summary, @City, @ContactEmail, @ContactPhone, @DateOfBirth);

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Profile saved' AS Message;
END
GO

/* The page of a person, as in script 13; the first set says whether the person is verified. */
CREATE OR ALTER PROCEDURE jobs.sp_Profile_Get
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.FullName, p.Headline, p.Summary, p.City, p.ContactEmail, p.ContactPhone,
           p.DateOfBirth, p.IsVisible, p.UpdatedAt,
           CAST(CASE WHEN p.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified
    FROM jobs.Profiles p
    WHERE p.UserId = @UserId;

    SELECT e.ExperienceId, e.Organisation, e.Title, e.StartMonth, e.EndMonth, e.Description
    FROM jobs.Experience e
    WHERE e.UserId = @UserId
    ORDER BY ISNULL(e.EndMonth, '9999-12-31') DESC, e.StartMonth DESC, e.ExperienceId DESC;

    SELECT d.EducationId, d.Institution, d.Course, d.FieldOfStudy, d.StartYear, d.EndYear
    FROM jobs.Education d
    WHERE d.UserId = @UserId
    ORDER BY ISNULL(d.EndYear, 9999) DESC, d.StartYear DESC, d.EducationId DESC;

    SELECT s.SkillId, s.SkillName, s.Level, s.Rating, ISNULL(s.EvidenceUrl, '') AS EvidenceUrl
    FROM jobs.Skills s
    WHERE s.UserId = @UserId
    ORDER BY s.SkillName;

    SELECT c.CertificateId, c.Title, c.Issuer, c.IssuedOn, c.Status,
           ISNULL(c.FileId, 0) AS FileId, ISNULL(f.FileName, '') AS FileName, ISNULL(f.SizeBytes, 0) AS SizeBytes
    FROM jobs.Certificates c
    LEFT JOIN jobs.Files f ON f.FileId = c.FileId AND f.UserId = @UserId
    WHERE c.UserId = @UserId
    ORDER BY ISNULL(c.IssuedOn, '1900-01-01') DESC, c.CertificateId DESC;

    SELECT TOP (1) f.FileId, f.FileName, f.SizeBytes, f.UploadedAt
    FROM jobs.Files f
    WHERE f.UserId = @UserId AND f.Kind = 'Resume'
    ORDER BY f.FileId DESC;

    SELECT u.SubSkillId, u.SkillId, u.SubSkillName, u.Rating
    FROM jobs.SubSkills u
    WHERE u.UserId = @UserId
    ORDER BY u.SkillId, u.SortOrder, u.SubSkillId;
END
GO

/* =============================================================================
   COMPANY · candidates and applicants, as in scripts 11 and 06, with the tick
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Candidate_Search
    @CompanyId INT,
    @Query     NVARCHAR(100) = NULL,
    @City      NVARCHAR(100) = NULL,
    @MinYears  INT           = NULL,
    @WorkMode  NVARCHAR(20)  = NULL,
    @Keys      NVARCHAR(MAX) = NULL,   -- JSON array of CandidateKeys: only these (the company's pool)
    @Page      INT           = 1,
    @PageSize  INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    SET @Query    = LTRIM(RTRIM(ISNULL(@Query, '')));
    SET @City     = LTRIM(RTRIM(ISNULL(@City, '')));
    SET @WorkMode = LTRIM(RTRIM(ISNULL(@WorkMode, '')));
    SET @Page     = CASE WHEN ISNULL(@Page, 1) < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN ISNULL(@PageSize, 20) < 1 THEN 20 WHEN @PageSize > 50 THEN 50 ELSE @PageSize END;
    IF @Keys IS NOT NULL AND ISJSON(@Keys) = 0 SET @Keys = '[]';

    -- the wildcard characters of LIKE are taken literally
    SET @Query = REPLACE(REPLACE(REPLACE(@Query, '[', '[[]'), '%', '[%]'), '_', '[_]');
    SET @City  = REPLACE(REPLACE(REPLACE(@City,  '[', '[[]'), '%', '[%]'), '_', '[_]');

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT pr.CandidateKey, pr.FullName, pr.Headline, pr.City,
           ISNULL(x.Months, 0) / 12 AS ExperienceYears,
           ISNULL((SELECT STRING_AGG(s.SkillName, ', ') FROM (SELECT TOP (8) sk.SkillName FROM jobs.Skills sk
                   WHERE sk.UserId = pr.UserId ORDER BY CASE sk.Level WHEN 'Expert' THEN 0 WHEN 'Intermediate' THEN 1 ELSE 2 END, sk.SkillName) s), '') AS Skills,
           ISNULL((SELECT STRING_AGG(j.Value, ', ') FROM jobs.Preferences j WHERE j.UserId = pr.UserId AND j.Kind = 'Job'), '') AS PreferredJobs,
           ISNULL((SELECT STRING_AGG(w.Value, ', ') FROM jobs.Preferences w WHERE w.UserId = pr.UserId AND w.Kind = 'WorkMode'), '') AS WorkModes,
           CAST(CASE WHEN EXISTS (SELECT 1 FROM jobs.Files f WHERE f.UserId = pr.UserId AND f.Kind = 'Resume') THEN 1 ELSE 0 END AS BIT) AS HasResume,
           CAST(CASE WHEN pr.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified,
           COUNT(*) OVER () AS TotalCount
    FROM jobs.Profiles pr
    OUTER APPLY (SELECT SUM(DATEDIFF(MONTH, e.StartMonth, ISNULL(e.EndMonth, @Today)) + 1) AS Months
                 FROM jobs.Experience e WHERE e.UserId = pr.UserId) x
    WHERE pr.IsVisible = 1 AND pr.FullName <> '' AND pr.Headline <> '' AND ISNULL(@CompanyId, 0) <> 0
      AND (@Keys IS NULL OR pr.CandidateKey IN (SELECT TRY_CAST(k.value AS UNIQUEIDENTIFIER) FROM OPENJSON(@Keys) k))
      AND (@Query = '' OR pr.FullName LIKE '%' + @Query + '%' OR pr.Headline LIKE '%' + @Query + '%' OR pr.Summary LIKE '%' + @Query + '%'
           OR EXISTS (SELECT 1 FROM jobs.Skills sk WHERE sk.UserId = pr.UserId AND sk.SkillName LIKE '%' + @Query + '%')
           OR EXISTS (SELECT 1 FROM jobs.Preferences j WHERE j.UserId = pr.UserId AND j.Kind = 'Job' AND j.Value LIKE '%' + @Query + '%'))
      AND (@City = '' OR pr.City LIKE '%' + @City + '%'
           OR EXISTS (SELECT 1 FROM jobs.Preferences l WHERE l.UserId = pr.UserId AND l.Kind = 'Location' AND l.Value LIKE '%' + @City + '%'))
      AND (@MinYears IS NULL OR ISNULL(x.Months, 0) >= @MinYears * 12)
      AND (@WorkMode = '' OR EXISTS (SELECT 1 FROM jobs.Preferences w WHERE w.UserId = pr.UserId AND w.Kind = 'WorkMode' AND w.Value = @WorkMode))
    ORDER BY pr.UpdatedAt DESC, pr.CandidateKey
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Company_Applicant_List
    @CompanyId INT,
    @PostingId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT a.ApplicationId, a.Status, a.Note, a.AppliedAt, a.StatusAt,
           ISNULL(pr.FullName, '') AS FullName, ISNULL(pr.Headline, '') AS Headline, ISNULL(pr.City, '') AS City,
           CAST(CASE WHEN EXISTS (SELECT 1 FROM jobs.Files f WHERE f.UserId = a.UserId AND f.Kind = 'Resume') THEN 1 ELSE 0 END AS BIT) AS HasResume,
           CAST(CASE WHEN pr.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p  ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    LEFT JOIN jobs.Profiles pr  ON pr.UserId = a.UserId
    WHERE a.PostingId = @PostingId AND a.Status <> 'Withdrawn'
    ORDER BY CASE a.Status WHEN 'Shortlisted' THEN 0 WHEN 'Applied' THEN 1 WHEN 'Hired' THEN 2 ELSE 3 END, a.AppliedAt DESC;
END
GO

/* =============================================================================
   PERSON · the job board, as in scripts 07 and 06, with the tick
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Posting_Search
    @UserId         INT,
    @Query          NVARCHAR(100) = NULL,
    @City           NVARCHAR(100) = NULL,
    @EmploymentType NVARCHAR(20)  = NULL,
    @WorkMode       NVARCHAR(20)  = NULL,
    @Page           INT           = 1,
    @PageSize       INT           = 20,
    @Sort           NVARCHAR(10)  = 'match'
AS
BEGIN
    SET NOCOUNT ON;

    SET @Query          = LTRIM(RTRIM(ISNULL(@Query, '')));
    SET @City           = LTRIM(RTRIM(ISNULL(@City, '')));
    SET @EmploymentType = LTRIM(RTRIM(ISNULL(@EmploymentType, '')));
    SET @WorkMode       = LTRIM(RTRIM(ISNULL(@WorkMode, '')));
    SET @Page           = CASE WHEN ISNULL(@Page, 1) < 1 THEN 1 ELSE @Page END;
    SET @PageSize       = CASE WHEN ISNULL(@PageSize, 20) < 1 THEN 20 WHEN @PageSize > 50 THEN 50 ELSE @PageSize END;
    SET @Sort           = CASE WHEN @Sort = 'newest' THEN 'newest' ELSE 'match' END;

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
           CAST(CASE WHEN p.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified,
           m.MatchScore,
           COUNT(*) OVER () AS TotalCount
    FROM jobs.Postings p
    LEFT JOIN jobs.SavedPostings s ON s.PostingId = p.PostingId AND s.UserId = @UserId
    LEFT JOIN jobs.Applications a  ON a.PostingId = p.PostingId AND a.UserId = @UserId
    CROSS APPLY (
        SELECT
            CASE WHEN EXISTS (SELECT 1 FROM jobs.Preferences j
                              WHERE j.UserId = @UserId AND j.Kind = 'Job'
                                AND (p.Title  LIKE '%' + REPLACE(REPLACE(REPLACE(j.Value, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%'
                                  OR p.Skills LIKE '%' + REPLACE(REPLACE(REPLACE(j.Value, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%'))
                 THEN 3 ELSE 0 END
          + CASE WHEN EXISTS (SELECT 1 FROM jobs.Preferences l
                              WHERE l.UserId = @UserId AND l.Kind = 'Location'
                                AND p.City LIKE '%' + REPLACE(REPLACE(REPLACE(l.Value, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%')
                 THEN 2 ELSE 0 END
          + CASE WHEN EXISTS (SELECT 1 FROM jobs.Preferences w
                              WHERE w.UserId = @UserId AND w.Kind = 'WorkMode' AND w.Value = p.WorkMode)
                 THEN 1 ELSE 0 END AS MatchScore
    ) m
    WHERE p.Status = 'Open'
      AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today)
      AND (@Query = '' OR p.Title LIKE '%' + @Query + '%' OR p.Skills LIKE '%' + @Query + '%'
                       OR p.CompanyName LIKE '%' + @Query + '%' OR p.Description LIKE '%' + @Query + '%')
      AND (@City = '' OR p.City LIKE '%' + @City + '%')
      AND (@EmploymentType = '' OR p.EmploymentType = @EmploymentType)
      AND (@WorkMode = '' OR p.WorkMode = @WorkMode)
    ORDER BY CASE WHEN @Sort = 'match' THEN m.MatchScore ELSE 0 END DESC, p.PublishedAt DESC, p.PostingId DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

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
           CAST(CASE WHEN p.Status = 'Open' AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today) THEN 1 ELSE 0 END AS BIT) AS IsOpen,
           CAST(CASE WHEN p.VerifiedAt IS NOT NULL AND p.Status IN ('Open', 'Closed') THEN 1 ELSE 0 END AS BIT) AS IsVerified
    FROM jobs.Postings p
    LEFT JOIN jobs.SavedPostings s ON s.PostingId = p.PostingId AND s.UserId = @UserId
    LEFT JOIN jobs.Applications a  ON a.PostingId = p.PostingId AND a.UserId = @UserId
    WHERE p.PostingId = @PostingId
      AND p.Status <> 'Draft'
      AND ((p.Status = 'Open' AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today)) OR a.ApplicationId IS NOT NULL);
END
GO

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
           CAST(CASE WHEN p.Status = 'Open' AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today) THEN 1 ELSE 0 END AS BIT) AS IsOpen,
           CAST(CASE WHEN p.VerifiedAt IS NOT NULL AND p.Status IN ('Open', 'Closed') THEN 1 ELSE 0 END AS BIT) AS IsVerified
    FROM jobs.SavedPostings s
    INNER JOIN jobs.Postings p    ON p.PostingId = s.PostingId AND p.Status <> 'Draft'
    LEFT JOIN jobs.Applications a ON a.PostingId = p.PostingId AND a.UserId = @UserId
    WHERE s.UserId = @UserId
    ORDER BY s.SavedAt DESC, p.PostingId DESC;
END
GO

/* =============================================================================
   COMPANY · its own jobs, as in script 09, with the tick
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Posting_List
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.PostingId, p.Title, p.City, p.EmploymentType, p.WorkMode,
           p.ExperienceMinYears, p.ExperienceMaxYears, p.SalaryMin, p.SalaryMax, p.Skills,
           p.Status, p.ClosesOn, p.PublishedAt, p.CreatedAt, ISNULL(p.ReviewNote, '') AS ReviewNote,
           CAST(CASE WHEN p.VerifiedAt IS NOT NULL AND p.Status IN ('Open', 'Closed') THEN 1 ELSE 0 END AS BIT) AS IsVerified,
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

/* =============================================================================
   PLATFORM ADMIN · a job, as in script 12; an approval is the job's tick
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
        VerifiedAt  = CASE WHEN @Approved = 1 THEN GETDATE() ELSE VerifiedAt END,
        VerifiedBy  = CASE WHEN @Approved = 1 THEN @AdminName ELSE VerifiedBy END,
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
   PLATFORM ADMIN · people
   ============================================================================= */

/* People with a name and a headline, the latest change first. Never a user id. */
CREATE OR ALTER PROCEDURE jobs.sp_Admin_Person_List
    @Query    NVARCHAR(100) = NULL,
    @Show     NVARCHAR(10)  = 'waiting',   -- 'waiting' (not verified), 'verified', 'all'
    @Page     INT           = 1,
    @PageSize INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    SET @Query    = LTRIM(RTRIM(ISNULL(@Query, '')));
    SET @Show     = CASE WHEN @Show IN ('verified', 'all') THEN @Show ELSE 'waiting' END;
    SET @Page     = CASE WHEN ISNULL(@Page, 1) < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN ISNULL(@PageSize, 20) < 1 THEN 20 WHEN @PageSize > 50 THEN 50 ELSE @PageSize END;

    -- the wildcard characters of LIKE are taken literally
    SET @Query = REPLACE(REPLACE(REPLACE(@Query, '[', '[[]'), '%', '[%]'), '_', '[_]');

    SELECT pr.CandidateKey, pr.FullName, pr.Headline, pr.City, pr.ContactEmail, pr.ContactPhone,
           pr.DateOfBirth, pr.IsVisible, pr.VerifiedAt, ISNULL(pr.VerifiedBy, '') AS VerifiedBy, pr.UpdatedAt,
           (SELECT COUNT(*) FROM jobs.Experience e WHERE e.UserId = pr.UserId) AS ExperienceCount,
           (SELECT COUNT(*) FROM jobs.Certificates c WHERE c.UserId = pr.UserId AND c.Status = 'Verified') AS VerifiedCertificates,
           CAST(CASE WHEN EXISTS (SELECT 1 FROM jobs.Files f WHERE f.UserId = pr.UserId AND f.Kind = 'Resume') THEN 1 ELSE 0 END AS BIT) AS HasResume,
           COUNT(*) OVER () AS TotalCount
    FROM jobs.Profiles pr
    WHERE pr.FullName <> '' AND pr.Headline <> ''
      AND (@Show = 'all' OR (@Show = 'verified' AND pr.VerifiedAt IS NOT NULL) OR (@Show = 'waiting' AND pr.VerifiedAt IS NULL))
      AND (@Query = '' OR pr.FullName LIKE '%' + @Query + '%' OR pr.Headline LIKE '%' + @Query + '%'
           OR pr.ContactEmail LIKE '%' + @Query + '%' OR pr.ContactPhone LIKE '%' + @Query + '%')
    ORDER BY pr.UpdatedAt DESC, pr.CandidateKey
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* Verified, or the tick taken away (with a reason); the person is told. The profile's
   UpdatedAt stays: it is the person's last change, and orders the candidates. */
CREATE OR ALTER PROCEDURE jobs.sp_Admin_Person_Decide
    @CandidateKey UNIQUEIDENTIFIER,
    @Verified     BIT,
    @Note         NVARCHAR(500) = NULL,
    @AdminName    NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Verified = ISNULL(@Verified, 0);
    SET @Note     = NULLIF(LTRIM(RTRIM(ISNULL(@Note, ''))), '');

    IF @Verified = 0 AND @Note IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Say why the tick is taken away. The person reads it' AS Message; RETURN;
    END

    UPDATE jobs.Profiles
    SET VerifiedAt = CASE WHEN @Verified = 1 THEN GETDATE() ELSE NULL END,
        VerifiedBy = CASE WHEN @Verified = 1 THEN @AdminName ELSE NULL END
    WHERE CandidateKey = @CandidateKey AND FullName <> '' AND Headline <> ''
      AND ((@Verified = 1 AND VerifiedAt IS NULL) OR (@Verified = 0 AND VerifiedAt IS NOT NULL));

    IF @@ROWCOUNT = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success,
               CASE WHEN @Verified = 1 THEN 'This person is verified already, or the profile changed' ELSE 'This person is not verified' END AS Message;
        RETURN;
    END

    SELECT CAST(1 AS INT) AS Success, CASE WHEN @Verified = 1 THEN 'Person verified' ELSE 'Verification taken away' END AS Message;

    SELECT 'User' AS Audience, pr.UserId, CAST(NULL AS INT) AS CompanyId, 'JOBPORTAL' AS App,
           CASE WHEN @Verified = 1 THEN 'ProfileVerified' ELSE 'ProfileUnverified' END AS Kind,
           CASE WHEN @Verified = 1 THEN 'Your profile is verified. Employers see the Verified tick'
                ELSE 'The Verified tick was taken away from your profile' END AS Title,
           ISNULL(@Note, '') AS Body, '/apps/jobs' AS Link
    FROM jobs.Profiles pr
    WHERE pr.CandidateKey = @CandidateKey;
END
GO

PRINT 'Job Portal: the Verified tick on jobs and people is in place.';
GO
SET NOEXEC OFF;
GO
