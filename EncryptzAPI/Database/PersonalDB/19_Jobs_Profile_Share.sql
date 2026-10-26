/* =============================================================================
   PersonalDB · 19 · Job Portal: a shareable link to a person's profile
   -----------------------------------------------------------------------------
   Run AFTER 18_Jobs_Public_Related.sql, in the Personal DB. SAFE TO RE-RUN.

   A person can switch on a public link to their profile (www.../p/<code>), to send to
   anybody or put on a CV. It is off until they switch it on, and they can switch it off
   again: the link then answers "not found". The code is random (10 letters and digits)
   and stays the same when the link is switched on again, so a link sent once keeps working.

   The public page shows the name, headline, summary, city, the Verified tick, the photo,
   experience, education, skills, the titles of certificates and the social links.
   NEVER the email, the phone, the date of birth, the resume, a certificate file, the
   preferences (expected CTC) or a user id.

     jobs.Profiles.ShareCode, ShareOn
     jobs.sp_Profile_Share_Get     the person's own: is it on, and the code
     jobs.sp_Profile_Share_Set     switch it on (a code is made once) or off
     jobs.sp_Public_Profile_Get    the public page of a code (nothing when off)
     jobs.sp_Public_Profile_Photo  the photo of a code (nothing when off)
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR OBJECT_ID('jobs.SocialLinks') IS NULL OR COL_LENGTH('jobs.Profiles', 'VerifiedAt') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run scripts 15 and 16 in it before running this script.', 16, 1);
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
   Columns
   ============================================================================= */
IF COL_LENGTH('jobs.Profiles', 'ShareCode') IS NULL
    ALTER TABLE jobs.Profiles ADD ShareCode VARCHAR(12) NULL,
                                  ShareOn   BIT NOT NULL CONSTRAINT DF_jobs_Profiles_ShareOn DEFAULT (0);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_jobs_Profiles_ShareCode' AND object_id = OBJECT_ID('jobs.Profiles'))
    CREATE UNIQUE INDEX UQ_jobs_Profiles_ShareCode ON jobs.Profiles(ShareCode) WHERE ShareCode IS NOT NULL;
GO

/* =============================================================================
   PERSON · the link
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Profile_Share_Get
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.ShareOn, ISNULL(p.ShareCode, '') AS ShareCode
    FROM jobs.Profiles p
    WHERE p.UserId = @UserId;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Profile_Share_Set
    @UserId INT,
    @On     BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @On = ISNULL(@On, 0);

    IF @On = 1 AND NOT EXISTS (SELECT 1 FROM jobs.Profiles WHERE UserId = @UserId AND FullName <> '' AND Headline <> '')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Add your name and a headline before you share your profile' AS Message; RETURN;
    END

    IF @On = 0
    BEGIN
        UPDATE jobs.Profiles SET ShareOn = 0 WHERE UserId = @UserId;
        SELECT CAST(1 AS INT) AS Success, 'The link is off. Nobody can open it now' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    DECLARE @Code VARCHAR(12) = (SELECT ShareCode FROM jobs.Profiles WITH (UPDLOCK, HOLDLOCK) WHERE UserId = @UserId);

    /* a new code: 10 of 32 letters and digits (no 0, 1, l, o), from the random generator */
    DECLARE @Alphabet VARCHAR(32) = 'abcdefghijkmnpqrstuvwxyz23456789', @Bytes VARBINARY(10), @i INT;
    WHILE @Code IS NULL OR EXISTS (SELECT 1 FROM jobs.Profiles WHERE ShareCode = @Code AND UserId <> @UserId)
    BEGIN
        SELECT @Bytes = CRYPT_GEN_RANDOM(10), @Code = '', @i = 1;
        WHILE @i <= 10
        BEGIN
            SET @Code = @Code + SUBSTRING(@Alphabet, (CAST(SUBSTRING(@Bytes, @i, 1) AS INT) % 32) + 1, 1);
            SET @i = @i + 1;
        END
    END

    UPDATE jobs.Profiles SET ShareCode = @Code, ShareOn = 1 WHERE UserId = @UserId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Your profile link is on. Anybody with the link can see it' AS Message;
END
GO

/* =============================================================================
   PUBLIC · the page of a code: the profile first (no row = not shared), then
   experience, education, skills, sub-skills, certificates and social links
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Public_Profile_Get
    @Code VARCHAR(12)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Person INT;
    SELECT @Person = UserId FROM jobs.Profiles
    WHERE ShareCode = @Code AND ShareOn = 1 AND FullName <> '' AND Headline <> '';

    SELECT p.FullName, p.Headline, p.Summary, p.City,
           CAST(CASE WHEN p.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified,
           CAST(CASE WHEN EXISTS (SELECT 1 FROM jobs.Files f WHERE f.UserId = p.UserId AND f.Kind = 'Photo') THEN 1 ELSE 0 END AS BIT) AS HasPhoto
    FROM jobs.Profiles p
    WHERE p.UserId = @Person;

    IF @Person IS NULL RETURN;

    SELECT e.ExperienceId, e.Organisation, e.Title, e.StartMonth, e.EndMonth, e.Description
    FROM jobs.Experience e
    WHERE e.UserId = @Person
    ORDER BY ISNULL(e.EndMonth, '9999-12-31') DESC, e.StartMonth DESC, e.ExperienceId DESC;

    SELECT d.EducationId, d.Institution, d.Course, d.FieldOfStudy, d.StartYear, d.EndYear
    FROM jobs.Education d
    WHERE d.UserId = @Person
    ORDER BY ISNULL(d.EndYear, 9999) DESC, d.StartYear DESC, d.EducationId DESC;

    SELECT s.SkillId, s.SkillName, s.Level, s.Rating, ISNULL(s.EvidenceUrl, '') AS EvidenceUrl
    FROM jobs.Skills s
    WHERE s.UserId = @Person
    ORDER BY s.SkillName;

    SELECT u.SubSkillId, u.SkillId, u.SubSkillName, u.Rating
    FROM jobs.SubSkills u
    WHERE u.UserId = @Person
    ORDER BY u.SkillId, u.SortOrder, u.SubSkillId;

    SELECT c.CertificateId, c.Title, c.Issuer, c.IssuedOn, c.Status
    FROM jobs.Certificates c
    WHERE c.UserId = @Person
    ORDER BY ISNULL(c.IssuedOn, '1900-01-01') DESC, c.CertificateId DESC;

    SELECT l.Platform, l.Url
    FROM jobs.SocialLinks l
    WHERE l.UserId = @Person
    ORDER BY l.SortOrder, l.SocialLinkId;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Public_Profile_Photo
    @Code VARCHAR(12)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (1) f.FileName, f.ContentType, f.Content
    FROM jobs.Profiles p
    INNER JOIN jobs.Files f ON f.UserId = p.UserId AND f.Kind = 'Photo'
    WHERE p.ShareCode = @Code AND p.ShareOn = 1 AND p.FullName <> ''
    ORDER BY f.FileId DESC;
END
GO

PRINT 'Job Portal: the shareable profile link is in place.';
GO
SET NOEXEC OFF;
GO
