/* =============================================================================
   ProjectDB (company database) · Job Consultancy: the company's own candidates in the search
   -----------------------------------------------------------------------------
   Run in EACH company database (select it in SSMS first; no USE on purpose), after
   12_Consultancy_Candidates.sql. New company databases created by the API get this script
   automatically. ADDITIVE and SAFE TO RE-RUN: it changes no table and no row.

   The candidate search of Job Consultancy shows the candidates the company added itself
   next to the people of Job Portal. They stay the company's: they come from its own
   database, so no other company and nobody on Job Portal can see them.

     consult.sp_OwnCandidate_Search  the company's candidates that match the search: the
                                     words (all or any) in the name, headline, skills, the
                                     jobs they look for, the city or the notes, best first;
                                     the filters of the search: cities, years of experience,
                                     skills (any or all), with a resume
     consult.sp_OwnCandidate_Get     one candidate of the company (to edit it)
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

DECLARE @problem NVARCHAR(400);

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
    SET @problem = 'You are connected to [' + DB_NAME() + ']. Select the company database first.';
ELSE IF OBJECT_ID('dbo.Companies') IS NOT NULL AND OBJECT_ID('dbo.CompanyUsers') IS NOT NULL AND OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is the SaaS main database. Select a company database.';
ELSE IF OBJECT_ID('dbo.SchemaInfo') IS NOT NULL AND OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is the Personal DB. Select a company database.';
ELSE IF OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database (dbo.Locations is missing).';
ELSE IF OBJECT_ID('consult.Candidates') IS NULL
    SET @problem = 'Run 12_Consultancy_Candidates.sql in this company database first.';

IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_OwnCandidate_Search
    @CompanyId  INT,
    @Query      NVARCHAR(100) = NULL,
    @MatchAll   BIT           = 1,
    @Cities     NVARCHAR(MAX) = NULL,   -- JSON arrays: any of the values
    @Bands      NVARCHAR(MAX) = NULL,   -- 'none', '0-1', '1-3', '3-5', '5-10', '10+'
    @Skills     NVARCHAR(MAX) = NULL,
    @SkillsAll  BIT           = 0,
    @WithResume BIT           = 0,
    @Count      INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    SET @Query      = LTRIM(RTRIM(ISNULL(@Query, '')));
    SET @MatchAll   = ISNULL(@MatchAll, 1);
    SET @SkillsAll  = ISNULL(@SkillsAll, 0);
    SET @WithResume = ISNULL(@WithResume, 0);
    SET @Count      = CASE WHEN ISNULL(@Count, 50) < 1 THEN 50 WHEN @Count > 200 THEN 200 ELSE @Count END;
    IF @Cities IS NOT NULL AND ISJSON(@Cities) = 0 SET @Cities = NULL;
    IF @Bands  IS NOT NULL AND ISJSON(@Bands)  = 0 SET @Bands  = NULL;
    IF @Skills IS NOT NULL AND ISJSON(@Skills) = 0 SET @Skills = NULL;

    /* the words, and the values of the filters, for LIKE with their wildcards taken literally */
    DECLARE @Words TABLE (Pat NVARCHAR(110) PRIMARY KEY);
    INSERT INTO @Words (Pat)
    SELECT DISTINCT TOP (10) '%' + REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(s.value)), '[', '[[]'), '%', '[%]'), '_', '[_]') + '%'
    FROM STRING_SPLIT(REPLACE(REPLACE(REPLACE(@Query, ',', ' '), '/', ' '), ';', ' '), ' ') s
    WHERE LEN(LTRIM(RTRIM(s.value))) >= 2;
    DECLARE @WordCount INT = (SELECT COUNT(*) FROM @Words);

    DECLARE @CityList  TABLE (Pat NVARCHAR(110) PRIMARY KEY);
    DECLARE @BandList  TABLE (Value NVARCHAR(10) PRIMARY KEY);
    DECLARE @SkillList TABLE (Pat NVARCHAR(110) PRIMARY KEY);
    INSERT INTO @CityList  SELECT DISTINCT '%' + REPLACE(REPLACE(REPLACE(LEFT(LTRIM(RTRIM(value)), 100), '[', '[[]'), '%', '[%]'), '_', '[_]') + '%'
                           FROM OPENJSON(ISNULL(@Cities, '[]')) WHERE LTRIM(RTRIM(value)) <> '';
    INSERT INTO @BandList  SELECT DISTINCT value FROM OPENJSON(ISNULL(@Bands, '[]')) WHERE value IN ('none', '0-1', '1-3', '3-5', '5-10', '10+');
    INSERT INTO @SkillList SELECT DISTINCT '%' + REPLACE(REPLACE(REPLACE(LEFT(LTRIM(RTRIM(value)), 100), '[', '[[]'), '%', '[%]'), '_', '[_]') + '%'
                           FROM OPENJSON(ISNULL(@Skills, '[]')) WHERE LTRIM(RTRIM(value)) <> '';

    SELECT TOP (@Count)
           c.CandidateId, c.FullName, c.Headline, c.Email, c.Phone, c.City, c.ExperienceYears, c.Skills, c.PreferredJobs,
           c.Source, c.Stage, c.Notes, ISNULL(c.ResumeName, '') AS ResumeName,
           CAST(CASE WHEN c.Resume IS NULL THEN 0 ELSE 1 END AS BIT) AS HasResume,
           c.CreatedAt, c.UpdatedAt, m.Score AS MatchScore,
           COUNT(*) OVER () AS TotalCount
    FROM consult.Candidates c
    /* how well the words match: 3 in the name, headline, skills or the jobs looked for, 1 elsewhere.
       Each word is weighed first, then summed: SQL Server refuses an aggregate whose expression mixes
       the columns of the candidate (outer) with those of the word (Msg 8124). */
    CROSS APPLY (SELECT SUM(x.Weight) AS Score, SUM(CASE WHEN x.Weight > 0 THEN 1 ELSE 0 END) AS Found
                 FROM (SELECT CASE WHEN c.FullName LIKE w.Pat OR c.Headline LIKE w.Pat OR c.Skills LIKE w.Pat OR c.PreferredJobs LIKE w.Pat THEN 3
                                   WHEN c.City LIKE w.Pat OR c.Notes LIKE w.Pat OR c.Email LIKE w.Pat OR c.Phone LIKE w.Pat THEN 1
                                   ELSE 0 END AS Weight
                       FROM @Words w) x) m
    CROSS APPLY (SELECT CASE WHEN c.ExperienceYears IS NULL THEN 'none' WHEN c.ExperienceYears < 1 THEN '0-1'
                             WHEN c.ExperienceYears < 3 THEN '1-3' WHEN c.ExperienceYears < 5 THEN '3-5'
                             WHEN c.ExperienceYears < 10 THEN '5-10' ELSE '10+' END AS Band) b
    WHERE c.CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0
      AND (@WordCount = 0 OR ISNULL(m.Found, 0) >= CASE WHEN @MatchAll = 1 THEN @WordCount ELSE 1 END)
      AND (NOT EXISTS (SELECT 1 FROM @CityList) OR EXISTS (SELECT 1 FROM @CityList l WHERE c.City LIKE l.Pat))
      AND (NOT EXISTS (SELECT 1 FROM @BandList) OR b.Band IN (SELECT Value FROM @BandList))
      AND (NOT EXISTS (SELECT 1 FROM @SkillList)
           OR (@SkillsAll = 0 AND EXISTS (SELECT 1 FROM @SkillList k WHERE c.Skills LIKE k.Pat))
           OR (@SkillsAll = 1 AND NOT EXISTS (SELECT 1 FROM @SkillList k WHERE c.Skills NOT LIKE k.Pat)))
      AND (@WithResume = 0 OR c.Resume IS NOT NULL)
    ORDER BY ISNULL(m.Score, 0) DESC, c.UpdatedAt DESC, c.CandidateId DESC;
END
GO

/* One candidate of the company (no row = not found). Never the file of the resume. */
CREATE OR ALTER PROCEDURE consult.sp_OwnCandidate_Get
    @CompanyId   INT,
    @CandidateId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.CandidateId, c.FullName, c.Headline, c.Email, c.Phone, c.City, c.ExperienceYears, c.Skills, c.PreferredJobs,
           c.Source, c.Stage, c.Notes, ISNULL(c.ResumeName, '') AS ResumeName,
           CAST(CASE WHEN c.Resume IS NULL THEN 0 ELSE 1 END AS BIT) AS HasResume,
           c.CreatedAt, c.UpdatedAt
    FROM consult.Candidates c
    WHERE c.CandidateId = @CandidateId AND c.CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0;
END
GO

PRINT 'Job Consultancy: the company''s own candidates are in the candidate search.';
GO
SET NOEXEC OFF;
GO
