/* =============================================================================
   ProjectDB · Locations (belong to a project inside this service-app DB)
   -----------------------------------------------------------------------------
   A service-app DB may be DEDICATED to one project OR SHARED (an existing client
   DB reused for several companies/projects — routed centrally from MainDB). So
   Locations carry CompanyId + ProjectId and are always filtered by them.

   Access is controlled at the PROJECT level in MainDB (UserProjectAccess).
   Locations are NOT access-controlled per user: any user with project access
   sees ALL of that project's locations and picks one.
   Run inside each service-app database.
   ============================================================================= */

/* --- Locations (scoped by CompanyId + ProjectId for shared/existing DBs) --- */
IF OBJECT_ID('dbo.Locations') IS NULL
CREATE TABLE dbo.Locations
(
    LocationId    INT IDENTITY(1,1) PRIMARY KEY,
    CompanyId     INT NOT NULL,                  -- owning company (MainDB.Companies.CompanyId)
    ProjectId     INT NOT NULL,                  -- owning project (MainDB.Projects.ProjectId)
    LocationName  NVARCHAR(200) NOT NULL,
    LocationCode  NVARCHAR(50)  NULL,
    Address       NVARCHAR(400) NULL,
    City          NVARCHAR(100) NULL,
    IsActive      BIT NOT NULL CONSTRAINT DF_Loc_IsActive DEFAULT (1),
    CreatedAt     DATETIME NOT NULL CONSTRAINT DF_Loc_CreatedAt DEFAULT (GETDATE())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Locations_Scope' AND object_id = OBJECT_ID('dbo.Locations'))
    CREATE INDEX IX_Locations_Scope ON dbo.Locations(CompanyId, ProjectId);
GO

/* -----------------------------------------------------------------------------
   sp_Project_GetLocations
   ALL active locations for the given company + project (drives the picker).
   No user filter — project access already gates entry.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Project_GetLocations
    @CompanyId INT,
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT l.LocationId, l.LocationName, l.LocationCode, l.City
    FROM dbo.Locations l
    WHERE l.CompanyId = @CompanyId
      AND l.ProjectId = @ProjectId
      AND l.IsActive = 1
    ORDER BY l.LocationName;
END
GO

/* -----------------------------------------------------------------------------
   sp_Location_Validate
   Returns 1 row if the location belongs to this company+project and is active.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Location_Validate
    @CompanyId  INT,
    @ProjectId  INT,
    @LocationId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 l.LocationId, l.LocationName
    FROM dbo.Locations l
    WHERE l.LocationId = @LocationId
      AND l.CompanyId  = @CompanyId
      AND l.ProjectId  = @ProjectId
      AND l.IsActive = 1;
END
GO

PRINT 'ProjectDB locations created (scoped by CompanyId + ProjectId).';
GO
