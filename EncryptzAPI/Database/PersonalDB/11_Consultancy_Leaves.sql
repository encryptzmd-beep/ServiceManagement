/* =============================================================================
   PersonalDB · 11 · The data of Job Consultancy leaves the Personal DB
   -----------------------------------------------------------------------------
   Run AFTER 10_Consultancy.sql, in the Personal DB. SAFE TO RE-RUN.
   Do NOT run script 10 again after this one; if it was run, run this one again.

   The Personal DB keeps only the data of free applications. Job Consultancy is a
   commercial application: its clients, candidate pool and placements live in each
   company's own database (ProjectDB/11_Consultancy.sql). What stays here belongs
   to Job Portal, the free application people use:

     jobs.CandidateInvitations     a company invited a person to apply for a job
                                   (it was consult.Invitations; its rows are kept)
     jobs.sp_Candidate_Search      people who chose "Employers can find me"; with
                                   @Keys (a JSON array of CandidateKeys) only those
     jobs.sp_Candidate_Find        whether a key names a person who can be found,
                                   and the name (no look is written down)
     jobs.sp_Candidate_Get         the profile of a candidate; the look is written down
     jobs.sp_Candidate_Resume      the resume of a candidate; the look is written down
     jobs.sp_Candidate_Invite      invites a person to apply; the person is told
     jobs.sp_Company_Applicant_Identity  the key and name of an applicant of one of
                                   the company's jobs (for a placement)

   Removed: consult.Clients, consult.Talent, consult.Placements, consult.Invitations,
   jobs.Postings.ClientId and every procedure of schema consult, then the schema.
   The script REFUSES to remove anything while consult.Clients, consult.Talent or
   consult.Placements hold rows: those rows belong in the company database first.

   Every procedure that reads a person for a company takes @CompanyId first, and
   every read of jobs.Profiles names IsVisible = 1 (except the applicant of one of
   the company's own jobs). A company never receives a user id.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR COL_LENGTH('jobs.Profiles', 'CandidateKey') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 10_Consultancy.sql in it before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
BEGIN
    RAISERROR('This database is not marked as the Personal DB. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

/* nothing a company wrote is thrown away */
DECLARE @rows INT = 0;
IF OBJECT_ID('consult.Clients') IS NOT NULL    SELECT @rows = @rows + COUNT(*) FROM consult.Clients;
IF OBJECT_ID('consult.Talent') IS NOT NULL     SELECT @rows = @rows + COUNT(*) FROM consult.Talent;
IF OBJECT_ID('consult.Placements') IS NOT NULL SELECT @rows = @rows + COUNT(*) FROM consult.Placements;
IF @rows > 0
BEGIN
    RAISERROR('consult.Clients, consult.Talent or consult.Placements hold %d rows. Move them to the company databases first. Nothing was changed.', 16, 1, @rows);
    SET NOEXEC ON;
END
GO

/* =============================================================================
   Invitations stay with Job Portal
   ============================================================================= */
IF OBJECT_ID('jobs.CandidateInvitations') IS NULL
CREATE TABLE jobs.CandidateInvitations
(
    InvitationId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_CandidateInvitations PRIMARY KEY,
    CompanyId    INT           NOT NULL,
    PostingId    INT           NOT NULL CONSTRAINT FK_jobs_CandidateInvitations_Postings REFERENCES jobs.Postings(PostingId),
    UserId       INT           NOT NULL,
    Message      NVARCHAR(500) NOT NULL CONSTRAINT DF_jobs_CandidateInvitations_Message DEFAULT (''),
    InvitedBy    INT           NOT NULL,
    InvitedAt    DATETIME      NOT NULL CONSTRAINT DF_jobs_CandidateInvitations_InvitedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_jobs_CandidateInvitations_Posting_User UNIQUE (PostingId, UserId)
);
GO

IF OBJECT_ID('consult.Invitations') IS NOT NULL
    INSERT INTO jobs.CandidateInvitations (CompanyId, PostingId, UserId, Message, InvitedBy, InvitedAt)
    SELECT i.CompanyId, i.PostingId, i.UserId, i.Message, i.InvitedBy, i.InvitedAt
    FROM consult.Invitations i
    WHERE NOT EXISTS (SELECT 1 FROM jobs.CandidateInvitations c WHERE c.PostingId = i.PostingId AND c.UserId = i.UserId);
GO

/* =============================================================================
   Schema consult leaves
   ============================================================================= */
DECLARE @drop NVARCHAR(MAX) = N'';
SELECT @drop = @drop + N'DROP PROCEDURE consult.' + QUOTENAME(p.name) + N'; '
FROM sys.procedures p WHERE p.schema_id = SCHEMA_ID('consult');
IF @drop <> N'' EXEC sp_executesql @drop;
GO

IF OBJECT_ID('jobs.FK_jobs_Postings_Clients', 'F') IS NOT NULL
    ALTER TABLE jobs.Postings DROP CONSTRAINT FK_jobs_Postings_Clients;
GO
IF COL_LENGTH('jobs.Postings', 'ClientId') IS NOT NULL
    ALTER TABLE jobs.Postings DROP COLUMN ClientId;
GO

IF OBJECT_ID('consult.Placements') IS NOT NULL  DROP TABLE consult.Placements;
IF OBJECT_ID('consult.Talent') IS NOT NULL      DROP TABLE consult.Talent;
IF OBJECT_ID('consult.Invitations') IS NOT NULL DROP TABLE consult.Invitations;
IF OBJECT_ID('consult.Clients') IS NOT NULL     DROP TABLE consult.Clients;
GO
IF SCHEMA_ID('consult') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.objects WHERE schema_id = SCHEMA_ID('consult'))
    EXEC('DROP SCHEMA consult');
GO

/* =============================================================================
   COMPANY · candidates (people who chose "Employers can find me")
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

/* Whether a key names a person who can be found, and the name. Nothing is written down. */
CREATE OR ALTER PROCEDURE jobs.sp_Candidate_Find
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    SELECT pr.CandidateKey, pr.FullName
    FROM jobs.Profiles pr
    WHERE pr.CandidateKey = @CandidateKey AND pr.IsVisible = 1 AND ISNULL(@CompanyId, 0) <> 0;
END
GO

/* One candidate: the key (first result set; no row = not found), the preferences
   (jobs, places, modes; never the expected CTC), then the profile page as
   jobs.sp_Profile_Get gives it. The look is written down with the company's name. */
CREATE OR ALTER PROCEDURE jobs.sp_Candidate_Get
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER,
    @ViewerUserId INT,
    @CompanyName  NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Person INT;
    SELECT @Person = pr.UserId FROM jobs.Profiles pr WHERE pr.CandidateKey = @CandidateKey AND pr.IsVisible = 1 AND ISNULL(@CompanyId, 0) <> 0;

    SELECT pr.CandidateKey FROM jobs.Profiles pr WHERE pr.UserId = @Person AND pr.IsVisible = 1;

    IF @Person IS NULL RETURN;

    SELECT p.Kind, p.Value
    FROM jobs.Preferences p
    INNER JOIN jobs.Profiles pr ON pr.UserId = p.UserId AND pr.IsVisible = 1
    WHERE p.UserId = @Person AND p.Kind IN ('Job', 'Location', 'WorkMode')
    ORDER BY p.Kind, p.SortOrder;

    INSERT INTO jobs.ProfileViews (CompanyId, CompanyName, ViewerUserId, UserId, PostingId, What)
    SELECT @CompanyId, @CompanyName, ISNULL(@ViewerUserId, 0), pr.UserId, NULL, 'Profile'
    FROM jobs.Profiles pr WHERE pr.UserId = @Person AND pr.IsVisible = 1;

    EXEC jobs.sp_Profile_Get @UserId = @Person;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Candidate_Resume
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER,
    @ViewerUserId INT,
    @CompanyName  NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Person INT;
    SELECT @Person = pr.UserId FROM jobs.Profiles pr WHERE pr.CandidateKey = @CandidateKey AND pr.IsVisible = 1 AND ISNULL(@CompanyId, 0) <> 0;

    IF @Person IS NULL OR NOT EXISTS (SELECT 1 FROM jobs.Files WHERE UserId = @Person AND Kind = 'Resume') RETURN;

    INSERT INTO jobs.ProfileViews (CompanyId, CompanyName, ViewerUserId, UserId, PostingId, What)
    VALUES (@CompanyId, @CompanyName, ISNULL(@ViewerUserId, 0), @Person, NULL, 'Resume');

    SELECT TOP (1) f.FileName, f.ContentType, f.Content
    FROM jobs.Files f
    INNER JOIN jobs.Profiles pr ON pr.UserId = f.UserId AND pr.IsVisible = 1
    WHERE f.UserId = @Person AND f.Kind = 'Resume'
    ORDER BY f.FileId DESC;
END
GO

/* Invites a candidate to apply for an open job of the company; the person is told once. */
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

    INSERT INTO jobs.Notifications (UserId, Kind, Title, Body, Link)
    SELECT pr.UserId, 'Invitation',
           @Company + ' invites you to apply for ' + @Title,
           LTRIM(RTRIM(ISNULL(@Message, ''))),
           '/apps/jobs/search?posting=' + CAST(@PostingId AS NVARCHAR(12))
    FROM jobs.Profiles pr WHERE pr.UserId = @Person AND pr.IsVisible = 1;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Invitation sent' AS Message;
END
GO

/* The key and the name of an applicant of one of the company's jobs who did not
   withdraw, and the job (for a placement). No row = not found. */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Applicant_Identity
    @CompanyId     INT,
    @ApplicationId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT pr.CandidateKey, pr.FullName, a.PostingId, p.Title
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    INNER JOIN jobs.Profiles pr ON pr.UserId = a.UserId
    WHERE a.ApplicationId = @ApplicationId AND a.Status <> 'Withdrawn';
END
GO

PRINT 'Job Consultancy left the Personal DB; Job Portal keeps candidates, invitations and the job board.';
GO
SET NOEXEC OFF;
GO
