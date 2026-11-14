/* =============================================================================
   PersonalDB · 13 · Job Portal: a rating out of 5 for every skill, and sub-skills
   -----------------------------------------------------------------------------
   Run AFTER 02_Jobs_Profile.sql, in the Personal DB. SAFE TO RE-RUN.
   Run it AGAIN every time script 02 is run again: 02 re-creates the procedures
   below in their earlier form.

     jobs.Skills.Rating   the person's own rating of the skill, 1 to 5. The old
                          Level stays and follows the rating (1-2 Beginner,
                          3-4 Intermediate, 5 Expert): other procedures sort by it.
                          Existing rows: Beginner 2, Intermediate 3, Expert 5.
     jobs.SubSkills       the parts of a skill, each with its own rating 1 to 5
                          (Accounting -> GST 4, Payroll 3). Up to 20 per skill.

     jobs.sp_Profile_Get  the skills now carry Rating, and a SEVENTH result set
                          gives the sub-skills. It stays the last set, so the
                          procedures that EXEC it (06, 10, 11) need no change.
     jobs.sp_Skill_Save   takes @Rating and @SubSkills, a JSON array of
                          {"name": "...", "rating": n}; the sub-skills of the
                          skill are replaced in one go.
     jobs.sp_Skill_Delete removes the sub-skills with the skill.

   Like everywhere in schema jobs: every procedure takes @UserId first and every
   statement on a jobs table names it.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL OR OBJECT_ID('jobs.Skills') IS NULL
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

/* -----------------------------------------------------------------------------
   Tables
   ----------------------------------------------------------------------------- */
IF COL_LENGTH('jobs.Skills', 'Rating') IS NULL
BEGIN
    ALTER TABLE jobs.Skills ADD Rating TINYINT NULL;
END
GO

-- only the rows that have no rating yet: a re-run changes nothing
UPDATE jobs.Skills
SET Rating = CASE Level WHEN 'Expert' THEN 5 WHEN 'Intermediate' THEN 3 ELSE 2 END
WHERE Rating IS NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('jobs.Skills') AND name = 'Rating' AND is_nullable = 1)
    ALTER TABLE jobs.Skills ALTER COLUMN Rating TINYINT NOT NULL;
GO

IF OBJECT_ID('jobs.DF_jobs_Skills_Rating') IS NULL
    ALTER TABLE jobs.Skills ADD CONSTRAINT DF_jobs_Skills_Rating DEFAULT (3) FOR Rating;
GO

IF OBJECT_ID('jobs.CK_jobs_Skills_Rating') IS NULL
    ALTER TABLE jobs.Skills ADD CONSTRAINT CK_jobs_Skills_Rating CHECK (Rating BETWEEN 1 AND 5);
GO

IF OBJECT_ID('jobs.SubSkills') IS NULL
CREATE TABLE jobs.SubSkills
(
    SubSkillId   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_SubSkills PRIMARY KEY,
    UserId       INT           NOT NULL,
    SkillId      INT           NOT NULL CONSTRAINT FK_jobs_SubSkills_Skill REFERENCES jobs.Skills(SkillId),
    SubSkillName NVARCHAR(100) NOT NULL,
    Rating       TINYINT       NOT NULL CONSTRAINT CK_jobs_SubSkills_Rating CHECK (Rating BETWEEN 1 AND 5),
    SortOrder    INT           NOT NULL CONSTRAINT DF_jobs_SubSkills_SortOrder DEFAULT (0),
    CreatedAt    DATETIME      NOT NULL CONSTRAINT DF_jobs_SubSkills_CreatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_jobs_SubSkills_Skill_Name UNIQUE (SkillId, SubSkillName)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_SubSkills_User' AND object_id = OBJECT_ID('jobs.SubSkills'))
    CREATE INDEX IX_jobs_SubSkills_User ON jobs.SubSkills(UserId, SkillId);
GO

/* =============================================================================
   The whole page: seven result sets. File content is never part of it.
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Profile_Get
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.FullName, p.Headline, p.Summary, p.City, p.ContactEmail, p.ContactPhone,
           p.DateOfBirth, p.IsVisible, p.UpdatedAt
    FROM jobs.Profiles p
    WHERE p.UserId = @UserId;

    SELECT e.ExperienceId, e.Organisation, e.Title, e.StartMonth, e.EndMonth, e.Description
    FROM jobs.Experience e
    WHERE e.UserId = @UserId
    ORDER BY ISNULL(e.EndMonth, '9999-12-31') DESC, e.StartMonth DESC, e.ExperienceId DESC;

    SELECT d.EducationId, d.Institution, d.Course, d.FieldOfStudy, d.StartYear, d.EndYear
    FROM jobs.Education d
    WHERE d.UserId = @UserId
    ORDER BY ISNULL(d.EndYear, 9999) DESC, d.StartYear DESC, d.EducationId DESC;

    SELECT s.SkillId, s.SkillName, s.Level, s.Rating, ISNULL(s.EvidenceUrl, '') AS EvidenceUrl
    FROM jobs.Skills s
    WHERE s.UserId = @UserId
    ORDER BY s.SkillName;

    SELECT c.CertificateId, c.Title, c.Issuer, c.IssuedOn, c.Status,
           ISNULL(c.FileId, 0) AS FileId, ISNULL(f.FileName, '') AS FileName, ISNULL(f.SizeBytes, 0) AS SizeBytes
    FROM jobs.Certificates c
    LEFT JOIN jobs.Files f ON f.FileId = c.FileId AND f.UserId = @UserId
    WHERE c.UserId = @UserId
    ORDER BY ISNULL(c.IssuedOn, '1900-01-01') DESC, c.CertificateId DESC;

    SELECT TOP (1) f.FileId, f.FileName, f.SizeBytes, f.UploadedAt
    FROM jobs.Files f
    WHERE f.UserId = @UserId AND f.Kind = 'Resume'
    ORDER BY f.FileId DESC;

    SELECT u.SubSkillId, u.SkillId, u.SubSkillName, u.Rating
    FROM jobs.SubSkills u
    WHERE u.UserId = @UserId
    ORDER BY u.SkillId, u.SortOrder, u.SubSkillId;
END
GO

/* =============================================================================
   Skills
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Skill_Save
    @UserId      INT,
    @SkillId     INT,
    @SkillName   NVARCHAR(100),
    @Rating      TINYINT,
    @EvidenceUrl NVARCHAR(400) = NULL,
    @SubSkills   NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @SkillId     = ISNULL(@SkillId, 0);
    SET @SkillName   = LTRIM(RTRIM(ISNULL(@SkillName, '')));
    SET @EvidenceUrl = NULLIF(LTRIM(RTRIM(ISNULL(@EvidenceUrl, ''))), '');
    SET @SubSkills   = ISNULL(NULLIF(LTRIM(RTRIM(@SubSkills)), ''), '[]');

    IF @Rating IS NULL OR @Rating < 1 OR @Rating > 5
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Rate the skill from 1 to 5' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF ISJSON(@SubSkills) = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The sub-skills could not be read' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    DECLARE @Level NVARCHAR(20) = CASE WHEN @Rating >= 5 THEN 'Expert' WHEN @Rating >= 3 THEN 'Intermediate' ELSE 'Beginner' END;

    IF EXISTS (SELECT 1 FROM jobs.Skills WHERE UserId = @UserId AND SkillName = @SkillName AND SkillId <> @SkillId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You already have this skill' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    IF @SkillId = 0
    BEGIN
        IF (SELECT COUNT(*) FROM jobs.Skills WHERE UserId = @UserId) >= 50
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'You can keep up to 50 skills. Remove one first' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        INSERT INTO jobs.Skills (UserId, SkillName, Level, Rating, EvidenceUrl)
        VALUES (@UserId, @SkillName, @Level, @Rating, @EvidenceUrl);

        SET @SkillId = CAST(SCOPE_IDENTITY() AS INT);
    END
    ELSE
    BEGIN
        UPDATE jobs.Skills
        SET SkillName = @SkillName, Level = @Level, Rating = @Rating, EvidenceUrl = @EvidenceUrl
        WHERE SkillId = @SkillId AND UserId = @UserId;

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END
    END

    -- the sub-skills of the skill are replaced: up to 20, a name once, a rating of 1 to 5
    DELETE FROM jobs.SubSkills WHERE UserId = @UserId AND SkillId = @SkillId;

    INSERT INTO jobs.SubSkills (UserId, SkillId, SubSkillName, Rating, SortOrder)
    SELECT TOP (20) @UserId, @SkillId, v.Name, MIN(v.Rating), MIN(v.Ord)
    FROM (SELECT LEFT(LTRIM(RTRIM(ISNULL(j.Name, ''))), 100) AS Name, j.Rating, CAST(k.[key] AS INT) AS Ord
          FROM OPENJSON(@SubSkills) k
          CROSS APPLY OPENJSON(k.value) WITH (Name NVARCHAR(200) '$.name', Rating INT '$.rating') j
          WHERE k.type = 5) v
    WHERE v.Name <> '' AND v.Rating BETWEEN 1 AND 5
    GROUP BY v.Name
    ORDER BY MIN(v.Ord);

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Skill saved' AS Message, @SkillId AS Id;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Skill_Delete
    @UserId  INT,
    @SkillId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DELETE FROM jobs.SubSkills WHERE SkillId = @SkillId AND UserId = @UserId;
    DELETE FROM jobs.Skills WHERE SkillId = @SkillId AND UserId = @UserId;

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS INT) AS Success, 'Skill removed' AS Message;
END
GO

PRINT 'Job Portal: skills have a rating out of 5 and sub-skills.';
GO
