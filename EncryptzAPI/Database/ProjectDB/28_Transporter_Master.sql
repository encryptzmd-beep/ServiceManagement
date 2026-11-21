/* =============================================================================
   ProjectDB (company database) · Transporter Master
   -----------------------------------------------------------------------------
   Adds dbo.Transporters, filled once from the transporter names already typed on
   despatches. A despatch keeps the name as text, so older despatches and reports
   stay exactly as they are.

     dbo.sp_Transporter_List   the transporters
     dbo.sp_Transporter_Save   add or change one

   Runs AFTER 27_CRM_Lead_Data_Access.sql. Run in EACH company database (select it
   in SSMS first; no USE on purpose). SAFE TO RE-RUN.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

DECLARE @problem NVARCHAR(400);
IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
    SET @problem = 'You are connected to [' + DB_NAME() + ']. Select the company database first.';
ELSE IF OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database (dbo.Locations is missing).';
ELSE IF OBJECT_ID('dbo.ServiceDespatches') IS NULL OR OBJECT_ID('dbo.Despatches') IS NULL
    SET @problem = 'Run 25_Unified_Despatch.sql first.';
IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Transporters') IS NULL
BEGIN
    CREATE TABLE dbo.Transporters
    (
        TransporterId   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Transporters PRIMARY KEY,
        TransporterName NVARCHAR(150) NOT NULL,
        ContactPerson   NVARCHAR(150) NOT NULL CONSTRAINT DF_Transporters_Contact DEFAULT (N''),
        Mobile          NVARCHAR(20)  NOT NULL CONSTRAINT DF_Transporters_Mobile DEFAULT (N''),
        GSTIN           NVARCHAR(20)  NOT NULL CONSTRAINT DF_Transporters_GSTIN DEFAULT (N''),
        Address         NVARCHAR(400) NOT NULL CONSTRAINT DF_Transporters_Address DEFAULT (N''),
        IsActive        BIT NOT NULL CONSTRAINT DF_Transporters_Active DEFAULT (1),
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Transporters_CreatedAt DEFAULT (DATEADD(MINUTE, 330, GETUTCDATE())),
        UpdatedAt       DATETIME2(0) NULL
    );
    CREATE UNIQUE INDEX UX_Transporters_Name ON dbo.Transporters (TransporterName);
END
GO

/* the names already on despatches */
;WITH names AS (
    SELECT LTRIM(RTRIM(TransporterName)) AS Name FROM dbo.Despatches WHERE NULLIF(LTRIM(RTRIM(TransporterName)), '') IS NOT NULL
    UNION
    SELECT LTRIM(RTRIM(TransporterName)) FROM dbo.ServiceDespatches WHERE NULLIF(LTRIM(RTRIM(TransporterName)), '') IS NOT NULL
), one AS (
    SELECT Name, ROW_NUMBER() OVER (PARTITION BY UPPER(Name) ORDER BY Name) AS n FROM names
)
INSERT INTO dbo.Transporters (TransporterName)
SELECT o.Name FROM one o
WHERE o.n = 1 AND NOT EXISTS (SELECT 1 FROM dbo.Transporters t WHERE t.TransporterName = o.Name);
GO

CREATE OR ALTER PROCEDURE dbo.sp_Transporter_List
    @IncludeInactive BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TransporterId, TransporterName, ContactPerson, Mobile, GSTIN, Address, IsActive
    FROM dbo.Transporters
    WHERE @IncludeInactive = 1 OR IsActive = 1
    ORDER BY TransporterName;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Transporter_Save
    @TransporterId   INT = 0,
    @TransporterName NVARCHAR(150),
    @ContactPerson   NVARCHAR(150) = NULL,
    @Mobile          NVARCHAR(20)  = NULL,
    @GSTIN           NVARCHAR(20)  = NULL,
    @Address         NVARCHAR(400) = NULL,
    @IsActive        BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @TransporterName = LTRIM(RTRIM(ISNULL(@TransporterName, N'')));

    IF @TransporterName = N''
    BEGIN
        SELECT CAST(0 AS BIT) AS Success, N'Enter the transporter name' AS Message, 0 AS TransporterId; RETURN;
    END

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM dbo.Transporters WITH (UPDLOCK, HOLDLOCK) WHERE TransporterName = @TransporterName AND TransporterId <> ISNULL(@TransporterId, 0))
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'This transporter is already in the list' AS Message, 0 AS TransporterId; RETURN;
    END

    IF ISNULL(@TransporterId, 0) = 0
    BEGIN
        INSERT INTO dbo.Transporters (TransporterName, ContactPerson, Mobile, GSTIN, Address, IsActive)
        VALUES (@TransporterName, LTRIM(RTRIM(ISNULL(@ContactPerson, N''))), LTRIM(RTRIM(ISNULL(@Mobile, N''))),
                UPPER(LTRIM(RTRIM(ISNULL(@GSTIN, N'')))), LTRIM(RTRIM(ISNULL(@Address, N''))), ISNULL(@IsActive, 1));
        SET @TransporterId = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
        SELECT CAST(1 AS BIT) AS Success, N'Transporter added' AS Message, @TransporterId AS TransporterId; RETURN;
    END

    UPDATE dbo.Transporters
    SET TransporterName = @TransporterName, ContactPerson = LTRIM(RTRIM(ISNULL(@ContactPerson, N''))), Mobile = LTRIM(RTRIM(ISNULL(@Mobile, N''))),
        GSTIN = UPPER(LTRIM(RTRIM(ISNULL(@GSTIN, N'')))), Address = LTRIM(RTRIM(ISNULL(@Address, N''))), IsActive = ISNULL(@IsActive, 1),
        UpdatedAt = DATEADD(MINUTE, 330, GETUTCDATE())
    WHERE TransporterId = @TransporterId;

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS Success, N'Transporter not found' AS Message, 0 AS TransporterId; RETURN;
    END

    COMMIT TRANSACTION;
    SELECT CAST(1 AS BIT) AS Success, N'Transporter saved' AS Message, @TransporterId AS TransporterId;
END
GO

SET NOEXEC OFF;
GO
