/* =============================================================================
   PersonalDB · 20 · Job Portal and Job Consultancy: messages between a person and a company
   -----------------------------------------------------------------------------
   Run AFTER 19_Jobs_Profile_Share.sql, in the Personal DB. SAFE TO RE-RUN.

   One conversation per company and person (like LinkedIn). Either side can start it:
     the company   with a person who lets employers find them (IsVisible) or who applied
                   to one of the company's jobs; it names the person by CandidateKey, never
                   by a user id
     the person    about a job: an open job, or one they applied to; they need a name
   A message is text (up to 2,000 characters) and may carry a job (its link is shown as a
   card): any open job. The person can block a company: the company then cannot write
   until the person writes again (or unblocks).

   The other side is told of every message (MainDB notifications, SignalR): the company's
   members who may open Job Consultancy, or the person.

   Limits, against spam: a person starts at most 20 conversations a day and sends at most
   60 messages an hour; a company starts at most 200 a day and sends at most 300 an hour.

     jobs.Conversations, jobs.Messages
     jobs.sp_Message_Person_*   List, Unread, Thread, Start, Send, Block   (@UserId first)
     jobs.sp_Message_Company_*  List, Unread, Thread, Start, Send          (@CompanyId first)

   Every person procedure names @UserId in every statement on jobs.Conversations; every
   company procedure names @CompanyId.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR COL_LENGTH('jobs.Profiles', 'ShareCode') IS NULL OR COL_LENGTH('jobs.Profiles', 'CandidateKey') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 19_Jobs_Profile_Share.sql in it before running this script.', 16, 1);
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
   Tables
   ============================================================================= */
IF OBJECT_ID('jobs.Conversations') IS NULL
CREATE TABLE jobs.Conversations
(
    ConversationId  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Conversations PRIMARY KEY,
    CompanyId       INT            NOT NULL,
    CompanyName     NVARCHAR(200)  NOT NULL,
    UserId          INT            NOT NULL,
    PostingId       INT            NULL,      -- the job it began about
    StartedBy       NVARCHAR(10)   NOT NULL CONSTRAINT CK_jobs_Conversations_StartedBy CHECK (StartedBy IN ('Person', 'Company')),
    CreatedAt       DATETIME       NOT NULL CONSTRAINT DF_jobs_Conversations_CreatedAt DEFAULT (GETDATE()),
    LastMessageAt   DATETIME       NOT NULL CONSTRAINT DF_jobs_Conversations_LastMessageAt DEFAULT (GETDATE()),
    PersonReadAt    DATETIME       NULL,
    CompanyReadAt   DATETIME       NULL,
    BlockedByPerson BIT            NOT NULL CONSTRAINT DF_jobs_Conversations_Blocked DEFAULT (0)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_jobs_Conversations_Company_User' AND object_id = OBJECT_ID('jobs.Conversations'))
    CREATE UNIQUE INDEX UQ_jobs_Conversations_Company_User ON jobs.Conversations(CompanyId, UserId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Conversations_User' AND object_id = OBJECT_ID('jobs.Conversations'))
    CREATE INDEX IX_jobs_Conversations_User ON jobs.Conversations(UserId, LastMessageAt DESC);
GO

IF OBJECT_ID('jobs.Messages') IS NULL
CREATE TABLE jobs.Messages
(
    MessageId      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_jobs_Messages PRIMARY KEY,
    ConversationId INT            NOT NULL CONSTRAINT FK_jobs_Messages_Conversation REFERENCES jobs.Conversations(ConversationId),
    FromSide       NVARCHAR(10)   NOT NULL CONSTRAINT CK_jobs_Messages_FromSide CHECK (FromSide IN ('Person', 'Company')),
    SenderName     NVARCHAR(200)  NOT NULL,
    Body           NVARCHAR(2000) NOT NULL,
    PostingId      INT            NULL,      -- a job shared in the message
    CreatedAt      DATETIME       NOT NULL CONSTRAINT DF_jobs_Messages_CreatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_jobs_Messages_Conversation' AND object_id = OBJECT_ID('jobs.Messages'))
    CREATE INDEX IX_jobs_Messages_Conversation ON jobs.Messages(ConversationId, MessageId);
GO

/* =============================================================================
   The messages of a conversation (shared by both sides): the newest 200, oldest first,
   each with the job it carries when that job is still published
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Message_Rows
    @ConversationId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT m.MessageId, m.FromSide, m.SenderName, m.Body, m.CreatedAt,
           ISNULL(m.PostingId, 0) AS SharedPostingId,
           ISNULL(p.Title, '') AS SharedTitle, ISNULL(p.CompanyName, '') AS SharedCompany, ISNULL(p.City, '') AS SharedCity,
           CAST(CASE WHEN p.Status = 'Open' AND (p.ClosesOn IS NULL OR p.ClosesOn >= @Today) THEN 1 ELSE 0 END AS BIT) AS SharedIsOpen
    FROM (SELECT TOP (200) * FROM jobs.Messages WHERE ConversationId = @ConversationId ORDER BY MessageId DESC) m
    LEFT JOIN jobs.Postings p ON p.PostingId = m.PostingId AND p.Status <> 'Draft'
    ORDER BY m.MessageId;
END
GO

/* =============================================================================
   PERSON
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Message_Person_List
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (200)
           c.ConversationId, c.CompanyName, ISNULL(p.Title, '') AS PostingTitle, c.LastMessageAt, c.BlockedByPerson,
           ISNULL(LEFT(l.Body, 140), '') AS LastBody, ISNULL(l.FromSide, '') AS LastFromSide,
           CAST(CASE WHEN l.PostingId IS NOT NULL AND l.Body = '' THEN 1 ELSE 0 END AS BIT) AS LastIsJob,
           (SELECT COUNT(*) FROM jobs.Messages u
            WHERE u.ConversationId = c.ConversationId AND u.FromSide = 'Company' AND u.CreatedAt > ISNULL(c.PersonReadAt, '1900-01-01')) AS Unread
    FROM jobs.Conversations c
    LEFT JOIN jobs.Postings p ON p.PostingId = c.PostingId
    OUTER APPLY (SELECT TOP (1) m.Body, m.FromSide, m.PostingId FROM jobs.Messages m WHERE m.ConversationId = c.ConversationId ORDER BY m.MessageId DESC) l
    WHERE c.UserId = @UserId
      AND EXISTS (SELECT 1 FROM jobs.Messages m WHERE m.ConversationId = c.ConversationId)
    ORDER BY c.LastMessageAt DESC, c.ConversationId DESC;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Message_Person_Unread
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT COUNT(*) AS Unread
    FROM jobs.Conversations c
    INNER JOIN jobs.Messages m ON m.ConversationId = c.ConversationId AND m.FromSide = 'Company'
                               AND m.CreatedAt > ISNULL(c.PersonReadAt, '1900-01-01')
    WHERE c.UserId = @UserId;
END
GO

/* The conversation (first set; no row = not found), then its messages. It is read now. */
CREATE OR ALTER PROCEDURE jobs.sp_Message_Person_Thread
    @UserId         INT,
    @ConversationId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.ConversationId, c.CompanyName, ISNULL(c.PostingId, 0) AS PostingId, ISNULL(p.Title, '') AS PostingTitle,
           c.BlockedByPerson, c.CompanyReadAt AS OtherReadAt
    FROM jobs.Conversations c
    LEFT JOIN jobs.Postings p ON p.PostingId = c.PostingId
    WHERE c.ConversationId = @ConversationId AND c.UserId = @UserId;

    IF @@ROWCOUNT = 0 RETURN;

    EXEC jobs.sp_Message_Rows @ConversationId = @ConversationId;

    UPDATE jobs.Conversations SET PersonReadAt = GETDATE() WHERE ConversationId = @ConversationId AND UserId = @UserId;
END
GO

/* About a job: the conversation with its company, made when there is none. Id = the conversation. */
CREATE OR ALTER PROCEDURE jobs.sp_Message_Person_Start
    @UserId    INT,
    @PostingId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CompanyId INT, @CompanyName NVARCHAR(200), @Id INT;

    IF NOT EXISTS (SELECT 1 FROM jobs.Profiles WHERE UserId = @UserId AND FullName <> '')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Add your name to your profile before you write to a company' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    SELECT @CompanyId = p.CompanyId, @CompanyName = p.CompanyName
    FROM jobs.Postings p
    WHERE p.PostingId = @PostingId AND p.Status <> 'Draft'
      AND ((p.Status = 'Open' AND (p.ClosesOn IS NULL OR p.ClosesOn >= CAST(GETDATE() AS DATE)))
           OR EXISTS (SELECT 1 FROM jobs.Applications a WHERE a.PostingId = p.PostingId AND a.UserId = @UserId));

    IF @CompanyId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This job is no longer published' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    SELECT @Id = ConversationId FROM jobs.Conversations WITH (UPDLOCK, HOLDLOCK) WHERE CompanyId = @CompanyId AND UserId = @UserId;

    IF @Id IS NULL
    BEGIN
        IF (SELECT COUNT(*) FROM jobs.Conversations WHERE UserId = @UserId AND StartedBy = 'Person' AND CreatedAt > DATEADD(DAY, -1, GETDATE())) >= 20
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'You started 20 conversations today. Please write again tomorrow' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        INSERT INTO jobs.Conversations (CompanyId, CompanyName, UserId, PostingId, StartedBy)
        VALUES (@CompanyId, @CompanyName, @UserId, @PostingId, 'Person');
        SET @Id = SCOPE_IDENTITY();
    END

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, '' AS Message, @Id AS Id;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Message_Person_Send
    @UserId         INT,
    @ConversationId INT,
    @Body           NVARCHAR(2000),
    @SharePostingId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Body = LTRIM(RTRIM(ISNULL(@Body, '')));
    IF ISNULL(@SharePostingId, 0) = 0 SET @SharePostingId = NULL;

    DECLARE @Name NVARCHAR(200) = (SELECT FullName FROM jobs.Profiles WHERE UserId = @UserId AND FullName <> '');

    IF NOT EXISTS (SELECT 1 FROM jobs.Conversations WHERE ConversationId = @ConversationId AND UserId = @UserId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END
    IF @Name IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Add your name to your profile before you write to a company' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END
    IF @Body = '' AND @SharePostingId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Write a message' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END
    IF @SharePostingId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jobs.Postings WHERE PostingId = @SharePostingId AND Status = 'Open'
                                                     AND (ClosesOn IS NULL OR ClosesOn >= CAST(GETDATE() AS DATE)))
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Only an open job can be shared' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END
    IF (SELECT COUNT(*) FROM jobs.Messages m INNER JOIN jobs.Conversations c ON c.ConversationId = m.ConversationId
        WHERE c.UserId = @UserId AND m.FromSide = 'Person' AND m.CreatedAt > DATEADD(HOUR, -1, GETDATE())) >= 60
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You sent 60 messages in the last hour. Please wait a little' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    INSERT INTO jobs.Messages (ConversationId, FromSide, SenderName, Body, PostingId)
    VALUES (@ConversationId, 'Person', @Name, @Body, @SharePostingId);

    DECLARE @MessageId BIGINT = SCOPE_IDENTITY();

    /* writing again ends a block: the company may answer */
    UPDATE jobs.Conversations
    SET LastMessageAt = GETDATE(), PersonReadAt = GETDATE(), BlockedByPerson = 0
    WHERE ConversationId = @ConversationId AND UserId = @UserId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Sent' AS Message, CAST(@MessageId AS INT) AS Id;

    SELECT 'Company' AS Audience, CAST(NULL AS INT) AS UserId, c.CompanyId, 'JOBCONSULTANCY' AS App, 'Message' AS Kind,
           'New message from ' + @Name AS Title,
           CASE WHEN @Body = '' THEN 'Shared a job' ELSE LEFT(@Body, 200) END AS Body,
           '/consultancy/messages?c=' + CAST(c.ConversationId AS NVARCHAR(12)) AS Link
    FROM jobs.Conversations c
    WHERE c.ConversationId = @ConversationId AND c.UserId = @UserId;
END
GO

/* The person stops (or allows again) the company writing in this conversation. */
CREATE OR ALTER PROCEDURE jobs.sp_Message_Person_Block
    @UserId         INT,
    @ConversationId INT,
    @Blocked        BIT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE jobs.Conversations SET BlockedByPerson = ISNULL(@Blocked, 0)
    WHERE ConversationId = @ConversationId AND UserId = @UserId;

    IF @@ROWCOUNT = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @Blocked = 1 THEN 'Blocked. The company cannot write to you here' ELSE 'Unblocked. The company can write to you again' END AS Message;
END
GO

/* =============================================================================
   COMPANY
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Message_Company_List
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (300)
           c.ConversationId, pr.CandidateKey, ISNULL(pr.FullName, '') AS FullName, ISNULL(pr.Headline, '') AS Headline,
           CAST(CASE WHEN pr.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified,
           ISNULL(p.Title, '') AS PostingTitle, c.LastMessageAt, c.BlockedByPerson,
           ISNULL(LEFT(l.Body, 140), '') AS LastBody, ISNULL(l.FromSide, '') AS LastFromSide,
           CAST(CASE WHEN l.PostingId IS NOT NULL AND l.Body = '' THEN 1 ELSE 0 END AS BIT) AS LastIsJob,
           (SELECT COUNT(*) FROM jobs.Messages u
            WHERE u.ConversationId = c.ConversationId AND u.FromSide = 'Person' AND u.CreatedAt > ISNULL(c.CompanyReadAt, '1900-01-01')) AS Unread
    FROM jobs.Conversations c
    INNER JOIN jobs.Profiles pr ON pr.UserId = c.UserId
    LEFT JOIN jobs.Postings p ON p.PostingId = c.PostingId
    OUTER APPLY (SELECT TOP (1) m.Body, m.FromSide, m.PostingId FROM jobs.Messages m WHERE m.ConversationId = c.ConversationId ORDER BY m.MessageId DESC) l
    WHERE c.CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0
      AND EXISTS (SELECT 1 FROM jobs.Messages m WHERE m.ConversationId = c.ConversationId)
    ORDER BY c.LastMessageAt DESC, c.ConversationId DESC;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Message_Company_Unread
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT COUNT(*) AS Unread
    FROM jobs.Conversations c
    INNER JOIN jobs.Messages m ON m.ConversationId = c.ConversationId AND m.FromSide = 'Person'
                               AND m.CreatedAt > ISNULL(c.CompanyReadAt, '1900-01-01')
    WHERE c.CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0;
END
GO

/* The conversation (first set; no row = not found), then its messages. It is read now. */
CREATE OR ALTER PROCEDURE jobs.sp_Message_Company_Thread
    @CompanyId      INT,
    @ConversationId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.ConversationId, pr.CandidateKey, ISNULL(pr.FullName, '') AS FullName, ISNULL(pr.Headline, '') AS Headline,
           ISNULL(pr.City, '') AS City, CAST(CASE WHEN pr.VerifiedAt IS NULL THEN 0 ELSE 1 END AS BIT) AS IsVerified,
           ISNULL(c.PostingId, 0) AS PostingId, ISNULL(p.Title, '') AS PostingTitle,
           c.BlockedByPerson, c.PersonReadAt AS OtherReadAt
    FROM jobs.Conversations c
    INNER JOIN jobs.Profiles pr ON pr.UserId = c.UserId
    LEFT JOIN jobs.Postings p ON p.PostingId = c.PostingId
    WHERE c.ConversationId = @ConversationId AND c.CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0;

    IF @@ROWCOUNT = 0 RETURN;

    EXEC jobs.sp_Message_Rows @ConversationId = @ConversationId;

    UPDATE jobs.Conversations SET CompanyReadAt = GETDATE() WHERE ConversationId = @ConversationId AND CompanyId = @CompanyId;
END
GO

/* With a person the company may reach: one who lets employers find them, or an applicant of
   one of its jobs. The person is named by CandidateKey, or by an application to one of the
   company's jobs (the hiring page knows the application). Id = the conversation (made when
   there is none). */
CREATE OR ALTER PROCEDURE jobs.sp_Message_Company_Start
    @CompanyId     INT,
    @CompanyName   NVARCHAR(200),
    @CandidateKey  UNIQUEIDENTIFIER = NULL,
    @PostingId     INT = NULL,
    @ApplicationId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Person INT, @Id INT;
    IF ISNULL(@PostingId, 0) = 0 SET @PostingId = NULL;

    /* an application to one of the company's jobs names the person, and the job it is about */
    IF @CandidateKey IS NULL AND ISNULL(@ApplicationId, 0) <> 0
        SELECT @CandidateKey = pr.CandidateKey, @PostingId = ISNULL(@PostingId, a.PostingId)
        FROM jobs.Applications a
        INNER JOIN jobs.Postings p  ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
        INNER JOIN jobs.Profiles pr ON pr.UserId = a.UserId
        WHERE a.ApplicationId = @ApplicationId AND a.Status <> 'Withdrawn';

    SELECT @Person = pr.UserId
    FROM jobs.Profiles pr
    WHERE pr.CandidateKey = @CandidateKey AND pr.FullName <> '' AND ISNULL(@CompanyId, 0) <> 0
      AND (pr.IsVisible = 1
           OR EXISTS (SELECT 1 FROM jobs.Applications a INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId
                      WHERE a.UserId = pr.UserId AND p.CompanyId = @CompanyId AND a.Status <> 'Withdrawn'));

    IF @Person IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This person cannot be reached' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    /* the job it is about must be one of the company's own */
    IF @PostingId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jobs.Postings WHERE PostingId = @PostingId AND CompanyId = @CompanyId)
        SET @PostingId = NULL;

    BEGIN TRANSACTION;

    SELECT @Id = ConversationId FROM jobs.Conversations WITH (UPDLOCK, HOLDLOCK) WHERE CompanyId = @CompanyId AND UserId = @Person;

    IF @Id IS NULL
    BEGIN
        IF (SELECT COUNT(*) FROM jobs.Conversations WHERE CompanyId = @CompanyId AND StartedBy = 'Company' AND CreatedAt > DATEADD(DAY, -1, GETDATE())) >= 200
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'Your company started 200 conversations today. Please write again tomorrow' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        INSERT INTO jobs.Conversations (CompanyId, CompanyName, UserId, PostingId, StartedBy)
        VALUES (@CompanyId, @CompanyName, @Person, @PostingId, 'Company');
        SET @Id = SCOPE_IDENTITY();
    END

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, '' AS Message, @Id AS Id;
END
GO

CREATE OR ALTER PROCEDURE jobs.sp_Message_Company_Send
    @CompanyId      INT,
    @SenderName     NVARCHAR(200),
    @ConversationId INT,
    @Body           NVARCHAR(2000),
    @SharePostingId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Body = LTRIM(RTRIM(ISNULL(@Body, '')));
    SET @SenderName = ISNULL(NULLIF(LTRIM(RTRIM(@SenderName)), ''), 'Recruiter');
    IF ISNULL(@SharePostingId, 0) = 0 SET @SharePostingId = NULL;

    DECLARE @Blocked BIT, @CompanyName NVARCHAR(200);
    SELECT @Blocked = BlockedByPerson, @CompanyName = CompanyName
    FROM jobs.Conversations WHERE ConversationId = @ConversationId AND CompanyId = @CompanyId AND ISNULL(@CompanyId, 0) <> 0;

    IF @Blocked IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END
    IF @Blocked = 1
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This person does not take messages from your company here' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END
    IF @Body = '' AND @SharePostingId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Write a message' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END
    IF @SharePostingId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jobs.Postings WHERE PostingId = @SharePostingId AND Status = 'Open'
                                                     AND (ClosesOn IS NULL OR ClosesOn >= CAST(GETDATE() AS DATE)))
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Only an open job can be shared' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END
    IF (SELECT COUNT(*) FROM jobs.Messages m INNER JOIN jobs.Conversations c ON c.ConversationId = m.ConversationId
        WHERE c.CompanyId = @CompanyId AND m.FromSide = 'Company' AND m.CreatedAt > DATEADD(HOUR, -1, GETDATE())) >= 300
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Your company sent 300 messages in the last hour. Please wait a little' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    INSERT INTO jobs.Messages (ConversationId, FromSide, SenderName, Body, PostingId)
    VALUES (@ConversationId, 'Company', @SenderName, @Body, @SharePostingId);

    DECLARE @MessageId BIGINT = SCOPE_IDENTITY();

    UPDATE jobs.Conversations SET LastMessageAt = GETDATE(), CompanyReadAt = GETDATE()
    WHERE ConversationId = @ConversationId AND CompanyId = @CompanyId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Sent' AS Message, CAST(@MessageId AS INT) AS Id;

    SELECT 'User' AS Audience, c.UserId, CAST(NULL AS INT) AS CompanyId, 'JOBPORTAL' AS App, 'Message' AS Kind,
           'New message from ' + @CompanyName AS Title,
           CASE WHEN @Body = '' THEN 'Shared a job with you' ELSE LEFT(@Body, 200) END AS Body,
           '/apps/jobs/messages?c=' + CAST(c.ConversationId AS NVARCHAR(12)) AS Link
    FROM jobs.Conversations c
    WHERE c.ConversationId = @ConversationId AND c.CompanyId = @CompanyId;
END
GO

PRINT 'Job Portal and Job Consultancy: messages are in place.';
GO
SET NOEXEC OFF;
GO
