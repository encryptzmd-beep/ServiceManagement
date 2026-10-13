# Applications Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The catalogue of applications knows a type (Personal / Commercial), a family and a "Coming soon" flag; the platform administrator manages it from Platform Admin; personal applications are listed on the company page; the API can reach a Personal DB.

**Architecture:** `dbo.Modules` in the main database stays the catalogue and gets four columns (script 21). The procedures behind the company's module page and subscription are re-created so they see commercial applications only. The API gets two platform endpoints, one endpoint for personal applications, the module state `ComingSoon`, and a third database executor (`PersonalDbHelper`). The UI gets an "Applications" section in Platform Admin, a "Personal applications" block on the company page and one shared "Coming soon" badge.

**Tech Stack:** SQL Server scripts, ASP.NET Core (.NET 10) with ADO.NET, xUnit, Angular 21 (standalone components, signals, Vitest through `ng test`).

**Spec:** `docs/superpowers/specs/2026-10-13-applications-catalogue-design.md` (sections 4 to 7, 9, 10). Phases 2 to 4 of the spec (Job Portal, Expense Manager, Payroll) are NOT in this plan.

## Global Constraints

- The SQL Server in `EncryptzAPI/appsettings.json` is LIVE. Never run a script from this plan, or any repo script, against it. Never create a database. Do not open, print or edit `appsettings.json`.
- Every SQL change is a NEW file whose name starts with a number. In `EncryptzAPI/Database/MainDB/` numbers `01`-`20` are FROZEN: never edit them. This plan adds `21`. The next free number after this plan is `22`.
- An SQL file is frozen once the task that creates it is complete. While its own task is open it may be edited.
- New SQL scripts contain no `USE`, `CREATE DATABASE`, `DROP DATABASE` or `DROP TABLE`. They refuse to run in a system database. They are re-runnable.
- Tables, procedures, classes and API paths keep the word `Module`. Only text a user reads says "Application".
- The API must keep working against a main database where script 21 has not been run: a missing column means "released", a missing procedure means "empty list".
- `AppType` values are exactly `Personal` and `Commercial`. The module state values are exactly `Available`, `NotSubscribed`, `NoAccess`, `ComingSoon`. The badge text is exactly `Coming soon`.
- Only a platform administrator (`PlatformActor.IsPlatformAdmin`) may read or save the catalogue. Both endpoints are behind `[Authorize]` and `[PlatformUnlocked]`.
- Messages returned to users never contain server names, database names or SQL / exception text.
- Match the surrounding code style. Do not reformat files you touch.
- Run API/test commands from the repository root `D:\Encryptz\ServiceManagement`; run UI commands from `D:\Encryptz\ServiceManagement\encryptzUI` with `.\node_modules\.bin\ng.cmd test --watch=false --include "<glob>"` (5-minute timeout, never watch mode). Never run `npx tsc` from the repository root.
- A Visual Studio debug session may hold `EncryptzAPI\bin`. `dotnet test` builds into `EncryptzTests\bin`, which is not affected; if a build step still reports a locked file, stop and tell the owner instead of ending their process.
- Before Task 1: the working tree has uncommitted changes from 2026-10-13 (platform administrator without a company, access code switch, sidebar sections). Ask the owner to commit them, or commit them with the owner's agreement, so each task of this plan is its own commit.

## Review Focus

1. A company was subscribed to an application that is later set to "Coming soon": its members must not be able to enter (set-scope refuses), and the card must show the badge, not an error. Pinned in Task 2 (`Refusal`) and Task 7 (module card).
2. The API runs against a main database without script 21: the Service application must still be listed as `Available` and enterable, and the company page must still load. Pinned in Task 2 (`IsReleasedOf`) and Task 4 (empty list).
3. The platform administrator types a key that differs only in case or has spaces around it (`  payroll `): it must be stored as `PAYROLL`, and a second application with the same key must be refused. Pinned in Task 3 (`ApplicationRules`) and Task 1 (procedure).
4. The personal applications call fails or is slow: the company list, "Create Company" and entering a company must work as before. Pinned in Task 7.
5. A personal application is released without a route: opening its card would go nowhere. The save must be refused on the server, and the card must stay disabled when a route is missing anyway. Pinned in Task 3 and Task 7.

---

## File Structure

| File | Responsibility |
|---|---|
| `EncryptzAPI/Database/MainDB/21_Applications.sql` (new) | columns, seed, catalogue procedures, re-created module procedures |
| `EncryptzAPI/Database/MainDB/21_Applications_README.md` (new) | run order and the re-run rule |
| `EncryptzAPI/Database/PersonalDB/01_Schema.sql` (new) | marks a database as the Personal DB |
| `EncryptzBL/Common/Tenant/ModuleAccess.cs` | state `ComingSoon`, refusal text |
| `EncryptzBL/Common/Tenant/ApplicationRules.cs` (new) | what a catalogue entry may look like |
| `EncryptzBL/Common/PersonalDbHelper.cs` (new) | executor of the Personal DB |
| `EncryptzBL/DTO's/PlatformDtos.cs`, `FlixDtos.cs` | `ApplicationDto`, `PersonalAppDto`, new fields |
| `EncryptzBL/Infrastructure/User/Modules/PlatformService.cs`, `IPlatformService.cs` | catalogue read / save |
| `EncryptzBL/Infrastructure/User/Modules/AuthService.cs`, `IAuthService.cs` | released flag, personal applications |
| `EncryptzAPI/Controllers/PlatformController.cs`, `AuthController.cs` | three endpoints |
| `EncryptzAPI/ServiceRegistration.cs` | registers `PersonalDbHelper` |
| `encryptzUI/src/styles.scss` | `.soon-badge` |
| `encryptzUI/.../Services/platform-service.ts`, `platform-nav-service.ts` | catalogue calls, sidebar entry |
| `encryptzUI/.../platform-admin-component/*` | Applications section and dialog, badge in the Modules dialog |
| `encryptzUI/.../Auth/auth-service.ts`, `scope-flow.ts`, `Models/ApiModels.ts` | personal applications call, caption, types |
| `encryptzUI/.../company-selector-component/*` | personal applications block, badge on module cards |

---

### Task 1: Script 21 (main database)

**Files:**
- Create: `EncryptzAPI/Database/MainDB/21_Applications.sql`
- Create: `EncryptzAPI/Database/MainDB/21_Applications_README.md`
- Test: `EncryptzTests/ApplicationsScriptTests.cs`

**Interfaces:**
- Produces (columns of `dbo.Modules`): `AppType NVARCHAR(20)`, `RoutePath NVARCHAR(200) NULL`, `IsReleased BIT`, `Family NVARCHAR(100) NULL`.
- Produces: `sp_Platform_GetModules` → `ModuleId, ModuleKey, ModuleName, Description, Icon, Family, AppType, RoutePath, SortOrder, IsReleased, IsActive, CompanyCount`.
- Produces: `sp_Platform_SaveModule(@ModuleId, @ModuleKey, @ModuleName, @Description, @Icon, @Family, @AppType, @RoutePath, @SortOrder, @IsReleased, @IsActive)` → `Success, Message, ModuleId`.
- Produces: `sp_User_GetPersonalApps` → `ModuleId, ModuleKey, ModuleName, Description, Icon, Family, RoutePath, SortOrder, IsReleased`.
- Produces (extra columns): `sp_User_GetModules` + `IsReleased, Family`; `sp_User_ValidateScope` + `IsReleased`; `sp_Platform_GetCompanyModules` + `IsReleased, Family`.

- [ ] **Step 1: Write the failing test**

Create `EncryptzTests/ApplicationsScriptTests.cs`:

```csharp
using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>Text checks on script 21: it cannot be run in a test (the server is live).</summary>
    public class ApplicationsScriptTests
    {
        private static string RepositoryRoot()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;

            return folder?.FullName ?? throw new Xunit.Sdk.XunitException("The repository root was not found");
        }

        private static string Script()
            => File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Database", "MainDB", "21_Applications.sql"));

        /// <summary>Text of one procedure: from its CREATE to the next GO.</summary>
        private static string Procedure(string name)
        {
            var script = Script();
            var start = script.IndexOf("CREATE OR ALTER PROCEDURE dbo." + name, StringComparison.Ordinal);
            Assert.True(start >= 0, name + " is not in script 21");
            var end = script.IndexOf("\nGO", start, StringComparison.Ordinal);
            return script.Substring(start, (end < 0 ? script.Length : end) - start);
        }

        [Theory]
        [InlineData("USE ")]
        [InlineData("CREATE DATABASE")]
        [InlineData("DROP DATABASE")]
        [InlineData("DROP TABLE")]
        public void The_script_never_switches_or_drops(string forbidden)
        {
            var code = Regex.Replace(Script(), @"/\*.*?\*/", "", RegexOptions.Singleline);
            code = Regex.Replace(code, @"--[^\n]*", "");

            Assert.DoesNotContain(forbidden, code, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void The_script_refuses_to_run_before_script_20()
        {
            var script = Script();

            Assert.Contains("OBJECT_ID('dbo.sp_Company_GetCreationState') IS NULL", script);
            Assert.Contains("OBJECT_ID('dbo.sp_Platform_GetCompanyModules') IS NULL", script);
            Assert.Contains("SET NOEXEC ON", script);
        }

        [Theory]
        [InlineData("AppType")]
        [InlineData("RoutePath")]
        [InlineData("IsReleased")]
        [InlineData("Family")]
        public void Each_new_column_is_added_only_when_it_is_missing(string column)
        {
            Assert.Contains($"IF COL_LENGTH('dbo.Modules', '{column}') IS NULL", Script());
        }

        [Theory]
        [InlineData("INVENTORY", "Commercial")]
        [InlineData("CRM", "Commercial")]
        [InlineData("ACCOUNTS", "Commercial")]
        [InlineData("PAYROLL", "Commercial")]
        [InlineData("JOBCONSULTANCY", "Commercial")]
        [InlineData("SCHOOL", "Commercial")]
        [InlineData("JOBPORTAL", "Personal")]
        [InlineData("EXPENSE", "Personal")]
        public void Each_new_application_is_seeded_as_coming_soon(string key, string type)
        {
            // one line per application: (N'KEY', N'Name', N'Description', N'icon', sort, N'Type')
            Assert.Matches(@"\(N'" + key + @"',[^\n]*N'" + type + @"'\)", Script());
        }

        [Theory]
        [InlineData("sp_User_GetModules")]
        [InlineData("sp_User_ValidateScope")]
        [InlineData("sp_Platform_GetCompanyModules")]
        [InlineData("sp_Platform_SetCompanyModule")]
        [InlineData("sp_Platform_GetModuleAccess")]
        [InlineData("sp_Platform_SetModuleAccess")]
        public void Company_procedures_see_commercial_applications_only(string name)
        {
            Assert.Contains("AppType = 'Commercial'", Procedure(name));
        }

        [Fact]
        public void Personal_applications_are_listed_by_their_own_procedure()
        {
            var body = Procedure("sp_User_GetPersonalApps");

            Assert.Contains("AppType = 'Personal'", body);
            Assert.Contains("IsActive = 1", body);
        }

        [Fact]
        public void A_company_cannot_be_subscribed_to_an_application_that_is_not_released()
        {
            Assert.Contains("This application is not available yet", Procedure("sp_Platform_SetCompanyModule"));
        }

        [Theory]
        [InlineData("The key is already used")]
        [InlineData("The key of an application cannot be changed")]
        [InlineData("The type cannot be changed while a company is subscribed")]
        [InlineData("A personal application needs a route before it is released")]
        public void Saving_an_application_refuses_what_the_spec_refuses(string message)
        {
            Assert.Contains(message, Procedure("sp_Platform_SaveModule"));
        }

        [Fact]
        public void The_readme_tells_to_run_it_again_after_scripts_14_and_19()
        {
            var readme = File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Database", "MainDB", "21_Applications_README.md"));

            Assert.Contains("14_Company_Tenancy_Cutover.sql", readme);
            Assert.Contains("19_Module_Management.sql", readme);
            Assert.Contains("run `21_Applications.sql` again", readme);
        }
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test EncryptzTests --filter "FullyQualifiedName~ApplicationsScriptTests" --nologo`
Expected: FAIL, every test with `FileNotFoundException` for `21_Applications.sql`.

- [ ] **Step 3: Write the script**

Create `EncryptzAPI/Database/MainDB/21_Applications.sql`:

```sql
/* =============================================================================
   MainDB · Applications: personal and commercial
   -----------------------------------------------------------------------------
   Run AFTER 20_Company_Provisioning.sql. Run it AGAIN every time script 14 or
   script 19 is run again: they re-create sp_User_GetModules,
   sp_User_ValidateScope and the sp_Platform_*Module* procedures in their
   earlier form.

   An application is a row of dbo.Modules.

   ADDS (nothing is removed):
     dbo.Modules   AppType     'Personal' | 'Commercial' (existing rows: Commercial)
                   RoutePath   where the UI opens a personal application
                   IsReleased  0 = "Coming soon": listed, cannot be opened or
                               subscribed (rows that exist before the first run: 1)
                   Family      category, free text
     rows          INVENTORY, CRM, ACCOUNTS, PAYROLL, JOBCONSULTANCY, SCHOOL
                   (commercial) and JOBPORTAL, EXPENSE (personal), all "Coming
                   soon"; only when the key is not there yet
     procedures    sp_Platform_GetModules, sp_Platform_SaveModule,
                   sp_User_GetPersonalApps
   RE-CREATES, limited to commercial applications:
     sp_User_GetModules (+ IsReleased, Family), sp_User_ValidateScope (+ IsReleased),
     sp_Platform_GetCompanyModules (+ IsReleased, Family),
     sp_Platform_SetCompanyModule (refuses an application that is not released),
     sp_Platform_GetModuleAccess, sp_Platform_SetModuleAccess

   It changes nothing in any tenant database.
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
        OR OBJECT_ID('dbo.fn_ModuleUsers') IS NULL
        OR OBJECT_ID('dbo.sp_Platform_GetCompanyModules') IS NULL
        OR OBJECT_ID('dbo.sp_Company_GetCreationState') IS NULL)
BEGIN
    RAISERROR('Run 14_Company_Tenancy_Cutover.sql, 19_Module_Management.sql and 20_Company_Provisioning.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. Columns
   ----------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.Modules', 'AppType') IS NULL
    ALTER TABLE dbo.Modules ADD AppType NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Modules_AppType DEFAULT ('Commercial');
IF COL_LENGTH('dbo.Modules', 'RoutePath') IS NULL
    ALTER TABLE dbo.Modules ADD RoutePath NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Modules', 'Family') IS NULL
    ALTER TABLE dbo.Modules ADD Family NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Modules', 'IsReleased') IS NULL
BEGIN
    ALTER TABLE dbo.Modules ADD IsReleased BIT NOT NULL
        CONSTRAINT DF_Modules_IsReleased DEFAULT (0);
    /* what exists before the first run is built (the Service application).
       Dynamic: the column does not exist when this batch is compiled. */
    EXEC('UPDATE dbo.Modules SET IsReleased = 1');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Modules_AppType' AND parent_object_id = OBJECT_ID('dbo.Modules'))
    ALTER TABLE dbo.Modules ADD CONSTRAINT CK_Modules_AppType CHECK (AppType IN ('Personal', 'Commercial'));
GO

/* -----------------------------------------------------------------------------
   2. Seed: listed as "Coming soon"; a key that is there is left as it is
   ----------------------------------------------------------------------------- */
INSERT INTO dbo.Modules (ModuleKey, ModuleName, Description, Icon, SortOrder, AppType, IsReleased)
SELECT v.ModuleKey, v.ModuleName, v.Description, v.Icon, v.SortOrder, v.AppType, 0
FROM (VALUES
    (N'INVENTORY',      N'Inventory',       N'Stock, purchases and warehouses.',                 N'inventory_2',     2, N'Commercial'),
    (N'CRM',            N'CRM',             N'Leads, customers and follow-ups.',                 N'handshake',       3, N'Commercial'),
    (N'ACCOUNTS',       N'Accounts',        N'Ledgers, invoices and payments.',                  N'account_balance', 4, N'Commercial'),
    (N'PAYROLL',        N'Payroll',         N'Employees, salaries and hiring.',                  N'payments',        5, N'Commercial'),
    (N'JOBCONSULTANCY', N'Job Consultancy', N'Clients, openings and placements.',                N'work',            6, N'Commercial'),
    (N'SCHOOL',         N'School',          N'Students, classes, fees and results.',             N'school',          7, N'Commercial'),
    (N'JOBPORTAL',      N'Job Portal',      N'Your profile, skills and resume.',                 N'badge',           1, N'Personal'),
    (N'EXPENSE',        N'Expense Manager', N'Your own income and expenses.',                    N'savings',         2, N'Personal')
) v (ModuleKey, ModuleName, Description, Icon, SortOrder, AppType)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Modules m WHERE m.ModuleKey = v.ModuleKey);
GO

/* =============================================================================
   3. The catalogue (platform administrator)
   ============================================================================= */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetModules
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.ModuleId, m.ModuleKey, m.ModuleName,
        ISNULL(m.Description, '') AS Description,
        ISNULL(m.Icon, '')        AS Icon,
        ISNULL(m.Family, '')      AS Family,
        m.AppType,
        ISNULL(m.RoutePath, '')   AS RoutePath,
        m.SortOrder, m.IsReleased, m.IsActive,
        (SELECT COUNT(*) FROM dbo.CompanyModules cm WHERE cm.ModuleId = m.ModuleId AND cm.IsEnabled = 1) AS CompanyCount
    FROM dbo.Modules m
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* ModuleId = 0 in the result means nothing was saved. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SaveModule
    @ModuleId    INT,
    @ModuleKey   NVARCHAR(50),
    @ModuleName  NVARCHAR(150),
    @Description NVARCHAR(400) = NULL,
    @Icon        NVARCHAR(100) = NULL,
    @Family      NVARCHAR(100) = NULL,
    @AppType     NVARCHAR(20),
    @RoutePath   NVARCHAR(200) = NULL,
    @SortOrder   INT = 0,
    @IsReleased  BIT = 0,
    @IsActive    BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CurrentKey NVARCHAR(50), @CurrentType NVARCHAR(20);

    SET @ModuleId    = ISNULL(@ModuleId, 0);
    SET @ModuleKey   = UPPER(LTRIM(RTRIM(ISNULL(@ModuleKey, ''))));
    SET @ModuleName  = LTRIM(RTRIM(ISNULL(@ModuleName, '')));
    SET @Description = NULLIF(LTRIM(RTRIM(ISNULL(@Description, ''))), '');
    SET @Icon        = NULLIF(LTRIM(RTRIM(ISNULL(@Icon, ''))), '');
    SET @Family      = NULLIF(LTRIM(RTRIM(ISNULL(@Family, ''))), '');
    SET @RoutePath   = NULLIF(LTRIM(RTRIM(ISNULL(@RoutePath, ''))), '');
    SET @IsReleased  = ISNULL(@IsReleased, 0);
    SET @IsActive    = ISNULL(@IsActive, 1);

    IF @ModuleKey = '' OR @ModuleName = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Key and name are required' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END
    IF @AppType NOT IN ('Personal', 'Commercial')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Choose Personal or Commercial' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END
    IF @AppType = 'Personal' AND @IsReleased = 1 AND @RoutePath IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'A personal application needs a route before it is released' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END

    BEGIN TRANSACTION;

    IF @ModuleId = 0
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.Modules WITH (UPDLOCK, HOLDLOCK) WHERE ModuleKey = @ModuleKey)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success, 'The key is already used' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
        END

        INSERT INTO dbo.Modules (ModuleKey, ModuleName, Description, Icon, Family, AppType, RoutePath, SortOrder, IsReleased, IsActive)
        VALUES (@ModuleKey, @ModuleName, @Description, @Icon, @Family, @AppType, @RoutePath, ISNULL(@SortOrder, 0), @IsReleased, @IsActive);

        SET @ModuleId = SCOPE_IDENTITY();

        COMMIT TRANSACTION;
        SELECT CAST(1 AS INT) AS Success, 'Application added' AS Message, @ModuleId AS ModuleId; RETURN;
    END

    SELECT @CurrentKey = ModuleKey, @CurrentType = AppType
    FROM dbo.Modules WITH (UPDLOCK, HOLDLOCK)
    WHERE ModuleId = @ModuleId;

    IF @CurrentKey IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Application not found' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END
    IF @CurrentKey <> @ModuleKey
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'The key of an application cannot be changed' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END
    IF @CurrentType <> @AppType
       AND EXISTS (SELECT 1 FROM dbo.CompanyModules WHERE ModuleId = @ModuleId)
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'The type cannot be changed while a company is subscribed' AS Message, CAST(0 AS INT) AS ModuleId; RETURN;
    END

    UPDATE dbo.Modules
    SET ModuleName = @ModuleName, Description = @Description, Icon = @Icon, Family = @Family,
        AppType = @AppType, RoutePath = @RoutePath, SortOrder = ISNULL(@SortOrder, 0),
        IsReleased = @IsReleased, IsActive = @IsActive
    WHERE ModuleId = @ModuleId;

    COMMIT TRANSACTION;
    SELECT CAST(1 AS INT) AS Success, 'Application saved' AS Message, @ModuleId AS ModuleId;
END
GO

/* Personal applications: every active user may open a released one. */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetPersonalApps
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.ModuleId, m.ModuleKey, m.ModuleName,
        ISNULL(m.Description, '') AS Description,
        ISNULL(m.Icon, '')        AS Icon,
        ISNULL(m.Family, '')      AS Family,
        ISNULL(m.RoutePath, '')   AS RoutePath,
        m.SortOrder, m.IsReleased
    FROM dbo.Modules m
    WHERE m.IsActive = 1
      AND m.AppType = 'Personal'
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* =============================================================================
   4. Re-created from script 14: commercial applications only
   ============================================================================= */

/* The commercial catalogue, with what the API needs to decide each state.
   RoleInCompany is '' when the user is not an active member. */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetModules
    @UserId    INT,
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.ModuleId, m.ModuleKey, m.ModuleName,
        ISNULL(m.Description, '') AS Description,
        ISNULL(m.Icon, '')        AS Icon,
        m.SortOrder,
        CAST(ISNULL(cm.IsEnabled, 0) AS BIT)                         AS CompanyEnabled,
        CAST(CASE WHEN uma.UserId IS NULL THEN 0 ELSE 1 END AS BIT)   AS UserGranted,
        ISNULL(cu.RoleInCompany, '')                                  AS RoleInCompany,
        m.IsReleased,
        ISNULL(m.Family, '')                                          AS Family
    FROM dbo.Modules m
    LEFT JOIN dbo.CompanyModules cm    ON cm.ModuleId = m.ModuleId AND cm.CompanyId = @CompanyId
    LEFT JOIN dbo.UserModuleAccess uma ON uma.ModuleId = m.ModuleId AND uma.CompanyId = @CompanyId AND uma.UserId = @UserId
    LEFT JOIN dbo.CompanyUsers cu      ON cu.CompanyId = @CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1
    WHERE m.IsActive = 1
      AND m.AppType = 'Commercial'
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* One row when the user is an active member of an active company and the
   commercial application exists; the API decides from the flags. */
CREATE OR ALTER PROCEDURE dbo.sp_User_ValidateScope
    @UserId    INT,
    @CompanyId INT,
    @ModuleKey NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        c.CompanyId,
        ISNULL(c.TenantKey, '') AS TenantKey,
        c.TenantScopeId,
        c.ProvisionStatus,
        cu.RoleInCompany,
        m.ModuleName,
        CAST(ISNULL(cm.IsEnabled, 0) AS BIT)                       AS CompanyEnabled,
        CAST(CASE WHEN uma.UserId IS NULL THEN 0 ELSE 1 END AS BIT) AS UserGranted,
        m.IsReleased
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Companies c         ON c.CompanyId = cu.CompanyId AND c.IsActive = 1
    INNER JOIN dbo.Modules m           ON m.ModuleKey = @ModuleKey AND m.IsActive = 1 AND m.AppType = 'Commercial'
    LEFT  JOIN dbo.CompanyModules cm   ON cm.CompanyId = c.CompanyId AND cm.ModuleId = m.ModuleId
    LEFT  JOIN dbo.UserModuleAccess uma ON uma.CompanyId = c.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1;
END
GO

/* =============================================================================
   5. Re-created from script 19: commercial applications only
   ============================================================================= */
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
        (SELECT COUNT(*) FROM dbo.fn_ModuleUsers(@CompanyId, m.ModuleKey)) AS UserCount,
        m.IsReleased,
        ISNULL(m.Family, '')      AS Family
    FROM dbo.Modules m
    LEFT JOIN dbo.CompanyModules cm ON cm.ModuleId = m.ModuleId AND cm.CompanyId = @CompanyId
    WHERE m.IsActive = 1
      AND m.AppType = 'Commercial'
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* Switching off keeps every member's grant. An application that is not released
   can be switched off, never on. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SetCompanyModule
    @CompanyId INT,
    @ModuleKey NVARCHAR(50),
    @IsEnabled BIT,
    @SavedBy   INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ModuleId INT, @ModuleName NVARCHAR(150), @IsReleased BIT;

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message; RETURN;
    END

    SELECT @ModuleId = ModuleId, @ModuleName = ModuleName, @IsReleased = IsReleased
    FROM dbo.Modules
    WHERE ModuleKey = @ModuleKey AND IsActive = 1 AND AppType = 'Commercial';

    IF @ModuleId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Module not found' AS Message; RETURN;
    END

    SET @IsEnabled = ISNULL(@IsEnabled, 0);

    IF @IsEnabled = 1 AND @IsReleased = 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This application is not available yet' AS Message; RETURN;
    END

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
    INNER JOIN dbo.Modules m ON m.ModuleKey = @ModuleKey AND m.IsActive = 1 AND m.AppType = 'Commercial'
    LEFT  JOIN dbo.UserModuleAccess uma
           ON uma.CompanyId = cu.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId
    LEFT  JOIN dbo.Users gb  ON gb.UserId = uma.GrantedBy
    WHERE cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
    ORDER BY u.FullName;
END
GO

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

    SELECT @ModuleId = ModuleId FROM dbo.Modules
    WHERE ModuleKey = @ModuleKey AND IsActive = 1 AND AppType = 'Commercial';

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
        -- one statement: the check and the insert cannot be separated by another caller
        INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
        SELECT @CompanyId, @UserId, @ModuleId, @GrantedBy
        WHERE NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess WITH (UPDLOCK, HOLDLOCK)
                          WHERE CompanyId = @CompanyId AND UserId = @UserId AND ModuleId = @ModuleId);
    ELSE
        DELETE FROM dbo.UserModuleAccess
        WHERE CompanyId = @CompanyId AND UserId = @UserId AND ModuleId = @ModuleId;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @HasAccess = 1 THEN 'Access granted' ELSE 'Access removed' END AS Message;
END
GO

PRINT 'Applications are in place. Run this script again after script 14 or script 19.';
GO
SET NOEXEC OFF;
GO
```

- [ ] **Step 4: Write the README**

Create `EncryptzAPI/Database/MainDB/21_Applications_README.md`:

```markdown
# Applications: run order

`21_Applications.sql` adds the type, the family, the route and the "Coming soon"
flag to `dbo.Modules`, lists the new applications and re-creates the procedures
behind a company's module page so they show commercial applications only.

## When to run

- After `20_Company_Provisioning.sql`, with the main database selected in SSMS.
- It is safe to run again.
- **Every time `14_Company_Tenancy_Cutover.sql` or `19_Module_Management.sql` is run
  again, run `21_Applications.sql` again afterwards** (order: 14, 19, 20, 21). Scripts
  14 and 19 re-create `sp_User_GetModules`, `sp_User_ValidateScope` and the
  `sp_Platform_*Module*` procedures without the type. Until script 21 runs again,
  personal applications show up on the module page of every company.

## What the API does without it

The API works against a main database without script 21: every application counts as
released, the company page shows no personal applications, and the Applications
section of Platform Admin answers with an error.

## Undo

No undo is needed. The previous API ignores the new columns and rows. To hide a seeded
application, set it inactive in Platform Admin, Applications.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dotnet test EncryptzTests --filter "FullyQualifiedName~ApplicationsScriptTests" --nologo`
Expected: PASS, every test of the class.

- [ ] **Step 6: Commit**

```bash
git add EncryptzAPI/Database/MainDB/21_Applications.sql EncryptzAPI/Database/MainDB/21_Applications_README.md EncryptzTests/ApplicationsScriptTests.cs
git commit -m "Add script 21: application type, family and coming-soon flag in the module catalogue"
```

---

### Task 2: Module state `ComingSoon`

**Files:**
- Modify: `EncryptzBL/Common/Tenant/ModuleAccess.cs`
- Modify: `EncryptzBL/DTO's/FlixDtos.cs` (class `ModuleDto`, around line 80)
- Modify: `EncryptzBL/Infrastructure/User/Modules/AuthService.cs` (`ResolveModuleScope` around line 752, `GetModules` around line 777)
- Test: `EncryptzTests/ModuleAccessTests.cs`, `EncryptzTests/ModuleDtoTests.cs`

**Interfaces:**
- Consumes: columns `IsReleased`, `Family` of `sp_User_GetModules`; `IsReleased` of `sp_User_ValidateScope` (Task 1). They may be missing.
- Produces: `ModuleState.ComingSoon`; `ModuleAccess.Evaluate(bool companyEnabled, bool userGranted, string? roleInCompany, bool isReleased = true)`; `ModuleAccess.Refusal(string? provisionStatus, string? tenantKey, bool companyEnabled, bool userGranted, string? roleInCompany, bool isReleased = true)`; `ModuleAccess.IsReleasedOf(DataRow row)`; `ModuleDto.Family`; `ModuleDto.From(..., string? roleInCompany, bool isReleased = true, string family = "")`.

- [ ] **Step 1: Write the failing tests**

Append inside the class in `EncryptzTests/ModuleAccessTests.cs` (add `using System.Data;` at the top of the file):

```csharp
        private const string NotAvailableYet = "This application is not available yet";

        [Fact]
        public void An_application_that_is_not_released_is_coming_soon_for_everyone()
        {
            Assert.Equal(ModuleState.ComingSoon, ModuleAccess.Evaluate(true, true, "Admin", isReleased: false));
            Assert.Equal(ModuleState.ComingSoon, ModuleAccess.Evaluate(false, false, "Technician", isReleased: false));
        }

        [Fact]
        public void Released_is_the_default()
        {
            Assert.Equal(ModuleState.Available, ModuleAccess.Evaluate(true, true, "Technician"));
        }

        [Fact]
        public void Refusal_a_subscribed_company_cannot_enter_an_application_that_is_not_released()
        {
            Assert.Equal(NotAvailableYet, ModuleAccess.Refusal("Ready", "K", true, true, "Admin", isReleased: false));
        }

        [Fact]
        public void Refusal_not_ready_still_wins_over_coming_soon()
        {
            Assert.Equal(NotReady, ModuleAccess.Refusal("Failed", "K", true, true, "Admin", isReleased: false));
        }

        [Fact]
        public void A_row_without_the_column_is_released()
        {
            var table = new DataTable();
            table.Columns.Add("ModuleKey", typeof(string));
            var row = table.Rows.Add("SERVICE");

            Assert.True(ModuleAccess.IsReleasedOf(row));
        }

        [Theory]
        [InlineData(true, true)]
        [InlineData(false, false)]
        public void A_row_with_the_column_says_what_the_column_says(bool stored, bool expected)
        {
            var table = new DataTable();
            table.Columns.Add("IsReleased", typeof(bool));
            var row = table.Rows.Add(stored);

            Assert.Equal(expected, ModuleAccess.IsReleasedOf(row));
        }

        [Fact]
        public void A_row_with_an_empty_column_is_released()
        {
            var table = new DataTable();
            table.Columns.Add("IsReleased", typeof(bool));
            var row = table.Rows.Add(DBNull.Value);

            Assert.True(ModuleAccess.IsReleasedOf(row));
        }
```

Append inside the class in `EncryptzTests/ModuleDtoTests.cs`:

```csharp
        [Fact]
        public void An_application_that_is_not_released_is_coming_soon_and_carries_its_family()
        {
            var dto = ModuleDto.From(4, "PAYROLL", "Payroll", "desc", "payments", 5, true, true, "Admin",
                isReleased: false, family: "HR");

            Assert.Equal("ComingSoon", dto.State);
            Assert.Equal("HR", dto.Family);
        }

        [Fact]
        public void Family_is_empty_when_none_is_given()
        {
            var dto = ModuleDto.From(1, "SERVICE", "Service Management", "desc", "build", 1, true, true, "Admin");

            Assert.Equal("", dto.Family);
            Assert.Equal("Available", dto.State);
        }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test EncryptzTests --filter "FullyQualifiedName~ModuleAccessTests|FullyQualifiedName~ModuleDtoTests" --nologo`
Expected: build FAILS: `'ModuleState' does not contain a definition for 'ComingSoon'`.

- [ ] **Step 3: Implement**

In `EncryptzBL/Common/Tenant/ModuleAccess.cs`, add `using System.Data;` as the first line, then replace the enum and the three members below with:

```csharp
    /// <summary>What a user sees for one module of the catalogue inside a company.</summary>
    public enum ModuleState
    {
        /// <summary>The company has the module and the user may open it.</summary>
        Available,
        /// <summary>The company does not have the module.</summary>
        NotSubscribed,
        /// <summary>The company has it, the user was not given it.</summary>
        NoAccess,
        /// <summary>Listed, not built yet: nobody can open it.</summary>
        ComingSoon
    }
```

```csharp
        /// <summary>
        /// Why a user may not open a module in a company, or null when they may. The order is
        /// part of the rule: database not ready, then not released, then not subscribed, then not granted.
        /// </summary>
        public static string? Refusal(string? provisionStatus, string? tenantKey,
            bool companyEnabled, bool userGranted, string? roleInCompany, bool isReleased = true)
        {
            if (provisionStatus != "Ready" || string.IsNullOrEmpty(tenantKey))
                return "Your company is still being set up. Please try again shortly";

            switch (Evaluate(companyEnabled, userGranted, roleInCompany, isReleased))
            {
                case ModuleState.ComingSoon:
                    return "This application is not available yet";
                case ModuleState.NotSubscribed:
                    return "This module is not part of your company's subscription";
                case ModuleState.NoAccess:
                    return "You don't have access to this module. Ask your administrator";
                default:
                    return null;
            }
        }

        public static ModuleState Evaluate(bool companyEnabled, bool userGranted, string? roleInCompany, bool isReleased = true)
        {
            if (!isReleased)
                return ModuleState.ComingSoon;

            if (!companyEnabled)
                return ModuleState.NotSubscribed;

            return userGranted || IsCompanyAdminRole(roleInCompany)
                ? ModuleState.Available
                : ModuleState.NoAccess;
        }

        /// <summary>
        /// The released flag of a module row. A main database without script 21 has no
        /// such column: every module there is built.
        /// </summary>
        public static bool IsReleasedOf(DataRow row)
            => !row.Table.Columns.Contains("IsReleased")
               || row["IsReleased"] == DBNull.Value
               || Convert.ToBoolean(row["IsReleased"]);
```

In `EncryptzBL/DTO's/FlixDtos.cs`, class `ModuleDto`: change the comment of `State`, add `Family`, and replace `From`:

```csharp
        /// <summary>Available | NotSubscribed | NoAccess | ComingSoon</summary>
        public string State { get; set; } = string.Empty;
        /// <summary>Category of the application ('' when none).</summary>
        public string Family { get; set; } = string.Empty;

        public static ModuleDto From(int moduleId, string moduleKey, string moduleName, string description,
            string icon, int sortOrder, bool companyEnabled, bool userGranted, string? roleInCompany,
            bool isReleased = true, string family = "")
        {
            return new ModuleDto
            {
                ModuleId = moduleId,
                ModuleKey = moduleKey,
                ModuleName = moduleName,
                Description = description,
                Icon = icon,
                SortOrder = sortOrder,
                Family = family,
                State = ModuleAccess.Evaluate(companyEnabled, userGranted, roleInCompany, isReleased).ToString()
            };
        }
```

Keep whatever follows the object initializer in the existing `From` (closing braces) as it is.

In `EncryptzBL/Infrastructure/User/Modules/AuthService.cs`, `ResolveModuleScope`: pass the flag to `Refusal`:

```csharp
            var refusal = ModuleAccess.Refusal(
                row["ProvisionStatus"]?.ToString(), tenantKey,
                Convert.ToBoolean(row["CompanyEnabled"]), Convert.ToBoolean(row["UserGranted"]), role,
                ModuleAccess.IsReleasedOf(row));
```

In `GetModules`, replace the last argument line of `ModuleDto.From(` so the call ends with:

```csharp
                Convert.ToBoolean(r["UserGranted"]),
                r["RoleInCompany"]?.ToString(),
                ModuleAccess.IsReleasedOf(r),
                r.Table.Columns.Contains("Family") ? r["Family"]?.ToString() ?? "" : "")).ToList();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test EncryptzTests --filter "FullyQualifiedName~ModuleAccessTests|FullyQualifiedName~ModuleDtoTests" --nologo`
Expected: PASS (all earlier tests of both classes plus the new ones).

- [ ] **Step 5: Commit**

```bash
git add EncryptzBL/Common/Tenant/ModuleAccess.cs "EncryptzBL/DTO's/FlixDtos.cs" EncryptzBL/Infrastructure/User/Modules/AuthService.cs EncryptzTests/ModuleAccessTests.cs EncryptzTests/ModuleDtoTests.cs
git commit -m "Module state ComingSoon: an application that is not released cannot be entered"
```

---

### Task 3: Catalogue endpoints for the platform administrator

**Files:**
- Create: `EncryptzBL/Common/Tenant/ApplicationRules.cs`
- Modify: `EncryptzBL/DTO's/PlatformDtos.cs` (new `ApplicationDto`; `CompanyModuleDto` gets two fields)
- Modify: `EncryptzBL/Infrastructure/User/Modules/IPlatformService.cs`, `PlatformService.cs`
- Modify: `EncryptzAPI/Controllers/PlatformController.cs`
- Test: `EncryptzTests/ApplicationRulesTests.cs`, `EncryptzTests/PlatformApplicationEndpointsTests.cs`

**Interfaces:**
- Consumes: `sp_Platform_GetModules`, `sp_Platform_SaveModule` (Task 1); `ModuleAdminRules.NormalizeKey(string?)` (existing).
- Produces: `GET api/platform/applications` → `ApiResponse<List<ApplicationDto>>`; `POST api/platform/applications/save` (body `ApplicationDto`) → `ApiResponse<int>` (the module id).
- Produces: `ApplicationDto { int ModuleId; string ModuleKey, ModuleName, Description, Icon, Family, AppType, RoutePath; int SortOrder; bool IsReleased, IsActive; int CompanyCount }`.
- Produces: `CompanyModuleDto.IsReleased` (default `true`), `CompanyModuleDto.Family`.
- Produces: `ApplicationRules.Problem(ApplicationDto? dto)` → `string?` (null when the entry may be saved; it also normalises the fields of `dto`).

- [ ] **Step 1: Write the failing tests**

Create `EncryptzTests/ApplicationRulesTests.cs`:

```csharp
using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class ApplicationRulesTests
    {
        private static ApplicationDto App(string key = "PAYROLL", string name = "Payroll", string type = "Commercial",
            string route = "", bool released = false, string family = "")
            => new ApplicationDto { ModuleKey = key, ModuleName = name, AppType = type, RoutePath = route, IsReleased = released, Family = family };

        [Fact]
        public void A_complete_entry_has_no_problem()
        {
            Assert.Null(ApplicationRules.Problem(App()));
        }

        [Fact]
        public void Nothing_sent_is_a_problem()
        {
            Assert.Equal("Key and name are required", ApplicationRules.Problem(null));
        }

        [Fact]
        public void The_key_is_trimmed_and_upper_cased()
        {
            var app = App(key: "  payroll ");

            Assert.Null(ApplicationRules.Problem(app));
            Assert.Equal("PAYROLL", app.ModuleKey);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("PAY ROLL")]
        [InlineData("PAY-ROLL")]
        [InlineData("PÄY")]
        public void A_key_is_letters_digits_and_underscore(string key)
        {
            Assert.Equal("The key may hold letters, digits and _ only", ApplicationRules.Problem(App(key: key)));
        }

        [Fact]
        public void A_key_of_more_than_50_characters_is_refused()
        {
            Assert.Equal("The key may hold letters, digits and _ only", ApplicationRules.Problem(App(key: new string('A', 51))));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void A_name_is_required(string name)
        {
            Assert.Equal("Key and name are required", ApplicationRules.Problem(App(name: name)));
        }

        [Fact]
        public void A_name_of_more_than_150_characters_is_refused()
        {
            Assert.Equal("The name is too long", ApplicationRules.Problem(App(name: new string('n', 151))));
        }

        [Theory]
        [InlineData("personal", "Personal")]
        [InlineData(" COMMERCIAL ", "Commercial")]
        public void The_type_is_stored_in_its_one_spelling(string typed, string stored)
        {
            var app = App(type: typed);

            Assert.Null(ApplicationRules.Problem(app));
            Assert.Equal(stored, app.AppType);
        }

        [Theory]
        [InlineData("")]
        [InlineData("Free")]
        public void Any_other_type_is_refused(string type)
        {
            Assert.Equal("Choose Personal or Commercial", ApplicationRules.Problem(App(type: type)));
        }

        [Fact]
        public void A_released_personal_application_needs_a_route()
        {
            Assert.Equal("A personal application needs a route before it is released",
                ApplicationRules.Problem(App(type: "Personal", released: true)));
            Assert.Null(ApplicationRules.Problem(App(type: "Personal", released: true, route: "/apps/jobs")));
            Assert.Null(ApplicationRules.Problem(App(type: "Personal", released: false)));
        }

        [Theory]
        [InlineData("apps/jobs")]
        [InlineData("https://example.com/jobs")]
        [InlineData("//example.com")]
        [InlineData("/apps/jobs?x=1")]
        [InlineData("/apps/jo bs")]
        public void A_route_is_a_path_inside_the_application(string route)
        {
            Assert.Equal("The route must start with / and hold letters, digits, - _ and / only",
                ApplicationRules.Problem(App(route: route)));
        }

        [Fact]
        public void An_empty_family_and_route_stay_empty_and_long_ones_are_refused()
        {
            var app = App(family: "  HR ", route: " /apps/hr ");

            Assert.Null(ApplicationRules.Problem(app));
            Assert.Equal("HR", app.Family);
            Assert.Equal("/apps/hr", app.RoutePath);

            Assert.Equal("The family is too long", ApplicationRules.Problem(App(family: new string('f', 101))));
            Assert.Equal("The route is too long", ApplicationRules.Problem(App(route: "/" + new string('r', 200))));
        }
    }
}
```

Create `EncryptzTests/PlatformApplicationEndpointsTests.cs`:

```csharp
using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using EncryptzBL.DTO_s;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class PlatformApplicationEndpointsTests
    {
        private static MethodInfo Action(string name)
            => typeof(PlatformController).GetMethod(name)
               ?? throw new Xunit.Sdk.XunitException($"PlatformController.{name} does not exist");

        [Theory]
        [InlineData("GetApplications", "GET", "applications")]
        [InlineData("SaveApplication", "POST", "applications/save")]
        public void The_application_endpoints_exist_with_their_routes(string action, string verb, string template)
        {
            var http = Action(action).GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal(template, http.Template);
        }

        [Theory]
        [InlineData("GetApplications")]
        [InlineData("SaveApplication")]
        public void The_application_endpoints_need_a_login_and_the_platform_unlock(string action)
        {
            Assert.NotNull(typeof(PlatformController).GetCustomAttribute<AuthorizeAttribute>());
            Assert.NotNull(Action(action).GetCustomAttribute<PlatformUnlockedAttribute>());
            Assert.Null(Action(action).GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Fact]
        public void The_application_comes_from_the_body()
        {
            var dto = Action("SaveApplication").GetParameters().Single();

            Assert.Equal(typeof(ApplicationDto), dto.ParameterType);
            Assert.NotNull(dto.GetCustomAttribute<FromBodyAttribute>());
        }

        [Fact]
        public void A_company_module_row_is_released_unless_the_database_says_otherwise()
        {
            Assert.True(new CompanyModuleDto().IsReleased);
            Assert.Equal("", new CompanyModuleDto().Family);
        }
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test EncryptzTests --filter "FullyQualifiedName~ApplicationRulesTests|FullyQualifiedName~PlatformApplicationEndpointsTests" --nologo`
Expected: build FAILS: `The type or namespace name 'ApplicationDto' could not be found`.

- [ ] **Step 3: Add the DTOs**

In `EncryptzBL/DTO's/PlatformDtos.cs`, add to `CompanyModuleDto` after `UserCount`:

```csharp
        /// <summary>False = "Coming soon": cannot be switched on. True when the database has no such column.</summary>
        public bool IsReleased { get; set; } = true;
        public string Family { get; set; } = "";
```

and add after the class `SetCompanyModuleRequest`:

```csharp
    /// <summary>An application of the catalogue (a row of Modules), as the platform administrator sees it.</summary>
    public class ApplicationDto
    {
        public int ModuleId { get; set; }
        public string ModuleKey { get; set; } = "";
        public string ModuleName { get; set; } = "";
        public string Description { get; set; } = "";
        public string Icon { get; set; } = "";
        public string Family { get; set; } = "";
        /// <summary>Personal | Commercial</summary>
        public string AppType { get; set; } = "Commercial";
        /// <summary>Where the UI opens a personal application, for example /apps/jobs.</summary>
        public string RoutePath { get; set; } = "";
        public int SortOrder { get; set; }
        /// <summary>False = "Coming soon".</summary>
        public bool IsReleased { get; set; }
        public bool IsActive { get; set; } = true;
        /// <summary>Companies that have it switched on.</summary>
        public int CompanyCount { get; set; }
    }
```

- [ ] **Step 4: Add the rules**

Create `EncryptzBL/Common/Tenant/ApplicationRules.cs`:

```csharp
using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// What an entry of the application catalogue may look like. The database checks what
    /// needs the stored rows (duplicate key, key and type of an existing entry).
    /// </summary>
    public static class ApplicationRules
    {
        public const string Personal = "Personal";
        public const string Commercial = "Commercial";

        // sizes of dbo.Modules
        private const int MaxName = 150, MaxDescription = 400, MaxIcon = 100, MaxFamily = 100, MaxRoute = 200;

        /// <summary>Null when the entry may be saved. The fields of <paramref name="dto"/> are trimmed and normalised.</summary>
        public static string? Problem(ApplicationDto? dto)
        {
            if (dto == null)
                return "Key and name are required";

            dto.ModuleName = (dto.ModuleName ?? "").Trim();
            dto.Description = (dto.Description ?? "").Trim();
            dto.Icon = (dto.Icon ?? "").Trim();
            dto.Family = (dto.Family ?? "").Trim();
            dto.RoutePath = (dto.RoutePath ?? "").Trim();

            var key = ModuleAdminRules.NormalizeKey(dto.ModuleKey);
            if (key == null)
                return "The key may hold letters, digits and _ only";
            dto.ModuleKey = key;

            if (dto.ModuleName.Length == 0)
                return "Key and name are required";
            if (dto.ModuleName.Length > MaxName)
                return "The name is too long";
            if (dto.Description.Length > MaxDescription)
                return "The description is too long";
            if (dto.Icon.Length > MaxIcon)
                return "The icon name is too long";
            if (dto.Family.Length > MaxFamily)
                return "The family is too long";

            var type = (dto.AppType ?? "").Trim();
            if (string.Equals(type, Personal, StringComparison.OrdinalIgnoreCase))
                dto.AppType = Personal;
            else if (string.Equals(type, Commercial, StringComparison.OrdinalIgnoreCase))
                dto.AppType = Commercial;
            else
                return "Choose Personal or Commercial";

            if (dto.RoutePath.Length > MaxRoute)
                return "The route is too long";
            if (dto.RoutePath.Length > 0 && !IsLocalPath(dto.RoutePath))
                return "The route must start with / and hold letters, digits, - _ and / only";

            if (dto.AppType == Personal && dto.IsReleased && dto.RoutePath.Length == 0)
                return "A personal application needs a route before it is released";

            return null;
        }

        /// <summary>A path inside the application: never another site, never a query.</summary>
        private static bool IsLocalPath(string path)
        {
            if (path[0] != '/' || path.StartsWith("//", StringComparison.Ordinal))
                return false;

            foreach (var ch in path)
            {
                var allowed = (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')
                              || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_' || ch == '/';
                if (!allowed)
                    return false;
            }

            return true;
        }
    }
}
```

- [ ] **Step 5: Add the service methods**

In `EncryptzBL/Infrastructure/User/Modules/IPlatformService.cs`, add after the `GetCompanyModules` line:

```csharp
        Task<ApiResponse<List<ApplicationDto>>> GetApplications(PlatformActor actor);
        Task<ApiResponse<int>> SaveApplication(ApplicationDto dto, PlatformActor actor);
```

In `EncryptzBL/Infrastructure/User/Modules/PlatformService.cs`, add directly above `public async Task<ApiResponse<List<CompanyModuleDto>>> GetCompanyModules(`:

```csharp
        // the catalogue is shared by every company: platform only
        public async Task<ApiResponse<List<ApplicationDto>>> GetApplications(PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<List<ApplicationDto>>.Fail(NotAllowed);

            return ApiResponse<List<ApplicationDto>>.Ok(await GetListAsync<ApplicationDto>("sp_Platform_GetModules"));
        }

        public async Task<ApiResponse<int>> SaveApplication(ApplicationDto dto, PlatformActor actor)
        {
            if (!actor.IsPlatformAdmin)
                return ApiResponse<int>.Fail(NotAllowed);

            var problem = ApplicationRules.Problem(dto);
            if (problem != null)
                return ApiResponse<int>.Fail(problem);

            var dt = await GetDataTableAsync("sp_Platform_SaveModule", new[]
            {
                SqlParameterHelper.Input("@ModuleId", dto.ModuleId),
                SqlParameterHelper.Input("@ModuleKey", dto.ModuleKey),
                SqlParameterHelper.Input("@ModuleName", dto.ModuleName),
                SqlParameterHelper.Input("@Description", dto.Description),
                SqlParameterHelper.Input("@Icon", dto.Icon),
                SqlParameterHelper.Input("@Family", dto.Family),
                SqlParameterHelper.Input("@AppType", dto.AppType),
                SqlParameterHelper.Input("@RoutePath", dto.RoutePath),
                SqlParameterHelper.Input("@SortOrder", dto.SortOrder),
                SqlParameterHelper.Input("@IsReleased", dto.IsReleased),
                SqlParameterHelper.Input("@IsActive", dto.IsActive)
            });

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Save failed");

            var message = dt.Rows[0]["Message"]?.ToString() ?? "";
            if (Convert.ToInt32(dt.Rows[0]["Success"]) != 1)
                return ApiResponse<int>.Fail(message);

            _logger.LogInformation("Application {ModuleKey} saved by user {UserId} (type {AppType}, released {IsReleased}, active {IsActive})",
                dto.ModuleKey, actor.UserId, dto.AppType, dto.IsReleased, dto.IsActive);

            return ApiResponse<int>.Ok(Convert.ToInt32(dt.Rows[0]["ModuleId"]), message);
        }
```

`ApplicationRules` is in `EncryptzBL.Common.Tenant`, the namespace `ModuleAdminRules` already comes from in this file: no new `using` is needed.

- [ ] **Step 6: Add the endpoints**

In `EncryptzAPI/Controllers/PlatformController.cs`, add directly above the comment line `// ── MODULES OF A COMPANY ──────────────────`:

```csharp
        // ── APPLICATIONS (the catalogue) ──────────

        [PlatformUnlocked]
        [HttpGet("applications")]
        public async Task<IActionResult> GetApplications()
            => Ok(await _service.GetApplications(Actor()));

        [PlatformUnlocked]
        [HttpPost("applications/save")]
        public async Task<IActionResult> SaveApplication([FromBody] ApplicationDto dto)
            => Ok(await _service.SaveApplication(dto, Actor()));

```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `dotnet test EncryptzTests --filter "FullyQualifiedName~ApplicationRulesTests|FullyQualifiedName~PlatformApplicationEndpointsTests|FullyQualifiedName~PlatformModuleEndpointsTests" --nologo`
Expected: PASS.

If another class in `EncryptzTests` implements `IPlatformService` by hand, the build fails with `does not implement interface member 'IPlatformService.GetApplications'`: add both members to that class, each returning `Task.FromResult(ApiResponse<...>.Fail("not used"))`.

- [ ] **Step 8: Commit**

```bash
git add EncryptzBL/Common/Tenant/ApplicationRules.cs "EncryptzBL/DTO's/PlatformDtos.cs" EncryptzBL/Infrastructure/User/Modules/IPlatformService.cs EncryptzBL/Infrastructure/User/Modules/PlatformService.cs EncryptzAPI/Controllers/PlatformController.cs EncryptzTests/ApplicationRulesTests.cs EncryptzTests/PlatformApplicationEndpointsTests.cs
git commit -m "Platform Admin API: read and save the application catalogue"
```

---

### Task 4: Personal applications endpoint

**Files:**
- Modify: `EncryptzBL/DTO's/FlixDtos.cs` (new `PersonalAppDto` after `ModuleDto`)
- Modify: `EncryptzBL/Infrastructure/User/Modules/IAuthService.cs`, `AuthService.cs`
- Modify: `EncryptzAPI/Controllers/AuthController.cs`
- Test: `EncryptzTests/PersonalAppsEndpointTests.cs`

**Interfaces:**
- Consumes: `sp_User_GetPersonalApps` (Task 1; may be missing); `CompanyProvisioningService.WhenInstalledAsync<T>(Func<Task<T>> call, Func<T> fallback, ILogger logger, string procedure)` (existing, public static, in `EncryptzBL.Infrastructure.Provisioning`).
- Produces: `GET api/auth/personal-apps` → `ApiResponse<List<PersonalAppDto>>`, for any logged-in user (a login token without a company is enough).
- Produces: `PersonalAppDto { int ModuleId; string ModuleKey, ModuleName, Description, Icon, Family, RoutePath; int SortOrder; bool IsReleased }`.

- [ ] **Step 1: Write the failing test**

Create `EncryptzTests/PersonalAppsEndpointTests.cs`:

```csharp
using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class PersonalAppsEndpointTests
    {
        private static MethodInfo Action()
            => typeof(AuthController).GetMethod("GetPersonalApps")
               ?? throw new Xunit.Sdk.XunitException("AuthController.GetPersonalApps does not exist");

        [Fact]
        public void The_endpoint_is_a_GET_on_personal_apps()
        {
            var http = Action().GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains("GET", http.HttpMethods);
            Assert.Equal("personal-apps", http.Template);
        }

        [Fact]
        public void It_needs_a_login_and_no_role()
        {
            var authorize = Action().GetCustomAttribute<AuthorizeAttribute>();

            Assert.NotNull(authorize);
            Assert.Null(authorize!.Roles);
            Assert.Null(Action().GetCustomAttribute<AllowAnonymousAttribute>());
        }

        [Fact]
        public void It_takes_nothing_from_the_caller()
        {
            // nothing personal is returned: no user id, no company id
            Assert.Empty(Action().GetParameters());
        }

        [Fact]
        public void The_service_lists_personal_applications_without_a_user_or_company()
        {
            var method = typeof(IAuthService).GetMethod("GetPersonalApps");

            Assert.NotNull(method);
            Assert.Empty(method!.GetParameters());
            Assert.Equal(typeof(Task<EncryptzBL.Common.ApiResponse<List<PersonalAppDto>>>), method.ReturnType);
        }

        [Fact]
        public void A_personal_application_is_not_released_until_the_database_says_so()
        {
            Assert.False(new PersonalAppDto().IsReleased);
            Assert.Equal("", new PersonalAppDto().RoutePath);
        }
    }
}
```

If `ApiResponse<T>` is not in the namespace `EncryptzBL.Common`, read the `using` lines at the top of `EncryptzBL/Infrastructure/User/Modules/IAuthService.cs` and use the namespace that file imports it from.

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test EncryptzTests --filter "FullyQualifiedName~PersonalAppsEndpointTests" --nologo`
Expected: build FAILS: `The type or namespace name 'PersonalAppDto' could not be found`.

- [ ] **Step 3: Implement**

In `EncryptzBL/DTO's/FlixDtos.cs`, add directly after the closing brace of the class `ModuleDto`:

```csharp
    /// <summary>A personal application: open to every user, without a company.</summary>
    public class PersonalAppDto
    {
        public int ModuleId { get; set; }
        public string ModuleKey { get; set; } = string.Empty;
        public string ModuleName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
        public string Family { get; set; } = string.Empty;
        /// <summary>Where the UI opens it ('' while it is not built).</summary>
        public string RoutePath { get; set; } = string.Empty;
        public int SortOrder { get; set; }
        /// <summary>False = "Coming soon".</summary>
        public bool IsReleased { get; set; }
    }
```

In `EncryptzBL/Infrastructure/User/Modules/IAuthService.cs`, add after the `GetModules` line:

```csharp
        Task<ApiResponse<List<PersonalAppDto>>> GetPersonalApps();
```

In `EncryptzBL/Infrastructure/User/Modules/AuthService.cs`, add directly above `public async Task<ApiResponse<List<ProjectDto>>> GetProjects(int userId, int companyId)`:

```csharp
        /// <summary>
        /// Personal applications are the same for everybody. A main database without
        /// script 21 has no such procedure: the list is then empty, not an error.
        /// </summary>
        public Task<ApiResponse<List<PersonalAppDto>>> GetPersonalApps()
            => CompanyProvisioningService.WhenInstalledAsync(
                async () => ApiResponse<List<PersonalAppDto>>.Ok(
                    await GetListAsync<PersonalAppDto>("sp_User_GetPersonalApps"), "Success"),
                () => ApiResponse<List<PersonalAppDto>>.Ok(new List<PersonalAppDto>(), "Success"),
                _logger, "sp_User_GetPersonalApps");

```

Add `using EncryptzBL.Infrastructure.Provisioning;` to the `using` lines of `AuthService.cs` if it is not there.

In `EncryptzAPI/Controllers/AuthController.cs`, add directly above the comment line `// ── MODULE / BRANCH SCOPING (Company -> Modules -> Branches) ──────`:

```csharp
        /// <summary>Personal applications: listed before a company is picked.</summary>
        [HttpGet("personal-apps")]
        [Authorize]
        public async Task<IActionResult> GetPersonalApps()
            => Ok(await _authService.GetPersonalApps());

```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test EncryptzTests --filter "FullyQualifiedName~PersonalAppsEndpointTests" --nologo`
Expected: PASS, every test of the class.

If another class in `EncryptzTests` implements `IAuthService` by hand, add `public Task<ApiResponse<List<PersonalAppDto>>> GetPersonalApps() => Task.FromResult(ApiResponse<List<PersonalAppDto>>.Ok(new List<PersonalAppDto>(), ""));` to it.

- [ ] **Step 5: Commit**

```bash
git add "EncryptzBL/DTO's/FlixDtos.cs" EncryptzBL/Infrastructure/User/Modules/IAuthService.cs EncryptzBL/Infrastructure/User/Modules/AuthService.cs EncryptzAPI/Controllers/AuthController.cs EncryptzTests/PersonalAppsEndpointTests.cs
git commit -m "List personal applications for a logged-in user without a company"
```

---

### Task 5: Personal DB executor and schema script

**Files:**
- Create: `EncryptzBL/Common/PersonalDbHelper.cs`
- Create: `EncryptzAPI/Database/PersonalDB/01_Schema.sql`
- Modify: `EncryptzAPI/ServiceRegistration.cs` (after the `MainDbHelper` line, around line 37)
- Test: `EncryptzTests/PersonalDbTests.cs`

**Interfaces:**
- Produces: `PersonalDbHelper : SqlDbHelper` with `bool IsConfigured` and `const string NotAvailable = "This application is not available right now"`; reads `ConnectionStrings:PersonalConnection`. Later phases inject it.
- `appsettings.json` is NOT edited: a missing key means "not configured". The owner adds the key when the database exists.

- [ ] **Step 1: Write the failing test**

Create `EncryptzTests/PersonalDbTests.cs`:

```csharp
using System.Text.RegularExpressions;
using EncryptzBL.Common;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace EncryptzTests
{
    public class PersonalDbTests
    {
        private static IConfiguration Config(string? connection)
        {
            var values = new Dictionary<string, string?>();
            if (connection != null) values["ConnectionStrings:PersonalConnection"] = connection;
            return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Without_a_connection_string_the_api_still_starts(string? connection)
        {
            var helper = new PersonalDbHelper(Config(connection));

            Assert.False(helper.IsConfigured);
        }

        [Fact]
        public void With_a_connection_string_it_is_configured()
        {
            var helper = new PersonalDbHelper(Config("Server=x;Database=PersonalDB;Integrated Security=true"));

            Assert.True(helper.IsConfigured);
        }

        [Fact]
        public void The_message_for_users_names_no_database()
        {
            Assert.Equal("This application is not available right now", PersonalDbHelper.NotAvailable);
        }

        private static string RepositoryRoot()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;

            return folder?.FullName ?? throw new Xunit.Sdk.XunitException("The repository root was not found");
        }

        private static string Schema()
            => File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Database", "PersonalDB", "01_Schema.sql"));

        [Theory]
        [InlineData("USE ")]
        [InlineData("CREATE DATABASE")]
        [InlineData("DROP DATABASE")]
        [InlineData("DROP TABLE")]
        public void The_schema_script_never_switches_creates_or_drops_a_database(string forbidden)
        {
            var code = Regex.Replace(Schema(), @"/\*.*?\*/", "", RegexOptions.Singleline);
            code = Regex.Replace(code, @"--[^\n]*", "");

            Assert.DoesNotContain(forbidden, code, StringComparison.OrdinalIgnoreCase);
        }

        [Theory]
        [InlineData("OBJECT_ID('dbo.Companies') IS NOT NULL")]   // the main database
        [InlineData("OBJECT_ID('dbo.Locations') IS NOT NULL")]   // a company database
        [InlineData("DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')")]
        public void The_schema_script_refuses_every_database_that_is_not_the_personal_one(string guard)
        {
            var script = Schema();

            Assert.Contains(guard, script);
            Assert.Contains("SET NOEXEC ON", script);
        }

        [Fact]
        public void The_personal_db_is_registered_next_to_the_main_one()
        {
            var registration = File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "ServiceRegistration.cs"));

            Assert.Contains("services.AddScoped<PersonalDbHelper>();", registration);
        }
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test EncryptzTests --filter "FullyQualifiedName~PersonalDbTests" --nologo`
Expected: build FAILS: `The type or namespace name 'PersonalDbHelper' could not be found`.

- [ ] **Step 3: Implement**

Create `EncryptzBL/Common/PersonalDbHelper.cs`:

```csharp
using Microsoft.Extensions.Configuration;

namespace EncryptzBL.Common
{
    /// <summary>
    /// DB executor bound to the Personal DB ("PersonalConnection"): the data of personal
    /// applications, keyed by the main database UserId. It belongs to no company and
    /// takes no tenant context. A company database never reads it; the API does.
    /// </summary>
    public class PersonalDbHelper : SqlDbHelper
    {
        /// <summary>What a user is told while the Personal DB is not configured.</summary>
        public const string NotAvailable = "This application is not available right now";

        private readonly string? _connectionString;

        public PersonalDbHelper(IConfiguration configuration)
        {
            // optional: the API must start on an installation that has no Personal DB yet
            var value = configuration.GetConnectionString("PersonalConnection");
            _connectionString = string.IsNullOrWhiteSpace(value) ? null : value;
        }

        /// <summary>False until ConnectionStrings:PersonalConnection is set. Check it before a call.</summary>
        public bool IsConfigured => _connectionString != null;

        protected override string ConnectionString
            => _connectionString ?? throw new InvalidOperationException("ConnectionStrings:PersonalConnection is not configured.");
    }
}
```

In `EncryptzAPI/ServiceRegistration.cs`, add directly below the line `services.AddScoped<MainDbHelper>();` (keep its trailing comment where it is):

```csharp
            services.AddScoped<PersonalDbHelper>();                                 // Personal DB executor (personal applications)
```

Create `EncryptzAPI/Database/PersonalDB/01_Schema.sql`:

```sql
/* =============================================================================
   PersonalDB · 01 · Marks a database as the Personal DB
   -----------------------------------------------------------------------------
   The Personal DB holds the data of personal applications (Job Portal, Expense
   Manager, ...). Rows are keyed by the UserId of the SaaS main database. Each
   application gets its own schema in a later script of this folder.

   Create an EMPTY database by hand, select it in SSMS, then run this script.
   There is no USE statement on purpose. It refuses to run in a system database,
   in the SaaS main database and in a company database. SAFE TO RE-RUN.

   The API reads it through ConnectionStrings:PersonalConnection. A company
   database never connects to it.
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
BEGIN
    RAISERROR('Select the Personal DB before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Companies') IS NOT NULL
BEGIN
    RAISERROR('This is the SaaS main database. The Personal DB is a database of its own.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Locations') IS NOT NULL
BEGIN
    RAISERROR('This is a company database. The Personal DB is a database of its own.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.SchemaInfo') IS NULL
CREATE TABLE dbo.SchemaInfo
(
    SchemaKey NVARCHAR(50) NOT NULL CONSTRAINT PK_SchemaInfo PRIMARY KEY,
    AppliedAt DATETIME NOT NULL CONSTRAINT DF_SchemaInfo_AppliedAt DEFAULT (GETDATE())
);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaInfo WHERE SchemaKey = 'PERSONAL_DB')
    INSERT INTO dbo.SchemaInfo (SchemaKey) VALUES ('PERSONAL_DB');
GO

PRINT 'This database is marked as the Personal DB.';
GO
SET NOEXEC OFF;
GO
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test EncryptzTests --filter "FullyQualifiedName~PersonalDbTests" --nologo`
Expected: PASS, every test of the class.

- [ ] **Step 5: Commit**

```bash
git add EncryptzBL/Common/PersonalDbHelper.cs EncryptzAPI/ServiceRegistration.cs EncryptzAPI/Database/PersonalDB/01_Schema.sql EncryptzTests/PersonalDbTests.cs
git commit -m "Personal DB: optional connection, executor and the script that marks the database"
```

---

### Task 6: UI — Applications section in Platform Admin

**Files:**
- Modify: `encryptzUI/src/styles.scss` (append)
- Modify: `encryptzUI/src/app/Encryptz/Services/platform-service.ts`
- Modify: `encryptzUI/src/app/Encryptz/Services/platform-nav-service.ts`
- Modify: `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.ts`, `.html`
- Test: `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-applications.spec.ts` (new)

**Interfaces:**
- Consumes: `GET api/platform/applications`, `POST api/platform/applications/save` (Task 3); `CompanyModule.isReleased` (Task 3).
- Produces: global CSS classes `.soon-badge` (amber, text "Coming soon") and `.released-badge` (green). Task 7 uses `.soon-badge`.
- Produces: `PlatformApplication` (interface in `platform-service.ts`), `PlatformService.getApplications()`, `PlatformService.saveApplication(app)`; `PlatformTab` value `'applications'`.

- [ ] **Step 1: Write the failing test**

Create `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-applications.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { PlatformService } from '../../Services/platform-service';
import { PLATFORM_SECTIONS } from '../../Services/platform-nav-service';
import { PlatformAdminComponent } from './platform-admin-component';

describe('PlatformAdminComponent applications', () => {
  const service = { moduleId: 1, moduleKey: 'SERVICE', moduleName: 'Service Management', description: 'd', icon: 'build', family: 'Business', appType: 'Commercial', routePath: '', sortOrder: 1, isReleased: true, isActive: true, companyCount: 2 };
  const payroll = { moduleId: 5, moduleKey: 'PAYROLL', moduleName: 'Payroll', description: 'd', icon: 'payments', family: 'HR', appType: 'Commercial', routePath: '', sortOrder: 5, isReleased: false, isActive: true, companyCount: 0 };
  const jobs = { moduleId: 8, moduleKey: 'JOBPORTAL', moduleName: 'Job Portal', description: 'd', icon: 'badge', family: '', appType: 'Personal', routePath: '', sortOrder: 1, isReleased: false, isActive: true, companyCount: 0 };

  let api: any;
  let saved: any[];
  let saveAnswer: any;

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

  const open = (fixture: any) => {
    fixture.componentInstance.setTab('applications');
    fixture.detectChanges();
  };

  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

  beforeEach(() => {
    saved = [];
    saveAnswer = { success: true, message: 'Application saved', data: 5 };
    api = {
      isUnlocked: () => of({ success: true, unlocked: true }),
      getCompanies: () => of({ success: true, message: '', data: [] }),
      getProjects: () => of({ success: true, message: '', data: [] }),
      getApplications: () => of({ success: true, message: '', data: [service, payroll, jobs] }),
      saveApplication: (app: any) => { saved.push({ ...app }); return of(saveAnswer); },
      lock: () => {},
    };
  });

  it('lists Applications in the sidebar sections right after Companies', () => {
    const tabs = PLATFORM_SECTIONS.map(s => s.tab);
    expect(tabs.indexOf('applications')).toBe(tabs.indexOf('companies') + 1);
  });

  it('shows the Applications tab to a platform administrator only', () => {
    const labels = (f: any) => (Array.from(f.nativeElement.querySelectorAll('.pa-tabs button')) as HTMLElement[]).map(b => b.textContent?.trim());

    expect(labels(create(true))).toContain('Applications');
    expect(labels(create(false))).not.toContain('Applications');
  });

  it('does not open the section for a company administrator', () => {
    const fixture = create(false);
    open(fixture);
    expect(fixture.componentInstance.tab()).toBe('companies');
  });

  it('lists every application with its family and type', () => {
    const fixture = create(true);
    open(fixture);

    const rows = fixture.nativeElement.querySelectorAll('.pa-app-row');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('Service Management');
    expect(rows[0].textContent).toContain('Business');
    expect(rows[0].textContent).toContain('Commercial');
    expect(rows[2].textContent).toContain('Personal');
  });

  it('highlights an application that is not released with the Coming soon badge', () => {
    const fixture = create(true);
    open(fixture);

    const rows = fixture.nativeElement.querySelectorAll('.pa-app-row');
    expect(rows[0].querySelector('.soon-badge')).toBeNull();
    expect(rows[0].querySelector('.released-badge')?.textContent?.trim()).toBe('Released');
    expect(rows[1].querySelector('.soon-badge')?.textContent?.trim()).toBe('Coming soon');
    expect(rows[2].querySelector('.soon-badge')?.textContent?.trim()).toBe('Coming soon');
  });

  it('suggests the families already in use, each once and sorted', () => {
    const fixture = create(true);
    open(fixture);
    expect(fixture.componentInstance.families()).toEqual(['Business', 'HR']);
  });

  it('starts a new application as commercial, coming soon and active', () => {
    const fixture = create(true);
    open(fixture);
    fixture.componentInstance.newApplication();

    expect(fixture.componentInstance.applicationForm).toEqual({
      moduleId: 0, moduleKey: '', moduleName: '', description: '', icon: '', family: '',
      appType: 'Commercial', routePath: '', sortOrder: 0, isReleased: false, isActive: true, companyCount: 0,
    });
  });

  it('does not send an application without key or name', () => {
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;
    c.newApplication();
    c.applicationForm!.moduleName = 'Hotel';
    c.saveApplication();

    expect(saved.length).toBe(0);
    expect(c.formError()).toBe('Key and name are required');
  });

  it('does not send a released personal application without a route', () => {
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;
    c.editApplication(jobs as any);
    c.applicationForm!.isReleased = true;
    c.saveApplication();

    expect(saved.length).toBe(0);
    expect(c.formError()).toBe('A personal application needs a route before it is released');
  });

  it('saves, closes the dialog and reads the list again', () => {
    let reads = 0;
    api.getApplications = () => { reads++; return of({ success: true, message: '', data: [service, payroll, jobs] }); };
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.editApplication(payroll as any);
    c.applicationForm!.family = 'People';
    c.saveApplication();

    expect(saved[0].moduleKey).toBe('PAYROLL');
    expect(saved[0].family).toBe('People');
    expect(c.applicationForm).toBeNull();
    expect(reads).toBe(2);
  });

  it('keeps the dialog open and shows the message when the save is refused', () => {
    saveAnswer = { success: false, message: 'The key is already used', data: 0 };
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.newApplication();
    c.applicationForm!.moduleKey = 'PAYROLL';
    c.applicationForm!.moduleName = 'Payroll 2';
    c.saveApplication();

    expect(c.applicationForm).not.toBeNull();
    expect(c.formError()).toBe('The key is already used');
  });

  it('makes the key read-only when an application is edited', () => {
    const fixture = create(true);
    open(fixture);
    fixture.componentInstance.editApplication(payroll as any);
    fixture.detectChanges();

    const key = fixture.nativeElement.querySelector('input[name="applicationKey"]') as HTMLInputElement;
    expect(key.readOnly).toBe(true);
    expect(text(fixture)).toContain('Edit Application');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `encryptzUI`): `.\node_modules\.bin\ng.cmd test --watch=false --include "src/app/Encryptz/components/platform-admin-component/platform-admin-applications.spec.ts"`
Expected: FAIL to compile: `Argument of type '"applications"' is not assignable to parameter of type 'PlatformTab'`.

- [ ] **Step 3: Badge styles**

Append to `encryptzUI/src/styles.scss`:

```scss
/* Application status. One style everywhere an application is listed. */
.soon-badge,
.released-badge {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  vertical-align: middle;
}

.soon-badge {
  background: #f59e0b;
  color: #1f2937;
}

.released-badge {
  background: #e6f6ec;
  color: #15803d;
}
```

- [ ] **Step 4: Service and sidebar entry**

In `encryptzUI/src/app/Encryptz/Services/platform-service.ts`:

Add to the interface `CompanyModule`, after `userCount`:

```ts
  /** false = "Coming soon": cannot be switched on. Missing on an API without the flag. */
  isReleased?: boolean;
  family?: string;
```

Add after the interface `CompanyModule`:

```ts
/** An application of the catalogue, as the platform administrator sees it. */
export interface PlatformApplication {
  moduleId: number;
  moduleKey: string;
  moduleName: string;
  description: string;
  icon: string;
  family: string;
  appType: 'Personal' | 'Commercial';
  /** Where the UI opens a personal application, for example /apps/jobs. */
  routePath: string;
  sortOrder: number;
  /** false = "Coming soon". */
  isReleased: boolean;
  isActive: boolean;
  /** Companies that have it switched on. */
  companyCount: number;
}
```

Add directly above `getSettings(): Observable<ApiResponse<PlatformSetting[]>> {`:

```ts
  getApplications(): Observable<ApiResponse<PlatformApplication[]>> {
    return this.http.get<ApiResponse<PlatformApplication[]>>(`${this.api}/applications`, { headers: this.headers });
  }

  saveApplication(app: PlatformApplication): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/applications/save`, app, { headers: this.headers });
  }

```

In `encryptzUI/src/app/Encryptz/Services/platform-nav-service.ts`, replace the `PlatformTab` line and add the section after `companies`:

```ts
export type PlatformTab = 'companies' | 'applications' | 'projects' | 'locations' | 'branchAccess' | 'access' | 'menus' | 'servers' | 'settings';
```

```ts
  { tab: 'companies', label: 'Companies', icon: 'apartment' },
  { tab: 'applications', label: 'Applications', icon: 'widgets' },
```

- [ ] **Step 5: Component**

In `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.ts`:

Add `PlatformApplication,` to the import list from `'../../Services/platform-service'` (alphabetical, after `DbServerForm,`).

Add after the field `settings = signal<PlatformSetting[]>([]);`:

```ts
  applications = signal<PlatformApplication[]>([]);
  /** Application dialog (null = closed). */
  applicationForm: PlatformApplication | null = null;
  /** Families already in use, each once: suggested in the dialog so one family has one spelling. */
  families = computed(() => [...new Set(this.applications().map(a => (a.family || '').trim()).filter(f => f))]
    .sort((a, b) => a.localeCompare(b)));
  private applicationsSub = new Subscription();
```

In `setTab`, replace the first line of the body and add the load:

```ts
    if ((tab === 'servers' || tab === 'settings' || tab === 'applications') && !this.isPlatformAdmin()) return;
    if (tab !== this.tab()) { this.closeForms(); this.cancelServersLoad(); this.cancelSettingsLoad(); this.cancelApplicationsLoad(); }
    this.tab.set(tab);
    this.nav.tab.set(tab);
    if (tab === 'servers') this.loadServers();
    if (tab === 'settings') this.loadSettings();
    if (tab === 'applications') this.loadApplications();
```

In `relock`, add after the line that clears `servers` and `settings`:

```ts
    this.cancelApplicationsLoad(); this.applications.set([]);
```

In `closeForms`, add after `this.serverForm = null;`:

```ts
    this.applicationForm = null;
```

Add directly above `loadSettings(): void {`:

```ts
  // ── applications (the catalogue) ──────────────────────────────────────────

  loadApplications(): void {
    this.cancelApplicationsLoad();
    this.applicationsSub.add(this.api.getApplications().subscribe({
      next: res => { if (res.success) this.applications.set(res.data ?? []); else this.notify(res.message, false); },
      error: err => this.fail(err, 'Could not load the applications'),
    }));
  }

  private cancelApplicationsLoad(): void {
    this.applicationsSub.unsubscribe();
    this.applicationsSub = new Subscription();
  }

  newApplication(): void {
    this.formError.set('');
    this.saveToken++;
    this.applicationForm = {
      moduleId: 0, moduleKey: '', moduleName: '', description: '', icon: '', family: '',
      appType: 'Commercial', routePath: '', sortOrder: 0, isReleased: false, isActive: true, companyCount: 0,
    };
  }

  editApplication(app: PlatformApplication): void {
    this.formError.set('');
    this.saveToken++;
    this.applicationForm = { ...app };
  }

  /** The same checks the API makes, so the common mistakes are answered at once. */
  private applicationProblem(form: PlatformApplication): string {
    if (!form.moduleKey.trim() || !form.moduleName.trim()) return 'Key and name are required';
    if (!/^[A-Za-z0-9_]+$/.test(form.moduleKey.trim())) return 'The key may hold letters, digits and _ only';
    const route = (form.routePath || '').trim();
    if (route && !/^\/(?!\/)[A-Za-z0-9\-_\/]*$/.test(route)) return 'The route must start with / and hold letters, digits, - _ and / only';
    if (form.appType === 'Personal' && form.isReleased && !route) return 'A personal application needs a route before it is released';
    return '';
  }

  saveApplication(): void {
    const form = this.applicationForm;
    if (!form || this.saving()) return;

    const problem = this.applicationProblem(form);
    if (problem) { this.formError.set(problem); return; }

    this.formError.set('');
    this.saving.set(true);
    const token = this.saveToken;
    this.api.saveApplication({ ...form, sortOrder: +form.sortOrder || 0 }).subscribe({
      next: res => {
        const current = token === this.saveToken;
        if (current) this.saving.set(false);
        if (!res.success) { if (current) this.formError.set(res.message); return; }
        if (current) this.applicationForm = null;
        this.notify(res.message, true);
        this.loadApplications();
      },
      error: err => this.failForm(err, token),
    });
  }

```

- [ ] **Step 6: Template**

In `platform-admin-component.html`:

In the tab strip, add inside the first `@if (isPlatformAdmin()) {` of `.pa-tabs`, as its first button:

```html
      <button [class.active]="tab() === 'applications'" (click)="setTab('applications')">Applications</button>
```

Add directly above the comment `<!-- ═══════════ MENUS ═══════════ -->`:

```html
  <!-- ═══════════ APPLICATIONS ═══════════ -->
  @if (tab() === 'applications' && isPlatformAdmin()) {
    <div class="fx-table-wrap">
      <div class="fx-table-toolbar">
        <div class="fx-toolbar-left">
          <span class="fx-table-title">Applications</span>
          <span class="fx-table-count">{{ applications().length }}</span>
        </div>
        <div class="fx-toolbar-right">
          <button class="fx-btn-new" (click)="newApplication()">+ New Application</button>
        </div>
      </div>

      <table class="fx-table">
        <thead>
          <tr>
            <th>Application</th><th>Key</th><th>Family</th><th>Type</th><th>Status</th>
            <th class="fx-num">Companies</th><th>Active</th><th></th>
          </tr>
        </thead>
        <tbody>
          @for (a of applications(); track a.moduleId) {
            <tr class="pa-app-row">
              <td>
                <strong>{{ a.moduleName }}</strong>
                @if (a.description) { <div class="pa-sub">{{ a.description }}</div> }
              </td>
              <td><code>{{ a.moduleKey }}</code></td>
              <td>{{ a.family || '—' }}</td>
              <td>{{ a.appType }}</td>
              <td>
                @if (a.isReleased) { <span class="released-badge">Released</span> }
                @else { <span class="soon-badge">Coming soon</span> }
              </td>
              <td class="fx-num">{{ a.appType === 'Commercial' ? a.companyCount : '—' }}</td>
              <td><span class="pa-status" [class.off]="!a.isActive">{{ a.isActive ? 'Active' : 'Inactive' }}</span></td>
              <td class="pa-actions">
                <button class="fx-action-btn" (click)="editApplication(a)" [attr.aria-label]="'Edit ' + a.moduleName">Edit</button>
              </td>
            </tr>
          } @empty {
            <tr class="fx-empty-row"><td colspan="8">No applications</td></tr>
          }
        </tbody>
      </table>
      <div class="pa-hint">
        Personal applications are free and open to every user on the company page. A company is
        subscribed to a commercial application under Companies, Modules. "Coming soon" applications
        are listed, but nobody can open or subscribe to them.
      </div>
    </div>
  }

```

Add directly above the comment `<!-- ═══════════ COMPANY DIALOG ═══════════ -->`:

```html
<!-- ═══════════ APPLICATION DIALOG ═══════════ -->
@if (applicationForm; as f) {
  <div class="modal-overlay" (click)="closeForms()">
    <div class="modal-content" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h2>{{ f.moduleId ? 'Edit Application' : 'New Application' }}</h2>
        <button class="modal-close" (click)="closeForms()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Name *</label>
            <input class="form-input" name="applicationName" [(ngModel)]="f.moduleName" maxlength="150" placeholder="Payroll" />
          </div>
          <div class="form-group">
            <label>Key *</label>
            <input class="form-input" name="applicationKey" [(ngModel)]="f.moduleKey" maxlength="50" placeholder="PAYROLL" [readOnly]="!!f.moduleId" />
            @if (f.moduleId) { <small>The key cannot be changed.</small> }
          </div>
          <div class="form-group">
            <label>Type *</label>
            <select class="form-input" name="applicationType" [(ngModel)]="f.appType">
              <option value="Commercial">Commercial (companies subscribe)</option>
              <option value="Personal">Personal (free, every user)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Family</label>
            <input class="form-input" name="applicationFamily" [(ngModel)]="f.family" maxlength="100" list="pa-families" placeholder="HR" />
            <datalist id="pa-families">
              @for (family of families(); track family) { <option [value]="family"></option> }
            </datalist>
          </div>
          <div class="form-group">
            <label>Icon</label>
            <input class="form-input" name="applicationIcon" [(ngModel)]="f.icon" maxlength="100" placeholder="payments" />
          </div>
          <div class="form-group">
            <label>Sort order</label>
            <input class="form-input" name="applicationSort" type="number" [(ngModel)]="f.sortOrder" />
          </div>
          <div class="form-group">
            <label>Route</label>
            <input class="form-input" name="applicationRoute" [(ngModel)]="f.routePath" maxlength="200" placeholder="/apps/jobs" />
            <small>Where a personal application opens. Needed before it is released.</small>
          </div>
          <div class="form-group">
            <label>Description</label>
            <input class="form-input" name="applicationDescription" [(ngModel)]="f.description" maxlength="400" />
          </div>
        </div>

        <label class="pa-check">
          <input type="checkbox" name="applicationReleased" [(ngModel)]="f.isReleased" />
          Released (clear it to show "Coming soon")
        </label>
        <label class="pa-check">
          <input type="checkbox" name="applicationActive" [(ngModel)]="f.isActive" />
          Active (clear it to hide the application from everyone)
        </label>

        @if (formError()) { <div class="pa-error">{{ formError() }}</div> }
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" (click)="closeForms()">Cancel</button>
        <button class="fx-btn-navy" (click)="saveApplication()" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
      </div>
    </div>
  </div>
}

```

In the Modules dialog of a company, replace the `<label class="pa-module-row">…</label>` block with:

```html
          <label class="pa-module-row">
            <input type="checkbox" [checked]="m.isEnabled"
                   [disabled]="!isPlatformAdmin() || switching().has(m.moduleKey) || (m.isReleased === false && !m.isEnabled)"
                   (change)="toggleCompanyModule(m, $event)" />
            <span class="pa-module-text">
              <strong>{{ m.moduleName }} @if (m.isReleased === false) { <span class="soon-badge">Coming soon</span> }</strong>
              <small>{{ m.description }}</small>
            </span>
            <span class="pa-status" [class.off]="!m.isEnabled">{{ m.isEnabled ? 'On · ' + m.userCount + ' users' : 'Off' }}</span>
          </label>
```

(An application that is not released can still be switched OFF when it is on: the checkbox is disabled only while it is off.)

- [ ] **Step 7: Add the Modules dialog test**

Append to the first `describe` of `platform-admin-component.spec.ts` (the one named `'PlatformAdminComponent modules'`), before its closing `});`:

```ts
  it('marks a module that is not released and does not let it be switched on', () => {
    api.getCompanyModules = () => of({ success: true, message: '', data: [serviceModule, { ...salesModule, isReleased: false }] });
    const fixture = create(true);
    openDialog(fixture);

    const rows = fixture.nativeElement.querySelectorAll('.pa-module-row');
    expect(rows[0].querySelector('.soon-badge')).toBeNull();
    expect(rows[1].querySelector('.soon-badge')?.textContent?.trim()).toBe('Coming soon');
    expect((rows[1].querySelector('input') as HTMLInputElement).disabled).toBe(true);
  });

  it('still lets a module that is not released be switched off when it is on', () => {
    api.getCompanyModules = () => of({ success: true, message: '', data: [{ ...serviceModule, isReleased: false }] });
    const fixture = create(true);
    openDialog(fixture);

    const row = fixture.nativeElement.querySelector('.pa-module-row');
    expect((row.querySelector('input') as HTMLInputElement).disabled).toBe(false);
  });
```

- [ ] **Step 8: Run the tests to verify they pass**

Run (from `encryptzUI`): `.\node_modules\.bin\ng.cmd test --watch=false --include "src/app/Encryptz/components/platform-admin-component/**/*.spec.ts" --include "src/app/Encryptz/components/sidebar-component/**/*.spec.ts"`
Expected: PASS, all tests of the three spec files (the earlier ones included).

- [ ] **Step 9: Commit**

```bash
git add encryptzUI/src/styles.scss encryptzUI/src/app/Encryptz/Services/platform-service.ts encryptzUI/src/app/Encryptz/Services/platform-nav-service.ts encryptzUI/src/app/Encryptz/components/platform-admin-component
git commit -m "Platform Admin: Applications section with family, type and a Coming soon badge"
```

---

### Task 7: UI — personal applications on the company page and the badge on module cards

**Files:**
- Modify: `encryptzUI/src/app/Encryptz/Models/ApiModels.ts` (around line 110)
- Modify: `encryptzUI/src/app/Encryptz/Auth/scope-flow.ts` (`moduleCaption`)
- Modify: `encryptzUI/src/app/Encryptz/Auth/auth-service.ts` (after `getModules`)
- Modify: `encryptzUI/src/app/Encryptz/components/company-selector-component/company-selector-component.ts`, `.html`, `.scss`
- Test: `encryptzUI/src/app/Encryptz/components/company-selector-component/company-selector-component.spec.ts`

**Interfaces:**
- Consumes: `GET api/auth/personal-apps` (Task 4); state `ComingSoon` (Task 2); `.soon-badge` (Task 6).
- Produces: `ModuleState` value `'ComingSoon'`; `PersonalApp` (interface in `ApiModels.ts`); `AuthService.getPersonalApps(): Observable<ApiResponse<PersonalApp[]>>`.

- [ ] **Step 1: Write the failing tests**

In `company-selector-component.spec.ts`, add to the `auth` object of the first `beforeEach` (after `getModules`):

```ts
      getPersonalApps: () => of({ success: true, message: '', data: [] }),
```

Append to the first `describe`, before its closing `});`:

```ts
  describe('personal applications', () => {
    const jobs = { moduleId: 8, moduleKey: 'JOBPORTAL', moduleName: 'Job Portal', description: 'Your profile', icon: 'badge', family: '', routePath: '/apps/jobs', sortOrder: 1, isReleased: true };
    const expense = { moduleId: 9, moduleKey: 'EXPENSE', moduleName: 'Expense Manager', description: 'Your money', icon: 'savings', family: '', routePath: '', sortOrder: 2, isReleased: false };

    const cards = (fixture: any) => Array.from(fixture.nativeElement.querySelectorAll('.personal-app-item')) as HTMLElement[];

    it('lists them under the companies', () => {
      auth.getPersonalApps = () => of({ success: true, message: '', data: [jobs, expense] });
      const fixture = create('company');

      expect(cards(fixture).length).toBe(2);
      expect(fixture.nativeElement.textContent).toContain('Personal applications');
      expect(cards(fixture)[0].textContent).toContain('Job Portal');
    });

    it('lists them also for a user without a company', () => {
      auth.companies = () => [];
      auth.getPersonalApps = () => of({ success: true, message: '', data: [jobs] });
      const fixture = create('company');

      expect(cards(fixture).length).toBe(1);
    });

    it('highlights an application that is not released and disables its card', () => {
      auth.getPersonalApps = () => of({ success: true, message: '', data: [jobs, expense] });
      const fixture = create('company');

      expect(cards(fixture)[0].classList.contains('disabled')).toBe(false);
      expect(cards(fixture)[0].querySelector('.soon-badge')).toBeNull();
      expect(cards(fixture)[1].classList.contains('disabled')).toBe(true);
      expect(cards(fixture)[1].querySelector('.soon-badge')?.textContent?.trim()).toBe('Coming soon');
    });

    it('opens a released application at its route and nothing else', () => {
      auth.getPersonalApps = () => of({ success: true, message: '', data: [jobs, expense] });
      const fixture = create('company');
      const opened: string[] = [];
      TestBed.inject(Router).navigateByUrl = ((url: string) => { opened.push(url); return Promise.resolve(true); }) as any;

      fixture.componentInstance.openPersonalApp(expense as any);
      expect(opened).toEqual([]);

      fixture.componentInstance.openPersonalApp(jobs as any);
      expect(opened).toEqual(['/apps/jobs']);
    });

    it('does not open a released application that has no route, or a route to another site', () => {
      const fixture = create('company');
      const opened: string[] = [];
      TestBed.inject(Router).navigateByUrl = ((url: string) => { opened.push(url); return Promise.resolve(true); }) as any;

      fixture.componentInstance.openPersonalApp({ ...jobs, routePath: '' } as any);
      fixture.componentInstance.openPersonalApp({ ...jobs, routePath: 'https://example.com' } as any);
      fixture.componentInstance.openPersonalApp({ ...jobs, routePath: '//example.com' } as any);

      expect(opened).toEqual([]);
    });

    it('shows no block when there are none', () => {
      const fixture = create('company');

      expect(cards(fixture).length).toBe(0);
      expect(fixture.nativeElement.textContent).not.toContain('Personal applications');
    });

    it('keeps the company list working when the call fails', () => {
      auth.getPersonalApps = () => throwError(() => ({ status: 500 }));
      const fixture = create('company');

      expect(fixture.nativeElement.querySelectorAll('.company-item:not(.personal-app-item)').length).toBe(1);
      expect(cards(fixture).length).toBe(0);
      expect(fixture.componentInstance.error()).toBe('');
    });

    it('keeps the company list working when the answer is a refusal', () => {
      auth.getPersonalApps = () => of({ success: false, message: 'no', data: null });
      const fixture = create('company');

      expect(cards(fixture).length).toBe(0);
      expect(fixture.componentInstance.error()).toBe('');
    });

    it('does not ask for them on the module and branch steps', () => {
      let asked = 0;
      auth.getPersonalApps = () => { asked++; return of({ success: true, message: '', data: [jobs] }); };

      create('module');
      create('branch', 'SERVICE');

      expect(asked).toBe(0);
    });
  });

  it('shows a module that is not released with the Coming soon badge and does not open it', () => {
    auth.getModules = () => of({ success: true, message: '', data: [
      modules[0],
      { moduleId: 5, moduleKey: 'PAYROLL', moduleName: 'Payroll', description: 'd', icon: 'payments', sortOrder: 5, state: 'ComingSoon' },
    ] });
    const fixture = create('module');
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.module-item')) as HTMLElement[];

    expect(cards[0].querySelector('.soon-badge')).toBeNull();
    expect(cards[1].classList.contains('disabled')).toBe(true);
    expect(cards[1].querySelector('.soon-badge')?.textContent?.trim()).toBe('Coming soon');

    fixture.componentInstance.openModule({ moduleKey: 'PAYROLL', state: 'ComingSoon' } as any);
    expect(navigated.length).toBe(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `encryptzUI`): `.\node_modules\.bin\ng.cmd test --watch=false --include "src/app/Encryptz/components/company-selector-component/**/*.spec.ts"`
Expected: FAIL to compile: `Property 'openPersonalApp' does not exist on type 'CompanySelectorComponent'`.

- [ ] **Step 3: Types, caption and the call**

In `encryptzUI/src/app/Encryptz/Models/ApiModels.ts`, replace the `ModuleState` line, add `family` to `ModuleDto` and add `PersonalApp` after `ModuleDto`:

```ts
export type ModuleState = 'Available' | 'NotSubscribed' | 'NoAccess' | 'ComingSoon';
```

```ts
  state: ModuleState;
  /** Category of the application ('' when none). Missing on an API without the field. */
  family?: string;
}

/** A personal application: free, open to every user, without a company. */
export interface PersonalApp {
  moduleId: number;
  moduleKey: string;
  moduleName: string;
  description: string;
  icon: string;
  family: string;
  /** Where it opens ('' while it is not built). */
  routePath: string;
  sortOrder: number;
  /** false = "Coming soon". */
  isReleased: boolean;
}
```

In `encryptzUI/src/app/Encryptz/Auth/scope-flow.ts`, replace `moduleCaption`:

```ts
/**
 * Why a module card is disabled ('' when it can be opened, and for a module that is not
 * released: that one carries the "Coming soon" badge instead of a caption).
 */
export function moduleCaption(state: ModuleState): string {
  switch (state) {
    case 'NotSubscribed': return 'Not subscribed';
    case 'NoAccess': return 'Ask your administrator';
    default: return '';
  }
}
```

In `encryptzUI/src/app/Encryptz/Auth/auth-service.ts`, add `PersonalApp` to the import from `'../Models/ApiModels'` and add directly after the method `getModules()`:

```ts
/** Personal applications: the same for everybody, no company needed. */
getPersonalApps(): Observable<ApiResponse<PersonalApp[]>> {
  return this.http.get<ApiResponse<PersonalApp[]>>(`${this.apiUrl}/personal-apps`);
}
```

- [ ] **Step 4: Component**

In `company-selector-component.ts`:

Change the import: `import { LocationDto, ModuleDto, PersonalApp } from '../../Models/ApiModels';`

Add after `modules = signal<ModuleDto[]>([]);`:

```ts
  /** Empty also when the list could not be read: it never blocks the companies. */
  personalApps = signal<PersonalApp[]>([]);
```

In `loadCompanies()`, add as its last line:

```ts
    this.loadPersonalApps();
```

Add directly above the comment line `// ── STEP 2: MODULE ────────────────────────────────────────────────`:

```ts
  // ── PERSONAL APPLICATIONS (company step only) ─────────────────────

  private loadPersonalApps(): void {
    this.auth.getPersonalApps().pipe(timeout(20000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => { if (!this.gone) this.personalApps.set(res.success ? res.data ?? [] : []); },
      error: () => { if (!this.gone) this.personalApps.set([]); },
    });
  }

  /** Released, with a path inside this application to open. */
  canOpenPersonalApp(app: PersonalApp): boolean {
    return app.isReleased && /^\/(?!\/)[A-Za-z0-9\-_\/]*$/.test(app.routePath || '');
  }

  openPersonalApp(app: PersonalApp): void {
    if (!this.canOpenPersonalApp(app)) return;
    this.router.navigateByUrl(app.routePath);
  }

```

- [ ] **Step 5: Template and styles**

In `company-selector-component.html`:

Add directly above the comment `<!-- STEP 1b: CREATE A COMPANY -->`:

```html
        <!-- PERSONAL APPLICATIONS: free, open to every user, no company needed -->
        @if (!loading() && stage() === 'company' && !showCreate() && personalApps().length > 0) {
          <div class="personal-apps">
            <h2 class="personal-apps-title">Personal applications</h2>
            <div class="company-list">
              @for (app of personalApps(); track app.moduleKey) {
                <div class="company-item personal-app-item" [class.disabled]="!canOpenPersonalApp(app)"
                     [attr.aria-disabled]="!canOpenPersonalApp(app)" (click)="openPersonalApp(app)"
                     role="button" [attr.tabindex]="canOpenPersonalApp(app) ? 0 : -1"
                     (keydown.enter)="openPersonalApp(app)" (keydown.space)="openPersonalApp(app); $event.preventDefault()">
                  <div class="company-avatar">
                    <span class="material-icons">{{ app.icon || 'apps' }}</span>
                  </div>
                  <div class="company-info">
                    <h3>{{ app.moduleName }}</h3>
                    <p class="company-code">{{ app.description }}</p>
                    @if (!app.isReleased) { <span class="soon-badge">Coming soon</span> }
                  </div>
                  @if (canOpenPersonalApp(app)) {
                    <span class="material-icons arrow">chevron_right</span>
                  } @else {
                    <span class="material-icons arrow">schedule</span>
                  }
                </div>
              }
            </div>
          </div>
        }

```

In the module step, replace the `@if (caption(module)) { … }` block with:

```html
                  @if (module.state === 'ComingSoon') {
                    <span class="soon-badge">Coming soon</span>
                  } @else if (caption(module)) {
                    <span class="status-badge">{{ caption(module) }}</span>
                  }
```

and replace the arrow block of the module card with:

```html
                @if (module.state === 'Available') {
                  <span class="material-icons arrow">chevron_right</span>
                } @else if (module.state === 'ComingSoon') {
                  <span class="material-icons arrow">schedule</span>
                } @else {
                  <span class="material-icons arrow">lock</span>
                }
```

Append to `company-selector-component.scss`:

```scss
/* Personal applications, under the companies */
.personal-apps { margin-top: 18px; }

.personal-apps-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(207, 224, 245, 0.75);
}
```

- [ ] **Step 6: Run the tests; give every other mock the new call**

Run (from `encryptzUI`): `.\node_modules\.bin\ng.cmd test --watch=false --include "src/app/Encryptz/components/company-selector-component/**/*.spec.ts" --include "src/app/Encryptz/Auth/**/*.spec.ts"`

Any test that fails with `getPersonalApps is not a function` builds its own `auth` mock for the company step: add `getPersonalApps: () => of({ success: true, message: '', data: [] }),` to that mock (the `describe` blocks further down in `company-selector-component.spec.ts` that assign `auth = { … }` themselves). Run again.

Expected: PASS, every test of both globs.

- [ ] **Step 7: Commit**

```bash
git add encryptzUI/src/app/Encryptz/Models/ApiModels.ts encryptzUI/src/app/Encryptz/Auth/scope-flow.ts encryptzUI/src/app/Encryptz/Auth/auth-service.ts encryptzUI/src/app/Encryptz/components/company-selector-component
git commit -m "Company page: personal applications; Coming soon badge on module cards"
```

---

### Task 8: Verification

**Files:** none changed, except fixes for what this task finds.

- [ ] **Step 1: All API tests**

Run: `dotnet test EncryptzTests --nologo`
Expected: PASS, 0 failed. A failure in a test this plan did not touch means a contract changed: read it and fix the code, not the test.

- [ ] **Step 2: All UI tests of the touched areas, and a production build**

Run (from `encryptzUI`):
`.\node_modules\.bin\ng.cmd test --watch=false --include "src/app/Encryptz/components/platform-admin-component/**/*.spec.ts" --include "src/app/Encryptz/components/company-selector-component/**/*.spec.ts" --include "src/app/Encryptz/components/sidebar-component/**/*.spec.ts" --include "src/app/Encryptz/Auth/**/*.spec.ts"`
Expected: PASS.

Run: `.\node_modules\.bin\ng.cmd build`
Expected: the build completes without errors (template type errors show up here, not in `tsc`).

- [ ] **Step 3: Check the plan's promises against the code**

Confirm each by reading the code, and tick it:
- [ ] `sp_User_GetModules` in script 21 filters `AppType = 'Commercial'`, so a personal application never appears on a company's module page.
- [ ] `AuthService.GetModules` and `ResolveModuleScope` use `ModuleAccess.IsReleasedOf`, so a main database without script 21 still lists Service as `Available`.
- [ ] `GetApplications` and `SaveApplication` return "not allowed" for an actor who is not a platform administrator, before any database call.
- [ ] The Applications tab button is inside `@if (isPlatformAdmin())`, and `setTab('applications')` returns early for anyone else.
- [ ] `git status` shows no change to `EncryptzAPI/appsettings.json` from this plan and no change to scripts `13` to `20`.

- [ ] **Step 4: Hand the manual check to the owner**

These need a database and a browser; they are the owner's to run. Report them as NOT done by you.

1. On a restored COPY of the main database (never the live one): run `21_Applications.sql` twice. The second run must end with the same message and add no row.
2. `SELECT ModuleKey, AppType, IsReleased, Family FROM dbo.Modules ORDER BY AppType, SortOrder;` shows `SERVICE` Commercial / 1 and the eight new rows with `IsReleased = 0`.
3. Log in as platform administrator: Platform Admin, Applications lists nine applications; eight carry the amber "Coming soon" badge.
4. Edit Payroll: set family "HR", save. The row shows "HR"; the family is suggested when another application is edited.
5. Companies, Modules of a company: Service can be switched; the six other commercial applications show "Coming soon" with a disabled switch; no personal application is listed.
6. Log in as a normal user: the company page shows "Personal applications" with Job Portal and Expense Manager, both "Coming soon" and not clickable. Entering a company and the Service application works as before.
7. Create an empty database, run `PersonalDB/01_Schema.sql` in it, then run it once in the main database copy: it must refuse there with "This is the SaaS main database".

- [ ] **Step 5: Commit any fix made in this task**

```bash
git add -A
git commit -m "Applications foundation: fixes from verification"
```

Skip this step when nothing changed.
