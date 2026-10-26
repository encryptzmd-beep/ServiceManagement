/* =============================================================================
   PersonalDB · 18 · Job Portal: similar jobs on a public job page
   -----------------------------------------------------------------------------
   Run AFTER 17_Jobs_Public_Sitemap.sql, in the Personal DB. SAFE TO RE-RUN.
   It changes no table and no row.

     jobs.sp_Public_Posting_Related  the open jobs most like one job, for anybody (no
                                     user): a word of the title in common 3 each, a
                                     skill in common 2 each, the same city 2, the same
                                     job type 1, the same work mode 1. The best first,
                                     then the newest; the job itself never. When nothing
                                     is alike, the newest open jobs fill the list.
                                     The columns of jobs.sp_Posting_Search for user 0
                                     (nothing saved, nothing applied).
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR OBJECT_ID('jobs.sp_Public_Posting_Sitemap') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 17_Jobs_Public_Sitemap.sql in it before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
BEGIN
    RAISERROR('This database is not marked as the Personal DB. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Public_Posting_Related
    @PostingId INT,
    @Count     INT = 6
AS
BEGIN
    SET NOCOUNT ON;

    SET @Count = CASE WHEN ISNULL(@Count, 6) < 1 THEN 6 WHEN @Count > 12 THEN 12 ELSE @Count END;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);
    DECLARE @City NVARCHAR(100), @Type NVARCHAR(20), @Mode NVARCHAR(20), @Title NVARCHAR(200), @Skills NVARCHAR(1000);

    SELECT @City = City, @Type = EmploymentType, @Mode = WorkMode, @Title = Title, @Skills = Skills
    FROM jobs.Postings
    WHERE PostingId = @PostingId;

    /* the words of the title (three letters or more) and the skills of the job */
    DECLARE @Words TABLE (Word NVARCHAR(200) PRIMARY KEY);
    INSERT INTO @Words (Word)
    SELECT DISTINCT LTRIM(RTRIM(w.value))
    FROM STRING_SPLIT(REPLACE(REPLACE(REPLACE(ISNULL(@Title, ''), '/', ' '), ',', ' '), '-', ' '), ' ') w
    WHERE LEN(LTRIM(RTRIM(w.value))) >= 3;

    DECLARE @Wanted TABLE (Skill NVARCHAR(200) PRIMARY KEY);
    INSERT INTO @Wanted (Skill)
    SELECT DISTINCT LTRIM(RTRIM(s.value))
    FROM STRING_SPLIT(ISNULL(@Skills, ''), ',') s
    WHERE LTRIM(RTRIM(s.value)) <> '';

    SELECT TOP (@Count)
           p.PostingId, p.Title, p.CompanyName, p.City, p.EmploymentType, p.WorkMode,
           p.ExperienceMinYears, p.ExperienceMaxYears, p.SalaryMin, p.SalaryMax, p.Skills,
           p.PublishedAt, p.ClosesOn,
           CAST(0 AS BIT) AS IsSaved,
           '' AS MyStatus,
           CAST(1 AS BIT) AS IsOpen,
           CAST(CASE WHEN p.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified,
           x.Score AS MatchScore
    FROM jobs.Postings p
    CROSS APPLY (
        SELECT 3 * (SELECT COUNT(*) FROM @Words w
                    WHERE (' ' + p.Title + ' ') LIKE '% ' + REPLACE(REPLACE(REPLACE(w.Word, '[', '[[]'), '%', '[%]'), '_', '[_]') + ' %')
             + 2 * (SELECT COUNT(*) FROM @Wanted k
                    WHERE EXISTS (SELECT 1 FROM STRING_SPLIT(ISNULL(p.Skills, ''), ',') s WHERE LTRIM(RTRIM(s.value)) = k.Skill))
             + CASE WHEN p.City = @City THEN 2 ELSE 0 END
             + CASE WHEN p.EmploymentType = @Type THEN 1 ELSE 0 END
             + CASE WHEN p.WorkMode = @Mode THEN 1 ELSE 0 END AS Score
    ) x
    WHERE p.Status = 'Open'
      AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today)
      AND p.PostingId <> ISNULL(@PostingId, 0)
    ORDER BY x.Score DESC, p.PublishedAt DESC, p.PostingId DESC;
END
GO

PRINT 'Job Portal: similar jobs on the public job pages are in place.';
GO
SET NOEXEC OFF;
GO
