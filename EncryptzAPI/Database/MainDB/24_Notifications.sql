/* =============================================================================
   MainDB · 24 · Notifications: one place for the notifications of every application
   -----------------------------------------------------------------------------
   Run AFTER 21_Applications.sql, in MainDBEncryptz. ADDITIVE and SAFE TO RE-RUN:
   it adds one table and six procedures and changes nothing that exists.

   A notification belongs to a person (dbo.Users.UserId), whatever application it
   comes from (Job Portal, Job Consultancy, Service, ...). The API writes it here
   and sends it at once over SignalR to the person's open pages.

     dbo.Notifications                     the notifications
     dbo.sp_Notification_AddForUsers       one notification for each user of a list
     dbo.sp_Notification_AddForModule      for every member of a company who may open
                                           an application there (dbo.fn_ModuleUsers)
     dbo.sp_Notification_AddForPlatformAdmins  for every platform administrator
     dbo.sp_Notification_ListMine          the newest of a person and how many are unread
     dbo.sp_Notification_MarkRead          one, or all of them, as read

   The three "Add" procedures answer with the new rows, so that the API can send
   them to exactly those people. A person procedure takes @UserId first and every
   statement names it.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Users') IS NULL OR OBJECT_ID('dbo.CompanyUsers') IS NULL
   OR OBJECT_ID('dbo.fn_ModuleUsers') IS NULL OR COL_LENGTH('dbo.Modules', 'AppType') IS NULL
BEGIN
    RAISERROR('Select MainDBEncryptz and run 21_Applications.sql in it before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Notifications') IS NULL
CREATE TABLE dbo.Notifications
(
    NotificationId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
    UserId         INT           NOT NULL CONSTRAINT FK_Notifications_Users REFERENCES dbo.Users(UserId),
    App            NVARCHAR(40)  NOT NULL,   -- JOBPORTAL, JOBCONSULTANCY, PLATFORM, SERVICE, ...
    Kind           NVARCHAR(40)  NOT NULL,   -- Shortlisted, NewApplicant, ReviewWaiting, ...
    Title          NVARCHAR(300) NOT NULL,
    Body           NVARCHAR(500) NOT NULL CONSTRAINT DF_Notifications_Body DEFAULT (''),
    Link           NVARCHAR(300) NOT NULL CONSTRAINT DF_Notifications_Link DEFAULT (''),
    CompanyId      INT           NULL,       -- the company it is about, when there is one
    CreatedAt      DATETIME      NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT (GETDATE()),
    ReadAt         DATETIME      NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_User' AND object_id = OBJECT_ID('dbo.Notifications'))
    CREATE INDEX IX_Notifications_User ON dbo.Notifications(UserId, ReadAt, CreatedAt DESC);
GO

/* One notification for each active user of @UserIds (a JSON array of user ids). */
CREATE OR ALTER PROCEDURE dbo.sp_Notification_AddForUsers
    @UserIds   NVARCHAR(MAX),
    @App       NVARCHAR(40),
    @Kind      NVARCHAR(40),
    @Title     NVARCHAR(300),
    @Body      NVARCHAR(500) = NULL,
    @Link      NVARCHAR(300) = NULL,
    @CompanyId INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF ISJSON(ISNULL(@UserIds, '')) = 0 OR LTRIM(RTRIM(ISNULL(@Title, ''))) = '' RETURN;

    INSERT INTO dbo.Notifications (UserId, App, Kind, Title, Body, Link, CompanyId)
    OUTPUT inserted.NotificationId, inserted.UserId, inserted.App, inserted.Kind, inserted.Title, inserted.Body,
           inserted.Link, inserted.CompanyId, inserted.CreatedAt
    SELECT DISTINCT u.UserId, @App, @Kind, LEFT(@Title, 300), LEFT(ISNULL(@Body, ''), 500), LEFT(ISNULL(@Link, ''), 300), @CompanyId
    FROM OPENJSON(@UserIds) j
    INNER JOIN dbo.Users u ON u.UserId = TRY_CAST(j.value AS INT) AND u.IsActive = 1;
END
GO

/* For every member of the company who may open the application (administrators always). */
CREATE OR ALTER PROCEDURE dbo.sp_Notification_AddForModule
    @CompanyId INT,
    @ModuleKey NVARCHAR(50),
    @App       NVARCHAR(40),
    @Kind      NVARCHAR(40),
    @Title     NVARCHAR(300),
    @Body      NVARCHAR(500) = NULL,
    @Link      NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF LTRIM(RTRIM(ISNULL(@Title, ''))) = '' RETURN;

    INSERT INTO dbo.Notifications (UserId, App, Kind, Title, Body, Link, CompanyId)
    OUTPUT inserted.NotificationId, inserted.UserId, inserted.App, inserted.Kind, inserted.Title, inserted.Body,
           inserted.Link, inserted.CompanyId, inserted.CreatedAt
    SELECT DISTINCT mu.UserId, @App, @Kind, LEFT(@Title, 300), LEFT(ISNULL(@Body, ''), 500), LEFT(ISNULL(@Link, ''), 300), @CompanyId
    FROM dbo.fn_ModuleUsers(@CompanyId, @ModuleKey) mu
    INNER JOIN dbo.Users u ON u.UserId = mu.UserId AND u.IsActive = 1;
END
GO

/* For every platform administrator (global role Admin). */
CREATE OR ALTER PROCEDURE dbo.sp_Notification_AddForPlatformAdmins
    @App   NVARCHAR(40),
    @Kind  NVARCHAR(40),
    @Title NVARCHAR(300),
    @Body  NVARCHAR(500) = NULL,
    @Link  NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF LTRIM(RTRIM(ISNULL(@Title, ''))) = '' RETURN;

    INSERT INTO dbo.Notifications (UserId, App, Kind, Title, Body, Link)
    OUTPUT inserted.NotificationId, inserted.UserId, inserted.App, inserted.Kind, inserted.Title, inserted.Body,
           inserted.Link, inserted.CompanyId, inserted.CreatedAt
    SELECT u.UserId, @App, @Kind, LEFT(@Title, 300), LEFT(ISNULL(@Body, ''), 500), LEFT(ISNULL(@Link, ''), 300)
    FROM dbo.Users u
    INNER JOIN dbo.Roles r ON r.RoleId = u.RoleId AND r.RoleName = 'Admin'
    WHERE u.IsActive = 1;
END
GO

/* Two result sets: the newest notifications of the person, then how many are unread. */
CREATE OR ALTER PROCEDURE dbo.sp_Notification_ListMine
    @UserId INT,
    @Top    INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    SET @Top = CASE WHEN ISNULL(@Top, 50) < 1 THEN 50 WHEN @Top > 200 THEN 200 ELSE @Top END;

    SELECT TOP (@Top) n.NotificationId, n.App, n.Kind, n.Title, n.Body, n.Link, n.CompanyId, n.CreatedAt,
           CAST(CASE WHEN n.ReadAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsRead
    FROM dbo.Notifications n
    WHERE n.UserId = @UserId
    ORDER BY n.CreatedAt DESC, n.NotificationId DESC;

    SELECT COUNT(*) AS Unread
    FROM dbo.Notifications n
    WHERE n.UserId = @UserId AND n.ReadAt IS NULL;
END
GO

/* One notification as read, or all of them when @NotificationId is NULL. Answers how many are unread now. */
CREATE OR ALTER PROCEDURE dbo.sp_Notification_MarkRead
    @UserId         INT,
    @NotificationId BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Notifications
    SET ReadAt = GETDATE()
    WHERE UserId = @UserId AND ReadAt IS NULL
      AND (@NotificationId IS NULL OR NotificationId = @NotificationId);

    SELECT COUNT(*) AS Unread FROM dbo.Notifications WHERE UserId = @UserId AND ReadAt IS NULL;
END
GO

PRINT 'Notifications are in place.';
GO
SET NOEXEC OFF;
GO
