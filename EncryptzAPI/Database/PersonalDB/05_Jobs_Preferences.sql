/* =============================================================================
   PersonalDB · 05 · Job Portal: what a person is looking for
   -----------------------------------------------------------------------------
   Run AFTER 02_Jobs_Profile.sql, in the Personal DB. SAFE TO RE-RUN.
   Running script 02 again does not undo anything of this script.

     jobs.Preferences        the preferred jobs, locations and working modes of a
                             person: one row each, in the order they were given
     jobs.PreferenceTerms    one row per person: the expected CTC (per year)
     jobs.sp_Preference_List the rows, then the terms
     jobs.sp_Preference_Save replaces all of them in one go; the three lists
                             arrive as JSON arrays of text

   Like everywhere in schema jobs: every procedure takes @UserId first and every
   statement on a jobs table names it.
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

IF OBJECT_ID('jobs.Preferences') IS NULL
CREATE TABLE jobs.Preferences
(
    PreferenceId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Preferences PRIMARY KEY,
    UserId       INT           NOT NULL,
    Kind         NVARCHAR(10)  NOT NULL CONSTRAINT CK_jobs_Preferences_Kind CHECK (Kind IN ('Job', 'Location', 'WorkMode')),
    Value        NVARCHAR(100) NOT NULL,
    SortOrder    INT           NOT NULL,
    CreatedAt    DATETIME      NOT NULL CONSTRAINT DF_jobs_Preferences_CreatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_jobs_Preferences_User_Kind_Value' AND object_id = OBJECT_ID('jobs.Preferences'))
    CREATE UNIQUE INDEX UQ_jobs_Preferences_User_Kind_Value ON jobs.Preferences(UserId, Kind, Value);
GO

IF OBJECT_ID('jobs.PreferenceTerms') IS NULL
CREATE TABLE jobs.PreferenceTerms
(
    UserId      INT      NOT NULL CONSTRAINT PK_jobs_PreferenceTerms PRIMARY KEY,
    ExpectedCtc INT      NULL,     -- per year; NULL = not said
    UpdatedAt   DATETIME NOT NULL CONSTRAINT DF_jobs_PreferenceTerms_UpdatedAt DEFAULT (GETDATE())
);
GO

/* Two result sets: the rows (Kind, Value) in their order, then the terms. */
CREATE OR ALTER PROCEDURE jobs.sp_Preference_List
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.Kind, p.Value
    FROM jobs.Preferences p
    WHERE p.UserId = @UserId
    ORDER BY p.Kind, p.SortOrder, p.PreferenceId;

    SELECT t.ExpectedCtc
    FROM jobs.PreferenceTerms t
    WHERE t.UserId = @UserId;
END
GO

/* Replaces everything the person prefers. @Jobs, @Locations and @WorkModes are JSON
   arrays of text; an entry is trimmed, a blank or repeated one is left out, and at
   most 10 of a kind are kept. */
CREATE OR ALTER PROCEDURE jobs.sp_Preference_Save
    @UserId      INT,
    @Jobs        NVARCHAR(MAX) = NULL,
    @Locations   NVARCHAR(MAX) = NULL,
    @WorkModes   NVARCHAR(MAX) = NULL,
    @ExpectedCtc INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Jobs      = ISNULL(NULLIF(LTRIM(RTRIM(@Jobs)), ''), '[]');
    SET @Locations = ISNULL(NULLIF(LTRIM(RTRIM(@Locations)), ''), '[]');
    SET @WorkModes = ISNULL(NULLIF(LTRIM(RTRIM(@WorkModes)), ''), '[]');

    IF @UserId IS NULL OR @UserId = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    IF ISJSON(@Jobs) = 0 OR ISJSON(@Locations) = 0 OR ISJSON(@WorkModes) = 0 OR @ExpectedCtc <= 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Could not save. Please try again' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    DELETE FROM jobs.Preferences WHERE UserId = @UserId;

    INSERT INTO jobs.Preferences (UserId, Kind, Value, SortOrder)
    SELECT TOP (10) @UserId, 'Job', v.Value, MIN(v.Ord)
    FROM (SELECT LEFT(LTRIM(RTRIM(j.value)), 100) AS Value, CAST(j.[key] AS INT) AS Ord
          FROM OPENJSON(@Jobs) j WHERE j.type = 1) v
    WHERE v.Value <> ''
    GROUP BY v.Value
    ORDER BY MIN(v.Ord);

    INSERT INTO jobs.Preferences (UserId, Kind, Value, SortOrder)
    SELECT TOP (10) @UserId, 'Location', v.Value, MIN(v.Ord)
    FROM (SELECT LEFT(LTRIM(RTRIM(j.value)), 100) AS Value, CAST(j.[key] AS INT) AS Ord
          FROM OPENJSON(@Locations) j WHERE j.type = 1) v
    WHERE v.Value <> ''
    GROUP BY v.Value
    ORDER BY MIN(v.Ord);

    INSERT INTO jobs.Preferences (UserId, Kind, Value, SortOrder)
    SELECT TOP (10) @UserId, 'WorkMode', v.Value, MIN(v.Ord)
    FROM (SELECT LEFT(LTRIM(RTRIM(j.value)), 100) AS Value, CAST(j.[key] AS INT) AS Ord
          FROM OPENJSON(@WorkModes) j WHERE j.type = 1) v
    WHERE v.Value IN ('On-site', 'Remote', 'Hybrid')
    GROUP BY v.Value
    ORDER BY MIN(v.Ord);

    UPDATE jobs.PreferenceTerms SET ExpectedCtc = @ExpectedCtc, UpdatedAt = GETDATE() WHERE UserId = @UserId;

    IF @@ROWCOUNT = 0
        INSERT INTO jobs.PreferenceTerms (UserId, ExpectedCtc) VALUES (@UserId, @ExpectedCtc);

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Preferences saved' AS Message;
END
GO

PRINT 'Job Portal profile: the job preferences are in place.';
GO
SET NOEXEC OFF;
GO
