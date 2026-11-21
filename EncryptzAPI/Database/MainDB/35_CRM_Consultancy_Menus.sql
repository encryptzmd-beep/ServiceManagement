/* =============================================================================
   MainDB · 35 · Menu entries of CRM and Job Consultancy, for user rights
   -----------------------------------------------------------------------------
   Run in the SaaS main database AFTER 21, 32 and 33. SAFE TO RE-RUN.

   CRM and Job Consultancy draw their side menus in the application, so they had
   no rows in dbo.MenuItems and an administrator had nothing to tick. This adds:

     CRM              Dashboard, Leads, Quotations, Reports, Settings
     Job Consultancy  Dashboard, Job Postings, Candidates, Our Candidates, Messages,
                      Clients, Placements, Reports

   ACCESS: only Admin and CompanyAdmin get rights on them (full). Nobody else has them
   until an administrator ticks them in Users & Roles. No existing row is changed.

   Select the SaaS main database in SSMS before running. No USE statement on purpose.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.MenuItems') IS NULL
   OR OBJECT_ID('dbo.RoleMenuAccess') IS NULL OR OBJECT_ID('dbo.Modules') IS NULL
   OR COL_LENGTH('dbo.MenuItems', 'AppModuleId') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database (scripts 21 and 32 run) before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

DECLARE @Crm INT = (SELECT ModuleId FROM dbo.Modules WHERE ModuleKey = 'CRM');
DECLARE @Jobs INT = (SELECT ModuleId FROM dbo.Modules WHERE ModuleKey = 'JOBCONSULTANCY');

IF @Crm IS NULL OR @Jobs IS NULL
BEGIN
    RAISERROR('The CRM or JOBCONSULTANCY module was not found. Nothing was changed.', 16, 1);
    RETURN;
END

DECLARE @Items TABLE (ModuleId INT, GroupName NVARCHAR(150), GroupIcon NVARCHAR(100), GroupSort INT,
                      ItemPath NVARCHAR(300) PRIMARY KEY, ItemName NVARCHAR(150), Icon NVARCHAR(100), SortOrder INT);
INSERT INTO @Items VALUES
    (@Crm,  N'CRM', N'handshake', 80, N'/crm/dashboard',  N'CRM Dashboard', N'view_kanban',   1),
    (@Crm,  N'CRM', N'handshake', 80, N'/crm/leads',      N'Leads',         N'contacts',      2),
    (@Crm,  N'CRM', N'handshake', 80, N'/crm/quotations', N'Quotations',    N'request_quote', 3),
    (@Crm,  N'CRM', N'handshake', 80, N'/crm/reports',    N'CRM Reports',   N'bar_chart',     4),
    (@Crm,  N'CRM', N'handshake', 80, N'/crm/settings',   N'CRM Settings',  N'settings',      5),
    (@Jobs, N'Job Consultancy', N'work', 85, N'/consultancy/dashboard',      N'Consultancy Dashboard', N'dashboard',           1),
    (@Jobs, N'Job Consultancy', N'work', 85, N'/consultancy/postings',       N'Job Postings',          N'work_outline',        2),
    (@Jobs, N'Job Consultancy', N'work', 85, N'/consultancy/candidates',     N'Candidates',            N'groups',              3),
    (@Jobs, N'Job Consultancy', N'work', 85, N'/consultancy/our-candidates', N'Our Candidates',        N'badge',               4),
    (@Jobs, N'Job Consultancy', N'work', 85, N'/consultancy/messages',       N'Messages',              N'chat_bubble_outline', 5),
    (@Jobs, N'Job Consultancy', N'work', 85, N'/consultancy/clients',        N'Clients',               N'handshake',           6),
    (@Jobs, N'Job Consultancy', N'work', 85, N'/consultancy/placements',     N'Placements',            N'verified',            7),
    (@Jobs, N'Job Consultancy', N'work', 85, N'/consultancy/reports',        N'Consultancy Reports',   N'bar_chart',           8);

BEGIN TRANSACTION;

/* the two groups (no page of their own) */
INSERT INTO dbo.MenuItems (MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive, AppModuleId)
SELECT DISTINCT i.GroupName, NULL, i.GroupIcon, NULL, i.GroupSort, 1, i.ModuleId
FROM @Items i
WHERE NOT EXISTS (SELECT 1 FROM dbo.MenuItems m WHERE m.MenuName = i.GroupName AND m.ParentMenuId IS NULL AND m.AppModuleId = i.ModuleId);

/* the pages */
INSERT INTO dbo.MenuItems (MenuName, MenuPath, Icon, ParentMenuId, SortOrder, IsActive, AppModuleId)
SELECT i.ItemName, i.ItemPath, i.Icon, g.MenuId, i.SortOrder, 1, i.ModuleId
FROM @Items i
INNER JOIN dbo.MenuItems g ON g.MenuName = i.GroupName AND g.ParentMenuId IS NULL AND g.AppModuleId = i.ModuleId
WHERE NOT EXISTS (SELECT 1 FROM dbo.MenuItems m WHERE m.MenuPath = i.ItemPath);

/* the tenant administrators: everything */
INSERT INTO dbo.RoleMenuAccess (RoleId, MenuId, CanView, CanCreate, CanEdit, CanDelete)
SELECT r.RoleId, m.MenuId, 1,
       CASE WHEN m.MenuPath IS NULL THEN 0 ELSE 1 END,
       CASE WHEN m.MenuPath IS NULL THEN 0 ELSE 1 END,
       CASE WHEN m.MenuPath IS NULL THEN 0 ELSE 1 END
FROM dbo.Roles r
INNER JOIN dbo.MenuItems m ON m.AppModuleId IN (@Crm, @Jobs) AND m.IsActive = 1
WHERE r.RoleName IN ('Admin', 'CompanyAdmin')
  AND (m.MenuPath IN (SELECT ItemPath FROM @Items)
       OR (m.ParentMenuId IS NULL AND m.MenuName IN (SELECT GroupName FROM @Items)))
  AND NOT EXISTS (SELECT 1 FROM dbo.RoleMenuAccess x WHERE x.RoleId = r.RoleId AND x.MenuId = m.MenuId);

COMMIT TRANSACTION;

PRINT 'CRM and Job Consultancy menu entries are in place.';
GO
SET NOEXEC OFF;
GO
