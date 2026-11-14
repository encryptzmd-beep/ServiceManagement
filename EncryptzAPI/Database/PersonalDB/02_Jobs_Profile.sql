/* =============================================================================
   PersonalDB · 02 · Job Portal: the individual's profile
   -----------------------------------------------------------------------------
   Run AFTER 01_Schema.sql, in the Personal DB. Refuses any other database.
   SAFE TO RE-RUN: tables are created only when missing, procedures are replaced.

   Schema jobs. Every row belongs to one person: UserId is the UserId of the
   SaaS main database (no foreign key: it is another database).

     jobs.Profiles      one row per user; IsVisible = "Employers can find me" (default 0)
     jobs.Experience    work history
     jobs.Education     education history
     jobs.Skills        skill, level, optional evidence link
     jobs.Files         resume and certificate files (the content is here)
     jobs.Certificates  Status is 'Uploaded' for now; VerifiedBy / VerifiedAt wait
                        for the day an issuer or institution can confirm one

   THE RULE OF THIS SCHEMA: every procedure takes @UserId first, and every
   statement that touches a table names @UserId. A row id of another user is
   "not found". The one exception is jobs.sp_Skill_Suggest, which returns skill
   names of everybody and nothing else. (EncryptzTests/JobsScriptTests checks it.)

   Limits per user: 30 experience rows, 20 education rows, 50 skills,
   30 certificates, 1 resume.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
BEGIN
    RAISERROR('Select the Personal DB (run 01_Schema.sql in it first) before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
BEGIN
    RAISERROR('This database is not marked as the Personal DB. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('jobs') IS NULL
    EXEC('CREATE SCHEMA jobs AUTHORIZATION dbo');
GO

/* -----------------------------------------------------------------------------
   Tables
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('jobs.Profiles') IS NULL
CREATE TABLE jobs.Profiles
(
    UserId       INT            NOT NULL CONSTRAINT PK_jobs_Profiles PRIMARY KEY,
    FullName     NVARCHAR(200)  NOT NULL CONSTRAINT DF_jobs_Profiles_FullName DEFAULT (''),
    Headline     NVARCHAR(200)  NOT NULL CONSTRAINT DF_jobs_Profiles_Headline DEFAULT (''),
    Summary      NVARCHAR(2000) NOT NULL CONSTRAINT DF_jobs_Profiles_Summary  DEFAULT (''),
    City         NVARCHAR(100)  NOT NULL CONSTRAINT DF_jobs_Profiles_City     DEFAULT (''),
    ContactEmail NVARCHAR(256)  NOT NULL CONSTRAINT DF_jobs_Profiles_Email    DEFAULT (''),
    ContactPhone NVARCHAR(30)   NOT NULL CONSTRAINT DF_jobs_Profiles_Phone    DEFAULT (''),
    DateOfBirth  DATE           NULL,
    IsVisible    BIT            NOT NULL CONSTRAINT DF_jobs_Profiles_IsVisible DEFAULT (0),   -- private by default
    CreatedAt    DATETIME       NOT NULL CONSTRAINT DF_jobs_Profiles_CreatedAt DEFAULT (GETDATE()),
    UpdatedAt    DATETIME       NOT NULL CONSTRAINT DF_jobs_Profiles_UpdatedAt DEFAULT (GETDATE())
);
GO

IF OBJECT_ID('jobs.Experience') IS NULL
CREATE TABLE jobs.Experience
(
    ExperienceId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Experience PRIMARY KEY,
    UserId       INT            NOT NULL,
    Organisation NVARCHAR(200)  NOT NULL,
    Title        NVARCHAR(200)  NOT NULL,
    StartMonth   DATE           NOT NULL,        -- first day of the month
    EndMonth     DATE           NULL,            -- NULL = works there now
    Description  NVARCHAR(2000) NOT NULL CONSTRAINT DF_jobs_Experience_Description DEFAULT (''),
    CreatedAt    DATETIME       NOT NULL CONSTRAINT DF_jobs_Experience_CreatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Experience_User' AND object_id = OBJECT_ID('jobs.Experience'))
    CREATE INDEX IX_jobs_Experience_User ON jobs.Experience(UserId);
GO

IF OBJECT_ID('jobs.Education') IS NULL
CREATE TABLE jobs.Education
(
    EducationId  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Education PRIMARY KEY,
    UserId       INT           NOT NULL,
    Institution  NVARCHAR(200) NOT NULL,
    Course       NVARCHAR(200) NOT NULL,
    FieldOfStudy NVARCHAR(200) NOT NULL CONSTRAINT DF_jobs_Education_Field DEFAULT (''),
    StartYear    SMALLINT      NULL,
    EndYear      SMALLINT      NULL,
    CreatedAt    DATETIME      NOT NULL CONSTRAINT DF_jobs_Education_CreatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Education_User' AND object_id = OBJECT_ID('jobs.Education'))
    CREATE INDEX IX_jobs_Education_User ON jobs.Education(UserId);
GO

IF OBJECT_ID('jobs.Skills') IS NULL
CREATE TABLE jobs.Skills
(
    SkillId     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Skills PRIMARY KEY,
    UserId      INT           NOT NULL,
    SkillName   NVARCHAR(100) NOT NULL,
    Level       NVARCHAR(20)  NOT NULL CONSTRAINT CK_jobs_Skills_Level CHECK (Level IN ('Beginner', 'Intermediate', 'Expert')),
    EvidenceUrl NVARCHAR(400) NULL,
    CreatedAt   DATETIME      NOT NULL CONSTRAINT DF_jobs_Skills_CreatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_jobs_Skills_User_Name UNIQUE (UserId, SkillName)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Skills_Name' AND object_id = OBJECT_ID('jobs.Skills'))
    CREATE INDEX IX_jobs_Skills_Name ON jobs.Skills(SkillName);
GO

IF OBJECT_ID('jobs.Files') IS NULL
CREATE TABLE jobs.Files
(
    FileId      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Files PRIMARY KEY,
    UserId      INT            NOT NULL,
    Kind        NVARCHAR(20)   NOT NULL CONSTRAINT CK_jobs_Files_Kind CHECK (Kind IN ('Resume', 'Certificate')),
    FileName    NVARCHAR(260)  NOT NULL,
    ContentType NVARCHAR(100)  NOT NULL,
    SizeBytes   INT            NOT NULL,
    Content     VARBINARY(MAX) NOT NULL,
    UploadedAt  DATETIME       NOT NULL CONSTRAINT DF_jobs_Files_UploadedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Files_User' AND object_id = OBJECT_ID('jobs.Files'))
    CREATE INDEX IX_jobs_Files_User ON jobs.Files(UserId, Kind);
GO

IF OBJECT_ID('jobs.Certificates') IS NULL
CREATE TABLE jobs.Certificates
(
    CertificateId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Certificates PRIMARY KEY,
    UserId        INT           NOT NULL,
    Title         NVARCHAR(200) NOT NULL,
    Issuer        NVARCHAR(200) NOT NULL CONSTRAINT DF_jobs_Certificates_Issuer DEFAULT (''),
    IssuedOn      DATE          NULL,
    FileId        INT           NULL CONSTRAINT FK_jobs_Certificates_Files REFERENCES jobs.Files(FileId),
    Status        NVARCHAR(30)  NOT NULL CONSTRAINT DF_jobs_Certificates_Status DEFAULT ('Uploaded'),
    VerifiedBy    NVARCHAR(200) NULL,
    VerifiedAt    DATETIME      NULL,
    CreatedAt     DATETIME      NOT NULL CONSTRAINT DF_jobs_Certificates_CreatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Certificates_User' AND object_id = OBJECT_ID('jobs.Certificates'))
    CREATE INDEX IX_jobs_Certificates_User ON jobs.Certificates(UserId);
GO

/* =============================================================================
   The whole page: six result sets. File content is never part of it.
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

    SELECT s.SkillId, s.SkillName, s.Level, ISNULL(s.EvidenceUrl, '') AS EvidenceUrl
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
END
GO

/* =============================================================================
   Profile
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Profile_Save
    @UserId       INT,
    @FullName     NVARCHAR(200),
    @Headline     NVARCHAR(200),
    @Summary      NVARCHAR(2000) = NULL,
    @City         NVARCHAR(100)  = NULL,
    @ContactEmail NVARCHAR(256)  = NULL,
    @ContactPhone NVARCHAR(30)   = NULL,
    @DateOfBirth  DATE           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @FullName     = LTRIM(RTRIM(ISNULL(@FullName, '')));
    SET @Headline     = LTRIM(RTRIM(ISNULL(@Headline, '')));
    SET @Summary      = LTRIM(RTRIM(ISNULL(@Summary, '')));
    SET @City         = LTRIM(RTRIM(ISNULL(@City, '')));
    SET @ContactEmail = LTRIM(RTRIM(ISNULL(@ContactEmail, '')));
    SET @ContactPhone = LTRIM(RTRIM(ISNULL(@ContactPhone, '')));

    IF @UserId IS NULL OR @UserId = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM jobs.Profiles WITH (UPDLOCK, HOLDLOCK) WHERE UserId = @UserId)
        /* a profile without a name or a headline is never visible */
        UPDATE jobs.Profiles
        SET FullName = @FullName, Headline = @Headline, Summary = @Summary, City = @City,
            ContactEmail = @ContactEmail, ContactPhone = @ContactPhone, DateOfBirth = @DateOfBirth,
            IsVisible = CASE WHEN @FullName = '' OR @Headline = '' THEN 0 ELSE IsVisible END,
            UpdatedAt = GETDATE()
        WHERE UserId = @UserId;
    ELSE
        INSERT INTO jobs.Profiles (UserId, FullName, Headline, Summary, City, ContactEmail, ContactPhone, DateOfBirth)
        VALUES (@UserId, @FullName, @Headline, @Summary, @City, @ContactEmail, @ContactPhone, @DateOfBirth);

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Profile saved' AS Message;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Profile_SetVisible
    @UserId    INT,
    @IsVisible BIT
AS
BEGIN
    SET NOCOUNT ON;

    SET @IsVisible = ISNULL(@IsVisible, 0);

    IF @IsVisible = 1
       AND NOT EXISTS (SELECT 1 FROM jobs.Profiles WHERE UserId = @UserId AND FullName <> '' AND Headline <> '')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Add your name and a headline before you switch this on' AS Message; RETURN;
    END

    UPDATE jobs.Profiles SET IsVisible = @IsVisible, UpdatedAt = GETDATE() WHERE UserId = @UserId;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @IsVisible = 1 THEN 'Employers can find your profile' ELSE 'Your profile is private' END AS Message;
END
GO

/* =============================================================================
   Experience
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Experience_Save
    @UserId       INT,
    @ExperienceId INT,
    @Organisation NVARCHAR(200),
    @Title        NVARCHAR(200),
    @StartMonth   DATE,
    @EndMonth     DATE = NULL,
    @Description  NVARCHAR(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @ExperienceId = ISNULL(@ExperienceId, 0);
    SET @Description  = LTRIM(RTRIM(ISNULL(@Description, '')));

    IF @ExperienceId = 0
    BEGIN
        IF (SELECT COUNT(*) FROM jobs.Experience WHERE UserId = @UserId) >= 30
        BEGIN
            SELECT CAST(0 AS INT) AS Success, 'You can keep up to 30 entries. Remove one first' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        INSERT INTO jobs.Experience (UserId, Organisation, Title, StartMonth, EndMonth, Description)
        VALUES (@UserId, @Organisation, @Title, @StartMonth, @EndMonth, @Description);

        SELECT CAST(1 AS INT) AS Success, 'Experience added' AS Message, CAST(SCOPE_IDENTITY() AS INT) AS Id; RETURN;
    END

    UPDATE jobs.Experience
    SET Organisation = @Organisation, Title = @Title, StartMonth = @StartMonth, EndMonth = @EndMonth, Description = @Description
    WHERE ExperienceId = @ExperienceId AND UserId = @UserId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Experience saved' AS Message, @ExperienceId AS Id;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Experience_Delete
    @UserId       INT,
    @ExperienceId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM jobs.Experience WHERE ExperienceId = @ExperienceId AND UserId = @UserId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Experience removed' AS Message;
END
GO

/* =============================================================================
   Education
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Education_Save
    @UserId       INT,
    @EducationId  INT,
    @Institution  NVARCHAR(200),
    @Course       NVARCHAR(200),
    @FieldOfStudy NVARCHAR(200) = NULL,
    @StartYear    SMALLINT = NULL,
    @EndYear      SMALLINT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @EducationId  = ISNULL(@EducationId, 0);
    SET @FieldOfStudy = LTRIM(RTRIM(ISNULL(@FieldOfStudy, '')));

    IF @EducationId = 0
    BEGIN
        IF (SELECT COUNT(*) FROM jobs.Education WHERE UserId = @UserId) >= 20
        BEGIN
            SELECT CAST(0 AS INT) AS Success, 'You can keep up to 20 entries. Remove one first' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        INSERT INTO jobs.Education (UserId, Institution, Course, FieldOfStudy, StartYear, EndYear)
        VALUES (@UserId, @Institution, @Course, @FieldOfStudy, @StartYear, @EndYear);

        SELECT CAST(1 AS INT) AS Success, 'Education added' AS Message, CAST(SCOPE_IDENTITY() AS INT) AS Id; RETURN;
    END

    UPDATE jobs.Education
    SET Institution = @Institution, Course = @Course, FieldOfStudy = @FieldOfStudy, StartYear = @StartYear, EndYear = @EndYear
    WHERE EducationId = @EducationId AND UserId = @UserId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Education saved' AS Message, @EducationId AS Id;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Education_Delete
    @UserId      INT,
    @EducationId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM jobs.Education WHERE EducationId = @EducationId AND UserId = @UserId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Education removed' AS Message;
END
GO

/* =============================================================================
   Skills
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Skill_Save
    @UserId      INT,
    @SkillId     INT,
    @SkillName   NVARCHAR(100),
    @Level       NVARCHAR(20),
    @EvidenceUrl NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @SkillId     = ISNULL(@SkillId, 0);
    SET @SkillName   = LTRIM(RTRIM(ISNULL(@SkillName, '')));
    SET @EvidenceUrl = NULLIF(LTRIM(RTRIM(ISNULL(@EvidenceUrl, ''))), '');

    IF EXISTS (SELECT 1 FROM jobs.Skills WHERE UserId = @UserId AND SkillName = @SkillName AND SkillId <> @SkillId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You already have this skill' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @SkillId = 0
    BEGIN
        IF (SELECT COUNT(*) FROM jobs.Skills WHERE UserId = @UserId) >= 50
        BEGIN
            SELECT CAST(0 AS INT) AS Success, 'You can keep up to 50 skills. Remove one first' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        INSERT INTO jobs.Skills (UserId, SkillName, Level, EvidenceUrl)
        VALUES (@UserId, @SkillName, @Level, @EvidenceUrl);

        SELECT CAST(1 AS INT) AS Success, 'Skill added' AS Message, CAST(SCOPE_IDENTITY() AS INT) AS Id; RETURN;
    END

    UPDATE jobs.Skills
    SET SkillName = @SkillName, Level = @Level, EvidenceUrl = @EvidenceUrl
    WHERE SkillId = @SkillId AND UserId = @UserId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Skill saved' AS Message, @SkillId AS Id;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Skill_Delete
    @UserId  INT,
    @SkillId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM jobs.Skills WHERE SkillId = @SkillId AND UserId = @UserId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Skill removed' AS Message;
END
GO

/* Skill names in use that start with the text: names only, of everybody.
   @UserId is taken like everywhere else and is not used. */
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

    SELECT DISTINCT TOP (10) s.SkillName
    FROM jobs.Skills s
    WHERE s.SkillName LIKE @Query + '%'
    ORDER BY s.SkillName;
END
GO

/* =============================================================================
   Certificates. @Content NULL = the certificate keeps the file it has.
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Certificate_Save
    @UserId        INT,
    @CertificateId INT,
    @Title         NVARCHAR(200),
    @Issuer        NVARCHAR(200) = NULL,
    @IssuedOn      DATE = NULL,
    @FileName      NVARCHAR(260) = NULL,
    @ContentType   NVARCHAR(100) = NULL,
    @SizeBytes     INT = NULL,
    @Content       VARBINARY(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @OldFileId INT, @NewFileId INT;

    SET @CertificateId = ISNULL(@CertificateId, 0);
    SET @Issuer        = LTRIM(RTRIM(ISNULL(@Issuer, '')));

    IF @CertificateId = 0
       AND (SELECT COUNT(*) FROM jobs.Certificates WHERE UserId = @UserId) >= 30
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You can keep up to 30 certificates. Remove one first' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @CertificateId > 0
       AND NOT EXISTS (SELECT 1 FROM jobs.Certificates WHERE CertificateId = @CertificateId AND UserId = @UserId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    IF @Content IS NOT NULL
    BEGIN
        INSERT INTO jobs.Files (UserId, Kind, FileName, ContentType, SizeBytes, Content)
        VALUES (@UserId, 'Certificate', @FileName, @ContentType, @SizeBytes, @Content);

        SET @NewFileId = SCOPE_IDENTITY();
    END

    IF @CertificateId = 0
    BEGIN
        INSERT INTO jobs.Certificates (UserId, Title, Issuer, IssuedOn, FileId)
        VALUES (@UserId, @Title, @Issuer, @IssuedOn, @NewFileId);

        SET @CertificateId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        SELECT @OldFileId = FileId FROM jobs.Certificates WHERE CertificateId = @CertificateId AND UserId = @UserId;

        UPDATE jobs.Certificates
        SET Title = @Title, Issuer = @Issuer, IssuedOn = @IssuedOn, FileId = ISNULL(@NewFileId, FileId)
        WHERE CertificateId = @CertificateId AND UserId = @UserId;

        -- the file that was replaced is not kept
        IF @NewFileId IS NOT NULL AND @OldFileId IS NOT NULL
            DELETE FROM jobs.Files WHERE FileId = @OldFileId AND UserId = @UserId AND Kind = 'Certificate';
    END

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Certificate saved' AS Message, @CertificateId AS Id;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Certificate_Delete
    @UserId        INT,
    @CertificateId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FileId INT, @Found BIT = 0;

    SELECT @FileId = FileId, @Found = 1 FROM jobs.Certificates WHERE CertificateId = @CertificateId AND UserId = @UserId;

    IF @Found = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    DELETE FROM jobs.Certificates WHERE CertificateId = @CertificateId AND UserId = @UserId;

    IF @FileId IS NOT NULL
        DELETE FROM jobs.Files WHERE FileId = @FileId AND UserId = @UserId AND Kind = 'Certificate';

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Certificate removed' AS Message;
END
GO

/* =============================================================================
   Resume: one per user. A new one replaces the old one.
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Resume_Save
    @UserId      INT,
    @FileName    NVARCHAR(260),
    @ContentType NVARCHAR(100),
    @SizeBytes   INT,
    @Content     VARBINARY(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @UserId IS NULL OR @UserId = 0 OR @Content IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose a file' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    DELETE FROM jobs.Files WHERE UserId = @UserId AND Kind = 'Resume';

    INSERT INTO jobs.Files (UserId, Kind, FileName, ContentType, SizeBytes, Content)
    VALUES (@UserId, 'Resume', @FileName, @ContentType, @SizeBytes, @Content);

    DECLARE @FileId INT = SCOPE_IDENTITY();

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Resume saved' AS Message, @FileId AS Id;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Resume_Delete
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM jobs.Files WHERE UserId = @UserId AND Kind = 'Resume';

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Resume removed' AS Message;
END
GO

/* =============================================================================
   One file of the user, with its content. No row = not found (also for a file
   of somebody else).
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_File_Get
    @UserId INT,
    @FileId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT f.FileName, f.ContentType, f.Content
    FROM jobs.Files f
    WHERE f.FileId = @FileId AND f.UserId = @UserId;
END
GO

PRINT 'Job Portal profile: tables and procedures are in place.';
GO
SET NOEXEC OFF;
GO
