/* =============================================================================
   MainDBEncryptz · Seed the menu tree + give the Admin role ALL menu access
   -----------------------------------------------------------------------------
   Menus are control-plane (shared) and live in MainDB now, but MainDBEncryptz.
   MenuItems is empty. This copies the original 37-item menu tree from
   FelixServiceDB (same server) and grants the 'Admin' role full CRUD on every menu.

   Both DBs are on the same server (72.60.206.241), so the cross-DB copy works.
   Idempotent — safe to re-run.
   ============================================================================= */
USE MainDBEncryptz;
GO

/* -----------------------------------------------------------------------------
   1. Copy the menu tree from FelixServiceDB (preserve MenuId so ParentMenuId
      relationships stay valid). Only runs if MainDB has no menus yet.
   ----------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.MenuItems)
BEGIN
    SET IDENTITY_INSERT dbo.MenuItems ON;

    INSERT INTO dbo.MenuItems (MenuId, MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive)
    SELECT MenuId, MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive
    FROM FelixServiceDB.dbo.MenuItems;

    SET IDENTITY_INSERT dbo.MenuItems OFF;

    PRINT 'Copied menu items from FelixServiceDB.';
END
ELSE
    PRINT 'MenuItems already populated — skipping copy.';
GO

/* -----------------------------------------------------------------------------
   2. Ensure the Admin role exists, then grant it FULL access to every menu.
   ----------------------------------------------------------------------------- */
DECLARE @RoleId INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'Admin');

IF @RoleId IS NULL
BEGIN
    INSERT INTO dbo.Roles (RoleName, Description) VALUES ('Admin', 'Full access');
    SET @RoleId = SCOPE_IDENTITY();
END

MERGE dbo.RoleMenuAccess AS tgt
USING (SELECT MenuId FROM dbo.MenuItems WHERE IsActive = 1) AS src
    ON tgt.RoleId = @RoleId AND tgt.MenuId = src.MenuId
WHEN MATCHED THEN
    UPDATE SET CanView = 1, CanCreate = 1, CanEdit = 1, CanDelete = 1
WHEN NOT MATCHED THEN
    INSERT (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
    VALUES (@RoleId, src.MenuId, 1, 1, 1, 1);

PRINT 'Admin granted full access to all menus.';

/* Verify */
SELECT (SELECT COUNT(*) FROM dbo.MenuItems)                              AS MenuItemsInMainDb,
       (SELECT COUNT(*) FROM dbo.RoleMenuAccess WHERE RoleId = @RoleId)  AS AdminMenuGrants;
GO
