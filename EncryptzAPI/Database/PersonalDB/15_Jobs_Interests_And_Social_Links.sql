/* =============================================================================
   PersonalDB · 15 · Job Portal: interests, hobbies and social media links
   -----------------------------------------------------------------------------
   Run AFTER 02_Jobs_Profile.sql, in the Personal DB. SAFE TO RE-RUN.

     jobs.Interests           the interests and hobbies of a person: one row each,
                              in the order they were given
     jobs.SocialLinks         the professional and social media profiles of a person
                              (LinkedIn, GitHub, ...): the platform and the https address
     jobs.sp_Interest_List    the interests and hobbies
     jobs.sp_Interest_Save    replaces all of them in one go; the two lists arrive as
                              JSON arrays of text
     jobs.sp_SocialLink_List  the links
     jobs.sp_SocialLink_Save  replaces all of them in one go; they arrive as a JSON
                              array of { "platform": ..., "url": ... }

   The API checks the addresses and names the platform; the procedures keep only
   https addresses and the limits.

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

IF OBJECT_ID('jobs.Interests') IS NULL
CREATE TABLE jobs.Interests
(
    InterestId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Interests PRIMARY KEY,
    UserId     INT           NOT NULL,
    Kind       NVARCHAR(10)  NOT NULL CONSTRAINT CK_jobs_Interests_Kind CHECK (Kind IN ('Interest', 'Hobby')),
    Value      NVARCHAR(100) NOT NULL,
    SortOrder  INT           NOT NULL,
    CreatedAt  DATETIME      NOT NULL CONSTRAINT DF_jobs_Interests_CreatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_jobs_Interests_User_Kind_Value' AND object_id = OBJECT_ID('jobs.Interests'))
    CREATE UNIQUE INDEX UQ_jobs_Interests_User_Kind_Value ON jobs.Interests(UserId, Kind, Value);
GO

IF OBJECT_ID('jobs.SocialLinks') IS NULL
CREATE TABLE jobs.SocialLinks
(
    SocialLinkId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_SocialLinks PRIMARY KEY,
    UserId       INT           NOT NULL,
    Platform     NVARCHAR(30)  NOT NULL,
    Url          NVARCHAR(400) NOT NULL CONSTRAINT CK_jobs_SocialLinks_Url CHECK (Url LIKE 'https://%'),
    SortOrder    INT           NOT NULL,
    CreatedAt    DATETIME      NOT NULL CONSTRAINT DF_jobs_SocialLinks_CreatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_jobs_SocialLinks_User_Url' AND object_id = OBJECT_ID('jobs.SocialLinks'))
    CREATE UNIQUE INDEX UQ_jobs_SocialLinks_User_Url ON jobs.SocialLinks(UserId, Url);
GO

/* The rows (Kind, Value) in their order. */
CREATE OR ALTER PROCEDURE jobs.sp_Interest_List
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT i.Kind, i.Value
    FROM jobs.Interests i
    WHERE i.UserId = @UserId
    ORDER BY i.Kind, i.SortOrder, i.InterestId;
END
GO

/* Replaces the interests and hobbies. @Interests and @Hobbies are JSON arrays of text;
   an entry is trimmed, a blank or repeated one is left out, and at most 15 of a kind
   are kept. */
CREATE OR ALTER PROCEDURE jobs.sp_Interest_Save
    @UserId    INT,
    @Interests NVARCHAR(MAX) = NULL,
    @Hobbies   NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Interests = ISNULL(NULLIF(LTRIM(RTRIM(@Interests)), ''), '[]');
    SET @Hobbies   = ISNULL(NULLIF(LTRIM(RTRIM(@Hobbies)), ''), '[]');

    IF @UserId IS NULL OR @UserId = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    IF ISJSON(@Interests) = 0 OR ISJSON(@Hobbies) = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Could not save. Please try again' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    DELETE FROM jobs.Interests WHERE UserId = @UserId;

    INSERT INTO jobs.Interests (UserId, Kind, Value, SortOrder)
    SELECT TOP (15) @UserId, 'Interest', v.Value, MIN(v.Ord)
    FROM (SELECT LEFT(LTRIM(RTRIM(j.value)), 100) AS Value, CAST(j.[key] AS INT) AS Ord
          FROM OPENJSON(@Interests) j WHERE j.type = 1) v
    WHERE v.Value <> ''
    GROUP BY v.Value
    ORDER BY MIN(v.Ord);

    INSERT INTO jobs.Interests (UserId, Kind, Value, SortOrder)
    SELECT TOP (15) @UserId, 'Hobby', v.Value, MIN(v.Ord)
    FROM (SELECT LEFT(LTRIM(RTRIM(j.value)), 100) AS Value, CAST(j.[key] AS INT) AS Ord
          FROM OPENJSON(@Hobbies) j WHERE j.type = 1) v
    WHERE v.Value <> ''
    GROUP BY v.Value
    ORDER BY MIN(v.Ord);

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Interests and hobbies saved' AS Message;
END
GO

/* The links (Platform, Url) in their order. */
CREATE OR ALTER PROCEDURE jobs.sp_SocialLink_List
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT s.Platform, s.Url
    FROM jobs.SocialLinks s
    WHERE s.UserId = @UserId
    ORDER BY s.SortOrder, s.SocialLinkId;
END
GO

/* Replaces the links. @Links is a JSON array of { "platform": ..., "url": ... };
   an entry without an https address or a repeated address is left out, and at most
   10 are kept. */
CREATE OR ALTER PROCEDURE jobs.sp_SocialLink_Save
    @UserId INT,
    @Links  NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Links = ISNULL(NULLIF(LTRIM(RTRIM(@Links)), ''), '[]');

    IF @UserId IS NULL OR @UserId = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    IF ISJSON(@Links) = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Could not save. Please try again' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    DELETE FROM jobs.SocialLinks WHERE UserId = @UserId;

    INSERT INTO jobs.SocialLinks (UserId, Platform, Url, SortOrder)
    SELECT TOP (10) @UserId, MIN(v.Platform), v.Url, MIN(v.Ord)
    FROM (SELECT ISNULL(NULLIF(LEFT(LTRIM(RTRIM(l.platform)), 30), ''), 'Website') AS Platform,
                 LTRIM(RTRIM(l.url)) AS Url,
                 CAST(j.[key] AS INT) AS Ord
          FROM OPENJSON(@Links) j
          CROSS APPLY OPENJSON(j.value) WITH (platform NVARCHAR(100) '$.platform', url NVARCHAR(4000) '$.url') l
          WHERE j.type = 5) v
    WHERE v.Url LIKE 'https://%' AND LEN(v.Url) <= 400
    GROUP BY v.Url
    ORDER BY MIN(v.Ord);

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Social links saved' AS Message;
END
GO

PRINT 'Job Portal profile: interests, hobbies and social links are in place.';
GO
SET NOEXEC OFF;
GO
