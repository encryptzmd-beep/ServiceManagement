/* =============================================================================
   MainDB  ·  Seed data  (per-project routing)
   -----------------------------------------------------------------------------
   Exercises the flow end to end:
     - core Roles
     - one demo Company 'C001'
     - one Project 'C001-P001' with its own DB registered in ProjectConnections
     - grants the admin user access to that project (UserProjectAccess)

   NOTE: DbPasswordEnc is a PLACEHOLDER. The API writes it via
   ITenantSecretProtector.Protect(...). Replace <ENCRYPTED_PW> or insert through
   the onboarding API. Locations live in the PROJECT's DB, not here.
   ============================================================================= */


/* --- Roles ---------------------------------------------------------------- */
MERGE dbo.Roles AS t
USING (VALUES ('Admin','Full access'),
              ('CompanyAdmin','Company administrator'),
              ('Manager','Manager'),
              ('Technician','Field technician'),
              ('Storekeeper','Store / inventory')) AS s(RoleName, Description)
    ON t.RoleName = s.RoleName
WHEN NOT MATCHED THEN INSERT (RoleName, Description) VALUES (s.RoleName, s.Description);
GO

/* --- Demo company --------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyCode = 'C001')
    INSERT INTO dbo.Companies (CompanyName, CompanyCode, City)
    VALUES ('Felix Fitness (Demo)', 'C001', 'Chennai');
GO

DECLARE @CompanyId INT = (SELECT CompanyId FROM dbo.Companies WHERE CompanyCode = 'C001');

/* --- Project (its own DB, routed by ProjectKey) --------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.Projects WHERE ProjectKey = 'C001-P001')
    INSERT INTO dbo.Projects (CompanyId, ProjectName, ProjectKey)
    VALUES (@CompanyId, 'Default Project', 'C001-P001');

DECLARE @ProjectId INT = (SELECT ProjectId FROM dbo.Projects WHERE ProjectKey = 'C001-P001');

/* --- Registry row: project -> its DB -------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.ProjectConnections WHERE ProjectKey = 'C001-P001')
    INSERT INTO dbo.ProjectConnections
        (ProjectId, ProjectKey, ServerName, DatabaseName, DbUser, DbPasswordEnc, ExtraOptions)
    VALUES
        (@ProjectId, 'C001-P001', '72.60.206.241', 'FelixServiceDB', 'sa',
         '<ENCRYPTED_PW>',
         'TrustServerCertificate=True;MultipleActiveResultSets=True');

/* --- Grant the first user access to the project --------------------------- */
DECLARE @UserId INT = (SELECT TOP 1 UserId FROM dbo.Users ORDER BY UserId);
IF @UserId IS NOT NULL AND NOT EXISTS
   (SELECT 1 FROM dbo.UserProjectAccess WHERE UserId = @UserId AND ProjectId = @ProjectId)
    INSERT INTO dbo.UserProjectAccess (UserId, ProjectId) VALUES (@UserId, @ProjectId);
GO

PRINT 'MainDB seed applied. Set ProjectConnections.DbPasswordEnc via the API.';
GO
