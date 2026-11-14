/* =============================================================================
   PersonalDB · 03 · Job Portal: two procedures corrected after review
   -----------------------------------------------------------------------------
   Run AFTER 02_Jobs_Profile.sql, in the Personal DB. Run it AGAIN every time
   script 02 is run again: script 02 re-creates both procedures in their earlier
   form. It changes no table and no row. SAFE TO RE-RUN.

     jobs.sp_Profile_SetVisible   checks and switches in ONE statement. With the
                                  check and the update in two statements, a
                                  profile save that cleared the headline between
                                  them left a profile without a headline visible.
     jobs.sp_Skill_Suggest        suggests a skill name only when at least two
                                  people have it. A skill is free text: a name
                                  only one person typed (also on a private
                                  profile) is not shown to anybody else.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL OR OBJECT_ID('jobs.Profiles') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 02_Jobs_Profile.sql in it before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
BEGIN
    RAISERROR('This database is not marked as the Personal DB. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Profile_SetVisible
    @UserId    INT,
    @IsVisible BIT
AS
BEGIN
    SET NOCOUNT ON;

    SET @IsVisible = ISNULL(@IsVisible, 0);

    /* one statement: switching ON succeeds only for a row that has a name and a
       headline at this very moment */
    UPDATE jobs.Profiles
    SET IsVisible = @IsVisible, UpdatedAt = GETDATE()
    WHERE UserId = @UserId
      AND (@IsVisible = 0 OR (FullName <> '' AND Headline <> ''));

    IF @IsVisible = 1 AND @@ROWCOUNT = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Add your name and a headline before you switch this on' AS Message; RETURN;
    END

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @IsVisible = 1 THEN 'Employers can find your profile' ELSE 'Your profile is private' END AS Message;
END
GO

/* Skill names that at least two people have and that start with the text: names
   only. @UserId is taken like everywhere else and is not used. */
CREATE OR ALTER PROCEDURE jobs.sp_Skill_Suggest
    @UserId INT,
    @Query  NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Query = LTRIM(RTRIM(ISNULL(@Query, '')));
    IF LEN(@Query) < 2 RETURN;

    -- the wildcard characters of LIKE are taken literally
    SET @Query = REPLACE(REPLACE(REPLACE(@Query, '[', '[[]'), '%', '[%]'), '_', '[_]');

    SELECT TOP (10) s.SkillName
    FROM jobs.Skills s
    WHERE s.SkillName LIKE @Query + '%'
    GROUP BY s.SkillName
    HAVING COUNT(DISTINCT s.UserId) >= 2
    ORDER BY s.SkillName;
END
GO

PRINT 'Job Portal profile: visibility and skill suggestions are corrected.';
GO
SET NOEXEC OFF;
GO
