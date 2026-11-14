/* =============================================================================
   MainDB · Company-level tenancy · 1 of 2 · SCHEMA (additive)
   -----------------------------------------------------------------------------
   One company = one tenant = one database. The connection of a tenant moves onto
   its Companies row; access to a module replaces access to a project.

   This script ONLY ADDS columns and tables and seeds the SERVICE module. The API
   deployed today ignores them, so it can be run ahead of the release.

   Select the SaaS main database in SSMS before running. There is no USE statement
   on purpose. SAFE TO RE-RUN.
   Next: 14_Company_Tenancy_Cutover.sql (during the release, API stopped).
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;   -- required by the filtered index below (error 1934 otherwise)
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
   OR OBJECT_ID('dbo.Companies') IS NULL
   OR OBJECT_ID('dbo.CompanyUsers') IS NULL
   OR OBJECT_ID('dbo.MenuItems') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database (the one with dbo.Companies) before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. Companies: the tenant's routing key and connection
   ----------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.Companies', 'TenantKey') IS NULL
    ALTER TABLE dbo.Companies ADD TenantKey NVARCHAR(50) NULL;          -- stable routing key (in the token)
IF COL_LENGTH('dbo.Companies', 'ServerName') IS NULL
    ALTER TABLE dbo.Companies ADD ServerName NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Companies', 'DatabaseName') IS NULL
    ALTER TABLE dbo.Companies ADD DatabaseName NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Companies', 'DbUser') IS NULL
    ALTER TABLE dbo.Companies ADD DbUser NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Companies', 'DbPasswordEnc') IS NULL
    ALTER TABLE dbo.Companies ADD DbPasswordEnc NVARCHAR(500) NULL;     -- ENCRYPTED (ITenantSecretProtector)
IF COL_LENGTH('dbo.Companies', 'ExtraOptions') IS NULL
    ALTER TABLE dbo.Companies ADD ExtraOptions NVARCHAR(400) NULL;
IF COL_LENGTH('dbo.Companies', 'TenantScopeId') IS NULL
    ALTER TABLE dbo.Companies ADD TenantScopeId INT NOT NULL
        CONSTRAINT DF_Companies_TenantScopeId DEFAULT (1);              -- value the tenant DB stores as ProjectId
IF COL_LENGTH('dbo.Companies', 'ProvisionStatus') IS NULL
    ALTER TABLE dbo.Companies ADD ProvisionStatus NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Companies_ProvisionStatus DEFAULT ('None');       -- None | Provisioning | Ready | Failed
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Companies_TenantKey' AND object_id = OBJECT_ID('dbo.Companies'))
    CREATE UNIQUE INDEX UX_Companies_TenantKey ON dbo.Companies(TenantKey) WHERE TenantKey IS NOT NULL;
GO

/* -----------------------------------------------------------------------------
   2. Modules: the catalogue everyone sees
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Modules') IS NULL
CREATE TABLE dbo.Modules
(
    ModuleId    INT IDENTITY(1,1) PRIMARY KEY,
    ModuleKey   NVARCHAR(50)  NOT NULL,
    ModuleName  NVARCHAR(150) NOT NULL,
    Description NVARCHAR(400) NULL,
    Icon        NVARCHAR(100) NULL,
    SortOrder   INT NOT NULL CONSTRAINT DF_Modules_Sort     DEFAULT (0),
    IsActive    BIT NOT NULL CONSTRAINT DF_Modules_IsActive DEFAULT (1),
    CONSTRAINT UQ_Modules_Key UNIQUE (ModuleKey)
);
GO

/* -----------------------------------------------------------------------------
   3. CompanyModules: which modules a company has (its subscription)
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.CompanyModules') IS NULL
CREATE TABLE dbo.CompanyModules
(
    CompanyModuleId INT IDENTITY(1,1) PRIMARY KEY,
    CompanyId INT NOT NULL REFERENCES dbo.Companies(CompanyId),
    ModuleId  INT NOT NULL REFERENCES dbo.Modules(ModuleId),
    IsEnabled BIT NOT NULL CONSTRAINT DF_CM_IsEnabled DEFAULT (1),
    UpdatedAt DATETIME NOT NULL CONSTRAINT DF_CM_UpdatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_CM_Company_Module UNIQUE (CompanyId, ModuleId)
);
GO

/* -----------------------------------------------------------------------------
   4. UserModuleAccess: which modules a member may open in a company.
      A row means "granted". Admin / CompanyAdmin need no row (see fn_ModuleUsers).
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.UserModuleAccess') IS NULL
CREATE TABLE dbo.UserModuleAccess
(
    UserModuleAccessId INT IDENTITY(1,1) PRIMARY KEY,
    CompanyId INT NOT NULL REFERENCES dbo.Companies(CompanyId),
    UserId    INT NOT NULL REFERENCES dbo.Users(UserId),
    ModuleId  INT NOT NULL REFERENCES dbo.Modules(ModuleId),
    GrantedBy INT NULL REFERENCES dbo.Users(UserId),
    GrantedAt DATETIME NOT NULL CONSTRAINT DF_UMA_GrantedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_UMA_Company_User_Module UNIQUE (CompanyId, UserId, ModuleId)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UMA_User' AND object_id = OBJECT_ID('dbo.UserModuleAccess'))
    CREATE INDEX IX_UMA_User ON dbo.UserModuleAccess(UserId);
GO

/* -----------------------------------------------------------------------------
   5. MenuItems: the module a menu belongs to.
      (MenuItems.Module already exists: it is the sidebar GROUP name, left as is.)
   ----------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.MenuItems', 'AppModuleId') IS NULL
    ALTER TABLE dbo.MenuItems ADD AppModuleId INT NULL
        CONSTRAINT FK_MenuItems_Modules REFERENCES dbo.Modules(ModuleId);
GO

/* -----------------------------------------------------------------------------
   6. Seed: the Service module; every existing menu belongs to it
   ----------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE ModuleKey = 'SERVICE')
    INSERT INTO dbo.Modules (ModuleKey, ModuleName, Description, Icon, SortOrder)
    VALUES ('SERVICE', 'Service Management',
            'Complaints, technicians, scheduling, spare parts, warranty and sales orders.',
            'build', 1);
GO

UPDATE dbo.MenuItems
SET AppModuleId = (SELECT ModuleId FROM dbo.Modules WHERE ModuleKey = 'SERVICE')
WHERE AppModuleId IS NULL;
GO

PRINT 'Company tenancy schema is in place. Run 14_Company_Tenancy_Cutover.sql during the release.';
GO
SET NOEXEC OFF;
GO
