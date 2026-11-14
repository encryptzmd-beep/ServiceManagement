# Staff Scope Flow (Companies → Modules → Branches) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After login a staff user sees their companies, then every module (disabled when they cannot open it), then their branches, and only then enters the application; and the two defects left open by Plan 1 are closed.

**Architecture:** The Angular UI moves from the project/location picker to three routed steps that share the existing company-selector card. One pure function decides which step a session is at; a route guard and every redirect use it. The API already offers `auth/modules`, `auth/locations?moduleKey=` and `auth/set-scope {moduleKey}` (Plan 1); this plan only adds the database status to the company list. The old endpoints stay in the API until Plan 2b.

**Tech Stack:** Angular 21 (standalone components, signals, Vitest through `ng test`), ASP.NET Core (.NET 10), xUnit, SQL Server scripts.

**Spec:** `docs/superpowers/specs/2026-10-11-saas-tenancy-design.md` (section 8, items 1-5; decisions D10, D12)

**Plan series:**

1. Company-level routing and modules, backend — done (`2026-10-11-company-routing-and-modules-backend.md`)
2. Staff scope flow UI + Plan 1 residual fixes (this plan)
2b. Platform Admin UI (company database, module switches), module/branch choice in user management and invitations, customer portal without project picker, removal of the "project" compatibility layer
3. Self-service company creation and database provisioning
4. Branch access

## Global Constraints

- The SQL Server in `EncryptzAPI/appsettings.json` is LIVE. Only `MainDBEncryptz` and `HamsterserviceDB` may be touched, and only with read-only `SELECT`. Never run a script from this plan or any repo script against it. Never run `dotnet run` against it. Do not open or print `appsettings.json`.
- Every SQL change is a file in the repo whose name starts with a number, each with its own number. In `EncryptzAPI/Database/MainDB/` numbers `01`-`17` are used and FROZEN: never edit them. This plan adds `18`. The next free number after this plan is `19`.
- An SQL file is frozen once the task that creates it is complete (its review has passed). While its own task is open it may be edited.
- New SQL scripts contain no `USE`, `CREATE DATABASE`, `DROP DATABASE` or `DROP TABLE`. They refuse to run in a system database or without `dbo.Companies`. They are re-runnable.
- Company screen and module screen are always shown; the branch screen is skipped when the user has exactly one branch (spec D10).
- Every module of the catalogue is listed for everyone; a module the user cannot open is shown disabled with the reason "Not subscribed" (state `NotSubscribed`) or "Ask your administrator" (state `NoAccess`) (spec 7.1). The disabled button is presentation only: the server decides.
- In the UI the word is "Branch", not "Location", and the word "Project" does not appear on the screens this plan touches.
- A session that was scoped by the previous UI (it has a project key and a location, no module key) must keep working after the new UI is deployed, without logging in again.
- A user of a company whose database is not ready must still be able to reach the pages that need only a company: Platform Admin, user/role administration and the profile.
- Messages shown to users never contain server names, database names or SQL / exception text.
- Do not change anything under `encryptzUI/src/app/Encryptz/components/platform-admin-component/` except the one line named in Task 8, nor the customer portal components: they belong to Plan 2b.
- Match the surrounding code style. Do not reformat files you touch.
- Run API/test commands from the repository root `D:\Encryptz\ServiceManagement`; run UI commands from `D:\Encryptz\ServiceManagement\encryptzUI`.

## Review Focus

1. A user whose browser still holds a session from the previous UI (project key + location, no module key) opens the app after the release: they must land in the app, not be bounced to the module screen. Pinned in Task 4 (`legacyModuleKey`) and Task 5.
2. A user with exactly one branch must not see the branch screen; a user with none must see "No branch assigned" and not an endless spinner. Pinned in Task 4 (`branchDecision`) and Task 7.
3. A company admin of a company whose database is not ready must be able to open Platform Admin; a technician of that company must not get into business pages. Pinned in Task 4 (`nextScopeStep` with need `company`) and Task 6.
4. Typing a business URL (for example `/complaints/dashboard`) with only a company selected must lead to the module screen, not to a page full of 403 errors. Pinned in Task 6.
5. The rollback connection copy must not run twice for the same cut-over. No unit test can reach this (it lives in SQL); pinned in the Task 9 verification list.

## File Structure

| File | Responsibility |
|---|---|
| `EncryptzBL/Infrastructure/User/Modules/PlatformService.cs` | Attach guard decides from "is listed as having a database" |
| `EncryptzAPI/Database/MainDB/18_Company_Tenancy_Rollback_Connections_Once.sql` (new) | Run-once replacement of script 17 |
| `EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md` | Release notes corrections |
| `EncryptzBL/DTO's/FlixDtos.cs`, `AuthService.cs` | `ProvisionStatus` in the company list |
| `encryptzUI/src/app/Encryptz/Auth/scope-flow.ts` (new) | Pure decisions: which step, which route, captions |
| `encryptzUI/src/app/Encryptz/Auth/scope-flow.spec.ts` (new) | Tests of those decisions |
| `encryptzUI/src/app/Encryptz/Auth/auth-service.ts` | Module/branch state and API calls |
| `encryptzUI/src/app/Encryptz/Auth/guard-guard.ts` | `scopeGuard` |
| `encryptzUI/src/app/Encryptz/Auth/scope-guard.spec.ts` (new) | Guard tests |
| `encryptzUI/src/app/app.routes.ts` | Three step routes, guard, company-only pages |
| `encryptzUI/src/app/Encryptz/components/company-selector-component/*` | The three steps |
| `encryptzUI/src/app/Encryptz/components/header-component/*` | Branch name and switch links |
| `encryptzUI/src/app/Encryptz/components/login-component/login-component.ts` | Always go to the company list |
| `encryptzUI/src/app/Encryptz/components/project-location-switcher-component/` | Deleted |
| `encryptzUI/src/app/Encryptz/Guard/company-guard.ts`, `.spec.ts`, `customer-guard.spec.ts` | Deleted (unused / does not compile) |

---

### Task 1: Attach guard must not lock out a company without a working database

**Files:**
- Modify: `EncryptzBL/Infrastructure/User/Modules/PlatformService.cs` (`SaveProject`, `ProjectRefusal`)
- Modify: `EncryptzTests/PlatformProjectRefusalTests.cs`

**Interfaces:**
- Consumes: `sp_Platform_GetProjects(@CompanyId)` (script 14): returns a row for the company only when its `ProvisionStatus <> 'None'`; existing private `GetCompanyKey(int companyId) : Task<string?>` in `PlatformService`.
- Produces: `PlatformService.ProjectRefusal(int requestedProjectId, int companyId, bool hasDatabase, string? existingKey, string? requestedKey) : string?`.

Background: after the cut-over every migrated company has a tenant key, but a company whose connection row was inactive or held a placeholder password has `ProvisionStatus = 'None'` and is not listed in Platform Admin. The guard added in Plan 1 treats "has a key" as "has a database", so "+ New Project" for such a company is refused and there is no entry to edit.

- [ ] **Step 1: Change the tests to the new signature and add the lockout case**

Replace the whole of `EncryptzTests/PlatformProjectRefusalTests.cs` with:

```csharp
using EncryptzBL.Infrastructure.User.Modules;
using Xunit;

namespace EncryptzTests
{
    public class PlatformProjectRefusalTests
    {
        [Fact]
        public void A_new_project_for_a_company_without_a_database_is_allowed()
        {
            Assert.Null(PlatformService.ProjectRefusal(0, 7, false, null, "C007-P001"));
            Assert.Null(PlatformService.ProjectRefusal(0, 7, false, "  ", "C007-P001"));
        }

        [Fact]
        public void A_company_with_a_key_but_no_listed_database_can_still_be_attached()
        {
            // migrated company whose connection never worked: it has a key, it is not listed
            Assert.Null(PlatformService.ProjectRefusal(0, 7, false, "C007-P001", "C007-P001"));
            Assert.Null(PlatformService.ProjectRefusal(0, 7, false, "C007-P001", ""));
        }

        [Fact]
        public void A_new_project_for_a_company_that_has_a_database_is_refused()
        {
            Assert.Equal("This company already has a database. Edit it instead",
                PlatformService.ProjectRefusal(0, 7, true, "C007-P001", ""));
        }

        [Theory]
        [InlineData(3)]
        [InlineData(-1)]
        public void A_project_id_other_than_the_company_id_is_refused(int projectId)
        {
            Assert.Equal("Database not found for this company",
                PlatformService.ProjectRefusal(projectId, 7, true, "C007-P001", "C007-P001"));
            Assert.Equal("Database not found for this company",
                PlatformService.ProjectRefusal(projectId, 7, false, null, "X"));
        }

        [Fact]
        public void Editing_the_company_database_with_the_same_key_is_allowed()
        {
            Assert.Null(PlatformService.ProjectRefusal(7, 7, true, "C007-P001", "C007-P001"));
            Assert.Null(PlatformService.ProjectRefusal(7, 7, true, "C007-P001", ""));
            Assert.Null(PlatformService.ProjectRefusal(7, 7, true, "C007-P001", null));
            Assert.Null(PlatformService.ProjectRefusal(7, 7, true, "C007-P001", "  c007-p001 "));
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public void A_key_that_is_already_set_cannot_be_changed(bool hasDatabase)
        {
            // the key is in tokens and customer links: it stays, listed or not
            var projectId = hasDatabase ? 7 : 0;
            Assert.Equal("The key of a company cannot be changed",
                PlatformService.ProjectRefusal(projectId, 7, hasDatabase, "C007-P001", "C007-P002"));
        }

        [Fact]
        public void A_foreign_project_id_is_refused_before_anything_else()
        {
            Assert.Equal("Database not found for this company",
                PlatformService.ProjectRefusal(3, 7, true, "C007-P001", "OTHER"));
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj --filter PlatformProjectRefusalTests`
Expected: build error CS1501 (no overload of `ProjectRefusal` takes 5 arguments).

- [ ] **Step 3: Implement**

In `PlatformService.cs` replace the `ProjectRefusal` method with:

```csharp
        /// <summary>
        /// Why a "save project" request must be refused, or null when it may proceed.
        /// A "project" is the company's database and its id is the company id.
        /// hasDatabase = the company is listed as having a database (sp_Platform_GetProjects);
        /// a migrated company can have a key without one.
        /// </summary>
        public static string? ProjectRefusal(int requestedProjectId, int companyId, bool hasDatabase, string? existingKey, string? requestedKey)
        {
            if (requestedProjectId != 0 && requestedProjectId != companyId)
                return "Database not found for this company";

            if (requestedProjectId == 0 && hasDatabase)
                return "This company already has a database. Edit it instead";

            if (!string.IsNullOrWhiteSpace(existingKey) && !string.IsNullOrWhiteSpace(requestedKey)
                && !string.Equals(requestedKey.Trim(), existingKey.Trim(), StringComparison.OrdinalIgnoreCase))
                return "The key of a company cannot be changed";

            return null;
        }
```

In `SaveProject`, replace the two lines that compute and test `refusal` with:

```csharp
            // listed = the company already has a database (a migrated company may have a key without one)
            var listed = await GetDataTableAsync("sp_Platform_GetProjects", new[]
            {
                SqlParameterHelper.Input("@CompanyId", req.CompanyId)
            });
            var hasDatabase = req.CompanyId > 0 && listed != null && listed.Rows.Count > 0;

            var refusal = ProjectRefusal(req.ProjectId, req.CompanyId, hasDatabase, await GetCompanyKey(req.CompanyId), req.ProjectKey);
            if (refusal != null)
                return ApiResponse<int>.Fail(refusal);
```

(`sp_Platform_GetProjects` treats `@CompanyId = 0` as "all companies", hence the `req.CompanyId > 0` test.)

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj`
Expected: `Passed!`, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add EncryptzBL/Infrastructure/User/Modules/PlatformService.cs EncryptzTests/PlatformProjectRefusalTests.cs
git commit -m "Let a company with a key but no database be attached"
```

---

### Task 2: Run-once rollback connection copy (script 18) and release-notes corrections

**Files:**
- Create: `EncryptzAPI/Database/MainDB/18_Company_Tenancy_Rollback_Connections_Once.sql`
- Modify: `EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md`
- Read only: `EncryptzAPI/Database/MainDB/17_Company_Tenancy_Rollback_Connections.sql`, `15_Company_Tenancy_Rollback.sql`, `14_Company_Tenancy_Cutover.sql`

**Interfaces:**
- Produces: table `dbo.TenancyRollbackLog(CutoverStamp DATETIME PK, CopiedAt DATETIME, UpdatedRows INT, InsertedRows INT)` in the main database.

Background: script 17 copies each company's connection from `dbo.Companies` back to `dbo.ProjectConnections` after a rollback. It has no memory: if the previous API has been running since the rollback and someone runs 17 again, it overwrites newer connection rows with stale company values. Script 17 is frozen, so it is superseded by a new script that copies once per cut-over. The cut-over's identity is the `modify_date` of `dbo.sp_Tenant_GetConnection`: script 14 re-creates that procedure on every run and script 15 does not touch it.

- [ ] **Step 1: Write script 18**

Create `EncryptzAPI/Database/MainDB/18_Company_Tenancy_Rollback_Connections_Once.sql`:

```sql
/* =============================================================================
   MainDB · Company-level tenancy · ROLLBACK, part 2: connections (run once)
   -----------------------------------------------------------------------------
   REPLACES 17_Company_Tenancy_Rollback_Connections.sql. Do not run script 17.

   Run right AFTER 15_Company_Tenancy_Rollback.sql has printed
   "Project tables restored." and BEFORE the previous API is started.

   After the cut-over a tenant's connection (server, database, user, password,
   extra options, ready or not) lives only on its dbo.Companies row. Script 15
   restores the project tables but does not copy connection changes made since
   the cut-over back to dbo.ProjectConnections. This script copies them back:

     - for every ACTIVE project whose company was migrated (Companies.TenantKey
       equals Projects.ProjectKey) and whose company row has a server, a database
       and a user:
         * the project's ProjectConnections row is updated when something differs
           (the password is kept when the company has none; IsActive is 1 only for
           a company whose database is Ready);
         * a row is added when the project has none and the company has a password.

   IT COPIES ONCE PER CUT-OVER. Once the previous API is running again,
   dbo.ProjectConnections is the live data and the company rows are stale. The
   script records the cut-over it copied for in dbo.TenancyRollbackLog and
   refuses to copy for the same cut-over again. (A cut-over is identified by the
   date script 14 last created dbo.sp_Tenant_GetConnection.)

   It first lists the rows it will change (never the passwords), then changes
   them in ONE transaction. On an error everything is rolled back and the
   message is shown. It changes nothing in any tenant database.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose. Running it again changes nothing: it stops with a message.
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

/* OBJECT_ID and COL_LENGTH are functions: this batch compiles whatever exists. */
IF OBJECT_ID('dbo.Companies') IS NOT NULL
   AND (   OBJECT_ID('dbo.Projects') IS NULL
        OR OBJECT_ID('dbo.ProjectConnections') IS NULL)
BEGIN
    RAISERROR('The project tables are not there. Run 15_Company_Tenancy_Rollback.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Companies') IS NOT NULL
   AND (   COL_LENGTH('dbo.Companies', 'TenantKey') IS NULL
        OR OBJECT_ID('dbo.sp_Tenant_GetConnection') IS NULL)
BEGIN
    RAISERROR('The cut-over (scripts 13 and 14) was never run on this database: there is nothing to copy back.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   The record of what was copied back, one row per cut-over
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.TenancyRollbackLog') IS NULL
CREATE TABLE dbo.TenancyRollbackLog
(
    CutoverStamp DATETIME NOT NULL CONSTRAINT PK_TenancyRollbackLog PRIMARY KEY,
    CopiedAt     DATETIME NOT NULL CONSTRAINT DF_TRL_CopiedAt DEFAULT (GETDATE()),
    UpdatedRows  INT      NOT NULL,
    InsertedRows INT      NOT NULL
);
GO

/* Already copied for this cut-over: stop. ProjectConnections is the live data now. */
DECLARE @Done DATETIME, @DoneText VARCHAR(30);

SELECT @Done = l.CopiedAt
FROM dbo.TenancyRollbackLog l
WHERE l.CutoverStamp = (SELECT o.modify_date FROM sys.objects o
                        WHERE o.object_id = OBJECT_ID('dbo.sp_Tenant_GetConnection'));

IF @Done IS NOT NULL
BEGIN
    SET @DoneText = CONVERT(VARCHAR(30), @Done, 120);
    RAISERROR('The connections were already copied back for this cut-over on %s. Nothing was changed. The project tables are the live data now.', 16, 1, @DoneText);
    SET NOEXEC ON;
END
GO

/* The statements that name Projects, ProjectConnections or the columns added by
   script 13 are dynamic SQL on purpose: this batch is compiled even when a guard
   above stopped execution, and a column that does not exist would be a compile
   error that hides the guard message. Inside the text a tilde stands for a
   single quote. */
DECLARE @Cte NVARCHAR(MAX), @Report NVARCHAR(MAX), @UpdateSql NVARCHAR(MAX), @InsertSql NVARCHAR(MAX),
        @Updated INT = 0, @Inserted INT = 0, @CopyError NVARCHAR(2048), @Stamp DATETIME;

SELECT @Stamp = o.modify_date
FROM sys.objects o
WHERE o.object_id = OBJECT_ID('dbo.sp_Tenant_GetConnection');

SET @Cte = N'
WITH Cand AS (
    SELECT c.CompanyId, c.CompanyName, p.ProjectId, p.ProjectKey,
           pc.ProjectConnectionId,
           pc.ServerName AS OldServer, pc.DatabaseName AS OldDatabase, pc.DbUser AS OldUser,
           pc.DbPasswordEnc AS OldPassword, pc.ExtraOptions AS OldExtra, pc.IsActive AS OldIsActive,
           c.ServerName AS NewServer, c.DatabaseName AS NewDatabase, c.DbUser AS NewUser,
           c.DbPasswordEnc AS CompanyPassword,
           /* keep the stored password when the company has none (or only the placeholder) */
           CASE WHEN ISNULL(c.DbPasswordEnc, ~~) IN (~~, ~<ENCRYPTED_PW>~) THEN pc.DbPasswordEnc
                ELSE c.DbPasswordEnc END AS NewPassword,
           c.ExtraOptions AS NewExtra,
           /* the database status only: whether the COMPANY is active is not a connection property */
           CAST(CASE WHEN c.ProvisionStatus = ~Ready~ THEN 1 ELSE 0 END AS BIT) AS NewIsActive
    FROM dbo.Projects p
    INNER JOIN dbo.Companies c ON c.CompanyId = p.CompanyId AND c.TenantKey = p.ProjectKey
    LEFT  JOIN dbo.ProjectConnections pc ON pc.ProjectId = p.ProjectId
    WHERE p.IsActive = 1
      AND ISNULL(LTRIM(RTRIM(c.ServerName)), ~~)   <> ~~
      AND ISNULL(LTRIM(RTRIM(c.DatabaseName)), ~~) <> ~~
      AND ISNULL(LTRIM(RTRIM(c.DbUser)), ~~)       <> ~~
),
Chg AS (
    SELECT k.*, CASE WHEN k.ProjectConnectionId IS NULL THEN ~Insert~ ELSE ~Update~ END AS Action
    FROM Cand k
    WHERE (    k.ProjectConnectionId IS NULL
           AND ISNULL(k.CompanyPassword, ~~) NOT IN (~~, ~<ENCRYPTED_PW>~)
           AND NOT EXISTS (SELECT 1 FROM dbo.ProjectConnections x WHERE x.ProjectKey = k.ProjectKey))
       OR (    k.ProjectConnectionId IS NOT NULL
           AND (   k.OldServer   <> k.NewServer
                OR k.OldDatabase <> k.NewDatabase
                OR k.OldUser     <> k.NewUser
                OR k.OldPassword <> k.NewPassword
                OR ISNULL(k.OldExtra, ~~) <> ISNULL(k.NewExtra, ~~)
                OR k.OldIsActive <> k.NewIsActive))
)
';

SET @Report = REPLACE(@Cte + N'
SELECT k.Action, k.CompanyId, k.CompanyName, k.ProjectKey,
       k.OldDatabase AS OldDatabaseName, k.NewDatabase AS NewDatabaseName,
       k.OldIsActive, k.NewIsActive,
       CASE WHEN k.Action = ~Insert~ THEN ~new row~ ELSE STUFF(  CASE WHEN k.OldServer   <> k.NewServer   THEN ~, server~   ELSE ~~ END
             + CASE WHEN k.OldDatabase <> k.NewDatabase THEN ~, database~ ELSE ~~ END
             + CASE WHEN k.OldUser     <> k.NewUser     THEN ~, user~     ELSE ~~ END
             + CASE WHEN k.OldPassword <> k.NewPassword THEN ~, password~ ELSE ~~ END
             + CASE WHEN ISNULL(k.OldExtra, ~~) <> ISNULL(k.NewExtra, ~~) THEN ~, options~ ELSE ~~ END
             + CASE WHEN k.OldIsActive <> k.NewIsActive THEN ~, active~   ELSE ~~ END, 1, 2, ~~) END AS Differs
FROM Chg k
ORDER BY k.CompanyId;', N'~', N'''');

SET @UpdateSql = REPLACE(@Cte + N'
UPDATE pc
SET pc.ServerName    = k.NewServer,
    pc.DatabaseName  = k.NewDatabase,
    pc.DbUser        = k.NewUser,
    pc.DbPasswordEnc = k.NewPassword,
    pc.ExtraOptions  = k.NewExtra,
    pc.IsActive      = k.NewIsActive,
    pc.UpdatedAt     = GETDATE()
FROM dbo.ProjectConnections pc
INNER JOIN Chg k ON k.ProjectConnectionId = pc.ProjectConnectionId AND k.Action = ~Update~;
SET @n = @@ROWCOUNT;', N'~', N'''');

SET @InsertSql = REPLACE(@Cte + N'
INSERT INTO dbo.ProjectConnections
       (ProjectId, ProjectKey, ServerName, DatabaseName, DbUser, DbPasswordEnc, ExtraOptions, IsActive, UpdatedAt)
SELECT k.ProjectId, k.ProjectKey, k.NewServer, k.NewDatabase, k.NewUser, k.NewPassword, k.NewExtra, k.NewIsActive, GETDATE()
FROM Chg k
WHERE k.Action = ~Insert~;
SET @n = @@ROWCOUNT;', N'~', N'''');

BEGIN TRY
    /* what will change (no passwords) */
    EXEC sp_executesql @Report;

    BEGIN TRANSACTION;

    EXEC sp_executesql @UpdateSql, N'@n INT OUTPUT', @n = @Updated OUTPUT;
    EXEC sp_executesql @InsertSql, N'@n INT OUTPUT', @n = @Inserted OUTPUT;

    /* remember this cut-over: a second run must not overwrite live connections */
    INSERT INTO dbo.TenancyRollbackLog (CutoverStamp, UpdatedRows, InsertedRows)
    VALUES (@Stamp, @Updated, @Inserted);

    COMMIT TRANSACTION;

    PRINT 'Connections copied back to the project tables: '
          + CAST(@Updated AS VARCHAR(10)) + ' updated, ' + CAST(@Inserted AS VARCHAR(10)) + ' added.';
    PRINT 'This script will not copy again for this cut-over.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    SET @CopyError = ERROR_MESSAGE();
    RAISERROR('Copying the connections back failed and was rolled back. %s', 16, 1, @CopyError);
    SET NOEXEC ON;
END CATCH
GO

SET NOEXEC OFF;
GO
```

- [ ] **Step 2: Check the script without running it**

Run:

```bash
grep -nEi "^\s*USE |CREATE DATABASE|DROP DATABASE|DROP TABLE" EncryptzAPI/Database/MainDB/18_Company_Tenancy_Rollback_Connections_Once.sql
grep -c "BEGIN TRY\|END TRY\|BEGIN CATCH\|END CATCH" EncryptzAPI/Database/MainDB/18_Company_Tenancy_Rollback_Connections_Once.sql
grep -n "c.IsActive" EncryptzAPI/Database/MainDB/18_Company_Tenancy_Rollback_Connections_Once.sql
git status --short EncryptzAPI/Database/MainDB/
```

Expected: first prints nothing; second prints `4`; third prints nothing (the company's own active flag is no longer folded into the connection); fourth lists only the new file `18_...sql` as untracked.

Then read the file once as a reviewer and confirm in your report: every `SET NOEXEC ON` is followed in its batch only by `END`; `@Stamp` is declared and set in the batch that uses it; the batch that reads `dbo.TenancyRollbackLog` comes after the batch that creates it; no statement outside dynamic SQL names a column of `dbo.Companies` that script 13 adds.

- [ ] **Step 3: Correct the release notes**

Edit `EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md` (read it fully first; keep its style: short sentences, numbered steps, no server names). Make exactly these changes, and verify each statement against the scripts before writing it:

1. Script list: put the scripts in the order they are used (`16` pre-check, `13` schema, `14` cut-over, then for an undo `15` and `18`). Replace the line for script 17 with two lines: `18_Company_Tenancy_Rollback_Connections_Once.sql` - "run right after script 15: copies connection changes made since the cut-over back to the project tables, once per cut-over"; and `17_Company_Tenancy_Rollback_Connections.sql` - "superseded by script 18. Do not run it."
2. "Undo" section: the step that runs script 17 now runs script 18. State: run it in the same sitting, right after script 15 printed `Project tables restored.` and before the previous API is started. Remove every sentence that says running the connection copy again is safe, and say instead: "Script 18 copies once per cut-over. Run again, it stops with a message and changes nothing. Once the previous API has been running, the project tables are the live data."
3. "Never edit these scripts": the next free number is `19`.
4. "Things to know": replace the sentence that says a member without access "sees the company but cannot enter it, and is told why" with: "A member who was not given the Service module sees the company in the list. In the module list the Service module is shown disabled with the reason." (That is the behaviour of the UI delivered with this plan.)
5. "Check after the release": where it quotes the message a member without access gets, say instead that the Service module card is disabled and shows "Ask your administrator".
6. Pre-check section 5 (modules created with `QUOTED_IDENTIFIER` or `ANSI_NULLS` off): replace any advice to re-save such an object by hand with: "Do not change it by hand. Ask for a numbered script that re-creates it with both options on, and run that before script 13."
7. Script 17/18 guard wording: wherever the notes explain the message "Run 15 first", add that the same refusal appears when scripts 13 and 14 were never run on that database, in which case there is nothing to undo.

- [ ] **Step 4: Commit**

```bash
git add EncryptzAPI/Database/MainDB/18_Company_Tenancy_Rollback_Connections_Once.sql EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md
git commit -m "Copy connections back once per cut-over (script 18 supersedes 17)"
```

---

### Task 3: Database status in the company list

**Files:**
- Modify: `EncryptzBL/DTO's/FlixDtos.cs` (`CompanyResponseDto`)
- Modify: `EncryptzBL/Infrastructure/User/Modules/AuthService.cs` (`GetUserCompanies`)
- Create: `EncryptzTests/CompanyStatusTests.cs`

**Interfaces:**
- Consumes: `sp_User_GetCompanies(@UserId)` returns a `ProvisionStatus` column (script 14).
- Produces: JSON field `provisionStatus` (`"None" | "Provisioning" | "Ready" | "Failed"`) on every company of `login-v2` and `user-companies`; `CompanyResponseDto.StatusFrom(object? value) : string`.

- [ ] **Step 1: Write the failing test**

Create `EncryptzTests/CompanyStatusTests.cs`:

```csharp
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class CompanyStatusTests
    {
        [Theory]
        [InlineData("Ready", "Ready")]
        [InlineData(" Failed ", "Failed")]
        [InlineData("Provisioning", "Provisioning")]
        public void A_status_from_the_database_is_passed_on(string value, string expected)
        {
            Assert.Equal(expected, CompanyResponseDto.StatusFrom(value));
        }

        [Fact]
        public void A_missing_status_is_None()
        {
            Assert.Equal("None", CompanyResponseDto.StatusFrom(null));
            Assert.Equal("None", CompanyResponseDto.StatusFrom(DBNull.Value));
            Assert.Equal("None", CompanyResponseDto.StatusFrom(""));
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj --filter CompanyStatusTests`
Expected: build error, `'CompanyResponseDto' does not contain a definition for 'StatusFrom'`.

- [ ] **Step 3: Implement**

In `FlixDtos.cs`, add to `CompanyResponseDto` after `IsLinked`:

```csharp
            /// <summary>State of the company's database: None | Provisioning | Ready | Failed.</summary>
            public string ProvisionStatus { get; set; } = "None";

            public static string StatusFrom(object? value)
            {
                var text = value == null || value == DBNull.Value ? "" : value.ToString()!.Trim();
                return text.Length == 0 ? "None" : text;
            }
```

In `AuthService.GetUserCompanies`, add to the object initialiser after `IsLinked = ...`:

```csharp
                ProvisionStatus = CompanyResponseDto.StatusFrom(
                    r.Table.Columns.Contains("ProvisionStatus") ? r["ProvisionStatus"] : null)
```

(add a comma after the `IsLinked` line).

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj`
Expected: `Passed!`, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add "EncryptzBL/DTO's/FlixDtos.cs" EncryptzBL/Infrastructure/User/Modules/AuthService.cs EncryptzTests/CompanyStatusTests.cs
git commit -m "Return the database status with each company"
```

---

### Task 4: UI test runner and the scope decisions

**Files:**
- Delete: `encryptzUI/src/app/Encryptz/Guard/customer-guard.spec.ts`
- Create: `encryptzUI/src/app/Encryptz/Auth/scope-flow.ts`
- Create: `encryptzUI/src/app/Encryptz/Auth/scope-flow.spec.ts`
- Modify: `encryptzUI/src/app/Encryptz/Models/ApiModels.ts`

**Interfaces:**
- Produces (from `scope-flow.ts`):
  - `type ScopeStep = 'login' | 'company' | 'module' | 'branch' | 'ready'`
  - `type ScopeNeed = 'company' | 'full'`
  - `interface ScopeState { loggedIn: boolean; companyId: number | null; moduleKey: string | null; locationId: number | null; }`
  - `nextScopeStep(state: ScopeState, need?: ScopeNeed): ScopeStep`
  - `routeForStep(step: ScopeStep): string`
  - `moduleCaption(state: ModuleState): string`
  - `legacyModuleKey(user: { projectKey?: string; locationId?: number; moduleKey?: string } | null): string | null`
  - `branchDecision(count: number): 'none' | 'auto' | 'choose'`
  - `landingRouteForRole(role: string): string`
- Produces (from `ApiModels.ts`): `type ModuleState = 'Available' | 'NotSubscribed' | 'NoAccess'`; `interface ModuleDto { moduleId: number; moduleKey: string; moduleName: string; description: string; icon: string; sortOrder: number; state: ModuleState; }`; `LoginResponse.moduleKey?: string`.

The UI test suite does not build today: `customer-guard.spec.ts` imports a `customerGuard` that does not exist (the file exports a class `CustomerAuthGuard`). It is a generated placeholder with no real test, so it is removed.

- [ ] **Step 1: Make the test suite build**

```bash
git rm encryptzUI/src/app/Encryptz/Guard/customer-guard.spec.ts
```

From `encryptzUI`, run: `npx ng test --watch=false 2>&1 | tail -40`
Expected: the build no longer stops with `TS2724`. Some generated placeholder specs may fail at run time (missing providers); write the names of the failing spec files in your report as the baseline. Do not fix them: they are not part of this plan. If the build still stops with a compile error in another `*.spec.ts` that is a generated placeholder (its only test is `should be created` / `should create`), remove that spec the same way and note it; if it is a real test, stop and report.

- [ ] **Step 2: Add the model types**

In `encryptzUI/src/app/Encryptz/Models/ApiModels.ts`, in `LoginResponse` add after `locationId?: number;`:

```ts
  moduleKey?: string;    // module the token was issued for (empty until set-scope)
```

and add after the `LocationDto` interface:

```ts
/** What a user sees for one module of the catalogue inside a company. */
export type ModuleState = 'Available' | 'NotSubscribed' | 'NoAccess';

export interface ModuleDto {
  moduleId: number;
  moduleKey: string;
  moduleName: string;
  description: string;
  icon: string;
  sortOrder: number;
  state: ModuleState;
}
```

- [ ] **Step 3: Write the failing tests**

Create `encryptzUI/src/app/Encryptz/Auth/scope-flow.spec.ts`:

```ts
import {
  branchDecision, landingRouteForRole, legacyModuleKey, moduleCaption,
  nextScopeStep, routeForStep, ScopeState,
} from './scope-flow';

const state = (over: Partial<ScopeState> = {}): ScopeState => ({
  loggedIn: true, companyId: 2, moduleKey: 'SERVICE', locationId: 9, ...over,
});

describe('nextScopeStep', () => {
  it('sends a visitor to login', () => {
    expect(nextScopeStep(state({ loggedIn: false }))).toBe('login');
    expect(nextScopeStep(state({ loggedIn: false }), 'company')).toBe('login');
  });

  it('asks for a company first', () => {
    expect(nextScopeStep(state({ companyId: null }))).toBe('company');
    expect(nextScopeStep(state({ companyId: 0 }))).toBe('company');
  });

  it('asks for a module once a company is chosen', () => {
    expect(nextScopeStep(state({ moduleKey: null, locationId: null }))).toBe('module');
    expect(nextScopeStep(state({ moduleKey: '', locationId: 9 }))).toBe('module');
  });

  it('asks for a branch once a module is chosen', () => {
    expect(nextScopeStep(state({ locationId: null }))).toBe('branch');
    expect(nextScopeStep(state({ locationId: 0 }))).toBe('branch');
  });

  it('is ready with company, module and branch', () => {
    expect(nextScopeStep(state())).toBe('ready');
  });

  it('needs only a company for a company-only page', () => {
    expect(nextScopeStep(state({ moduleKey: null, locationId: null }), 'company')).toBe('ready');
    expect(nextScopeStep(state({ companyId: null }), 'company')).toBe('company');
  });
});

describe('routeForStep', () => {
  it('maps each step to its route', () => {
    expect(routeForStep('login')).toBe('/login');
    expect(routeForStep('company')).toBe('/select-company');
    expect(routeForStep('module')).toBe('/select-module');
    expect(routeForStep('branch')).toBe('/select-branch');
  });
});

describe('moduleCaption', () => {
  it('explains why a module is disabled', () => {
    expect(moduleCaption('Available')).toBe('');
    expect(moduleCaption('NotSubscribed')).toBe('Not subscribed');
    expect(moduleCaption('NoAccess')).toBe('Ask your administrator');
  });
});

describe('legacyModuleKey', () => {
  it('treats a session scoped by the previous UI as the Service module', () => {
    expect(legacyModuleKey({ projectKey: 'C001-P001', locationId: 2 })).toBe('SERVICE');
  });

  it('keeps the module of a session scoped by this UI', () => {
    expect(legacyModuleKey({ projectKey: 'C001-P001', locationId: 2, moduleKey: 'SALES' })).toBe('SALES');
  });

  it('gives nothing for a session that was never scoped', () => {
    expect(legacyModuleKey(null)).toBeNull();
    expect(legacyModuleKey({})).toBeNull();
    expect(legacyModuleKey({ projectKey: '', locationId: 0 })).toBeNull();
    expect(legacyModuleKey({ projectKey: 'C001-P001', locationId: 0 })).toBeNull();
    expect(legacyModuleKey({ projectKey: '', locationId: 2 })).toBeNull();
  });
});

describe('branchDecision', () => {
  it('skips the screen for exactly one branch', () => {
    expect(branchDecision(1)).toBe('auto');
  });

  it('shows the list for several and a message for none', () => {
    expect(branchDecision(2)).toBe('choose');
    expect(branchDecision(7)).toBe('choose');
    expect(branchDecision(0)).toBe('none');
  });
});

describe('landingRouteForRole', () => {
  it('opens the work orders for a technician and spare parts for a storekeeper', () => {
    expect(landingRouteForRole('Technician')).toBe('/technicians/work-orders');
    expect(landingRouteForRole('Storekeeper')).toBe('/spare-parts');
  });

  it('opens the dashboard for everyone else', () => {
    expect(landingRouteForRole('Admin')).toBe('/complaints/dashboard');
    expect(landingRouteForRole('CompanyAdmin')).toBe('/complaints/dashboard');
    expect(landingRouteForRole('Manager')).toBe('/complaints/dashboard');
    expect(landingRouteForRole('')).toBe('/complaints/dashboard');
  });
});
```

- [ ] **Step 4: Run to verify it fails**

From `encryptzUI`, run: `npx ng test --watch=false --include "src/app/Encryptz/Auth/scope-flow.spec.ts" 2>&1 | tail -20`
Expected: build error, cannot find module `./scope-flow`.

- [ ] **Step 5: Implement**

Create `encryptzUI/src/app/Encryptz/Auth/scope-flow.ts`:

```ts
import { ModuleState } from '../Models/ApiModels';

/**
 * Where a staff session is on the way into the application:
 * login -> company -> module -> branch -> ready.
 * Pure functions only: the guard, the selector screens and the redirects all ask here,
 * so they cannot disagree.
 */
export type ScopeStep = 'login' | 'company' | 'module' | 'branch' | 'ready';

/** What a page needs: only a company (administration, profile) or the full scope (business pages). */
export type ScopeNeed = 'company' | 'full';

export interface ScopeState {
  loggedIn: boolean;
  companyId: number | null;
  moduleKey: string | null;
  locationId: number | null;
}

export function nextScopeStep(state: ScopeState, need: ScopeNeed = 'full'): ScopeStep {
  if (!state.loggedIn) return 'login';
  if (!state.companyId) return 'company';
  if (need === 'company') return 'ready';
  if (!state.moduleKey) return 'module';
  if (!state.locationId) return 'branch';
  return 'ready';
}

export function routeForStep(step: ScopeStep): string {
  switch (step) {
    case 'login': return '/login';
    case 'company': return '/select-company';
    case 'module': return '/select-module';
    case 'branch': return '/select-branch';
    default: return '/';
  }
}

/** Why a module card is disabled ('' when it can be opened). */
export function moduleCaption(state: ModuleState): string {
  switch (state) {
    case 'NotSubscribed': return 'Not subscribed';
    case 'NoAccess': return 'Ask your administrator';
    default: return '';
  }
}

/**
 * Module of a stored session. A session scoped by the previous UI has a tenant key and a
 * branch but no module: it was the Service module, the only one that existed.
 */
export function legacyModuleKey(
  user: { projectKey?: string; locationId?: number; moduleKey?: string } | null,
): string | null {
  if (!user) return null;
  if (user.moduleKey) return user.moduleKey;
  return user.projectKey && user.locationId ? 'SERVICE' : null;
}

/** One branch is entered without asking; none is a dead end the screen must explain. */
export function branchDecision(count: number): 'none' | 'auto' | 'choose' {
  if (count <= 0) return 'none';
  return count === 1 ? 'auto' : 'choose';
}

/** First page of the Service module for a role. */
export function landingRouteForRole(role: string): string {
  switch (role) {
    case 'Technician': return '/technicians/work-orders';
    case 'Storekeeper': return '/spare-parts';
    default: return '/complaints/dashboard';
  }
}
```

- [ ] **Step 6: Run to verify it passes**

From `encryptzUI`, run: `npx ng test --watch=false --include "src/app/Encryptz/Auth/scope-flow.spec.ts" 2>&1 | tail -20`
Expected: all tests of `scope-flow.spec.ts` pass (15 tests).

- [ ] **Step 7: Commit**

```bash
git add encryptzUI/src/app/Encryptz/Auth/scope-flow.ts encryptzUI/src/app/Encryptz/Auth/scope-flow.spec.ts encryptzUI/src/app/Encryptz/Models/ApiModels.ts
git commit -m "Add the scope decisions for the company, module and branch steps"
```

(The removal of `customer-guard.spec.ts` was staged by `git rm` and goes into this commit.)

---

### Task 5: Module and branch state in the UI auth service

**Files:**
- Modify: `encryptzUI/src/app/Encryptz/Auth/auth-service.ts`
- Create: `encryptzUI/src/app/Encryptz/Auth/auth-service.scope.spec.ts`

**Interfaces:**
- Consumes: `legacyModuleKey`, `ScopeState` (Task 4); `ModuleDto`, `LocationDto`, `LoginResponse` (`ApiModels.ts`); API `GET auth/modules`, `GET auth/locations?moduleKey=`, `POST auth/set-scope {companyId, moduleKey, locationId}`.
- Produces on `AuthService`:
  - `selectedModuleKey: Signal<string | null>`, `selectedLocationName: Signal<string>`
  - `scopeState(): ScopeState`
  - `getModules(): Observable<ApiResponse<ModuleDto[]>>`
  - `getBranches(moduleKey: string): Observable<ApiResponse<LocationDto[]>>`
  - `setScope(moduleKey: string, locationId: number, locationName?: string): Observable<ApiResponse<LoginResponse>>` (signature changed: it was `setScope(projectId, locationId)`)
  - `Company.provisionStatus?: string`
  - Removed: `getProjects`, `getLocations`, `projects`, `locations`, `hasScope`, `getStoredProjectId`, `getStoredLocationId`
  - Kept until Plan 2b: `selectedProjectId` (read by `company-service.ts` and the platform admin component)
- localStorage keys added: `selected_module_key`, `selected_location_name`.

- [ ] **Step 1: Write the failing tests**

Create `encryptzUI/src/app/Encryptz/Auth/auth-service.scope.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth-service';

describe('AuthService scope', () => {
  let http: HttpTestingController;

  const create = (): AuthService => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('has no scope for a fresh browser', () => {
    const auth = create();
    expect(auth.scopeState()).toEqual({ loggedIn: false, companyId: null, moduleKey: null, locationId: null });
  });

  it('keeps a session that the previous UI scoped', () => {
    localStorage.setItem('encryptz_token', 't');
    localStorage.setItem('encryptz_user', JSON.stringify({
      token: 't', fullName: 'A', role: 'Technician', userId: 5, menus: [],
      companyId: 1, projectId: 1, projectKey: 'C001-P001', locationId: 2,
    }));
    localStorage.setItem('selected_company_id', '1');
    localStorage.setItem('selected_location_id', '2');

    const auth = create();

    expect(auth.scopeState()).toEqual({ loggedIn: true, companyId: 1, moduleKey: 'SERVICE', locationId: 2 });
  });

  it('asks the API for the modules of the selected company', () => {
    const auth = create();
    let names: string[] = [];
    auth.getModules().subscribe(res => names = (res.data || []).map(m => m.moduleName));

    const req = http.expectOne(r => r.url.endsWith('/api/auth/modules'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: [{ moduleId: 1, moduleKey: 'SERVICE', moduleName: 'Service Management', description: '', icon: 'build', sortOrder: 1, state: 'Available' }] });

    expect(names).toEqual(['Service Management']);
  });

  it('asks for the branches of a module', () => {
    const auth = create();
    auth.getBranches('SERVICE').subscribe();

    const req = http.expectOne(r => r.url.endsWith('/api/auth/locations'));
    expect(req.request.params.get('moduleKey')).toBe('SERVICE');
    req.flush({ success: true, message: '', data: [] });
  });

  it('stores the module and the branch when the scope is set', () => {
    localStorage.setItem('selected_company_id', '2');
    const auth = create();

    auth.setScope('SERVICE', 9, 'Elankulam').subscribe();

    const req = http.expectOne(r => r.url.endsWith('/api/auth/set-scope'));
    expect(req.request.body).toEqual({ companyId: 2, moduleKey: 'SERVICE', locationId: 9 });
    req.flush({ success: true, message: '', data: {
      token: 'scoped', fullName: 'A', role: 'Admin', userId: 5, menus: [],
      companyId: 2, projectId: 2, projectKey: 'C002-P001', moduleKey: 'SERVICE', locationId: 9,
    } });

    expect(auth.scopeState()).toEqual({ loggedIn: true, companyId: 2, moduleKey: 'SERVICE', locationId: 9 });
    expect(auth.selectedLocationName()).toBe('Elankulam');
    expect(localStorage.getItem('encryptz_token')).toBe('scoped');
    expect(localStorage.getItem('selected_module_key')).toBe('SERVICE');
  });

  it('does not store anything when the scope is refused', () => {
    localStorage.setItem('selected_company_id', '2');
    const auth = create();

    auth.setScope('SERVICE', 9).subscribe();
    http.expectOne(r => r.url.endsWith('/api/auth/set-scope'))
      .flush({ success: false, message: 'You don\'t have access to this module. Ask your administrator', data: null });

    expect(auth.selectedModuleKey()).toBeNull();
    expect(localStorage.getItem('selected_module_key')).toBeNull();
  });

  it('forgets the module and the branch when another company is selected', () => {
    localStorage.setItem('encryptz_token', 't');
    localStorage.setItem('encryptz_user', JSON.stringify({ token: 't', fullName: 'A', role: 'Admin', userId: 5, menus: [] }));
    localStorage.setItem('selected_company_id', '1');
    localStorage.setItem('selected_module_key', 'SERVICE');
    localStorage.setItem('selected_location_id', '2');
    localStorage.setItem('selected_location_name', 'Main');
    const auth = create();

    auth.selectCompany(2).subscribe();
    http.expectOne(r => r.url.endsWith('/api/auth/select-company')).flush({ success: true, message: '', data: {
      token: 'company', fullName: 'A', role: 'Admin', userId: 5, menus: [],
      companyId: 2, projectId: 0, projectKey: '', moduleKey: '', locationId: 0,
    } });

    expect(auth.scopeState()).toEqual({ loggedIn: true, companyId: 2, moduleKey: null, locationId: null });
    expect(auth.selectedLocationName()).toBe('');
    expect(localStorage.getItem('selected_module_key')).toBeNull();
    expect(localStorage.getItem('selected_location_id')).toBeNull();
  });

  it('clears the scope on logout', () => {
    localStorage.setItem('selected_module_key', 'SERVICE');
    localStorage.setItem('selected_location_name', 'Main');
    const auth = create();

    auth.clearSession();

    expect(localStorage.getItem('selected_module_key')).toBeNull();
    expect(localStorage.getItem('selected_location_name')).toBeNull();
    expect(auth.selectedModuleKey()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

From `encryptzUI`, run: `npx ng test --watch=false --include "src/app/Encryptz/Auth/auth-service.scope.spec.ts" 2>&1 | tail -25`
Expected: build errors (`scopeState`, `getModules`, `getBranches`, `selectedLocationName`, `selectedModuleKey` do not exist; `setScope` argument types).

- [ ] **Step 3: Implement in `auth-service.ts`**

(a) Imports: add `ModuleDto` to the import from `'../Models/ApiModels'` (keep `LocationDto`, `LoginResponse`; `ProjectDto` is no longer needed in this file: remove it from the import if nothing else in the file uses it), and add:

```ts
import { legacyModuleKey, ScopeState } from './scope-flow';
```

(b) In the `Company` interface add:

```ts
  /** State of the company's database: None | Provisioning | Ready | Failed. */
  provisionStatus?: string;
```

(c) Replace the block of scoping fields (from the comment `// Project -> Location scoping (within the selected company/client)` down to and including the `hasScope = computed(...)` line) with:

```ts
  // Module -> Branch scoping (within the selected company)
  private _selectedModuleKey = signal<string | null>(null);
  private _selectedLocationId = signal<number | null>(null);
  private _selectedLocationName = signal<string>('');
  /** Tenant scope id of the token. Still read by the invitation and platform screens. */
  private _selectedProjectId = signal<number | null>(null);

  selectedModuleKey = this._selectedModuleKey.asReadonly();
  selectedLocationId = this._selectedLocationId.asReadonly();
  selectedLocationName = this._selectedLocationName.asReadonly();
  selectedProjectId = this._selectedProjectId.asReadonly();

  /** Where this session is on the way into the application (see scope-flow.ts). */
  scopeState(): ScopeState {
    return {
      loggedIn: this.isLoggedIn(),
      companyId: this._selectedCompanyId() || null,
      moduleKey: this._selectedModuleKey() || null,
      locationId: this._selectedLocationId() || null,
    };
  }
```

(d) In `clearSession()`: add after the line that removes `selected_location_id`:

```ts
    localStorage.removeItem('selected_module_key');
    localStorage.removeItem('selected_location_name');
```

and replace the four lines that reset `_projects`, `_locations`, `_selectedProjectId`, `_selectedLocationId` with:

```ts
    this._selectedModuleKey.set(null);
    this._selectedProjectId.set(null);
    this._selectedLocationId.set(null);
    this._selectedLocationName.set('');
```

(e) In `selectCompany(...)`, inside the `tap`, replace the comment and the `this.persistScope(...)` call with:

```ts
          // a company token has no module or branch yet: forget those of the previous company
          this.clearScope();
```

(f) Replace everything from the comment block `// PROJECT -> LOCATION SCOPING` down to and including the `getStoredLocationId()` method (that is `getProjects`, `getLocations`, `setScope`, `persistScope`, `getStoredProjectId`, `getStoredLocationId`) with:

```ts
// ============================================
// MODULE -> BRANCH SCOPING
// ============================================

/** Every module of the catalogue, with whether this user can open it in the selected company. */
getModules(): Observable<ApiResponse<ModuleDto[]>> {
  return this.http.get<ApiResponse<ModuleDto[]>>(`${this.apiUrl}/modules`);
}

/** Branches of the selected company for a module. */
getBranches(moduleKey: string): Observable<ApiResponse<LocationDto[]>> {
  return this.http.get<ApiResponse<LocationDto[]>>(`${this.apiUrl}/locations`, { params: { moduleKey } });
}

/**
 * Enter a module at a branch. The API checks the company's subscription and this user's
 * access and re-issues the token; every later call is routed and filtered by it.
 */
setScope(moduleKey: string, locationId: number, locationName = ''): Observable<ApiResponse<LoginResponse>> {
  const companyId = this._selectedCompanyId() ?? this._currentUser()?.companyId ?? 0;
  return this.http
    .post<ApiResponse<LoginResponse>>(`${this.apiUrl}/set-scope`, { companyId, moduleKey, locationId })
    .pipe(timeout({ first: 45_000 }), tap(res => {
      if (res.success && res.data) {
        const data = res.data;
        localStorage.setItem('encryptz_token', data.token);
        localStorage.setItem('encryptz_user', JSON.stringify(data));
        localStorage.setItem('encryptz_menus', JSON.stringify(data.menus || []));
        this._currentUser.set(data);
        this._menus.set(data.menus || []);
        this.persistScope(data.moduleKey || moduleKey, data.locationId ?? locationId, locationName, data.projectId);
      }
    }));
}

/** Store the module and branch of the session in localStorage + signals. */
private persistScope(moduleKey: string, locationId: number, locationName: string, scopeId?: number): void {
  localStorage.setItem('selected_module_key', moduleKey);
  localStorage.setItem('selected_location_id', locationId.toString());
  localStorage.setItem('selected_location_name', locationName);
  this._selectedModuleKey.set(moduleKey || null);
  this._selectedLocationId.set(locationId || null);
  this._selectedLocationName.set(locationName);

  if (scopeId != null) {
    localStorage.setItem('selected_project_id', scopeId.toString());
    this._selectedProjectId.set(scopeId || null);
  }
}

/** Forget the module and branch (another company was selected). */
private clearScope(): void {
  localStorage.removeItem('selected_module_key');
  localStorage.removeItem('selected_project_key');
  localStorage.removeItem('selected_project_id');
  localStorage.removeItem('selected_location_id');
  localStorage.removeItem('selected_location_name');
  this._selectedModuleKey.set(null);
  this._selectedProjectId.set(null);
  this._selectedLocationId.set(null);
  this._selectedLocationName.set('');
}
```

(g) In `loadFromStorage()`: replace the two lines

```ts
  if (storedProjectId) this._selectedProjectId.set(+storedProjectId);
  if (storedLocationId) this._selectedLocationId.set(+storedLocationId);
```

with

```ts
  if (storedProjectId) this._selectedProjectId.set(+storedProjectId);
  if (storedLocationId) this._selectedLocationId.set(+storedLocationId);
  this._selectedLocationName.set(localStorage.getItem('selected_location_name') || '');
```

and, at the END of `loadFromStorage()` (after the `tempLogin` block), add:

```ts
  // A session scoped by the previous UI has no module stored: it was the Service module.
  const storedModuleKey = localStorage.getItem('selected_module_key');
  this._selectedModuleKey.set(storedModuleKey || legacyModuleKey(this._currentUser()));
```

(h) Search this file for any remaining use of `_projects`, `_locations`, `ProjectDto`, `hasScope`: there must be none. Do not touch the commented-out code blocks.

- [ ] **Step 4: Find the callers of what was removed**

From `encryptzUI`, run:

```bash
grep -rnE "\.getProjects\(|\.getLocations\(|\.hasScope|getStoredProjectId|getStoredLocationId|auth\.projects\(|auth\.locations\(|\.setScope\(" src/app --include=*.ts --include=*.html | grep -v "Services/platform-service.ts\|platform-admin-component\|auth-service"
```

Expected: only lines inside `components/project-location-switcher-component/` (that component is deleted in the next step). If any OTHER file is listed, stop and report it.

- [ ] **Step 5: Run to verify the tests pass**

The spec build needs the application to compile, and the switcher component still calls the removed members. To run the tests of this task now, delete the switcher component and its use first (this is Task 7, Step 1; do it now and commit it with this task):

```bash
git rm -r encryptzUI/src/app/Encryptz/components/project-location-switcher-component
```

and in `encryptzUI/src/app/Encryptz/components/company-selector-component/company-selector-component.ts` remove the `ProjectLocationSwitcherComponent` import line and its entry in the `imports` array; in `company-selector-component.html` replace the line `<app-project-location-switcher variant="dark" (scopeApplied)="onScopeApplied()" />` with `<!-- module and branch steps: see Task 7 -->`.

From `encryptzUI`, run: `npx ng test --watch=false --include "src/app/Encryptz/Auth/*.spec.ts" 2>&1 | tail -25`
Expected: `scope-flow.spec.ts` (15) and `auth-service.scope.spec.ts` (8) pass.

- [ ] **Step 6: Commit**

```bash
git add encryptzUI/src/app/Encryptz/Auth encryptzUI/src/app/Encryptz/components/company-selector-component
git commit -m "Hold the module and branch of a session in the UI auth service"
```

---

### Task 6: Scope guard and the three step routes

**Files:**
- Modify: `encryptzUI/src/app/Encryptz/Auth/guard-guard.ts`
- Create: `encryptzUI/src/app/Encryptz/Auth/scope-guard.spec.ts`
- Modify: `encryptzUI/src/app/app.routes.ts`
- Delete: `encryptzUI/src/app/Encryptz/Guard/company-guard.ts`, `encryptzUI/src/app/Encryptz/Guard/company-guard.spec.ts`

**Interfaces:**
- Consumes: `nextScopeStep`, `routeForStep`, `ScopeNeed` (Task 4); `AuthService.scopeState()` (Task 5).
- Produces: `scopeGuard: CanActivateChildFn` in `guard-guard.ts`; routes `/select-company`, `/select-module`, `/select-branch` each with `data: { stage: 'company' | 'module' | 'branch' }`; route data `scope: 'company'` on the pages that need only a company.

- [ ] **Step 1: Write the failing tests**

Create `encryptzUI/src/app/Encryptz/Auth/scope-guard.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth-service';
import { scopeGuard } from './guard-guard';
import { ScopeState } from './scope-flow';

describe('scopeGuard', () => {
  const run = (scope: ScopeState, data: Record<string, unknown> = {}) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { scopeState: () => scope } }],
    });
    const route = { data } as unknown as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() => scopeGuard(route, {} as RouterStateSnapshot));
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;
  };

  const full: ScopeState = { loggedIn: true, companyId: 2, moduleKey: 'SERVICE', locationId: 9 };

  it('lets a fully scoped session into a business page', () => {
    expect(run(full)).toBe(true);
  });

  it('sends a session with only a company to the module screen', () => {
    expect(run({ ...full, moduleKey: null, locationId: null })).toBe('/select-module');
  });

  it('sends a session without a branch to the branch screen', () => {
    expect(run({ ...full, locationId: null })).toBe('/select-branch');
  });

  it('sends a session without a company to the company screen', () => {
    expect(run({ ...full, companyId: null })).toBe('/select-company');
  });

  it('sends a visitor to login', () => {
    expect(run({ ...full, loggedIn: false })).toBe('/login');
  });

  it('lets a session with only a company into a company-only page', () => {
    expect(run({ ...full, moduleKey: null, locationId: null }, { scope: 'company' })).toBe(true);
  });

  it('still asks for a company on a company-only page', () => {
    expect(run({ ...full, companyId: null }, { scope: 'company' })).toBe('/select-company');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

From `encryptzUI`, run: `npx ng test --watch=false --include "src/app/Encryptz/Auth/scope-guard.spec.ts" 2>&1 | tail -20`
Expected: build error, `scopeGuard` is not exported from `./guard-guard`.

- [ ] **Step 3: Implement the guard**

In `encryptzUI/src/app/Encryptz/Auth/guard-guard.ts` change the first import lines to:

```ts
import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth-service';
import { nextScopeStep, routeForStep, ScopeNeed } from './scope-flow';
```

and add at the end of the file:

```ts
/**
 * Pages inside the application need a company, a module and a branch; pages marked
 * `data: { scope: 'company' }` (administration, profile) need only a company.
 * A session that is not there yet is sent to the step it is missing.
 */
export const scopeGuard: CanActivateChildFn = (childRoute) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const need: ScopeNeed = childRoute.data?.['scope'] === 'company' ? 'company' : 'full';
  const step = nextScopeStep(auth.scopeState(), need);

  return step === 'ready' ? true : router.createUrlTree([routeForStep(step)]);
};
```

- [ ] **Step 4: Wire the routes**

In `encryptzUI/src/app/app.routes.ts`:

(a) Change the guard import to:

```ts
import { authGuard, dashboardRedirectGuard, roleGuard, scopeGuard } from './Encryptz/Auth/guard-guard';
```

(b) Replace the `select-company` route line with these three:

```ts
  { path: 'select-company', component: CompanySelectorComponent, canActivate: [authGuard], data: { stage: 'company' } },
  { path: 'select-module', component: CompanySelectorComponent, canActivate: [authGuard], data: { stage: 'module' } },
  { path: 'select-branch', component: CompanySelectorComponent, canActivate: [authGuard], data: { stage: 'branch' } },
```

(c) On the main-layout route (the one with `component: MainLayoutComponent`), add below `canActivate: [authGuard],`:

```ts
    canActivateChild: [scopeGuard],
```

(d) Mark the pages that need only a company. Add `scope: 'company'` to the route `data` of each of these child routes (create the `data` object when the route has none; keep existing keys):

- `admin/add-user`
- `settings/access-management`
- `settings/roles`
- `settings/platform`
- `profile`

For example the `admin/add-user` route becomes:

```ts
      {
        path: 'admin/add-user',
        component: AddUserComponent,
        canActivate: [roleGuard(['Admin', 'CompanyAdmin'])],
        data: { scope: 'company' },
      },
```

and the `profile` route's data becomes `data: { title: 'My Profile', icon: 'person', scope: 'company' }`.

(e) Delete the unused guard:

```bash
git rm encryptzUI/src/app/Encryptz/Guard/company-guard.ts encryptzUI/src/app/Encryptz/Guard/company-guard.spec.ts
```

Run `grep -rn "company-guard\|companyGuard" encryptzUI/src` and expect no output.

- [ ] **Step 5: Run to verify it passes**

From `encryptzUI`, run: `npx ng test --watch=false --include "src/app/Encryptz/Auth/*.spec.ts" 2>&1 | tail -25`
Expected: the three spec files pass (15 + 8 + 7).

- [ ] **Step 6: Commit**

```bash
git add encryptzUI/src/app/Encryptz/Auth/guard-guard.ts encryptzUI/src/app/Encryptz/Auth/scope-guard.spec.ts encryptzUI/src/app/app.routes.ts
git commit -m "Guard application pages by company, module and branch"
```

---

### Task 7: The company, module and branch steps

**Files:**
- Modify: `encryptzUI/src/app/Encryptz/components/company-selector-component/company-selector-component.ts`
- Modify: `encryptzUI/src/app/Encryptz/components/company-selector-component/company-selector-component.html`
- Modify: `encryptzUI/src/app/Encryptz/components/company-selector-component/company-selector-component.scss`
- Replace: `encryptzUI/src/app/Encryptz/components/company-selector-component/company-selector-component.spec.ts`

**Interfaces:**
- Consumes: `AuthService.getModules()`, `getBranches(moduleKey)`, `setScope(moduleKey, locationId, locationName)`, `selectCompany(companyId)`, `companies()`, `selectedModuleKey()`, `currentUser()`, `userRole()` (Task 5); `moduleCaption`, `branchDecision`, `landingRouteForRole` (Task 4); route data `stage` (Task 6).
- Produces: nothing other tasks call. The component keeps its selector, its change-password modal and its `logout()`.

The component is used by three routes. Each route creates a fresh instance and tells it its stage through route data. (The switcher component and its import were already removed in Task 5, Step 5.)

- [ ] **Step 1: Write the failing tests**

Replace the whole of `company-selector-component.spec.ts` with:

```ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { CompanySelectorComponent } from './company-selector-component';

describe('CompanySelectorComponent', () => {
  const modules = [
    { moduleId: 1, moduleKey: 'SERVICE', moduleName: 'Service Management', description: 'd', icon: 'build', sortOrder: 1, state: 'Available' },
    { moduleId: 2, moduleKey: 'SALES', moduleName: 'Sales', description: 'd', icon: 'sell', sortOrder: 2, state: 'NotSubscribed' },
    { moduleId: 3, moduleKey: 'HR', moduleName: 'HR', description: 'd', icon: 'groups', sortOrder: 3, state: 'NoAccess' },
  ];
  const branch = (id: number, name: string) => ({ locationId: id, locationName: name });

  let auth: any;
  let navigated: any[][];

  const create = (stage: string, queryModule: string | null = null) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CompanySelectorComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: {
          data: { stage },
          queryParamMap: { get: (k: string) => (k === 'module' ? queryModule : null) },
        } } },
      ],
    });
    navigated = [];
    const router = TestBed.inject(Router);
    router.navigate = ((commands: any[], extras?: any) => { navigated.push(extras ? [commands, extras] : [commands]); return Promise.resolve(true); }) as any;
    const fixture = TestBed.createComponent(CompanySelectorComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    localStorage.clear();
    auth = {
      userId: () => 5,
      userRole: () => 'Admin',
      currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin: false }),
      companies: () => [{ companyId: 2, companyName: 'Hamster A/C', companyCode: 'C002', roleInCompany: 'Admin', isLinked: false, provisionStatus: 'Ready' }],
      selectedModuleKey: () => null,
      selectCompany: () => of({ success: true, message: '', data: { role: 'Admin' } }),
      getModules: () => of({ success: true, message: '', data: modules }),
      getBranches: () => of({ success: true, message: '', data: [branch(1, 'Main'), branch(2, 'North')] }),
      setScope: () => of({ success: true, message: '', data: { role: 'Admin' } }),
      logout: () => {},
    };
  });

  it('shows the company list even when there is only one company', () => {
    const fixture = create('company');
    const items = fixture.nativeElement.querySelectorAll('.company-item');
    expect(items.length).toBe(1);
    expect(navigated.length).toBe(0);
  });

  it('goes to the module step after a company is picked', () => {
    const fixture = create('company');
    fixture.componentInstance.selectCompany(auth.companies()[0]);
    expect(navigated).toEqual([[['/select-module']]]);
  });

  it('lists every module and disables the ones that cannot be opened', () => {
    const fixture = create('module');
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.module-item')) as HTMLElement[];

    expect(cards.length).toBe(3);
    expect(cards[0].classList.contains('disabled')).toBe(false);
    expect(cards[1].classList.contains('disabled')).toBe(true);
    expect(cards[1].textContent).toContain('Not subscribed');
    expect(cards[2].classList.contains('disabled')).toBe(true);
    expect(cards[2].textContent).toContain('Ask your administrator');
  });

  it('opens the branch step for an available module only', () => {
    const fixture = create('module');
    const c = fixture.componentInstance;

    c.openModule(modules[1] as any);
    c.openModule(modules[2] as any);
    expect(navigated.length).toBe(0);

    c.openModule(modules[0] as any);
    expect(navigated).toEqual([[['/select-branch'], { queryParams: { module: 'SERVICE' } }]]);
  });

  it('lists the branches when there are several', () => {
    const fixture = create('branch', 'SERVICE');
    const items = fixture.nativeElement.querySelectorAll('.branch-item');
    expect(items.length).toBe(2);
    expect(navigated.length).toBe(0);
  });

  it('enters the only branch without asking', () => {
    let scoped: any[] = [];
    auth.getBranches = () => of({ success: true, message: '', data: [branch(7, 'Elankulam')] });
    auth.setScope = (...args: any[]) => { scoped = args; return of({ success: true, message: '', data: { role: 'Technician' } }); };

    create('branch', 'SERVICE');

    expect(scoped).toEqual(['SERVICE', 7, 'Elankulam']);
    expect(navigated).toEqual([[['/technicians/work-orders']]]);
  });

  it('explains when no branch is assigned', () => {
    auth.getBranches = () => of({ success: true, message: '', data: [] });
    const fixture = create('branch', 'SERVICE');
    expect(fixture.nativeElement.textContent).toContain('No branch assigned');
    expect(navigated.length).toBe(0);
  });

  it('shows the reason when the branches are refused', () => {
    auth.getBranches = () => of({ success: false, message: 'Your company is still being set up. Please try again shortly', data: null });
    const fixture = create('branch', 'SERVICE');
    expect(fixture.nativeElement.textContent).toContain('Your company is still being set up');
  });

  it('shows the reason when entering a branch is refused', () => {
    auth.setScope = () => of({ success: false, message: 'Invalid location for this company', data: null });
    const fixture = create('branch', 'SERVICE');
    fixture.componentInstance.enterBranch(branch(1, 'Main') as any);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Invalid location for this company');
    expect(navigated.length).toBe(0);
  });

  it('shows a plain message when the server cannot be reached', () => {
    auth.getModules = () => throwError(() => new Error('boom'));
    const fixture = create('module');
    expect(fixture.nativeElement.textContent).toContain('Could not load the modules');
    expect(fixture.nativeElement.textContent).not.toContain('boom');
  });

  it('goes back to the module step when the branch step has no module', () => {
    create('branch', null);
    expect(navigated).toEqual([[['/select-module']]]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

From `encryptzUI`, run: `npx ng test --watch=false --include "src/app/Encryptz/components/company-selector-component/*.spec.ts" 2>&1 | tail -30`
Expected: build errors (`openModule`, `enterBranch` do not exist) or failing tests.

- [ ] **Step 3: Rewrite the component class**

In `company-selector-component.ts`:

(a) Replace the import block at the top (down to the `@Component` decorator, which stays; its `imports` array is `[CommonModule, FormsModule]`) with:

```ts
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, Company } from '../../Auth/auth-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocationDto, ModuleDto } from '../../Models/ApiModels';
import { branchDecision, landingRouteForRole, moduleCaption } from '../../Auth/scope-flow';

type Stage = 'company' | 'module' | 'branch';
```

(b) Replace everything from `export class CompanySelectorComponent {` down to and including the `redirectByRole` method (keep `getRoleClass`, `logout` and all the change-password members below it exactly as they are) with:

```ts
export class CompanySelectorComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  userId = this.auth.userId();
  loading = signal(true);
  error = signal('');

  /** Which of the three steps this route shows (route data). */
  stage = signal<Stage>('company');

  companies = signal<Company[]>([]);
  modules = signal<ModuleDto[]>([]);
  branches = signal<LocationDto[]>([]);
  /** The branch step found no branch for this user. */
  noBranch = signal(false);
  /** A single branch is being entered without asking. */
  entering = signal(false);

  private moduleKey = '';

  // Change Password States
  showChangePasswordModal = signal(false);
  changePasswordOld = '';
  changePasswordNew = '';
  changePasswordConfirm = '';
  changePasswordLoading = signal(false);
  changePasswordError = signal('');
  changePasswordSuccess = signal('');

  ngOnInit() {
    const stage = this.route.snapshot.data['stage'] as Stage | undefined;
    this.stage.set(stage ?? 'company');

    if (this.stage() === 'module') {
      this.loadModules();
    } else if (this.stage() === 'branch') {
      this.moduleKey = this.route.snapshot.queryParamMap.get('module') || this.auth.selectedModuleKey() || '';
      if (!this.moduleKey) {
        this.router.navigate(['/select-module']);
        return;
      }
      this.loadBranches();
    } else {
      this.loadCompanies();
    }
  }

  /** Reload whatever this step shows (the Retry button). */
  reload(): void {
    this.error.set('');
    if (this.stage() === 'module') this.loadModules();
    else if (this.stage() === 'branch') this.loadBranches();
    else this.loadCompanies();
  }

  // ── STEP 1: COMPANY ───────────────────────────────────────────────

  loadCompanies() {
    this.loading.set(true);

    const companies = this.auth.companies();

    if (companies.length > 0) {
      this.companies.set(companies);
      this.loading.set(false);
      return;
    }

    const temp = localStorage.getItem('temp_login');

    if (temp) {
      const data = JSON.parse(temp);
      this.companies.set(data.companies || []);
      this.loading.set(false);
      return;
    }

    this.loading.set(false);
    this.error.set('No companies found. Please login again.');
  }

  selectCompany(company: Company) {
    this.loading.set(true);

    this.auth.selectCompany(company.companyId).subscribe({
      next: (res) => {
        this.loading.set(false);

        if (!res.success || !res.data) {
          this.error.set(res.message || 'Failed to select company');
          return;
        }

        this.router.navigate(['/select-module']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to select company');
      }
    });
  }

  /** Text of a company whose database is not ready ('' when it is). */
  companyStatus(company: Company): string {
    switch (company.provisionStatus) {
      case 'Provisioning': return 'Setting up…';
      case 'Failed': return 'Setup failed';
      case 'None': return 'No database yet';
      default: return '';
    }
  }

  // ── STEP 2: MODULE ────────────────────────────────────────────────

  private loadModules(): void {
    this.loading.set(true);
    this.auth.getModules().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (!res.success) {
          this.error.set(res.message || 'Could not load the modules');
          return;
        }
        this.modules.set(res.data || []);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load the modules. Please try again.');
      }
    });
  }

  caption(module: ModuleDto): string {
    return moduleCaption(module.state);
  }

  openModule(module: ModuleDto): void {
    if (module.state !== 'Available') return;
    this.router.navigate(['/select-branch'], { queryParams: { module: module.moduleKey } });
  }

  /** Administrators of a company can work on it before any module can be opened. */
  canAdminister(): boolean {
    const role = this.auth.userRole();
    return role === 'Admin' || role === 'CompanyAdmin' || !!this.auth.currentUser()?.isPlatformAdmin;
  }

  openAdministration(): void {
    this.router.navigate(['/settings/platform']);
  }

  // ── STEP 3: BRANCH ────────────────────────────────────────────────

  private loadBranches(): void {
    this.loading.set(true);
    this.noBranch.set(false);
    this.auth.getBranches(this.moduleKey).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (!res.success) {
          this.error.set(res.message || 'Could not load the branches');
          return;
        }

        const list = res.data || [];
        this.branches.set(list);

        const decision = branchDecision(list.length);
        if (decision === 'none') {
          this.noBranch.set(true);
        } else if (decision === 'auto') {
          this.entering.set(true);
          this.enterBranch(list[0]);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load the branches. Please try again.');
      }
    });
  }

  enterBranch(branch: LocationDto): void {
    this.loading.set(true);
    this.error.set('');

    this.auth.setScope(this.moduleKey, branch.locationId, branch.locationName).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.router.navigate([landingRouteForRole(res.data.role)]);
          return;
        }
        // leave the "entering" spinner so the reason and the list are visible
        this.entering.set(false);
        this.error.set(res.message || 'Could not open this branch');
      },
      error: (err) => {
        this.loading.set(false);
        this.entering.set(false);
        this.error.set(err?.name === 'TimeoutError'
          ? 'Opening the branch timed out. Please try again.'
          : 'Could not open this branch. Please try again.');
      }
    });
  }

  backToCompanies(): void {
    this.router.navigate(['/select-company']);
  }

  backToModules(): void {
    this.router.navigate(['/select-module']);
  }
```

If the file still has a `console.log('CompanySelector initialized')` line, it was inside the replaced block and is gone; do not add it back.

- [ ] **Step 4: Rewrite the card body of the template**

In `company-selector-component.html`, replace everything from the opening `<div class="logo-section">` down to and including the closing `}` of the `@if (error()) { ... }` block (the block that ends with the `Retry` button; this range contains the comment line left by Task 5) with:

```html
        <div class="logo-section">
          <div class="logo-icon"><img src="logo.png" alt="Encryptz" /></div>
          @if (stage() === 'company') {
            <div class="brand-name">Select Company</div>
            <div class="brand-sub">Please choose a company to continue</div>
          } @else if (stage() === 'module') {
            <div class="brand-name">Modules</div>
            <div class="brand-sub">Choose what you want to work with</div>
          } @else {
            <div class="brand-name">Select Branch</div>
            <div class="brand-sub">Choose where you'll work</div>
          }
        </div>

        @if (loading() || entering()) {
          <div class="loading-state">
            <div class="spinner"></div>
            @if (stage() === 'company') { <span>Loading your companies...</span> }
            @else if (stage() === 'module') { <span>Loading the modules...</span> }
            @else if (entering()) { <span>Setting up your workspace…</span> }
            @else { <span>Loading the branches...</span> }
          </div>
        }

        <!-- STEP 1: COMPANY -->
        @if (!loading() && stage() === 'company' && companies().length === 0) {
          <div class="empty-state">
            <span class="material-icons">business_off</span>
            <p>No companies found.</p>
            <p class="small">Please contact your administrator to get added to a company.</p>
            <button class="btn-signin" (click)="logout()">Go to Login</button>
          </div>
        }

        @if (!loading() && stage() === 'company' && companies().length > 0) {
          <div class="company-list">
            @for (company of companies(); track company.companyId) {
              <div class="company-item" (click)="selectCompany(company)">
                <div class="company-avatar">
                  <span class="material-icons">apartment</span>
                </div>
                <div class="company-info">
                  <h3>{{ company.companyName }}</h3>
                  <p class="company-code">{{ company.companyCode }}</p>
                  <span class="role-badge" [class]="getRoleClass(company.roleInCompany)">
                    {{ company.roleInCompany }}
                  </span>
                  @if (companyStatus(company)) {
                    <span class="status-badge">{{ companyStatus(company) }}</span>
                  }
                </div>
                <span class="material-icons arrow">chevron_right</span>
              </div>
            }
          </div>
        }

        <!-- STEP 2: MODULE (every module is listed; the ones this user cannot open are disabled) -->
        @if (!loading() && stage() === 'module') {
          <div class="company-list">
            @for (module of modules(); track module.moduleKey) {
              <div class="company-item module-item" [class.disabled]="module.state !== 'Available'"
                   [attr.aria-disabled]="module.state !== 'Available'" (click)="openModule(module)">
                <div class="company-avatar">
                  <span class="material-icons">{{ module.icon || 'apps' }}</span>
                </div>
                <div class="company-info">
                  <h3>{{ module.moduleName }}</h3>
                  <p class="company-code">{{ module.description }}</p>
                  @if (caption(module)) {
                    <span class="status-badge">{{ caption(module) }}</span>
                  }
                </div>
                @if (module.state === 'Available') {
                  <span class="material-icons arrow">chevron_right</span>
                } @else {
                  <span class="material-icons arrow">lock</span>
                }
              </div>
            }
          </div>

          <div class="scope-step">
            @if (canAdminister()) {
              <button class="link-back" (click)="openAdministration()">
                <span class="material-icons">admin_panel_settings</span> Administration
              </button>
            }
            <button class="link-back" (click)="backToCompanies()">
              <span class="material-icons">chevron_left</span> Back to companies
            </button>
          </div>
        }

        <!-- STEP 3: BRANCH -->
        @if (!loading() && !entering() && stage() === 'branch') {
          @if (noBranch()) {
            <div class="empty-state">
              <span class="material-icons">location_off</span>
              <p>No branch assigned.</p>
              <p class="small">Ask your administrator to give you a branch.</p>
            </div>
          } @else {
            <div class="company-list">
              @for (branch of branches(); track branch.locationId) {
                <div class="company-item branch-item" (click)="enterBranch(branch)">
                  <div class="company-avatar">
                    <span class="material-icons">storefront</span>
                  </div>
                  <div class="company-info">
                    <h3>{{ branch.locationName }}</h3>
                    <p class="company-code">{{ branch.city || branch.locationCode }}</p>
                  </div>
                  <span class="material-icons arrow">chevron_right</span>
                </div>
              }
            </div>
          }

          <div class="scope-step">
            <button class="link-back" (click)="backToModules()">
              <span class="material-icons">chevron_left</span> Back to modules
            </button>
          </div>
        }

        @if (error()) {
          <div class="error-msg">
            <span class="material-icons">error_outline</span>
            {{ error() }}
            <button (click)="reload()" class="retry-btn">Retry</button>
          </div>
        }
```

- [ ] **Step 5: Add the two styles**

Append to `company-selector-component.scss`:

```scss
/* a module the user cannot open: listed, not clickable */
.company-item.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.company-item.disabled:hover {
  transform: none;
  box-shadow: none;
}

/* why a module is disabled / the state of a company's database */
.status-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: rgba(255, 183, 0, 0.18);
  color: #ffd98a;
  border: 1px solid rgba(255, 183, 0, 0.40);
}
```

- [ ] **Step 6: Run to verify it passes**

From `encryptzUI`, run: `npx ng test --watch=false --include "src/app/Encryptz/components/company-selector-component/*.spec.ts" 2>&1 | tail -30`
Expected: 11 tests pass.

Run: `npx ng test --watch=false --include "src/app/Encryptz/Auth/*.spec.ts" 2>&1 | tail -10`
Expected: still passing.

- [ ] **Step 7: Commit**

```bash
git add encryptzUI/src/app/Encryptz/components/company-selector-component
git commit -m "Show companies, then modules, then branches"
```

---

### Task 8: Header, login redirect and the platform default company

**Files:**
- Modify: `encryptzUI/src/app/Encryptz/components/header-component/header-component.html`
- Modify: `encryptzUI/src/app/Encryptz/components/header-component/header-component.ts`
- Modify: `encryptzUI/src/app/Encryptz/components/login-component/login-component.ts`
- Modify: `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.ts` (one line)

**Interfaces:**
- Consumes: `AuthService.selectedLocationName()`, `selectedModuleKey()`, `selectedCompanyId()` (Task 5).

- [ ] **Step 1: Header: show the branch and offer the three switches**

In `header-component.ts` add this getter to the class:

```ts
  /** Branch the session works in ('' before one is chosen). */
  get branchName(): string {
    return this.auth.selectedLocationName();
  }
```

In `header-component.html`, replace the brand block

```html
    <div class="brand">
  <span class="brand-text">
    {{ companyName }}
    <span class="brand-accent">{{ companySuffix }}</span>
  </span>
</div>
```

with

```html
    <div class="brand">
  <span class="brand-text">
    {{ companyName }}
    <span class="brand-accent">{{ companySuffix }}</span>
  </span>
  @if (branchName) {
    <span class="brand-branch">· {{ branchName }}</span>
  }
</div>
```

and, inside the dropdown, add these three items between the `Profile` item and the `Logout` item:

```html
      <a routerLink="/select-branch" [queryParams]="{ module: auth.selectedModuleKey() }" class="dropdown-item">
        <span class="material-icons">storefront</span> Switch branch
      </a>
      <a routerLink="/select-module" class="dropdown-item">
        <span class="material-icons">apps</span> Modules
      </a>
      <a routerLink="/select-company" class="dropdown-item">
        <span class="material-icons">apartment</span> Switch company
      </a>
```

Append to `header-component.scss`:

```scss
.brand-branch {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 500;
  opacity: 0.7;
}
```

- [ ] **Step 2: Login always goes to the company list**

In `login-component.ts`, replace the whole `handlePostLoginWithData` method with:

```ts
  private handlePostLoginWithData(userData: any, companies: any[]): void {
    // The company list is always shown, also for a single company (it is where a
    // user creates or joins a company); the module and branch steps follow it.
    this.router.navigate([companies.length === 0 ? '/no-company' : '/select-company']);
  }
```

Then check whether the private `redirectByRole` method of this component is still called anywhere in the file (`grep -n "redirectByRole" src/app/Encryptz/components/login-component/login-component.ts` from `encryptzUI`). If the only remaining line is its own definition, delete the method.

- [ ] **Step 3: Platform Admin opens on the company the admin is working in**

In `platform-admin-component.ts`, find the line

```ts
        const current = this.auth.selectedProjectId();
```

and replace it with

```ts
        // a "project" is the company's database: its id is the company id
        const current = this.auth.selectedCompanyId();
```

Change nothing else in that component.

- [ ] **Step 4: Build and run every new test**

From `encryptzUI`, run:

```bash
npx ng build 2>&1 | tail -15
npx ng test --watch=false --include "src/app/Encryptz/Auth/*.spec.ts" --include "src/app/Encryptz/components/company-selector-component/*.spec.ts" 2>&1 | tail -15
grep -rniE "project|location" src/app/Encryptz/components/company-selector-component/*.html src/app/Encryptz/components/header-component/*.html
```

Expected: the build completes without errors (warnings that existed before are fine); 41 tests pass (15 + 8 + 7 + 11); the grep prints nothing (those screens say "Branch" and never "Project").

Then run the whole suite once and compare with the baseline you recorded in Task 4: `npx ng test --watch=false 2>&1 | tail -30`. No spec that passed in the baseline may fail now. Put both lists in your report.

- [ ] **Step 5: Commit**

```bash
git add encryptzUI/src/app/Encryptz/components/header-component encryptzUI/src/app/Encryptz/components/login-component encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.ts
git commit -m "Show the branch in the header and offer branch, module and company switches"
```

---

### Task 9: Verification with a running API (owner-gated)

This task needs an API connected to databases that may be written to. Per the Global Constraints the assistant has none. **Stop here and ask the owner**; it is the same gate as Task 13 of Plan 1 (restored COPIES of the main database and one tenant database, with the cut-over scripts run on the main-database copy, and explicit permission to use them). Until then report Tasks 1 to 8 as "implemented and unit-tested; not run against an API".

With the API of Plan 1 Task 13 running against the copies, and the UI started from `encryptzUI` with `npx ng serve` (it points at `http://localhost:5092`):

- [ ] **Step 1: Walk the staff flow**

| # | Do | Expect |
|---|---|---|
| 1 | Log in as a member of the test company | The company list, also with one company |
| 2 | Pick the company | The module list; "Service Management" enabled |
| 3 | Open the module, company has one branch | The app opens without a branch screen; the header shows `· <branch name>` |
| 4 | Add a second branch in Platform Admin, then header → Switch branch | The branch list; picking one reopens the app with that branch in the header |
| 5 | Header → Modules, header → Switch company | The module list; the company list |
| 6 | With only a company selected, type `/complaints/dashboard` in the address bar | Redirected to `/select-module` |
| 7 | With only a company selected, type `/settings/platform` | Platform Admin opens |
| 8 | Reload the browser inside the app | Still inside the app, same branch |
| 9 | In the copy: `DELETE FROM dbo.UserModuleAccess` for a non-admin member; log in as that member | The Service card is disabled and says "Ask your administrator"; clicking it does nothing |
| 10 | In the copy: `UPDATE dbo.CompanyModules SET IsEnabled = 0` for the company; log in as its admin | The Service card says "Not subscribed"; the "Administration" button opens Platform Admin |
| 11 | In the copy: set the company's `ProvisionStatus = 'Failed'`, restart the API, log in | The company shows "Setup failed"; opening the module shows "Your company is still being set up. Please try again shortly" on the branch step |
| 12 | Keep a browser tab that was logged in and scoped with the PREVIOUS UI build, deploy this UI, reload the tab | Still inside the app (no module screen) |

Restore every row changed in steps 9 to 11 afterwards.

- [ ] **Step 2: Check script 18 on the main-database copy**

Run script 15, then script 18. Expect its change list and `Connections copied back ...` followed by `This script will not copy again for this cut-over.` Run script 18 again. Expect the message `The connections were already copied back for this cut-over on ...` and no change. Run script 14 again (a new cut-over), then 15, then 18: expect it to copy again.

- [ ] **Step 3: Record the result**

Append a dated "Rehearsal result" section to `EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md` listing which of the checks above passed, and commit it:

```bash
git add EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md
git commit -m "Record the rehearsal of the scope flow and script 18"
```

---

## Deferred

| Item | Plan |
|---|---|
| Platform Admin screens: company database, module switches per company, "project" wording | 2b |
| Module and branch checkboxes in user management and in the invite form; `Invitations` JSON | 2b |
| Customer portal without the project picker; removal of `X-Project-Key`, `GET auth/projects`, `selected_project_id` | 2b |
| Before module switches ship: `sp_Company_GetUsersForSync` must return no company row when the Service module is disabled (new numbered script) | 2b |
| Merging `/no-company` into the company list; Create Company button | 3 |
| "Location" → "Branch" wording inside the business pages | 4 |
