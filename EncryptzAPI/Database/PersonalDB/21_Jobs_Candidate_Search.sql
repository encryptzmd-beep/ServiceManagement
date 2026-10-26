/* =============================================================================
   PersonalDB · 21 · Job Consultancy: a more flexible candidate search
   -----------------------------------------------------------------------------
   Run AFTER 20_Jobs_Messages.sql, in the Personal DB. SAFE TO RE-RUN.
   Run it AGAIN every time script 11 or 16 is run again: they re-create
   jobs.sp_Candidate_Search in an earlier form. It changes no table and no row.

   jobs.sp_Candidate_Search, as in script 16, and:

   Words   The search is cut into words (up to 10; a space, comma, slash or semicolon
           separates them). Each word is looked for in the name, the headline, the skills
           and sub-skills, the titles and companies of experience, the education, the jobs
           and places the person looks for, the city and the summary. @MatchAll = 1 (the
           default): every word must be found; 0: any word is enough. A word found in the
           name, the headline, a skill, a past job title or a preferred job counts 3,
           anywhere else 1; the whole search found in the name or the headline counts 5
           more. The best match comes first (MatchScore), then the latest change.

   Filters, each a JSON array of values, any of them is enough (none = no filter):
           @Cities   the city of the person, or a place they look for (contained: "Kochi"
                     finds "Kochi, Kerala")
           @Bands    years of experience: '0-1', '1-3', '3-5', '5-10', '10+'
           @Modes    a working mode the person looks for
           @Skills   a skill of the person, contained (@SkillsAll = 1: every one of them)
           @VerifiedOnly, @WithResume
   The parameters of script 16 (@City, @MinYears, @WorkMode, @Keys) still work.

   A second result set, the choices of the filters with how many of the people the words
   found have each: Kind ('City', 'Skill', 'Mode', 'Band'), Value, People. It does not
   depend on the filters, so a choice never disappears when another one is ticked.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR COL_LENGTH('jobs.Profiles', 'VerifiedAt') IS NULL OR OBJECT_ID('jobs.SubSkills') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run scripts 13 and 16 in it before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
BEGIN
    RAISERROR('This database is not marked as the Personal DB. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
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
    INSERT INTO @BandList  SELECT DISTINCT value FROM OPENJSON(ISNULL(@Bands, '[]')) WHERE value IN ('0-1', '1-3', '3-5', '5-10', '10+');
    INSERT INTO @ModeList  SELECT DISTINCT LEFT(LTRIM(RTRIM(value)), 20) FROM OPENJSON(ISNULL(@Modes, '[]')) WHERE LTRIM(RTRIM(value)) <> '';
    INSERT INTO @SkillList (Value) SELECT DISTINCT LEFT(LTRIM(RTRIM(value)), 100) FROM OPENJSON(ISNULL(@Skills, '[]')) WHERE LTRIM(RTRIM(value)) <> '';
    UPDATE @CityList  SET Pat = '%' + REPLACE(REPLACE(REPLACE(Value, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%';
    UPDATE @SkillList SET Pat = '%' + REPLACE(REPLACE(REPLACE(Value, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%';

    /* ── the people a company may find (and, with @Keys, only the pool) ── */
    CREATE TABLE #Base (UserId INT PRIMARY KEY, Months INT NOT NULL, Band VARCHAR(5) NOT NULL);
    INSERT INTO #Base (UserId, Months, Band)
    SELECT pr.UserId, ISNULL(x.Months, 0),
           CASE WHEN ISNULL(x.Months, 0) < 12 THEN '0-1' WHEN x.Months < 36 THEN '1-3' WHEN x.Months < 60 THEN '3-5'
                WHEN x.Months < 120 THEN '5-10' ELSE '10+' END
    FROM jobs.Profiles pr
    OUTER APPLY (SELECT SUM(DATEDIFF(MONTH, e.StartMonth, ISNULL(e.EndMonth, @Today)) + 1) AS Months
                 FROM jobs.Experience e WHERE e.UserId = pr.UserId) x
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
      AND (@MinYears IS NULL OR b.Months >= @MinYears * 12)
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
           b.Months / 12 AS ExperienceYears,
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

PRINT 'Job Consultancy: the flexible candidate search is in place.';
GO
SET NOEXEC OFF;
GO
