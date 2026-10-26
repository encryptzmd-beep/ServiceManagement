/* =============================================================================
   PersonalDB · 24 · Job Consultancy: suitable candidates for each job posting
   -----------------------------------------------------------------------------
   Run AFTER 23_Jobs_Candidate_Experience.sql, in the Personal DB. SAFE TO RE-RUN.
   It changes no table and no row.

   For one job of the company, the people who fit it, best first. A person is suitable when
   they let employers find them (IsVisible, with a name and a headline), did not apply to
   the job already (they are among its applicants), and have at least one of its skills or
   one word of its title in their headline, a past job title or a job they look for.

   How well (MatchScore):
     3  each skill of the job the person has (a skill, or a sub-skill, that contains it,
        or is contained in it: "Tally" ~ "Tally ERP 9")
     3  each word of the title (three letters or more, without "and", "for", "urgent"...)
        in the headline, a past job title or a job the person looks for
     2  the city of the job: the person's city, or a place they look for
     2  the experience in the range of the job (the experience entered, else the years in
        the headline, as script 23)
     1  the working mode of the job is one the person looks for
     1  verified by Encryptz

     jobs.fn_Posting_Fit           how each suitable person fits one job (shared)
     jobs.sp_Posting_Matches       the suitable people of one job of the company, with why
     jobs.sp_Posting_Match_Counts  how many suitable people each open job of the company has

   A company gets CandidateKeys, never a user id.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR COL_LENGTH('jobs.Profiles', 'VerifiedAt') IS NULL OR OBJECT_ID('jobs.CandidateInvitations') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run scripts 11 to 23 in it before running this script.', 16, 1);
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
   How each suitable person fits one job. Text taken from a job or a person goes into LIKE
   with its wildcard characters taken literally.
   ============================================================================= */
CREATE OR ALTER FUNCTION jobs.fn_Posting_Fit (@PostingId INT)
RETURNS TABLE
AS
RETURN
WITH job AS (
    SELECT p.PostingId, p.Title, p.City, p.WorkMode, p.ExperienceMinYears AS MinYears, p.ExperienceMaxYears AS MaxYears,
           ISNULL(p.Skills, '') AS Skills,
           REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(p.City, ''))), '[', '[[]'), '%', '[%]'), '_', '[_]') AS CityPat
    FROM jobs.Postings p
    WHERE p.PostingId = @PostingId
),
wanted AS (
    SELECT DISTINCT LTRIM(RTRIM(s.value)) AS Skill,
           '%' + REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(s.value)), '[', '[[]'), '%', '[%]'), '_', '[_]') + '%' AS Pat
    FROM job CROSS APPLY STRING_SPLIT(job.Skills, ',') s
    WHERE LTRIM(RTRIM(s.value)) <> ''
),
words AS (
    SELECT DISTINCT '%' + REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(w.value)), '[', '[[]'), '%', '[%]'), '_', '[_]') + '%' AS Pat
    FROM job CROSS APPLY STRING_SPLIT(REPLACE(REPLACE(REPLACE(REPLACE(job.Title, ',', ' '), '/', ' '), '-', ' '), '(', ' '), ' ') w
    WHERE LEN(LTRIM(RTRIM(w.value))) >= 3
      AND LOWER(LTRIM(RTRIM(w.value))) NOT IN ('and', 'the', 'for', 'with', 'from', 'job', 'jobs', 'needed', 'urgent', 'urgently',
                                               'required', 'wanted', 'hiring', 'opening', 'vacancy', 'immediate', 'joiner', 'joiners')
)
SELECT pr.UserId, y.Months, y.Source,
       sk.SkillHits, ISNULL(sk.MatchedSkills, '') AS MatchedSkills, (SELECT COUNT(*) FROM wanted) AS SkillsWanted,
       tt.TitleHits,
       CAST(CASE WHEN job.CityPat <> '' AND (pr.City LIKE '%' + job.CityPat + '%'
                                             OR (LEN(pr.City) >= 3 AND job.City LIKE '%' + REPLACE(REPLACE(REPLACE(pr.City, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%')
                                             OR EXISTS (SELECT 1 FROM jobs.Preferences l WHERE l.UserId = pr.UserId AND l.Kind = 'Location'
                                                        AND l.Value LIKE '%' + job.CityPat + '%'))
                 THEN 1 ELSE 0 END AS BIT) AS CityMatch,
       CAST(CASE WHEN EXISTS (SELECT 1 FROM jobs.Preferences w WHERE w.UserId = pr.UserId AND w.Kind = 'WorkMode' AND w.Value = job.WorkMode)
                 THEN 1 ELSE 0 END AS BIT) AS ModeMatch,
       /* 1 in the range, 0 out of it, NULL when the job names no range or the experience is not known */
       CASE WHEN y.Months IS NULL OR (job.MinYears IS NULL AND job.MaxYears IS NULL) THEN NULL
            WHEN (job.MinYears IS NULL OR y.Months >= job.MinYears * 12)
             AND (job.MaxYears IS NULL OR y.Months < (job.MaxYears + 1) * 12) THEN 1 ELSE 0 END AS ExperienceFit
FROM job
CROSS JOIN jobs.Profiles pr
OUTER APPLY (SELECT SUM(DATEDIFF(MONTH, e.StartMonth, ISNULL(e.EndMonth, CAST(GETDATE() AS DATE))) + 1) AS Months
             FROM jobs.Experience e WHERE e.UserId = pr.UserId) x
/* the years in the headline, as script 23: "Teacher, 6 years" -> 6 */
CROSS APPLY (SELECT LOWER(pr.Headline) AS H) h0
CROSS APPLY (SELECT NULLIF(CASE WHEN CHARINDEX('year', h0.H) > 0 THEN CHARINDEX('year', h0.H) ELSE CHARINDEX('yr', h0.H) END, 0) AS P) h1
CROSS APPLY (SELECT REVERSE(RTRIM(REPLACE(LEFT(h0.H, h1.P - 1), '+', ''))) AS R) h2
CROSS APPLY (SELECT CASE WHEN h2.R LIKE '[0-9]%' THEN TRY_CAST(REVERSE(LEFT(h2.R, PATINDEX('%[^0-9.]%', h2.R + ' ') - 1)) AS DECIMAL(5, 1)) END AS Years) h3
CROSS APPLY (SELECT CASE WHEN x.Months IS NOT NULL THEN x.Months
                         WHEN h3.Years BETWEEN 0 AND 50 THEN CAST(h3.Years * 12 AS INT) END AS Months,
                    CASE WHEN x.Months IS NOT NULL THEN 'Entries'
                         WHEN h3.Years BETWEEN 0 AND 50 THEN 'Headline' ELSE 'None' END AS Source) y
/* the skills of the job the person has */
CROSS APPLY (SELECT COUNT(*) AS SkillHits, STRING_AGG(k.Skill, ', ') AS MatchedSkills
             FROM wanted k
             WHERE EXISTS (SELECT 1 FROM jobs.Skills s WHERE s.UserId = pr.UserId
                             AND (s.SkillName LIKE k.Pat
                                  OR (LEN(s.SkillName) >= 3 AND k.Skill LIKE '%' + REPLACE(REPLACE(REPLACE(s.SkillName, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%')))
                OR EXISTS (SELECT 1 FROM jobs.SubSkills u WHERE u.UserId = pr.UserId AND u.SubSkillName LIKE k.Pat)) sk
/* the words of the title in the headline, a past job title or a job the person looks for */
CROSS APPLY (SELECT COUNT(*) AS TitleHits
             FROM words w
             WHERE pr.Headline LIKE w.Pat
                OR EXISTS (SELECT 1 FROM jobs.Experience e WHERE e.UserId = pr.UserId AND e.Title LIKE w.Pat)
                OR EXISTS (SELECT 1 FROM jobs.Preferences j WHERE j.UserId = pr.UserId AND j.Kind = 'Job' AND j.Value LIKE w.Pat)) tt
WHERE pr.IsVisible = 1 AND pr.FullName <> '' AND pr.Headline <> ''
  AND sk.SkillHits + tt.TitleHits >= 1
  /* an applicant is in the list of applicants of the job, not here */
  AND NOT EXISTS (SELECT 1 FROM jobs.Applications a WHERE a.PostingId = job.PostingId AND a.UserId = pr.UserId AND a.Status <> 'Withdrawn');
GO

/* =============================================================================
   COMPANY · the suitable people of one of its jobs, best first, with why
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Posting_Matches
    @CompanyId INT,
    @PostingId INT,
    @Count     INT = 30
AS
BEGIN
    SET NOCOUNT ON;

    SET @Count = CASE WHEN ISNULL(@Count, 30) < 1 THEN 30 WHEN @Count > 100 THEN 100 ELSE @Count END;

    IF ISNULL(@CompanyId, 0) = 0 OR NOT EXISTS (SELECT 1 FROM jobs.Postings WHERE PostingId = @PostingId AND CompanyId = @CompanyId)
    BEGIN
        /* not a job of this company: nobody (the columns of the answer, no row) */
        SELECT TOP (0) CAST(NULL AS UNIQUEIDENTIFIER) AS CandidateKey; RETURN;
    END

    SELECT TOP (@Count)
           pr.CandidateKey, pr.FullName, pr.Headline, pr.City,
           ISNULL(f.Months, 0) / 12 AS ExperienceYears, f.Source AS ExperienceSource,
           CAST(CASE WHEN pr.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified,
           CAST(CASE WHEN EXISTS (SELECT 1 FROM jobs.Files fl WHERE fl.UserId = pr.UserId AND fl.Kind = 'Resume') THEN 1 ELSE 0 END AS BIT) AS HasResume,
           f.SkillHits, f.SkillsWanted, f.MatchedSkills, f.TitleHits, f.CityMatch, f.ModeMatch,
           ISNULL(f.ExperienceFit, -1) AS ExperienceFit,   -- 1 in range, 0 out of it, -1 not known
           CAST(CASE WHEN EXISTS (SELECT 1 FROM jobs.CandidateInvitations i
                                  WHERE i.PostingId = @PostingId AND i.CompanyId = @CompanyId AND i.UserId = pr.UserId) THEN 1 ELSE 0 END AS BIT) AS AlreadyInvited,
           s.Score AS MatchScore
    FROM jobs.fn_Posting_Fit(@PostingId) f
    INNER JOIN jobs.Profiles pr ON pr.UserId = f.UserId
    CROSS APPLY (SELECT f.SkillHits * 3 + f.TitleHits * 3
                        + CASE WHEN f.CityMatch = 1 THEN 2 ELSE 0 END
                        + CASE WHEN f.ExperienceFit = 1 THEN 2 ELSE 0 END
                        + CASE WHEN f.ModeMatch = 1 THEN 1 ELSE 0 END
                        + CASE WHEN pr.VerifiedAt IS NOT NULL THEN 1 ELSE 0 END AS Score) s
    ORDER BY s.Score DESC, pr.UpdatedAt DESC, pr.CandidateKey;
END
GO

/* How many suitable people each job of the company has that takes applications or waits for review. */
CREATE OR ALTER PROCEDURE jobs.sp_Posting_Match_Counts
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.PostingId, (SELECT COUNT(*) FROM jobs.fn_Posting_Fit(p.PostingId)) AS Suitable
    FROM jobs.Postings p
    WHERE p.CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0 AND p.Status IN ('Open', 'InReview');
END
GO

PRINT 'Job Consultancy: suitable candidates for each job posting are in place.';
GO
SET NOEXEC OFF;
GO
