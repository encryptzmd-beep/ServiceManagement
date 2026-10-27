/* =============================================================================
   PersonalDB · 25 · Job Consultancy: an invitation is also a message
   -----------------------------------------------------------------------------
   Run AFTER 24_Jobs_Posting_Matches.sql (it needs 20_Jobs_Messages.sql), in the Personal
   DB. SAFE TO RE-RUN. Run it AGAIN every time script 10, 11 or 12 is run again: they
   re-create jobs.sp_Candidate_Invite in an earlier form.

   An invitation to apply was only a notification. Now it is also a message from the
   company in its conversation with the person (made when there is none), with the job as
   a card: the person finds it in Messages and can answer it. The notification opens that
   conversation.

     jobs.sp_Candidate_Invite   as in script 12, and the message
     the invitations sent before this script are put into Messages once, at their time
     (a re-run adds none twice)
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL
   OR OBJECT_ID('jobs.Conversations') IS NULL OR OBJECT_ID('jobs.CandidateInvitations') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 20_Jobs_Messages.sql in it before running this script.', 16, 1);
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
   COMPANY · an invitation to apply; the person is told, and finds it in Messages
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_Candidate_Invite
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER,
    @PostingId    INT,
    @Message      NVARCHAR(500) = NULL,
    @UserId       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Person INT, @Title NVARCHAR(200), @Company NVARCHAR(200), @Conversation INT;
    SET @Message = LTRIM(RTRIM(ISNULL(@Message, '')));

    SELECT @Person = pr.UserId FROM jobs.Profiles pr WHERE pr.CandidateKey = @CandidateKey AND pr.IsVisible = 1;
    SELECT @Title = p.Title, @Company = p.CompanyName
    FROM jobs.Postings p
    WHERE p.PostingId = @PostingId AND p.CompanyId = @CompanyId AND p.Status = 'Open'
      AND (p.ClosesOn IS NULL OR p.ClosesOn >= CAST(GETDATE() AS DATE));

    IF @Person IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END
    IF @Title IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose one of your open jobs' AS Message; RETURN;
    END
    IF EXISTS (SELECT 1 FROM jobs.Applications a INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
               WHERE a.PostingId = @PostingId AND a.UserId = @Person AND a.Status <> 'Withdrawn')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This candidate has already applied to the job' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM jobs.CandidateInvitations WITH (UPDLOCK, HOLDLOCK) WHERE PostingId = @PostingId AND UserId = @Person AND CompanyId = @CompanyId)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'This candidate was already invited to the job' AS Message; RETURN;
    END

    INSERT INTO jobs.CandidateInvitations (CompanyId, PostingId, UserId, Message, InvitedBy)
    VALUES (@CompanyId, @PostingId, @Person, @Message, ISNULL(@UserId, 0));

    /* the conversation of the company with the person (one per company and person) */
    SELECT @Conversation = ConversationId FROM jobs.Conversations WITH (UPDLOCK, HOLDLOCK) WHERE CompanyId = @CompanyId AND UserId = @Person;
    IF @Conversation IS NULL
    BEGIN
        INSERT INTO jobs.Conversations (CompanyId, CompanyName, UserId, PostingId, StartedBy)
        VALUES (@CompanyId, @Company, @Person, @PostingId, 'Company');
        SET @Conversation = SCOPE_IDENTITY();
    END

    /* the invitation as a message with the job as its card */
    INSERT INTO jobs.Messages (ConversationId, FromSide, SenderName, Body, PostingId)
    VALUES (@Conversation, 'Company', @Company,
            CASE WHEN @Message = '' THEN N'We invite you to apply for this job.' ELSE @Message END, @PostingId);

    UPDATE jobs.Conversations SET LastMessageAt = GETDATE(), CompanyReadAt = GETDATE()
    WHERE ConversationId = @Conversation AND CompanyId = @CompanyId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Invitation sent' AS Message;

    SELECT 'User' AS Audience, pr.UserId, CAST(NULL AS INT) AS CompanyId, 'JOBPORTAL' AS App, 'Invitation' AS Kind,
           @Company + ' invites you to apply for ' + @Title AS Title,
           @Message AS Body,
           '/apps/jobs/messages?c=' + CAST(@Conversation AS NVARCHAR(12)) AS Link
    FROM jobs.Profiles pr WHERE pr.UserId = @Person AND pr.IsVisible = 1;
END
GO

/* =============================================================================
   The invitations sent before this script, into Messages once, at their time
   ============================================================================= */
BEGIN TRANSACTION;

    /* a conversation for each company and person that had an invitation and none yet */
    INSERT INTO jobs.Conversations (CompanyId, CompanyName, UserId, PostingId, StartedBy, CreatedAt, LastMessageAt)
    SELECT i.CompanyId, MAX(p.CompanyName), i.UserId, MIN(i.PostingId), 'Company', MIN(i.InvitedAt), MAX(i.InvitedAt)
    FROM jobs.CandidateInvitations i
    INNER JOIN jobs.Postings p ON p.PostingId = i.PostingId
    WHERE NOT EXISTS (SELECT 1 FROM jobs.Conversations c WHERE c.CompanyId = i.CompanyId AND c.UserId = i.UserId)
    GROUP BY i.CompanyId, i.UserId;

    /* each invitation as a message, unless it is there already (a re-run) */
    INSERT INTO jobs.Messages (ConversationId, FromSide, SenderName, Body, PostingId, CreatedAt)
    SELECT c.ConversationId, 'Company', p.CompanyName,
           CASE WHEN i.Message = '' THEN N'We invite you to apply for this job.' ELSE i.Message END, i.PostingId, i.InvitedAt
    FROM jobs.CandidateInvitations i
    INNER JOIN jobs.Postings p      ON p.PostingId = i.PostingId
    INNER JOIN jobs.Conversations c ON c.CompanyId = i.CompanyId AND c.UserId = i.UserId
    WHERE NOT EXISTS (SELECT 1 FROM jobs.Messages m
                      WHERE m.ConversationId = c.ConversationId AND m.FromSide = 'Company'
                        AND m.PostingId = i.PostingId AND m.CreatedAt = i.InvitedAt)
    ORDER BY i.InvitedAt;

    PRINT CONCAT('Invitations put into Messages: ', @@ROWCOUNT);

    /* the conversations show their newest message first */
    UPDATE c SET c.LastMessageAt = x.LastAt
    FROM jobs.Conversations c
    CROSS APPLY (SELECT MAX(m.CreatedAt) AS LastAt FROM jobs.Messages m WHERE m.ConversationId = c.ConversationId) x
    WHERE x.LastAt IS NOT NULL AND x.LastAt > c.LastMessageAt;

COMMIT TRANSACTION;
GO

PRINT 'Job Consultancy: an invitation is also a message now.';
GO
SET NOEXEC OFF;
GO
