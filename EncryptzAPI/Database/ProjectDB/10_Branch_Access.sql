/* =============================================================================
   ProjectDB (company database) · Branch access
   -----------------------------------------------------------------------------
   Which branches (dbo.Locations) a member of the company may work in.

   Run in EACH company database (select it in SSMS first; no USE on purpose).
   New company databases created by the API get this script automatically.
   ADDITIVE and SAFE TO RE-RUN: it adds two tables and five procedures and
   changes no existing table, procedure or row. The API deployed before it and
   the API deployed after it both work with or without it.

     dbo.UserLocationAccess      MainUserId + LocationId: the member may work there
     dbo.UserLocationAccessInit  MainUserId: this member's branches were set once

   A member is identified by the MAIN user id (MainDB.dbo.Users.UserId, which is
   dbo.Users.MainUserId here). Company administrators have every branch: the API
   says so with @IsAdmin and ignores any rows stored for them.

   First branches: a member who has no "set once" mark gets every ACTIVE branch
   and the mark. This happens here for the members that exist now, and later the
   first time a member's branches are asked for. After that only an
   administrator changes them: a branch created later is given to nobody
   automatically, and a member whose last branch was removed stays without one.
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
ELSE IF OBJECT_ID('dbo.Companies') IS NOT NULL AND OBJECT_ID('dbo.CompanyUsers') IS NOT NULL AND OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is the SaaS main database. Select a company database.';
ELSE IF OBJECT_ID('dbo.Locations') IS NULL OR OBJECT_ID('dbo.Users') IS NULL OR COL_LENGTH('dbo.Users', 'MainUserId') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database with the user mirror (dbo.Locations, dbo.Users.MainUserId). Run the earlier ProjectDB scripts first.';

IF @problem IS NOT NULL
BEGIN
    RAISERROR('%s', 16, 1, @problem);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. Tables
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.UserLocationAccess') IS NULL
CREATE TABLE dbo.UserLocationAccess
(
    MainUserId INT NOT NULL,                                  -- MainDB.dbo.Users.UserId
    LocationId INT NOT NULL,
    GrantedBy  INT NULL,                                      -- main user id of the administrator; NULL = first branches
    GrantedAt  DATETIME NOT NULL CONSTRAINT DF_ULA_GrantedAt DEFAULT (GETDATE()),
    CONSTRAINT PK_UserLocationAccess PRIMARY KEY (MainUserId, LocationId)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ULA_Location' AND object_id = OBJECT_ID('dbo.UserLocationAccess'))
    CREATE INDEX IX_ULA_Location ON dbo.UserLocationAccess(LocationId);
GO

IF OBJECT_ID('dbo.UserLocationAccessInit') IS NULL
CREATE TABLE dbo.UserLocationAccessInit
(
    MainUserId    INT NOT NULL CONSTRAINT PK_UserLocationAccessInit PRIMARY KEY,
    InitializedAt DATETIME NOT NULL CONSTRAINT DF_ULAI_At DEFAULT (GETDATE())
);
GO

/* -----------------------------------------------------------------------------
   2. First branches of members (once per member)
   ----------------------------------------------------------------------------- */

/* @MainUserIdsJson: a JSON array of main user ids, e.g. [12,15].
   Each member without the "set once" mark gets every active branch of the
   company and the mark. Two calls at the same moment wait for each other. */
CREATE OR ALTER PROCEDURE dbo.sp_Branch_EnsureInitialised
    @CompanyId       INT,
    @ProjectId       INT,
    @MainUserIdsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @new TABLE (MainUserId INT PRIMARY KEY);

    BEGIN TRANSACTION;

    INSERT INTO @new (MainUserId)
    SELECT DISTINCT j.MainUserId
    FROM (SELECT TRY_CAST([value] AS INT) AS MainUserId FROM OPENJSON(ISNULL(@MainUserIdsJson, '[]'))) j
    WHERE j.MainUserId > 0
      AND NOT EXISTS (SELECT 1 FROM dbo.UserLocationAccessInit i WITH (UPDLOCK, HOLDLOCK)
                      WHERE i.MainUserId = j.MainUserId);

    /* no active branch yet: nothing to give, and no mark, so the member gets
       their first branches when one exists */
    IF EXISTS (SELECT 1 FROM @new)
       AND EXISTS (SELECT 1 FROM dbo.Locations
                   WHERE CompanyId = @CompanyId AND ProjectId = @ProjectId AND IsActive = 1)
    BEGIN
        INSERT INTO dbo.UserLocationAccess (MainUserId, LocationId)
        SELECT n.MainUserId, l.LocationId
        FROM @new n
        CROSS JOIN dbo.Locations l
        WHERE l.CompanyId = @CompanyId AND l.ProjectId = @ProjectId AND l.IsActive = 1
          AND NOT EXISTS (SELECT 1 FROM dbo.UserLocationAccess x
                          WHERE x.MainUserId = n.MainUserId AND x.LocationId = l.LocationId);

        INSERT INTO dbo.UserLocationAccessInit (MainUserId)
        SELECT n.MainUserId FROM @new n;
    END

    COMMIT TRANSACTION;
END
GO

/* -----------------------------------------------------------------------------
   3. What the login flow asks
   ----------------------------------------------------------------------------- */

/* The active branches this member may work in (every active branch for an
   administrator). Same columns as sp_Project_GetLocations. */
CREATE OR ALTER PROCEDURE dbo.sp_Branch_GetForUser
    @CompanyId  INT,
    @ProjectId  INT,
    @MainUserId INT,
    @IsAdmin    BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(@IsAdmin, 0) = 0
    BEGIN
        DECLARE @one NVARCHAR(40) = N'[' + CAST(ISNULL(@MainUserId, 0) AS NVARCHAR(20)) + N']';
        EXEC dbo.sp_Branch_EnsureInitialised @CompanyId = @CompanyId, @ProjectId = @ProjectId, @MainUserIdsJson = @one;
    END

    SELECT l.LocationId, l.LocationName, l.LocationCode, l.City
    FROM dbo.Locations l
    WHERE l.CompanyId = @CompanyId
      AND l.ProjectId = @ProjectId
      AND l.IsActive = 1
      AND (   ISNULL(@IsAdmin, 0) = 1
           OR EXISTS (SELECT 1 FROM dbo.UserLocationAccess a
                      WHERE a.MainUserId = @MainUserId AND a.LocationId = l.LocationId))
    ORDER BY l.LocationName;
END
GO

/* One row when the branch belongs to the company and is active; HasAccess tells
   whether this member may work there. No row = no such branch. */
CREATE OR ALTER PROCEDURE dbo.sp_Branch_ValidateForUser
    @CompanyId  INT,
    @ProjectId  INT,
    @LocationId INT,
    @MainUserId INT,
    @IsAdmin    BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(@IsAdmin, 0) = 0
    BEGIN
        DECLARE @one NVARCHAR(40) = N'[' + CAST(ISNULL(@MainUserId, 0) AS NVARCHAR(20)) + N']';
        EXEC dbo.sp_Branch_EnsureInitialised @CompanyId = @CompanyId, @ProjectId = @ProjectId, @MainUserIdsJson = @one;
    END

    SELECT TOP 1 l.LocationId, l.LocationName,
           CAST(CASE WHEN ISNULL(@IsAdmin, 0) = 1
                       OR EXISTS (SELECT 1 FROM dbo.UserLocationAccess a
                                  WHERE a.MainUserId = @MainUserId AND a.LocationId = l.LocationId)
                     THEN 1 ELSE 0 END AS BIT) AS HasAccess
    FROM dbo.Locations l
    WHERE l.LocationId = @LocationId
      AND l.CompanyId  = @CompanyId
      AND l.ProjectId  = @ProjectId
      AND l.IsActive = 1;
END
GO

/* -----------------------------------------------------------------------------
   4. What the administration screen asks
   ----------------------------------------------------------------------------- */

/* Every stored grant for the branches of the company. */
CREATE OR ALTER PROCEDURE dbo.sp_Branch_GetAccess
    @CompanyId INT,
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT a.MainUserId, a.LocationId
    FROM dbo.UserLocationAccess a
    INNER JOIN dbo.Locations l ON l.LocationId = a.LocationId
    WHERE l.CompanyId = @CompanyId AND l.ProjectId = @ProjectId
    ORDER BY a.MainUserId, a.LocationId;
END
GO

/* Give / take one branch of one member. The member's first branches are set
   first (once), so what the administrator saw on the screen is what changes. */
CREATE OR ALTER PROCEDURE dbo.sp_Branch_SetAccess
    @CompanyId  INT,
    @ProjectId  INT,
    @MainUserId INT,
    @LocationId INT,
    @HasAccess  BIT,
    @GrantedBy  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(@MainUserId, 0) <= 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'User not found' AS Message; RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Locations
                   WHERE LocationId = @LocationId AND CompanyId = @CompanyId AND ProjectId = @ProjectId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Branch not found' AS Message; RETURN;
    END

    DECLARE @one NVARCHAR(40) = N'[' + CAST(@MainUserId AS NVARCHAR(20)) + N']';
    EXEC dbo.sp_Branch_EnsureInitialised @CompanyId = @CompanyId, @ProjectId = @ProjectId, @MainUserIdsJson = @one;

    IF ISNULL(@HasAccess, 0) = 1
        INSERT INTO dbo.UserLocationAccess (MainUserId, LocationId, GrantedBy)
        SELECT @MainUserId, @LocationId, @GrantedBy
        WHERE NOT EXISTS (SELECT 1 FROM dbo.UserLocationAccess WITH (UPDLOCK, HOLDLOCK)
                          WHERE MainUserId = @MainUserId AND LocationId = @LocationId);
    ELSE
        DELETE FROM dbo.UserLocationAccess
        WHERE MainUserId = @MainUserId AND LocationId = @LocationId;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN ISNULL(@HasAccess, 0) = 1 THEN 'Branch access granted' ELSE 'Branch access removed' END AS Message;
END
GO

/* -----------------------------------------------------------------------------
   5. The members that exist now keep every active branch (once)
   ----------------------------------------------------------------------------- */
BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @existing TABLE (MainUserId INT PRIMARY KEY);

    INSERT INTO @existing (MainUserId)
    SELECT DISTINCT u.MainUserId
    FROM dbo.Users u
    WHERE u.MainUserId IS NOT NULL AND u.MainUserId > 0
      AND NOT EXISTS (SELECT 1 FROM dbo.UserLocationAccessInit i WITH (UPDLOCK, HOLDLOCK)
                      WHERE i.MainUserId = u.MainUserId);

    INSERT INTO dbo.UserLocationAccess (MainUserId, LocationId)
    SELECT e.MainUserId, l.LocationId
    FROM @existing e
    CROSS JOIN dbo.Locations l
    WHERE l.IsActive = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.UserLocationAccess x
                      WHERE x.MainUserId = e.MainUserId AND x.LocationId = l.LocationId);

    INSERT INTO dbo.UserLocationAccessInit (MainUserId)
    SELECT e.MainUserId FROM @existing e;

    DECLARE @members INT = (SELECT COUNT(*) FROM @existing);
    COMMIT TRANSACTION;

    PRINT 'Branch access is in place. Members given every active branch now: ' + CAST(@members AS VARCHAR(12)) + '.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @error NVARCHAR(2048) = ERROR_MESSAGE();
    RAISERROR('Giving the existing members their branches failed and was rolled back. %s', 16, 1, @error);
END CATCH
GO

SET NOEXEC OFF;
GO
