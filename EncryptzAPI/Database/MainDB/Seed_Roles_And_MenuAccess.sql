/* =============================================================================
   MainDBEncryptz · Roles + menu access for EVERY role (not only Admin)
   -----------------------------------------------------------------------------
   Seed_Menus_And_AdminAccess.sql copied the menu tree and gave only 'Admin'
   access, so a Technician / Manager / Storekeeper logs in to an empty sidebar.
   The original permissions live in FelixServiceDB (same server); this copies
   them by ROLE NAME, and restricts the MainDB menu tree to the 'Services' module
   as the original procs did.

   Run AFTER Seed_Menus_And_AdminAccess.sql. Idempotent — safe to re-run.
   It never lowers a permission that was changed in MainDB afterwards: existing
   RoleMenuAccess rows are left as they are.
   ============================================================================= */
USE MainDBEncryptz;
GO

/* -----------------------------------------------------------------------------
   1. Roles used by the UI route guards / role dropdowns
   ----------------------------------------------------------------------------- */
MERGE dbo.Roles AS t
USING (VALUES ('Admin','Full access'),
              ('CompanyAdmin','Company administrator'),
              ('Manager','Manager'),
              ('ServiceManager','Service manager'),
              ('Technician','Field technician'),
              ('Storekeeper','Store / inventory')) AS s(RoleName, Description)
    ON t.RoleName = s.RoleName
WHEN NOT MATCHED THEN INSERT (RoleName, Description) VALUES (s.RoleName, s.Description);
GO

/* -----------------------------------------------------------------------------
   2. Module on the menu tree (the service app shows the 'Services' module only)
   ----------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.MenuItems', 'Module') IS NULL
    ALTER TABLE dbo.MenuItems ADD Module NVARCHAR(50) NULL;
GO

UPDATE m
SET m.Module = src.Module
FROM dbo.MenuItems m
INNER JOIN FelixServiceDB.dbo.MenuItems src ON src.MenuId = m.MenuId
WHERE m.Module IS NULL AND src.Module IS NOT NULL;

/* Menus of other modules were copied too: hide them (kept, not deleted) */
UPDATE dbo.MenuItems
SET IsActive = 0
WHERE Module IS NOT NULL AND Module <> 'Services' AND IsActive = 1;

PRINT 'Menu modules set; non-Services menus deactivated.';
GO

/* -----------------------------------------------------------------------------
   3. Copy each role's original menu permissions (matched by role name)
   ----------------------------------------------------------------------------- */
INSERT INTO dbo.RoleMenuAccess (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
SELECT r.RoleId, m.MenuId,
       ISNULL(srcA.CanView, 0), ISNULL(srcA.CanCreate, 0), ISNULL(srcA.CanEdit, 0), ISNULL(srcA.CanDelete, 0)
FROM FelixServiceDB.dbo.RoleMenuAccess srcA
INNER JOIN FelixServiceDB.dbo.Roles srcR ON srcR.RoleId = srcA.RoleId
INNER JOIN dbo.Roles r     ON r.RoleName = srcR.RoleName
INNER JOIN dbo.MenuItems m ON m.MenuId   = srcA.MenuId
WHERE NOT EXISTS (SELECT 1 FROM dbo.RoleMenuAccess x WHERE x.RoleId = r.RoleId AND x.MenuId = m.MenuId);

PRINT 'Role menu access copied from FelixServiceDB.';
GO

/* CompanyAdmin administers a company: same menus as Admin unless already set */
INSERT INTO dbo.RoleMenuAccess (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
SELECT ca.RoleId, a.MenuId, a.CanView, a.CanCreate, a.CanEdit, a.CanDelete
FROM dbo.RoleMenuAccess a
INNER JOIN dbo.Roles ar ON ar.RoleId = a.RoleId AND ar.RoleName = 'Admin'
CROSS JOIN (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'CompanyAdmin') ca
WHERE NOT EXISTS (SELECT 1 FROM dbo.RoleMenuAccess x WHERE x.RoleId = ca.RoleId AND x.MenuId = a.MenuId);
GO

/* Verify: a role with 0 menus gets an empty sidebar — grant it from
   Settings > Access Management. */
SELECT r.RoleName,
       COUNT(CASE WHEN rma.CanView = 1 AND m.IsActive = 1 THEN 1 END) AS VisibleMenus
FROM dbo.Roles r
LEFT JOIN dbo.RoleMenuAccess rma ON rma.RoleId = r.RoleId
LEFT JOIN dbo.MenuItems m        ON m.MenuId   = rma.MenuId
GROUP BY r.RoleName
ORDER BY r.RoleName;
GO
