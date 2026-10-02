/* =============================================================================
   MainDB · Sidebar menu grouped like app.encryptz.in
   -----------------------------------------------------------------------------
   The menu tree of MainDB shows most screens as loose top-level entries
   (Dashboard, All Complaints, Work Orders, Attendance, Geo Tracking, ...).
   This arranges them in the groups of app.encryptz.in:

       Complaints   Dashboard · All Complaints
       Technicians  Technicians
       Tracking     Attendance · Geo Tracking
       Schedule     Daily Schedule
       Reports      SLA Report · Attendance Report · Productivity Report ·
                    Complaint Report · Payment Reports
       Settings     User Roles · User Management · General Settings
       Products     Products · Spare Parts · Repair Parts

   Data only: dbo.MenuItems (parent, order, two names) and dbo.RoleMenuAccess
   (view access on the group rows). No procedure, API or UI change. Nothing is
   deleted. Menus are matched by their PATH, so the ids of the database do not
   matter.

   Screens this application has and app.encryptz.in does not show to an admin
   (Work Orders, Assign Technician, Spare Requests, Travel Reports, Warranty
   Returns, Schedule Conflicts, Platform Admin) are kept and put in the matching
   group — see @HideExtrasFromAdmins below.

   Run on the MAIN database. SAFE TO RE-RUN. Users see it after the next login
   (the menu is loaded at login / company selection).
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

/* =============================================================================
   SETTINGS
   ============================================================================= */
DECLARE @HideExtrasFromAdmins BIT = 0;
    -- 0 = the extra screens stay visible, inside the matching group (default)
    -- 1 = sidebar of Admin / CompanyAdmin exactly as app.encryptz.in: their VIEW
    --     access on Work Orders, Assign Technician, Spare Requests, Travel Reports,
    --     Warranty Returns and Schedule Conflicts is taken away. Other roles
    --     (Technician, ...) keep them. Platform Admin always stays: the tenants
    --     are managed there. Give the access back in Settings > User Roles.

/* =============================================================================
   Safety: this is the control-plane database?
   ============================================================================= */
IF OBJECT_ID('dbo.MenuItems') IS NULL OR OBJECT_ID('dbo.RoleMenuAccess') IS NULL OR OBJECT_ID('dbo.ProjectConnections') IS NULL
BEGIN
    DECLARE @Db SYSNAME = DB_NAME();
    RAISERROR('Run this on the MAIN database: MenuItems / RoleMenuAccess / ProjectConnections were not found in [%s].', 16, 1, @Db);
    RETURN;
END

/* =============================================================================
   1. The layout. Paths without a leading slash; matched case-insensitively.
      IsExtra = 1: not in the admin sidebar of app.encryptz.in.
   ============================================================================= */
DECLARE @Groups TABLE (GroupName NVARCHAR(150) PRIMARY KEY, Icon NVARCHAR(100), SortOrder INT, MenuId INT NULL);
INSERT INTO @Groups (GroupName, Icon, SortOrder) VALUES
    (N'Complaints',  N'report_problem', 10),
    (N'Technicians', N'engineering',    20),
    (N'Tracking',    N'location_on',    30),
    (N'Schedule',    N'calendar_today', 40),
    (N'Reports',     N'assessment',     50),
    (N'Settings',    N'settings',       60),
    (N'Products',    N'inventory_2',    70);

DECLARE @Layout TABLE
(
    GroupName NVARCHAR(150) NOT NULL,
    ItemPath  NVARCHAR(300) NOT NULL PRIMARY KEY,
    ItemName  NVARCHAR(150) NULL,        -- set = the entry is renamed to this
    SortOrder INT           NOT NULL,
    IsExtra   BIT           NOT NULL DEFAULT (0),
    MenuId    INT           NULL
);
INSERT INTO @Layout (GroupName, ItemPath, ItemName, SortOrder, IsExtra) VALUES
    (N'Complaints',  N'complaints/dashboard',        NULL,               1, 0),
    (N'Complaints',  N'complaints/list',             NULL,               2, 0),
    (N'Complaints',  N'complaints/warranty',         NULL,               3, 1),

    (N'Technicians', N'technicians/list',            NULL,               1, 0),
    (N'Technicians', N'technicians/work-orders',     NULL,               2, 1),
    (N'Technicians', N'complaints/assign',           NULL,               3, 1),
    (N'Technicians', N'technicians/spare-requests',  NULL,               4, 1),

    (N'Tracking',    N'tracking/attendance',         NULL,               1, 0),
    (N'Tracking',    N'tracking/geo',                NULL,               2, 0),
    (N'Tracking',    N'tracking/travel',             NULL,               3, 1),

    (N'Schedule',    N'schedule/daily',              NULL,               1, 0),
    (N'Schedule',    N'schedule/conflicts',          NULL,               2, 1),

    (N'Reports',     N'reports/sla',                 NULL,               1, 0),
    (N'Reports',     N'reports/attendance',          NULL,               2, 0),
    (N'Reports',     N'reports/productivity',        NULL,               3, 0),
    (N'Reports',     N'reports/complaints',          NULL,               4, 0),
    -- the payment collection report: listed as "Payment Settings" under Settings
    (N'Reports',     N'settings/payments',           N'Payment Reports', 5, 0),

    (N'Settings',    N'settings/roles',              NULL,               1, 0),
    (N'Settings',    N'settings/access-management',  NULL,               2, 0),
    (N'Settings',    N'settings/general',            NULL,               3, 0),
    (N'Settings',    N'settings/platform',           NULL,               4, 0),   -- stays for admins (see above)

    (N'Products',    N'products',                    NULL,               1, 0),
    (N'Products',    N'spare-parts',                 NULL,               2, 0),
    (N'Products',    N'technicians/repair-parts',    NULL,               3, 0);

/* every menu row with its path in the same spelling as the layout */
DECLARE @Menus TABLE (MenuId INT PRIMARY KEY, NormPath NVARCHAR(300) NULL, ParentMenuId INT NULL, MenuName NVARCHAR(150), IsActive BIT);
INSERT INTO @Menus (MenuId, NormPath, ParentMenuId, MenuName, IsActive)
SELECT m.MenuId,
       NULLIF(LOWER(CASE WHEN x.P LIKE '%/' THEN LEFT(x.P, LEN(x.P) - 1) ELSE x.P END), ''),
       m.ParentMenuId, m.MenuName, m.IsActive
FROM dbo.MenuItems m
CROSS APPLY (SELECT LTRIM(RTRIM(ISNULL(m.MenuPath, ''))) AS T) t
CROSS APPLY (SELECT CASE WHEN t.T LIKE '/%' THEN STUFF(t.T, 1, 1, '') ELSE t.T END AS P) x;

/* the group rows that exist already: a top-level row with that name which is not
   itself one of the screens (e.g. the screen "Technicians") */
UPDATE g
SET MenuId = pick.MenuId
FROM @Groups g
CROSS APPLY (SELECT TOP 1 m.MenuId FROM @Menus m
             WHERE m.MenuName = g.GroupName AND m.ParentMenuId IS NULL
               AND (m.NormPath IS NULL OR m.NormPath NOT IN (SELECT ItemPath FROM @Layout))
             ORDER BY m.IsActive DESC, m.MenuId) pick;

/* one row per path: an active one first, then the one already in its group, then the oldest */
UPDATE l
SET MenuId = pick.MenuId
FROM @Layout l
LEFT JOIN @Groups g ON g.GroupName = l.GroupName
CROSS APPLY (SELECT TOP 1 m.MenuId FROM @Menus m
             WHERE m.NormPath = l.ItemPath
             ORDER BY m.IsActive DESC,
                      CASE WHEN m.ParentMenuId = g.MenuId THEN 0 ELSE 1 END,
                      m.MenuId) pick;

DECLARE @HasModule BIT = CASE WHEN COL_LENGTH('dbo.MenuItems', 'Module') IS NULL THEN 0 ELSE 1 END;

BEGIN TRY
    BEGIN TRANSACTION;

    /* =========================================================================
       2. The group rows: the existing one (found above), else a new one
       ========================================================================= */
    DECLARE @Name NVARCHAR(150), @Icon NVARCHAR(100), @Sort INT, @NewId INT;
    DECLARE grp CURSOR LOCAL FAST_FORWARD FOR
        SELECT GroupName, Icon, SortOrder FROM @Groups WHERE MenuId IS NULL
          AND GroupName IN (SELECT GroupName FROM @Layout WHERE MenuId IS NOT NULL);   -- only groups that get a screen
    OPEN grp; FETCH NEXT FROM grp INTO @Name, @Icon, @Sort;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- no path: clicking a group only opens it
        INSERT INTO dbo.MenuItems (MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive)
        VALUES (@Name, NULL, @Icon, NULL, @Sort, 1);
        SET @NewId = SCOPE_IDENTITY();
        UPDATE @Groups SET MenuId = @NewId WHERE GroupName = @Name;
        PRINT 'Group created: ' + @Name;
        FETCH NEXT FROM grp INTO @Name, @Icon, @Sort;
    END
    CLOSE grp; DEALLOCATE grp;

    UPDATE m
    SET IsActive = 1, SortOrder = g.SortOrder, ParentMenuId = NULL,
        Icon = ISNULL(NULLIF(m.Icon, ''), g.Icon)
    FROM dbo.MenuItems m
    INNER JOIN @Groups g ON g.MenuId = m.MenuId;

    -- the service application shows the 'Services' module (the column is added by
    -- Seed_Roles_And_MenuAccess.sql / 07_Platform_Admin.sql, so it is addressed dynamically)
    IF @HasModule = 1
    BEGIN
        IF OBJECT_ID('tempdb..#MenuGroupIds') IS NOT NULL DROP TABLE #MenuGroupIds;
        SELECT MenuId INTO #MenuGroupIds FROM @Groups WHERE MenuId IS NOT NULL;
        EXEC (N'UPDATE m SET Module = ''Services''
                FROM dbo.MenuItems m
                WHERE m.MenuId IN (SELECT MenuId FROM #MenuGroupIds) AND ISNULL(m.Module, '''') <> ''Services''');
        DROP TABLE #MenuGroupIds;
    END

    /* =========================================================================
       3. Every screen under its group, in the order of the layout
       ========================================================================= */
    UPDATE m
    SET ParentMenuId = g.MenuId,
        SortOrder    = l.SortOrder,
        MenuName     = ISNULL(l.ItemName, m.MenuName)
    FROM dbo.MenuItems m
    INNER JOIN @Layout l ON l.MenuId = m.MenuId
    INNER JOIN @Groups g ON g.GroupName = l.GroupName AND g.MenuId IS NOT NULL;

    /* a second entry for the same screen (e.g. "Repair Parts" under Reports and
       under Products): the one placed above stays, the other is switched off */
    DECLARE @Dup TABLE (DupId INT PRIMARY KEY, KeepId INT NOT NULL);
    INSERT INTO @Dup (DupId, KeepId)
    SELECT x.MenuId, l.MenuId
    FROM @Menus x
    INNER JOIN @Layout l ON l.ItemPath = x.NormPath AND l.MenuId <> x.MenuId
    WHERE x.IsActive = 1;

    IF EXISTS (SELECT 1 FROM @Dup)
    BEGIN
        -- nobody loses the screen: what a role could do on the duplicate, it can do on the kept entry
        UPDATE k
        SET CanView   = CASE WHEN k.CanView   = 1 OR a.CanView   = 1 THEN 1 ELSE 0 END,
            CanCreate = CASE WHEN k.CanCreate = 1 OR a.CanCreate = 1 THEN 1 ELSE 0 END,
            CanEdit   = CASE WHEN k.CanEdit   = 1 OR a.CanEdit   = 1 THEN 1 ELSE 0 END,
            CanDelete = CASE WHEN k.CanDelete = 1 OR a.CanDelete = 1 THEN 1 ELSE 0 END
        FROM dbo.RoleMenuAccess k
        INNER JOIN @Dup d               ON d.KeepId = k.MenuId
        INNER JOIN dbo.RoleMenuAccess a ON a.MenuId = d.DupId AND a.RoleId = k.RoleId;

        INSERT INTO dbo.RoleMenuAccess (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
        SELECT a.RoleId, d.KeepId, MAX(CAST(a.CanView AS INT)), MAX(CAST(a.CanCreate AS INT)),
               MAX(CAST(a.CanEdit AS INT)), MAX(CAST(a.CanDelete AS INT))
        FROM dbo.RoleMenuAccess a
        INNER JOIN @Dup d ON d.DupId = a.MenuId
        WHERE NOT EXISTS (SELECT 1 FROM dbo.RoleMenuAccess k WHERE k.RoleId = a.RoleId AND k.MenuId = d.KeepId)
        GROUP BY a.RoleId, d.KeepId;

        UPDATE m SET IsActive = 0
        FROM dbo.MenuItems m INNER JOIN @Dup d ON d.DupId = m.MenuId;

        PRINT 'Duplicate menu entries switched off (IsActive = 0); their role access was carried over.';
    END

    /* =========================================================================
       4. A role that sees a screen also sees its group
       ========================================================================= */
    UPDATE rma
    SET CanView = 1
    FROM dbo.RoleMenuAccess rma
    INNER JOIN @Groups g ON g.MenuId = rma.MenuId
    WHERE rma.CanView = 0
      AND EXISTS (SELECT 1 FROM dbo.RoleMenuAccess c
                  INNER JOIN dbo.MenuItems cm ON cm.MenuId = c.MenuId AND cm.IsActive = 1
                  WHERE c.RoleId = rma.RoleId AND c.CanView = 1 AND cm.ParentMenuId = g.MenuId);

    INSERT INTO dbo.RoleMenuAccess (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
    SELECT DISTINCT c.RoleId, g.MenuId, 1, 0, 0, 0
    FROM dbo.RoleMenuAccess c
    INNER JOIN dbo.MenuItems cm ON cm.MenuId = c.MenuId AND cm.IsActive = 1
    INNER JOIN @Groups g        ON g.MenuId = cm.ParentMenuId
    WHERE c.CanView = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.RoleMenuAccess x WHERE x.RoleId = c.RoleId AND x.MenuId = g.MenuId);

    /* =========================================================================
       5. Optional: the admin sidebar exactly as app.encryptz.in
       ========================================================================= */
    IF @HideExtrasFromAdmins = 1
    BEGIN
        UPDATE rma
        SET CanView = 0
        FROM dbo.RoleMenuAccess rma
        INNER JOIN dbo.Roles r ON r.RoleId = rma.RoleId AND r.RoleName IN ('Admin', 'CompanyAdmin')
        INNER JOIN @Layout l   ON l.MenuId = rma.MenuId AND l.IsExtra = 1
        WHERE rma.CanView = 1;
        PRINT 'Extra screens hidden from Admin / CompanyAdmin: ' + CAST(@@ROWCOUNT AS VARCHAR(12)) + ' access row(s).';
    END

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH

/* =============================================================================
   Result: the active menu tree, and anything this layout did not place
   ============================================================================= */
SELECT CASE WHEN m.ParentMenuId IS NULL THEN m.MenuName ELSE p.MenuName END AS [Group],
       CASE WHEN m.ParentMenuId IS NULL THEN N'' ELSE m.MenuName END        AS [Screen],
       m.MenuPath, m.Icon, m.MenuId
FROM dbo.MenuItems m
LEFT JOIN dbo.MenuItems p ON p.MenuId = m.ParentMenuId
WHERE m.IsActive = 1 AND (m.ParentMenuId IS NULL OR p.IsActive = 1)
ORDER BY ISNULL(p.SortOrder, m.SortOrder), ISNULL(p.MenuId, m.MenuId),
         CASE WHEN m.ParentMenuId IS NULL THEN 0 ELSE 1 END, m.SortOrder, m.MenuId;

SELECT l.GroupName, l.ItemPath AS [Path not found in MenuItems (screen left out)]
FROM @Layout l WHERE l.MenuId IS NULL;

SELECT m.MenuId, m.MenuName, m.MenuPath AS [Active top-level entry outside the groups]
FROM dbo.MenuItems m
WHERE m.IsActive = 1 AND m.ParentMenuId IS NULL
  AND m.MenuId NOT IN (SELECT MenuId FROM @Groups WHERE MenuId IS NOT NULL);

PRINT 'Menu groups applied. Log in again to see the new sidebar.';
GO
