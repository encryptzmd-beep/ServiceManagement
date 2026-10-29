/* =============================================================================
   PersonalDB · 27 · Job Consultancy: a company's own people are not its suitable candidates
   -----------------------------------------------------------------------------
   Run AFTER 26_Jobs_Interviews_Rejections.sql, in the Personal DB. SAFE TO RE-RUN.
   It changes no table and no row.

   QA BUG-022: the recruiter who looked at a job of her company was its best "suitable
   candidate". The members of a company are kept in the main database, so the API reads
   them there and passes their user ids; these two procedures leave them out.

     jobs.sp_Posting_Matches       + @ExcludeUserIds (user ids, comma separated; optional)
     jobs.sp_Posting_Match_Counts  + @ExcludeUserIds

   Without the new parameter both answer exactly as script 24 did. The API still works
   with script 24 alone (it then calls them without the parameter).
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR OBJECT_ID('jobs.fn_Posting_Fit') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run scripts 11 to 26 in it before running this script.', 16, 1);
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
   COMPANY · the suitable people of one of its jobs, best first, with why
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Posting_Matches
    @CompanyId      INT,
    @PostingId      INT,
    @Count          INT = 30,
    @ExcludeUserIds NVARCHAR(MAX) = NULL
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
    /* the company's own people */
    WHERE NOT EXISTS (SELECT 1 FROM STRING_SPLIT(ISNULL(@ExcludeUserIds, ''), ',') x WHERE TRY_CAST(x.value AS INT) = f.UserId)
    ORDER BY s.Score DESC, pr.UpdatedAt DESC, pr.CandidateKey;
END
GO

/* How many suitable people each job of the company has that takes applications or waits for review. */
CREATE OR ALTER PROCEDURE jobs.sp_Posting_Match_Counts
    @CompanyId      INT,
    @ExcludeUserIds NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.PostingId,
           (SELECT COUNT(*) FROM jobs.fn_Posting_Fit(p.PostingId) f
            WHERE NOT EXISTS (SELECT 1 FROM STRING_SPLIT(ISNULL(@ExcludeUserIds, ''), ',') x WHERE TRY_CAST(x.value AS INT) = f.UserId)) AS Suitable
    FROM jobs.Postings p
    WHERE p.CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0 AND p.Status IN ('Open', 'InReview');
END
GO

PRINT 'Job Consultancy: the people of a company are no longer its suitable candidates.';
GO
SET NOEXEC OFF;
GO
