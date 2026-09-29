/* =============================================================================
   ProjectDB · Locations administration (Platform Admin screen > Locations)
   -----------------------------------------------------------------------------
   Locations belong to a project and live in the project's own DB. The login flow
   only reads the ACTIVE ones (sp_Project_GetLocations); the admin screen needs
   all of them and has to create / edit them.

   Run against each service-app DB. SAFE TO RE-RUN.
   ============================================================================= */

CREATE OR ALTER PROCEDURE dbo.sp_Location_GetAll
    @CompanyId INT,
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT l.LocationId, l.LocationName,
           ISNULL(l.LocationCode, '') AS LocationCode,
           ISNULL(l.Address, '')      AS Address,
           ISNULL(l.City, '')         AS City,
           l.IsActive, l.CreatedAt
    FROM dbo.Locations l
    WHERE l.CompanyId = @CompanyId AND l.ProjectId = @ProjectId
    ORDER BY l.LocationName;
END
GO

/* LocationId = 0 in the result means nothing was saved */
CREATE OR ALTER PROCEDURE dbo.sp_Location_Save
    @CompanyId    INT,
    @ProjectId    INT,
    @LocationId   INT,
    @LocationName NVARCHAR(200),
    @LocationCode NVARCHAR(50)  = NULL,
    @Address      NVARCHAR(400) = NULL,
    @City         NVARCHAR(100) = NULL,
    @IsActive     BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SET @LocationId   = ISNULL(@LocationId, 0);
    SET @LocationName = LTRIM(RTRIM(ISNULL(@LocationName, '')));
    SET @LocationCode = NULLIF(UPPER(LTRIM(RTRIM(ISNULL(@LocationCode, '')))), '');

    IF @LocationName = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Location name is required' AS Message, CAST(0 AS INT) AS LocationId; RETURN;
    END
    IF EXISTS (SELECT 1 FROM dbo.Locations
               WHERE CompanyId = @CompanyId AND ProjectId = @ProjectId AND LocationId <> @LocationId
                 AND (LocationName = @LocationName OR (@LocationCode IS NOT NULL AND LocationCode = @LocationCode)))
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'A location with this name or code already exists' AS Message, CAST(0 AS INT) AS LocationId; RETURN;
    END

    IF @LocationId = 0
    BEGIN
        INSERT INTO dbo.Locations (CompanyId, ProjectId, LocationName, LocationCode, Address, City, IsActive)
        VALUES (@CompanyId, @ProjectId, @LocationName, @LocationCode, @Address, @City, ISNULL(@IsActive, 1));

        SELECT CAST(1 AS INT) AS Success, 'Location created' AS Message, CAST(SCOPE_IDENTITY() AS INT) AS LocationId;
        RETURN;
    END

    /* the last active location cannot be switched off: nobody could enter the project */
    IF ISNULL(@IsActive, 1) = 0
       AND NOT EXISTS (SELECT 1 FROM dbo.Locations
                       WHERE CompanyId = @CompanyId AND ProjectId = @ProjectId
                         AND LocationId <> @LocationId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'A project needs at least one active location' AS Message, CAST(0 AS INT) AS LocationId; RETURN;
    END

    UPDATE dbo.Locations
    SET LocationName = @LocationName, LocationCode = @LocationCode,
        Address = @Address, City = @City, IsActive = ISNULL(@IsActive, 1)
    WHERE LocationId = @LocationId AND CompanyId = @CompanyId AND ProjectId = @ProjectId;

    IF @@ROWCOUNT = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Location not found' AS Message, CAST(0 AS INT) AS LocationId; RETURN;
    END

    SELECT CAST(1 AS INT) AS Success, 'Location updated' AS Message, @LocationId AS LocationId;
END
GO

PRINT 'ProjectDB location administration procs applied.';
GO
