/* =============================================================================
   MainDB · Sidebar menu for the Sales module
   -----------------------------------------------------------------------------
   Adds the group

       Sales        Sales Order · Despatch · Warranty Lookup

   to dbo.MenuItems (matched by PATH, so re-running changes nothing that exists)
   and gives Admin, CompanyAdmin, ServiceManager and Manager access to it.
   Other roles get it from Settings > User Roles.

   Routes (encryptzUI/src/app/app.routes.ts):
       sales/orders     Sales Order list + entry (bill)
       sales/despatch   Despatch list + despatch of a bill
       sales/warranty   Warranty lookup by serial number / customer / bill

   Run on the MAIN database AFTER 11_Menu_Groups.sql. SAFE TO RE-RUN.
   Users see it after the next login (menus are loaded at login / company selection).
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('dbo.MenuItems') IS NULL OR OBJECT_ID('dbo.RoleMenuAccess') IS NULL OR OBJECT_ID('dbo.ProjectConnections') IS NULL
BEGIN
    DECLARE @Db SYSNAME = DB_NAME();
    RAISERROR('Run this on the MAIN database: MenuItems / RoleMenuAccess / ProjectConnections were not found in [%s].', 16, 1, @Db);
    RETURN;
END

DECLARE @HasModule BIT = CASE WHEN COL_LENGTH('dbo.MenuItems', 'Module') IS NULL THEN 0 ELSE 1 END;

BEGIN TRY
    BEGIN TRANSACTION;

    /* ---- 1. the group row ------------------------------------------------- */
    DECLARE @GroupId INT;
    SELECT TOP 1 @GroupId = MenuId
    FROM dbo.MenuItems
    WHERE MenuName = N'Sales' AND ParentMenuId IS NULL
    ORDER BY IsActive DESC, MenuId;

    IF @GroupId IS NULL
    BEGIN
        INSERT INTO dbo.MenuItems (MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive)
        VALUES (N'Sales', NULL, N'point_of_sale', NULL, 65, 1);      -- between Settings (60) and Products (70)
        SET @GroupId = SCOPE_IDENTITY();
        PRINT 'Group created: Sales';
    END
    ELSE
        UPDATE dbo.MenuItems SET IsActive = 1, Icon = ISNULL(NULLIF(Icon, ''), N'point_of_sale') WHERE MenuId = @GroupId;

    /* ---- 2. the screens --------------------------------------------------- */
    DECLARE @Screens TABLE (ItemPath NVARCHAR(300) PRIMARY KEY, ItemName NVARCHAR(150), Icon NVARCHAR(100), SortOrder INT, MenuId INT NULL);
    INSERT INTO @Screens (ItemPath, ItemName, Icon, SortOrder) VALUES
        (N'sales/orders',   N'Sales Order',     N'receipt_long',     1),
        (N'sales/despatch', N'Despatch',        N'local_shipping',   2),
        (N'sales/warranty', N'Warranty Lookup', N'verified_user',    3);

    UPDATE s
    SET MenuId = pick.MenuId
    FROM @Screens s
    CROSS APPLY (SELECT TOP 1 m.MenuId
                 FROM dbo.MenuItems m
                 WHERE LOWER(LTRIM(RTRIM(ISNULL(m.MenuPath, '')))) IN (s.ItemPath, '/' + s.ItemPath)
                 ORDER BY m.IsActive DESC, m.MenuId) pick;

    INSERT INTO dbo.MenuItems (MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive)
    SELECT s.ItemName, s.ItemPath, s.Icon, @GroupId, s.SortOrder, 1
    FROM @Screens s WHERE s.MenuId IS NULL;

    UPDATE s
    SET MenuId = m.MenuId
    FROM @Screens s
    INNER JOIN dbo.MenuItems m ON m.MenuPath = s.ItemPath
    WHERE s.MenuId IS NULL;

    UPDATE m
    SET ParentMenuId = @GroupId, SortOrder = s.SortOrder, MenuName = s.ItemName,
        Icon = ISNULL(NULLIF(m.Icon, ''), s.Icon), IsActive = 1
    FROM dbo.MenuItems m
    INNER JOIN @Screens s ON s.MenuId = m.MenuId;

    IF @HasModule = 1
    BEGIN
        DECLARE @ids NVARCHAR(MAX) = CAST(@GroupId AS NVARCHAR(12));
        SELECT @ids = @ids + N',' + CAST(MenuId AS NVARCHAR(12)) FROM @Screens WHERE MenuId IS NOT NULL;
        EXEC (N'UPDATE dbo.MenuItems SET Module = ''Services'' WHERE MenuId IN (' + @ids + N') AND ISNULL(Module, '''') <> ''Services''');
    END

    /* ---- 3. access: back-office roles see / create / edit ----------------- */
    DECLARE @Grant TABLE (RoleId INT PRIMARY KEY);
    INSERT INTO @Grant (RoleId)
    SELECT RoleId FROM dbo.Roles WHERE RoleName IN ('Admin', 'CompanyAdmin', 'ServiceManager', 'Manager');

    MERGE dbo.RoleMenuAccess AS tgt
    USING (SELECT g.RoleId, m.MenuId, CAST(CASE WHEN m.MenuId = @GroupId THEN 0 ELSE 1 END AS BIT) AS IsScreen
           FROM @Grant g
           CROSS JOIN (SELECT @GroupId AS MenuId UNION ALL SELECT MenuId FROM @Screens WHERE MenuId IS NOT NULL) m) AS src
        ON tgt.RoleId = src.RoleId AND tgt.MenuId = src.MenuId
    WHEN MATCHED THEN
        UPDATE SET CanView = 1,
                   CanCreate = CASE WHEN src.IsScreen = 1 THEN 1 ELSE tgt.CanCreate END,
                   CanEdit   = CASE WHEN src.IsScreen = 1 THEN 1 ELSE tgt.CanEdit END
    WHEN NOT MATCHED THEN
        INSERT (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
        VALUES (src.RoleId, src.MenuId, 1, src.IsScreen, src.IsScreen, 0);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH

SELECT p.MenuName AS [Group], m.MenuName AS [Screen], m.MenuPath, m.Icon, m.MenuId, m.SortOrder
FROM dbo.MenuItems m
INNER JOIN dbo.MenuItems p ON p.MenuId = m.ParentMenuId
WHERE p.MenuName = N'Sales' AND m.IsActive = 1
ORDER BY m.SortOrder;

PRINT 'Sales menu applied. Log in again to see it in the sidebar.';
GO
