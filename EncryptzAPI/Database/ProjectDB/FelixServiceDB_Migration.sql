/* =============================================================================
   FelixServiceDB  ·  Convert an EXISTING service DB to the multi-tenant structure
   -----------------------------------------------------------------------------
   Single, idempotent migration for the existing FelixServiceDB (or any service-app
   DB you want to reuse). Run it against that database.

   It does the TABLE side of the new structure automatically:
     1. Creates the Locations table (scoped by CompanyId + ProjectId) + its procs.
     2. Adds MANDATORY CompanyId + ProjectId + LocationId columns to EVERY business
        table + a scope index — driven dynamically over sys.tables, so it covers
        all tables without listing them.
     3. Backfills those columns for the first client/project (see @DefaultCompanyId
        / @DefaultProjectId / @DefaultLocationId below) so existing rows aren't 0.

   It CANNOT rewrite your existing stored procedures (their bodies live only in the
   DB). After running this, each business proc still needs @CompanyId/@ProjectId/
   @LocationId added + filtered — use the pattern in 03_Proc_Pattern.sql. Section 4
   below emits a checklist of every proc that must be updated.

   SAFE TO RE-RUN. Review @exclude and the @Default* backfill values first.
   ============================================================================= */

USE FelixServiceDB;   -- change if your DB name differs
GO

/* =============================================================================
   0. Settings — review before running
   ============================================================================= */
DECLARE @DefaultCompanyId  INT = 1;   -- MainDB.Companies.CompanyId this DB belongs to
DECLARE @DefaultProjectId  INT = 1;   -- MainDB.Projects.ProjectId  this DB belongs to
DECLARE @DefaultLocationId INT = 1;   -- default location for existing rows

/* =============================================================================
   1. Locations (scoped by CompanyId + ProjectId — shared-DB safe)
   ============================================================================= */
IF OBJECT_ID('dbo.Locations') IS NULL
BEGIN
    CREATE TABLE dbo.Locations
    (
        LocationId    INT IDENTITY(1,1) PRIMARY KEY,
        CompanyId     INT NOT NULL,
        ProjectId     INT NOT NULL,
        LocationName  NVARCHAR(200) NOT NULL,
        LocationCode  NVARCHAR(50)  NULL,
        Address       NVARCHAR(400) NULL,
        City          NVARCHAR(100) NULL,
        IsActive      BIT NOT NULL CONSTRAINT DF_Loc_IsActive DEFAULT (1),
        CreatedAt     DATETIME NOT NULL CONSTRAINT DF_Loc_CreatedAt DEFAULT (GETDATE())
    );
    CREATE INDEX IX_Locations_Scope ON dbo.Locations(CompanyId, ProjectId);
END
GO

/* Seed one default location if none exist (so existing data has a home) */
DECLARE @DefaultCompanyId INT = 1, @DefaultProjectId INT = 1;
IF NOT EXISTS (SELECT 1 FROM dbo.Locations)
    INSERT INTO dbo.Locations (CompanyId, ProjectId, LocationName, LocationCode, City)
    VALUES (@DefaultCompanyId, @DefaultProjectId, 'Head Office', 'HO', NULL);
GO

/* =============================================================================
   2. Location procs
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Project_GetLocations
    @CompanyId INT, @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT l.LocationId, l.LocationName, l.LocationCode, l.City
    FROM dbo.Locations l
    WHERE l.CompanyId = @CompanyId AND l.ProjectId = @ProjectId AND l.IsActive = 1
    ORDER BY l.LocationName;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Location_Validate
    @CompanyId INT, @ProjectId INT, @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 l.LocationId, l.LocationName
    FROM dbo.Locations l
    WHERE l.LocationId = @LocationId AND l.CompanyId = @CompanyId
      AND l.ProjectId = @ProjectId AND l.IsActive = 1;
END
GO

/* =============================================================================
   3. Add CompanyId + ProjectId + LocationId to EVERY business table + backfill
   ============================================================================= */
DECLARE @DefaultCompanyId  INT = 1;
DECLARE @DefaultProjectId  INT = 1;
DECLARE @DefaultLocationId INT = 1;

/* Tables to skip (add reference/master/global tables you do NOT want scoped) */
DECLARE @exclude TABLE (Name SYSNAME);
INSERT INTO @exclude (Name) VALUES ('Locations'), ('sysdiagrams');

DECLARE @t SYSNAME, @sql NVARCHAR(MAX);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT t.name
    FROM sys.tables t
    WHERE t.is_ms_shipped = 0
      AND t.name NOT IN (SELECT Name FROM @exclude);

OPEN cur; FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH('dbo.' + @t, 'CompanyId') IS NULL
    BEGIN
        SET @sql = 'ALTER TABLE dbo.' + QUOTENAME(@t) + ' ADD CompanyId INT NOT NULL CONSTRAINT DF_' + @t + '_CompanyId DEFAULT(0);';
        EXEC sp_executesql @sql;
    END
    IF COL_LENGTH('dbo.' + @t, 'ProjectId') IS NULL
    BEGIN
        SET @sql = 'ALTER TABLE dbo.' + QUOTENAME(@t) + ' ADD ProjectId INT NOT NULL CONSTRAINT DF_' + @t + '_ProjectId DEFAULT(0);';
        EXEC sp_executesql @sql;
    END
    IF COL_LENGTH('dbo.' + @t, 'LocationId') IS NULL
    BEGIN
        SET @sql = 'ALTER TABLE dbo.' + QUOTENAME(@t) + ' ADD LocationId INT NOT NULL CONSTRAINT DF_' + @t + '_LocationId DEFAULT(0);';
        EXEC sp_executesql @sql;
    END

    /* Backfill existing rows that are still 0 */
    SET @sql = 'UPDATE dbo.' + QUOTENAME(@t) +
               ' SET CompanyId = CASE WHEN CompanyId = 0 THEN @c ELSE CompanyId END,' +
               '     ProjectId = CASE WHEN ProjectId = 0 THEN @p ELSE ProjectId END,' +
               '     LocationId = CASE WHEN LocationId = 0 THEN @l ELSE LocationId END' +
               ' WHERE CompanyId = 0 OR ProjectId = 0 OR LocationId = 0;';
    EXEC sp_executesql @sql,
         N'@c INT, @p INT, @l INT',
         @c = @DefaultCompanyId, @p = @DefaultProjectId, @l = @DefaultLocationId;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_' + @t + '_Scope' AND object_id = OBJECT_ID('dbo.' + @t))
    BEGIN
        SET @sql = 'CREATE INDEX IX_' + @t + '_Scope ON dbo.' + QUOTENAME(@t) + '(CompanyId, ProjectId, LocationId);';
        EXEC sp_executesql @sql;
    END

    PRINT 'Scoped: dbo.' + @t;
    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;
GO

/* =============================================================================
   4. Checklist — every stored proc that still needs @CompanyId/@ProjectId/
      @LocationId added + filtered (apply the 03_Proc_Pattern.sql shape to each).
   ============================================================================= */
SELECT p.name AS ProcNeedsScoping
FROM sys.procedures p
WHERE p.is_ms_shipped = 0
  AND p.name NOT IN ('sp_Project_GetLocations', 'sp_Location_Validate')
ORDER BY p.name;
GO

PRINT 'FelixServiceDB table migration complete. Now update the stored procs listed above.';
GO
