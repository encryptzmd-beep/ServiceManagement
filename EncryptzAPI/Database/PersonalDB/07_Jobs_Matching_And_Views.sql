/* =============================================================================
   PersonalDB · 07 · Job Portal: jobs that match what a person prefers, and who
                     looked at their profile
   -----------------------------------------------------------------------------
   Run AFTER 05_Jobs_Preferences.sql and 06_Jobs_Postings.sql, in the Personal DB.
   Run it AGAIN every time script 06 is run again: script 06 re-creates
   jobs.sp_Posting_Search in its earlier form. It changes no table and no row.
   SAFE TO RE-RUN.

     jobs.sp_Posting_Search      as in script 06, and every row gets a MatchScore
                                 from the person's preferences (05): a preferred
                                 job in the title or the skills 3, a preferred
                                 location in the city 2, a preferred working mode
                                 1. @Sort = 'match' (the default) puts the best
                                 match first, 'newest' the newest.
     jobs.sp_ProfileView_ListMine  which company opened the person's profile or
                                 resume, for which job, how often and when last.
                                 It never names the user of the company who looked.

   Like everywhere in schema jobs: every procedure takes @UserId first and every
   statement on jobs.Applications, jobs.SavedPostings, jobs.Preferences and
   jobs.ProfileViews names it.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR OBJECT_ID('jobs.Preferences') IS NULL OR OBJECT_ID('jobs.Postings') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 05_Jobs_Preferences.sql and 06_Jobs_Postings.sql in it before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
BEGIN
    RAISERROR('This database is not marked as the Personal DB. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

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

/* Which company looked at the person's profile or resume, per job, newest first. */
CREATE OR ALTER PROCEDURE jobs.sp_ProfileView_ListMine
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (30)
           p.CompanyName,
           p.Title AS PostingTitle,
           SUM(CASE WHEN v.What = 'Profile' THEN 1 ELSE 0 END) AS ProfileViews,
           SUM(CASE WHEN v.What = 'Resume'  THEN 1 ELSE 0 END) AS ResumeViews,
           MAX(v.ViewedAt) AS LastViewedAt
    FROM jobs.ProfileViews v
    INNER JOIN jobs.Postings p ON p.PostingId = v.PostingId
    WHERE v.UserId = @UserId
    GROUP BY v.CompanyId, p.CompanyName, v.PostingId, p.Title
    ORDER BY MAX(v.ViewedAt) DESC;
END
GO

PRINT 'Job Portal: matching jobs and profile views are in place.';
GO
SET NOEXEC OFF;
GO
