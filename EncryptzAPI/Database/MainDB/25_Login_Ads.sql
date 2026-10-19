/* =============================================================================
   MainDB · 25 · Login Ads: the advertisement slides of the sign-in page
   -----------------------------------------------------------------------------
   Run in MainDBEncryptz. ADDITIVE and SAFE TO RE-RUN: it adds one table and
   seven procedures and changes nothing that exists.

   The sign-in and register pages show these slides before anyone has signed in
   or picked a company, so there is one set for the whole platform. The platform
   administrator manages them (Platform Admin › Login Ads).

     dbo.LoginAds                 the slides, with their image
     dbo.sp_LoginAd_ListPublic    the slides shown today, without the image bytes
     dbo.sp_LoginAd_ListAll       every slide for the administrator, without the image bytes
     dbo.sp_LoginAd_GetImage      the image of one slide (@OnlyShowing = 1: only when shown today)
     dbo.sp_LoginAd_Save          adds (@LoginAdId = 0) or changes a slide; no image keeps the old one
     dbo.sp_LoginAd_SetActive     switches a slide on or off
     dbo.sp_LoginAd_Delete        removes a slide
     dbo.sp_LoginAd_Reorder       the order of the slides, from a JSON array of ids

   A slide is shown when it is active and today (the server date) is between
   ShowFrom and ShowUntil; either of them may be empty.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Users') IS NULL
BEGIN
    RAISERROR('Select MainDBEncryptz before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.LoginAds') IS NULL
CREATE TABLE dbo.LoginAds
(
    LoginAdId    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LoginAds PRIMARY KEY,
    SortOrder    INT            NOT NULL,
    Tag          NVARCHAR(40)   NOT NULL CONSTRAINT DF_LoginAds_Tag DEFAULT (''),
    Title        NVARCHAR(120)  NOT NULL CONSTRAINT DF_LoginAds_Title DEFAULT (''),
    Body         NVARCHAR(250)  NOT NULL CONSTRAINT DF_LoginAds_Body DEFAULT (''),
    ButtonText   NVARCHAR(30)   NOT NULL CONSTRAINT DF_LoginAds_ButtonText DEFAULT (''),
    LinkUrl      NVARCHAR(500)  NOT NULL CONSTRAINT DF_LoginAds_LinkUrl DEFAULT (''),
    ShowFrom     DATE           NULL,
    ShowUntil    DATE           NULL,
    IsActive     BIT            NOT NULL CONSTRAINT DF_LoginAds_IsActive DEFAULT (1),
    ImageName    NVARCHAR(200)  NOT NULL,
    ImageType    NVARCHAR(20)   NOT NULL,   -- image/jpeg | image/png | image/webp
    Image        VARBINARY(MAX) NOT NULL,
    ImageVersion INT            NOT NULL CONSTRAINT DF_LoginAds_ImageVersion DEFAULT (1),   -- in the image address, so a new image is fetched
    CreatedAt    DATETIME       NOT NULL CONSTRAINT DF_LoginAds_CreatedAt DEFAULT (GETDATE()),
    CreatedBy    INT            NULL,
    UpdatedAt    DATETIME       NULL,
    UpdatedBy    INT            NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LoginAds_Sort' AND object_id = OBJECT_ID('dbo.LoginAds'))
    CREATE INDEX IX_LoginAds_Sort ON dbo.LoginAds(IsActive, SortOrder);
GO

/* The slides shown today, in order, without the image bytes. */
CREATE OR ALTER PROCEDURE dbo.sp_LoginAd_ListPublic
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT LoginAdId, Tag, Title, Body, ButtonText, LinkUrl, ImageVersion
    FROM dbo.LoginAds
    WHERE IsActive = 1
      AND (ShowFrom IS NULL OR ShowFrom <= @Today)
      AND (ShowUntil IS NULL OR ShowUntil >= @Today)
    ORDER BY SortOrder, LoginAdId;
END
GO

/* Every slide for the administrator, without the image bytes. */
CREATE OR ALTER PROCEDURE dbo.sp_LoginAd_ListAll
AS
BEGIN
    SET NOCOUNT ON;

    SELECT LoginAdId, SortOrder, Tag, Title, Body, ButtonText, LinkUrl, ShowFrom, ShowUntil,
           IsActive, ImageVersion, UpdatedAt
    FROM dbo.LoginAds
    ORDER BY SortOrder, LoginAdId;
END
GO

/* The image of one slide. @OnlyShowing = 1 (the sign-in page): no row unless the slide is shown today. */
CREATE OR ALTER PROCEDURE dbo.sp_LoginAd_GetImage
    @LoginAdId   INT,
    @OnlyShowing BIT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT ImageName, ImageType, Image
    FROM dbo.LoginAds
    WHERE LoginAdId = @LoginAdId
      AND (@OnlyShowing = 0
           OR (IsActive = 1
               AND (ShowFrom IS NULL OR ShowFrom <= @Today)
               AND (ShowUntil IS NULL OR ShowUntil >= @Today)));
END
GO

/* Adds (@LoginAdId = 0, at the end of the order) or changes a slide. No @Image keeps the stored one. */
CREATE OR ALTER PROCEDURE dbo.sp_LoginAd_Save
    @LoginAdId  INT,
    @Tag        NVARCHAR(40),
    @Title      NVARCHAR(120),
    @Body       NVARCHAR(250),
    @ButtonText NVARCHAR(30),
    @LinkUrl    NVARCHAR(500),
    @ShowFrom   DATE = NULL,
    @ShowUntil  DATE = NULL,
    @IsActive   BIT,
    @ImageName  NVARCHAR(200) = NULL,
    @ImageType  NVARCHAR(20) = NULL,
    @Image      VARBINARY(MAX) = NULL,
    @UserId     INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @LoginAdId = 0
    BEGIN
        IF @Image IS NULL
        BEGIN
            SELECT CAST(0 AS BIT) AS Success, N'Choose an image' AS Message, 0 AS LoginAdId;
            RETURN;
        END

        INSERT INTO dbo.LoginAds (SortOrder, Tag, Title, Body, ButtonText, LinkUrl, ShowFrom, ShowUntil, IsActive,
                                  ImageName, ImageType, Image, CreatedBy)
        VALUES ((SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM dbo.LoginAds), @Tag, @Title, @Body, @ButtonText, @LinkUrl,
                @ShowFrom, @ShowUntil, @IsActive, @ImageName, @ImageType, @Image, @UserId);

        SELECT CAST(1 AS BIT) AS Success, N'Slide added' AS Message, CAST(SCOPE_IDENTITY() AS INT) AS LoginAdId;
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.LoginAds WHERE LoginAdId = @LoginAdId)
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'The slide does not exist' AS Message, @LoginAdId AS LoginAdId;
        RETURN;
    END

    UPDATE dbo.LoginAds
    SET Tag = @Tag, Title = @Title, Body = @Body, ButtonText = @ButtonText, LinkUrl = @LinkUrl,
        ShowFrom = @ShowFrom, ShowUntil = @ShowUntil, IsActive = @IsActive,
        UpdatedAt = GETDATE(), UpdatedBy = @UserId
    WHERE LoginAdId = @LoginAdId;

    IF @Image IS NOT NULL
        UPDATE dbo.LoginAds
        SET ImageName = @ImageName, ImageType = @ImageType, Image = @Image, ImageVersion = ImageVersion + 1
        WHERE LoginAdId = @LoginAdId;

    SELECT CAST(1 AS BIT) AS Success, N'Slide saved' AS Message, @LoginAdId AS LoginAdId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_LoginAd_SetActive
    @LoginAdId INT,
    @IsActive  BIT,
    @UserId    INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.LoginAds SET IsActive = @IsActive, UpdatedAt = GETDATE(), UpdatedBy = @UserId
    WHERE LoginAdId = @LoginAdId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS BIT) AS Success, N'The slide does not exist' AS Message;
    ELSE
        SELECT CAST(1 AS BIT) AS Success, CASE WHEN @IsActive = 1 THEN N'Slide shown' ELSE N'Slide hidden' END AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_LoginAd_Delete
    @LoginAdId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.LoginAds WHERE LoginAdId = @LoginAdId;

    IF @@ROWCOUNT = 0
        SELECT CAST(0 AS BIT) AS Success, N'The slide does not exist' AS Message;
    ELSE
        SELECT CAST(1 AS BIT) AS Success, N'Slide deleted' AS Message;
END
GO

/* The order of the slides: @Ids is a JSON array of ids, first shown first. Slides not named keep their place after them. */
CREATE OR ALTER PROCEDURE dbo.sp_LoginAd_Reorder
    @Ids    NVARCHAR(MAX),
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF ISJSON(@Ids) <> 1
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'The order could not be read' AS Message;
        RETURN;
    END

    UPDATE a
    SET SortOrder = CAST(j.[key] AS INT) + 1, UpdatedAt = GETDATE(), UpdatedBy = @UserId
    FROM dbo.LoginAds a
    JOIN OPENJSON(@Ids) j ON TRY_CAST(j.[value] AS INT) = a.LoginAdId;

    -- the slides not in the list go after the listed ones, in their old order
    ;WITH rest AS
    (
        SELECT LoginAdId, ROW_NUMBER() OVER (ORDER BY SortOrder, LoginAdId) AS n
        FROM dbo.LoginAds
        WHERE LoginAdId NOT IN (SELECT TRY_CAST([value] AS INT) FROM OPENJSON(@Ids) WHERE TRY_CAST([value] AS INT) IS NOT NULL)
    )
    UPDATE a SET SortOrder = (SELECT COUNT(*) FROM OPENJSON(@Ids)) + r.n
    FROM dbo.LoginAds a JOIN rest r ON r.LoginAdId = a.LoginAdId;

    SELECT CAST(1 AS BIT) AS Success, N'Order saved' AS Message;
END
GO
