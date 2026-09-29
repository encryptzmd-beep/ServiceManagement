/* =============================================================================
   ProjectDB · Scope filtering for EVERY business proc (row-level security)
   -----------------------------------------------------------------------------
   The business procs of an existing service DB do not take / filter by
   @CompanyId, @ProjectId, @LocationId. Instead of rewriting each of them, the
   database itself filters the rows:

     - the API publishes the caller's scope in SESSION_CONTEXT on every tenant
       connection (DbHelper -> TenantSessionContext),
     - 04_MainDb_User_Sync.sql makes the scope column DEFAULTs read it (writes),
     - this script adds a SECURITY POLICY that filters every read/update/delete
       by it (reads).

   Filter columns: ProjectId (+ LocationId). CompanyId is implied by the project;
   some legacy tables already had their own CompanyId meaning, so it is not used
   as a filter.

     PROJECT-wide tables   : visible in every location of the project
                             (users, technicians, customers, products, masters,
                              settings, lookups)
     LOCATION-scoped tables: visible only in the location the user picked
                             (complaints and everything hanging off them,
                              schedules, attendance, tracking, payments, ...)

   A connection WITHOUT a scope in SESSION_CONTEXT (SSMS, the user sync, location
   lookup during login) is not filtered.

   SWITCH OFF (no data is changed by the policy):
       ALTER SECURITY POLICY Security.TenantScopePolicy WITH (STATE = OFF);

   Run AFTER 04_MainDb_User_Sync.sql. SAFE TO RE-RUN.
   ============================================================================= */

/* =============================================================================
   0. Settings — review before running
   ============================================================================= */
DECLARE @DefaultCompanyId  INT = 1;   -- MainDB.Companies.CompanyId of the rows stamped 0
DECLARE @DefaultProjectId  INT = 1;   -- MainDB.Projects.ProjectId  of the rows stamped 0
DECLARE @DefaultLocationId INT = ISNULL((SELECT TOP 1 LocationId FROM dbo.Locations
                                         WHERE ProjectId = @DefaultProjectId AND IsActive = 1
                                         ORDER BY LocationId), 1);

/* =============================================================================
   1. The policy must be dropped before its tables/functions can be changed
   ============================================================================= */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantScopePolicy')
    DROP SECURITY POLICY Security.TenantScopePolicy;

/* =============================================================================
   2. Backfill rows written with scope 0 (created after the table migration by
      procs that did not stamp the scope). They would be invisible otherwise.
   ============================================================================= */
DECLARE @t SYSNAME, @sql NVARCHAR(MAX);
DECLARE cur CURSOR LOCAL STATIC FOR
    SELECT t.name
    FROM sys.tables t
    WHERE t.is_ms_shipped = 0 AND SCHEMA_NAME(t.schema_id) = 'dbo'
      AND t.name NOT IN ('Locations', 'sysdiagrams',
                         -- master rows stamped 0 are SHARED by every project of this DB
                         'Roles', 'RoleMenuAccess', 'MenuItems', 'ComplaintStatuses',
                         'SystemSettings', 'AppConfigurations')
      AND COL_LENGTH('dbo.' + t.name, 'ProjectId')  IS NOT NULL
      AND COL_LENGTH('dbo.' + t.name, 'LocationId') IS NOT NULL;

OPEN cur; FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = 'UPDATE dbo.' + QUOTENAME(@t) +
               ' SET ProjectId  = CASE WHEN ISNULL(ProjectId, 0)  = 0 THEN @p ELSE ProjectId END,' +
               '     LocationId = CASE WHEN ISNULL(LocationId, 0) = 0 THEN @l ELSE LocationId END' +
               CASE WHEN COL_LENGTH('dbo.' + @t, 'CompanyId') IS NOT NULL
                     AND COLUMNPROPERTY(OBJECT_ID('dbo.' + @t), 'CompanyId', 'IsIdentity') = 0   -- not a table's own key
                    THEN ', CompanyId = CASE WHEN ISNULL(CompanyId, 0) = 0 THEN @c ELSE CompanyId END' ELSE '' END +
               ' WHERE ISNULL(ProjectId, 0) = 0 OR ISNULL(LocationId, 0) = 0;';
    EXEC sp_executesql @sql, N'@c INT, @p INT, @l INT',
         @c = @DefaultCompanyId, @p = @DefaultProjectId, @l = @DefaultLocationId;

    IF @@ROWCOUNT > 0 PRINT 'Backfilled scope 0 rows: dbo.' + @t;
    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;
GO

/* =============================================================================
   3. Predicate functions
   ============================================================================= */
IF SCHEMA_ID('Security') IS NULL
    EXEC ('CREATE SCHEMA Security');
GO

CREATE OR ALTER FUNCTION Security.fn_ProjectScope (@ProjectId INT)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
    SELECT 1 AS Allowed
    WHERE SESSION_CONTEXT(N'ProjectId') IS NULL
       OR CONVERT(INT, SESSION_CONTEXT(N'ProjectId')) = 0
       OR @ProjectId = 0                                  -- shared master row (menus, roles, lookups)
       OR @ProjectId = CONVERT(INT, SESSION_CONTEXT(N'ProjectId'));
GO

CREATE OR ALTER FUNCTION Security.fn_LocationScope (@ProjectId INT, @LocationId INT)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
    SELECT 1 AS Allowed
    WHERE SESSION_CONTEXT(N'ProjectId') IS NULL
       OR CONVERT(INT, SESSION_CONTEXT(N'ProjectId')) = 0
       OR (
              @ProjectId = CONVERT(INT, SESSION_CONTEXT(N'ProjectId'))
          AND (
                  ISNULL(CONVERT(INT, SESSION_CONTEXT(N'LocationId')), 0) = 0   -- no location picked: whole project
               OR @LocationId = CONVERT(INT, SESSION_CONTEXT(N'LocationId'))
              )
          );
GO

/* =============================================================================
   4. The policy
   ============================================================================= */
DECLARE @projectWide TABLE (Name SYSNAME);
INSERT INTO @projectWide (Name) VALUES
    ('Users'), ('Roles'), ('RoleMenuAccess'), ('MenuItems'),
    ('Technicians'), ('TechnicianProfiles'),
    ('Customers'), ('Products'), ('ProductImages'), ('ProductMaster'), ('SpareParts'),
    ('ComplaintStatuses'), ('SystemSettings'), ('AppConfigurations'), ('UPIConfigurations');

/* Not filtered: legacy control-plane tables (now owned by MainDB) and logs */
DECLARE @unfiltered TABLE (Name SYSNAME);
INSERT INTO @unfiltered (Name) VALUES
    ('Locations'), ('sysdiagrams'),
    ('Companies'), ('CompanyUsers'), ('CompanyInvitations'), ('CompanyJoinRequests'),
    ('UserSessions'), ('OtpLog'), ('EmailOtpLog');

DECLARE @predicates NVARCHAR(MAX);

SELECT @predicates = STRING_AGG(CAST(
       CASE WHEN pw.Name IS NOT NULL
            THEN N'    ADD FILTER PREDICATE Security.fn_ProjectScope(ProjectId) ON dbo.' + QUOTENAME(t.name)
            ELSE N'    ADD FILTER PREDICATE Security.fn_LocationScope(ProjectId, LocationId) ON dbo.' + QUOTENAME(t.name)
       END AS NVARCHAR(MAX)), N',' + CHAR(13) + CHAR(10)) WITHIN GROUP (ORDER BY t.name)
FROM sys.tables t
LEFT JOIN @projectWide pw ON pw.Name = t.name
WHERE t.is_ms_shipped = 0 AND SCHEMA_NAME(t.schema_id) = 'dbo'
  AND t.name NOT IN (SELECT Name FROM @unfiltered)
  AND COL_LENGTH('dbo.' + t.name, 'ProjectId')  IS NOT NULL
  AND COL_LENGTH('dbo.' + t.name, 'LocationId') IS NOT NULL;

IF ISNULL(@predicates, N'') <> N''
BEGIN
    DECLARE @policy NVARCHAR(MAX) =
        N'CREATE SECURITY POLICY Security.TenantScopePolicy' + CHAR(13) + CHAR(10) +
        @predicates + CHAR(13) + CHAR(10) +
        N'WITH (STATE = ON, SCHEMABINDING = ON);';

    PRINT @policy;
    EXEC sp_executesql @policy;
END
GO

PRINT 'Scope row filter applied. Switch off with: ALTER SECURITY POLICY Security.TenantScopePolicy WITH (STATE = OFF);';
GO
