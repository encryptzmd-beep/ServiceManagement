/* =============================================================================
   PersonalDB · 08 · Job Portal: notifications for the person
   -----------------------------------------------------------------------------
   Run AFTER 06_Jobs_Postings.sql, in the Personal DB. Run it AGAIN every time
   script 06 is run again: script 06 re-creates the two company procedures below
   in their earlier form (without notifications). SAFE TO RE-RUN.

     jobs.Notifications              what happened to the person's applications
     jobs.sp_Company_Applicant_SetStatus   as in script 06, and the applicant is told
                                     when the company shortlists, rejects or hires
     jobs.sp_Company_Posting_SetStatus     as in script 06, and when a job is closed
                                     everybody whose application was still open is told
     jobs.sp_Notification_ListMine   the newest notifications and how many are unread
     jobs.sp_Notification_MarkRead   one notification, or all of them, as read

   A notification names the company and the job, never who in the company did it.
   Like everywhere in schema jobs: a person procedure takes @UserId first and every
   statement on a jobs table names it; a company procedure takes @CompanyId first
   and reaches an applicant only through a posting of that company.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL OR OBJECT_ID('jobs.Applications') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 06_Jobs_Postings.sql in it before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
BEGIN
    RAISERROR('This database is not marked as the Personal DB. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('jobs.Notifications') IS NULL
CREATE TABLE jobs.Notifications
(
    NotificationId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Notifications PRIMARY KEY,
    UserId         INT           NOT NULL,
    Kind           NVARCHAR(20)  NOT NULL CONSTRAINT CK_jobs_Notifications_Kind CHECK (Kind IN ('Application', 'JobClosed')),
    Title          NVARCHAR(300) NOT NULL,
    Body           NVARCHAR(500) NOT NULL CONSTRAINT DF_jobs_Notifications_Body DEFAULT (''),
    Link           NVARCHAR(200) NOT NULL CONSTRAINT DF_jobs_Notifications_Link DEFAULT (''),
    CreatedAt      DATETIME      NOT NULL CONSTRAINT DF_jobs_Notifications_CreatedAt DEFAULT (GETDATE()),
    ReadAt         DATETIME      NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Notifications_User' AND object_id = OBJECT_ID('jobs.Notifications'))
    CREATE INDEX IX_jobs_Notifications_User ON jobs.Notifications(UserId, CreatedAt DESC);
GO

/* =============================================================================
   COMPANY · the state of an application, and the applicant is told
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Applicant_SetStatus
    @CompanyId     INT,
    @PostingId     INT,
    @ApplicationId INT,
    @Status        NVARCHAR(12)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Status NOT IN ('Applied', 'Shortlisted', 'Rejected', 'Hired')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This change is not possible' AS Message; RETURN;
    END

    DECLARE @Applicant INT, @Old NVARCHAR(12), @Title NVARCHAR(200), @Company NVARCHAR(200);

    BEGIN TRANSACTION;

    SELECT @Applicant = a.UserId, @Old = a.Status, @Title = p.Title, @Company = p.CompanyName
    FROM jobs.Applications a WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE a.ApplicationId = @ApplicationId AND a.PostingId = @PostingId AND a.Status <> 'Withdrawn';

    IF @Applicant IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    UPDATE a
    SET a.Status = @Status, a.StatusAt = GETDATE()
    FROM jobs.Applications a
    INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
    WHERE a.ApplicationId = @ApplicationId AND a.PostingId = @PostingId AND a.Status <> 'Withdrawn';

    /* the person hears of a decision, not of every click: back to Applied says nothing */
    IF @Status <> @Old AND @Status IN ('Shortlisted', 'Rejected', 'Hired')
        INSERT INTO jobs.Notifications (UserId, Kind, Title, Body, Link)
        SELECT a.UserId, 'Application',
               CASE @Status
                   WHEN 'Shortlisted' THEN 'You are shortlisted for ' + p.Title
                   WHEN 'Hired'       THEN p.CompanyName + ' marked you as hired for ' + p.Title
                   ELSE                    p.CompanyName + ' will not go ahead with your application for ' + p.Title
               END,
               p.CompanyName + ' · ' + p.Title,
               '/apps/jobs/applications'
        FROM jobs.Applications a
        INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
        WHERE a.ApplicationId = @ApplicationId AND a.PostingId = @PostingId AND a.Status <> 'Withdrawn';

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Marked as ' + LOWER(@Status) AS Message;
END
GO

/* =============================================================================
   COMPANY · publish or close a job; on closing, the open applications are told
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Company_Posting_SetStatus
    @CompanyId INT,
    @PostingId INT,
    @Status    NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Current NVARCHAR(10), @ClosesOn DATE;

    BEGIN TRANSACTION;

    SELECT @Current = Status, @ClosesOn = ClosesOn
    FROM jobs.Postings WITH (UPDLOCK, HOLDLOCK)
    WHERE PostingId = @PostingId AND CompanyId = @CompanyId;

    IF @Current IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    IF NOT ((@Status = 'Open' AND @Current IN ('Draft', 'Closed')) OR (@Status = 'Closed' AND @Current = 'Open'))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success,
               CASE WHEN @Status = @Current THEN 'The job is already ' + LOWER(@Current) ELSE 'This change is not possible' END AS Message; RETURN;
    END

    IF @Status = 'Open' AND @ClosesOn IS NOT NULL AND @ClosesOn < CAST(GETDATE() AS DATE)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'The closing date has passed. Change it before you publish the job' AS Message; RETURN;
    END

    UPDATE jobs.Postings
    SET Status = @Status,
        PublishedAt = CASE WHEN @Status = 'Open' AND PublishedAt IS NULL THEN GETDATE() ELSE PublishedAt END,
        UpdatedAt = GETDATE()
    WHERE PostingId = @PostingId AND CompanyId = @CompanyId;

    IF @Status = 'Closed'
        INSERT INTO jobs.Notifications (UserId, Kind, Title, Body, Link)
        SELECT a.UserId, 'JobClosed',
               p.CompanyName + ' closed the job ' + p.Title,
               'Your application stays. The company may still get back to you.',
               '/apps/jobs/applications'
        FROM jobs.Applications a
        INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
        WHERE a.PostingId = @PostingId AND a.Status IN ('Applied', 'Shortlisted');

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, CASE WHEN @Status = 'Open' THEN 'The job is published' ELSE 'The job is closed' END AS Message;
END
GO

/* =============================================================================
   PERSON · the notifications
   ============================================================================= */

/* Two result sets: the 50 newest notifications, then how many are unread. */
CREATE OR ALTER PROCEDURE jobs.sp_Notification_ListMine
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (50) n.NotificationId, n.Kind, n.Title, n.Body, n.Link, n.CreatedAt,
           CAST(CASE WHEN n.ReadAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsRead
    FROM jobs.Notifications n
    WHERE n.UserId = @UserId
    ORDER BY n.CreatedAt DESC, n.NotificationId DESC;

    SELECT COUNT(*) AS Unread
    FROM jobs.Notifications n
    WHERE n.UserId = @UserId AND n.ReadAt IS NULL;
END
GO

/* One notification as read, or all of them when @NotificationId is NULL. */
CREATE OR ALTER PROCEDURE jobs.sp_Notification_MarkRead
    @UserId         INT,
    @NotificationId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE jobs.Notifications
    SET ReadAt = GETDATE()
    WHERE UserId = @UserId AND ReadAt IS NULL
      AND (@NotificationId IS NULL OR NotificationId = @NotificationId);

    SELECT CAST(1 AS INT) AS Success, 'Done' AS Message;
END
GO

PRINT 'Job Portal: notifications are in place.';
GO
SET NOEXEC OFF;
GO
