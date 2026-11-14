/* =============================================================================
   PersonalDB · 04 · Job Portal: the photo of a profile
   -----------------------------------------------------------------------------
   Run AFTER 02_Jobs_Profile.sql (and 03), in the Personal DB. SAFE TO RE-RUN.
   Running script 02 again does not undo anything of this script.

   A photo is one more kind of file in jobs.Files, at most one per person:

     CK_jobs_Files_Kind      also allows 'Photo'
     jobs.sp_Photo_Save      stores the photo; an earlier one is replaced
     jobs.sp_Photo_Delete    removes it
     jobs.sp_Photo_Get       the photo of the user, with its content

   Like everywhere in schema jobs: every procedure takes @UserId first and every
   statement on a jobs table names it.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL OR OBJECT_ID('jobs.Files') IS NULL
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

/* the kinds of file: 'Photo' is added. No row is changed. */
IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_jobs_Files_Kind' AND parent_object_id = OBJECT_ID('jobs.Files')
             AND definition NOT LIKE '%Photo%')
    ALTER TABLE jobs.Files DROP CONSTRAINT CK_jobs_Files_Kind;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = 'CK_jobs_Files_Kind' AND parent_object_id = OBJECT_ID('jobs.Files'))
    ALTER TABLE jobs.Files ADD CONSTRAINT CK_jobs_Files_Kind CHECK (Kind IN ('Resume', 'Certificate', 'Photo'));
GO

CREATE OR ALTER PROCEDURE jobs.sp_Photo_Save
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

    DELETE FROM jobs.Files WHERE UserId = @UserId AND Kind = 'Photo';

    INSERT INTO jobs.Files (UserId, Kind, FileName, ContentType, SizeBytes, Content)
    VALUES (@UserId, 'Photo', @FileName, @ContentType, @SizeBytes, @Content);

    DECLARE @FileId INT = SCOPE_IDENTITY();

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Photo saved' AS Message, @FileId AS Id;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Photo_Delete
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM jobs.Files WHERE UserId = @UserId AND Kind = 'Photo';

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Photo removed' AS Message;
END
GO

/* The photo of the user, with its content. No row = no photo. */
CREATE OR ALTER PROCEDURE jobs.sp_Photo_Get
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (1) f.FileName, f.ContentType, f.Content
    FROM jobs.Files f
    WHERE f.UserId = @UserId AND f.Kind = 'Photo'
    ORDER BY f.FileId DESC;
END
GO

PRINT 'Job Portal profile: the photo is in place.';
GO
SET NOEXEC OFF;
GO
