/* =============================================================================
   MainDB · 34 · Reports in the Sales menu
   -----------------------------------------------------------------------------
   NOT YET EXECUTED ANYWHERE. Rehearse on a copy of the main database first.

   Run in the SaaS main database AFTER 12_Sales_Menus.sql. SAFE TO RE-RUN.

   ADDS under the Sales group:
     Sales Register, Sales by Customer, GST Summary, Pending Despatch,
     Despatch Register, Despatch by Mode

   ACCESS: only Admin and CompanyAdmin get View on the reports. Nobody else has them
   until an administrator ticks them in Users & Roles (script 33).
   Log in again to see the entries.

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

DECLARE @GroupId INT, @OrdersId INT, @ServiceModuleId INT;

SELECT TOP 1 @GroupId = MenuId FROM dbo.MenuItems WHERE MenuName = N'Sales' AND ParentMenuId IS NULL AND IsActive = 1 ORDER BY MenuId;
SELECT TOP 1 @OrdersId = MenuId FROM dbo.MenuItems WHERE LOWER(LTRIM(RTRIM(MenuPath))) IN (N'sales/orders', N'/sales/orders') ORDER BY IsActive DESC, MenuId;

IF @GroupId IS NULL OR @OrdersId IS NULL
BEGIN
    RAISERROR('Run MainDB/12_Sales_Menus.sql first. Nothing was changed.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

DECLARE @Reports TABLE (ItemPath NVARCHAR(300) PRIMARY KEY, ItemName NVARCHAR(150), Icon NVARCHAR(100), SortOrder INT);
INSERT INTO @Reports (ItemPath, ItemName, Icon, SortOrder) VALUES
    (N'sales/reports/register',  N'Sales Register',    N'receipt_long',    11),
    (N'sales/reports/customers', N'Sales by Customer', N'groups',          12),
    (N'sales/reports/gst',       N'GST Summary',       N'account_balance', 13),
    (N'sales/reports/pending',   N'Pending Despatch',  N'pending_actions', 14),
    (N'sales/reports/despatch',  N'Despatch Register', N'local_shipping',  15),
    (N'sales/reports/modes',     N'Despatch by Mode',  N'alt_route',       16);

INSERT INTO dbo.MenuItems (MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive)
SELECT r.ItemName, r.ItemPath, r.Icon, @GroupId, r.SortOrder, 1
FROM @Reports r
WHERE NOT EXISTS (SELECT 1 FROM dbo.MenuItems m WHERE m.MenuPath = r.ItemPath);

UPDATE m
SET ParentMenuId = @GroupId, MenuName = r.ItemName, Icon = r.Icon, SortOrder = r.SortOrder, IsActive = 1
FROM dbo.MenuItems m
INNER JOIN @Reports r ON r.ItemPath = m.MenuPath;

/* the reports belong to the module of the Sales screens */
IF COL_LENGTH('dbo.MenuItems', 'AppModuleId') IS NOT NULL
    EXEC sp_executesql N'
        UPDATE m SET AppModuleId = o.AppModuleId
        FROM dbo.MenuItems m
        CROSS JOIN (SELECT AppModuleId FROM dbo.MenuItems WHERE MenuId = @OrdersId) o
        WHERE m.MenuPath LIKE N''sales/reports/%'';', N'@OrdersId INT', @OrdersId = @OrdersId;

IF COL_LENGTH('dbo.MenuItems', 'Module') IS NOT NULL
    EXEC (N'UPDATE dbo.MenuItems SET Module = ''Services'' WHERE MenuPath LIKE N''sales/reports/%'' AND ISNULL(Module, '''') <> ''Services''');

INSERT INTO dbo.RoleMenuAccess (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
SELECT r.RoleId, m.MenuId, 1, 0, 0, 0
FROM dbo.Roles r
INNER JOIN dbo.MenuItems m ON m.MenuPath LIKE N'sales/reports/%'
WHERE r.RoleName IN ('Admin', 'CompanyAdmin')
  AND NOT EXISTS (SELECT 1 FROM dbo.RoleMenuAccess x WHERE x.RoleId = r.RoleId AND x.MenuId = m.MenuId);

COMMIT TRANSACTION;

PRINT 'Sales reports are in the Sales menu. Log in again to see them.';
GO
SET NOEXEC OFF;
GO
