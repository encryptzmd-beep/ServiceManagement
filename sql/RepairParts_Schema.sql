-- ============================================================
--  Database : [FelixServiceDB]
--  File     : RepairParts_Schema.sql
--  Module   : Repair Parts Lifecycle
--  Statuses : Requested → ReceivedAtHQ → UnderRepair
--             → Repaired → Dispatched → Delivered → Resolved
--
--  Notes
--  ─────
--  • Technician FullName lives in [Users] (not [Technicians]);
--    joined via Technicians.UserId → Users.UserId
--  • Assignments table is [TechnicianAssignments]
--  • All SPs use CREATE OR ALTER — safe to re-run
--  • Table blocks are IF NOT EXISTS guarded — safe to re-run
-- ============================================================

USE [FelixServiceDB];
GO

-- ============================================================
--  SECTION 1 : TABLES
-- ============================================================

-- ------------------------------------------------------------
--  1.1  RepairPartRequests
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RepairPartRequests')
BEGIN
    CREATE TABLE [dbo].[RepairPartRequests] (
        [RepairRequestId]  INT            IDENTITY(1,1) NOT NULL,
        [ComplaintId]      INT            NOT NULL,
        [AssignmentId]     INT            NOT NULL,
        [TechnicianId]     INT            NOT NULL,
        [CustomerId]       INT            NULL,
        [ProductId]        INT            NULL,
        [PartName]         NVARCHAR(200)  NULL,
        [PartSerialNumber] NVARCHAR(100)  NULL,
        [Notes]            NVARCHAR(1000) NULL,
        [Status]           NVARCHAR(50)   NULL CONSTRAINT [DF_RepairPartRequests_Status]    DEFAULT ('Requested'),
        [StatusNotes]      NVARCHAR(1000) NULL,
        [CreatedAt]        DATETIME       NULL CONSTRAINT [DF_RepairPartRequests_CreatedAt] DEFAULT (GETDATE()),
        [UpdatedAt]        DATETIME       NULL,
        CONSTRAINT [PK_RepairPartRequests] PRIMARY KEY CLUSTERED ([RepairRequestId] ASC),
        CONSTRAINT [FK_RepairPart_Complaints]   FOREIGN KEY ([ComplaintId])  REFERENCES [dbo].[Complaints]           ([ComplaintId]),
        CONSTRAINT [FK_RepairPart_Assignments]  FOREIGN KEY ([AssignmentId]) REFERENCES [dbo].[TechnicianAssignments] ([AssignmentId]),
        CONSTRAINT [FK_RepairPart_Technicians]  FOREIGN KEY ([TechnicianId]) REFERENCES [dbo].[Technicians]           ([TechnicianId])
    );
    PRINT 'Table [RepairPartRequests] created.';
END
ELSE
BEGIN
    -- Add columns that were added after initial creation
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('RepairPartRequests') AND name = 'StatusNotes')
        ALTER TABLE [dbo].[RepairPartRequests] ADD [StatusNotes] NVARCHAR(1000) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('RepairPartRequests') AND name = 'UpdatedAt')
        ALTER TABLE [dbo].[RepairPartRequests] ADD [UpdatedAt] DATETIME NULL;

    PRINT 'Table [RepairPartRequests] already exists — missing columns checked/added.';
END
GO

-- ------------------------------------------------------------
--  1.2  RepairPartImages
--       Stores base-64 encoded images (data:image/…;base64,…)
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RepairPartImages')
BEGIN
    CREATE TABLE [dbo].[RepairPartImages] (
        [ImageId]         INT           IDENTITY(1,1) NOT NULL,
        [RepairRequestId] INT           NOT NULL,
        [ImagePath]       NVARCHAR(MAX) NULL,
        [ImageType]       NVARCHAR(50)  NULL CONSTRAINT [DF_RepairPartImages_ImageType]  DEFAULT ('Other'),
        [CreatedAt]       DATETIME      NULL CONSTRAINT [DF_RepairPartImages_CreatedAt]   DEFAULT (GETDATE()),
        CONSTRAINT [PK_RepairPartImages]       PRIMARY KEY CLUSTERED ([ImageId] ASC),
        CONSTRAINT [FK_RepairPartImages_Req]   FOREIGN KEY ([RepairRequestId])
            REFERENCES [dbo].[RepairPartRequests] ([RepairRequestId]) ON DELETE CASCADE
    );
    PRINT 'Table [RepairPartImages] created.';
END
ELSE
    PRINT 'Table [RepairPartImages] already exists — skipped.';
GO

-- ============================================================
--  SECTION 2 : INDEXES
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RepairPartRequests_ComplaintId')
    CREATE NONCLUSTERED INDEX [IX_RepairPartRequests_ComplaintId]
        ON [dbo].[RepairPartRequests] ([ComplaintId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RepairPartRequests_TechnicianId')
    CREATE NONCLUSTERED INDEX [IX_RepairPartRequests_TechnicianId]
        ON [dbo].[RepairPartRequests] ([TechnicianId] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RepairPartRequests_Status')
    CREATE NONCLUSTERED INDEX [IX_RepairPartRequests_Status]
        ON [dbo].[RepairPartRequests] ([Status] ASC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RepairPartImages_RepairRequestId')
    CREATE NONCLUSTERED INDEX [IX_RepairPartImages_RepairRequestId]
        ON [dbo].[RepairPartImages] ([RepairRequestId] ASC);
GO

-- ============================================================
--  SECTION 3 : STORED PROCEDURES
-- ============================================================

-- ------------------------------------------------------------
--  3.1  sp_RepairPartRequest_Create
--       Technician submits a part to HQ for repair.
--       Returns new RepairRequestId (first column, first row).
-- ------------------------------------------------------------
CREATE OR ALTER PROCEDURE [dbo].[sp_RepairPartRequest_Create]
    @ComplaintId      INT,
    @AssignmentId     INT,
    @TechnicianId     INT,
    @CustomerId       INT            = NULL,
    @ProductId        INT            = NULL,
    @PartName         NVARCHAR(200)  = NULL,
    @PartSerialNumber NVARCHAR(100)  = NULL,
    @Notes            NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO [dbo].[RepairPartRequests]
        (ComplaintId, AssignmentId, TechnicianId, CustomerId, ProductId,
         PartName, PartSerialNumber, Notes, Status, CreatedAt)
    VALUES
        (@ComplaintId, @AssignmentId, @TechnicianId, @CustomerId, @ProductId,
         @PartName, @PartSerialNumber, @Notes, 'Requested', GETDATE());

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS RepairRequestId;
END
GO

-- ------------------------------------------------------------
--  3.2  sp_RepairPartImage_Save
--       Saves one base-64 image against a repair request.
--       Returns new ImageId.
-- ------------------------------------------------------------
CREATE OR ALTER PROCEDURE [dbo].[sp_RepairPartImage_Save]
    @RepairRequestId INT,
    @ImagePath       NVARCHAR(MAX),
    @ImageType       NVARCHAR(50) = 'Other'
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO [dbo].[RepairPartImages] (RepairRequestId, ImagePath, ImageType, CreatedAt)
    VALUES (@RepairRequestId, @ImagePath, @ImageType, GETDATE());

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS ImageId;
END
GO

-- ------------------------------------------------------------
--  3.3  sp_RepairPartRequest_UpdateStatus
--       Drives all status transitions.
--       Valid chain: Requested → ReceivedAtHQ → UnderRepair
--                   → Repaired → Dispatched → Delivered → Resolved
--       Returns: Success INT (1/0), Message NVARCHAR
-- ------------------------------------------------------------
CREATE OR ALTER PROCEDURE [dbo].[sp_RepairPartRequest_UpdateStatus]
    @RepairRequestId INT,
    @Status          NVARCHAR(50),
    @Notes           NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1 FROM [dbo].[RepairPartRequests]
        WHERE RepairRequestId = @RepairRequestId
    )
    BEGIN
        SELECT 0 AS Success, 'Repair request not found' AS Message;
        RETURN;
    END

    UPDATE [dbo].[RepairPartRequests]
    SET
        Status      = @Status,
        StatusNotes = @Notes,
        UpdatedAt   = GETDATE()
    WHERE RepairRequestId = @RepairRequestId;

    SELECT 1 AS Success, 'Status updated to ' + @Status AS Message;
END
GO

-- ------------------------------------------------------------
--  3.4  sp_RepairPart_GetAll
--       Paginated list for Admin / HQ management screen.
--       FullName comes from Users joined via Technicians.UserId.
-- ------------------------------------------------------------
CREATE OR ALTER PROCEDURE [dbo].[sp_RepairPart_GetAll]
    @Status       NVARCHAR(50) = NULL,
    @ComplaintId  INT          = NULL,
    @TechnicianId INT          = NULL,
    @PageNumber   INT          = 1,
    @PageSize     INT          = 30
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.RepairRequestId,
        r.ComplaintId,
        c.ComplaintNumber,
        r.AssignmentId,
        r.PartName,
        r.PartSerialNumber,
        r.Notes,
        r.Status,
        r.StatusNotes,
        u.FullName       AS TechnicianName,
        cu.CustomerName,
        p.ProductName,
        r.CreatedAt,
        r.UpdatedAt,
        (SELECT COUNT(*) FROM [dbo].[RepairPartImages] i
         WHERE i.RepairRequestId = r.RepairRequestId) AS ImageCount,
        COUNT(*) OVER ()                              AS TotalCount
    FROM [dbo].[RepairPartRequests] r
    LEFT JOIN [dbo].[Complaints]  c  ON c.ComplaintId  = r.ComplaintId
    LEFT JOIN [dbo].[Technicians] t  ON t.TechnicianId = r.TechnicianId
    LEFT JOIN [dbo].[Users]       u  ON u.UserId       = t.UserId
    LEFT JOIN [dbo].[Customers]   cu ON cu.CustomerId  = r.CustomerId
    LEFT JOIN [dbo].[Products]    p  ON p.ProductId    = r.ProductId
    WHERE
        (@Status       IS NULL OR r.Status       = @Status)
        AND (@ComplaintId  IS NULL OR r.ComplaintId  = @ComplaintId)
        AND (@TechnicianId IS NULL OR r.TechnicianId = @TechnicianId)
    ORDER BY r.CreatedAt DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO

-- ------------------------------------------------------------
--  3.5  sp_RepairPart_GetByComplaint
--       All repair requests for one complaint.
--       Used by: Complaint Detail Popup → Repairs tab
--                Work Order Detail      → Repairs tab
-- ------------------------------------------------------------
CREATE OR ALTER PROCEDURE [dbo].[sp_RepairPart_GetByComplaint]
    @ComplaintId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.RepairRequestId,
        r.PartName,
        r.PartSerialNumber,
        r.Notes,
        r.Status,
        r.StatusNotes,
        u.FullName AS TechnicianName,
        r.CreatedAt,
        r.UpdatedAt,
        (SELECT COUNT(*) FROM [dbo].[RepairPartImages] i
         WHERE i.RepairRequestId = r.RepairRequestId) AS ImageCount
    FROM [dbo].[RepairPartRequests] r
    LEFT JOIN [dbo].[Technicians] t ON t.TechnicianId = r.TechnicianId
    LEFT JOIN [dbo].[Users]       u ON u.UserId       = t.UserId
    WHERE r.ComplaintId = @ComplaintId
    ORDER BY r.CreatedAt DESC;
END
GO

-- ------------------------------------------------------------
--  3.6  sp_RepairPart_GetImages
--       Image metadata only (no blob) — for thumbnail grid.
--       Frontend lazy-loads each base64 on click via 3.7.
-- ------------------------------------------------------------
CREATE OR ALTER PROCEDURE [dbo].[sp_RepairPart_GetImages]
    @RepairRequestId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT ImageId, ImageType, CreatedAt
    FROM [dbo].[RepairPartImages]
    WHERE RepairRequestId = @RepairRequestId
    ORDER BY CreatedAt ASC;
END
GO

-- ------------------------------------------------------------
--  3.7  sp_RepairPart_GetImageBase64
--       Returns full base-64 string for a single image.
--       Called on demand when user clicks a thumbnail.
-- ------------------------------------------------------------
CREATE OR ALTER PROCEDURE [dbo].[sp_RepairPart_GetImageBase64]
    @ImageId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT ImagePath
    FROM [dbo].[RepairPartImages]
    WHERE ImageId = @ImageId;
END
GO

-- ============================================================
--  END OF FILE
-- ============================================================
PRINT 'RepairParts_Schema.sql applied successfully to [FelixServiceDB].';
GO
