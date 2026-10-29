/* =============================================================================
   MainDB · 26 · Platform Admin: the database of every company, attached ones too
   -----------------------------------------------------------------------------
   Run in MainDBEncryptz AFTER 20_Company_Provisioning.sql. SAFE TO RE-RUN: it changes
   two procedures and no table or row.

   QA BUG-028:
     - Companies said "No database" for all six companies while Company Databases listed six
       active databases. The Companies list must come from the script 20 version of
       sp_Platform_GetCompanies (with ProvisionStatus and DatabaseName); a main database that
       still has the script 14 version answers without them. This script puts it in place again.
     - Database Servers counted only the companies whose database was BUILT on the server
       (DbServerId). A database attached by hand has no DbServerId, only the ServerName of its
       connection: those are counted on the server of the same name too.

     dbo.sp_Platform_GetCompanies   as script 20 (ProvisionStatus, ProvisionError, DatabaseName)
     dbo.sp_Platform_GetDbServers   CompanyCount = built there + attached by hand to the same server name
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Users') IS NULL
BEGIN
    RAISERROR('Select MainDBEncryptz before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.DbServers') IS NULL OR COL_LENGTH('dbo.Companies', 'DbServerId') IS NULL
   OR COL_LENGTH('dbo.Companies', 'ProvisionError') IS NULL
BEGIN
    RAISERROR('Run 20_Company_Provisioning.sql in this database first. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetCompanies
    @CompanyId INT = NULL          -- NULL/0 = all (platform admin)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.CompanyId, c.CompanyName, c.CompanyCode,
        ISNULL(c.Address, '')     AS Address,
        ISNULL(c.City, '')        AS City,
        ISNULL(c.PhoneNumber, '') AS PhoneNumber,
        c.IsActive, c.CreatedAt,
        CASE WHEN c.ProvisionStatus = 'None' THEN 0 ELSE 1 END AS ProjectCount,
        (SELECT COUNT(*) FROM dbo.CompanyUsers cu WHERE cu.CompanyId = c.CompanyId AND cu.IsActive = 1) AS UserCount,
        c.ProvisionStatus,
        CASE WHEN c.ProvisionStatus = 'Ready' THEN '' ELSE ISNULL(c.ProvisionError, '') END AS ProvisionError,
        ISNULL(c.DatabaseName, '')   AS DatabaseName
    FROM dbo.Companies c
    WHERE ISNULL(@CompanyId, 0) = 0 OR c.CompanyId = @CompanyId
    ORDER BY c.CompanyName;
END
GO

/* The password is never returned; HasPassword tells whether one is stored. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetDbServers
AS
BEGIN
    SET NOCOUNT ON;

    SELECT s.DbServerId, s.ServerName, s.AdminUser, ISNULL(s.ExtraOptions, '') AS ExtraOptions,
           s.IsDefault, s.IsActive, s.CreatedAt,
           CAST(CASE WHEN ISNULL(s.AdminPasswordEnc, '') = '' THEN 0 ELSE 1 END AS BIT) AS HasPassword,
           (SELECT COUNT(*) FROM dbo.Companies c
            WHERE c.ProvisionStatus <> 'None'
              AND (c.DbServerId = s.DbServerId
                   OR (c.DbServerId IS NULL AND LTRIM(RTRIM(c.ServerName)) = LTRIM(RTRIM(s.ServerName))))) AS CompanyCount
    FROM dbo.DbServers s
    ORDER BY s.IsDefault DESC, s.ServerName;
END
GO

PRINT 'Platform Admin: every company shows its database, and every server counts the databases on it.';
GO
SET NOEXEC OFF;
GO
