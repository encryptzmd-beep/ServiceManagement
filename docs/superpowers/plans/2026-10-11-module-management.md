# Module Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A platform administrator can switch each module on or off per company, and an administrator can decide per user who may open each module, from the Platform Admin screen, without touching SQL.

**Architecture:** The tables already exist (`Modules`, `CompanyModules`, `UserModuleAccess`, Plan 1). This plan adds the procedures that manage them (a new numbered script), four API endpoints in the platform controller, and the screens: a "Modules" dialog per company and a module picker on the access tab. It also makes the user synchronisation safe when the Service module is switched off for a company, which is the precondition for shipping the switch.

**Tech Stack:** SQL Server scripts, ASP.NET Core (.NET 10) with ADO.NET, xUnit, Angular 21 (standalone components, signals, Vitest through `ng test`).

**Spec:** `docs/superpowers/specs/2026-10-11-saas-tenancy-design.md` (sections 4.1, 7.1; section 8 item 7 "Companies tab: module on/off")

**Plan series:**

1. Company-level routing and modules, backend — done
2. Staff scope flow UI — done
2b. Module management (this plan)
2c. Customer portal without the project picker; removal of the "project" compatibility layer; module choice at invite time (only useful once a second module exists)
3. Self-service company creation and database provisioning
4. Branch access

## Global Constraints

- The SQL Server in `EncryptzAPI/appsettings.json` is LIVE. Only `MainDBEncryptz` and `HamsterserviceDB` may be touched, and only with read-only `SELECT`. Never run a script from this plan or any repo script against it. Never run `dotnet run` or `ng serve`. Do not open or print `appsettings.json`.
- Every SQL change is a file in the repo whose name starts with a number, each with its own number. In `EncryptzAPI/Database/MainDB/` numbers `01`-`18` are used and FROZEN: never edit them. This plan adds `19`. The next free number after this plan is `20`.
- An SQL file is frozen once the task that creates it is complete (its review has passed). While its own task is open it may be edited.
- New SQL scripts contain no `USE`, `CREATE DATABASE`, `DROP DATABASE` or `DROP TABLE`. They refuse to run in a system database or without `dbo.Companies`. They are re-runnable.
- Only a platform administrator (`PlatformActor.IsPlatformAdmin`) may switch a module on or off for a company. An administrator of a company (`PlatformActor.CanManageCompany(companyId)`) may see the company's modules and decide which members may open a module.
- Users with company role `Admin` or `CompanyAdmin` have every module the company has: their access cannot be removed per module (change the role instead). Nobody can remove their own access.
- Switching a module off for a company must never deactivate, delete or change any user or technician in the company's tenant database. It only stops people from entering.
- Every endpoint added here is behind `[Authorize]` and the Platform Admin unlock (`[PlatformUnlocked]`), like the existing platform endpoints, and takes the company from the route, checked against the caller.
- Messages returned to users never contain server names, database names or SQL / exception text.
- In the Platform Admin screen the visible words become "Branch" (not "Location"), "Company database" (not "Project") and "Module access" (not "Project access"). Identifiers, API paths and class names keep their names in this plan (they are renamed in Plan 2c).
- Match the surrounding code style. Do not reformat files you touch.
- Run API/test commands from the repository root `D:\Encryptz\ServiceManagement`; run UI commands from `D:\Encryptz\ServiceManagement\encryptzUI` (`npx ng test --watch=false --include "<glob>"`, 5-minute timeout, never watch mode). Five old placeholder specs fail for reasons that predate this work (`app.spec.ts`, `add-user-component`, `customer-login-component`, `customer-register-component`, `landing-component`): leave them.

## Review Focus

1. A platform administrator switches the Service module off for a company whose people are working: nobody's user or technician row in the tenant database may be deactivated by the next synchronisation. Pinned in Task 2 (procedure) and Task 6 (verification).
2. A company administrator (not platform administrator) opens the Modules dialog: they must see the modules but must not be able to switch them, in the UI and on the server. Pinned in Task 1 and Task 4.
3. An administrator tries to remove a company `Admin`'s module access, or their own: refused with a clear message. Pinned in Task 2 (procedure) and Task 5 (the switch shows the refusal and stays on).
4. A module key that does not exist, is lower-case, or carries stray characters is sent to the API: refused or normalised, never passed raw into a query. Pinned in Task 1.
5. Script 14 is re-run later (it is re-runnable and re-creates `sp_Company_GetUsersForSync`): script 19 must be run again afterwards or the unsafe synchronisation comes back. Pinned in Task 2 (release notes).

## File Structure

| File | Responsibility |
|---|---|
| `EncryptzBL/Common/Tenant/ModuleAdminRules.cs` (new) | Pure rules: who may switch modules / manage access; module key normalisation |
| `EncryptzTests/ModuleAdminRulesTests.cs` (new) | Tests of those rules |
| `EncryptzAPI/Database/MainDB/19_Module_Management.sql` (new) | Procedures for company modules and module access; safe user-sync source |
| `EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md` | Script 19 in the release notes |
| `EncryptzBL/DTO's/PlatformDtos.cs` | `CompanyModuleDto`, request DTOs |
| `EncryptzBL/Infrastructure/User/Modules/IPlatformService.cs`, `PlatformService.cs` | Four service methods |
| `EncryptzAPI/Controllers/PlatformController.cs` | Four endpoints |
| `encryptzUI/src/app/Encryptz/Services/platform-service.ts` | Four HTTP calls, `CompanyModule` type |
| `encryptzUI/src/app/Encryptz/components/platform-admin-component/*` | Modules dialog, module picker on the access tab, wording |
| `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.spec.ts` (new) | Component tests |

---

### Task 1: Module administration rules

**Files:**
- Create: `EncryptzBL/Common/Tenant/ModuleAdminRules.cs`
- Create: `EncryptzTests/ModuleAdminRulesTests.cs`

**Interfaces:**
- Consumes: `EncryptzBL.DTO_s.PlatformActor` (`UserId`, `IsPlatformAdmin`, `IsCompanyAdmin`, `CompanyId`, `CanManageCompany(int companyId)`).
- Produces: `ModuleAdminRules.NormalizeKey(string? moduleKey) : string?` (upper-case, trimmed; `null` when empty, longer than 50, or containing anything but `A-Z`, `0-9`, `_`); `ModuleAdminRules.CanViewModules(PlatformActor actor, int companyId) : bool`; `ModuleAdminRules.CanSwitchModules(PlatformActor actor) : bool`; `ModuleAdminRules.CanManageAccess(PlatformActor actor, int companyId) : bool`.

- [ ] **Step 1: Write the failing test**

Create `EncryptzTests/ModuleAdminRulesTests.cs`:

```csharp
using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class ModuleAdminRulesTests
    {
        private static PlatformActor Platform() => new() { UserId = 1, IsPlatformAdmin = true };
        private static PlatformActor CompanyAdmin(int companyId) => new() { UserId = 2, IsCompanyAdmin = true, CompanyId = companyId };
        private static PlatformActor Member(int companyId) => new() { UserId = 3, CompanyId = companyId };

        [Theory]
        [InlineData("SERVICE", "SERVICE")]
        [InlineData(" service ", "SERVICE")]
        [InlineData("Sales_2", "SALES_2")]
        public void A_key_is_trimmed_and_upper_cased(string input, string expected)
        {
            Assert.Equal(expected, ModuleAdminRules.NormalizeKey(input));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("SERVICE'; DROP")]
        [InlineData("SER VICE")]
        [InlineData("SERVICE-1")]
        [InlineData("SERVICÉ")]
        public void A_key_with_anything_but_letters_digits_and_underscore_is_refused(string? input)
        {
            Assert.Null(ModuleAdminRules.NormalizeKey(input));
        }

        [Fact]
        public void A_key_longer_than_the_column_is_refused()
        {
            Assert.Null(ModuleAdminRules.NormalizeKey(new string('A', 51)));
            Assert.Equal(new string('A', 50), ModuleAdminRules.NormalizeKey(new string('A', 50)));
        }

        [Fact]
        public void Only_a_platform_administrator_switches_modules()
        {
            Assert.True(ModuleAdminRules.CanSwitchModules(Platform()));
            Assert.False(ModuleAdminRules.CanSwitchModules(CompanyAdmin(7)));
            Assert.False(ModuleAdminRules.CanSwitchModules(Member(7)));
        }

        [Fact]
        public void A_company_administrator_sees_the_modules_of_the_own_company_only()
        {
            Assert.True(ModuleAdminRules.CanViewModules(Platform(), 7));
            Assert.True(ModuleAdminRules.CanViewModules(CompanyAdmin(7), 7));
            Assert.False(ModuleAdminRules.CanViewModules(CompanyAdmin(7), 8));
            Assert.False(ModuleAdminRules.CanViewModules(Member(7), 7));
        }

        [Fact]
        public void Access_is_managed_by_the_platform_or_the_own_company_administrator()
        {
            Assert.True(ModuleAdminRules.CanManageAccess(Platform(), 7));
            Assert.True(ModuleAdminRules.CanManageAccess(CompanyAdmin(7), 7));
            Assert.False(ModuleAdminRules.CanManageAccess(CompanyAdmin(7), 8));
            Assert.False(ModuleAdminRules.CanManageAccess(Member(7), 7));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public void No_company_means_nothing_to_manage(int companyId)
        {
            Assert.False(ModuleAdminRules.CanViewModules(Platform(), companyId));
            Assert.False(ModuleAdminRules.CanManageAccess(Platform(), companyId));
            Assert.False(ModuleAdminRules.CanViewModules(CompanyAdmin(companyId), companyId));
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj --filter ModuleAdminRulesTests`
Expected: build error, `'ModuleAdminRules' could not be found`.

- [ ] **Step 3: Implement**

Create `EncryptzBL/Common/Tenant/ModuleAdminRules.cs`:

```csharp
using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Who may administer modules, and what a module key may look like.
    /// The platform decides which modules a company has; the company's own
    /// administrators decide which of their members may open them.
    /// </summary>
    public static class ModuleAdminRules
    {
        private const int MaxKeyLength = 50;   // Modules.ModuleKey NVARCHAR(50)

        /// <summary>Upper-cased, trimmed key, or null when it is not a possible module key.</summary>
        public static string? NormalizeKey(string? moduleKey)
        {
            if (string.IsNullOrWhiteSpace(moduleKey))
                return null;

            var key = moduleKey.Trim().ToUpperInvariant();
            if (key.Length > MaxKeyLength)
                return null;

            foreach (var ch in key)
            {
                var allowed = (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_';
                if (!allowed)
                    return null;
            }

            return key;
        }

        /// <summary>Switching a module on or off is a platform (subscription) decision.</summary>
        public static bool CanSwitchModules(PlatformActor actor)
            => actor.IsPlatformAdmin;

        public static bool CanViewModules(PlatformActor actor, int companyId)
            => companyId > 0 && actor.CanManageCompany(companyId);

        public static bool CanManageAccess(PlatformActor actor, int companyId)
            => companyId > 0 && actor.CanManageCompany(companyId);
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj`
Expected: `Passed!`, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add EncryptzBL/Common/Tenant/ModuleAdminRules.cs EncryptzTests/ModuleAdminRulesTests.cs
git commit -m "Add the rules for administering modules"
```

---

### Task 2: Script 19 — module management procedures and a safe user sync

**Files:**
- Create: `EncryptzAPI/Database/MainDB/19_Module_Management.sql`
- Modify: `EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md`
- Read only: `EncryptzAPI/Database/MainDB/14_Company_Tenancy_Cutover.sql` (the definitions of `fn_ModuleUsers`, `sp_Company_GetUsersForSync`, `sp_Platform_GetProjectAccess`, `sp_Platform_SetProjectAccess`)

**Interfaces:**
- Consumes: tables `Modules`, `CompanyModules`, `UserModuleAccess`, `CompanyUsers`, `Companies`, `Users`; function `dbo.fn_ModuleUsers(@CompanyId, @ModuleKey)` (script 14).
- Produces (result-set columns are what Task 3 reads):
  - `sp_Platform_GetCompanyModules(@CompanyId INT)` → `ModuleId, ModuleKey, ModuleName, Description, Icon, SortOrder, IsEnabled (BIT), UserCount (INT)`
  - `sp_Platform_SetCompanyModule(@CompanyId INT, @ModuleKey NVARCHAR(50), @IsEnabled BIT, @SavedBy INT = NULL)` → `Success (INT), Message`
  - `sp_Platform_GetModuleAccess(@CompanyId INT, @ModuleKey NVARCHAR(50))` → `UserId, FullName, Email, MobileNumber, RoleInCompany, HasAccess (BIT), GrantedAt, GrantedByName`
  - `sp_Platform_SetModuleAccess(@CompanyId INT, @ModuleKey NVARCHAR(50), @UserId INT, @HasAccess BIT, @GrantedBy INT = NULL)` → `Success (INT), Message`
  - `sp_Company_GetUsersForSync(@CompanyId INT, @UserId INT = NULL)` re-created with the same two result sets; the first is EMPTY when the company does not have the Service module switched on.

Background on the last one. The API mirrors the company's Service users into the tenant database: `TenantUserSyncService` calls `sp_Company_GetUsersForSync`, and when the first result set is empty it treats the company as "no ready database" and does nothing. As written in script 14 the procedure returns the company row even when the Service module is switched off, with an empty user list (`fn_ModuleUsers` returns nobody), and a full sync with an empty list deactivates every mirrored user and technician in the tenant database. Returning no company row in that case makes the sync skip the company entirely.

- [ ] **Step 1: Write the script**

Create `EncryptzAPI/Database/MainDB/19_Module_Management.sql`:

```sql
/* =============================================================================
   MainDB · Module management
   -----------------------------------------------------------------------------
   Run AFTER 14_Company_Tenancy_Cutover.sql, with the new API. Run it AGAIN
   every time script 14 is run again: script 14 re-creates
   dbo.sp_Company_GetUsersForSync in its earlier form.

     sp_Platform_GetCompanyModules   the catalogue with what a company has
     sp_Platform_SetCompanyModule    switch a module on / off for a company
     sp_Platform_GetModuleAccess     the company's members and who may open a module
     sp_Platform_SetModuleAccess     give / take a member's access to a module
     sp_Company_GetUsersForSync      re-created: a company whose Service module is
                                     switched off is NOT synchronised, so switching
                                     the module off never deactivates anybody in
                                     the company's own database

   Nothing here changes a table or any data. It changes nothing in any tenant
   database.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose. SAFE TO RE-RUN.
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

IF OBJECT_ID('dbo.Companies') IS NOT NULL
   AND (   OBJECT_ID('dbo.Modules') IS NULL
        OR OBJECT_ID('dbo.CompanyModules') IS NULL
        OR OBJECT_ID('dbo.UserModuleAccess') IS NULL
        OR OBJECT_ID('dbo.fn_ModuleUsers') IS NULL)
BEGIN
    RAISERROR('Run 13_Company_Tenancy_Schema.sql and 14_Company_Tenancy_Cutover.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   The catalogue, with what the company has and how many members can open each
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetCompanyModules
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.ModuleId, m.ModuleKey, m.ModuleName,
        ISNULL(m.Description, '') AS Description,
        ISNULL(m.Icon, '')        AS Icon,
        m.SortOrder,
        CAST(ISNULL(cm.IsEnabled, 0) AS BIT) AS IsEnabled,
        (SELECT COUNT(*) FROM dbo.fn_ModuleUsers(@CompanyId, m.ModuleKey)) AS UserCount
    FROM dbo.Modules m
    LEFT JOIN dbo.CompanyModules cm ON cm.ModuleId = m.ModuleId AND cm.CompanyId = @CompanyId
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* -----------------------------------------------------------------------------
   Switch a module on / off for a company (its subscription).
   Switching off keeps every member's grant: switching on again restores who
   could open it.
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SetCompanyModule
    @CompanyId INT,
    @ModuleKey NVARCHAR(50),
    @IsEnabled BIT,
    @SavedBy   INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ModuleId INT, @ModuleName NVARCHAR(150);

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message; RETURN;
    END

    SELECT @ModuleId = ModuleId, @ModuleName = ModuleName
    FROM dbo.Modules
    WHERE ModuleKey = @ModuleKey AND IsActive = 1;

    IF @ModuleId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Module not found' AS Message; RETURN;
    END

    SET @IsEnabled = ISNULL(@IsEnabled, 0);

    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM dbo.CompanyModules WITH (UPDLOCK, HOLDLOCK)
               WHERE CompanyId = @CompanyId AND ModuleId = @ModuleId)
        UPDATE dbo.CompanyModules
        SET IsEnabled = @IsEnabled, UpdatedAt = GETDATE()
        WHERE CompanyId = @CompanyId AND ModuleId = @ModuleId;
    ELSE
        INSERT INTO dbo.CompanyModules (CompanyId, ModuleId, IsEnabled)
        VALUES (@CompanyId, @ModuleId, @IsEnabled);

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success,
           @ModuleName + CASE WHEN @IsEnabled = 1 THEN ' switched on' ELSE ' switched off' END AS Message;
END
GO

/* -----------------------------------------------------------------------------
   The company's active members, with whether they may open the module.
   Company administrators always may (no grant row needed).
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetModuleAccess
    @CompanyId INT,
    @ModuleKey NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId, u.FullName, u.Email, ISNULL(u.MobileNumber, '') AS MobileNumber,
        cu.RoleInCompany,
        CAST(CASE WHEN LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin') OR uma.UserId IS NOT NULL
                  THEN 1 ELSE 0 END AS BIT) AS HasAccess,
        uma.GrantedAt,
        ISNULL(gb.FullName, '') AS GrantedByName
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Users u   ON u.UserId = cu.UserId AND u.IsActive = 1
    LEFT  JOIN dbo.Modules m ON m.ModuleKey = @ModuleKey AND m.IsActive = 1
    LEFT  JOIN dbo.UserModuleAccess uma
           ON uma.CompanyId = cu.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId
    LEFT  JOIN dbo.Users gb  ON gb.UserId = uma.GrantedBy
    WHERE cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
    ORDER BY u.FullName;
END
GO

/* -----------------------------------------------------------------------------
   Give / take a member's access to a module of the company
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SetModuleAccess
    @CompanyId INT,
    @ModuleKey NVARCHAR(50),
    @UserId    INT,
    @HasAccess BIT,
    @GrantedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Role NVARCHAR(100), @ModuleId INT;

    SELECT @ModuleId = ModuleId FROM dbo.Modules WHERE ModuleKey = @ModuleKey AND IsActive = 1;

    IF @ModuleId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Module not found' AS Message; RETURN;
    END

    SELECT @Role = RoleInCompany
    FROM dbo.CompanyUsers
    WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1;

    IF @Role IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The user is not an active member of the company' AS Message; RETURN;
    END

    SET @HasAccess = ISNULL(@HasAccess, 0);

    IF @HasAccess = 0 AND @UserId = @GrantedBy
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You cannot remove your own access' AS Message; RETURN;
    END

    IF @HasAccess = 0 AND LTRIM(RTRIM(@Role)) IN ('Admin', 'CompanyAdmin')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company administrators always have access. Change the role instead.' AS Message; RETURN;
    END

    IF @HasAccess = 1
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess
                       WHERE CompanyId = @CompanyId AND UserId = @UserId AND ModuleId = @ModuleId)
            INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
            VALUES (@CompanyId, @UserId, @ModuleId, @GrantedBy);
    END
    ELSE
        DELETE FROM dbo.UserModuleAccess
        WHERE CompanyId = @CompanyId AND UserId = @UserId AND ModuleId = @ModuleId;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @HasAccess = 1 THEN 'Access granted' ELSE 'Access removed' END AS Message;
END
GO

/* -----------------------------------------------------------------------------
   The company's routing info and the users the tenant DB must mirror.
   RE-CREATED from script 14 with one change: the first result set is empty
   when the company does not have the Service module switched on. The API then
   skips the synchronisation, so nobody in the tenant database is deactivated
   because the module was switched off. (With the module on, the second result
   set is every active user who may open it, as before.)
   ----------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GetUsersForSync
    @CompanyId INT,
    @UserId    INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.CompanyId, c.TenantKey, c.TenantScopeId
    FROM dbo.Companies c
    WHERE c.CompanyId = @CompanyId
      AND c.IsActive = 1
      AND c.ProvisionStatus = 'Ready'
      AND EXISTS (SELECT 1
                  FROM dbo.CompanyModules cm
                  INNER JOIN dbo.Modules m ON m.ModuleId = cm.ModuleId
                  WHERE cm.CompanyId = c.CompanyId
                    AND cm.IsEnabled = 1
                    AND m.ModuleKey = 'SERVICE'
                    AND m.IsActive = 1);

    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber, mu.RoleInCompany
    FROM dbo.fn_ModuleUsers(@CompanyId, 'SERVICE') mu
    INNER JOIN dbo.Users u ON u.UserId = mu.UserId AND u.IsActive = 1
    WHERE @UserId IS NULL OR u.UserId = @UserId
    ORDER BY u.UserId;
END
GO

PRINT 'Module management procedures are in place.';
GO
SET NOEXEC OFF;
GO
```

- [ ] **Step 2: Check the script without running it**

Run:

```bash
grep -nEi "^\s*USE |CREATE DATABASE|DROP DATABASE|DROP TABLE|ALTER TABLE|CREATE TABLE" EncryptzAPI/Database/MainDB/19_Module_Management.sql
grep -c "^CREATE OR ALTER PROCEDURE" EncryptzAPI/Database/MainDB/19_Module_Management.sql
git status --short EncryptzAPI/Database/MainDB/
```

Expected: first prints nothing; second prints `5`; third lists only `19_Module_Management.sql` as untracked.

Then compare, by reading, the re-created `sp_Company_GetUsersForSync` with the one in `14_Company_Tenancy_Cutover.sql`: same parameters, same column names and order in both result sets; the only difference is the added `EXISTS` condition. Compare `sp_Platform_GetModuleAccess` with `sp_Platform_GetProjectAccess` in script 14: same eight columns in the same order. Write both comparisons in your report.

- [ ] **Step 3: Update the release notes**

Edit `EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md` (read it fully first; keep its style; verify each statement against the scripts):

1. Script list: add `19_Module_Management.sql` after script 14 in the order of use: "run after script 14: the procedures behind the Modules switch and module access in Platform Admin; also makes switching the Service module off safe".
2. Release section: add the step "run script 19" right after script 14 and before the API is started.
3. Add the rule, where script 14's re-run is described and in "Things to know": "Every time script 14 is run again, run script 19 again afterwards. Script 14 re-creates one procedure in its earlier form."
4. Replace the "Things to know" warning that says not to switch the Service module off by SQL (it says the next synchronisation would deactivate every user and technician) with: "Switch modules in Platform Admin (Companies, Modules). With script 19 in place, switching the Service module off for a company stops its people from entering and changes nothing in its database; switching it on again restores who could open it. People who are already working in the module keep working until their login expires (the check is made when a module is opened). Without script 19 the earlier danger applies: do not switch a module off before script 19 has been run."
5. "Never edit these scripts": the frozen list now includes 19; the next free number is `20`.
6. Undo section: add one line: "Script 19 needs no undo. Its procedures are used only by the new API."
7. "Check after the release": add "In Platform Admin, open Modules for a company: the Service module is on. (Do not switch it off on the live system as a test.)"
8. "Rehearsal on copies": add the cases "switch the Service module off for the test company: its members see the card disabled with 'Not subscribed', and no user or technician in the tenant copy changed (compare `SELECT COUNT(*) FROM dbo.Users WHERE IsActive = 1` in the tenant copy before and after, also after saving a user in Access Management)" and "switch it on again: the same members can enter".

- [ ] **Step 4: Commit**

```bash
git add EncryptzAPI/Database/MainDB/19_Module_Management.sql EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md
git commit -m "Add module management procedures and a sync that skips a company without the Service module"
```

---

### Task 3: API for company modules and module access

**Files:**
- Modify: `EncryptzBL/DTO's/PlatformDtos.cs`
- Modify: `EncryptzBL/Infrastructure/User/Modules/IPlatformService.cs`
- Modify: `EncryptzBL/Infrastructure/User/Modules/PlatformService.cs`
- Modify: `EncryptzAPI/Controllers/PlatformController.cs`
- Create: `EncryptzTests/PlatformModuleEndpointsTests.cs`

**Interfaces:**
- Consumes: `ModuleAdminRules` (Task 1); the four procedures of Task 2; existing `PlatformService` members `GetListAsync<T>`, `GetDataTableAsync`, `_userSync.TrySyncCompanyUsersAsync(int companyId)`, `NotAllowed`; existing `ProjectAccessDto`, `SetProjectAccessRequest { UserId, HasAccess }`; `PlatformUnlockedAttribute`; `PlatformController.Actor()`.
- Produces:
  - DTO `CompanyModuleDto { int ModuleId; string ModuleKey; string ModuleName; string Description; string Icon; int SortOrder; bool IsEnabled; int UserCount; }`, `SetCompanyModuleRequest { string ModuleKey; bool IsEnabled; }`
  - `IPlatformService.GetCompanyModules(int companyId, PlatformActor actor) : Task<ApiResponse<List<CompanyModuleDto>>>`
  - `IPlatformService.SetCompanyModule(int companyId, SetCompanyModuleRequest req, PlatformActor actor) : Task<ApiResponse<bool>>`
  - `IPlatformService.GetModuleAccess(int companyId, string moduleKey, PlatformActor actor) : Task<ApiResponse<List<ProjectAccessDto>>>`
  - `IPlatformService.SetModuleAccess(int companyId, string moduleKey, SetProjectAccessRequest req, PlatformActor actor) : Task<ApiResponse<bool>>`
  - Endpoints (all `[PlatformUnlocked]`, controller is `[Authorize]`): `GET api/platform/companies/{companyId}/modules`; `POST api/platform/companies/{companyId}/modules` (body `{ moduleKey, isEnabled }`); `GET api/platform/companies/{companyId}/modules/{moduleKey}/access`; `POST api/platform/companies/{companyId}/modules/{moduleKey}/access` (body `{ userId, hasAccess }`)

The service methods only talk to the database, so their behaviour is pinned by Task 1's rule tests and by a reflection test that the endpoints exist with the right protection.

- [ ] **Step 1: Write the failing test**

Create `EncryptzTests/PlatformModuleEndpointsTests.cs`:

```csharp
using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class PlatformModuleEndpointsTests
    {
        private static MethodInfo Action(string name)
            => typeof(PlatformController).GetMethod(name)
               ?? throw new Xunit.Sdk.XunitException($"PlatformController.{name} does not exist");

        [Theory]
        [InlineData("GetCompanyModules", "GET", "companies/{companyId}/modules")]
        [InlineData("SetCompanyModule", "POST", "companies/{companyId}/modules")]
        [InlineData("GetModuleAccess", "GET", "companies/{companyId}/modules/{moduleKey}/access")]
        [InlineData("SetModuleAccess", "POST", "companies/{companyId}/modules/{moduleKey}/access")]
        public void The_module_endpoints_exist_with_their_routes(string action, string verb, string template)
        {
            var http = Action(action).GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
        }

        [Theory]
        [InlineData("GetCompanyModules")]
        [InlineData("SetCompanyModule")]
        [InlineData("GetModuleAccess")]
        [InlineData("SetModuleAccess")]
        public void The_module_endpoints_need_a_login_and_the_platform_unlock(string action)
        {
            Assert.NotNull(typeof(PlatformController).GetCustomAttribute<AuthorizeAttribute>());
            Assert.NotNull(Action(action).GetCustomAttribute<PlatformUnlockedAttribute>());
            Assert.Null(Action(action).GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Theory]
        [InlineData("GetCompanyModules")]
        [InlineData("SetCompanyModule")]
        [InlineData("GetModuleAccess")]
        [InlineData("SetModuleAccess")]
        public void The_company_comes_from_the_route(string action)
        {
            var companyId = Action(action).GetParameters().Single(p => p.Name == "companyId");

            Assert.Equal(typeof(int), companyId.ParameterType);
            Assert.Null(companyId.GetCustomAttribute<FromBodyAttribute>());
            Assert.Null(companyId.GetCustomAttribute<FromQueryAttribute>());
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj --filter PlatformModuleEndpointsTests`
Expected: FAIL, `PlatformController.GetCompanyModules does not exist`.

- [ ] **Step 3: DTOs**

In `EncryptzBL/DTO's/PlatformDtos.cs`, add after `SetProjectAccessRequest` (inside the first namespace block):

```csharp
    /// <summary>One module of the catalogue as a company has it.</summary>
    public class CompanyModuleDto
    {
        public int ModuleId { get; set; }
        public string ModuleKey { get; set; } = "";
        public string ModuleName { get; set; } = "";
        public string Description { get; set; } = "";
        public string Icon { get; set; } = "";
        public int SortOrder { get; set; }
        public bool IsEnabled { get; set; }
        /// <summary>Members who can open it now (0 while it is switched off).</summary>
        public int UserCount { get; set; }
    }

    public class SetCompanyModuleRequest
    {
        public string ModuleKey { get; set; } = "";
        public bool IsEnabled { get; set; }
    }
```

- [ ] **Step 4: Service**

In `IPlatformService.cs` add before the menu methods:

```csharp
        Task<ApiResponse<List<CompanyModuleDto>>> GetCompanyModules(int companyId, PlatformActor actor);
        Task<ApiResponse<bool>> SetCompanyModule(int companyId, SetCompanyModuleRequest req, PlatformActor actor);

        Task<ApiResponse<List<ProjectAccessDto>>> GetModuleAccess(int companyId, string moduleKey, PlatformActor actor);
        Task<ApiResponse<bool>> SetModuleAccess(int companyId, string moduleKey, SetProjectAccessRequest req, PlatformActor actor);
```

In `PlatformService.cs` add `using EncryptzBL.Common.Tenant;` if it is not there, and add this region before the `// MENU TREE` region:

```csharp
        // ============================================
        // MODULES OF A COMPANY + WHO MAY OPEN THEM
        // ============================================

        public async Task<ApiResponse<List<CompanyModuleDto>>> GetCompanyModules(int companyId, PlatformActor actor)
        {
            if (!ModuleAdminRules.CanViewModules(actor, companyId))
                return ApiResponse<List<CompanyModuleDto>>.Fail(NotAllowed);

            var list = await GetListAsync<CompanyModuleDto>("sp_Platform_GetCompanyModules", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId)
            });

            return ApiResponse<List<CompanyModuleDto>>.Ok(list);
        }

        public async Task<ApiResponse<bool>> SetCompanyModule(int companyId, SetCompanyModuleRequest req, PlatformActor actor)
        {
            // which modules a company has is its subscription: platform only
            if (companyId <= 0 || !ModuleAdminRules.CanSwitchModules(actor))
                return ApiResponse<bool>.Fail("Only a platform administrator can switch modules");

            var moduleKey = ModuleAdminRules.NormalizeKey(req?.ModuleKey);
            if (moduleKey == null)
                return ApiResponse<bool>.Fail("Module not found");

            var dt = await GetDataTableAsync("sp_Platform_SetCompanyModule", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ModuleKey", moduleKey),
                SqlParameterHelper.Input("@IsEnabled", req!.IsEnabled),
                SqlParameterHelper.Input("@SavedBy", actor.UserId)
            });

            var result = ToFlag(dt);

            // Switched ON: the company's users must be in its database again.
            // Switched OFF: nothing is synchronised (the procedure behind the sync
            // returns no company), so nobody in the tenant database changes.
            if (result.Success && req.IsEnabled)
                await _userSync.TrySyncCompanyUsersAsync(companyId);

            return result;
        }

        public async Task<ApiResponse<List<ProjectAccessDto>>> GetModuleAccess(int companyId, string moduleKey, PlatformActor actor)
        {
            if (!ModuleAdminRules.CanManageAccess(actor, companyId))
                return ApiResponse<List<ProjectAccessDto>>.Fail(NotAllowed);

            var key = ModuleAdminRules.NormalizeKey(moduleKey);
            if (key == null)
                return ApiResponse<List<ProjectAccessDto>>.Fail("Module not found");

            var list = await GetListAsync<ProjectAccessDto>("sp_Platform_GetModuleAccess", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ModuleKey", key)
            });

            return ApiResponse<List<ProjectAccessDto>>.Ok(list);
        }

        public async Task<ApiResponse<bool>> SetModuleAccess(int companyId, string moduleKey, SetProjectAccessRequest req, PlatformActor actor)
        {
            if (!ModuleAdminRules.CanManageAccess(actor, companyId))
                return ApiResponse<bool>.Fail(NotAllowed);

            var key = ModuleAdminRules.NormalizeKey(moduleKey);
            if (key == null || req == null || req.UserId <= 0)
                return ApiResponse<bool>.Fail("Module or user not found");

            var dt = await GetDataTableAsync("sp_Platform_SetModuleAccess", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ModuleKey", key),
                SqlParameterHelper.Input("@UserId", req.UserId),
                SqlParameterHelper.Input("@HasAccess", req.HasAccess),
                SqlParameterHelper.Input("@GrantedBy", actor.UserId)
            });

            var result = ToFlag(dt);

            // the company DB mirrors who may work in the Service module (users, technicians)
            if (result.Success && key == ModuleAccess.ServiceModuleKey)
                await _userSync.TrySyncCompanyUsersAsync(companyId);

            return result;
        }

        /// <summary>Procs answer with Success and Message.</summary>
        private static ApiResponse<bool> ToFlag(DataTable? dt)
        {
            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<bool>.Fail("Save failed");

            var message = dt.Rows[0]["Message"]?.ToString() ?? "";

            return Convert.ToInt32(dt.Rows[0]["Success"]) == 1
                ? ApiResponse<bool>.Ok(true, message)
                : ApiResponse<bool>.Fail(message);
        }
```

- [ ] **Step 5: Controller**

In `PlatformController.cs`, add before the `// ── MENU TREE` block:

```csharp
        // ── MODULES OF A COMPANY ──────────────────

        [PlatformUnlocked]
        [HttpGet("companies/{companyId}/modules")]
        public async Task<IActionResult> GetCompanyModules(int companyId)
            => Ok(await _service.GetCompanyModules(companyId, Actor()));

        [PlatformUnlocked]
        [HttpPost("companies/{companyId}/modules")]
        public async Task<IActionResult> SetCompanyModule(int companyId, [FromBody] SetCompanyModuleRequest req)
            => Ok(await _service.SetCompanyModule(companyId, req, Actor()));

        [PlatformUnlocked]
        [HttpGet("companies/{companyId}/modules/{moduleKey}/access")]
        public async Task<IActionResult> GetModuleAccess(int companyId, string moduleKey)
            => Ok(await _service.GetModuleAccess(companyId, moduleKey, Actor()));

        [PlatformUnlocked]
        [HttpPost("companies/{companyId}/modules/{moduleKey}/access")]
        public async Task<IActionResult> SetModuleAccess(int companyId, string moduleKey, [FromBody] SetProjectAccessRequest req)
            => Ok(await _service.SetModuleAccess(companyId, moduleKey, req, Actor()));
```

- [ ] **Step 6: Run to verify it passes**

Run: `dotnet build EncryptzAPI/EncryptzAPI.csproj 2>&1 | grep -cE "error CS"` — expected `0`.
Run: `dotnet test EncryptzTests/EncryptzTests.csproj` — expected `Passed!`, 0 failed.

- [ ] **Step 7: Commit**

```bash
git add "EncryptzBL/DTO's/PlatformDtos.cs" EncryptzBL/Infrastructure/User/Modules/IPlatformService.cs EncryptzBL/Infrastructure/User/Modules/PlatformService.cs EncryptzAPI/Controllers/PlatformController.cs EncryptzTests/PlatformModuleEndpointsTests.cs
git commit -m "Add API to switch a company's modules and manage who may open them"
```

---

### Task 4: Modules dialog in Platform Admin

**Files:**
- Modify: `encryptzUI/src/app/Encryptz/Services/platform-service.ts`
- Modify: `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.ts`
- Modify: `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.html`
- Create: `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.spec.ts`

**Interfaces:**
- Consumes: the endpoints of Task 3.
- Produces on the UI `PlatformService`: `interface CompanyModule { moduleId: number; moduleKey: string; moduleName: string; description: string; icon: string; sortOrder: number; isEnabled: boolean; userCount: number; }`; `getCompanyModules(companyId: number): Observable<ApiResponse<CompanyModule[]>>`; `setCompanyModule(companyId: number, moduleKey: string, isEnabled: boolean): Observable<ApiResponse<boolean>>`; `getModuleAccess(companyId: number, moduleKey: string): Observable<ApiResponse<ProjectAccess[]>>`; `setModuleAccess(companyId: number, moduleKey: string, userId: number, hasAccess: boolean): Observable<ApiResponse<boolean>>`.
- Produces on the component: `modulesCompany: PlatformCompany | null`, `companyModules = signal<CompanyModule[]>([])`, `openModules(company)`, `toggleCompanyModule(module)`, `closeModules()`.

- [ ] **Step 1: Write the failing tests**

Create `platform-admin-component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { PlatformService } from '../../Services/platform-service';
import { PlatformAdminComponent } from './platform-admin-component';

describe('PlatformAdminComponent modules', () => {
  const company = { companyId: 2, companyName: 'Hamster A/C', companyCode: 'C002', address: '', city: '', phoneNumber: '', isActive: true, projectCount: 1, userCount: 3 };
  const serviceModule = { moduleId: 1, moduleKey: 'SERVICE', moduleName: 'Service Management', description: 'd', icon: 'build', sortOrder: 1, isEnabled: true, userCount: 3 };
  const salesModule = { moduleId: 2, moduleKey: 'SALES', moduleName: 'Sales', description: 'd', icon: 'sell', sortOrder: 2, isEnabled: false, userCount: 0 };

  let api: any;
  let calls: any[][];

  const create = (isPlatformAdmin: boolean) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PlatformAdminComponent],
      providers: [
        { provide: PlatformService, useValue: api },
        { provide: AuthService, useValue: {
          currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin }),
          selectedCompanyId: () => 2,
        } },
      ],
    });
    const fixture = TestBed.createComponent(PlatformAdminComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    calls = [];
    api = {
      isUnlocked: () => of({ success: true, unlocked: true }),
      getCompanies: () => of({ success: true, message: '', data: [company] }),
      getProjects: () => of({ success: true, message: '', data: [] }),
      getCompanyModules: (companyId: number) => { calls.push(['getCompanyModules', companyId]); return of({ success: true, message: '', data: [serviceModule, salesModule] }); },
      setCompanyModule: (companyId: number, key: string, on: boolean) => { calls.push(['setCompanyModule', companyId, key, on]); return of({ success: true, message: 'Sales switched on', data: true }); },
      lock: () => {},
    };
  });

  const openDialog = (fixture: any) => {
    fixture.componentInstance.openModules(company);
    fixture.detectChanges();
  };

  it('offers Modules on each company row', () => {
    const fixture = create(true);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.some(b => b.textContent?.trim() === 'Modules')).toBe(true);
  });

  it('lists every module of the catalogue for the company', () => {
    const fixture = create(true);
    openDialog(fixture);

    expect(calls).toContainEqual(['getCompanyModules', 2]);
    const rows = fixture.nativeElement.querySelectorAll('.pa-module-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Service Management');
    expect(rows[1].textContent).toContain('Sales');
  });

  it('lets a platform administrator switch a module', () => {
    const fixture = create(true);
    openDialog(fixture);

    const boxes = fixture.nativeElement.querySelectorAll('.pa-module-row input[type=checkbox]') as NodeListOf<HTMLInputElement>;
    expect(boxes[1].disabled).toBe(false);
    boxes[1].click();
    fixture.detectChanges();

    expect(calls).toContainEqual(['setCompanyModule', 2, 'SALES', true]);
    expect(fixture.componentInstance.companyModules()[1].isEnabled).toBe(true);
  });

  it('shows the modules read-only to a company administrator', () => {
    const fixture = create(false);
    openDialog(fixture);

    const boxes = fixture.nativeElement.querySelectorAll('.pa-module-row input[type=checkbox]') as NodeListOf<HTMLInputElement>;
    expect(boxes.length).toBe(2);
    expect(boxes[0].disabled).toBe(true);
    expect(boxes[1].disabled).toBe(true);

    fixture.componentInstance.toggleCompanyModule(salesModule as any);
    expect(calls.some(c => c[0] === 'setCompanyModule')).toBe(false);
  });

  it('keeps the switch as it was when the server refuses', () => {
    api.setCompanyModule = (companyId: number, key: string, on: boolean) => {
      calls.push(['setCompanyModule', companyId, key, on]);
      return of({ success: false, message: 'Only a platform administrator can switch modules', data: false });
    };
    const fixture = create(true);
    openDialog(fixture);

    fixture.componentInstance.toggleCompanyModule(salesModule as any);
    fixture.detectChanges();

    expect(fixture.componentInstance.companyModules()[1].isEnabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Only a platform administrator can switch modules');
  });

  it('asks before switching the Service module off', () => {
    const fixture = create(true);
    openDialog(fixture);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    fixture.componentInstance.toggleCompanyModule(serviceModule as any);

    expect(confirmSpy).toHaveBeenCalled();
    expect(calls.some(c => c[0] === 'setCompanyModule')).toBe(false);
    confirmSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

From `encryptzUI`, run: `npx ng test --watch=false --include "src/app/Encryptz/components/platform-admin-component/**/*.spec.ts" 2>&1 | tail -25`
Expected: build errors (`openModules`, `companyModules`, `toggleCompanyModule` do not exist).

- [ ] **Step 3: Service calls**

In `platform-service.ts` add after the `ProjectAccess` interface:

```ts
/** One module of the catalogue as a company has it. */
export interface CompanyModule {
  moduleId: number;
  moduleKey: string;
  moduleName: string;
  description: string;
  icon: string;
  sortOrder: number;
  isEnabled: boolean;
  /** Members who can open it now. */
  userCount: number;
}
```

and add these methods to the class, after `setProjectAccess`:

```ts
  getCompanyModules(companyId: number): Observable<ApiResponse<CompanyModule[]>> {
    return this.http.get<ApiResponse<CompanyModule[]>>(`${this.api}/companies/${companyId}/modules`, { headers: this.headers });
  }

  setCompanyModule(companyId: number, moduleKey: string, isEnabled: boolean): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/companies/${companyId}/modules`, { moduleKey, isEnabled }, { headers: this.headers });
  }

  getModuleAccess(companyId: number, moduleKey: string): Observable<ApiResponse<ProjectAccess[]>> {
    return this.http.get<ApiResponse<ProjectAccess[]>>(`${this.api}/companies/${companyId}/modules/${encodeURIComponent(moduleKey)}/access`, { headers: this.headers });
  }

  setModuleAccess(companyId: number, moduleKey: string, userId: number, hasAccess: boolean): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/companies/${companyId}/modules/${encodeURIComponent(moduleKey)}/access`, { userId, hasAccess }, { headers: this.headers });
  }
```

- [ ] **Step 4: Component**

In `platform-admin-component.ts`:

(a) Add `CompanyModule,` to the import list from `'../../Services/platform-service'`.

(b) Add these members after the `menus = signal<PlatformMenu[]>([]);` line:

```ts
  /** Company whose Modules dialog is open (null = closed). */
  modulesCompany: PlatformCompany | null = null;
  companyModules = signal<CompanyModule[]>([]);
```

(c) Add this block before the `// ── projects + database` section:

```ts
  // ── modules of a company ──────────────────────────────────────────────────

  openModules(company: PlatformCompany): void {
    this.formError.set('');
    this.modulesCompany = company;
    this.companyModules.set([]);
    this.api.getCompanyModules(company.companyId).subscribe({
      next: res => {
        if (res.success) this.companyModules.set(res.data ?? []);
        else this.formError.set(res.message);
      },
      error: err => { if (this.isLocked(err)) return; this.formError.set(this.message(err, 'Could not load the modules')); },
    });
  }

  closeModules(): void {
    this.modulesCompany = null;
    this.companyModules.set([]);
    this.formError.set('');
  }

  /** Which modules a company has is a platform decision: others see the list read-only. */
  toggleCompanyModule(module: CompanyModule, event?: Event): void {
    const company = this.modulesCompany;
    if (!company || !this.isPlatformAdmin()) { this.redraw(event, module.isEnabled); return; }

    const switchOn = !module.isEnabled;
    if (!switchOn && !window.confirm(
      `Switch ${module.moduleName} off for ${company.companyName}? Its people will not be able to open it until it is switched on again.`)) {
      this.redraw(event, module.isEnabled);
      return;
    }

    this.formError.set('');
    this.api.setCompanyModule(company.companyId, module.moduleKey, switchOn).subscribe({
      next: res => {
        if (!res.success) {
          this.formError.set(res.message);
          this.redraw(event, module.isEnabled);
          return;
        }
        this.companyModules.update(list =>
          list.map(m => m.moduleKey === module.moduleKey ? { ...m, isEnabled: switchOn } : m));
        this.notify(res.message, true);
      },
      error: err => {
        this.redraw(event, module.isEnabled);
        if (this.isLocked(err)) return;
        this.formError.set(this.message(err, 'Could not switch the module'));
      },
    });
  }

  /**
   * A click toggles the checkbox before we know the outcome. When the state did
   * not change, the [checked] binding sees the same value and does not touch the
   * element, so put the box back by hand.
   */
  private redraw(event: Event | undefined, checked: boolean): void {
    const box = event?.target as HTMLInputElement | null | undefined;
    if (box) box.checked = checked;
  }
```

Add this test to the first `describe` of the spec (Step 1), after "keeps the switch as it was when the server refuses":

```ts
  it('puts the checkbox back when the server refuses', () => {
    api.setCompanyModule = () => of({ success: false, message: 'No', data: false });
    const fixture = create(true);
    openDialog(fixture);

    const boxes = fixture.nativeElement.querySelectorAll('.pa-module-row input[type=checkbox]') as NodeListOf<HTMLInputElement>;
    boxes[1].click();
    fixture.detectChanges();

    expect(boxes[1].checked).toBe(false);
  });
```

(With it the first `describe` has 7 tests.)

(d) In `closeForms()`, add `this.closeModules();` as its first line. In `relock(...)`, the existing `this.closeForms();` call now also closes the dialog; nothing more to add.

- [ ] **Step 5: Template**

In `platform-admin-component.html`:

(a) In the companies table, replace the actions cell

```html
              <td class="pa-actions"><button class="fx-action-btn" (click)="editCompany(c)">Edit</button></td>
```

with

```html
              <td class="pa-actions">
                <button class="fx-action-btn" (click)="openModules(c)">Modules</button>
                <button class="fx-action-btn" (click)="editCompany(c)">Edit</button>
              </td>
```

(b) Add this dialog directly before the `<!-- ═══════════ COMPANY DIALOG ═══════════ -->` comment:

```html
<!-- ═══════════ MODULES OF A COMPANY ═══════════ -->
@if (modulesCompany; as mc) {
  <div class="modal-overlay" (click)="closeModules()">
    <div class="modal-content" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h2>Modules · {{ mc.companyName }}</h2>
        <button class="modal-close" (click)="closeModules()">✕</button>
      </div>
      <div class="modal-body">
        @if (!isPlatformAdmin()) {
          <div class="form-note">Modules are part of the company's subscription. Contact the platform administrator to change them.</div>
        }
        @for (m of companyModules(); track m.moduleKey) {
          <label class="pa-module-row">
            <input type="checkbox" [checked]="m.isEnabled" [disabled]="!isPlatformAdmin()" (change)="toggleCompanyModule(m, $event)" />
            <span class="pa-module-text">
              <strong>{{ m.moduleName }}</strong>
              <small>{{ m.description }}</small>
            </span>
            <span class="pa-status" [class.off]="!m.isEnabled">{{ m.isEnabled ? 'On · ' + m.userCount + ' users' : 'Off' }}</span>
          </label>
        } @empty {
          <div class="pa-hint">No modules.</div>
        }
        @if (formError()) { <div class="pa-error">{{ formError() }}</div> }
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" (click)="closeModules()">Close</button>
      </div>
    </div>
  </div>
}
```

The class names are the ones the other dialogs of this file use. Keep `pa-module-row`, `pa-module-text` exactly: the tests query them.

(c) Append to `platform-admin-component.scss`:

```scss
/* one module of a company in the Modules dialog */
.pa-module-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  cursor: pointer;
}
.pa-module-row input[disabled] { cursor: not-allowed; }
.pa-module-text { flex: 1; display: flex; flex-direction: column; }
.pa-module-text small { opacity: 0.7; }
```

- [ ] **Step 6: Run to verify it passes**

From `encryptzUI`, run: `npx ng test --watch=false --include "src/app/Encryptz/components/platform-admin-component/**/*.spec.ts" 2>&1 | tail -25`
Expected: 7 tests pass.

Run: `npx ng build 2>&1 | tail -8` — no errors.

- [ ] **Step 7: Commit**

```bash
git add encryptzUI/src/app/Encryptz/Services/platform-service.ts encryptzUI/src/app/Encryptz/components/platform-admin-component
git commit -m "Add the Modules dialog to Platform Admin"
```

---

### Task 5: Module access tab and wording in Platform Admin

**Files:**
- Modify: `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.ts`
- Modify: `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.html`
- Modify: `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.spec.ts`

**Interfaces:**
- Consumes: `PlatformService.getCompanyModules`, `getModuleAccess`, `setModuleAccess` (Task 4). In this screen the picker value `selectedProjectId()` is a company id (a "project" is the company's database).
- Produces on the component: `accessModuleKey = signal<string>('SERVICE')`, `accessModules = signal<CompanyModule[]>([])`, `onAccessModulePicked(moduleKey: string)`.

- [ ] **Step 1: Write the failing tests**

Append to `platform-admin-component.spec.ts`, inside a new `describe` at the end of the file:

```ts
describe('PlatformAdminComponent module access', () => {
  const project = { projectId: 2, companyId: 2, companyName: 'Hamster A/C', projectName: 'Service Management', projectKey: 'C002-P001', isActive: true, serverName: '', databaseName: '', dbUser: '', extraOptions: '' };
  const serviceModule = { moduleId: 1, moduleKey: 'SERVICE', moduleName: 'Service Management', description: 'd', icon: 'build', sortOrder: 1, isEnabled: true, userCount: 2 };
  const salesModule = { moduleId: 2, moduleKey: 'SALES', moduleName: 'Sales', description: 'd', icon: 'sell', sortOrder: 2, isEnabled: true, userCount: 1 };
  const offModule = { moduleId: 3, moduleKey: 'HR', moduleName: 'HR', description: 'd', icon: 'groups', sortOrder: 3, isEnabled: false, userCount: 0 };
  const member = (userId: number, name: string, role: string, hasAccess: boolean) =>
    ({ userId, fullName: name, email: name + '@x.test', mobileNumber: '', roleInCompany: role, hasAccess });

  let api: any;
  let calls: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PlatformAdminComponent],
      providers: [
        { provide: PlatformService, useValue: api },
        { provide: AuthService, useValue: {
          currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin: true }),
          selectedCompanyId: () => 2,
        } },
      ],
    });
    const fixture = TestBed.createComponent(PlatformAdminComponent);
    fixture.detectChanges();
    fixture.componentInstance.setTab('access');
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    calls = [];
    api = {
      isUnlocked: () => of({ success: true, unlocked: true }),
      getCompanies: () => of({ success: true, message: '', data: [] }),
      getProjects: () => of({ success: true, message: '', data: [project] }),
      getCompanyModules: (companyId: number) => { calls.push(['getCompanyModules', companyId]); return of({ success: true, message: '', data: [serviceModule, salesModule, offModule] }); },
      getModuleAccess: (companyId: number, key: string) => { calls.push(['getModuleAccess', companyId, key]); return of({ success: true, message: '', data: [member(5, 'Admin A', 'Admin', true), member(8, 'Tech T', 'Technician', false)] }); },
      setModuleAccess: (companyId: number, key: string, userId: number, on: boolean) => { calls.push(['setModuleAccess', companyId, key, userId, on]); return of({ success: true, message: 'Access granted', data: true }); },
      lock: () => {},
    };
  });

  it('loads the access of the Service module of the company being worked in', () => {
    create();
    expect(calls).toContainEqual(['getCompanyModules', 2]);
    expect(calls).toContainEqual(['getModuleAccess', 2, 'SERVICE']);
  });

  it('offers only the modules the company has', () => {
    const fixture = create();
    const options = Array.from(fixture.nativeElement.querySelectorAll('.pa-module-picker option')) as HTMLOptionElement[];
    expect(options.map(o => o.textContent?.trim())).toEqual(['Service Management', 'Sales']);
  });

  it('reloads the list when another module is picked', () => {
    const fixture = create();
    fixture.componentInstance.onAccessModulePicked('SALES');
    expect(calls).toContainEqual(['getModuleAccess', 2, 'SALES']);
  });

  it('gives a member access to the picked module', () => {
    const fixture = create();
    fixture.componentInstance.toggleAccess(member(8, 'Tech T', 'Technician', false) as any);
    fixture.detectChanges();

    expect(calls).toContainEqual(['setModuleAccess', 2, 'SERVICE', 8, true]);
    expect(fixture.componentInstance.access().find(a => a.userId === 8)?.hasAccess).toBe(true);
  });

  it('leaves the switch on when removing an administrator is refused', () => {
    api.setModuleAccess = (companyId: number, key: string, userId: number, on: boolean) => {
      calls.push(['setModuleAccess', companyId, key, userId, on]);
      return of({ success: false, message: 'Company administrators always have access. Change the role instead.', data: false });
    };
    const fixture = create();
    fixture.componentInstance.toggleAccess(member(5, 'Admin A', 'Admin', true) as any);
    fixture.detectChanges();

    expect(fixture.componentInstance.access().find(a => a.userId === 5)?.hasAccess).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Company administrators always have access');
  });

  it('says Branch and Module access, never Project or Location', () => {
    const fixture = create();
    const visible = (fixture.nativeElement.textContent as string);
    expect(visible).toContain('Module Access');
    expect(visible).toContain('Branches');
    expect(visible).not.toMatch(/Project/i);
    expect(visible).not.toMatch(/Location/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

From `encryptzUI`, run: `npx ng test --watch=false --include "src/app/Encryptz/components/platform-admin-component/**/*.spec.ts" 2>&1 | tail -25`
Expected: build errors (`onAccessModulePicked` does not exist) or failing tests.

- [ ] **Step 3: Component**

In `platform-admin-component.ts`:

(a) Add after the `companyModules` member:

```ts
  /** Module the Module Access tab works on, and the modules the picked company has. */
  accessModuleKey = signal<string>('SERVICE');
  accessModules = signal<CompanyModule[]>([]);
```

(b) Replace the `else` branch of `loadProjectData()` (the part that calls `this.api.getProjectAccess(projectId)`) with:

```ts
    } else {
      // the picker holds a company id: a "project" is the company's database
      this.access.set([]);
      this.api.getCompanyModules(projectId).subscribe({
        next: res => {
          const enabled = (res.success ? res.data ?? [] : []).filter(m => m.isEnabled);
          this.accessModules.set(enabled);
          // keep the picked module while the company has it, else fall back to the first
          if (!enabled.some(m => m.moduleKey === this.accessModuleKey()))
            this.accessModuleKey.set(enabled[0]?.moduleKey ?? 'SERVICE');
          this.loadModuleAccess(projectId);
        },
        error: err => this.fail(err, 'Could not load the modules'),
      });
    }
```

(c) Add these two methods directly after `loadProjectData()`:

```ts
  private loadModuleAccess(companyId: number): void {
    this.loading.set(true);
    this.api.getModuleAccess(companyId, this.accessModuleKey()).subscribe({
      next: res => {
        this.loading.set(false);
        if (res.success) this.access.set(res.data ?? []);
        else this.notify(res.message, false);
      },
      error: err => this.fail(err, 'Could not load module access'),
    });
  }

  onAccessModulePicked(moduleKey: string): void {
    this.accessModuleKey.set(moduleKey);
    const companyId = this.selectedProjectId();
    if (companyId) this.loadModuleAccess(companyId);
  }
```

(d) Replace the whole `toggleAccess` method with:

```ts
  toggleAccess(user: ProjectAccess, event?: Event): void {
    const companyId = this.selectedProjectId();
    if (!companyId) { this.redraw(event, user.hasAccess); return; }

    const grant = !user.hasAccess;
    this.api.setModuleAccess(companyId, this.accessModuleKey(), user.userId, grant).subscribe({
      next: res => {
        this.notify(res.message, res.success);
        if (res.success) {
          this.access.update(list => list.map(a => a.userId === user.userId ? { ...a, hasAccess: grant } : a));
          this.loadProjects();
        } else {
          this.redraw(event, user.hasAccess);
        }
      },
      error: err => { this.redraw(event, user.hasAccess); this.fail(err, 'Could not change access'); },
    });
  }
```

`redraw` is the private helper Task 4 added. In the template change the access checkbox to pass the event: `(change)="toggleAccess(a, $event)"`.

(e) Update the class doc comment at the top of the component to say: "companies and their modules, the database each company is stored in, branches, who may open a module, and the menu tree".

- [ ] **Step 4: Template — module picker**

In the toolbar of the shared locations/access block, directly after the closing `</select>` of the project picker, add:

```html
          @if (tab() === 'access') {
            <select class="fx-filter-select pa-module-picker" [ngModel]="accessModuleKey()" (ngModelChange)="onAccessModulePicked($event)">
              @for (m of accessModules(); track m.moduleKey) {
                <option [ngValue]="m.moduleKey">{{ m.moduleName }}</option>
              }
            </select>
          }
```

- [ ] **Step 5: Template — wording**

Change VISIBLE text only in `platform-admin-component.html` (not identifiers, bindings, class names or placeholders that are example values). Apply exactly these replacements wherever the text is shown to the user:

| Visible text now | Becomes |
|---|---|
| `Projects &amp; Databases` (tab) | `Company Databases` |
| `Project Access` (tab) | `Module Access` |
| `Locations` (tab and table title) | `Branches` |
| `Who can enter the project` | `Who can open the module` |
| `Select project` (picker placeholder) and `Select a project.` (hint) | `Select company` / `Select a company.` |
| picker option `{{ p.companyName }} — {{ p.projectName }}` | `{{ p.companyName }}` |
| `Locations and project access of your company` (header subtitle) | `Branches and module access of your company` |
| `Companies, projects, databases, locations, access and menus of the main database` (header subtitle) | `Companies and their modules, databases, branches, module access and menus of the main database` |
| `No projects yet` | `No company databases yet` |
| `Next: create its project.` (new-company note) | `Next: attach its database.` |
| `Database of this project` | `Database of this company` |
| `Changing the key or the database moves where this project's users work.` | `Changing the key or the database moves where this company's users work.` |
| location dialog title suffix `· {{ selectedProject()?.projectName }}` | `· {{ selectedProject()?.companyName }}` |
| stat label `Projects` and companies-table header `Projects` | `Databases` |
| table title `Projects` on the databases tab | `Company databases` |
| `+ New Project` | `+ Attach Database` |
| table headers `Project` / `Key` on the databases tab | `Module` / `Key` |
| dialog title `Edit Project` / `New Project` | `Edit Company Database` / `Attach Company Database` |
| `Project Name *` | `Name *` |
| `Project Key *` | `Key *` |
| `+ New Location` | `+ New Branch` |
| table header `Location` | `Branch` |
| `No locations yet — users cannot enter the project without one` | `No branches yet — users cannot enter the company without one` |
| dialog title `Edit Location` / `New Location` | `Edit Branch` / `New Branch` |
| `Location Name *` | `Branch Name *` |

and in `platform-admin-component.ts` change these user-facing strings: `'Could not load projects'` → `'Could not load the company databases'`; `'Could not load locations'` → `'Could not load the branches'`; `'Location name is required'` → `'Branch name is required'`; `'Project name and key are required'` → `'Name and key are required'`. (`'Could not load project access'` disappears with the code Step 3 replaces.)

After the edits run, from `encryptzUI`:

```bash
grep -noE ">[^<{]*(Project|Location)[^<{]*<" src/app/Encryptz/components/platform-admin-component/platform-admin-component.html
grep -nE "'[^']*(project|location)[^']*'" src/app/Encryptz/components/platform-admin-component/platform-admin-component.ts
```

Expected: the first prints nothing. The second may print only string literals that are not shown to users (for example tab ids such as `'projects'`, `'locations'`); list what remains in your report and say why each is not user-visible. If the template shows a word from the table in a place the table does not list, apply the same wording rule and note it.

- [ ] **Step 6: Run to verify it passes**

From `encryptzUI`:

```bash
npx ng test --watch=false --include "src/app/Encryptz/components/platform-admin-component/**/*.spec.ts" 2>&1 | tail -25
npx ng build 2>&1 | tail -8
npx ng test --watch=false 2>&1 | grep -E "Test Files|Tests |FAIL" | sort -u
```

Expected: 13 tests pass in the platform admin spec (7 + 6); the build has no errors; the whole suite fails only in the 5 old placeholder specs.

- [ ] **Step 7: Commit**

```bash
git add encryptzUI/src/app/Encryptz/components/platform-admin-component
git commit -m "Manage module access per module and say Branch and Company database in Platform Admin"
```

---

### Task 6: Verification with a running API (owner-gated)

This task needs an API connected to databases that may be written to. Per the Global Constraints the assistant has none. **Stop here and ask the owner**; it is the same gate as the earlier plans (restored COPIES of the main database and one tenant database, prepared as the release notes' "Rehearsal on copies" section says, with scripts 13, 14 and 19 run on the main-database copy). Until then report Tasks 1 to 5 as "implemented and unit-tested; not run against an API".

With the API and the UI running against the copies:

- [ ] **Step 1: Modules of a company**

| # | Do | Expect |
|---|---|---|
| 1 | Platform Admin → Companies → Modules on the test company, as a platform administrator | The Service module, switched on, with the number of users |
| 2 | Note `SELECT COUNT(*) FROM dbo.Users WHERE IsActive = 1` and the same for `dbo.Technicians` in the tenant copy | two numbers |
| 3 | Switch the Service module off (confirm the question) | "Service Management switched off"; the row shows Off |
| 4 | In Access Management save any user of the company (this triggers a synchronisation) | saved |
| 5 | Repeat the two counts of step 2 | the same two numbers |
| 6 | Log in as a member of the company in another browser | the Service card is disabled, "Not subscribed" |
| 7 | Switch the module on again | "switched on"; the member can enter; the counts are unchanged |
| 8 | Log in as a company administrator who is not a platform administrator, open Modules | the list is shown; the switches are disabled |
| 9 | As that company administrator call `POST api/platform/companies/<id>/modules` directly (Swagger) | `success: false`, "Only a platform administrator can switch modules" |
| 10 | As that company administrator call `GET api/platform/companies/<another company id>/modules` | `success: false`, "You are not allowed to manage this" |

- [ ] **Step 2: Module access**

| # | Do | Expect |
|---|---|---|
| 1 | Platform Admin → Module Access, company picked, module "Service Management" | the members; administrators shown as Allowed |
| 2 | Switch a technician off | "Access removed"; that technician's Service card is disabled with "Ask your administrator" |
| 3 | Switch the technician on again | "Access granted"; they can enter |
| 4 | Try to switch a company Admin off | refused: "Company administrators always have access. Change the role instead."; the switch stays on |
| 5 | Try to switch yourself off | refused: "You cannot remove your own access" |

- [ ] **Step 3: Script order**

On the main-database copy run script 14 again, then log in and save a user while the Service module is switched off for the test company: nobody is deactivated: the API log shows the warning "User sync skipped for company {CompanyId}: no users to mirror" (from TenantUserSyncService) because the earlier procedure returns no users. Restore the tenant copy, run script 19 again, repeat: nobody is deactivated and the company is not synchronised at all (no warning). This confirms both safeguards and the release-notes rule "run script 19 again after script 14".

- [ ] **Step 4: Record the result**

Append the outcome to the "Rehearsal result" section of `EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md` and commit:

```bash
git add EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md
git commit -m "Record the rehearsal of module management"
```

---

## Deferred

| Item | Plan |
|---|---|
| Module choice at invite time (the three invite screens; `Invitations` gains the chosen modules) — an invitation keeps granting every module the company has, which is right while only one module exists | 2c |
| Customer portal without the project picker; removal of `X-Project-Key`, `GET auth/projects`, `selected_project_id`; renaming the "project" identifiers and `platform/projects*` endpoints | 2c |
| Module access inside the Access Management screen (it stays in Platform Admin → Module Access, which company administrators can open) | 2c |
| A second module (catalogue row, menus assigned to it, its own user synchronisation rule) | when the module is built |
| Create Company, database provisioning | 3 |
| Branch access per user | 4 |
