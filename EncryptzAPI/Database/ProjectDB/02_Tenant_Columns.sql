/* =============================================================================
   ProjectDB · Add MANDATORY scope columns to every business table
   -----------------------------------------------------------------------------
   Because a service-app DB may be SHARED (an existing client DB reused for
   several companies/projects), EVERY business table MUST carry CompanyId +
   ProjectId + LocationId, and every proc must filter by them. Run this against
   each service-app DB — new or existing — to add the columns idempotently.

   CompanyId  = MainDB.Companies.CompanyId (MANDATORY).
   ProjectId  = MainDB.Projects.ProjectId.
   LocationId = ProjectDB.Locations.LocationId (MANDATORY row scope).

   Extend @tables with the real business table list for the target DB.
   ============================================================================= */

DECLARE @tables TABLE (Name SYSNAME);
INSERT INTO @tables (Name) VALUES
    ('Customers'), ('Complaints'), ('Products'), ('SpareParts'), ('Schedules'),
    ('Technicians'), ('Payments'), ('WarrantyReturns'), ('RepairParts'), ('Tracking');
    -- >>> add every remaining business table here <<<

DECLARE @t SYSNAME, @sql NVARCHAR(MAX);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT Name FROM @tables;
OPEN cur; FETCH NEXT FROM cur INTO @t;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID('dbo.' + @t) IS NOT NULL
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
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_' + @t + '_Scope' AND object_id = OBJECT_ID('dbo.' + @t))
        BEGIN
            SET @sql = 'CREATE INDEX IX_' + @t + '_Scope ON dbo.' + QUOTENAME(@t) + '(CompanyId, ProjectId, LocationId);';
            EXEC sp_executesql @sql;
        END
        PRINT 'Scope columns ensured on dbo.' + @t;
    END
    ELSE PRINT 'SKIP (not found): dbo.' + @t;

    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;
GO
