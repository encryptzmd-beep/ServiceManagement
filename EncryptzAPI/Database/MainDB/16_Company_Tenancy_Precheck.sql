/* =============================================================================
   MainDB · Company-level tenancy · PRE-CHECK (read-only report)
   -----------------------------------------------------------------------------
   Run it days before the release, on the main database, while the project
   tables (Projects, ProjectConnections, UserProjectAccess) still exist. It only
   reads. It writes nothing and can be run as often as you like. It can be run
   before or after 13_Company_Tenancy_Schema.sql: it uses nothing that script 13
   adds.

     1. the three conditions on which the cut-over (script 14) refuses to run
     2. company administrators who will GAIN entry at the cut-over
     3. members who keep access and members who have none, per company
     4. project grants of people who are not members (they are not migrated)
     5. objects that mention Companies and were saved with QUOTED_IDENTIFIER or
        ANSI_NULLS off (script 13 adds a filtered index to dbo.Companies)

   Each section starts with a PRINT heading, then one result set. Zero rows
   means "nothing to do" for sections 1, 2, 4 and 5. How to read it: see the
   last messages.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose. Changes nothing in any tenant database.
   Next: 13 and 14 (see 14_Company_Tenancy_README.md).
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Companies') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Companies') IS NOT NULL AND OBJECT_ID('dbo.Projects') IS NULL
BEGIN
    RAISERROR('dbo.Projects does not exist: the cut-over has already been run. This report is only meaningful before it.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. The conditions on which script 14 refuses to run (same logic as its step 0)
   ----------------------------------------------------------------------------- */
PRINT '1. Conditions that stop the cut-over. Zero rows = OK.';
SELECT 'Company with more than one active project' AS [Check],
       p.CompanyId, p.ProjectId, p.ProjectName, p.ProjectKey,
       CAST(NULL AS NVARCHAR(200)) AS ServerName, CAST(NULL AS NVARCHAR(200)) AS DatabaseName
FROM dbo.Projects p
WHERE p.IsActive = 1
  AND p.CompanyId IN (SELECT CompanyId FROM dbo.Projects WHERE IsActive = 1 GROUP BY CompanyId HAVING COUNT(*) > 1)
UNION ALL
SELECT 'Database shared by more than one company',
       p.CompanyId, p.ProjectId, p.ProjectName, p.ProjectKey, pc.ServerName, pc.DatabaseName
FROM dbo.ProjectConnections pc
INNER JOIN dbo.Projects p ON p.ProjectId = pc.ProjectId AND p.IsActive = 1
WHERE pc.IsActive = 1
  AND EXISTS (SELECT 1
              FROM dbo.ProjectConnections pc2
              INNER JOIN dbo.Projects p2 ON p2.ProjectId = pc2.ProjectId AND p2.IsActive = 1
              WHERE pc2.IsActive = 1
                AND pc2.ServerName = pc.ServerName AND pc2.DatabaseName = pc.DatabaseName
              GROUP BY pc2.ServerName, pc2.DatabaseName
              HAVING COUNT(DISTINCT p2.CompanyId) > 1)
UNION ALL
SELECT 'Active project with more than one connection row',
       p.CompanyId, p.ProjectId, p.ProjectName, p.ProjectKey, pc.ServerName, pc.DatabaseName
FROM dbo.ProjectConnections pc
INNER JOIN dbo.Projects p ON p.ProjectId = pc.ProjectId AND p.IsActive = 1
WHERE pc.ProjectId IN (SELECT pc3.ProjectId
                       FROM dbo.ProjectConnections pc3
                       INNER JOIN dbo.Projects p3 ON p3.ProjectId = pc3.ProjectId AND p3.IsActive = 1
                       GROUP BY pc3.ProjectId HAVING COUNT(*) > 1)
ORDER BY [Check], CompanyId, ProjectId;
GO

/* -----------------------------------------------------------------------------
   2. Company administrators who will GAIN entry
      After the cut-over Admin and CompanyAdmin always have the Service module.
      These administrators have no project access today.
   ----------------------------------------------------------------------------- */
PRINT '2. Company administrators who will gain entry (no active project access today). Zero rows = nobody gains entry.';
SELECT 'Administrator without project access' AS [Check],
       c.CompanyId, c.CompanyName, u.UserId, u.FullName, u.Email,
       LTRIM(RTRIM(cu.RoleInCompany)) AS RoleInCompany
FROM dbo.CompanyUsers cu
INNER JOIN dbo.Companies c ON c.CompanyId = cu.CompanyId
INNER JOIN dbo.Projects p  ON p.CompanyId = c.CompanyId AND p.IsActive = 1
INNER JOIN dbo.Users u     ON u.UserId = cu.UserId
WHERE cu.IsActive = 1
  AND LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin')
  AND NOT EXISTS (SELECT 1 FROM dbo.UserProjectAccess upa
                  WHERE upa.UserId = cu.UserId AND upa.ProjectId = p.ProjectId AND upa.IsActive = 1)
ORDER BY c.CompanyName, u.FullName;
GO

/* -----------------------------------------------------------------------------
   3. For information: how many active members keep access, and how many have none
      (administrators are counted separately: they always have it afterwards)
   ----------------------------------------------------------------------------- */
PRINT '3. Active members per company with an active project (for information).';
SELECT 'Members per company' AS [Check],
       c.CompanyId, c.CompanyName,
       SUM(CASE WHEN upa.UserProjectAccessId IS NOT NULL THEN 1 ELSE 0 END) AS MembersWhoKeepAccess,
       SUM(CASE WHEN upa.UserProjectAccessId IS NULL
                 AND LTRIM(RTRIM(cu.RoleInCompany)) NOT IN ('Admin', 'CompanyAdmin') THEN 1 ELSE 0 END) AS MembersWithNoAccess,
       SUM(CASE WHEN upa.UserProjectAccessId IS NULL
                 AND LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin') THEN 1 ELSE 0 END) AS AdministratorsWhoGainEntry
FROM dbo.Companies c
INNER JOIN dbo.Projects p      ON p.CompanyId = c.CompanyId AND p.IsActive = 1
INNER JOIN dbo.CompanyUsers cu ON cu.CompanyId = c.CompanyId AND cu.IsActive = 1
LEFT  JOIN dbo.UserProjectAccess upa
       ON upa.UserId = cu.UserId AND upa.ProjectId = p.ProjectId AND upa.IsActive = 1
GROUP BY c.CompanyId, c.CompanyName
ORDER BY c.CompanyName;
GO

/* -----------------------------------------------------------------------------
   4. Project grants of people who are not members of the company
   ----------------------------------------------------------------------------- */
PRINT '4. Project grants without company membership (not migrated). Zero rows = OK.';
SELECT 'Project grant without company membership' AS [Check],
       p.CompanyId, upa.UserId, u.Email
FROM dbo.UserProjectAccess upa
INNER JOIN dbo.Projects p ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
LEFT  JOIN dbo.Users u    ON u.UserId = upa.UserId
WHERE upa.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers cu WHERE cu.CompanyId = p.CompanyId AND cu.UserId = upa.UserId)
ORDER BY p.CompanyId, upa.UserId;
GO

/* -----------------------------------------------------------------------------
   5. Objects saved with QUOTED_IDENTIFIER or ANSI_NULLS off that mention Companies
      Script 13 adds a filtered index to dbo.Companies. Writing to the table from
      such an object would then fail.
   ----------------------------------------------------------------------------- */
PRINT '5. Objects with QUOTED_IDENTIFIER or ANSI_NULLS off that mention Companies. Zero rows = OK.';
SELECT 'Object with an unsafe session setting' AS [Check],
       SCHEMA_NAME(o.schema_id) AS SchemaName, o.name AS ObjectName, o.type_desc AS ObjectType,
       m.uses_quoted_identifier AS QuotedIdentifier, m.uses_ansi_nulls AS AnsiNulls
FROM sys.sql_modules m
INNER JOIN sys.objects o ON o.object_id = m.object_id
WHERE o.is_ms_shipped = 0
  AND (m.uses_quoted_identifier = 0 OR m.uses_ansi_nulls = 0)
  AND m.definition LIKE '%Companies%'
ORDER BY ObjectName;
GO

PRINT 'How to read this: sections 1, 4 and 5 should return zero rows (section 1 must, or script 14 stops).';
PRINT 'Section 2 lists administrators who will be able to enter the Service module although they cannot today.';
PRINT 'If one of them must stay out, change their company role before the release.';
PRINT 'Section 3 is for information only. Nothing was changed by this report.';
GO
SET NOEXEC OFF;
GO
