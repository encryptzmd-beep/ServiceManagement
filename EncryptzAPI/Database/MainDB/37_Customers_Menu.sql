/* =============================================================================
   MainDB · 37 · Customers in the Sales menu
   -----------------------------------------------------------------------------
   NOT YET EXECUTED ANYWHERE. Rehearse on a copy of the main database first.

   Run in the SaaS main database AFTER 12_Sales_Menus.sql. SAFE TO RE-RUN.

   ADDS under the Sales group:
     Customers (sales/customers): the one customer master (party) shared by CRM,
     Sales and Service Management, with search, new customer and bulk upload.

   ACCESS: Admin and CompanyAdmin get View, Create and Edit. Nobody else has it
   until an administrator ticks it in Users & Roles (script 33).
   Log in again to see the entry.

   Select the SaaS main database in SSMS before running. No USE statement on purpose.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.MenuItems') IS NULL OR OBJECT_ID('dbo.RoleMenuAccess') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

DECLARE @GroupId INT, @OrdersId INT;

SELECT TOP 1 @GroupId = MenuId FROM dbo.MenuItems WHERE MenuName = N'Sales' AND ParentMenuId IS NULL AND IsActive = 1 ORDER BY MenuId;
SELECT TOP 1 @OrdersId = MenuId FROM dbo.MenuItems WHERE LOWER(LTRIM(RTRIM(MenuPath))) IN (N'sales/orders', N'/sales/orders') ORDER BY IsActive DESC, MenuId;

IF @GroupId IS NULL OR @OrdersId IS NULL
BEGIN
    RAISERROR('Run MainDB/12_Sales_Menus.sql first. Nothing was changed.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM dbo.MenuItems WHERE MenuPath = N'sales/customers')
    INSERT INTO dbo.MenuItems (MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive)
    VALUES (N'Customers', N'sales/customers', N'contacts', @GroupId, 0, 1);

UPDATE dbo.MenuItems
SET ParentMenuId = @GroupId, MenuName = N'Customers', Icon = N'contacts', SortOrder = 0, IsActive = 1
WHERE MenuPath = N'sales/customers';

/* the screen belongs to the module of the Sales screens */
IF COL_LENGTH('dbo.MenuItems', 'AppModuleId') IS NOT NULL
    EXEC sp_executesql N'
        UPDATE m SET AppModuleId = o.AppModuleId
        FROM dbo.MenuItems m
        CROSS JOIN (SELECT AppModuleId FROM dbo.MenuItems WHERE MenuId = @OrdersId) o
        WHERE m.MenuPath = N''sales/customers'';', N'@OrdersId INT', @OrdersId = @OrdersId;

IF COL_LENGTH('dbo.MenuItems', 'Module') IS NOT NULL
    EXEC (N'UPDATE dbo.MenuItems SET Module = ''Services'' WHERE MenuPath = N''sales/customers'' AND ISNULL(Module, '''') <> ''Services''');

INSERT INTO dbo.RoleMenuAccess (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
SELECT r.RoleId, m.MenuId, 1, 1, 1, 0
FROM dbo.Roles r
INNER JOIN dbo.MenuItems m ON m.MenuPath = N'sales/customers'
WHERE r.RoleName IN ('Admin', 'CompanyAdmin')
  AND NOT EXISTS (SELECT 1 FROM dbo.RoleMenuAccess x WHERE x.RoleId = r.RoleId AND x.MenuId = m.MenuId);

COMMIT TRANSACTION;
PRINT 'Customers menu is in place. Log in again to see it.';
GO
