# Branch Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A company administrator decides which branches each member may work in; a member sees and can enter only those branches; administrators have every branch.

**Architecture:** Branches live in each company's own database, so the access rows live there too (a new numbered tenant script). The API asks the company database for "the branches of this user" when listing and when entering; a company database that does not have the new script yet keeps working as today (every branch). Platform Admin gets a Branch Access tab. New company databases get the script automatically: the provisioning worker runs it after the base tenant script.

**Tech Stack:** SQL Server script (tenant database), ASP.NET Core (.NET 10) with ADO.NET, xUnit, Angular 21, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-saas-tenancy-design.md` (decision D11; sections 7.2, 9.2)

**Plan series:** 1, 2, 2b, 3a, 3b done — **4 (this plan)** — 2c (customer portal without the project picker; removal of the "project" layer; wording clean-up)

## Global Constraints

- The SQL Server in `EncryptzAPI/appsettings.json` is LIVE. Only `MainDBEncryptz` and `HamsterserviceDB` may be touched, and only with read-only `SELECT`. Never run a script from this plan or any repo script against it. Never `dotnet run`, never `ng serve`. Do not open or print `appsettings.json`.
- Every SQL change is a NEW file whose name starts with a number. No existing `.sql` file is edited, and `New_Tenant_Database.sql` / `Build-NewTenantScript.ps1` stay exactly as they are. In `EncryptzAPI/Database/ProjectDB/` numbers `00`-`09` are used: this plan adds `10`. In `EncryptzAPI/Database/MainDB/` (frozen through `20`) nothing is added.
- The new tenant script is additive and re-runnable, contains no `USE`, `CREATE DATABASE`, `DROP DATABASE` or `DROP TABLE`, changes no existing table or procedure, and refuses to run in a system database, in the SaaS main database, or in a database without `dbo.Locations`.
- A company database WITHOUT script 10 must keep working with the new API exactly as today (every active branch for every member). The API and the script can be released in either order.
- Access is keyed on the MAIN user id (`MainDB.dbo.Users.UserId`, stored in the tenant database as `Users.MainUserId`) — ruling against the spec's "tenant-local user id": the branch list is needed before the user is mirrored into the company database, and the administrator works with main users.
- Users with company role `Admin` or `CompanyAdmin` have every branch: no rows are stored for them and their access cannot be changed per branch.
- A member whose branches were never set gets every active branch the first time (existing members when the script runs; new members when they first list branches or when an administrator opens Branch Access). After that only an administrator changes it: a branch created later is NOT given to anyone automatically.
- A member with no branch cannot enter the company and sees "No branch assigned".
- Every endpoint added is behind `[Authorize]` + `[PlatformUnlocked]`, takes the company from the route and checks `PlatformActor.CanManageCompany`.
- Messages to users never contain server names, database names or SQL / exception text.
- Visible words: "Branch", never "Location".
- Match the surrounding code style; do not reformat; keep encodings and line endings.
- Commands: from the repository root `dotnet build EncryptzAPI/EncryptzAPI.csproj`, `dotnet test EncryptzTests` (baseline 468 pass); from `encryptzUI`: `npx ng test --watch=false --include "<glob>"` (5-minute timeout, never watch), `npx ng build` (baseline 227 pass; the 5 old placeholder specs fail: `app.spec.ts`, `add-user-component`, `customer-login-component`, `customer-register-component`, `landing-component`).

## Review Focus

1. A company database that does not have script 10: listing branches, entering a branch and the Branch Access tab must not fail with HTTP 500; listing and entering behave as today. Pinned in Task 1 (rule) and Task 4.
2. A member asks `set-scope` for a branch they were not given (by typing the id): refused with "You do not have access to this branch", distinct from an unknown branch. Pinned in Task 1 and Task 4.
3. An administrator removes a member's last branch: the member's branch list is empty and stays empty (it is NOT refilled at the next login). Pinned in Task 2 (script: the "initialised" mark) and Task 7.
4. Two requests initialise the same member at once (member logs in while the administrator opens Branch Access): no duplicate-key error. Pinned in Task 2 (locking).
5. A company administrator tries to change an administrator's branches, or the branches of someone who is not a member, or of a member of another company: refused. Pinned in Task 1 and Task 5.

## File Structure

| File | Responsibility |
|---|---|
| `EncryptzBL/Common/Tenant/BranchAccessRules.cs` (new) + test | Pure rules: who has every branch, refusal texts, building the access view |
| `EncryptzAPI/Database/ProjectDB/10_Branch_Access.sql` (new) | Tables and procedures in a company database |
| `EncryptzAPI/Database/ProjectDB/10_Branch_Access_README.md` (new) | Release notes |
| `EncryptzBL/Common/Provisioning/TenantScript.cs`, `SqlTenantDatabaseServer.cs`, `EncryptzAPI/EncryptzAPI.csproj` | New company databases run script 10 after the base script |
| `EncryptzBL/Infrastructure/User/Modules/AuthService.cs` | Branch list and `set-scope` use the user's branches |
| `EncryptzBL/DTO's/PlatformDtos.cs`, `IPlatformService.cs`, `PlatformService.cs`, `EncryptzAPI/Controllers/PlatformController.cs` | Branch Access API |
| `encryptzUI/src/app/Encryptz/Services/platform-service.ts`, `components/platform-admin-component/*` | Branch Access tab |

---

### Task 1: Branch access rules

**Files:**
- Create: `EncryptzBL/Common/Tenant/BranchAccessRules.cs`
- Create: `EncryptzTests/BranchAccessRulesTests.cs`
- Modify: `EncryptzBL/DTO's/PlatformDtos.cs` (the DTOs below)

**Interfaces:**
- Consumes: `ModuleAccess.IsCompanyAdminRole(string? role)` (existing, `EncryptzBL.Common.Tenant`); `ProjectAccessDto` (existing: `UserId, FullName, Email, RoleInCompany, HasAccess`).
- Produces (DTOs, namespace `EncryptzBL.DTO_s`): `BranchDto { int LocationId; string LocationName; bool IsActive; }`, `BranchAccessUserDto { int UserId; string FullName; string Email; string RoleInCompany; bool AllBranches; List<int> LocationIds; }`, `BranchAccessDto { List<BranchDto> Branches; List<BranchAccessUserDto> Users; }`, `SetBranchAccessRequest { int UserId; int LocationId; bool HasAccess; }`.
- Produces (`BranchAccessRules`): `HasEveryBranch(string? roleInCompany) : bool`; `EntryRefusal(bool branchFound, bool hasAccess) : string?`; `ChangeRefusal(ProjectAccessDto? member, int actorUserId) : string?`; `Build(IEnumerable<ProjectAccessDto> members, IEnumerable<BranchDto> branches, IEnumerable<(int MainUserId, int LocationId)> granted) : BranchAccessDto`; `MemberIdsToInitialise(IEnumerable<ProjectAccessDto> members) : List<int>`; constants `NotInstalledMessage = "Branch access is not set up in this company's database yet"`, `NoAccessMessage = "You do not have access to this branch"`, `UnknownBranchMessage = "Invalid branch for this company"`.

- [ ] **Step 1: Write the failing tests**

Create `EncryptzTests/BranchAccessRulesTests.cs`:

```csharp
using EncryptzBL.Common.Tenant;
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class BranchAccessRulesTests
    {
        private static ProjectAccessDto Member(int id, string role, string name = "U")
            => new() { UserId = id, FullName = name + id, Email = name + id + "@x.test", RoleInCompany = role, HasAccess = true };

        private static BranchDto Branch(int id, bool active = true) => new() { LocationId = id, LocationName = "B" + id, IsActive = active };

        [Theory]
        [InlineData("Admin", true)]
        [InlineData("CompanyAdmin", true)]
        [InlineData(" admin ", true)]
        [InlineData("Technician", false)]
        [InlineData("Manager", false)]
        [InlineData("", false)]
        [InlineData(null, false)]
        public void Administrators_have_every_branch(string? role, bool expected)
        {
            Assert.Equal(expected, BranchAccessRules.HasEveryBranch(role));
        }

        [Fact]
        public void Entering_is_refused_for_an_unknown_branch_and_for_a_branch_not_given()
        {
            Assert.Equal("Invalid branch for this company", BranchAccessRules.EntryRefusal(branchFound: false, hasAccess: false));
            Assert.Equal("Invalid branch for this company", BranchAccessRules.EntryRefusal(branchFound: false, hasAccess: true));
            Assert.Equal("You do not have access to this branch", BranchAccessRules.EntryRefusal(branchFound: true, hasAccess: false));
            Assert.Null(BranchAccessRules.EntryRefusal(branchFound: true, hasAccess: true));
        }

        [Fact]
        public void Only_a_member_who_is_not_an_administrator_can_be_changed()
        {
            Assert.Equal("The user is not an active member of the company", BranchAccessRules.ChangeRefusal(null, actorUserId: 1));
            Assert.Equal("Company administrators have every branch. Change the role instead.", BranchAccessRules.ChangeRefusal(Member(5, "Admin"), 1));
            Assert.Equal("Company administrators have every branch. Change the role instead.", BranchAccessRules.ChangeRefusal(Member(5, "CompanyAdmin"), 1));
            Assert.Null(BranchAccessRules.ChangeRefusal(Member(5, "Technician"), 1));
        }

        [Fact]
        public void The_view_lists_members_with_their_branches_and_marks_administrators()
        {
            var view = BranchAccessRules.Build(
                new[] { Member(3, "Technician", "Zed"), Member(1, "Admin", "Amy"), Member(2, "Manager", "Bob") },
                new[] { Branch(20), Branch(10), Branch(30, active: false) },
                new[] { (2, 10), (2, 20), (3, 20), (3, 999), (77, 10), (1, 10) });

            Assert.Equal(new[] { 20, 10, 30 }, view.Branches.Select(b => b.LocationId));   // order as given
            Assert.Equal(new[] { "Amy1", "Bob2", "Zed3" }, view.Users.Select(u => u.FullName));   // by name

            var amy = view.Users[0];
            Assert.True(amy.AllBranches);
            Assert.Empty(amy.LocationIds);                       // nothing stored or shown per branch for an administrator

            Assert.False(view.Users[1].AllBranches);
            Assert.Equal(new[] { 10, 20 }, view.Users[1].LocationIds);
            Assert.Equal(new[] { 20 }, view.Users[2].LocationIds);   // 999 is not a branch of this company
        }

        [Fact]
        public void A_member_without_any_row_has_no_branch()
        {
            var view = BranchAccessRules.Build(new[] { Member(4, "Technician") }, new[] { Branch(10) }, Array.Empty<(int, int)>());

            Assert.False(view.Users[0].AllBranches);
            Assert.Empty(view.Users[0].LocationIds);
        }

        [Fact]
        public void Only_members_who_are_not_administrators_need_their_first_branches()
        {
            var ids = BranchAccessRules.MemberIdsToInitialise(new[] { Member(1, "Admin"), Member(2, "Technician"), Member(3, "CompanyAdmin"), Member(4, "Manager"), Member(2, "Technician") });

            Assert.Equal(new[] { 2, 4 }, ids);
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test EncryptzTests --filter BranchAccessRulesTests`
Expected: build errors (`BranchAccessRules`, `BranchDto` do not exist).

- [ ] **Step 3: DTOs**

In `EncryptzBL/DTO's/PlatformDtos.cs`, after `SetCompanyModuleRequest` (first namespace block):

```csharp
    /// <summary>A branch of a company (a row of the company database's Locations).</summary>
    public class BranchDto
    {
        public int LocationId { get; set; }
        public string LocationName { get; set; } = "";
        public bool IsActive { get; set; } = true;
    }

    /// <summary>A member and the branches they may work in.</summary>
    public class BranchAccessUserDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string RoleInCompany { get; set; } = "";
        /// <summary>Company administrators: every branch, not changeable per branch.</summary>
        public bool AllBranches { get; set; }
        public List<int> LocationIds { get; set; } = new();
    }

    public class BranchAccessDto
    {
        public List<BranchDto> Branches { get; set; } = new();
        public List<BranchAccessUserDto> Users { get; set; } = new();
    }

    public class SetBranchAccessRequest
    {
        public int UserId { get; set; }
        public int LocationId { get; set; }
        public bool HasAccess { get; set; }
    }
```

- [ ] **Step 4: Rules**

Create `EncryptzBL/Common/Tenant/BranchAccessRules.cs`:

```csharp
using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Which branches of a company a member may work in. The rows live in the
    /// company's own database, keyed on the main user id; company administrators
    /// have every branch and no rows.
    /// </summary>
    public static class BranchAccessRules
    {
        public const string NotInstalledMessage = "Branch access is not set up in this company's database yet";
        public const string NoAccessMessage = "You do not have access to this branch";
        public const string UnknownBranchMessage = "Invalid branch for this company";

        public static bool HasEveryBranch(string? roleInCompany)
            => ModuleAccess.IsCompanyAdminRole(roleInCompany);

        /// <summary>Why a branch cannot be entered; null when it can.</summary>
        public static string? EntryRefusal(bool branchFound, bool hasAccess)
        {
            if (!branchFound) return UnknownBranchMessage;
            return hasAccess ? null : NoAccessMessage;
        }

        /// <summary>Why this member's branches cannot be changed; null when they can.</summary>
        public static string? ChangeRefusal(ProjectAccessDto? member, int actorUserId)
        {
            if (member == null)
                return "The user is not an active member of the company";

            return HasEveryBranch(member.RoleInCompany)
                ? "Company administrators have every branch. Change the role instead."
                : null;
        }

        /// <summary>Members whose first branches the company database must be asked to set (once each).</summary>
        public static List<int> MemberIdsToInitialise(IEnumerable<ProjectAccessDto> members)
            => members.Where(m => !HasEveryBranch(m.RoleInCompany))
                      .Select(m => m.UserId)
                      .Distinct()
                      .OrderBy(id => id)
                      .ToList();

        /// <summary>The Branch Access screen: every member, with the branches given to them.</summary>
        public static BranchAccessDto Build(
            IEnumerable<ProjectAccessDto> members,
            IEnumerable<BranchDto> branches,
            IEnumerable<(int MainUserId, int LocationId)> granted)
        {
            var branchList = branches.ToList();
            var known = branchList.Select(b => b.LocationId).ToHashSet();
            var byUser = granted
                .Where(g => known.Contains(g.LocationId))
                .GroupBy(g => g.MainUserId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.LocationId).Distinct().OrderBy(id => id).ToList());

            var users = members
                .GroupBy(m => m.UserId).Select(g => g.First())
                .OrderBy(m => m.FullName, StringComparer.OrdinalIgnoreCase).ThenBy(m => m.UserId)
                .Select(m =>
                {
                    var all = HasEveryBranch(m.RoleInCompany);
                    return new BranchAccessUserDto
                    {
                        UserId = m.UserId,
                        FullName = m.FullName,
                        Email = m.Email,
                        RoleInCompany = m.RoleInCompany,
                        AllBranches = all,
                        LocationIds = all || !byUser.TryGetValue(m.UserId, out var ids) ? new List<int>() : ids
                    };
                })
                .ToList();

            return new BranchAccessDto { Branches = branchList, Users = users };
        }
    }
}
```

`ModuleAccess.IsCompanyAdminRole` must treat `" admin "` as an administrator for the test above: read it; if it does not trim or ignore case, do the trimming / case-insensitive comparison inside `HasEveryBranch` (do not change `ModuleAccess`) and say so.

- [ ] **Step 5: Run to verify it passes**

Run: `dotnet test EncryptzTests` — expected `Passed!`, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add EncryptzBL/Common/Tenant/BranchAccessRules.cs "EncryptzBL/DTO's/PlatformDtos.cs" EncryptzTests/BranchAccessRulesTests.cs
git commit -m "Add the rules for branch access"
```

---

### Task 2: Tenant script 10 — branch access in a company database

**Files:**
- Create: `EncryptzAPI/Database/ProjectDB/10_Branch_Access.sql`
- Create: `EncryptzAPI/Database/ProjectDB/10_Branch_Access_README.md`
- Read only: `EncryptzAPI/Database/ProjectDB/01_Locations_And_Access.sql`, `04_MainDb_User_Sync.sql`, `05_Scope_RowFilter.sql`, `07_Locations_Admin.sql`; `EncryptzAPI/servicetenantDB.sql` only through `grep` for the definitions of `dbo.Users` and `dbo.Locations` (the file is huge)

**Interfaces:**
- Consumes: tenant tables `dbo.Locations (LocationId, CompanyId, ProjectId, LocationName, LocationCode, City, IsActive)`, `dbo.Users (MainUserId)`.
- Produces (result columns are what Tasks 4 and 5 read):
  - tables `dbo.UserLocationAccess (MainUserId, LocationId, GrantedBy, GrantedAt)` PK (`MainUserId`, `LocationId`); `dbo.UserLocationAccessInit (MainUserId PK, InitializedAt)`
  - `sp_Branch_EnsureInitialised(@CompanyId INT, @ProjectId INT, @MainUserIdsJson NVARCHAR(MAX))` → no result set
  - `sp_Branch_GetForUser(@CompanyId INT, @ProjectId INT, @MainUserId INT, @IsAdmin BIT)` → `LocationId, LocationName, LocationCode, City` (the columns of `sp_Project_GetLocations`)
  - `sp_Branch_ValidateForUser(@CompanyId INT, @ProjectId INT, @LocationId INT, @MainUserId INT, @IsAdmin BIT)` → 0 or 1 row: `LocationId, LocationName, HasAccess BIT`
  - `sp_Branch_GetAccess(@CompanyId INT, @ProjectId INT)` → `MainUserId, LocationId`
  - `sp_Branch_SetAccess(@CompanyId INT, @ProjectId INT, @MainUserId INT, @LocationId INT, @HasAccess BIT, @GrantedBy INT = NULL)` → `Success INT, Message`

- [ ] **Step 1: Write the script**

Create `EncryptzAPI/Database/ProjectDB/10_Branch_Access.sql`:

```sql
/* =============================================================================
   ProjectDB (company database) · Branch access
   -----------------------------------------------------------------------------
   Which branches (dbo.Locations) a member of the company may work in.

   Run in EACH company database (select it in SSMS first; no USE on purpose).
   New company databases created by the API get this script automatically.
   ADDITIVE and SAFE TO RE-RUN: it adds two tables and five procedures and
   changes no existing table, procedure or row. The API deployed before it and
   the API deployed after it both work with or without it.

     dbo.UserLocationAccess      MainUserId + LocationId: the member may work there
     dbo.UserLocationAccessInit  MainUserId: this member's branches were set once

   A member is identified by the MAIN user id (MainDB.dbo.Users.UserId, which is
   dbo.Users.MainUserId here). Company administrators have every branch: the API
   says so with @IsAdmin and nothing is stored for them.

   First branches: a member who has no "set once" mark gets every ACTIVE branch
   and the mark. This happens here for the members that exist now, and later the
   first time a member's branches are asked for. After that only an
   administrator changes them: a branch created later is given to nobody
   automatically, and a member whose last branch was removed stays without one.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

DECLARE @problem NVARCHAR(400);

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
    SET @problem = 'You are connected to [' + DB_NAME() + ']. Select the company database first.';
ELSE IF OBJECT_ID('dbo.Companies') IS NOT NULL AND OBJECT_ID('dbo.CompanyUsers') IS NOT NULL AND OBJECT_ID('dbo.Locations') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is the SaaS main database. Select a company database.';
ELSE IF OBJECT_ID('dbo.Locations') IS NULL OR OBJECT_ID('dbo.Users') IS NULL OR COL_LENGTH('dbo.Users', 'MainUserId') IS NULL
    SET @problem = 'Database [' + DB_NAME() + '] is not a company database with the user mirror (dbo.Locations, dbo.Users.MainUserId). Run the earlier ProjectDB scripts first.';

IF @problem IS NOT NULL
BEGIN
    RAISERROR(@problem, 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. Tables
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.UserLocationAccess') IS NULL
CREATE TABLE dbo.UserLocationAccess
(
    MainUserId INT NOT NULL,                                  -- MainDB.dbo.Users.UserId
    LocationId INT NOT NULL,
    GrantedBy  INT NULL,                                      -- main user id of the administrator; NULL = first branches
    GrantedAt  DATETIME NOT NULL CONSTRAINT DF_ULA_GrantedAt DEFAULT (GETDATE()),
    CONSTRAINT PK_UserLocationAccess PRIMARY KEY (MainUserId, LocationId)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ULA_Location' AND object_id = OBJECT_ID('dbo.UserLocationAccess'))
    CREATE INDEX IX_ULA_Location ON dbo.UserLocationAccess(LocationId);
GO

IF OBJECT_ID('dbo.UserLocationAccessInit') IS NULL
CREATE TABLE dbo.UserLocationAccessInit
(
    MainUserId    INT NOT NULL CONSTRAINT PK_UserLocationAccessInit PRIMARY KEY,
    InitializedAt DATETIME NOT NULL CONSTRAINT DF_ULAI_At DEFAULT (GETDATE())
);
GO

/* -----------------------------------------------------------------------------
   2. First branches of members (once per member)
   ----------------------------------------------------------------------------- */

/* @MainUserIdsJson: a JSON array of main user ids, e.g. [12,15].
   Each member without the "set once" mark gets every active branch of the
   company and the mark. Two calls at the same moment wait for each other. */
CREATE OR ALTER PROCEDURE dbo.sp_Branch_EnsureInitialised
    @CompanyId       INT,
    @ProjectId       INT,
    @MainUserIdsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @new TABLE (MainUserId INT PRIMARY KEY);

    BEGIN TRANSACTION;

    INSERT INTO @new (MainUserId)
    SELECT DISTINCT j.MainUserId
    FROM (SELECT TRY_CAST([value] AS INT) AS MainUserId FROM OPENJSON(ISNULL(@MainUserIdsJson, '[]'))) j
    WHERE j.MainUserId > 0
      AND NOT EXISTS (SELECT 1 FROM dbo.UserLocationAccessInit i WITH (UPDLOCK, HOLDLOCK)
                      WHERE i.MainUserId = j.MainUserId);

    IF EXISTS (SELECT 1 FROM @new)
    BEGIN
        INSERT INTO dbo.UserLocationAccess (MainUserId, LocationId)
        SELECT n.MainUserId, l.LocationId
        FROM @new n
        CROSS JOIN dbo.Locations l
        WHERE l.CompanyId = @CompanyId AND l.ProjectId = @ProjectId AND l.IsActive = 1
          AND NOT EXISTS (SELECT 1 FROM dbo.UserLocationAccess x
                          WHERE x.MainUserId = n.MainUserId AND x.LocationId = l.LocationId);

        INSERT INTO dbo.UserLocationAccessInit (MainUserId)
        SELECT n.MainUserId FROM @new n;
    END

    COMMIT TRANSACTION;
END
GO

/* -----------------------------------------------------------------------------
   3. What the login flow asks
   ----------------------------------------------------------------------------- */

/* The active branches this member may work in (every active branch for an
   administrator). Same columns as sp_Project_GetLocations. */
CREATE OR ALTER PROCEDURE dbo.sp_Branch_GetForUser
    @CompanyId  INT,
    @ProjectId  INT,
    @MainUserId INT,
    @IsAdmin    BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(@IsAdmin, 0) = 0
    BEGIN
        DECLARE @one NVARCHAR(40) = N'[' + CAST(ISNULL(@MainUserId, 0) AS NVARCHAR(20)) + N']';
        EXEC dbo.sp_Branch_EnsureInitialised @CompanyId = @CompanyId, @ProjectId = @ProjectId, @MainUserIdsJson = @one;
    END

    SELECT l.LocationId, l.LocationName, l.LocationCode, l.City
    FROM dbo.Locations l
    WHERE l.CompanyId = @CompanyId
      AND l.ProjectId = @ProjectId
      AND l.IsActive = 1
      AND (   ISNULL(@IsAdmin, 0) = 1
           OR EXISTS (SELECT 1 FROM dbo.UserLocationAccess a
                      WHERE a.MainUserId = @MainUserId AND a.LocationId = l.LocationId))
    ORDER BY l.LocationName;
END
GO

/* One row when the branch belongs to the company and is active; HasAccess tells
   whether this member may work there. No row = no such branch. */
CREATE OR ALTER PROCEDURE dbo.sp_Branch_ValidateForUser
    @CompanyId  INT,
    @ProjectId  INT,
    @LocationId INT,
    @MainUserId INT,
    @IsAdmin    BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(@IsAdmin, 0) = 0
    BEGIN
        DECLARE @one NVARCHAR(40) = N'[' + CAST(ISNULL(@MainUserId, 0) AS NVARCHAR(20)) + N']';
        EXEC dbo.sp_Branch_EnsureInitialised @CompanyId = @CompanyId, @ProjectId = @ProjectId, @MainUserIdsJson = @one;
    END

    SELECT TOP 1 l.LocationId, l.LocationName,
           CAST(CASE WHEN ISNULL(@IsAdmin, 0) = 1
                       OR EXISTS (SELECT 1 FROM dbo.UserLocationAccess a
                                  WHERE a.MainUserId = @MainUserId AND a.LocationId = l.LocationId)
                     THEN 1 ELSE 0 END AS BIT) AS HasAccess
    FROM dbo.Locations l
    WHERE l.LocationId = @LocationId
      AND l.CompanyId  = @CompanyId
      AND l.ProjectId  = @ProjectId
      AND l.IsActive = 1;
END
GO

/* -----------------------------------------------------------------------------
   4. What the administration screen asks
   ----------------------------------------------------------------------------- */

/* Every stored grant for the branches of the company. */
CREATE OR ALTER PROCEDURE dbo.sp_Branch_GetAccess
    @CompanyId INT,
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT a.MainUserId, a.LocationId
    FROM dbo.UserLocationAccess a
    INNER JOIN dbo.Locations l ON l.LocationId = a.LocationId
    WHERE l.CompanyId = @CompanyId AND l.ProjectId = @ProjectId
    ORDER BY a.MainUserId, a.LocationId;
END
GO

/* Give / take one branch of one member. The member's first branches are set
   first (once), so what the administrator saw on the screen is what changes. */
CREATE OR ALTER PROCEDURE dbo.sp_Branch_SetAccess
    @CompanyId  INT,
    @ProjectId  INT,
    @MainUserId INT,
    @LocationId INT,
    @HasAccess  BIT,
    @GrantedBy  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(@MainUserId, 0) <= 0
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'User not found' AS Message; RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Locations
                   WHERE LocationId = @LocationId AND CompanyId = @CompanyId AND ProjectId = @ProjectId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Branch not found' AS Message; RETURN;
    END

    DECLARE @one NVARCHAR(40) = N'[' + CAST(@MainUserId AS NVARCHAR(20)) + N']';
    EXEC dbo.sp_Branch_EnsureInitialised @CompanyId = @CompanyId, @ProjectId = @ProjectId, @MainUserIdsJson = @one;

    IF ISNULL(@HasAccess, 0) = 1
        INSERT INTO dbo.UserLocationAccess (MainUserId, LocationId, GrantedBy)
        SELECT @MainUserId, @LocationId, @GrantedBy
        WHERE NOT EXISTS (SELECT 1 FROM dbo.UserLocationAccess WITH (UPDLOCK, HOLDLOCK)
                          WHERE MainUserId = @MainUserId AND LocationId = @LocationId);
    ELSE
        DELETE FROM dbo.UserLocationAccess
        WHERE MainUserId = @MainUserId AND LocationId = @LocationId;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN ISNULL(@HasAccess, 0) = 1 THEN 'Branch access granted' ELSE 'Branch access removed' END AS Message;
END
GO

/* -----------------------------------------------------------------------------
   5. The members that exist now keep every active branch (once)
   ----------------------------------------------------------------------------- */
BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @existing TABLE (MainUserId INT PRIMARY KEY);

    INSERT INTO @existing (MainUserId)
    SELECT DISTINCT u.MainUserId
    FROM dbo.Users u
    WHERE u.MainUserId IS NOT NULL AND u.MainUserId > 0
      AND NOT EXISTS (SELECT 1 FROM dbo.UserLocationAccessInit i WITH (UPDLOCK, HOLDLOCK)
                      WHERE i.MainUserId = u.MainUserId);

    INSERT INTO dbo.UserLocationAccess (MainUserId, LocationId)
    SELECT e.MainUserId, l.LocationId
    FROM @existing e
    CROSS JOIN dbo.Locations l
    WHERE l.IsActive = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.UserLocationAccess x
                      WHERE x.MainUserId = e.MainUserId AND x.LocationId = l.LocationId);

    INSERT INTO dbo.UserLocationAccessInit (MainUserId)
    SELECT e.MainUserId FROM @existing e;

    DECLARE @members INT = (SELECT COUNT(*) FROM @existing);
    COMMIT TRANSACTION;

    PRINT 'Branch access is in place. Members given every active branch now: ' + CAST(@members AS VARCHAR(12)) + '.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @error NVARCHAR(2048) = ERROR_MESSAGE();
    RAISERROR('Giving the existing members their branches failed and was rolled back. %s', 16, 1, @error);
END CATCH
GO

SET NOEXEC OFF;
GO
```

- [ ] **Step 2: Check the script without running it**

```bash
grep -nEi "^\s*(USE |CREATE DATABASE|DROP DATABASE|DROP TABLE|ALTER TABLE)" EncryptzAPI/Database/ProjectDB/10_Branch_Access.sql
grep -c "^CREATE OR ALTER PROCEDURE" EncryptzAPI/Database/ProjectDB/10_Branch_Access.sql
git status --short EncryptzAPI/Database/
```

Expected: the first prints nothing; the second prints `5`; the third lists only the new file(s).

By reading (use `grep -n "CREATE TABLE \[dbo\].\[Users\]" -A 40 EncryptzAPI/servicetenantDB.sql` and the same for `Locations`, plus `01_Locations_And_Access.sql`, `04_MainDb_User_Sync.sql`, `05_Scope_RowFilter.sql`), verify and write in your report:
1. `dbo.Locations` has `LocationId` (key), `CompanyId`, `ProjectId`, `LocationName`, `LocationCode`, `City`, `IsActive`; `dbo.Users` has `MainUserId` (script 04).
2. Whether `dbo.Locations` or `dbo.Users` is covered by the row-filter security policy of script 05, and what a connection WITHOUT session context (the API's `ExplicitDbHelper` during login, and a person in SSMS) sees: if such a connection sees no rows, the procedures and the step-5 block here would give nobody a branch — report that as BLOCKED with the exact predicate text, do not work around it.
3. `sp_Branch_GetForUser` returns the same four columns in the same order as `sp_Project_GetLocations`.
4. Every batch compiles without relying on an object created in the same batch.

- [ ] **Step 3: Release notes**

Create `EncryptzAPI/Database/ProjectDB/10_Branch_Access_README.md` (style of `EncryptzAPI/Database/MainDB/20_Company_Provisioning_README.md`; every sentence true against the script):

1. **What it is** — branch access per member, stored in each company database. Never executed anywhere yet.
2. **Where and when to run** — in each existing company database (`FelixServiceDB`, `HamsterserviceDB`), before or after the new API: both orders work. Without it the new API behaves as before (every member sees every branch) and the Branch Access tab says it is not set up. New company databases get it from the API.
3. **What happens when it runs** — two tables and five procedures are added; every member that exists in the company database (`Users.MainUserId` not null) gets every active branch and a "set once" mark. Nothing else changes. Re-running changes nothing for members already marked.
4. **Rules** — administrators (`Admin`, `CompanyAdmin`) always have every branch; a new member gets every active branch at their first login; a branch created later is given to nobody until an administrator ticks it in Platform Admin → Branch Access; a member with no branch sees "No branch assigned" and cannot enter.
5. **Undo** — none needed: the previous API ignores the new objects. To switch branch access off for one company database, nothing is dropped by any script here; an owner who wants to remove it drops the five procedures by hand (then the API falls back to "every branch").
6. **Check after running** — `SELECT COUNT(*) FROM dbo.UserLocationAccessInit` equals the number of linked users; log in as a technician and see the same branches as before.
7. **Rehearsal on a copy** — run it; remove one branch from a technician in Branch Access; log in as that technician (the branch is gone; typing its id into `set-scope` is refused with "You do not have access to this branch"); remove their last branch ("No branch assigned", still so after logging in again); add a new branch (only administrators see it); an administrator still sees all.

- [ ] **Step 4: Commit**

```bash
git add EncryptzAPI/Database/ProjectDB/10_Branch_Access.sql EncryptzAPI/Database/ProjectDB/10_Branch_Access_README.md
git commit -m "Add the company-database script for branch access"
```

---

### Task 3: New company databases get the follow-up tenant scripts

**Files:**
- Modify: `EncryptzBL/Common/Provisioning/TenantScript.cs`, `SqlTenantDatabaseServer.cs`
- Modify: `EncryptzAPI/EncryptzAPI.csproj`
- Modify: `EncryptzTests/TenantScriptTests.cs`

**Interfaces:**
- Consumes: `SqlBatchSplitter.Split`; the existing `TenantScript.Parse/Load/LoadLazily/Batches`.
- Produces: `TenantScript.FollowUps : IReadOnlyList<TenantFollowUp>` with `record TenantFollowUp(string FileName, IReadOnlyList<string> Batches)`; `TenantScript.Load(path)` fills it from the files next to the base script whose name is `NN_*.sql` with `NN >= 10`, in number order; `TenantScript.Parse(text)` leaves it empty; `TenantScript.ParseFollowUp(string fileName, string text) : TenantFollowUp` (throws `InvalidOperationException` for a database-level statement or an empty script).

Background. `New_Tenant_Database.sql` is generated from the tenant scripts up to `09` and may not be changed. Scripts added after it (`10_…`) are therefore run by the API right after the base script when it builds a new company database: same connection, batch by batch, any error stops and fails the set-up.

- [ ] **Step 1: Write the failing tests**

Append to the class in `EncryptzTests/TenantScriptTests.cs`:

```csharp
        [Fact]
        public void A_follow_up_script_is_split_into_batches()
        {
            var followUp = TenantScript.ParseFollowUp("10_X.sql", "SELECT 1;\nGO\nSELECT 2;\nGO\n");

            Assert.Equal("10_X.sql", followUp.FileName);
            Assert.Equal(new[] { "SELECT 1;", "SELECT 2;" }, followUp.Batches);
        }

        [Theory]
        [InlineData("")]
        [InlineData("GO\nGO\n")]
        [InlineData("SELECT 1;\nGO\nUSE [master]\nGO\n")]
        [InlineData("CREATE DATABASE X;")]
        [InlineData("DROP DATABASE X;")]
        public void A_follow_up_script_that_is_empty_or_touches_a_database_is_refused(string text)
        {
            Assert.Throws<InvalidOperationException>(() => TenantScript.ParseFollowUp("10_X.sql", text));
        }

        [Fact]
        public void Parsing_text_alone_has_no_follow_ups()
        {
            Assert.Empty(TenantScript.Parse(Script(Settings, "SELECT 1;")).FollowUps);
        }

        [Fact]
        public void Follow_ups_are_the_numbered_scripts_from_10_on_in_number_order()
        {
            var dir = Path.Combine(Path.GetTempPath(), "encryptz-tenant-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(dir);
            try
            {
                File.WriteAllText(Path.Combine(dir, "New_Tenant_Database.sql"), Script(Settings, "SELECT 1;"));
                File.WriteAllText(Path.Combine(dir, "09_Old.sql"), "SELECT 'in the base script already';");
                File.WriteAllText(Path.Combine(dir, "11_Later.sql"), "SELECT 11;");
                File.WriteAllText(Path.Combine(dir, "10_First.sql"), "SELECT 10;\nGO\nSELECT 100;");
                File.WriteAllText(Path.Combine(dir, "10_Branch_Access_README.md"), "not a script");
                File.WriteAllText(Path.Combine(dir, "FelixServiceDB_Migration.sql"), "SELECT 'not numbered';");

                var script = TenantScript.Load(Path.Combine(dir, "New_Tenant_Database.sql"));

                Assert.Equal(new[] { "10_First.sql", "11_Later.sql" }, script.FollowUps.Select(f => f.FileName));
                Assert.Equal(new[] { "SELECT 10;", "SELECT 100;" }, script.FollowUps[0].Batches);
            }
            finally
            {
                Directory.Delete(dir, recursive: true);
            }
        }

        [Fact]
        public void Every_follow_up_script_of_the_repository_is_shipped_and_loads()
        {
            var projectDb = Path.GetDirectoryName(RepositoryScriptPath())!;
            var numbered = Directory.GetFiles(projectDb, "*.sql")
                .Select(Path.GetFileName)
                .Where(name => System.Text.RegularExpressions.Regex.IsMatch(name!, @"^[1-9][0-9]_.*\.sql$"))
                .OrderBy(name => name)
                .ToList();

            Assert.Contains("10_Branch_Access.sql", numbered);

            var csproj = File.ReadAllText(Path.Combine(Path.GetDirectoryName(Path.GetDirectoryName(projectDb)!)!, "EncryptzAPI.csproj"));
            foreach (var name in numbered)
                Assert.Contains(name!, csproj);

            var script = TenantScript.Load(RepositoryScriptPath());
            Assert.Equal(numbered, script.FollowUps.Select(f => f.FileName));
            Assert.All(script.FollowUps, f => Assert.NotEmpty(f.Batches));
        }
```

(The temp-directory test writes outside the repository on purpose and removes what it wrote; `Settings` and `Script(...)` are the helpers already in this test class.)

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test EncryptzTests --filter TenantScriptTests`
Expected: build errors (`ParseFollowUp`, `FollowUps` do not exist).

- [ ] **Step 3: Implement**

In `TenantScript.cs` (read the whole file first; fit the code to it):

```csharp
    /// <summary>A tenant script added after the base script was generated (10_…, 11_…).</summary>
    public sealed record TenantFollowUp(string FileName, IReadOnlyList<string> Batches);
```

(in the namespace, above the class), and in the class:

```csharp
        private static readonly Regex FollowUpName = new(@"^(?<number>[0-9]{2})_.*\.sql\z",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        /// <summary>
        /// Scripts numbered 10 and up that lie next to the base script, in number order.
        /// The base script is generated from the scripts up to 09 and is never changed,
        /// so what comes later is run right after it when a company database is built.
        /// </summary>
        public IReadOnlyList<TenantFollowUp> FollowUps { get; private init; } = Array.Empty<TenantFollowUp>();

        public static TenantFollowUp ParseFollowUp(string fileName, string text)
        {
            var batches = SqlBatchSplitter.Split(text);
            if (batches.Count == 0)
                throw new InvalidOperationException($"The tenant script {fileName} is empty.");

            if (batches.Any(b => DatabaseLevel.IsMatch(b)))
                throw new InvalidOperationException(
                    $"The tenant script {fileName} contains a database-level statement (CREATE/ALTER/DROP DATABASE or USE).");

            return new TenantFollowUp(fileName, batches);
        }
```

Change `Load` so that it also reads the follow-ups:

```csharp
        public static TenantScript Load(string path)
        {
            var script = Parse(File.ReadAllText(path));
            var folder = Path.GetDirectoryName(path);
            if (string.IsNullOrEmpty(folder) || !Directory.Exists(folder))
                return script;

            var followUps = Directory.GetFiles(folder, "*.sql")
                .Select(file => (File: file, Name: Path.GetFileName(file), Match: FollowUpName.Match(Path.GetFileName(file))))
                .Where(x => x.Match.Success && int.Parse(x.Match.Groups["number"].Value) >= 10)
                .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
                .Select(x => ParseFollowUp(x.Name, File.ReadAllText(x.File)))
                .ToList();

            return new TenantScript(script.Batches) { FollowUps = followUps };
        }
```

(`TenantScript`'s constructor is private and takes the batches: keep it.)

In `SqlTenantDatabaseServer.BuildTenantAsync`, after the loop over `script.Batches` and before `VerifyAsync`, run the follow-ups the same way (same connection, same time-out, same cancellation handling, same error wrapping as the base loop — read the existing loop and mirror it):

```csharp
                foreach (var followUp in script.FollowUps)
                {
                    var part = 0;
                    foreach (var batch in followUp.Batches)
                    {
                        part++;
                        ct.ThrowIfCancellationRequested();
                        // … same try / catch as the loop above, with the message:
                        // $"Tenant script {followUp.FileName} batch {part} of {followUp.Batches.Count} failed: {ex.Message}"
                    }
                }
```

In `VerifyAsync` add to the readiness `CASE`: `AND OBJECT_ID('dbo.UserLocationAccess') IS NOT NULL AND OBJECT_ID('dbo.sp_Branch_GetForUser') IS NOT NULL`.

In `EncryptzAPI/EncryptzAPI.csproj`, next to the existing `Content` item of `New_Tenant_Database.sql`:

```xml
    <!-- tenant scripts added after the base script: run right after it for a new company database -->
    <Content Include="Database\ProjectDB\10_Branch_Access.sql" CopyToOutputDirectory="PreserveNewest" CopyToPublishDirectory="PreserveNewest" />
```

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet build EncryptzAPI/EncryptzAPI.csproj 2>&1 | grep -cE " error "` — expected `0`.
Run: `dotnet test EncryptzTests` — expected `Passed!`, 0 failed.
Run: `ls EncryptzAPI/bin/Debug/net10.0/Database/ProjectDB/` — lists `New_Tenant_Database.sql` and `10_Branch_Access.sql`.

- [ ] **Step 5: Release note**

In `EncryptzAPI/Database/MainDB/20_Company_Provisioning_README.md` (not frozen), where it describes what the API does on the server, add one sentence: after `New_Tenant_Database.sql` the API runs the tenant scripts numbered 10 and up that are shipped with it (today `10_Branch_Access.sql`), in number order; a failure in one of them fails the set-up like a failure of the base script.

- [ ] **Step 6: Commit**

```bash
git add EncryptzBL/Common/Provisioning/TenantScript.cs EncryptzBL/Common/Provisioning/SqlTenantDatabaseServer.cs EncryptzAPI/EncryptzAPI.csproj EncryptzTests/TenantScriptTests.cs EncryptzAPI/Database/MainDB/20_Company_Provisioning_README.md
git commit -m "Run the follow-up tenant scripts when a company database is built"
```

---

### Task 4: The branch list and set-scope use the member's branches

**Files:**
- Modify: `EncryptzBL/Infrastructure/User/Modules/AuthService.cs` (`GetLocations`, `SetScope`)
- Create: `EncryptzTests/BranchEntryTests.cs`
- Modify: `EncryptzBL/Common/Tenant/BranchAccessRules.cs` (two small pure helpers, below)

**Interfaces:**
- Consumes: `BranchAccessRules` (Task 1); tenant procedures `sp_Branch_GetForUser`, `sp_Branch_ValidateForUser` (Task 2) and the existing `sp_Project_GetLocations`, `sp_Location_Validate`; `CompanyCreateRules.IsNotInstalled(Exception?)` (existing: SQL error 2812, procedure not found).
- Produces: `BranchAccessRules.ValidationOutcome(DataTable? table, bool newProcedure) : (bool Found, bool HasAccess)`; `BranchAccessRules.IsMissingBranchAccess(Exception? ex) : bool`.

Behaviour:
- `GetLocations(userId, companyId, moduleKey)`: after `ResolveModuleScope`, call `sp_Branch_GetForUser(@CompanyId, @ProjectId = scope.ScopeId, @MainUserId = userId, @IsAdmin = BranchAccessRules.HasEveryBranch(scope.Role))`. If that throws an exception for which `IsMissingBranchAccess` is true (the company database does not have script 10), call the existing `sp_Project_GetLocations` exactly as today. Any other exception keeps today's handling ("Your company database is not reachable right now…").
- `SetScope`: step 2 calls `sp_Branch_ValidateForUser(@CompanyId, @ProjectId, @LocationId, @MainUserId, @IsAdmin)`; fallback to `sp_Location_Validate` in the same way. Then `var (found, hasAccess) = BranchAccessRules.ValidationOutcome(table, newProcedure)` and `var refusal = BranchAccessRules.EntryRefusal(found, hasAccess); if (refusal != null) return Fail(refusal);`. (The text for an unknown branch changes from "Invalid location for this company" to "Invalid branch for this company".)
- Nothing else in `SetScope` changes.

- [ ] **Step 1: Write the failing tests**

Create `EncryptzTests/BranchEntryTests.cs`:

```csharp
using System.Data;
using EncryptzBL.Common.Tenant;
using Xunit;

namespace EncryptzTests
{
    public class BranchEntryTests
    {
        private static DataTable NewShape(bool? hasAccess)
        {
            var table = new DataTable();
            table.Columns.Add("LocationId", typeof(int));
            table.Columns.Add("LocationName", typeof(string));
            table.Columns.Add("HasAccess", typeof(bool));
            if (hasAccess != null) table.Rows.Add(7, "Main", hasAccess.Value);
            return table;
        }

        private static DataTable OldShape(bool row)
        {
            var table = new DataTable();
            table.Columns.Add("LocationId", typeof(int));
            table.Columns.Add("LocationName", typeof(string));
            if (row) table.Rows.Add(7, "Main");
            return table;
        }

        [Fact]
        public void A_branch_the_member_was_given_can_be_entered()
        {
            Assert.Equal((true, true), BranchAccessRules.ValidationOutcome(NewShape(true), newProcedure: true));
        }

        [Fact]
        public void A_branch_the_member_was_not_given_is_found_but_refused()
        {
            Assert.Equal((true, false), BranchAccessRules.ValidationOutcome(NewShape(false), newProcedure: true));
            Assert.Equal("You do not have access to this branch", BranchAccessRules.EntryRefusal(true, false));
        }

        [Fact]
        public void No_row_means_no_such_branch()
        {
            Assert.Equal((false, false), BranchAccessRules.ValidationOutcome(NewShape(null), newProcedure: true));
            Assert.Equal((false, false), BranchAccessRules.ValidationOutcome(null, newProcedure: true));
            Assert.Equal((false, false), BranchAccessRules.ValidationOutcome(OldShape(false), newProcedure: false));
        }

        [Fact]
        public void A_company_database_without_branch_access_lets_every_member_into_every_branch()
        {
            Assert.Equal((true, true), BranchAccessRules.ValidationOutcome(OldShape(true), newProcedure: false));
        }

        [Fact]
        public void A_new_answer_without_the_access_column_is_treated_as_no_access()
        {
            // never fail open when the new procedure answers in an unexpected shape
            Assert.Equal((true, false), BranchAccessRules.ValidationOutcome(OldShape(true), newProcedure: true));
        }

        [Fact]
        public void Only_a_missing_procedure_counts_as_not_installed()
        {
            Assert.False(BranchAccessRules.IsMissingBranchAccess(null));
            Assert.False(BranchAccessRules.IsMissingBranchAccess(new InvalidOperationException("boom")));
            Assert.False(BranchAccessRules.IsMissingBranchAccess(new TimeoutException()));
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test EncryptzTests --filter BranchEntryTests`
Expected: build errors (`ValidationOutcome`, `IsMissingBranchAccess` do not exist).

- [ ] **Step 3: Helpers**

Add to `BranchAccessRules` (with `using System.Data;` and `using EncryptzBL.Common.Provisioning;`):

```csharp
        /// <summary>
        /// The company database does not have the branch-access script yet (the procedure
        /// does not exist): the caller falls back to "every branch", as before the script.
        /// </summary>
        public static bool IsMissingBranchAccess(Exception? ex)
            => CompanyCreateRules.IsNotInstalled(ex);

        /// <summary>
        /// Reads the answer of the branch validation. With the new procedure the row says
        /// whether the member has the branch; with the old one a row means "yes" (that
        /// database has no branch access). An unexpected shape never opens a branch.
        /// </summary>
        public static (bool Found, bool HasAccess) ValidationOutcome(DataTable? table, bool newProcedure)
        {
            if (table == null || table.Rows.Count == 0)
                return (false, false);

            if (!newProcedure)
                return (true, true);

            if (!table.Columns.Contains("HasAccess"))
                return (true, false);

            var value = table.Rows[0]["HasAccess"];
            return (true, value != DBNull.Value && Convert.ToBoolean(value));
        }
```

- [ ] **Step 4: AuthService**

In `AuthService.GetLocations`, replace the body of the `try` that reads `sp_Project_GetLocations` by a call to a new private method, and in `SetScope` replace the body of the `try` that calls `sp_Location_Validate` likewise; keep the surrounding `try/catch`, logging and the messages for other failures:

```csharp
        /// <summary>
        /// The branches of the company this member may work in. A company database without
        /// the branch-access script answers as before it: every active branch.
        /// </summary>
        private static async Task<DataTable?> ReadBranchesAsync(ExplicitDbHelper tenantDb, int companyId, int scopeId, int userId, bool isAdmin)
        {
            try
            {
                return await tenantDb.ExecuteDataTableAsync("sp_Branch_GetForUser", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", companyId),
                    SqlParameterHelper.Input("@ProjectId", scopeId),
                    SqlParameterHelper.Input("@MainUserId", userId),
                    SqlParameterHelper.Input("@IsAdmin", isAdmin)
                });
            }
            catch (Exception ex) when (BranchAccessRules.IsMissingBranchAccess(ex))
            {
                return await tenantDb.ExecuteDataTableAsync("sp_Project_GetLocations", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", companyId),
                    SqlParameterHelper.Input("@ProjectId", scopeId)
                });
            }
        }

        /// <summary>Whether the branch exists and whether this member may work in it.</summary>
        private static async Task<(bool Found, bool HasAccess)> ValidateBranchAsync(ExplicitDbHelper tenantDb, int companyId, int scopeId, int locationId, int userId, bool isAdmin)
        {
            try
            {
                var table = await tenantDb.ExecuteDataTableAsync("sp_Branch_ValidateForUser", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", companyId),
                    SqlParameterHelper.Input("@ProjectId", scopeId),
                    SqlParameterHelper.Input("@LocationId", locationId),
                    SqlParameterHelper.Input("@MainUserId", userId),
                    SqlParameterHelper.Input("@IsAdmin", isAdmin)
                });

                return BranchAccessRules.ValidationOutcome(table, newProcedure: true);
            }
            catch (Exception ex) when (BranchAccessRules.IsMissingBranchAccess(ex))
            {
                var table = await tenantDb.ExecuteDataTableAsync("sp_Location_Validate", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", companyId),
                    SqlParameterHelper.Input("@ProjectId", scopeId),
                    SqlParameterHelper.Input("@LocationId", locationId)
                });

                return BranchAccessRules.ValidationOutcome(table, newProcedure: false);
            }
        }
```

In `GetLocations`: `dt = await ReadBranchesAsync(tenantDb, companyId, scope.ScopeId, userId, BranchAccessRules.HasEveryBranch(scope.Role));`.

In `SetScope`: declare `(bool Found, bool HasAccess) branch;` before the `try`, set it inside with `ValidateBranchAsync(...)`, and replace the check `if (vl == null || vl.Rows.Count == 0) return Fail("Invalid location for this company");` by:

```csharp
            var branchRefusal = BranchAccessRules.EntryRefusal(branch.Found, branch.HasAccess);
            if (branchRefusal != null)
                return ApiResponse<LoginResponseDto>.Fail(branchRefusal);
```

Check how `SqlDbHelper.ExecuteDataTableAsync` surfaces a missing procedure: `IsMissingBranchAccess` needs the `SqlException` itself (number 2812). If the helper wraps exceptions, make `IsMissingBranchAccess` also look at `ex.InnerException`, add a test for a wrapped exception if one can be built, and say so.

- [ ] **Step 5: Run to verify it passes**

Run: `dotnet build EncryptzAPI/EncryptzAPI.csproj 2>&1 | grep -cE " error "` — expected `0`.
Run: `dotnet test EncryptzTests` — expected `Passed!`, 0 failed.
Run: `grep -rn "Invalid location for this company" EncryptzBL EncryptzAPI --include=*.cs` — prints nothing.

- [ ] **Step 6: Commit**

```bash
git add EncryptzBL/Infrastructure/User/Modules/AuthService.cs EncryptzBL/Common/Tenant/BranchAccessRules.cs EncryptzTests/BranchEntryTests.cs
git commit -m "List and enter only the branches a member was given"
```

---

### Task 5: Branch Access API in Platform Admin

**Files:**
- Modify: `EncryptzBL/Infrastructure/User/Modules/IPlatformService.cs`, `PlatformService.cs`
- Modify: `EncryptzAPI/Controllers/PlatformController.cs`
- Create: `EncryptzTests/PlatformBranchAccessEndpointsTests.cs`

**Interfaces:**
- Consumes: `BranchAccessRules`, the DTOs of Task 1; tenant procedures `sp_Location_GetAll` (existing), `sp_Branch_EnsureInitialised`, `sp_Branch_GetAccess`, `sp_Branch_SetAccess` (Task 2); main-database `sp_Platform_GetModuleAccess(@CompanyId, @ModuleKey)` (script 19: the active members with `RoleInCompany`); existing `PlatformService` members `GetManagedProject(projectId, actor)` (the id is the company id), `OpenProjectDb(projectKey)`, `ToFlag`, `NotAllowed`, `_logger`; `ModuleAdminRules.CanManageAccess(actor, companyId)`; `ModuleAccess.ServiceModuleKey`.
- Produces: `IPlatformService.GetBranchAccess(int companyId, PlatformActor actor) : Task<ApiResponse<BranchAccessDto>>`, `SetBranchAccess(int companyId, SetBranchAccessRequest req, PlatformActor actor) : Task<ApiResponse<bool>>`; endpoints `GET api/platform/companies/{companyId}/branch-access`, `POST api/platform/companies/{companyId}/branch-access` (both `[PlatformUnlocked]`).

- [ ] **Step 1: Write the failing test**

Create `EncryptzTests/PlatformBranchAccessEndpointsTests.cs`:

```csharp
using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace EncryptzTests
{
    public class PlatformBranchAccessEndpointsTests
    {
        private static MethodInfo Action(string name)
            => typeof(PlatformController).GetMethod(name)
               ?? throw new Xunit.Sdk.XunitException($"PlatformController.{name} does not exist");

        [Theory]
        [InlineData("GetBranchAccess", "GET")]
        [InlineData("SetBranchAccess", "POST")]
        public void The_branch_access_endpoints_exist_behind_the_platform_unlock(string action, string verb)
        {
            var http = Action(action).GetCustomAttributes().OfType<HttpMethodAttribute>().Single();

            Assert.Contains(verb, http.HttpMethods);
            Assert.Equal("companies/{companyId}/branch-access", http.Template);
            Assert.NotNull(Action(action).GetCustomAttribute<PlatformUnlockedAttribute>());
        }

        [Theory]
        [InlineData("GetBranchAccess")]
        [InlineData("SetBranchAccess")]
        public void The_company_comes_from_the_route(string action)
        {
            var companyId = Action(action).GetParameters().Single(p => p.Name == "companyId");

            Assert.Equal(typeof(int), companyId.ParameterType);
            Assert.Null(companyId.GetCustomAttribute<FromBodyAttribute>());
            Assert.Null(companyId.GetCustomAttribute<FromQueryAttribute>());
        }

        [Fact]
        public void The_request_names_no_company()
        {
            Assert.DoesNotContain(typeof(EncryptzBL.DTO_s.SetBranchAccessRequest).GetProperties(),
                p => p.Name.Contains("Company", StringComparison.OrdinalIgnoreCase));
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test EncryptzTests --filter PlatformBranchAccessEndpointsTests`
Expected: FAIL, `PlatformController.GetBranchAccess does not exist`.

- [ ] **Step 3: Service**

In `IPlatformService.cs`, after the module methods:

```csharp
        Task<ApiResponse<BranchAccessDto>> GetBranchAccess(int companyId, PlatformActor actor);
        Task<ApiResponse<bool>> SetBranchAccess(int companyId, SetBranchAccessRequest req, PlatformActor actor);
```

In `PlatformService.cs` (read `GetLocations`, `GetManagedProject`, `OpenProjectDb`, `GetModuleAccess` first and use their real shapes; `System.Text.Json` for the id list), add after the module region:

```csharp
        // ============================================
        // BRANCH ACCESS (rows live in the company's own database)
        // ============================================

        /// <summary>The active members of the company, with their role in it.</summary>
        private Task<List<ProjectAccessDto>> GetMembersAsync(int companyId)
            => GetListAsync<ProjectAccessDto>("sp_Platform_GetModuleAccess", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ModuleKey", ModuleAccess.ServiceModuleKey)
            });

        public async Task<ApiResponse<BranchAccessDto>> GetBranchAccess(int companyId, PlatformActor actor)
        {
            if (!ModuleAdminRules.CanManageAccess(actor, companyId))
                return ApiResponse<BranchAccessDto>.Fail(NotAllowed);

            var project = await GetManagedProject(companyId, actor);
            if (project == null)
                return ApiResponse<BranchAccessDto>.Fail(NotAllowed);

            var members = await GetMembersAsync(companyId);

            try
            {
                var db = await OpenProjectDb(project.Value.ProjectKey);
                var scope = new[]
                {
                    SqlParameterHelper.Input("@CompanyId", project.Value.CompanyId),
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId)
                };

                var branches = (await db.ExecuteDataTableAsync("sp_Location_GetAll", scope)).ToList<BranchDto>();

                // members who were never given branches get every active one now (once),
                // so the screen shows what they would get at their first login
                await db.ExecuteAsync("sp_Branch_EnsureInitialised", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", project.Value.CompanyId),
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId),
                    SqlParameterHelper.Input("@MainUserIdsJson", JsonSerializer.Serialize(BranchAccessRules.MemberIdsToInitialise(members)))
                });

                var granted = await db.ExecuteDataTableAsync("sp_Branch_GetAccess", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", project.Value.CompanyId),
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId)
                });

                var pairs = granted.Rows.Cast<DataRow>()
                    .Select(r => (Convert.ToInt32(r["MainUserId"]), Convert.ToInt32(r["LocationId"])));

                return ApiResponse<BranchAccessDto>.Ok(BranchAccessRules.Build(members, branches, pairs));
            }
            catch (Exception ex) when (BranchAccessRules.IsMissingBranchAccess(ex))
            {
                return ApiResponse<BranchAccessDto>.Fail(BranchAccessRules.NotInstalledMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Company database access failed for company {CompanyId}", companyId);
                return ApiResponse<BranchAccessDto>.Fail("Could not read the company database");
            }
        }

        public async Task<ApiResponse<bool>> SetBranchAccess(int companyId, SetBranchAccessRequest req, PlatformActor actor)
        {
            if (!ModuleAdminRules.CanManageAccess(actor, companyId))
                return ApiResponse<bool>.Fail(NotAllowed);

            if (req == null || req.UserId <= 0 || req.LocationId <= 0)
                return ApiResponse<bool>.Fail("Branch or user not found");

            var project = await GetManagedProject(companyId, actor);
            if (project == null)
                return ApiResponse<bool>.Fail(NotAllowed);

            // the member list is the main database's: a user of another company is not in it
            var member = (await GetMembersAsync(companyId)).FirstOrDefault(m => m.UserId == req.UserId);
            var refusal = BranchAccessRules.ChangeRefusal(member, actor.UserId);
            if (refusal != null)
                return ApiResponse<bool>.Fail(refusal);

            try
            {
                var db = await OpenProjectDb(project.Value.ProjectKey);
                var dt = await db.ExecuteDataTableAsync("sp_Branch_SetAccess", new[]
                {
                    SqlParameterHelper.Input("@CompanyId", project.Value.CompanyId),
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId),
                    SqlParameterHelper.Input("@MainUserId", req.UserId),
                    SqlParameterHelper.Input("@LocationId", req.LocationId),
                    SqlParameterHelper.Input("@HasAccess", req.HasAccess),
                    SqlParameterHelper.Input("@GrantedBy", actor.UserId)
                });

                return ToFlag(dt);
            }
            catch (Exception ex) when (BranchAccessRules.IsMissingBranchAccess(ex))
            {
                return ApiResponse<bool>.Fail(BranchAccessRules.NotInstalledMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Company database access failed for company {CompanyId}", companyId);
                return ApiResponse<bool>.Fail("Could not save to the company database");
            }
        }
```

Notes: use the tenant helper's real non-query method name for `sp_Branch_EnsureInitialised` (it returns no result set); `sp_Location_GetAll` returns `LocationId, LocationName, …, IsActive`, which `ToList<BranchDto>()` maps by name. `GetManagedProject` already checks that the actor may manage the company and that it has a database; keep both checks.

- [ ] **Step 4: Controller**

In `PlatformController.cs`, after the module endpoints:

```csharp
        // ── BRANCH ACCESS ─────────────────────────

        [PlatformUnlocked]
        [HttpGet("companies/{companyId}/branch-access")]
        public async Task<IActionResult> GetBranchAccess(int companyId)
            => Ok(await _service.GetBranchAccess(companyId, Actor()));

        [PlatformUnlocked]
        [HttpPost("companies/{companyId}/branch-access")]
        public async Task<IActionResult> SetBranchAccess(int companyId, [FromBody] SetBranchAccessRequest req)
            => Ok(await _service.SetBranchAccess(companyId, req, Actor()));
```

- [ ] **Step 5: Run to verify it passes**

Run: `dotnet build EncryptzAPI/EncryptzAPI.csproj 2>&1 | grep -cE " error "` — expected `0`.
Run: `dotnet test EncryptzTests` — expected `Passed!`, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add EncryptzBL/Infrastructure/User/Modules/IPlatformService.cs EncryptzBL/Infrastructure/User/Modules/PlatformService.cs EncryptzAPI/Controllers/PlatformController.cs EncryptzTests/PlatformBranchAccessEndpointsTests.cs
git commit -m "Add the Branch Access API to Platform Admin"
```

---

### Task 6: Branch Access tab in Platform Admin

**Files:**
- Modify: `encryptzUI/src/app/Encryptz/Services/platform-service.ts`
- Modify: `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.ts`, `.html`, `.scss`, `.spec.ts`

**Interfaces:**
- Consumes: the endpoints of Task 5; the component's existing shared company picker (`selectedProjectId()` IS a company id), the shared tab subscription and its "pending" flag, `redraw(event, checked)`, `notify`, `fail`, `isLocked`, `message`, `setTab`.
- Produces in `platform-service.ts`: `interface Branch { locationId: number; locationName: string; isActive: boolean; }`, `interface BranchAccessUser { userId: number; fullName: string; email: string; roleInCompany: string; allBranches: boolean; locationIds: number[]; }`, `interface BranchAccess { branches: Branch[]; users: BranchAccessUser[]; }`; `getBranchAccess(companyId): Observable<ApiResponse<BranchAccess>>`, `setBranchAccess(companyId, userId, locationId, hasAccess): Observable<ApiResponse<boolean>>`.
- Produces on the component: tab id `'branchAccess'`; `branchAccess = signal<BranchAccess | null>(null)`; `branchAccessNote = signal('')`; `hasBranch(user, branch): boolean`; `toggleBranch(user, branch, event?)`; `branchBusy = signal<ReadonlySet<string>>`.

Behaviour:
1. A tab "Branch Access" after "Branches", for everyone who can open Platform Admin (company administrators manage their own company). It uses the same company picker as Branches and Module Access.
2. A table: one row per member (name, e-mail, role), one column per ACTIVE branch with a checkbox. A company administrator's row shows "All branches" across the branch columns (no checkboxes). A member with no ticked branch shows the text "No branch — cannot enter" under the name.
3. Ticking calls `setBranchAccess`; one request at a time per cell (key `companyId|userId|locationId`), the checkbox is disabled meanwhile; on refusal or error the checkbox goes back (`redraw`) and the message is shown (toast); on success the model is updated without a reload.
4. A refused load whose message is "Branch access is not set up in this company's database yet" is shown as a note in place of the table (not as an error toast), with the extra sentence "Until then every member can work in every branch."
5. Loads run under the shared tab subscription (a late answer after another company or tab was picked is ignored). A late answer of a toggle after the company changed does not touch the new company's model.
6. No company picked → the existing "Select a company." hint. No active branch → "No active branch yet." The wording test of the Module Access tab keeps passing; this tab shows neither "Project" nor "Location".

- [ ] **Step 1: Write the failing tests**

Append a `describe` to `platform-admin-component.spec.ts` (reuse the file's existing style; the stubs below are complete for this describe):

```ts
describe('PlatformAdminComponent branch access', () => {
  const project = { projectId: 2, companyId: 2, companyName: 'Hamster A/C', projectName: 'Service Management', projectKey: 'C002-P001', isActive: true, serverName: '', databaseName: '', dbUser: '', extraOptions: '' };
  const other = { ...project, projectId: 3, companyId: 3, companyName: 'Other Co' };
  const view = () => ({
    branches: [{ locationId: 10, locationName: 'Main', isActive: true }, { locationId: 20, locationName: 'North', isActive: true }, { locationId: 30, locationName: 'Closed', isActive: false }],
    users: [
      { userId: 1, fullName: 'Amy Admin', email: 'amy@x.test', roleInCompany: 'Admin', allBranches: true, locationIds: [] },
      { userId: 8, fullName: 'Tech T', email: 't@x.test', roleInCompany: 'Technician', allBranches: false, locationIds: [10] },
      { userId: 9, fullName: 'New N', email: 'n@x.test', roleInCompany: 'Manager', allBranches: false, locationIds: [] },
    ],
  });

  let api: any;
  let calls: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PlatformAdminComponent],
      providers: [
        { provide: PlatformService, useValue: api },
        { provide: AuthService, useValue: { currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin: false }), selectedCompanyId: () => 2 } },
      ],
    });
    const fixture = TestBed.createComponent(PlatformAdminComponent);
    fixture.detectChanges();
    fixture.componentInstance.setTab('branchAccess' as any);
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: any) => fixture.nativeElement.textContent as string;
  const boxes = (fixture: any) => Array.from(fixture.nativeElement.querySelectorAll('.pa-branch-table input[type=checkbox]')) as HTMLInputElement[];

  beforeEach(() => {
    calls = [];
    api = {
      isUnlocked: () => of({ success: true, unlocked: true }),
      getCompanies: () => of({ success: true, message: '', data: [] }),
      getProjects: () => of({ success: true, message: '', data: [project, other] }),
      getBranchAccess: (companyId: number) => { calls.push(['getBranchAccess', companyId]); return of({ success: true, message: '', data: view() }); },
      setBranchAccess: (companyId: number, userId: number, locationId: number, on: boolean) => { calls.push(['setBranchAccess', companyId, userId, locationId, on]); return of({ success: true, message: on ? 'Branch access granted' : 'Branch access removed', data: true }); },
      lock: () => {},
    };
  });

  it('is offered as a tab and loads the company being worked in', () => {
    const fixture = create();
    const tabs = (Array.from(fixture.nativeElement.querySelectorAll('.pa-tabs button')) as HTMLButtonElement[]).map(b => b.textContent?.trim());

    expect(tabs).toContain('Branch Access');
    expect(calls).toContainEqual(['getBranchAccess', 2]);
  });

  it('shows a column per active branch and a row per member', () => {
    const fixture = create();
    const head = Array.from(fixture.nativeElement.querySelectorAll('.pa-branch-table thead th')).map((th: any) => th.textContent.trim());

    expect(head).toContain('Main');
    expect(head).toContain('North');
    expect(head).not.toContain('Closed');
    expect(fixture.nativeElement.querySelectorAll('.pa-branch-table tbody tr').length).toBe(3);
  });

  it('shows an administrator as having all branches, without checkboxes', () => {
    const fixture = create();
    const row = fixture.nativeElement.querySelectorAll('.pa-branch-table tbody tr')[0] as HTMLElement;

    expect(row.textContent).toContain('All branches');
    expect(row.querySelectorAll('input[type=checkbox]').length).toBe(0);
  });

  it('ticks the branches a member has and warns when a member has none', () => {
    const fixture = create();
    const all = boxes(fixture);   // Tech T: Main, North; New N: Main, North

    expect(all.map(b => b.checked)).toEqual([true, false, false, false]);
    expect(text(fixture)).toContain('No branch — cannot enter');
  });

  it('gives a member a branch', () => {
    const fixture = create();
    boxes(fixture)[1].click();   // Tech T, North
    fixture.detectChanges();

    expect(calls).toContainEqual(['setBranchAccess', 2, 8, 20, true]);
    expect(fixture.componentInstance.branchAccess()!.users[1].locationIds).toEqual([10, 20]);
  });

  it('takes a branch away and then warns that the member cannot enter', () => {
    const fixture = create();
    boxes(fixture)[0].click();   // Tech T, Main
    fixture.detectChanges();

    expect(calls).toContainEqual(['setBranchAccess', 2, 8, 10, false]);
    expect(fixture.componentInstance.branchAccess()!.users[1].locationIds).toEqual([]);
    expect((fixture.nativeElement.querySelectorAll('.pa-branch-table tbody tr')[1] as HTMLElement).textContent).toContain('No branch — cannot enter');
  });

  it('puts the checkbox back and says why when the server refuses', () => {
    api.setBranchAccess = () => of({ success: false, message: 'Company administrators have every branch. Change the role instead.', data: false });
    const fixture = create();
    const box = boxes(fixture)[1];
    box.click();
    fixture.detectChanges();

    expect(box.checked).toBe(false);
    expect(text(fixture)).toContain('Company administrators have every branch');
    expect(fixture.componentInstance.branchAccess()!.users[1].locationIds).toEqual([10]);
  });

  it('sends one request while a cell is being saved', () => {
    const pending = new Subject<any>();
    api.setBranchAccess = (companyId: number, userId: number, locationId: number, on: boolean) => { calls.push(['setBranchAccess', companyId, userId, locationId, on]); return pending; };
    const fixture = create();
    const c = fixture.componentInstance;
    const data = c.branchAccess()!;

    c.toggleBranch(data.users[1], data.branches[1]);
    c.toggleBranch(data.users[1], data.branches[1]);
    fixture.detectChanges();

    expect(calls.filter(x => x[0] === 'setBranchAccess').length).toBe(1);
    expect(boxes(fixture)[1].disabled).toBe(true);

    pending.next({ success: true, message: 'ok', data: true });
    pending.complete();
    fixture.detectChanges();
    expect(boxes(fixture)[1].disabled).toBe(false);
  });

  it('says so when the company database has no branch access yet', () => {
    api.getBranchAccess = () => of({ success: false, message: "Branch access is not set up in this company's database yet", data: null });
    const fixture = create();

    expect(text(fixture)).toContain("Branch access is not set up in this company's database yet");
    expect(text(fixture)).toContain('Until then every member can work in every branch.');
    expect(fixture.nativeElement.querySelector('.pa-branch-table')).toBeNull();
  });

  it('ignores a late answer after another company was picked', () => {
    const late = new Subject<any>();
    api.getBranchAccess = (companyId: number) => {
      calls.push(['getBranchAccess', companyId]);
      return companyId === 2 ? late : of({ success: true, message: '', data: { branches: [], users: [] } });
    };
    const fixture = create();
    fixture.componentInstance.onProjectPicked(3);
    late.next({ success: true, message: '', data: view() });
    fixture.detectChanges();

    expect(fixture.componentInstance.branchAccess()!.users.length).toBe(0);
  });

  it('never says Project or Location', () => {
    const fixture = create();
    expect(text(fixture)).not.toMatch(/Project/i);
    expect(text(fixture)).not.toMatch(/Location/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/Encryptz/components/platform-admin-component/**/*.spec.ts" 2>&1 | tail -25`
Expected: build errors (`branchAccess`, `toggleBranch` do not exist).

- [ ] **Step 3: Service**

In `platform-service.ts` add the three interfaces after `PlatformSetting` and, after `setModuleAccess`:

```ts
  // ── branch access (rows live in the company's own database) ───────────────

  getBranchAccess(companyId: number): Observable<ApiResponse<BranchAccess>> {
    return this.http.get<ApiResponse<BranchAccess>>(`${this.api}/companies/${companyId}/branch-access`, { headers: this.headers });
  }

  setBranchAccess(companyId: number, userId: number, locationId: number, hasAccess: boolean): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/companies/${companyId}/branch-access`, { userId, locationId, hasAccess }, { headers: this.headers });
  }
```

- [ ] **Step 4: Component**

Read the component fully first: the Branches / Module Access tabs share a company picker, a `loadProjectData()` that loads per tab under one shared subscription with a pending flag, and `setTab` that defaults the picked company. Add `'branchAccess'` to the `Tab` type and treat it like the other two picker tabs everywhere they are named together (`setTab`, the template block, `relock` clearing). Then:

```ts
  /** Branch Access tab: the members of the picked company and their branches (null = not loaded). */
  branchAccess = signal<BranchAccess | null>(null);
  /** Shown in place of the table (e.g. the company database has no branch access yet). */
  branchAccessNote = signal('');
  branchBusy = signal<ReadonlySet<string>>(new Set());

  activeBranches = computed(() => (this.branchAccess()?.branches ?? []).filter(b => b.isActive));

  private branchKey(companyId: number, userId: number, locationId: number): string {
    return `${companyId}|${userId}|${locationId}`;
  }

  branchCellBusy(user: BranchAccessUser, branch: Branch): boolean {
    return this.branchBusy().has(this.branchKey(this.selectedProjectId() ?? 0, user.userId, branch.locationId));
  }

  hasBranch(user: BranchAccessUser, branch: Branch): boolean {
    return user.locationIds.includes(branch.locationId);
  }

  /** A member without any active branch cannot enter the company. */
  hasNoBranch(user: BranchAccessUser): boolean {
    return !user.allBranches && !this.activeBranches().some(b => user.locationIds.includes(b.locationId));
  }

  toggleBranch(user: BranchAccessUser, branch: Branch, event?: Event): void {
    const companyId = this.selectedProjectId();
    const had = this.hasBranch(user, branch);
    if (!companyId || user.allBranches) { this.redraw(event, had); return; }

    const key = this.branchKey(companyId, user.userId, branch.locationId);
    if (this.branchBusy().has(key)) { this.redraw(event, had); return; }

    const grant = !had;
    this.branchBusy.update(set => new Set(set).add(key));
    this.api.setBranchAccess(companyId, user.userId, branch.locationId, grant).pipe(
      finalize(() => this.branchBusy.update(set => { const next = new Set(set); next.delete(key); return next; })),
    ).subscribe({
      next: res => {
        this.notify(res.message, res.success);
        if (!res.success) { this.redraw(event, had); return; }
        // the answer belongs to the company it was sent for
        if (this.selectedProjectId() !== companyId) return;
        this.branchAccess.update(data => data && ({
          ...data,
          users: data.users.map(u => u.userId !== user.userId ? u : {
            ...u,
            locationIds: grant
              ? [...u.locationIds.filter(id => id !== branch.locationId), branch.locationId].sort((a, b) => a - b)
              : u.locationIds.filter(id => id !== branch.locationId),
          }),
        }));
      },
      error: err => {
        this.redraw(event, had);
        if (this.isLocked(err)) return;
        this.notify(this.message(err, 'Could not change branch access'), false);
      },
    });
  }
```

In `loadProjectData()` add the branch for this tab, under the same shared subscription and pending flag the other two branches use (mirror the Module Access branch):

```ts
      this.branchAccess.set(null);
      this.branchAccessNote.set('');
      // … this.tabSub = this.api.getBranchAccess(companyId).subscribe({
        next: res => {
          // … clear the pending / loading flags as the other branches do …
          if (res.success) { this.branchAccess.set(res.data ?? { branches: [], users: [] }); return; }
          // "not set up yet" is a state of the company database, not an error
          this.branchAccessNote.set(res.message || 'Could not load branch access');
        },
        error: err => this.fail(err, 'Could not load branch access'),
      // });
```

`finalize` comes from `rxjs` (the file already imports it for the module switches; check). `relock()` also sets `branchAccess` to null and clears `branchBusy` and `branchAccessNote`.

- [ ] **Step 5: Template and styles**

Tab button after the Branches tab button:

```html
    <button [class.active]="tab() === 'branchAccess'" (click)="setTab('branchAccess')">Branch Access</button>
```

The block that renders the Branches / Module Access tabs with the shared company picker: include `'branchAccess'` in its `@if`, give it the title `Who can work in which branch`, a count of `{{ branchAccess()?.users?.length ?? 0 }}`, and add this branch to its body (after the Module Access table, same `@else if` chain; adapt the surrounding conditions to the real template):

```html
      } @else if (tab() === 'branchAccess') {
        @if (branchAccessNote()) {
          <div class="pa-hint">{{ branchAccessNote() }} Until then every member can work in every branch.</div>
        } @else if (branchAccess(); as ba) {
          @if (activeBranches().length === 0) {
            <div class="pa-hint">No active branch yet.</div>
          } @else {
            <table class="fx-table pa-branch-table">
              <thead>
                <tr>
                  <th>User</th><th>Role in company</th>
                  @for (b of activeBranches(); track b.locationId) { <th class="pa-branch-col">{{ b.locationName }}</th> }
                </tr>
              </thead>
              <tbody>
                @for (u of ba.users; track u.userId) {
                  <tr>
                    <td>
                      <strong>{{ u.fullName }}</strong>
                      <div class="pa-sub">{{ u.email }}</div>
                      @if (hasNoBranch(u)) { <div class="pa-sub pa-warn">No branch — cannot enter</div> }
                    </td>
                    <td><span class="fx-badge">{{ u.roleInCompany }}</span></td>
                    @if (u.allBranches) {
                      <td [attr.colspan]="activeBranches().length">All branches</td>
                    } @else {
                      @for (b of activeBranches(); track b.locationId) {
                        <td class="pa-branch-col">
                          <input type="checkbox" [checked]="hasBranch(u, b)" [disabled]="branchCellBusy(u, b)"
                                 [attr.aria-label]="b.locationName + ' for ' + u.fullName" (change)="toggleBranch(u, b, $event)" />
                        </td>
                      }
                    }
                  </tr>
                } @empty {
                  <tr class="fx-empty-row"><td [attr.colspan]="2 + activeBranches().length">{{ loading() ? 'Loading…' : 'The company has no members yet' }}</td></tr>
                }
              </tbody>
            </table>
            <div class="pa-hint">Company administrators always have every branch. A branch created later is given to nobody until it is ticked here.</div>
          }
        }
      }
```

The existing note of the "refused load" test expects the note text followed by "Until then every member can work in every branch."; show that second sentence only when the note is the "not set up" message (compare with the exact text `Branch access is not set up in this company's database yet`), otherwise only the note.

Append to the `.scss`: `.pa-branch-col { text-align: center; white-space: nowrap; }`.

- [ ] **Step 6: Run to verify it passes**

```bash
npx ng test --watch=false --include "src/app/Encryptz/components/platform-admin-component/**/*.spec.ts" 2>&1 | tail -25
npx ng build 2>&1 | tail -6
npx ng test --watch=false 2>&1 | grep -E "Test Files|Tests |FAIL" | sort -u
```

Expected: the platform admin spec passes (the 61 earlier tests and every new one); no build errors; the whole suite fails only in the 5 old placeholder specs.

- [ ] **Step 7: Commit**

```bash
git add encryptzUI/src/app/Encryptz/Services/platform-service.ts encryptzUI/src/app/Encryptz/components/platform-admin-component
git commit -m "Add the Branch Access tab to Platform Admin"
```

---

### Task 7: Verification with a running API (owner-gated)

Needs an API connected to COPIES of the main database and of one company database that may be written to. **Stop here and ask the owner.** Until then report Tasks 1 to 6 as "implemented and unit-tested; never run against a database".

| # | Do | Expect |
|---|---|---|
| 1 | New API, company-database copy WITHOUT script 10: log in as a technician | the same branches as before; Platform Admin → Branch Access says it is not set up yet and that every member can work in every branch |
| 2 | Run `10_Branch_Access.sql` on the company-database copy | "Branch access is in place. Members given every active branch now: N."; run it again: N is 0 |
| 3 | Branch Access as a company administrator | every member with every active branch ticked; administrators "All branches" |
| 4 | Untick one branch of a technician; log in as that technician | that branch is not listed; `POST auth/set-scope` with its id answers "You do not have access to this branch"; an id that does not exist answers "Invalid branch for this company" |
| 5 | Untick the technician's last branch | "No branch — cannot enter" in the tab; the technician sees "No branch assigned"; after logging in again still so |
| 6 | Add a new branch (Branches tab) | only administrators can pick it; ticking it for the technician makes it appear |
| 7 | Invite a new member, accept, log in | the member gets every active branch at the first login (one time) |
| 8 | Call `POST api/platform/companies/<other company>/branch-access` as a company administrator | "You are not allowed to manage this" |
| 9 | Try to change an Admin's branch by API | "Company administrators have every branch. Change the role instead." |
| 10 | Create a new company through the API (Plan 3a rehearsal) | its database has `dbo.UserLocationAccess`; the creator (Admin) enters; Branch Access works |

Record the outcome in `EncryptzAPI/Database/ProjectDB/10_Branch_Access_README.md` under "Rehearsal" and commit.

---

## Deferred

| Item | Plan |
|---|---|
| Choosing branches (and modules) at invite time; today a new member gets every active branch at the first login | 2c |
| Branch access inside the Access Management / user screens (it is in Platform Admin → Branch Access, which company administrators can open) | 2c |
| "Location" → "Branch" wording in the business pages | 2c |
| Giving a newly created branch to chosen members in the same step | 2c |
| Token already issued for a branch that was taken away keeps working until it expires (same rule as module access) | accepted |
