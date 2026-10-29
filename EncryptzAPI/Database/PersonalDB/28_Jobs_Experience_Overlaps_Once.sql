/* =============================================================================
   PersonalDB · 28 · Years of experience: a month worked in two jobs counts once
   -----------------------------------------------------------------------------
   Run AFTER 27_Jobs_Matches_Exclude_Members.sql, in the Personal DB. SAFE TO RE-RUN.
   It changes no table and no row. Run it AGAIN every time script 23 or 24 is run again:
   they re-create the two objects below with the old sum.

   GAP-014 (decided 28-Oct-2026): the experience was the SUM of every entry, so two jobs held
   at the same time counted twice (3 years + 3 parallel years = 6). Now the entries are merged
   first: overlapping or touching periods become one, a job without an end (or with an end in
   the future) runs to this month. The profile page of Job Portal already counts this way.

     jobs.fn_Experience_Months   the months one person worked, overlaps once (new, shared)
     jobs.sp_Candidate_Search    as script 23, its months from fn_Experience_Months
     jobs.fn_Posting_Fit         as script 24, its months from fn_Experience_Months
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR OBJECT_ID('jobs.fn_Posting_Fit') IS NULL OR OBJECT_ID('jobs.sp_Candidate_Search') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run scripts 11 to 27 in it before running this script.', 16, 1);
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
   The months one person worked: the experience entries merged into periods (gaps and
   islands), both end months counted (April to June = 3). NULL without any entry.
   ============================================================================= */
CREATE OR ALTER FUNCTION jobs.fn_Experience_Months (@UserId INT, @Today DATE)
RETURNS TABLE
AS
RETURN
WITH spans AS (
    SELECT DATEFROMPARTS(YEAR(e.StartMonth), MONTH(e.StartMonth), 1) AS FromMonth,
           DATEFROMPARTS(YEAR(t.EndDay), MONTH(t.EndDay), 1) AS ToMonth
    FROM jobs.Experience e
    CROSS APPLY (SELECT CASE WHEN e.EndMonth IS NULL OR e.EndMonth > @Today THEN @Today ELSE e.EndMonth END AS EndDay) t
    WHERE e.UserId = @UserId AND e.StartMonth <= t.EndDay
),
marked AS (
    SELECT FromMonth, ToMonth,
           MAX(ToMonth) OVER (ORDER BY FromMonth, ToMonth ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS ReachedBefore
    FROM spans
),
grouped AS (
    /* a new period starts after a gap of at least one month */
    SELECT FromMonth, ToMonth,
           SUM(CASE WHEN ReachedBefore IS NULL OR FromMonth > DATEADD(MONTH, 1, ReachedBefore) THEN 1 ELSE 0 END)
               OVER (ORDER BY FromMonth, ToMonth ROWS UNBOUNDED PRECEDING) AS Period
    FROM marked
)
SELECT SUM(DATEDIFF(MONTH, p.FromMonth, p.ToMonth) + 1) AS Months
FROM (SELECT MIN(FromMonth) AS FromMonth, MAX(ToMonth) AS ToMonth FROM grouped GROUP BY Period) p;
GO

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
/* months worked, a month in two jobs once (script 28) */
OUTER APPLY jobs.fn_Experience_Months(pr.UserId, CAST(GETDATE() AS DATE)) x
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

CREATE OR ALTER PROCEDURE jobs.sp_Candidate_Search
    @CompanyId    INT,
    @Query        NVARCHAR(100) = NULL,
    @City         NVARCHAR(100) = NULL,
    @MinYears     INT           = NULL,
    @WorkMode     NVARCHAR(20)  = NULL,
    @Keys         NVARCHAR(MAX) = NULL,   -- JSON array of CandidateKeys: only these (the company's pool)
    @Page         INT           = 1,
    @PageSize     INT           = 20,
    @MatchAll     BIT           = 1,
    @Cities       NVARCHAR(MAX) = NULL,   -- JSON arrays: any of the values
    @Bands        NVARCHAR(MAX) = NULL,
    @Modes        NVARCHAR(MAX) = NULL,
    @Skills       NVARCHAR(MAX) = NULL,
    @SkillsAll    BIT           = 0,
    @VerifiedOnly BIT           = 0,
    @WithResume   BIT           = 0
AS
BEGIN
    SET NOCOUNT ON;

    SET @Query        = LTRIM(RTRIM(ISNULL(@Query, '')));
    SET @City         = LTRIM(RTRIM(ISNULL(@City, '')));
    SET @WorkMode     = LTRIM(RTRIM(ISNULL(@WorkMode, '')));
    SET @Page         = CASE WHEN ISNULL(@Page, 1) < 1 THEN 1 ELSE @Page END;
    SET @PageSize     = CASE WHEN ISNULL(@PageSize, 20) < 1 THEN 20 WHEN @PageSize > 50 THEN 50 ELSE @PageSize END;
    SET @MatchAll     = ISNULL(@MatchAll, 1);
    SET @SkillsAll    = ISNULL(@SkillsAll, 0);
    SET @VerifiedOnly = ISNULL(@VerifiedOnly, 0);
    SET @WithResume   = ISNULL(@WithResume, 0);
    IF @Keys   IS NOT NULL AND ISJSON(@Keys)   = 0 SET @Keys   = '[]';
    IF @Cities IS NOT NULL AND ISJSON(@Cities) = 0 SET @Cities = NULL;
    IF @Bands  IS NOT NULL AND ISJSON(@Bands)  = 0 SET @Bands  = NULL;
    IF @Modes  IS NOT NULL AND ISJSON(@Modes)  = 0 SET @Modes  = NULL;
    IF @Skills IS NOT NULL AND ISJSON(@Skills) = 0 SET @Skills = NULL;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    /* the wildcard characters of LIKE are taken literally */
    DECLARE @Phrase NVARCHAR(110) = '%' + REPLACE(REPLACE(REPLACE(@Query, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%';
    SET @City = REPLACE(REPLACE(REPLACE(@City, '[', '[[]'), '%', '[%]'), '_', '[_]');

    /* ── the words ── */
    DECLARE @Words TABLE (Word NVARCHAR(100) PRIMARY KEY, Pat NVARCHAR(110) NOT NULL);
    INSERT INTO @Words (Word, Pat)
    SELECT TOP (10) w.Word, '%' + REPLACE(REPLACE(REPLACE(w.Word, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%'
    FROM (SELECT DISTINCT LTRIM(RTRIM(s.value)) AS Word
          FROM STRING_SPLIT(REPLACE(REPLACE(REPLACE(@Query, ',', ' '), '/', ' '), ';', ' '), ' ') s
          WHERE LEN(LTRIM(RTRIM(s.value))) >= 2) w
    ORDER BY LEN(w.Word) DESC;
    DECLARE @WordCount INT = (SELECT COUNT(*) FROM @Words);

    /* ── the lists of the filters ── */
    /* Pat: the value for LIKE, its wildcards taken literally (a ticked city or skill matches it
       inside a longer one: "Kochi" finds "Kochi, Kerala", "AutoCAD" finds "AutoCAD Civil 3D") */
    DECLARE @CityList  TABLE (Value NVARCHAR(100) PRIMARY KEY, Pat NVARCHAR(110) NULL);
    DECLARE @BandList  TABLE (Value NVARCHAR(10)  PRIMARY KEY);
    DECLARE @ModeList  TABLE (Value NVARCHAR(20)  PRIMARY KEY);
    DECLARE @SkillList TABLE (Value NVARCHAR(100) PRIMARY KEY, Pat NVARCHAR(110) NULL);
    INSERT INTO @CityList (Value)  SELECT DISTINCT LEFT(LTRIM(RTRIM(value)), 100) FROM OPENJSON(ISNULL(@Cities, '[]')) WHERE LTRIM(RTRIM(value)) <> '';
    INSERT INTO @BandList  SELECT DISTINCT value FROM OPENJSON(ISNULL(@Bands, '[]')) WHERE value IN ('none', '0-1', '1-3', '3-5', '5-10', '10+');
    INSERT INTO @ModeList  SELECT DISTINCT LEFT(LTRIM(RTRIM(value)), 20) FROM OPENJSON(ISNULL(@Modes, '[]')) WHERE LTRIM(RTRIM(value)) <> '';
    INSERT INTO @SkillList (Value) SELECT DISTINCT LEFT(LTRIM(RTRIM(value)), 100) FROM OPENJSON(ISNULL(@Skills, '[]')) WHERE LTRIM(RTRIM(value)) <> '';
    UPDATE @CityList  SET Pat = '%' + REPLACE(REPLACE(REPLACE(Value, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%';
    UPDATE @SkillList SET Pat = '%' + REPLACE(REPLACE(REPLACE(Value, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%';

    /* ── the people a company may find (and, with @Keys, only the pool) ── */
    /* Months: from the experience entered, else from the headline, else NULL (not added) */
    CREATE TABLE #Base (UserId INT PRIMARY KEY, Months INT NULL, Source VARCHAR(8) NOT NULL, Band VARCHAR(5) NOT NULL);
    INSERT INTO #Base (UserId, Months, Source, Band)
    SELECT pr.UserId, y.Months, y.Source,
           CASE WHEN y.Months IS NULL THEN 'none' WHEN y.Months < 12 THEN '0-1' WHEN y.Months < 36 THEN '1-3'
                WHEN y.Months < 60 THEN '3-5' WHEN y.Months < 120 THEN '5-10' ELSE '10+' END
    FROM jobs.Profiles pr
    /* months worked, a month in two jobs once (script 28) */
    OUTER APPLY jobs.fn_Experience_Months(pr.UserId, @Today) x
    /* the years in the headline: the number just before the first "year" (or "yr"), "+" and
       spaces between them skipped: "Teacher, 6 years" -> 6, "Developer 5+ yrs" -> 5 */
    CROSS APPLY (SELECT LOWER(pr.Headline) AS H) h0
    CROSS APPLY (SELECT NULLIF(CASE WHEN CHARINDEX('year', h0.H) > 0 THEN CHARINDEX('year', h0.H) ELSE CHARINDEX('yr', h0.H) END, 0) AS P) h1
    CROSS APPLY (SELECT REVERSE(RTRIM(REPLACE(LEFT(h0.H, h1.P - 1), '+', ''))) AS R) h2
    CROSS APPLY (SELECT CASE WHEN h2.R LIKE '[0-9]%' THEN TRY_CAST(REVERSE(LEFT(h2.R, PATINDEX('%[^0-9.]%', h2.R + ' ') - 1)) AS DECIMAL(5, 1)) END AS Years) h3
    CROSS APPLY (SELECT CASE WHEN x.Months IS NOT NULL THEN x.Months
                             WHEN h3.Years BETWEEN 0 AND 50 THEN CAST(h3.Years * 12 AS INT) END AS Months,
                        CASE WHEN x.Months IS NOT NULL THEN 'Entries'
                             WHEN h3.Years BETWEEN 0 AND 50 THEN 'Headline' ELSE 'None' END AS Source) y
    WHERE pr.IsVisible = 1 AND pr.FullName <> '' AND pr.Headline <> '' AND ISNULL(@CompanyId, 0) <> 0
      AND (@Keys IS NULL OR pr.CandidateKey IN (SELECT TRY_CAST(k.value AS UNIQUEIDENTIFIER) FROM OPENJSON(@Keys) k));

    /* ── how well each person matches the words ── */
    CREATE TABLE #Matched (UserId INT PRIMARY KEY, Score INT NOT NULL);

    IF @WordCount = 0
        INSERT INTO #Matched (UserId, Score) SELECT UserId, 0 FROM #Base;
    ELSE
    BEGIN
        INSERT INTO #Matched (UserId, Score)
        SELECT h.UserId,
               SUM(h.Weight) + MAX(CASE WHEN pr.FullName LIKE @Phrase OR pr.Headline LIKE @Phrase THEN 5 ELSE 0 END)
        FROM (
            SELECT b.UserId, w.Word,
                   CASE WHEN pr.FullName LIKE w.Pat OR pr.Headline LIKE w.Pat
                          OR EXISTS (SELECT 1 FROM jobs.Skills s      WHERE s.UserId = b.UserId AND s.SkillName LIKE w.Pat)
                          OR EXISTS (SELECT 1 FROM jobs.Experience e  WHERE e.UserId = b.UserId AND e.Title LIKE w.Pat)
                          OR EXISTS (SELECT 1 FROM jobs.Preferences j WHERE j.UserId = b.UserId AND j.Kind = 'Job' AND j.Value LIKE w.Pat)
                        THEN 3
                        WHEN pr.Summary LIKE w.Pat OR pr.City LIKE w.Pat
                          OR EXISTS (SELECT 1 FROM jobs.SubSkills u   WHERE u.UserId = b.UserId AND u.SubSkillName LIKE w.Pat)
                          OR EXISTS (SELECT 1 FROM jobs.Experience e  WHERE e.UserId = b.UserId AND (e.Organisation LIKE w.Pat OR e.Description LIKE w.Pat))
                          OR EXISTS (SELECT 1 FROM jobs.Education d   WHERE d.UserId = b.UserId AND (d.Course LIKE w.Pat OR d.FieldOfStudy LIKE w.Pat OR d.Institution LIKE w.Pat))
                          OR EXISTS (SELECT 1 FROM jobs.Preferences l WHERE l.UserId = b.UserId AND l.Kind = 'Location' AND l.Value LIKE w.Pat)
                        THEN 1
                        ELSE 0 END AS Weight
            FROM #Base b
            INNER JOIN jobs.Profiles pr ON pr.UserId = b.UserId
            CROSS JOIN @Words w
        ) h
        INNER JOIN jobs.Profiles pr ON pr.UserId = h.UserId
        GROUP BY h.UserId
        HAVING SUM(CASE WHEN h.Weight > 0 THEN 1 ELSE 0 END) >= CASE WHEN @MatchAll = 1 THEN @WordCount ELSE 1 END;
    END

    /* ── the filters ── */
    CREATE TABLE #Found (UserId INT PRIMARY KEY, Score INT NOT NULL);
    INSERT INTO #Found (UserId, Score)
    SELECT m.UserId, m.Score
    FROM #Matched m
    INNER JOIN #Base b ON b.UserId = m.UserId
    INNER JOIN jobs.Profiles pr ON pr.UserId = m.UserId
    WHERE (@City = '' OR pr.City LIKE '%' + @City + '%'
           OR EXISTS (SELECT 1 FROM jobs.Preferences l WHERE l.UserId = pr.UserId AND l.Kind = 'Location' AND l.Value LIKE '%' + @City + '%'))
      AND (@MinYears IS NULL OR ISNULL(b.Months, -1) >= @MinYears * 12)
      AND (@WorkMode = '' OR EXISTS (SELECT 1 FROM jobs.Preferences w WHERE w.UserId = pr.UserId AND w.Kind = 'WorkMode' AND w.Value = @WorkMode))
      AND (NOT EXISTS (SELECT 1 FROM @CityList)
           OR EXISTS (SELECT 1 FROM @CityList c WHERE pr.City LIKE c.Pat)
           OR EXISTS (SELECT 1 FROM jobs.Preferences l INNER JOIN @CityList c ON l.Value LIKE c.Pat WHERE l.UserId = pr.UserId AND l.Kind = 'Location'))
      AND (NOT EXISTS (SELECT 1 FROM @BandList) OR b.Band IN (SELECT Value FROM @BandList))
      AND (NOT EXISTS (SELECT 1 FROM @ModeList)
           OR EXISTS (SELECT 1 FROM jobs.Preferences w INNER JOIN @ModeList c ON c.Value = w.Value WHERE w.UserId = pr.UserId AND w.Kind = 'WorkMode'))
      AND (NOT EXISTS (SELECT 1 FROM @SkillList)
           OR (@SkillsAll = 0 AND EXISTS (SELECT 1 FROM jobs.Skills s INNER JOIN @SkillList c ON s.SkillName LIKE c.Pat WHERE s.UserId = pr.UserId))
           OR (@SkillsAll = 1 AND NOT EXISTS (SELECT 1 FROM @SkillList c
                                              WHERE NOT EXISTS (SELECT 1 FROM jobs.Skills s WHERE s.UserId = pr.UserId AND s.SkillName LIKE c.Pat))))
      AND (@VerifiedOnly = 0 OR pr.VerifiedAt IS NOT NULL)
      AND (@WithResume = 0 OR EXISTS (SELECT 1 FROM jobs.Files f WHERE f.UserId = pr.UserId AND f.Kind = 'Resume'));

    /* ── the page ── */
    SELECT pr.CandidateKey, pr.FullName, pr.Headline, pr.City,
           ISNULL(b.Months, 0) / 12 AS ExperienceYears, b.Source AS ExperienceSource,
           ISNULL((SELECT STRING_AGG(s.SkillName, ', ') FROM (SELECT TOP (8) sk.SkillName FROM jobs.Skills sk
                   WHERE sk.UserId = pr.UserId ORDER BY CASE sk.Level WHEN 'Expert' THEN 0 WHEN 'Intermediate' THEN 1 ELSE 2 END, sk.SkillName) s), '') AS Skills,
           ISNULL((SELECT STRING_AGG(j.Value, ', ') FROM jobs.Preferences j WHERE j.UserId = pr.UserId AND j.Kind = 'Job'), '') AS PreferredJobs,
           ISNULL((SELECT STRING_AGG(w.Value, ', ') FROM jobs.Preferences w WHERE w.UserId = pr.UserId AND w.Kind = 'WorkMode'), '') AS WorkModes,
           CAST(CASE WHEN EXISTS (SELECT 1 FROM jobs.Files f WHERE f.UserId = pr.UserId AND f.Kind = 'Resume') THEN 1 ELSE 0 END AS BIT) AS HasResume,
           CAST(CASE WHEN pr.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified,
           f.Score AS MatchScore,
           COUNT(*) OVER () AS TotalCount
    FROM #Found f
    INNER JOIN #Base b ON b.UserId = f.UserId
    INNER JOIN jobs.Profiles pr ON pr.UserId = f.UserId
    ORDER BY f.Score DESC, pr.UpdatedAt DESC, pr.CandidateKey
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;

    /* ── the choices of the filters, among the people the words found ── */
    SELECT Kind, Value, People FROM (
        SELECT TOP (12) 'City' AS Kind, pr.City AS Value, COUNT(*) AS People
        FROM #Matched m INNER JOIN jobs.Profiles pr ON pr.UserId = m.UserId
        WHERE pr.City <> '' GROUP BY pr.City ORDER BY COUNT(*) DESC, pr.City
    ) c
    UNION ALL
    SELECT Kind, Value, People FROM (
        SELECT TOP (15) 'Skill' AS Kind, s.SkillName AS Value, COUNT(DISTINCT s.UserId) AS People
        FROM #Matched m INNER JOIN jobs.Skills s ON s.UserId = m.UserId
        GROUP BY s.SkillName ORDER BY COUNT(DISTINCT s.UserId) DESC, s.SkillName
    ) s
    UNION ALL
    SELECT 'Mode', w.Value, COUNT(DISTINCT w.UserId)
    FROM #Matched m INNER JOIN jobs.Preferences w ON w.UserId = m.UserId AND w.Kind = 'WorkMode'
    GROUP BY w.Value
    UNION ALL
    SELECT 'Band', b.Band, COUNT(*)
    FROM #Matched m INNER JOIN #Base b ON b.UserId = m.UserId
    GROUP BY b.Band;
END
GO

PRINT 'Years of experience: a month worked in two jobs counts once.';
GO
SET NOEXEC OFF;
GO
