/* =============================================================================
   PersonalDB · 10 · Job Consultancy: candidates, clients and placements
   -----------------------------------------------------------------------------
   Run AFTER 09_Jobs_Verification.sql, in the Personal DB. SAFE TO RE-RUN.
   Run it AGAIN every time script 07 is run again (07 re-creates
   jobs.sp_ProfileView_ListMine in its earlier form). Order: 06 -> 07 -> 08 -> 09 -> 10.

   Job Consultancy is a commercial application; its data lives here, next to the job
   postings, in schema consult. Every row belongs to one company (CompanyId of the
   main database) and every procedure takes @CompanyId first: a row of another
   company is "Not found". The API lets in only a member of the company who may
   open Job Consultancy (HiringAccess).

     consult.Clients       the companies a consultancy recruits for
     consult.Talent        the consultancy's pool of candidates (stage and note)
     consult.Invitations   a candidate was invited to apply for a job
     consult.Placements    who was placed where, and the fee

   Candidates are people whose Job Portal profile is switched to "Employers can
   find me" (jobs.Profiles.IsVisible = 1). Every read of a person's data by a
   company names that condition; a person who switches it off disappears from the
   search and from every pool at once. A company never sees a user id: a person is
   named by jobs.Profiles.CandidateKey, a random key. Every look at a candidate's
   profile or resume is written to jobs.ProfileViews, and the person sees which
   company looked (never who in it). What a person expects to earn is never shown.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.SchemaInfo') IS NULL OR OBJECT_ID('jobs.Postings') IS NULL
   OR COL_LENGTH('jobs.Postings', 'ReviewNote') IS NULL
BEGIN
    RAISERROR('Select the Personal DB and run 09_Jobs_Verification.sql in it before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
BEGIN
    RAISERROR('This database is not marked as the Personal DB. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

IF SCHEMA_ID('consult') IS NULL EXEC('CREATE SCHEMA consult');
GO

/* =============================================================================
   What changes in schema jobs
   ============================================================================= */

/* the key a company knows a candidate by */
IF COL_LENGTH('jobs.Profiles', 'CandidateKey') IS NULL
    ALTER TABLE jobs.Profiles ADD CandidateKey UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_jobs_Profiles_CandidateKey DEFAULT (NEWID()) WITH VALUES;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_jobs_Profiles_CandidateKey' AND object_id = OBJECT_ID('jobs.Profiles'))
    CREATE UNIQUE INDEX UQ_jobs_Profiles_CandidateKey ON jobs.Profiles(CandidateKey);
GO

/* a look from the candidate search belongs to no job: PostingId may be empty, the company is named */
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('jobs.ProfileViews') AND name = 'PostingId' AND is_nullable = 0)
    ALTER TABLE jobs.ProfileViews ALTER COLUMN PostingId INT NULL;
GO
IF COL_LENGTH('jobs.ProfileViews', 'CompanyName') IS NULL
    ALTER TABLE jobs.ProfileViews ADD CompanyName NVARCHAR(200) NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_jobs_Notifications_Kind' AND definition NOT LIKE '%Invitation%')
    ALTER TABLE jobs.Notifications DROP CONSTRAINT CK_jobs_Notifications_Kind;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_jobs_Notifications_Kind')
    ALTER TABLE jobs.Notifications ADD CONSTRAINT CK_jobs_Notifications_Kind
        CHECK (Kind IN ('Application', 'JobClosed', 'Certificate', 'Invitation'));
GO

/* =============================================================================
   Tables of schema consult
   ============================================================================= */
IF OBJECT_ID('consult.Clients') IS NULL
CREATE TABLE consult.Clients
(
    ClientId      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_consult_Clients PRIMARY KEY,
    CompanyId     INT            NOT NULL,
    Name          NVARCHAR(200)  NOT NULL,
    ContactPerson NVARCHAR(200)  NOT NULL CONSTRAINT DF_consult_Clients_Contact DEFAULT (''),
    Phone         NVARCHAR(30)   NOT NULL CONSTRAINT DF_consult_Clients_Phone DEFAULT (''),
    Email         NVARCHAR(256)  NOT NULL CONSTRAINT DF_consult_Clients_Email DEFAULT (''),
    City          NVARCHAR(100)  NOT NULL CONSTRAINT DF_consult_Clients_City DEFAULT (''),
    Industry      NVARCHAR(100)  NOT NULL CONSTRAINT DF_consult_Clients_Industry DEFAULT (''),
    Notes         NVARCHAR(2000) NOT NULL CONSTRAINT DF_consult_Clients_Notes DEFAULT (''),
    IsActive      BIT            NOT NULL CONSTRAINT DF_consult_Clients_IsActive DEFAULT (1),
    CreatedAt     DATETIME       NOT NULL CONSTRAINT DF_consult_Clients_CreatedAt DEFAULT (GETDATE()),
    UpdatedAt     DATETIME       NOT NULL CONSTRAINT DF_consult_Clients_UpdatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_consult_Clients_Company' AND object_id = OBJECT_ID('consult.Clients'))
    CREATE INDEX IX_consult_Clients_Company ON consult.Clients(CompanyId, Name);
GO

/* the client a job is for: known to the consultancy only, never shown to people */
IF COL_LENGTH('jobs.Postings', 'ClientId') IS NULL
    ALTER TABLE jobs.Postings ADD ClientId INT NULL CONSTRAINT FK_jobs_Postings_Clients REFERENCES consult.Clients(ClientId);
GO

IF OBJECT_ID('consult.Talent') IS NULL
CREATE TABLE consult.Talent
(
    TalentId  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_consult_Talent PRIMARY KEY,
    CompanyId INT            NOT NULL,
    UserId    INT            NOT NULL,   -- never handed to the company: it knows the CandidateKey
    Stage     NVARCHAR(20)   NOT NULL CONSTRAINT DF_consult_Talent_Stage DEFAULT ('New')
                                      CONSTRAINT CK_consult_Talent_Stage CHECK (Stage IN ('New', 'Contacted', 'Interview', 'Placed', 'NotSuitable')),
    Note      NVARCHAR(1000) NOT NULL CONSTRAINT DF_consult_Talent_Note DEFAULT (''),
    AddedBy   INT            NOT NULL,
    AddedAt   DATETIME       NOT NULL CONSTRAINT DF_consult_Talent_AddedAt DEFAULT (GETDATE()),
    UpdatedAt DATETIME       NOT NULL CONSTRAINT DF_consult_Talent_UpdatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_consult_Talent_Company_User UNIQUE (CompanyId, UserId)
);
GO

IF OBJECT_ID('consult.Invitations') IS NULL
CREATE TABLE consult.Invitations
(
    InvitationId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_consult_Invitations PRIMARY KEY,
    CompanyId    INT           NOT NULL,
    PostingId    INT           NOT NULL CONSTRAINT FK_consult_Invitations_Postings REFERENCES jobs.Postings(PostingId),
    UserId       INT           NOT NULL,
    Message      NVARCHAR(500) NOT NULL CONSTRAINT DF_consult_Invitations_Message DEFAULT (''),
    InvitedBy    INT           NOT NULL,
    InvitedAt    DATETIME      NOT NULL CONSTRAINT DF_consult_Invitations_InvitedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_consult_Invitations_Posting_User UNIQUE (PostingId, UserId)
);
GO

IF OBJECT_ID('consult.Placements') IS NULL
CREATE TABLE consult.Placements
(
    PlacementId    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_consult_Placements PRIMARY KEY,
    CompanyId      INT            NOT NULL,
    ClientId       INT            NULL CONSTRAINT FK_consult_Placements_Clients REFERENCES consult.Clients(ClientId),
    PostingId      INT            NULL CONSTRAINT FK_consult_Placements_Postings REFERENCES jobs.Postings(PostingId),
    UserId         INT            NULL,  -- when the candidate is on Job Portal; never handed out
    CandidateName  NVARCHAR(200)  NOT NULL,
    JobTitle       NVARCHAR(200)  NOT NULL,
    JoinDate       DATE           NOT NULL,
    AnnualCtc      INT            NULL,
    FeeAmount      INT            NULL,
    FeeStatus      NVARCHAR(10)   NOT NULL CONSTRAINT DF_consult_Placements_FeeStatus DEFAULT ('Pending')
                                           CONSTRAINT CK_consult_Placements_FeeStatus CHECK (FeeStatus IN ('Pending', 'Invoiced', 'Paid')),
    GuaranteeUntil DATE           NULL,
    Notes          NVARCHAR(1000) NOT NULL CONSTRAINT DF_consult_Placements_Notes DEFAULT (''),
    CreatedBy      INT            NOT NULL,
    CreatedAt      DATETIME       NOT NULL CONSTRAINT DF_consult_Placements_CreatedAt DEFAULT (GETDATE()),
    UpdatedAt      DATETIME       NOT NULL CONSTRAINT DF_consult_Placements_UpdatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_consult_Placements_Company' AND object_id = OBJECT_ID('consult.Placements'))
    CREATE INDEX IX_consult_Placements_Company ON consult.Placements(CompanyId, JoinDate DESC);
GO

/* =============================================================================
   CLIENTS
   ============================================================================= */
CREATE OR ALTER PROCEDURE consult.sp_Client_List
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.ClientId, c.Name, c.ContactPerson, c.Phone, c.Email, c.City, c.Industry, c.Notes, c.IsActive, c.CreatedAt,
           (SELECT COUNT(*) FROM jobs.Postings p WHERE p.ClientId = c.ClientId AND p.CompanyId = @CompanyId AND p.Status IN ('Open', 'InReview')) AS OpenJobs,
           (SELECT COUNT(*) FROM consult.Placements pl WHERE pl.ClientId = c.ClientId AND pl.CompanyId = @CompanyId) AS Placements
    FROM consult.Clients c
    WHERE c.CompanyId = @CompanyId
    ORDER BY c.IsActive DESC, c.Name;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_Client_Save
    @CompanyId     INT,
    @ClientId      INT,
    @Name          NVARCHAR(200),
    @ContactPerson NVARCHAR(200)  = NULL,
    @Phone         NVARCHAR(30)   = NULL,
    @Email         NVARCHAR(256)  = NULL,
    @City          NVARCHAR(100)  = NULL,
    @Industry      NVARCHAR(100)  = NULL,
    @Notes         NVARCHAR(2000) = NULL,
    @IsActive      BIT            = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Name = LTRIM(RTRIM(ISNULL(@Name, '')));

    IF ISNULL(@CompanyId, 0) = 0 OR @Name = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Enter the name of the client' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM consult.Clients WITH (UPDLOCK, HOLDLOCK)
               WHERE CompanyId = @CompanyId AND Name = @Name AND ClientId <> ISNULL(@ClientId, 0))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'You already have a client of this name' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF ISNULL(@ClientId, 0) = 0
    BEGIN
        IF (SELECT COUNT(*) FROM consult.Clients WHERE CompanyId = @CompanyId) >= 1000
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'You have 1000 clients. Remove one you no longer need first' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END

        INSERT INTO consult.Clients (CompanyId, Name, ContactPerson, Phone, Email, City, Industry, Notes, IsActive)
        VALUES (@CompanyId, @Name, ISNULL(@ContactPerson, ''), ISNULL(@Phone, ''), ISNULL(@Email, ''), ISNULL(@City, ''),
                ISNULL(@Industry, ''), ISNULL(@Notes, ''), ISNULL(@IsActive, 1));

        DECLARE @NewId INT = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
        SELECT CAST(1 AS INT) AS Success, 'Client added' AS Message, @NewId AS Id; RETURN;
    END

    UPDATE consult.Clients
    SET Name = @Name, ContactPerson = ISNULL(@ContactPerson, ''), Phone = ISNULL(@Phone, ''), Email = ISNULL(@Email, ''),
        City = ISNULL(@City, ''), Industry = ISNULL(@Industry, ''), Notes = ISNULL(@Notes, ''), IsActive = ISNULL(@IsActive, 1),
        UpdatedAt = GETDATE()
    WHERE ClientId = @ClientId AND CompanyId = @CompanyId;

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS INT) AS Success, 'Client saved' AS Message, @ClientId AS Id;
END
GO

/* A client with placements stays (switch it to inactive); its jobs lose the link. */
CREATE OR ALTER PROCEDURE consult.sp_Client_Delete
    @CompanyId INT,
    @ClientId  INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM consult.Clients WHERE ClientId = @ClientId AND CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    IF EXISTS (SELECT 1 FROM consult.Placements WHERE ClientId = @ClientId AND CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'A client with placements cannot be removed. Mark it inactive instead' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    UPDATE jobs.Postings SET ClientId = NULL WHERE ClientId = @ClientId AND CompanyId = @CompanyId;
    DELETE FROM consult.Clients WHERE ClientId = @ClientId AND CompanyId = @CompanyId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Client removed' AS Message;
END
GO

/* Which job is for which client (only the company's own jobs and clients). */
CREATE OR ALTER PROCEDURE consult.sp_Posting_ClientList
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.PostingId, c.ClientId, c.Name AS ClientName
    FROM jobs.Postings p
    INNER JOIN consult.Clients c ON c.ClientId = p.ClientId AND c.CompanyId = @CompanyId
    WHERE p.CompanyId = @CompanyId;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_Posting_SetClient
    @CompanyId INT,
    @PostingId INT,
    @ClientId  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @ClientId = NULLIF(@ClientId, 0);

    IF @ClientId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM consult.Clients WHERE ClientId = @ClientId AND CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    UPDATE jobs.Postings SET ClientId = @ClientId WHERE PostingId = @PostingId AND CompanyId = @CompanyId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Client of the job saved' AS Message;
END
GO

/* =============================================================================
   CANDIDATES · people who chose "Employers can find me"
   ============================================================================= */
CREATE OR ALTER PROCEDURE consult.sp_Candidate_Search
    @CompanyId INT,
    @Query     NVARCHAR(100) = NULL,
    @City      NVARCHAR(100) = NULL,
    @MinYears  INT           = NULL,
    @WorkMode  NVARCHAR(20)  = NULL,
    @PoolOnly  BIT           = 0,
    @Page      INT           = 1,
    @PageSize  INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    SET @Query    = LTRIM(RTRIM(ISNULL(@Query, '')));
    SET @City     = LTRIM(RTRIM(ISNULL(@City, '')));
    SET @WorkMode = LTRIM(RTRIM(ISNULL(@WorkMode, '')));
    SET @Page     = CASE WHEN ISNULL(@Page, 1) < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN ISNULL(@PageSize, 20) < 1 THEN 20 WHEN @PageSize > 50 THEN 50 ELSE @PageSize END;

    -- the wildcard characters of LIKE are taken literally
    SET @Query = REPLACE(REPLACE(REPLACE(@Query, '[', '[[]'), '%', '[%]'), '_', '[_]');
    SET @City  = REPLACE(REPLACE(REPLACE(@City,  '[', '[[]'), '%', '[%]'), '_', '[_]');

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT pr.CandidateKey, pr.FullName, pr.Headline, pr.City,
           ISNULL(x.Months, 0) / 12 AS ExperienceYears,
           ISNULL((SELECT STRING_AGG(s.SkillName, ', ') FROM (SELECT TOP (8) sk.SkillName FROM jobs.Skills sk
                   WHERE sk.UserId = pr.UserId ORDER BY CASE sk.Level WHEN 'Expert' THEN 0 WHEN 'Intermediate' THEN 1 ELSE 2 END, sk.SkillName) s), '') AS Skills,
           ISNULL((SELECT STRING_AGG(j.Value, ', ') FROM jobs.Preferences j WHERE j.UserId = pr.UserId AND j.Kind = 'Job'), '') AS PreferredJobs,
           ISNULL((SELECT STRING_AGG(w.Value, ', ') FROM jobs.Preferences w WHERE w.UserId = pr.UserId AND w.Kind = 'WorkMode'), '') AS WorkModes,
           CAST(CASE WHEN EXISTS (SELECT 1 FROM jobs.Files f WHERE f.UserId = pr.UserId AND f.Kind = 'Resume') THEN 1 ELSE 0 END AS BIT) AS HasResume,
           CAST(CASE WHEN t.TalentId IS NULL THEN 0 ELSE 1 END AS BIT) AS InPool,
           ISNULL(t.Stage, '') AS Stage,
           COUNT(*) OVER () AS TotalCount
    FROM jobs.Profiles pr
    LEFT JOIN consult.Talent t ON t.UserId = pr.UserId AND t.CompanyId = @CompanyId
    OUTER APPLY (SELECT SUM(DATEDIFF(MONTH, e.StartMonth, ISNULL(e.EndMonth, @Today)) + 1) AS Months
                 FROM jobs.Experience e WHERE e.UserId = pr.UserId) x
    WHERE pr.IsVisible = 1 AND pr.FullName <> '' AND pr.Headline <> ''
      AND (ISNULL(@PoolOnly, 0) = 0 OR t.TalentId IS NOT NULL)
      AND (@Query = '' OR pr.FullName LIKE '%' + @Query + '%' OR pr.Headline LIKE '%' + @Query + '%' OR pr.Summary LIKE '%' + @Query + '%'
           OR EXISTS (SELECT 1 FROM jobs.Skills sk WHERE sk.UserId = pr.UserId AND sk.SkillName LIKE '%' + @Query + '%')
           OR EXISTS (SELECT 1 FROM jobs.Preferences j WHERE j.UserId = pr.UserId AND j.Kind = 'Job' AND j.Value LIKE '%' + @Query + '%'))
      AND (@City = '' OR pr.City LIKE '%' + @City + '%'
           OR EXISTS (SELECT 1 FROM jobs.Preferences l WHERE l.UserId = pr.UserId AND l.Kind = 'Location' AND l.Value LIKE '%' + @City + '%'))
      AND (@MinYears IS NULL OR ISNULL(x.Months, 0) >= @MinYears * 12)
      AND (@WorkMode = '' OR EXISTS (SELECT 1 FROM jobs.Preferences w WHERE w.UserId = pr.UserId AND w.Kind = 'WorkMode' AND w.Value = @WorkMode))
    ORDER BY CASE WHEN t.TalentId IS NULL THEN 1 ELSE 0 END, pr.UpdatedAt DESC, pr.CandidateKey
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

/* One candidate: the pool row of this company (first result set; no row = not found),
   then the preferences (jobs, places, modes; never the expected CTC), then the profile
   page as jobs.sp_Profile_Get gives it. The look is written down. */
CREATE OR ALTER PROCEDURE consult.sp_Candidate_Get
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER,
    @ViewerUserId INT,
    @CompanyName  NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Person INT;
    SELECT @Person = pr.UserId FROM jobs.Profiles pr WHERE pr.CandidateKey = @CandidateKey AND pr.IsVisible = 1;

    SELECT pr.CandidateKey,
           CAST(CASE WHEN t.TalentId IS NULL THEN 0 ELSE 1 END AS BIT) AS InPool,
           ISNULL(t.Stage, '') AS Stage, ISNULL(t.Note, '') AS Note
    FROM jobs.Profiles pr
    LEFT JOIN consult.Talent t ON t.UserId = pr.UserId AND t.CompanyId = @CompanyId
    WHERE pr.CandidateKey = @CandidateKey AND pr.IsVisible = 1;

    IF @Person IS NULL RETURN;

    SELECT p.Kind, p.Value
    FROM jobs.Preferences p
    INNER JOIN jobs.Profiles pr ON pr.UserId = p.UserId AND pr.IsVisible = 1
    WHERE p.UserId = @Person AND p.Kind IN ('Job', 'Location', 'WorkMode')
    ORDER BY p.Kind, p.SortOrder;

    INSERT INTO jobs.ProfileViews (CompanyId, CompanyName, ViewerUserId, UserId, PostingId, What)
    SELECT @CompanyId, @CompanyName, ISNULL(@ViewerUserId, 0), pr.UserId, NULL, 'Profile'
    FROM jobs.Profiles pr WHERE pr.UserId = @Person AND pr.IsVisible = 1;

    EXEC jobs.sp_Profile_Get @UserId = @Person;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_Candidate_Resume
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER,
    @ViewerUserId INT,
    @CompanyName  NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Person INT;
    SELECT @Person = pr.UserId FROM jobs.Profiles pr WHERE pr.CandidateKey = @CandidateKey AND pr.IsVisible = 1;

    IF @Person IS NULL OR NOT EXISTS (SELECT 1 FROM jobs.Files WHERE UserId = @Person AND Kind = 'Resume') RETURN;

    INSERT INTO jobs.ProfileViews (CompanyId, CompanyName, ViewerUserId, UserId, PostingId, What)
    VALUES (@CompanyId, @CompanyName, ISNULL(@ViewerUserId, 0), @Person, NULL, 'Resume');

    SELECT TOP (1) f.FileName, f.ContentType, f.Content
    FROM jobs.Files f
    INNER JOIN jobs.Profiles pr ON pr.UserId = f.UserId AND pr.IsVisible = 1
    WHERE f.UserId = @Person AND f.Kind = 'Resume'
    ORDER BY f.FileId DESC;
END
GO

/* =============================================================================
   TALENT POOL
   ============================================================================= */
CREATE OR ALTER PROCEDURE consult.sp_Talent_Save
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER,
    @Stage        NVARCHAR(20)   = NULL,
    @Note         NVARCHAR(1000) = NULL,
    @UserId       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Person INT;
    SELECT @Person = pr.UserId FROM jobs.Profiles pr WHERE pr.CandidateKey = @CandidateKey AND pr.IsVisible = 1;

    IF @Person IS NULL OR ISNULL(@CompanyId, 0) = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message; RETURN;
    END

    SET @Stage = ISNULL(NULLIF(LTRIM(RTRIM(@Stage)), ''), 'New');
    IF @Stage NOT IN ('New', 'Contacted', 'Interview', 'Placed', 'NotSuitable')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose the stage from the list' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    UPDATE consult.Talent
    SET Stage = @Stage, Note = LTRIM(RTRIM(ISNULL(@Note, ''))), UpdatedAt = GETDATE()
    WHERE CompanyId = @CompanyId AND UserId = @Person;

    IF @@ROWCOUNT = 0
    BEGIN
        IF (SELECT COUNT(*) FROM consult.Talent WHERE CompanyId = @CompanyId) >= 5000
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'Your pool has 5000 candidates. Remove some first' AS Message; RETURN;
        END

        INSERT INTO consult.Talent (CompanyId, UserId, Stage, Note, AddedBy)
        VALUES (@CompanyId, @Person, @Stage, LTRIM(RTRIM(ISNULL(@Note, ''))), ISNULL(@UserId, 0));

        COMMIT TRANSACTION;
        SELECT CAST(1 AS INT) AS Success, 'Added to your candidates' AS Message; RETURN;
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS INT) AS Success, 'Candidate saved' AS Message;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_Talent_Remove
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    DELETE t
    FROM consult.Talent t
    INNER JOIN jobs.Profiles pr ON pr.UserId = t.UserId
    WHERE t.CompanyId = @CompanyId AND pr.CandidateKey = @CandidateKey;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Removed from your candidates' AS Message;
END
GO

/* Invites a candidate to apply for an open job of the company; the person is told once. */
CREATE OR ALTER PROCEDURE consult.sp_Candidate_Invite
    @CompanyId    INT,
    @CandidateKey UNIQUEIDENTIFIER,
    @PostingId    INT,
    @Message      NVARCHAR(500) = NULL,
    @UserId       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Person INT, @Title NVARCHAR(200), @Company NVARCHAR(200);
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

    IF EXISTS (SELECT 1 FROM consult.Invitations WITH (UPDLOCK, HOLDLOCK) WHERE PostingId = @PostingId AND UserId = @Person AND CompanyId = @CompanyId)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'This candidate was already invited to the job' AS Message; RETURN;
    END

    INSERT INTO consult.Invitations (CompanyId, PostingId, UserId, Message, InvitedBy)
    VALUES (@CompanyId, @PostingId, @Person, LTRIM(RTRIM(ISNULL(@Message, ''))), ISNULL(@UserId, 0));

    INSERT INTO jobs.Notifications (UserId, Kind, Title, Body, Link)
    SELECT pr.UserId, 'Invitation',
           @Company + ' invites you to apply for ' + @Title,
           LTRIM(RTRIM(ISNULL(@Message, ''))),
           '/apps/jobs/search?posting=' + CAST(@PostingId AS NVARCHAR(12))
    FROM jobs.Profiles pr WHERE pr.UserId = @Person AND pr.IsVisible = 1;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Invitation sent' AS Message;
END
GO

/* =============================================================================
   PLACEMENTS
   Two result sets: the placements, then the figures of the head of the page.
   ============================================================================= */
CREATE OR ALTER PROCEDURE consult.sp_Placement_List
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT pl.PlacementId, pl.ClientId, ISNULL(c.Name, '') AS ClientName, pl.PostingId, pl.CandidateName, pl.JobTitle,
           pl.JoinDate, pl.AnnualCtc, pl.FeeAmount, pl.FeeStatus, pl.GuaranteeUntil, pl.Notes, pl.CreatedAt,
           CAST(CASE WHEN pl.UserId IS NULL THEN 0 ELSE 1 END AS BIT) AS OnJobPortal
    FROM consult.Placements pl
    LEFT JOIN consult.Clients c ON c.ClientId = pl.ClientId AND c.CompanyId = @CompanyId
    WHERE pl.CompanyId = @CompanyId
    ORDER BY pl.JoinDate DESC, pl.PlacementId DESC;

    SELECT
        (SELECT COUNT(*) FROM consult.Placements WHERE CompanyId = @CompanyId
           AND YEAR(JoinDate) = YEAR(GETDATE()) AND MONTH(JoinDate) = MONTH(GETDATE())) AS ThisMonth,
        (SELECT COUNT(*) FROM consult.Placements WHERE CompanyId = @CompanyId) AS Total,
        (SELECT ISNULL(SUM(CAST(FeeAmount AS BIGINT)), 0) FROM consult.Placements WHERE CompanyId = @CompanyId AND FeeStatus <> 'Paid') AS FeeOutstanding,
        (SELECT ISNULL(SUM(CAST(FeeAmount AS BIGINT)), 0) FROM consult.Placements WHERE CompanyId = @CompanyId AND FeeStatus = 'Paid'
           AND YEAR(JoinDate) = YEAR(GETDATE())) AS FeePaidThisYear;
END
GO

/* Adds or changes a placement. The candidate is named by a CandidateKey (a visible
   profile), by an application to one of the company's jobs, or only by name. */
CREATE OR ALTER PROCEDURE consult.sp_Placement_Save
    @CompanyId      INT,
    @PlacementId    INT,
    @UserId         INT,
    @CandidateKey   UNIQUEIDENTIFIER = NULL,
    @ApplicationId  INT              = NULL,
    @CandidateName  NVARCHAR(200),
    @ClientId       INT              = NULL,
    @PostingId      INT              = NULL,
    @JobTitle       NVARCHAR(200),
    @JoinDate       DATE,
    @AnnualCtc      INT              = NULL,
    @FeeAmount      INT              = NULL,
    @FeeStatus      NVARCHAR(10)     = 'Pending',
    @GuaranteeUntil DATE             = NULL,
    @Notes          NVARCHAR(1000)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @CandidateName = LTRIM(RTRIM(ISNULL(@CandidateName, '')));
    SET @JobTitle      = LTRIM(RTRIM(ISNULL(@JobTitle, '')));
    SET @ClientId      = NULLIF(@ClientId, 0);
    SET @PostingId     = NULLIF(@PostingId, 0);
    SET @ApplicationId = NULLIF(@ApplicationId, 0);

    IF ISNULL(@CompanyId, 0) = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF @ClientId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM consult.Clients WHERE ClientId = @ClientId AND CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END
    IF @PostingId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jobs.Postings WHERE PostingId = @PostingId AND CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    /* who was placed: a visible profile, an applicant of the company, or a name only */
    DECLARE @Person INT, @PersonName NVARCHAR(200);
    IF @CandidateKey IS NOT NULL
        SELECT @Person = pr.UserId, @PersonName = pr.FullName FROM jobs.Profiles pr WHERE pr.CandidateKey = @CandidateKey AND pr.IsVisible = 1;
    ELSE IF @ApplicationId IS NOT NULL
        SELECT @Person = a.UserId, @PersonName = pr.FullName, @PostingId = ISNULL(@PostingId, a.PostingId)
        FROM jobs.Applications a
        INNER JOIN jobs.Postings p ON p.PostingId = a.PostingId AND p.CompanyId = @CompanyId
        LEFT JOIN jobs.Profiles pr ON pr.UserId = a.UserId
        WHERE a.ApplicationId = @ApplicationId AND a.Status <> 'Withdrawn';

    IF (@CandidateKey IS NOT NULL OR @ApplicationId IS NOT NULL) AND @Person IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    SET @CandidateName = CASE WHEN @CandidateName = '' THEN ISNULL(@PersonName, '') ELSE @CandidateName END;

    IF @CandidateName = '' OR @JobTitle = '' OR @JoinDate IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Enter the candidate, the job and the joining date' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    IF ISNULL(@FeeStatus, '') NOT IN ('Pending', 'Invoiced', 'Paid')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose the state of the fee from the list' AS Message, CAST(0 AS INT) AS Id; RETURN;
    END

    BEGIN TRANSACTION;

    IF ISNULL(@PlacementId, 0) = 0
    BEGIN
        INSERT INTO consult.Placements (CompanyId, ClientId, PostingId, UserId, CandidateName, JobTitle, JoinDate, AnnualCtc,
                                        FeeAmount, FeeStatus, GuaranteeUntil, Notes, CreatedBy)
        VALUES (@CompanyId, @ClientId, @PostingId, @Person, @CandidateName, @JobTitle, @JoinDate, @AnnualCtc,
                @FeeAmount, @FeeStatus, @GuaranteeUntil, LTRIM(RTRIM(ISNULL(@Notes, ''))), ISNULL(@UserId, 0));
        SET @PlacementId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE consult.Placements
        SET ClientId = @ClientId, PostingId = @PostingId, UserId = ISNULL(@Person, UserId), CandidateName = @CandidateName,
            JobTitle = @JobTitle, JoinDate = @JoinDate, AnnualCtc = @AnnualCtc, FeeAmount = @FeeAmount, FeeStatus = @FeeStatus,
            GuaranteeUntil = @GuaranteeUntil, Notes = LTRIM(RTRIM(ISNULL(@Notes, ''))), UpdatedAt = GETDATE()
        WHERE PlacementId = @PlacementId AND CompanyId = @CompanyId;

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message, CAST(0 AS INT) AS Id; RETURN;
        END
    END

    /* the candidate in the pool of this company is placed now */
    IF @Person IS NOT NULL
        UPDATE consult.Talent SET Stage = 'Placed', UpdatedAt = GETDATE()
        WHERE CompanyId = @CompanyId AND UserId = @Person;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Placement saved' AS Message, @PlacementId AS Id;
END
GO

CREATE OR ALTER PROCEDURE consult.sp_Placement_Delete
    @CompanyId   INT,
    @PlacementId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM consult.Placements WHERE PlacementId = @PlacementId AND CompanyId = @CompanyId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS INT) AS Success, 'Not found' AS Message;
    ELSE
        SELECT CAST(1 AS INT) AS Success, 'Placement removed' AS Message;
END
GO

/* =============================================================================
   PERSON · who looked: a look from the candidate search belongs to no job
   (as in script 07, with those looks)
   ============================================================================= */
CREATE OR ALTER PROCEDURE jobs.sp_ProfileView_ListMine
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (30)
           ISNULL(p.CompanyName, ISNULL(v.CompanyName, '')) AS CompanyName,
           ISNULL(p.Title, 'Candidate search') AS PostingTitle,
           SUM(CASE WHEN v.What = 'Profile' THEN 1 ELSE 0 END) AS ProfileViews,
           SUM(CASE WHEN v.What = 'Resume'  THEN 1 ELSE 0 END) AS ResumeViews,
           MAX(v.ViewedAt) AS LastViewedAt
    FROM jobs.ProfileViews v
    LEFT JOIN jobs.Postings p ON p.PostingId = v.PostingId
    WHERE v.UserId = @UserId
    GROUP BY v.CompanyId, ISNULL(p.CompanyName, ISNULL(v.CompanyName, '')), v.PostingId, ISNULL(p.Title, 'Candidate search')
    ORDER BY MAX(v.ViewedAt) DESC;
END
GO

PRINT 'Job Consultancy: candidates, clients and placements are in place.';
GO
SET NOEXEC OFF;
GO
