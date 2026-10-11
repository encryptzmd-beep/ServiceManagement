# Company-Level Routing and Modules (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every request to a database that belongs to the company (not to a project), and replace per-project access with per-module access, without breaking the UI that is deployed today.

**Architecture:** The tenant's connection details move from `Projects`/`ProjectConnections` onto the `Companies` row and are found by a stable `TenantKey`. `UserProjectAccess` becomes `UserModuleAccess` for a `SERVICE` module. The tenant database is untouched: the value it knows as `ProjectId` is now `Companies.TenantScopeId`. C# keeps the existing "project" identifiers and endpoint shapes as a compatibility layer so the current UI keeps working; Plan 2 moves the UI to the new endpoints and removes that layer.

**Tech Stack:** ASP.NET Core (.NET 10), ADO.NET (`Microsoft.Data.SqlClient`) with stored procedures, SQL Server, xUnit.

**Spec:** `docs/superpowers/specs/2026-10-11-saas-tenancy-design.md`

**Plan series (this is 1 of 4):**

1. Company-level routing and modules, backend (this plan)
2. UI for companies, modules and branches; platform admin and customer portal; removal of the compatibility layer
3. Self-service company creation and database provisioning (`DbServers`, `PlatformSettings`, background worker, 503 for an unreachable tenant)
4. Branch access (`UserLocationAccess`)

## Global Constraints

- The SQL Server in `EncryptzAPI/appsettings.json` is the LIVE server. Only `MainDBEncryptz` and `HamsterserviceDB` may be touched, and only with read-only `SELECT` statements. Never run a script from this plan, or any repo script, against the live server. Scripts are run by the owner.
- Never run `EncryptzAPI/Database/MainDB/01_Schema.sql`, `02_Routing_Procs.sql`, `04_ControlPlane_Procs.sql` or `EncryptzAPI/mainDB.sql` to build a test database: they contain `USE MainDBEncryptz` / `CREATE DATABASE MainDBEncryptz`.
- Every SQL change is a file in the repo whose name starts with a number: `EncryptzAPI/Database/MainDB/NN_Name.sql` (main DB) or `EncryptzAPI/Database/ProjectDB/NN_Name.sql` (tenant DB), each with its own number. This plan uses `13`, `14` and `15` in `MainDB`; the next free number there is `16`.
- An SQL file is frozen once the task that creates it is complete (its review has passed). Never edit a frozen SQL file, including the ones this plan creates and every script that already exists in the repo. A correction found later (by a reviewer, a test or the owner) goes in a NEW file with the next free number (for example `16_Company_Tenancy_Fixes.sql`) that alters what the earlier file created. While its own task is still open (being written or in its review fix rounds) the file may be edited.
- Never give the owner SQL only in a message and never run SQL that is not in such a file. The only exception is the test-only statements of Task 13, which are run on database copies and must never be saved as a script.
- New SQL scripts contain no `USE` statement. They refuse to run in a system database or in a database without `dbo.Companies`.
- All new SQL is re-runnable (`IF NOT EXISTS`, `CREATE OR ALTER`).
- Do not change any stored procedure or table inside a tenant database.
- Existing tokens must keep working: `TenantKey` of an existing company equals its current `ProjectKey`; the `ProjectKey` claim and the `X-Project-Key` header are accepted as fallbacks.
- Users with company role `Admin` or `CompanyAdmin` have every module the company has.
- Messages returned to users never contain server names, database names or SQL error text.
- Match the surrounding code style (namespaces with braces, `ApiResponse<T>`, `SqlParameterHelper.Input`).
- Run commands from the repository root `D:\Encryptz\ServiceManagement`.

## Review Focus

1. A token issued before deployment (has `ProjectKey`, no `TenantKey`) must still reach the same tenant database. Pinned in Task 3.
2. A company-only token (no tenant key) calling a business endpoint must get 403 with a clear message, not 500. Pinned in Task 4.
3. A company `Admin` with no explicit module grant must be able to open a module the company has; a normal member without a grant must not. Pinned in Task 1.
4. A server, database or user name containing `;`, `=` or quotes must not be able to change other parts of the connection string. Pinned in Task 2.
5. A company that is inactive or not `Ready` must not be routable and `set-scope` must refuse it. No unit test can reach this (it lives in SQL); pinned in the Task 13 verification list.

## File Structure

| File | Responsibility |
|---|---|
| `EncryptzTests/EncryptzTests.csproj` (new) | xUnit test project for API and BL |
| `EncryptzBL/Common/Tenant/ModuleAccess.cs` (new) | Pure rule: is a module available to a user |
| `EncryptzBL/Common/Tenant/TenantConnectionString.cs` (new) | Pure builder of a tenant connection string |
| `EncryptzBL/Common/Tenant/TenantClaims.cs` (new) | Claim names, reading the tenant key with fallback, building scope claims |
| `EncryptzBL/Common/Tenant/TenantScopeRequiredException.cs` (new) | Thrown when business data is touched without a scope |
| `EncryptzAPI/Middleware/TenantScopeExceptionFilter.cs` (new) | Maps that exception to HTTP 403 |
| `EncryptzAPI/Middleware/AppModuleAttribute.cs` (new) | Marks a controller as belonging to a module; filter that enforces it |
| `EncryptzAPI/Middleware/TenantResolutionMiddleware.cs` | Reads `TenantKey`, fallbacks, no location header |
| `EncryptzAPI/Database/MainDB/13_Company_Tenancy_Schema.sql` (new) | Additive schema + module seed |
| `EncryptzAPI/Database/MainDB/14_Company_Tenancy_Cutover.sql` (new) | Data copy, procedures, rename of old tables |
| `EncryptzAPI/Database/MainDB/15_Company_Tenancy_Rollback.sql` (new) | Undo of the cut-over |
| `EncryptzBL/Common/Tenant/ConnectionResolver.cs` | Resolve by tenant key from `Companies` |
| `EncryptzBL/Common/Tenant/TenantUserSyncService.cs`, `ITenantUserSyncService.cs` | Sync by company |
| `EncryptzBL/Infrastructure/User/Modules/AuthService.cs`, `IAuthService.cs` | Modules, branches, set-scope, token, invitations |
| `EncryptzBL/Infrastructure/User/Modules/PlatformService.cs` | Platform admin over companies |
| `EncryptzAPI/Controllers/*.cs` | Endpoint changes and `[AppModule]` tags |
| `docs/superpowers/plans/assets/2026-10-11-maindb-project-procs-live.sql` (exists) | Live definitions of the 22 procedures being replaced; reference and rollback source |

---

### Task 1: Test project and the module access rule

**Files:**
- Create: `EncryptzTests/EncryptzTests.csproj`
- Create: `EncryptzTests/ModuleAccessTests.cs`
- Create: `EncryptzBL/Common/Tenant/ModuleAccess.cs`
- Modify: `EncryptzAPI/EncryptzAPI.slnx`

**Interfaces:**
- Produces: `EncryptzBL.Common.Tenant.ModuleState { Available, NotSubscribed, NoAccess }`; `ModuleAccess.ServiceModuleKey` (`"SERVICE"`); `ModuleAccess.IsCompanyAdminRole(string? roleInCompany) : bool`; `ModuleAccess.Evaluate(bool companyEnabled, bool userGranted, string? roleInCompany) : ModuleState`.

- [ ] **Step 1: Create the test project**

Create `EncryptzTests/EncryptzTests.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\EncryptzAPI\EncryptzAPI.csproj" />
    <ProjectReference Include="..\EncryptzBL\EncryptzBL.csproj" />
  </ItemGroup>

</Project>
```

Add it to the solution by editing `EncryptzAPI/EncryptzAPI.slnx` to:

```xml
<Solution>
  <Project Path="../EncryptzBL/EncryptzBL.csproj" Id="5d4b82d8-6961-4457-b08a-1ba4dc4a6f0d" />
  <Project Path="../EncryptzTests/EncryptzTests.csproj" />
  <Project Path="EncryptzAPI.csproj" />
</Solution>
```

- [ ] **Step 2: Write the failing test**

Create `EncryptzTests/ModuleAccessTests.cs`:

```csharp
using EncryptzBL.Common.Tenant;
using Xunit;

namespace EncryptzTests
{
    public class ModuleAccessTests
    {
        [Fact]
        public void Company_without_the_module_is_not_subscribed_even_for_admins()
        {
            Assert.Equal(ModuleState.NotSubscribed, ModuleAccess.Evaluate(false, true, "Admin"));
            Assert.Equal(ModuleState.NotSubscribed, ModuleAccess.Evaluate(false, false, "Technician"));
        }

        [Fact]
        public void Granted_member_can_open_the_module()
        {
            Assert.Equal(ModuleState.Available, ModuleAccess.Evaluate(true, true, "Technician"));
        }

        [Fact]
        public void Member_without_a_grant_has_no_access()
        {
            Assert.Equal(ModuleState.NoAccess, ModuleAccess.Evaluate(true, false, "Technician"));
            Assert.Equal(ModuleState.NoAccess, ModuleAccess.Evaluate(true, false, "Manager"));
            Assert.Equal(ModuleState.NoAccess, ModuleAccess.Evaluate(true, false, null));
            Assert.Equal(ModuleState.NoAccess, ModuleAccess.Evaluate(true, false, ""));
        }

        [Theory]
        [InlineData("Admin")]
        [InlineData("CompanyAdmin")]
        [InlineData("admin")]
        [InlineData(" CompanyAdmin ")]
        public void Company_admins_get_every_module_the_company_has_without_a_grant(string role)
        {
            Assert.Equal(ModuleState.Available, ModuleAccess.Evaluate(true, false, role));
        }

        [Fact]
        public void Service_module_key_is_SERVICE()
        {
            Assert.Equal("SERVICE", ModuleAccess.ServiceModuleKey);
        }
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj`
Expected: build error, `The type or namespace name 'ModuleState' could not be found`.

- [ ] **Step 4: Write the implementation**

Create `EncryptzBL/Common/Tenant/ModuleAccess.cs`:

```csharp
namespace EncryptzBL.Common.Tenant
{
    /// <summary>What a user sees for one module of the catalogue inside a company.</summary>
    public enum ModuleState
    {
        /// <summary>The company has the module and the user may open it.</summary>
        Available,
        /// <summary>The company does not have the module.</summary>
        NotSubscribed,
        /// <summary>The company has it, the user was not given it.</summary>
        NoAccess
    }

    /// <summary>
    /// The one rule for module access. The same rule is written in SQL in
    /// MainDB.dbo.fn_ModuleUsers; change both together.
    /// </summary>
    public static class ModuleAccess
    {
        public const string ServiceModuleKey = "SERVICE";

        private static readonly string[] CompanyAdminRoles = { "Admin", "CompanyAdmin" };

        public static bool IsCompanyAdminRole(string? roleInCompany)
            => !string.IsNullOrWhiteSpace(roleInCompany)
               && CompanyAdminRoles.Contains(roleInCompany.Trim(), StringComparer.OrdinalIgnoreCase);

        public static ModuleState Evaluate(bool companyEnabled, bool userGranted, string? roleInCompany)
        {
            if (!companyEnabled)
                return ModuleState.NotSubscribed;

            return userGranted || IsCompanyAdminRole(roleInCompany)
                ? ModuleState.Available
                : ModuleState.NoAccess;
        }
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj`
Expected: `Passed!` with 8 tests.

- [ ] **Step 6: Commit**

```bash
git add EncryptzTests EncryptzBL/Common/Tenant/ModuleAccess.cs EncryptzAPI/EncryptzAPI.slnx
git commit -m "Add test project and the module access rule"
```

---

### Task 2: Tenant connection string builder

**Files:**
- Create: `EncryptzBL/Common/Tenant/TenantConnectionString.cs`
- Create: `EncryptzTests/TenantConnectionStringTests.cs`

**Interfaces:**
- Produces: `TenantConnectionString.Build(string? server, string? database, string? user, string? password, string? extraOptions) : string`. Throws `InvalidOperationException` when server, database or user is blank.

- [ ] **Step 1: Write the failing test**

Create `EncryptzTests/TenantConnectionStringTests.cs`:

```csharp
using EncryptzBL.Common.Tenant;
using Microsoft.Data.SqlClient;
using Xunit;

namespace EncryptzTests
{
    public class TenantConnectionStringTests
    {
        [Fact]
        public void Builds_a_connection_string_from_its_parts()
        {
            var parsed = new SqlConnectionStringBuilder(
                TenantConnectionString.Build("10.0.0.5", "TenantA", "app", "p@ss", null));

            Assert.Equal("10.0.0.5", parsed.DataSource);
            Assert.Equal("TenantA", parsed.InitialCatalog);
            Assert.Equal("app", parsed.UserID);
            Assert.Equal("p@ss", parsed.Password);
            Assert.True(parsed.TrustServerCertificate);
            Assert.True(parsed.MultipleActiveResultSets);
        }

        [Theory]
        [InlineData("Tenant;User ID=sa")]
        [InlineData("Tenant';DROP")]
        [InlineData("Ten\"ant=x")]
        public void A_name_with_separators_stays_inside_its_own_field(string database)
        {
            var parsed = new SqlConnectionStringBuilder(
                TenantConnectionString.Build("srv", database, "app", "pw;Initial Catalog=master", null));

            Assert.Equal(database, parsed.InitialCatalog);
            Assert.Equal("app", parsed.UserID);
            Assert.Equal("pw;Initial Catalog=master", parsed.Password);
        }

        [Fact]
        public void Extra_options_are_appended()
        {
            var parsed = new SqlConnectionStringBuilder(
                TenantConnectionString.Build("srv", "db", "app", "pw", " Connect Timeout=7; "));

            Assert.Equal(7, parsed.ConnectTimeout);
            Assert.Equal("db", parsed.InitialCatalog);
        }

        [Theory]
        [InlineData(null, "db", "u")]
        [InlineData("srv", " ", "u")]
        [InlineData("srv", "db", "")]
        public void Incomplete_details_are_refused(string? server, string? database, string? user)
        {
            Assert.Throws<InvalidOperationException>(
                () => TenantConnectionString.Build(server, database, user, "pw", null));
        }

        [Fact]
        public void Values_are_trimmed()
        {
            var parsed = new SqlConnectionStringBuilder(
                TenantConnectionString.Build(" srv ", " db ", " app ", "pw", null));

            Assert.Equal("srv", parsed.DataSource);
            Assert.Equal("db", parsed.InitialCatalog);
            Assert.Equal("app", parsed.UserID);
        }
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj --filter TenantConnectionStringTests`
Expected: build error, `'TenantConnectionString' could not be found`.

- [ ] **Step 3: Write the implementation**

Create `EncryptzBL/Common/Tenant/TenantConnectionString.cs`:

```csharp
using Microsoft.Data.SqlClient;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>Builds the connection string of a tenant database from the parts kept on its company row.</summary>
    public static class TenantConnectionString
    {
        public static string Build(string? server, string? database, string? user, string? password, string? extraOptions)
        {
            if (string.IsNullOrWhiteSpace(server) || string.IsNullOrWhiteSpace(database) || string.IsNullOrWhiteSpace(user))
                throw new InvalidOperationException("The tenant database connection is incomplete.");

            // The builder quotes each value, so a name cannot spill into another keyword.
            var builder = new SqlConnectionStringBuilder
            {
                DataSource = server.Trim(),
                InitialCatalog = database.Trim(),
                UserID = user.Trim(),
                Password = password ?? string.Empty,
                TrustServerCertificate = true,
                MultipleActiveResultSets = true
            };

            var result = builder.ConnectionString;

            // Raw options an administrator typed for this database (e.g. a timeout).
            if (!string.IsNullOrWhiteSpace(extraOptions))
                result = result.TrimEnd(';') + ";" + extraOptions.Trim().Trim(';');

            return result;
        }
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj --filter TenantConnectionStringTests`
Expected: `Passed!` with 9 tests.

- [ ] **Step 5: Commit**

```bash
git add EncryptzBL/Common/Tenant/TenantConnectionString.cs EncryptzTests/TenantConnectionStringTests.cs
git commit -m "Add tenant connection string builder"
```

---

### Task 3: Tenant key claims and request routing

**Files:**
- Create: `EncryptzBL/Common/Tenant/TenantClaims.cs`
- Modify: `EncryptzBL/Common/Tenant/TenantContext.cs`
- Modify: `EncryptzAPI/Middleware/TenantResolutionMiddleware.cs` (whole file)
- Create: `EncryptzTests/TenantClaimsTests.cs`
- Create: `EncryptzTests/TenantResolutionMiddlewareTests.cs`

**Interfaces:**
- Consumes: `IConnectionResolver.GetServiceConnectionAsync(string key) : Task<string>`, `IConnectionResolver.GetProjectScopeAsync(string key) : Task<ProjectScope?>`, `ProjectScope { ProjectKey, CompanyId, CompanyName, ProjectId, DefaultLocationId }` (existing; the key is now the tenant key and `ProjectId` is the tenant scope id).
- Produces: `TenantClaims.TenantKey = "TenantKey"`, `TenantClaims.LegacyProjectKey = "ProjectKey"`, `TenantClaims.ModuleKey = "ModuleKey"`; `TenantClaims.GetTenantKey(ClaimsPrincipal) : string`; `TenantClaims.IsLegacyToken(ClaimsPrincipal) : bool`; `TenantClaims.GetModuleKey(ClaimsPrincipal) : string`; `TenantClaims.BuildScopeClaims(int companyId, string tenantKey, int scopeId, int locationId, string moduleKey, int tenantUserId, int technicianId) : List<Claim>`; `TenantContext.ModuleKey : string?`; `TenantResolutionMiddleware.TenantKeyHeader = "X-Tenant-Key"`, `TenantResolutionMiddleware.ProjectKeyHeader = "X-Project-Key"`.

- [ ] **Step 1: Write the failing claim tests**

Create `EncryptzTests/TenantClaimsTests.cs`:

```csharp
using System.Security.Claims;
using EncryptzBL.Common.Tenant;
using Xunit;

namespace EncryptzTests
{
    public class TenantClaimsTests
    {
        private static ClaimsPrincipal User(params Claim[] claims)
            => new(new ClaimsIdentity(claims, "test"));

        [Fact]
        public void Tenant_key_is_read_from_the_new_claim()
        {
            var user = User(new Claim("TenantKey", "C002-P001"), new Claim("ProjectKey", "OTHER"));
            Assert.Equal("C002-P001", TenantClaims.GetTenantKey(user));
            Assert.False(TenantClaims.IsLegacyToken(user));
        }

        [Fact]
        public void A_token_issued_before_the_change_falls_back_to_the_project_key()
        {
            var user = User(new Claim("ProjectKey", "C001-P001"));
            Assert.Equal("C001-P001", TenantClaims.GetTenantKey(user));
            Assert.True(TenantClaims.IsLegacyToken(user));
        }

        [Fact]
        public void A_company_only_token_has_no_tenant_key()
        {
            Assert.Equal("", TenantClaims.GetTenantKey(User(new Claim("TenantKey", ""), new Claim("ProjectKey", ""))));
            Assert.Equal("", TenantClaims.GetTenantKey(User()));
        }

        [Fact]
        public void Scope_claims_carry_the_key_under_both_names()
        {
            var claims = TenantClaims.BuildScopeClaims(2, "C002-P001", 5, 9, "SERVICE", 31, 4);
            string Value(string type) => claims.Single(c => c.Type == type).Value;

            Assert.Equal("2", Value("CompanyId"));
            Assert.Equal("2", Value("ClientId"));
            Assert.Equal("C002-P001", Value("TenantKey"));
            Assert.Equal("C002-P001", Value("ProjectKey"));
            Assert.Equal("5", Value("ProjectId"));
            Assert.Equal("9", Value("LocationId"));
            Assert.Equal("SERVICE", Value("ModuleKey"));
            Assert.Equal("31", Value("TenantUserId"));
            Assert.Equal("4", Value("TechnicianId"));
        }

        [Fact]
        public void Module_key_is_empty_when_absent()
        {
            Assert.Equal("", TenantClaims.GetModuleKey(User()));
            Assert.Equal("SERVICE", TenantClaims.GetModuleKey(User(new Claim("ModuleKey", "SERVICE"))));
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj --filter TenantClaimsTests`
Expected: build error, `'TenantClaims' could not be found`.

- [ ] **Step 3: Implement the claims helper**

Create `EncryptzBL/Common/Tenant/TenantClaims.cs`:

```csharp
using System.Security.Claims;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Names and helpers for the routing claims of a staff/customer token.
    /// TenantKey routes the request to the company's database. Tokens issued before
    /// the company-level routing carry the same value as "ProjectKey"; it is still
    /// written and still read so those tokens keep working.
    /// </summary>
    public static class TenantClaims
    {
        public const string TenantKey = "TenantKey";
        public const string LegacyProjectKey = "ProjectKey";
        public const string ModuleKey = "ModuleKey";

        public static string GetTenantKey(ClaimsPrincipal user)
        {
            var key = user.FindFirst(TenantKey)?.Value;
            if (string.IsNullOrEmpty(key))
                key = user.FindFirst(LegacyProjectKey)?.Value;
            return key ?? string.Empty;
        }

        /// <summary>True for a token issued before TenantKey / ModuleKey existed.</summary>
        public static bool IsLegacyToken(ClaimsPrincipal user)
            => user.FindFirst(TenantKey) == null;

        public static string GetModuleKey(ClaimsPrincipal user)
            => user.FindFirst(ModuleKey)?.Value ?? string.Empty;

        /// <summary>The scope part of a token: company, routing key, module, branch and tenant-local ids.</summary>
        public static List<Claim> BuildScopeClaims(
            int companyId, string tenantKey, int scopeId, int locationId,
            string moduleKey, int tenantUserId, int technicianId)
        {
            return new List<Claim>
            {
                new Claim("CompanyId", companyId.ToString()),
                new Claim("ClientId", companyId.ToString()),
                new Claim(TenantKey, tenantKey ?? string.Empty),
                new Claim(LegacyProjectKey, tenantKey ?? string.Empty),
                // the value the tenant database knows as ProjectId (Companies.TenantScopeId)
                new Claim("ProjectId", scopeId.ToString()),
                new Claim("LocationId", locationId.ToString()),
                new Claim(ModuleKey, moduleKey ?? string.Empty),
                new Claim("TenantUserId", tenantUserId.ToString()),
                new Claim("TechnicianId", technicianId.ToString())
            };
        }
    }
}
```

In `EncryptzBL/Common/Tenant/TenantContext.cs`, replace the `ProjectId` and `ProjectKey` members with these three (the comments change, `ModuleKey` is new):

```csharp
        /// <summary>Companies.TenantScopeId: the value the tenant database stores and filters as ProjectId.</summary>
        public int ProjectId { get; set; }

        /// <summary>Companies.TenantKey: the routing key that resolves this company's database.</summary>
        public string? ProjectKey { get; set; }

        /// <summary>Module the token was issued for (empty on tokens issued before modules existed).</summary>
        public string? ModuleKey { get; set; }
```

- [ ] **Step 4: Run to verify the claim tests pass**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj --filter TenantClaimsTests`
Expected: `Passed!` with 5 tests.

- [ ] **Step 5: Write the failing middleware tests**

Create `EncryptzTests/TenantResolutionMiddlewareTests.cs`:

```csharp
using System.Security.Claims;
using EncryptzAPI.Middleware;
using EncryptzBL.Common.Tenant;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EncryptzTests
{
    public class TenantResolutionMiddlewareTests
    {
        private sealed class FakeResolver : IConnectionResolver
        {
            public List<string> Asked { get; } = new();

            public Task<string> GetServiceConnectionAsync(string projectKey)
            {
                Asked.Add(projectKey);
                return Task.FromResult("conn:" + projectKey);
            }

            public Task<ProjectScope?> GetProjectScopeAsync(string projectKey)
                => Task.FromResult(projectKey == "KNOWN"
                    ? new ProjectScope { ProjectKey = "KNOWN", CompanyId = 7, ProjectId = 3, DefaultLocationId = 9 }
                    : null);

            public void Evict(string projectKey) { }
        }

        private static async Task<(TenantContext Tenant, FakeResolver Resolver, HttpContext Http, bool NextCalled)> Run(
            Claim[]? claims, Action<HttpContext>? setup = null)
        {
            var http = new DefaultHttpContext { RequestServices = new ServiceCollection().BuildServiceProvider() };
            http.Response.Body = new MemoryStream();
            if (claims != null)
                http.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
            setup?.Invoke(http);

            var tenant = new TenantContext();
            var resolver = new FakeResolver();
            var nextCalled = false;
            var middleware = new TenantResolutionMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });

            await middleware.InvokeAsync(http, resolver, tenant);
            return (tenant, resolver, http, nextCalled);
        }

        [Fact]
        public async Task A_scoped_token_is_routed_by_its_tenant_key()
        {
            var r = await Run(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"),
                new Claim("TenantKey", "C002-P001"), new Claim("CompanyId", "2"),
                new Claim("ProjectId", "5"), new Claim("LocationId", "9"),
                new Claim("ModuleKey", "SERVICE"), new Claim("TenantUserId", "31"), new Claim("TechnicianId", "4")
            });

            Assert.True(r.NextCalled);
            Assert.Equal("conn:C002-P001", r.Tenant.ServiceDbConnectionString);
            Assert.Equal("C002-P001", r.Tenant.ProjectKey);
            Assert.Equal(2, r.Tenant.CompanyId);
            Assert.Equal(5, r.Tenant.ProjectId);
            Assert.Equal(9, r.Tenant.LocationId);
            Assert.Equal("SERVICE", r.Tenant.ModuleKey);
            Assert.Equal(31, r.Tenant.TenantUserId);
            Assert.Equal(11, r.Tenant.MainUserId);
            Assert.Equal(4, r.Tenant.TechnicianId);
        }

        [Fact]
        public async Task A_token_issued_before_the_change_is_still_routed()
        {
            var r = await Run(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"),
                new Claim("ProjectKey", "C001-P001"), new Claim("CompanyId", "1"),
                new Claim("ProjectId", "1"), new Claim("LocationId", "2"), new Claim("TenantUserId", "8")
            });

            Assert.Equal("conn:C001-P001", r.Tenant.ServiceDbConnectionString);
            Assert.Equal(1, r.Tenant.ProjectId);
            Assert.Equal(2, r.Tenant.LocationId);
        }

        [Fact]
        public async Task A_company_only_token_resolves_no_database()
        {
            var r = await Run(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"),
                new Claim("TenantKey", ""), new Claim("ProjectKey", ""), new Claim("CompanyId", "2")
            });

            Assert.True(r.NextCalled);
            Assert.False(r.Tenant.IsResolved);
            Assert.Empty(r.Resolver.Asked);
        }

        [Fact]
        public async Task The_location_header_cannot_change_the_branch_of_a_token()
        {
            var r = await Run(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"),
                new Claim("TenantKey", "C002-P001"), new Claim("CompanyId", "2"),
                new Claim("ProjectId", "5"), new Claim("LocationId", "9")
            }, http => http.Request.Headers["X-Location-Id"] = "77");

            Assert.Equal(9, r.Tenant.LocationId);
        }

        [Theory]
        [InlineData("X-Tenant-Key")]
        [InlineData("X-Project-Key")]
        public async Task An_anonymous_request_is_routed_by_the_key_header(string header)
        {
            var r = await Run(null, http => http.Request.Headers[header] = " KNOWN ");

            Assert.True(r.NextCalled);
            Assert.Equal("conn:KNOWN", r.Tenant.ServiceDbConnectionString);
            Assert.Equal(7, r.Tenant.CompanyId);
            Assert.Equal(3, r.Tenant.ProjectId);
            Assert.Equal(9, r.Tenant.LocationId);
        }

        [Fact]
        public async Task An_unknown_key_header_is_rejected()
        {
            var r = await Run(null, http => http.Request.Headers["X-Tenant-Key"] = "NOPE");

            Assert.False(r.NextCalled);
            Assert.Equal(StatusCodes.Status400BadRequest, r.Http.Response.StatusCode);
            Assert.False(r.Tenant.IsResolved);
        }

        [Fact]
        public async Task The_key_header_is_ignored_for_a_logged_in_caller()
        {
            var r = await Run(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"),
                new Claim("TenantKey", "C002-P001"), new Claim("CompanyId", "2")
            }, http => http.Request.Headers["X-Tenant-Key"] = "KNOWN");

            Assert.Equal("conn:C002-P001", r.Tenant.ServiceDbConnectionString);
        }
    }
}
```

- [ ] **Step 6: Run to verify they fail**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj --filter TenantResolutionMiddlewareTests`
Expected: FAIL. `A_scoped_token_is_routed_by_its_tenant_key` (the middleware reads only `ProjectKey`), `The_location_header_cannot_change_the_branch_of_a_token` (gets 77) and the `X-Tenant-Key` cases fail.

- [ ] **Step 7: Rewrite the middleware**

Replace the whole of `EncryptzAPI/Middleware/TenantResolutionMiddleware.cs` with:

```csharp
using System.Security.Claims;
using EncryptzBL.Common.Tenant;

namespace EncryptzAPI.Middleware
{
    /// <summary>
    /// Resolves the company's database for the request and fills the request-scoped
    /// TenantContext.
    ///
    /// AUTHENTICATED requests: the routing claims of the signed JWT (TenantKey,
    /// CompanyId, ProjectId = tenant scope id, LocationId, ModuleKey). Staff tokens get
    /// them at set-scope, customer tokens at customer login. Tokens issued before the
    /// company-level routing carry the key as ProjectKey; it is accepted as a fallback.
    ///
    /// ANONYMOUS requests (public customer-portal endpoints): the company is named by
    /// the X-Tenant-Key header (X-Project-Key is the old name). The header is ignored
    /// for authenticated requests, so a token can never be pointed at another database.
    ///
    /// The branch always comes from the token: changing it means calling set-scope,
    /// which checks the caller's access and issues a new token.
    ///
    /// Endpoints that run before a scope is chosen (login, select-company, modules)
    /// have neither; TenantContext stays unresolved and business data access is refused.
    /// </summary>
    public class TenantResolutionMiddleware
    {
        public const string TenantKeyHeader = "X-Tenant-Key";
        /// <summary>Old name of <see cref="TenantKeyHeader"/>, still sent by deployed customer pages.</summary>
        public const string ProjectKeyHeader = "X-Project-Key";

        private readonly RequestDelegate _next;

        public TenantResolutionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, IConnectionResolver resolver, TenantContext tenant)
        {
            var user = context.User;
            if (user?.Identity?.IsAuthenticated == true)
            {
                var tenantKey = TenantClaims.GetTenantKey(user);

                if (!string.IsNullOrEmpty(tenantKey))
                {
                    tenant.ProjectKey = tenantKey;
                    tenant.CompanyId = ParseInt(user.FindFirst("CompanyId")?.Value
                                                ?? user.FindFirst("ClientId")?.Value);
                    tenant.ProjectId = ParseInt(user.FindFirst("ProjectId")?.Value);
                    tenant.LocationId = ParseInt(user.FindFirst("LocationId")?.Value);
                    tenant.ModuleKey = TenantClaims.GetModuleKey(user);

                    // Identity: the login lives in MainDB; TenantUserId/TechnicianId are the
                    // caller's ids inside the tenant DB (resolved by the user sync at set-scope).
                    // Customer tokens are issued by the tenant DB itself: their NameIdentifier
                    // already is the local user id.
                    var nameId = ParseInt(user.FindFirst(ClaimTypes.NameIdentifier)?.Value);
                    tenant.TenantUserId = user.GetTenantUserId();
                    tenant.MainUserId = user.FindFirst("TenantUserId") != null ? nameId : 0;
                    tenant.TechnicianId = user.GetTechnicianId();

                    tenant.ServiceDbConnectionString = await resolver.GetServiceConnectionAsync(tenantKey);
                }
            }
            else
            {
                var headerKey = context.Request.Headers[TenantKeyHeader].FirstOrDefault();
                if (string.IsNullOrWhiteSpace(headerKey))
                    headerKey = context.Request.Headers[ProjectKeyHeader].FirstOrDefault();

                if (!string.IsNullOrWhiteSpace(headerKey))
                {
                    var scope = await resolver.GetProjectScopeAsync(headerKey.Trim());
                    if (scope == null)
                    {
                        context.Response.StatusCode = StatusCodes.Status400BadRequest;
                        await context.Response.WriteAsJsonAsync(new { success = false, message = "Unknown company" });
                        return;
                    }

                    tenant.ProjectKey = scope.ProjectKey;
                    tenant.CompanyId = scope.CompanyId;
                    tenant.ProjectId = scope.ProjectId;
                    tenant.LocationId = scope.DefaultLocationId;

                    tenant.ServiceDbConnectionString = await resolver.GetServiceConnectionAsync(scope.ProjectKey);
                }
            }

            await _next(context);
        }

        private static int ParseInt(string? value)
            => int.TryParse(value, out var n) ? n : 0;
    }
}
```

- [ ] **Step 8: Run to verify they pass**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj`
Expected: `Passed!`, all tests (30).

- [ ] **Step 9: Commit**

```bash
git add EncryptzBL/Common/Tenant/TenantClaims.cs EncryptzBL/Common/Tenant/TenantContext.cs EncryptzAPI/Middleware/TenantResolutionMiddleware.cs EncryptzTests/TenantClaimsTests.cs EncryptzTests/TenantResolutionMiddlewareTests.cs
git commit -m "Route requests by tenant key and drop the branch override header"
```

---

### Task 4: 403 when business data is used without a scope

**Files:**
- Create: `EncryptzBL/Common/Tenant/TenantScopeRequiredException.cs`
- Modify: `EncryptzBL/Common/DbHelper.cs`
- Create: `EncryptzAPI/Middleware/TenantScopeExceptionFilter.cs`
- Modify: `EncryptzAPI/Program.cs:18-23`
- Create: `EncryptzTests/TenantScopeExceptionFilterTests.cs`

**Interfaces:**
- Produces: `TenantScopeRequiredException : InvalidOperationException` (parameterless constructor); `TenantScopeExceptionFilter : IExceptionFilter` with `const string Message`.

- [ ] **Step 1: Write the failing test**

Create `EncryptzTests/TenantScopeExceptionFilterTests.cs`:

```csharp
using EncryptzAPI.Middleware;
using EncryptzBL.Common;
using EncryptzBL.Common.Tenant;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Xunit;

namespace EncryptzTests
{
    public class TenantScopeExceptionFilterTests
    {
        private static ExceptionContext Context(Exception ex)
            => new(new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor()),
                   new List<IFilterMetadata>()) { Exception = ex };

        [Fact]
        public void Missing_scope_becomes_403_with_a_message()
        {
            var context = Context(new TenantScopeRequiredException());

            new TenantScopeExceptionFilter().OnException(context);

            var result = Assert.IsType<ObjectResult>(context.Result);
            Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
            Assert.True(context.ExceptionHandled);
            Assert.Contains(TenantScopeExceptionFilter.Message, System.Text.Json.JsonSerializer.Serialize(result.Value));
        }

        [Fact]
        public void Other_exceptions_are_left_alone()
        {
            var context = Context(new InvalidOperationException("boom"));

            new TenantScopeExceptionFilter().OnException(context);

            Assert.Null(context.Result);
            Assert.False(context.ExceptionHandled);
        }

        [Fact]
        public async Task The_tenant_executor_refuses_to_run_without_a_resolved_database()
        {
            var db = new DbHelper(new TenantContext());

            await Assert.ThrowsAsync<TenantScopeRequiredException>(
                () => db.ExecuteDataTableAsync("sp_Anything"));
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj --filter TenantScopeExceptionFilterTests`
Expected: build error, `'TenantScopeRequiredException' could not be found`.

- [ ] **Step 3: Implement**

Create `EncryptzBL/Common/Tenant/TenantScopeRequiredException.cs`:

```csharp
namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Business data was requested by a caller whose token has no resolved company
    /// database yet (logged in, but no company / module / branch selected).
    /// </summary>
    public class TenantScopeRequiredException : InvalidOperationException
    {
        public TenantScopeRequiredException()
            : base("No company database is resolved for this request. A company, module and branch must be selected (set-scope) before accessing business data.")
        {
        }
    }
}
```

In `EncryptzBL/Common/DbHelper.cs` replace the `ConnectionString` property with:

```csharp
        protected override string ConnectionString =>
            _tenant.ServiceDbConnectionString ?? throw new TenantScopeRequiredException();
```

Create `EncryptzAPI/Middleware/TenantScopeExceptionFilter.cs`:

```csharp
using EncryptzBL.Common.Tenant;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EncryptzAPI.Middleware
{
    /// <summary>
    /// A caller that is logged in but has not selected a company, module and branch
    /// gets 403 with a message the UI can show, instead of an unhandled 500.
    /// </summary>
    public class TenantScopeExceptionFilter : IExceptionFilter
    {
        public const string Message = "Select a company, module and branch first";

        public void OnException(ExceptionContext context)
        {
            if (context.Exception is not TenantScopeRequiredException)
                return;

            context.Result = new ObjectResult(new { success = false, message = Message })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
            context.ExceptionHandled = true;
        }
    }
}
```

In `EncryptzAPI/Program.cs`, inside the second `AddControllers(options => { ... })` block, add after the `CustomerBoundaryFilter` line:

```csharp
    options.Filters.Add<TenantScopeExceptionFilter>();   // no scope selected -> 403, not 500
```

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj`
Expected: `Passed!`, all tests (33).

- [ ] **Step 5: Commit**

```bash
git add EncryptzBL/Common/Tenant/TenantScopeRequiredException.cs EncryptzBL/Common/DbHelper.cs EncryptzAPI/Middleware/TenantScopeExceptionFilter.cs EncryptzAPI/Program.cs EncryptzTests/TenantScopeExceptionFilterTests.cs
git commit -m "Return 403 when business data is requested without a scope"
```

---

### Task 5: Module boundary on business controllers

**Files:**
- Create: `EncryptzAPI/Middleware/AppModuleAttribute.cs`
- Modify: `EncryptzAPI/Program.cs` (filter registration)
- Modify: every controller in `EncryptzAPI/Controllers/` except `AuthController.cs`, `CompanyController.cs`, `PlatformController.cs`, `WeatherForecastController.cs`
- Create: `EncryptzTests/ModuleBoundaryFilterTests.cs`

**Interfaces:**
- Consumes: `TenantClaims.IsLegacyToken`, `TenantClaims.GetModuleKey`, `ModuleAccess.ServiceModuleKey`.
- Produces: `AppModuleAttribute(string moduleKey)` with `ModuleKey`; `ModuleBoundaryFilter : IAuthorizationFilter`.

- [ ] **Step 1: Write the failing tests**

Create `EncryptzTests/ModuleBoundaryFilterTests.cs`:

```csharp
using System.Reflection;
using System.Security.Claims;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Xunit;

namespace EncryptzTests
{
    public class ModuleBoundaryFilterTests
    {
        private static AuthorizationFilterContext Context(object[] metadata, params Claim[] claims)
        {
            var http = new DefaultHttpContext();
            if (claims.Length > 0)
                http.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));

            var descriptor = new ActionDescriptor { EndpointMetadata = metadata.ToList() };
            return new AuthorizationFilterContext(
                new ActionContext(http, new RouteData(), descriptor), new List<IFilterMetadata>());
        }

        private static readonly object[] ServiceEndpoint = { new AppModuleAttribute("SERVICE") };

        [Fact]
        public void A_token_for_the_module_passes()
        {
            var context = Context(ServiceEndpoint,
                new Claim("TenantKey", "K"), new Claim("ModuleKey", "service"), new Claim(ClaimTypes.Role, "Technician"));

            new ModuleBoundaryFilter().OnAuthorization(context);

            Assert.Null(context.Result);
        }

        [Theory]
        [InlineData("")]
        [InlineData("SALES")]
        public void A_token_for_no_module_or_another_module_is_refused(string moduleKey)
        {
            var context = Context(ServiceEndpoint,
                new Claim("TenantKey", "K"), new Claim("ModuleKey", moduleKey), new Claim(ClaimTypes.Role, "Admin"));

            new ModuleBoundaryFilter().OnAuthorization(context);

            var result = Assert.IsType<ObjectResult>(context.Result);
            Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
        }

        [Fact]
        public void A_token_issued_before_modules_existed_passes()
        {
            var context = Context(ServiceEndpoint,
                new Claim("ProjectKey", "C001-P001"), new Claim(ClaimTypes.Role, "Technician"));

            new ModuleBoundaryFilter().OnAuthorization(context);

            Assert.Null(context.Result);
        }

        [Fact]
        public void Customers_and_anonymous_callers_are_not_checked_here()
        {
            var customer = Context(ServiceEndpoint, new Claim("TenantKey", "K"), new Claim(ClaimTypes.Role, "Customer"));
            new ModuleBoundaryFilter().OnAuthorization(customer);
            Assert.Null(customer.Result);

            var anonymous = Context(ServiceEndpoint);
            new ModuleBoundaryFilter().OnAuthorization(anonymous);
            Assert.Null(anonymous.Result);
        }

        [Fact]
        public void Endpoints_without_a_module_are_not_checked()
        {
            var context = Context(Array.Empty<object>(), new Claim("TenantKey", "K"), new Claim("ModuleKey", ""));

            new ModuleBoundaryFilter().OnAuthorization(context);

            Assert.Null(context.Result);
        }

        [Fact]
        public void Every_business_controller_declares_its_module()
        {
            var controlPlane = new[] { "AuthController", "CompanyController", "PlatformController", "WeatherForecastController" };

            var untagged = typeof(AuthController).Assembly.GetTypes()
                .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
                .Where(t => !controlPlane.Contains(t.Name))
                .Where(t => t.GetCustomAttribute<AppModuleAttribute>() == null)
                .Select(t => t.Name)
                .OrderBy(n => n)
                .ToList();

            Assert.Empty(untagged);
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj --filter ModuleBoundaryFilterTests`
Expected: build error, `'AppModuleAttribute' could not be found`.

- [ ] **Step 3: Implement the attribute and filter**

Create `EncryptzAPI/Middleware/AppModuleAttribute.cs`:

```csharp
using EncryptzBL.Common.Tenant;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EncryptzAPI.Middleware
{
    /// <summary>The module (MainDB.Modules.ModuleKey) a controller's endpoints belong to.</summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public sealed class AppModuleAttribute : Attribute
    {
        public AppModuleAttribute(string moduleKey) => ModuleKey = moduleKey;

        public string ModuleKey { get; }
    }

    /// <summary>
    /// A staff token is issued for ONE module at set-scope, after the company's
    /// subscription and the user's grant were checked. Endpoints of a module only
    /// accept a token issued for that module. Customers have their own boundary
    /// (CustomerBoundaryFilter); tokens issued before modules existed are let through
    /// until they expire.
    /// </summary>
    public class ModuleBoundaryFilter : IAuthorizationFilter
    {
        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var required = context.ActionDescriptor.EndpointMetadata.OfType<AppModuleAttribute>().LastOrDefault();
            if (required == null)
                return;

            var user = context.HttpContext.User;
            if (user?.Identity?.IsAuthenticated != true || user.IsInRole("Customer"))
                return;

            if (TenantClaims.IsLegacyToken(user))
                return;

            if (string.Equals(TenantClaims.GetModuleKey(user), required.ModuleKey, StringComparison.OrdinalIgnoreCase))
                return;

            context.Result = new ObjectResult(new { success = false, message = "Open this module from the module list first" })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}
```

In `EncryptzAPI/Program.cs`, in the same `AddControllers` block, add:

```csharp
    options.Filters.Add<ModuleBoundaryFilter>();   // a token is issued for one module
```

- [ ] **Step 4: Tag the business controllers**

List the controllers: `ls EncryptzAPI/Controllers/`. In every file except `AuthController.cs`, `CompanyController.cs`, `PlatformController.cs` and `WeatherForecastController.cs`, add this line directly above the `public class ...Controller` line, and add `using EncryptzAPI.Middleware;` at the top if the file does not have it:

```csharp
    [AppModule("SERVICE")]
```

Example, `EncryptzAPI/Controllers/RepairPartController.cs` becomes:

```csharp
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [AppModule("SERVICE")]
    public class RepairPartController : ControllerBase
```

A file may hold more than one controller class; tag each. The test `Every_business_controller_declares_its_module` lists any that were missed.

- [ ] **Step 5: Run to verify it passes**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj`
Expected: `Passed!`, all tests (40).

- [ ] **Step 6: Commit**

```bash
git add EncryptzAPI/Middleware/AppModuleAttribute.cs EncryptzAPI/Program.cs EncryptzAPI/Controllers EncryptzTests/ModuleBoundaryFilterTests.cs
git commit -m "Require a module-scoped token on business controllers"
```

---

### Task 6: Main DB schema script (additive)

**Files:**
- Create: `EncryptzAPI/Database/MainDB/13_Company_Tenancy_Schema.sql`

**Interfaces:**
- Produces (tables/columns later tasks rely on):
  - `Companies.TenantKey NVARCHAR(50) NULL` (unique when not null), `ServerName NVARCHAR(200) NULL`, `DatabaseName NVARCHAR(200) NULL`, `DbUser NVARCHAR(100) NULL`, `DbPasswordEnc NVARCHAR(500) NULL`, `ExtraOptions NVARCHAR(400) NULL`, `TenantScopeId INT NOT NULL DEFAULT 1`, `ProvisionStatus NVARCHAR(20) NOT NULL DEFAULT 'None'`
  - `Modules(ModuleId, ModuleKey, ModuleName, Description, Icon, SortOrder, IsActive)`
  - `CompanyModules(CompanyModuleId, CompanyId, ModuleId, IsEnabled, UpdatedAt)`
  - `UserModuleAccess(UserModuleAccessId, CompanyId, UserId, ModuleId, GrantedBy, GrantedAt)`
  - `MenuItems.AppModuleId INT NULL` (the existing `MenuItems.Module` text column is a sidebar group name and is left alone)

This script only adds things. The API that is deployed today ignores them, so the owner can run it before the release.

- [ ] **Step 1: Write the script**

Create `EncryptzAPI/Database/MainDB/13_Company_Tenancy_Schema.sql`:

```sql
/* =============================================================================
   MainDB · Company-level tenancy · 1 of 2 · SCHEMA (additive)
   -----------------------------------------------------------------------------
   One company = one tenant = one database. The connection of a tenant moves onto
   its Companies row; access to a module replaces access to a project.

   This script ONLY ADDS columns and tables and seeds the SERVICE module. The API
   deployed today ignores them, so it can be run ahead of the release.

   Select the SaaS main database in SSMS before running. There is no USE statement
   on purpose. SAFE TO RE-RUN.
   Next: 14_Company_Tenancy_Cutover.sql (during the release, API stopped).
   ============================================================================= */
SET NOCOUNT ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
   OR OBJECT_ID('dbo.Companies') IS NULL
   OR OBJECT_ID('dbo.CompanyUsers') IS NULL
   OR OBJECT_ID('dbo.MenuItems') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database (the one with dbo.Companies) before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   1. Companies: the tenant's routing key and connection
   ----------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.Companies', 'TenantKey') IS NULL
    ALTER TABLE dbo.Companies ADD TenantKey NVARCHAR(50) NULL;          -- stable routing key (in the token)
IF COL_LENGTH('dbo.Companies', 'ServerName') IS NULL
    ALTER TABLE dbo.Companies ADD ServerName NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Companies', 'DatabaseName') IS NULL
    ALTER TABLE dbo.Companies ADD DatabaseName NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Companies', 'DbUser') IS NULL
    ALTER TABLE dbo.Companies ADD DbUser NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Companies', 'DbPasswordEnc') IS NULL
    ALTER TABLE dbo.Companies ADD DbPasswordEnc NVARCHAR(500) NULL;     -- ENCRYPTED (ITenantSecretProtector)
IF COL_LENGTH('dbo.Companies', 'ExtraOptions') IS NULL
    ALTER TABLE dbo.Companies ADD ExtraOptions NVARCHAR(400) NULL;
IF COL_LENGTH('dbo.Companies', 'TenantScopeId') IS NULL
    ALTER TABLE dbo.Companies ADD TenantScopeId INT NOT NULL
        CONSTRAINT DF_Companies_TenantScopeId DEFAULT (1);              -- value the tenant DB stores as ProjectId
IF COL_LENGTH('dbo.Companies', 'ProvisionStatus') IS NULL
    ALTER TABLE dbo.Companies ADD ProvisionStatus NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Companies_ProvisionStatus DEFAULT ('None');       -- None | Provisioning | Ready | Failed
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Companies_TenantKey' AND object_id = OBJECT_ID('dbo.Companies'))
    CREATE UNIQUE INDEX UX_Companies_TenantKey ON dbo.Companies(TenantKey) WHERE TenantKey IS NOT NULL;
GO

/* -----------------------------------------------------------------------------
   2. Modules: the catalogue everyone sees
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Modules') IS NULL
CREATE TABLE dbo.Modules
(
    ModuleId    INT IDENTITY(1,1) PRIMARY KEY,
    ModuleKey   NVARCHAR(50)  NOT NULL,
    ModuleName  NVARCHAR(150) NOT NULL,
    Description NVARCHAR(400) NULL,
    Icon        NVARCHAR(100) NULL,
    SortOrder   INT NOT NULL CONSTRAINT DF_Modules_Sort     DEFAULT (0),
    IsActive    BIT NOT NULL CONSTRAINT DF_Modules_IsActive DEFAULT (1),
    CONSTRAINT UQ_Modules_Key UNIQUE (ModuleKey)
);
GO

/* -----------------------------------------------------------------------------
   3. CompanyModules: which modules a company has (its subscription)
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.CompanyModules') IS NULL
CREATE TABLE dbo.CompanyModules
(
    CompanyModuleId INT IDENTITY(1,1) PRIMARY KEY,
    CompanyId INT NOT NULL REFERENCES dbo.Companies(CompanyId),
    ModuleId  INT NOT NULL REFERENCES dbo.Modules(ModuleId),
    IsEnabled BIT NOT NULL CONSTRAINT DF_CM_IsEnabled DEFAULT (1),
    UpdatedAt DATETIME NOT NULL CONSTRAINT DF_CM_UpdatedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_CM_Company_Module UNIQUE (CompanyId, ModuleId)
);
GO

/* -----------------------------------------------------------------------------
   4. UserModuleAccess: which modules a member may open in a company.
      A row means "granted". Admin / CompanyAdmin need no row (see fn_ModuleUsers).
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.UserModuleAccess') IS NULL
CREATE TABLE dbo.UserModuleAccess
(
    UserModuleAccessId INT IDENTITY(1,1) PRIMARY KEY,
    CompanyId INT NOT NULL REFERENCES dbo.Companies(CompanyId),
    UserId    INT NOT NULL REFERENCES dbo.Users(UserId),
    ModuleId  INT NOT NULL REFERENCES dbo.Modules(ModuleId),
    GrantedBy INT NULL REFERENCES dbo.Users(UserId),
    GrantedAt DATETIME NOT NULL CONSTRAINT DF_UMA_GrantedAt DEFAULT (GETDATE()),
    CONSTRAINT UQ_UMA_Company_User_Module UNIQUE (CompanyId, UserId, ModuleId)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UMA_User' AND object_id = OBJECT_ID('dbo.UserModuleAccess'))
    CREATE INDEX IX_UMA_User ON dbo.UserModuleAccess(UserId);
GO

/* -----------------------------------------------------------------------------
   5. MenuItems: the module a menu belongs to.
      (MenuItems.Module already exists: it is the sidebar GROUP name, left as is.)
   ----------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.MenuItems', 'AppModuleId') IS NULL
    ALTER TABLE dbo.MenuItems ADD AppModuleId INT NULL
        CONSTRAINT FK_MenuItems_Modules REFERENCES dbo.Modules(ModuleId);
GO

/* -----------------------------------------------------------------------------
   6. Seed: the Service module; every existing menu belongs to it
   ----------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE ModuleKey = 'SERVICE')
    INSERT INTO dbo.Modules (ModuleKey, ModuleName, Description, Icon, SortOrder)
    VALUES ('SERVICE', 'Service Management',
            'Complaints, technicians, scheduling, spare parts, warranty and sales orders.',
            'build', 1);
GO

UPDATE dbo.MenuItems
SET AppModuleId = (SELECT ModuleId FROM dbo.Modules WHERE ModuleKey = 'SERVICE')
WHERE AppModuleId IS NULL;
GO

PRINT 'Company tenancy schema is in place. Run 14_Company_Tenancy_Cutover.sql during the release.';
GO
SET NOEXEC OFF;
GO
```

- [ ] **Step 2: Check the script for forbidden statements**

Run: `grep -nEi "^\s*USE |CREATE DATABASE|DROP TABLE|DROP DATABASE" EncryptzAPI/Database/MainDB/13_Company_Tenancy_Schema.sql`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add EncryptzAPI/Database/MainDB/13_Company_Tenancy_Schema.sql
git commit -m "Add main DB schema for company-level tenancy and modules"
```

---

### Task 7: Main DB cut-over script and rollback

**Files:**
- Create: `EncryptzAPI/Database/MainDB/14_Company_Tenancy_Cutover.sql`
- Create: `EncryptzAPI/Database/MainDB/15_Company_Tenancy_Rollback.sql`
- Reference: `docs/superpowers/plans/assets/2026-10-11-maindb-project-procs-live.sql` (the definitions being replaced)

**Interfaces:**
- Consumes: Task 6 tables and columns.
- Produces (result-set columns are what the C# tasks read):
  - `fn_ModuleUsers(@CompanyId INT, @ModuleKey NVARCHAR(50))` → `UserId, RoleInCompany`
  - `sp_Tenant_GetConnection(@TenantKey NVARCHAR(50))` → `CompanyId, CompanyName, TenantKey, TenantScopeId, ServerName, DatabaseName, DbUser, DbPasswordEnc, ExtraOptions`
  - `sp_User_GetCompanies(@UserId)` → previous columns + `ProvisionStatus`
  - `sp_User_GetModules(@UserId, @CompanyId)` → `ModuleId, ModuleKey, ModuleName, Description, Icon, SortOrder, CompanyEnabled, UserGranted, RoleInCompany`
  - `sp_User_ValidateScope(@UserId, @CompanyId, @ModuleKey)` → `CompanyId, TenantKey, TenantScopeId, ProvisionStatus, RoleInCompany, ModuleName, CompanyEnabled, UserGranted`
  - `sp_User_GetMenusForCompany(@UserId, @CompanyId, @ModuleKey = NULL)` → unchanged columns
  - `sp_User_UpdateSession(@UserId, @CompanyId, @AuthToken, @ProjectId = NULL, @LocationId = NULL)` → unchanged signature, `@ProjectId` ignored
  - `sp_Company_GetUsersForSync(@CompanyId, @UserId = NULL)` → table 0 `CompanyId, TenantKey, TenantScopeId`; table 1 `UserId, FullName, Email, MobileNumber, RoleInCompany`
  - `sp_Company_GrantDefaultModules(@CompanyId, @UserId, @GrantedBy = NULL)`
  - `sp_Company_InviteUser(@CompanyId, @Email, @RoleInCompany, @InvitedBy, @Remarks = NULL)` → `Success, Message, InvitationId`
  - `sp_Company_AcceptInvitation(@Token, @UserId)` → `Success, Message, CompanyId, RoleInCompany`
  - `sp_Company_CreateTechnicianUser(@CompanyId, @FullName, @Email, @MobileNumber, @CreatedBy = NULL)` → `Success, Message, UserId`
  - `sp_Mgmt_SaveUser(... @CompanyId = NULL, @SavedBy = NULL)` (no `@ProjectId`) → `UserId, Status, RoleName`
  - `sp_Platform_GetProject(@ProjectId)` where `@ProjectId` is a `CompanyId` → `ProjectId, CompanyId, ProjectName, ProjectKey, IsActive, TenantScopeId`
  - `sp_Platform_GetProjects`, `sp_Platform_SaveProject`, `sp_Platform_GetProjectAccess`, `sp_Platform_SetProjectAccess`, `sp_Platform_GetCompanies`: same signatures and columns as before; "project id" means `CompanyId`

In the platform procedures the word "project" is kept so the deployed UI works; a project is now the company's Service database. Plan 2 renames them.

- [ ] **Step 1: Write the cut-over script, part 1 (guards and data)**

Create `EncryptzAPI/Database/MainDB/14_Company_Tenancy_Cutover.sql` with this content (parts 2 to 4 are appended in the next steps):

```sql
/* =============================================================================
   MainDB · Company-level tenancy · 2 of 2 · CUT-OVER
   -----------------------------------------------------------------------------
   Run during the release, with the API STOPPED, after
   13_Company_Tenancy_Schema.sql.

     1. copies each company's project connection onto its Companies row
     2. turns project access into SERVICE module access
     3. replaces the login / membership / platform procedures
     4. renames Projects, ProjectConnections, UserProjectAccess to *_Old

   It stops WITHOUT changing anything when a company has more than one active
   project or a database is shared by two companies.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose. SAFE TO RE-RUN (after the rename it only refreshes the procedures).
   Undo: 15_Company_Tenancy_Rollback.sql
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb')
   OR OBJECT_ID('dbo.Companies') IS NULL
   OR OBJECT_ID('dbo.Modules') IS NULL
   OR COL_LENGTH('dbo.Companies', 'TenantKey') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database and run 13_Company_Tenancy_Schema.sql first.', 16, 1);
    SET NOEXEC ON;
END
GO

/* -----------------------------------------------------------------------------
   0. Pre-check: the data must already be one company = one database
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Projects') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.Projects WHERE IsActive = 1 GROUP BY CompanyId HAVING COUNT(*) > 1)
    BEGIN
        SELECT 'Company with more than one active project' AS Problem, p.CompanyId, p.ProjectId, p.ProjectName, p.ProjectKey
        FROM dbo.Projects p
        WHERE p.IsActive = 1
          AND p.CompanyId IN (SELECT CompanyId FROM dbo.Projects WHERE IsActive = 1 GROUP BY CompanyId HAVING COUNT(*) > 1);

        RAISERROR('A company has more than one active project. Nothing was changed.', 16, 1);
        SET NOEXEC ON;
    END

    IF EXISTS (SELECT 1
               FROM dbo.ProjectConnections pc
               INNER JOIN dbo.Projects p ON p.ProjectId = pc.ProjectId AND p.IsActive = 1
               WHERE pc.IsActive = 1
               GROUP BY pc.ServerName, pc.DatabaseName
               HAVING COUNT(DISTINCT p.CompanyId) > 1)
    BEGIN
        SELECT 'Database shared by more than one company' AS Problem, pc.ServerName, pc.DatabaseName, p.CompanyId, p.ProjectKey
        FROM dbo.ProjectConnections pc
        INNER JOIN dbo.Projects p ON p.ProjectId = pc.ProjectId AND p.IsActive = 1
        WHERE pc.IsActive = 1;

        RAISERROR('A database is shared by more than one company. Nothing was changed.', 16, 1);
        SET NOEXEC ON;
    END
END
GO

/* -----------------------------------------------------------------------------
   1. Copy connection + access (only while the project tables still exist)
   ----------------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Projects') IS NOT NULL
BEGIN
    BEGIN TRANSACTION;

    /* 1a. The company's routing key is its project key, so tokens issued before
           the release keep routing to the same database. */
    UPDATE c
    SET c.TenantKey       = p.ProjectKey,
        c.TenantScopeId   = p.ProjectId,
        c.ServerName      = pc.ServerName,
        c.DatabaseName    = pc.DatabaseName,
        c.DbUser          = pc.DbUser,
        c.DbPasswordEnc   = pc.DbPasswordEnc,
        c.ExtraOptions    = pc.ExtraOptions,
        c.ProvisionStatus = CASE WHEN pc.ProjectId IS NOT NULL AND pc.IsActive = 1
                                  AND ISNULL(pc.DbPasswordEnc, '') NOT IN ('', '<ENCRYPTED_PW>')
                                 THEN 'Ready' ELSE 'None' END
    FROM dbo.Companies c
    INNER JOIN dbo.Projects p            ON p.CompanyId = c.CompanyId AND p.IsActive = 1
    LEFT  JOIN dbo.ProjectConnections pc ON pc.ProjectId = p.ProjectId;

    /* 1b. Every company with a database has the Service module */
    INSERT INTO dbo.CompanyModules (CompanyId, ModuleId, IsEnabled)
    SELECT c.CompanyId, m.ModuleId, 1
    FROM dbo.Companies c
    CROSS JOIN dbo.Modules m
    WHERE m.ModuleKey = 'SERVICE'
      AND c.ProvisionStatus = 'Ready'
      AND NOT EXISTS (SELECT 1 FROM dbo.CompanyModules x WHERE x.CompanyId = c.CompanyId AND x.ModuleId = m.ModuleId);

    /* 1c. Whoever could enter the company's project can open the Service module */
    INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy, GrantedAt)
    SELECT DISTINCT p.CompanyId, upa.UserId, m.ModuleId, upa.GrantedBy, upa.GrantedAt
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects p      ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
    INNER JOIN dbo.CompanyUsers cu ON cu.CompanyId = p.CompanyId AND cu.UserId = upa.UserId
    CROSS JOIN dbo.Modules m
    WHERE m.ModuleKey = 'SERVICE'
      AND upa.IsActive = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess x
                      WHERE x.CompanyId = p.CompanyId AND x.UserId = upa.UserId AND x.ModuleId = m.ModuleId);

    COMMIT TRANSACTION;

    /* 1d. For information only: project grants of people who are not members.
           They could not enter before and cannot enter now. */
    SELECT 'Project grant without company membership (not migrated)' AS Info,
           p.CompanyId, upa.UserId, u.Email
    FROM dbo.UserProjectAccess upa
    INNER JOIN dbo.Projects p ON p.ProjectId = upa.ProjectId AND p.IsActive = 1
    LEFT  JOIN dbo.Users u    ON u.UserId = upa.UserId
    WHERE upa.IsActive = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers cu WHERE cu.CompanyId = p.CompanyId AND cu.UserId = upa.UserId);

    PRINT 'Connections and access copied to the company level.';
END
ELSE
    PRINT 'Project tables are already renamed: data copy skipped, procedures refreshed.';
GO
```

- [ ] **Step 2: Append part 2 (routing and login procedures)**

Append to the same file:

```sql
/* =============================================================================
   2. Routing + login
   ============================================================================= */

/* Members who may open a module of a company: the company has it, and the member
   is a company administrator or was granted it. Same rule as
   EncryptzBL.Common.Tenant.ModuleAccess — change both together. */
CREATE OR ALTER FUNCTION dbo.fn_ModuleUsers (@CompanyId INT, @ModuleKey NVARCHAR(50))
RETURNS TABLE
AS
RETURN
    SELECT cu.UserId, cu.RoleInCompany
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Modules m         ON m.ModuleKey = @ModuleKey AND m.IsActive = 1
    INNER JOIN dbo.CompanyModules cm ON cm.CompanyId = cu.CompanyId AND cm.ModuleId = m.ModuleId AND cm.IsEnabled = 1
    WHERE cu.CompanyId = @CompanyId
      AND cu.IsActive = 1
      AND (   LTRIM(RTRIM(cu.RoleInCompany)) IN ('Admin', 'CompanyAdmin')
           OR EXISTS (SELECT 1 FROM dbo.UserModuleAccess uma
                      WHERE uma.CompanyId = cu.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId));
GO

/* Used by IConnectionResolver: the registry row of a tenant key.
   Only an active company whose database is Ready is routable. */
CREATE OR ALTER PROCEDURE dbo.sp_Tenant_GetConnection
    @TenantKey NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        c.CompanyId, c.CompanyName, c.TenantKey, c.TenantScopeId,
        c.ServerName, c.DatabaseName, c.DbUser, c.DbPasswordEnc, c.ExtraOptions
    FROM dbo.Companies c
    WHERE c.TenantKey = @TenantKey
      AND c.IsActive = 1
      AND c.ProvisionStatus = 'Ready';
END
GO

/* Companies the user is an ACTIVE MEMBER of (a company whose database is not
   ready yet is listed too, with its status). */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetCompanies
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.CompanyId, c.CompanyName, c.CompanyCode, c.Address, c.City, c.PhoneNumber,
        cu.RoleInCompany,
        CAST(CASE WHEN us.SelectedCompanyId = c.CompanyId THEN 1 ELSE 0 END AS BIT) AS IsLinked,
        c.ProvisionStatus
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Companies c     ON c.CompanyId = cu.CompanyId AND c.IsActive = 1
    LEFT  JOIN dbo.UserSessions us ON us.UserId = cu.UserId
    WHERE cu.UserId = @UserId
      AND cu.IsActive = 1
    ORDER BY c.CompanyName;
END
GO

/* The whole catalogue, with what the API needs to decide each module's state.
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
        ISNULL(cu.RoleInCompany, '')                                  AS RoleInCompany
    FROM dbo.Modules m
    LEFT JOIN dbo.CompanyModules cm    ON cm.ModuleId = m.ModuleId AND cm.CompanyId = @CompanyId
    LEFT JOIN dbo.UserModuleAccess uma ON uma.ModuleId = m.ModuleId AND uma.CompanyId = @CompanyId AND uma.UserId = @UserId
    LEFT JOIN dbo.CompanyUsers cu      ON cu.CompanyId = @CompanyId AND cu.UserId = @UserId AND cu.IsActive = 1
    WHERE m.IsActive = 1
    ORDER BY m.SortOrder, m.ModuleName;
END
GO

/* One row when the user is an active member of an active company and the module
   exists; the API decides from the flags. No row = not a member / unknown module. */
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
        CAST(CASE WHEN uma.UserId IS NULL THEN 0 ELSE 1 END AS BIT) AS UserGranted
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Companies c         ON c.CompanyId = cu.CompanyId AND c.IsActive = 1
    INNER JOIN dbo.Modules m           ON m.ModuleKey = @ModuleKey AND m.IsActive = 1
    LEFT  JOIN dbo.CompanyModules cm   ON cm.CompanyId = c.CompanyId AND cm.ModuleId = m.ModuleId
    LEFT  JOIN dbo.UserModuleAccess uma ON uma.CompanyId = c.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1;
END
GO

/* Persist the current company / branch + token. @ProjectId is accepted and
   ignored (projects no longer exist). */
CREATE OR ALTER PROCEDURE dbo.sp_User_UpdateSession
    @UserId     INT,
    @CompanyId  INT,
    @AuthToken  NVARCHAR(MAX),
    @ProjectId  INT = NULL,
    @LocationId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dbo.UserSessions AS tgt
    USING (SELECT @UserId AS UserId) AS src
        ON tgt.UserId = src.UserId
    WHEN MATCHED THEN
        UPDATE SET SelectedCompanyId = @CompanyId,
                   SelectedProjectId = NULL,
                   SelectedLocationId = @LocationId,
                   AuthToken = @AuthToken,
                   UpdatedAt = GETDATE()
    WHEN NOT MATCHED THEN
        INSERT (UserId, SelectedCompanyId, SelectedProjectId, SelectedLocationId, AuthToken)
        VALUES (@UserId, @CompanyId, NULL, @LocationId, @AuthToken);
END
GO

/* Menus of the user's role in the company, limited to one module when given,
   plus the parent of every granted child (the sidebar flattens a child whose
   parent is missing). */
CREATE OR ALTER PROCEDURE dbo.sp_User_GetMenusForCompany
    @UserId    INT,
    @CompanyId INT,
    @ModuleKey NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RoleId INT, @ModuleId INT;

    SELECT @RoleId = r.RoleId
    FROM dbo.CompanyUsers cu
    INNER JOIN dbo.Roles r ON r.RoleName = cu.RoleInCompany
    WHERE cu.UserId = @UserId
      AND cu.CompanyId = @CompanyId
      AND cu.IsActive = 1;

    IF NULLIF(@ModuleKey, '') IS NOT NULL
        SELECT @ModuleId = ModuleId FROM dbo.Modules WHERE ModuleKey = @ModuleKey;

    ;WITH Granted AS
    (
        SELECT m.MenuId, m.MenuName, m.MenuPath, m.Icon, m.ParentMenuId, m.SortOrder,
               rma.CanView, rma.CanCreate, rma.CanEdit, rma.CanDelete
        FROM dbo.MenuItems m
        INNER JOIN dbo.RoleMenuAccess rma
                ON rma.MenuId = m.MenuId AND rma.RoleId = @RoleId AND rma.CanView = 1
        WHERE m.IsActive = 1
          AND (@ModuleId IS NULL OR m.AppModuleId IS NULL OR m.AppModuleId = @ModuleId)
    )
    SELECT MenuId, MenuName, MenuPath, Icon, ParentMenuId, SortOrder,
           CanView, CanCreate, CanEdit, CanDelete
    FROM Granted

    UNION ALL

    SELECT p.MenuId, p.MenuName, p.MenuPath, p.Icon, p.ParentMenuId, p.SortOrder,
           CAST(1 AS BIT), CAST(0 AS BIT), CAST(0 AS BIT), CAST(0 AS BIT)
    FROM dbo.MenuItems p
    WHERE p.IsActive = 1
      AND p.MenuId IN (SELECT g.ParentMenuId FROM Granted g WHERE g.ParentMenuId IS NOT NULL)
      AND p.MenuId NOT IN (SELECT g.MenuId FROM Granted g)

    ORDER BY SortOrder, MenuId;
END
GO

/* The company's routing info and the users the tenant DB must mirror:
   every active user who may open the Service module. */
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
      AND c.ProvisionStatus = 'Ready';

    SELECT u.UserId, u.FullName, u.Email, u.MobileNumber, mu.RoleInCompany
    FROM dbo.fn_ModuleUsers(@CompanyId, 'SERVICE') mu
    INNER JOIN dbo.Users u ON u.UserId = mu.UserId AND u.IsActive = 1
    WHERE @UserId IS NULL OR u.UserId = @UserId
    ORDER BY u.UserId;
END
GO
```

- [ ] **Step 3: Append part 3 (membership procedures)**

Append to the same file:

```sql
/* =============================================================================
   3. Membership: invitations, join requests, users, technicians
   ============================================================================= */

/* Gives a member every module the company has that they do not have yet. */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GrantDefaultModules
    @CompanyId INT,
    @UserId    INT,
    @GrantedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
    SELECT cm.CompanyId, @UserId, cm.ModuleId, @GrantedBy
    FROM dbo.CompanyModules cm
    WHERE cm.CompanyId = @CompanyId
      AND cm.IsEnabled = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess x
                      WHERE x.CompanyId = cm.CompanyId AND x.UserId = @UserId AND x.ModuleId = cm.ModuleId);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_InviteUser
    @CompanyId     INT,
    @Email         NVARCHAR(256),
    @RoleInCompany NVARCHAR(100),
    @InvitedBy     INT,
    @Remarks       NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewId INT, @UserId INT;

    SET @Email = LTRIM(RTRIM(@Email));

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message, CAST(0 AS INT) AS InvitationId;
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.Invitations
               WHERE CompanyId = @CompanyId AND Email = @Email
                 AND Status = 'Pending' AND ExpiresAt > GETDATE())
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'An invitation is already pending for this email' AS Message,
               CAST(0 AS INT) AS InvitationId;
        RETURN;
    END

    SELECT @UserId = UserId FROM dbo.Users WHERE Email = @Email;

    IF @UserId IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.CompanyUsers
                   WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This user is already a member of the company' AS Message,
               CAST(0 AS INT) AS InvitationId;
        RETURN;
    END

    /* Expired leftovers would block a new invitation in the UI lists */
    UPDATE dbo.Invitations SET Status = 'Expired'
    WHERE CompanyId = @CompanyId AND Email = @Email AND Status = 'Pending' AND ExpiresAt <= GETDATE();

    INSERT INTO dbo.Invitations (CompanyId, Email, RoleInCompany, Status, Remarks, InvitedBy, ExpiresAt)
    VALUES (@CompanyId, @Email, @RoleInCompany, 'Pending', @Remarks, @InvitedBy, DATEADD(DAY, 7, GETDATE()));

    SET @NewId = SCOPE_IDENTITY();

    SELECT CAST(1 AS INT) AS Success, 'Invitation sent' AS Message, @NewId AS InvitationId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_AcceptInvitation
    @Token  UNIQUEIDENTIFIER,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CompanyId INT, @Role NVARCHAR(100), @InvitedEmail NVARCHAR(256), @InvitedBy INT;

    BEGIN TRY
        SELECT TOP 1
            @CompanyId = CompanyId, @Role = RoleInCompany,
            @InvitedEmail = Email, @InvitedBy = InvitedBy
        FROM dbo.Invitations
        WHERE Token = @Token
          AND Status = 'Pending'
          AND ExpiresAt > GETDATE();

        IF @CompanyId IS NULL
        BEGIN
            SELECT CAST(0 AS INT) AS Success, 'Invitation invalid or expired' AS Message,
                   CAST(0 AS INT) AS CompanyId, CAST('' AS NVARCHAR(100)) AS RoleInCompany;
            RETURN;
        END

        /* Only the invited person may accept */
        IF NOT EXISTS (SELECT 1 FROM dbo.Users
                       WHERE UserId = @UserId AND IsActive = 1 AND Email = @InvitedEmail)
        BEGIN
            SELECT CAST(0 AS INT) AS Success, 'This invitation was sent to a different email' AS Message,
                   @CompanyId AS CompanyId, @Role AS RoleInCompany;
            RETURN;
        END

        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
            INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
            VALUES (@CompanyId, @UserId, @Role, @InvitedBy, 1);
        ELSE
            UPDATE dbo.CompanyUsers
            SET RoleInCompany = @Role, IsActive = 1
            WHERE CompanyId = @CompanyId AND UserId = @UserId;

        EXEC dbo.sp_Company_GrantDefaultModules @CompanyId = @CompanyId, @UserId = @UserId, @GrantedBy = @InvitedBy;

        UPDATE dbo.Invitations
        SET Status = 'Accepted'
        WHERE Token = @Token AND Status = 'Pending';

        COMMIT TRANSACTION;

        SELECT CAST(1 AS INT) AS Success, 'Invitation accepted' AS Message,
               @CompanyId AS CompanyId, @Role AS RoleInCompany;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        SELECT CAST(0 AS INT) AS Success, 'Could not accept the invitation' AS Message,
               CAST(0 AS INT) AS CompanyId, CAST('' AS NVARCHAR(100)) AS RoleInCompany;
    END CATCH
END
GO

/* ProjectId / ProjectName stay in the result (0 / '') for the deployed UI. */
CREATE OR ALTER PROCEDURE dbo.sp_Company_GetPendingInvitations
    @CompanyId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT i.InvitationId, i.Email, i.RoleInCompany, i.Status, i.ExpiresAt, i.CreatedAt,
           ISNULL(u.FullName, 'System') AS CreatedByName,
           CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(200)) AS ProjectName
    FROM dbo.Invitations i
    LEFT JOIN dbo.Users u ON u.UserId = i.InvitedBy
    WHERE i.CompanyId = @CompanyId AND i.Status = 'Pending' AND i.ExpiresAt > GETDATE()
    ORDER BY i.CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_User_GetPendingInvitations
    @Email NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        i.InvitationId, i.CompanyId,
        CAST(0 AS INT) AS ProjectId,
        c.CompanyName,
        CAST('' AS NVARCHAR(200)) AS ProjectName,
        i.RoleInCompany, i.Token, i.ExpiresAt,
        ISNULL(u.FullName, 'System') AS InvitedByName
    FROM dbo.Invitations AS i
    INNER JOIN dbo.Companies AS c ON c.CompanyId = i.CompanyId AND c.IsActive = 1
    LEFT  JOIN dbo.Users     AS u ON u.UserId = i.InvitedBy
    WHERE i.Email = @Email
      AND i.Status = 'Pending'
      AND i.ExpiresAt > GETDATE()
    ORDER BY i.ExpiresAt ASC;
END
GO

/* Approval makes the user a member and gives them the company's modules. */
CREATE OR ALTER PROCEDURE dbo.sp_Company_ApproveRequest
    @RequestId  INT,
    @CompanyId  INT,
    @ReviewedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UserId INT, @Role NVARCHAR(100);
    SELECT @UserId = UserId, @Role = RequestedRole
    FROM dbo.JoinRequests
    WHERE RequestId = @RequestId AND CompanyId = @CompanyId AND Status = 'Pending';

    IF @UserId IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Request not found or already handled' AS Message; RETURN;
    END

    BEGIN TRANSACTION;

    IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
        INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
        VALUES (@CompanyId, @UserId, @Role, @ReviewedBy, 1);
    ELSE
        UPDATE dbo.CompanyUsers SET RoleInCompany = @Role, IsActive = 1
        WHERE CompanyId = @CompanyId AND UserId = @UserId;

    EXEC dbo.sp_Company_GrantDefaultModules @CompanyId = @CompanyId, @UserId = @UserId, @GrantedBy = @ReviewedBy;

    UPDATE dbo.JoinRequests SET Status = 'Approved', ReviewedBy = @ReviewedBy WHERE RequestId = @RequestId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, 'Request approved' AS Message;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Company_RemoveUser
    @CompanyId INT,
    @UserId    INT,
    @RemovedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Removed INT;

    IF @UserId = @RemovedBy
    BEGIN
        SELECT CAST(0 AS INT) AS RemovedCount;   -- an admin cannot remove themselves
        RETURN;
    END

    BEGIN TRANSACTION;

    UPDATE dbo.CompanyUsers SET IsActive = 0
    WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1;
    SET @Removed = @@ROWCOUNT;

    DELETE FROM dbo.UserModuleAccess
    WHERE CompanyId = @CompanyId AND UserId = @UserId;

    UPDATE dbo.UserSessions
    SET SelectedCompanyId = NULL, SelectedProjectId = NULL, SelectedLocationId = NULL
    WHERE UserId = @UserId AND SelectedCompanyId = @CompanyId;

    COMMIT TRANSACTION;

    SELECT @Removed AS RemovedCount;
END
GO

/* Called by the Technicians page ("Add technician"). The technician is a MainDB
   user: reuse the account when the email is already registered, otherwise create
   it without a password (the technician sets one via Forgot Password). */
CREATE OR ALTER PROCEDURE dbo.sp_Company_CreateTechnicianUser
    @CompanyId    INT,
    @FullName     NVARCHAR(200),
    @Email        NVARCHAR(256),
    @MobileNumber NVARCHAR(20),
    @CreatedBy    INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UserId INT, @ExistingRole NVARCHAR(100);

    IF NULLIF(LTRIM(RTRIM(@Email)), '') IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Email is required to create a technician login' AS Message, CAST(0 AS INT) AS UserId;
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId AND IsActive = 1)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message, CAST(0 AS INT) AS UserId;
        RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT TOP 1 @UserId = UserId FROM dbo.Users WHERE Email = @Email;

        IF @UserId IS NULL AND NULLIF(LTRIM(RTRIM(@MobileNumber)), '') IS NOT NULL
        BEGIN
            IF EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber)
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT CAST(0 AS INT) AS Success, 'Mobile number is already registered with a different email' AS Message, CAST(0 AS INT) AS UserId;
                RETURN;
            END
        END

        IF @UserId IS NULL
        BEGIN
            INSERT INTO dbo.Users (FullName, Email, MobileNumber, PasswordHash, RoleId, IsActive)
            VALUES (@FullName, @Email, NULLIF(LTRIM(RTRIM(@MobileNumber)), ''), NULL,
                    (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleName = 'Technician'), 1);

            SET @UserId = SCOPE_IDENTITY();
        END

        SELECT @ExistingRole = RoleInCompany
        FROM dbo.CompanyUsers
        WHERE CompanyId = @CompanyId AND UserId = @UserId AND IsActive = 1;

        IF @ExistingRole IS NOT NULL AND @ExistingRole <> 'Technician'
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS INT) AS Success,
                   'This user is already a ' + @ExistingRole + ' in the company. Change the role from User Management instead.' AS Message,
                   CAST(0 AS INT) AS UserId;
            RETURN;
        END

        IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
            INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
            VALUES (@CompanyId, @UserId, 'Technician', @CreatedBy, 1);
        ELSE
            UPDATE dbo.CompanyUsers
            SET RoleInCompany = 'Technician', IsActive = 1
            WHERE CompanyId = @CompanyId AND UserId = @UserId;

        /* A technician works in the Service module */
        INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
        SELECT @CompanyId, @UserId, m.ModuleId, @CreatedBy
        FROM dbo.Modules m
        WHERE m.ModuleKey = 'SERVICE'
          AND NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess x
                          WHERE x.CompanyId = @CompanyId AND x.UserId = @UserId AND x.ModuleId = m.ModuleId);

        COMMIT TRANSACTION;

        SELECT CAST(1 AS INT) AS Success, 'Technician user ready' AS Message, @UserId AS UserId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT CAST(0 AS INT) AS Success, 'Could not create the technician user' AS Message, CAST(0 AS INT) AS UserId;
    END CATCH
END
GO

/* Saves the login and, when a company is given, the user's role in that company.
   A member added here gets the company's modules. UserId = 0 in the result means
   nothing was saved and Status carries the reason. */
CREATE OR ALTER PROCEDURE dbo.sp_Mgmt_SaveUser
    @UserId       INT,
    @FullName     NVARCHAR(200),
    @Email        NVARCHAR(256),
    @MobileNumber NVARCHAR(20),
    @RoleId       INT,
    @IsActive     BIT,
    @PasswordHash NVARCHAR(200) = NULL,
    @CompanyId    INT = NULL,
    @SavedBy      INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Status NVARCHAR(100), @RoleName NVARCHAR(100), @NewMember BIT = 0;

    SET @UserId       = ISNULL(@UserId, 0);
    SET @MobileNumber = NULLIF(LTRIM(RTRIM(@MobileNumber)), '');
    SELECT @RoleName = RoleName FROM dbo.Roles WHERE RoleId = @RoleId;

    IF NULLIF(LTRIM(RTRIM(@Email)), '') IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS UserId, 'Email is required' AS Status, CAST('' AS NVARCHAR(100)) AS RoleName; RETURN;
    END
    IF @RoleName IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS UserId, 'Role not found' AS Status, CAST('' AS NVARCHAR(100)) AS RoleName; RETURN;
    END
    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email AND UserId <> @UserId)
    BEGIN
        SELECT CAST(0 AS INT) AS UserId, 'Email already registered' AS Status, @RoleName AS RoleName; RETURN;
    END
    IF @MobileNumber IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.Users WHERE MobileNumber = @MobileNumber AND UserId <> @UserId)
    BEGIN
        SELECT CAST(0 AS INT) AS UserId, 'Mobile number already registered' AS Status, @RoleName AS RoleName; RETURN;
    END
    /* A company admin may only edit members of the own company */
    IF @UserId > 0 AND ISNULL(@CompanyId, 0) > 0
       AND NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
    BEGIN
        SELECT CAST(0 AS INT) AS UserId, 'User does not belong to this company' AS Status, @RoleName AS RoleName; RETURN;
    END

    BEGIN TRANSACTION;

    IF @UserId = 0
    BEGIN
        INSERT INTO dbo.Users (FullName, Email, MobileNumber, RoleId, IsActive, PasswordHash)
        VALUES (@FullName, @Email, @MobileNumber, @RoleId, @IsActive, @PasswordHash);
        SET @UserId = SCOPE_IDENTITY();
        SET @Status = 'Inserted';
    END
    ELSE
    BEGIN
        UPDATE dbo.Users
        SET FullName = @FullName, Email = @Email, MobileNumber = @MobileNumber,
            IsActive = @IsActive,
            -- the global role is only changed from the platform (no company) context
            RoleId = CASE WHEN ISNULL(@CompanyId, 0) = 0 THEN @RoleId ELSE ISNULL(RoleId, @RoleId) END,
            PasswordHash = CASE WHEN @PasswordHash IS NULL THEN PasswordHash ELSE @PasswordHash END
        WHERE UserId = @UserId;
        SET @Status = 'Updated';
    END

    IF ISNULL(@CompanyId, 0) > 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @UserId)
        BEGIN
            INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
            VALUES (@CompanyId, @UserId, @RoleName, @SavedBy, @IsActive);
            SET @NewMember = 1;
        END
        ELSE
            UPDATE dbo.CompanyUsers
            SET RoleInCompany = @RoleName, IsActive = @IsActive
            WHERE CompanyId = @CompanyId AND UserId = @UserId;

        /* Only a NEW member gets the modules: an administrator may have taken a
           module away from an existing member on purpose. */
        IF @NewMember = 1
            EXEC dbo.sp_Company_GrantDefaultModules @CompanyId = @CompanyId, @UserId = @UserId, @GrantedBy = @SavedBy;
    END

    COMMIT TRANSACTION;

    SELECT @UserId AS UserId, @Status AS Status, @RoleName AS RoleName;
END
GO
```

- [ ] **Step 4: Append part 4 (platform procedures and the rename)**

Append to the same file:

```sql
/* =============================================================================
   4. Platform administration
      The procedure and column names still say "project": the deployed Platform
      Admin screen reads them. A "project" is now the company's Service database
      and its id is the CompanyId.
   ============================================================================= */

CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetCompanies
    @CompanyId INT = NULL          -- NULL/0 = all (platform admin)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.CompanyId, c.CompanyName, c.CompanyCode,
        ISNULL(c.Address, '')     AS Address,
        ISNULL(c.City, '')        AS City,
        ISNULL(c.PhoneNumber, '') AS PhoneNumber,
        c.IsActive, c.CreatedAt,
        CASE WHEN c.ProvisionStatus = 'None' THEN 0 ELSE 1 END AS ProjectCount,
        (SELECT COUNT(*) FROM dbo.CompanyUsers cu WHERE cu.CompanyId = c.CompanyId AND cu.IsActive = 1) AS UserCount
    FROM dbo.Companies c
    WHERE ISNULL(@CompanyId, 0) = 0 OR c.CompanyId = @CompanyId
    ORDER BY c.CompanyName;
END
GO

/* @ProjectId is a CompanyId */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetProject
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.CompanyId AS ProjectId, c.CompanyId,
           CAST('Service Management' AS NVARCHAR(200)) AS ProjectName,
           ISNULL(c.TenantKey, '') AS ProjectKey,
           c.IsActive, c.TenantScopeId
    FROM dbo.Companies c
    WHERE c.CompanyId = @ProjectId;
END
GO

/* One row per company that has a database
   (the password is never returned; HasPassword tells whether one is stored). */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetProjects
    @CompanyId INT = NULL          -- NULL/0 = all (platform admin)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.CompanyId AS ProjectId, c.CompanyId, c.CompanyName,
        CAST('Service Management' AS NVARCHAR(200)) AS ProjectName,
        ISNULL(c.TenantKey, '') AS ProjectKey,
        /* "project active" is what sp_Platform_SaveProject stores as the database status */
        CAST(CASE WHEN c.ProvisionStatus = 'Ready' THEN 1 ELSE 0 END AS BIT) AS IsActive,
        c.CreatedAt,
        ISNULL(c.ServerName, '')   AS ServerName,
        ISNULL(c.DatabaseName, '') AS DatabaseName,
        ISNULL(c.DbUser, '')       AS DbUser,
        ISNULL(c.ExtraOptions, '') AS ExtraOptions,
        CAST(CASE WHEN ISNULL(c.DbPasswordEnc, '') IN ('', '<ENCRYPTED_PW>') THEN 0 ELSE 1 END AS BIT) AS HasPassword,
        CAST(CASE WHEN c.ProvisionStatus = 'Ready' THEN 1 ELSE 0 END AS BIT) AS ConnectionActive,
        (SELECT COUNT(*) FROM dbo.fn_ModuleUsers(c.CompanyId, 'SERVICE')) AS UserCount
    FROM dbo.Companies c
    WHERE (ISNULL(@CompanyId, 0) = 0 OR c.CompanyId = @CompanyId)
      AND c.ProvisionStatus <> 'None'
    ORDER BY c.CompanyName;
END
GO

/* Attaches / changes the database of a company.
   @ProjectId is ignored (the company is the key). @ProjectKey sets the routing
   key only while the company has none: a key in use must stay stable.
   @DbPasswordEnc NULL = keep the stored password.
   ProjectId = 0 in the result means nothing was saved. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SaveProject
    @ProjectId     INT,
    @CompanyId     INT,
    @ProjectName   NVARCHAR(200),
    @ProjectKey    NVARCHAR(50),
    @IsActive      BIT = 1,
    @ServerName    NVARCHAR(200),
    @DatabaseName  NVARCHAR(200),
    @DbUser        NVARCHAR(100),
    @DbPasswordEnc NVARCHAR(500) = NULL,
    @ExtraOptions  NVARCHAR(400) = NULL,
    @SavedBy       INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @CurrentKey NVARCHAR(50), @Message NVARCHAR(200), @HadDatabase BIT;

    SET @ProjectKey   = UPPER(LTRIM(RTRIM(ISNULL(@ProjectKey, ''))));
    SET @ServerName   = LTRIM(RTRIM(ISNULL(@ServerName, '')));
    SET @DatabaseName = LTRIM(RTRIM(ISNULL(@DatabaseName, '')));
    SET @DbUser       = LTRIM(RTRIM(ISNULL(@DbUser, '')));
    SET @ExtraOptions = NULLIF(LTRIM(RTRIM(ISNULL(@ExtraOptions, ''))), '');
    SET @DbPasswordEnc = NULLIF(@DbPasswordEnc, '');

    IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyId = @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company not found' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END

    SELECT @CurrentKey = NULLIF(TenantKey, ''),
           @HadDatabase = CASE WHEN ProvisionStatus = 'None' THEN 0 ELSE 1 END
    FROM dbo.Companies WHERE CompanyId = @CompanyId;

    IF @CurrentKey IS NULL AND @ProjectKey = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'A key is required' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF @ServerName = '' OR @DatabaseName = '' OR @DbUser = ''
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Server, database and database user are required' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF @CurrentKey IS NULL
       AND EXISTS (SELECT 1 FROM dbo.Companies WHERE TenantKey = @ProjectKey AND CompanyId <> @CompanyId)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The key is already used' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF EXISTS (SELECT 1 FROM dbo.Companies
               WHERE CompanyId <> @CompanyId AND ServerName = @ServerName AND DatabaseName = @DatabaseName)
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'This database already belongs to another company' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END
    IF @DbPasswordEnc IS NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.Companies
                       WHERE CompanyId = @CompanyId AND ISNULL(DbPasswordEnc, '') NOT IN ('', '<ENCRYPTED_PW>'))
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Database password is required' AS Message, CAST(0 AS INT) AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey; RETURN;
    END

    BEGIN TRANSACTION;

    UPDATE dbo.Companies
    SET TenantKey       = ISNULL(@CurrentKey, @ProjectKey),
        ServerName      = @ServerName,
        DatabaseName    = @DatabaseName,
        DbUser          = @DbUser,
        DbPasswordEnc   = ISNULL(@DbPasswordEnc, DbPasswordEnc),
        ExtraOptions    = @ExtraOptions,
        ProvisionStatus = CASE WHEN ISNULL(@IsActive, 1) = 1 THEN 'Ready' ELSE 'Failed' END
    WHERE CompanyId = @CompanyId;

    SET @Message = CASE WHEN @HadDatabase = 1 THEN 'Database updated' ELSE 'Database attached' END;

    IF @HadDatabase = 0
    BEGIN
        /* a company with a database has the Service module */
        INSERT INTO dbo.CompanyModules (CompanyId, ModuleId, IsEnabled)
        SELECT @CompanyId, m.ModuleId, 1
        FROM dbo.Modules m
        WHERE m.ModuleKey = 'SERVICE'
          AND NOT EXISTS (SELECT 1 FROM dbo.CompanyModules x WHERE x.CompanyId = @CompanyId AND x.ModuleId = m.ModuleId);

        /* whoever attaches it can enter it */
        IF @SavedBy IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @SavedBy)
           AND NOT EXISTS (SELECT 1 FROM dbo.CompanyUsers WHERE CompanyId = @CompanyId AND UserId = @SavedBy)
            INSERT INTO dbo.CompanyUsers (CompanyId, UserId, RoleInCompany, AssignedBy, IsActive)
            VALUES (@CompanyId, @SavedBy, 'Admin', @SavedBy, 1);
    END

    COMMIT TRANSACTION;

    SELECT CAST(1 AS INT) AS Success, @Message AS Message, @CompanyId AS ProjectId, CAST('' AS NVARCHAR(50)) AS OldProjectKey;
END
GO

/* The company's members, with whether they may open the Service module.
   @ProjectId is a CompanyId. */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_GetProjectAccess
    @ProjectId INT
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
    INNER JOIN dbo.Users u    ON u.UserId = cu.UserId AND u.IsActive = 1
    LEFT  JOIN dbo.Modules m  ON m.ModuleKey = 'SERVICE'
    LEFT  JOIN dbo.UserModuleAccess uma ON uma.CompanyId = cu.CompanyId AND uma.UserId = cu.UserId AND uma.ModuleId = m.ModuleId
    LEFT  JOIN dbo.Users gb   ON gb.UserId = uma.GrantedBy
    WHERE cu.CompanyId = @ProjectId
      AND cu.IsActive = 1
    ORDER BY u.FullName;
END
GO

/* @ProjectId is a CompanyId */
CREATE OR ALTER PROCEDURE dbo.sp_Platform_SetProjectAccess
    @ProjectId INT,
    @UserId    INT,
    @HasAccess BIT,
    @GrantedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Role NVARCHAR(100), @ModuleId INT;

    SELECT @Role = RoleInCompany
    FROM dbo.CompanyUsers
    WHERE CompanyId = @ProjectId AND UserId = @UserId AND IsActive = 1;

    IF @Role IS NULL
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'The user is not an active member of the company' AS Message; RETURN;
    END

    IF @HasAccess = 0 AND @UserId = @GrantedBy
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'You cannot remove your own access' AS Message; RETURN;
    END

    IF @HasAccess = 0 AND LTRIM(RTRIM(@Role)) IN ('Admin', 'CompanyAdmin')
    BEGIN
        SELECT CAST(0 AS INT) AS Success, 'Company administrators always have access. Change the role instead.' AS Message; RETURN;
    END

    SELECT @ModuleId = ModuleId FROM dbo.Modules WHERE ModuleKey = 'SERVICE';

    IF @HasAccess = 1
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.UserModuleAccess WHERE CompanyId = @ProjectId AND UserId = @UserId AND ModuleId = @ModuleId)
            INSERT INTO dbo.UserModuleAccess (CompanyId, UserId, ModuleId, GrantedBy)
            VALUES (@ProjectId, @UserId, @ModuleId, @GrantedBy);
    END
    ELSE
        DELETE FROM dbo.UserModuleAccess
        WHERE CompanyId = @ProjectId AND UserId = @UserId AND ModuleId = @ModuleId;

    SELECT CAST(1 AS INT) AS Success,
           CASE WHEN @HasAccess = 1 THEN 'Access granted' ELSE 'Access removed' END AS Message;
END
GO

/* =============================================================================
   5. Retire the project tables (kept as *_Old for the rollback script)
   ============================================================================= */
IF OBJECT_ID('dbo.Projects') IS NOT NULL
BEGIN
    DECLARE @fk SYSNAME, @sql NVARCHAR(400);

    /* UserSessions.SelectedProjectId no longer points anywhere */
    SELECT @fk = fk.name
    FROM sys.foreign_keys fk
    WHERE fk.parent_object_id = OBJECT_ID('dbo.UserSessions')
      AND fk.referenced_object_id = OBJECT_ID('dbo.Projects');

    IF @fk IS NOT NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.UserSessions DROP CONSTRAINT ' + QUOTENAME(@fk) + N';';
        EXEC sp_executesql @sql;
    END

    UPDATE dbo.UserSessions SET SelectedProjectId = NULL WHERE SelectedProjectId IS NOT NULL;

    EXEC sp_rename 'dbo.UserProjectAccess',  'UserProjectAccess_Old';
    EXEC sp_rename 'dbo.ProjectConnections', 'ProjectConnections_Old';
    EXEC sp_rename 'dbo.Projects',           'Projects_Old';

    PRINT 'Projects, ProjectConnections and UserProjectAccess renamed to *_Old.';
END
GO

/* The procedures below read the renamed tables and are no longer called. */
DROP PROCEDURE IF EXISTS dbo.sp_Project_GetConnection;
DROP PROCEDURE IF EXISTS dbo.sp_Project_GetUsersForSync;
DROP PROCEDURE IF EXISTS dbo.sp_User_GetProjects;
DROP PROCEDURE IF EXISTS dbo.sp_User_ValidateProject;
GO

SELECT CompanyId, CompanyName, CompanyCode, TenantKey, TenantScopeId, DatabaseName, ProvisionStatus,
       (SELECT COUNT(*) FROM dbo.fn_ModuleUsers(c.CompanyId, 'SERVICE')) AS ServiceUsers
FROM dbo.Companies c
ORDER BY CompanyId;

PRINT 'Company-level tenancy cut-over complete.';
GO
SET NOEXEC OFF;
GO
```

- [ ] **Step 5: Write the rollback script**

Create `EncryptzAPI/Database/MainDB/15_Company_Tenancy_Rollback.sql` by running this from the repository root (it writes the header, then the previous definitions of every replaced procedure taken from the live snapshot):

```bash
{
cat <<'EOF'
/* =============================================================================
   MainDB · Company-level tenancy · ROLLBACK of 14_Company_Tenancy_Cutover.sql
   -----------------------------------------------------------------------------
   Run with the API STOPPED, then redeploy the previous API and UI.

     1. renames Projects_Old, ProjectConnections_Old, UserProjectAccess_Old back
     2. restores the procedures as they were on 2026-10-11

   The new columns and tables (13_Company_Tenancy_Schema.sql) are left in place;
   the previous API ignores them.

   NOT restored: module access granted or removed AFTER the cut-over is not copied
   back to UserProjectAccess, and the UserSessions -> Projects foreign key is not
   recreated.

   Select the SaaS main database in SSMS before running. No USE statement on
   purpose.
   ============================================================================= */
SET NOCOUNT ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Companies') IS NULL
BEGIN
    RAISERROR('Select the SaaS main database before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.Projects') IS NULL AND OBJECT_ID('dbo.Projects_Old') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.Projects_Old',           'Projects';
    EXEC sp_rename 'dbo.ProjectConnections_Old', 'ProjectConnections';
    EXEC sp_rename 'dbo.UserProjectAccess_Old',  'UserProjectAccess';
    PRINT 'Project tables restored.';
END
GO

IF OBJECT_ID('dbo.Projects') IS NULL
BEGIN
    RAISERROR('dbo.Projects does not exist and there is no dbo.Projects_Old to restore.', 16, 1);
    SET NOEXEC ON;
END
GO

EOF
sed -E 's/\r$//; 1,4d; s/^CREATE +(PROCEDURE|FUNCTION)/CREATE OR ALTER \1/' \
    docs/superpowers/plans/assets/2026-10-11-maindb-project-procs-live.sql
cat <<'EOF'

PRINT 'Rollback complete. Redeploy the previous API and UI.';
GO
SET NOEXEC OFF;
GO
EOF
} > EncryptzAPI/Database/MainDB/15_Company_Tenancy_Rollback.sql
```

- [ ] **Step 6: Check both scripts**

Run:

```bash
grep -nEi "^\s*USE |CREATE DATABASE|DROP DATABASE|DROP TABLE" EncryptzAPI/Database/MainDB/14_Company_Tenancy_Cutover.sql EncryptzAPI/Database/MainDB/15_Company_Tenancy_Rollback.sql
grep -c "^CREATE OR ALTER" EncryptzAPI/Database/MainDB/14_Company_Tenancy_Cutover.sql
grep -c "^CREATE OR ALTER PROCEDURE" EncryptzAPI/Database/MainDB/15_Company_Tenancy_Rollback.sql
grep -n "^CREATE   PROCEDURE\|^CREATE PROCEDURE" EncryptzAPI/Database/MainDB/15_Company_Tenancy_Rollback.sql
```

Expected: first command prints nothing; second prints `23` (1 function + 22 procedures); third prints `22`; fourth prints nothing.

Then confirm every procedure in the snapshot that the cut-over does not drop is replaced by it. Run:

```bash
for p in $(grep -oE "^/\* ===== [A-Za-z_]+" docs/superpowers/plans/assets/2026-10-11-maindb-project-procs-live.sql | awk '{print $3}'); do
  grep -qE "(PROCEDURE|IF EXISTS) dbo\.$p\b" EncryptzAPI/Database/MainDB/14_Company_Tenancy_Cutover.sql || echo "NOT HANDLED: $p";
done
```

Expected output, exactly these two lines (they do not touch the project tables any more and are intentionally left as they are):

```
NOT HANDLED: sp_User_GetCurrentSessionCompany
NOT HANDLED: sp_User_SelectCompany
```

- [ ] **Step 7: Commit**

```bash
git add EncryptzAPI/Database/MainDB/14_Company_Tenancy_Cutover.sql EncryptzAPI/Database/MainDB/15_Company_Tenancy_Rollback.sql docs/superpowers/plans/assets
git commit -m "Add main DB cut-over to company-level tenancy with rollback"
```

---

### Task 8: Resolve connections from the company row

**Files:**
- Modify: `EncryptzBL/Common/Tenant/ConnectionResolver.cs` (whole file)
- Modify: `EncryptzBL/Common/Tenant/IConnectionResolver.cs` (comments only)

**Interfaces:**
- Consumes: `sp_Tenant_GetConnection` (Task 7), `TenantConnectionString.Build` (Task 2), `ITenantSecretProtector.Unprotect(string) : string`, tenant-DB `sp_Project_GetLocations(@CompanyId, @ProjectId)` (existing, returns `LocationId`).
- Produces: unchanged `IConnectionResolver` members. The key is the tenant key; `ProjectScope.ProjectId` is the tenant scope id.

There is no unit test for this class: it only talks to SQL Server. It is exercised in Task 13.

- [ ] **Step 1: Replace the resolver**

Replace the whole of `EncryptzBL/Common/Tenant/ConnectionResolver.cs` with:

```csharp
using System.Collections.Concurrent;
using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Singleton resolver. Reads a company's registry row from MainDB with its own
    /// short-lived connection (so it can stay a singleton), decrypts the database
    /// password, and builds + caches the connection string per tenant key.
    /// </summary>
    public class ConnectionResolver : IConnectionResolver
    {
        private sealed record TenantEntry(string TenantKey, int CompanyId, string CompanyName, int ScopeId, string ConnectionString);

        private readonly string _mainConnectionString;
        private readonly ITenantSecretProtector _protector;
        private readonly ConcurrentDictionary<string, TenantEntry> _cache = new(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, ProjectScope> _scopeCache = new(StringComparer.OrdinalIgnoreCase);

        public ConnectionResolver(IConfiguration config, ITenantSecretProtector protector)
        {
            _mainConnectionString = config.GetConnectionString("MainConnection")
                ?? throw new InvalidOperationException("ConnectionStrings:MainConnection is not configured.");
            _protector = protector;
        }

        public async Task<string> GetServiceConnectionAsync(string projectKey)
        {
            if (string.IsNullOrWhiteSpace(projectKey))
                throw new ArgumentException("A tenant key is required to resolve a company database.", nameof(projectKey));

            var entry = await GetEntryAsync(projectKey)
                ?? throw new InvalidOperationException("No active company database is registered for this key.");

            return entry.ConnectionString;
        }

        public async Task<ProjectScope?> GetProjectScopeAsync(string projectKey)
        {
            if (string.IsNullOrWhiteSpace(projectKey))
                return null;

            if (_scopeCache.TryGetValue(projectKey, out var cached))
                return cached;

            var entry = await GetEntryAsync(projectKey);
            if (entry == null)
                return null;

            var scope = new ProjectScope
            {
                ProjectKey = entry.TenantKey,
                CompanyId = entry.CompanyId,
                CompanyName = entry.CompanyName,
                ProjectId = entry.ScopeId
            };

            // Branches live in the company's own DB
            var tenantDb = new ExplicitDbHelper(entry.ConnectionString);
            var locations = await tenantDb.ExecuteDataTableAsync("sp_Project_GetLocations", new[]
            {
                SqlParameterHelper.Input("@CompanyId", scope.CompanyId),
                SqlParameterHelper.Input("@ProjectId", scope.ProjectId)
            });

            if (locations.Rows.Count > 0)
                scope.DefaultLocationId = locations.Rows.Cast<DataRow>().Min(r => Convert.ToInt32(r["LocationId"]));

            _scopeCache[projectKey] = scope;
            return scope;
        }

        public void Evict(string projectKey)
        {
            if (!string.IsNullOrWhiteSpace(projectKey))
            {
                _cache.TryRemove(projectKey, out _);
                _scopeCache.TryRemove(projectKey, out _);
            }
        }

        private async Task<TenantEntry?> GetEntryAsync(string tenantKey)
        {
            if (_cache.TryGetValue(tenantKey, out var cached))
                return cached;

            var entry = await LoadFromRegistryAsync(tenantKey);
            if (entry != null)
                _cache[tenantKey] = entry;

            return entry;
        }

        private async Task<TenantEntry?> LoadFromRegistryAsync(string tenantKey)
        {
            await using var conn = new SqlConnection(_mainConnectionString);
            await conn.OpenAsync();

            await using var cmd = new SqlCommand("dbo.sp_Tenant_GetConnection", conn)
            {
                CommandType = CommandType.StoredProcedure
            };
            cmd.Parameters.AddWithValue("@TenantKey", tenantKey);

            await using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
                return null;

            var password = _protector.Unprotect(reader["DbPasswordEnc"]?.ToString() ?? string.Empty);

            var connectionString = TenantConnectionString.Build(
                reader["ServerName"]?.ToString(),
                reader["DatabaseName"]?.ToString(),
                reader["DbUser"]?.ToString(),
                password,
                reader["ExtraOptions"]?.ToString());

            return new TenantEntry(
                reader["TenantKey"]?.ToString() ?? tenantKey,
                Convert.ToInt32(reader["CompanyId"]),
                reader["CompanyName"]?.ToString() ?? string.Empty,
                Convert.ToInt32(reader["TenantScopeId"]),
                connectionString);
        }
    }
}
```

- [ ] **Step 2: Update the interface comments**

In `EncryptzBL/Common/Tenant/IConnectionResolver.cs` replace the summary comments so they describe the new meaning (the member names stay until Plan 2):

```csharp
namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// The company a tenant key identifies, plus its first active branch.
    /// ProjectKey is the tenant key and ProjectId the tenant scope id
    /// (Companies.TenantScopeId): the names predate company-level routing.
    /// </summary>
    public class ProjectScope
    {
        public string ProjectKey { get; set; } = string.Empty;
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = string.Empty;
        public int ProjectId { get; set; }
        public int DefaultLocationId { get; set; }
    }

    /// <summary>
    /// Resolves a tenant key (Companies.TenantKey) to that company's database
    /// connection string from the company's own row in MainDB. Only an active
    /// company whose database is Ready resolves. Results are cached; call
    /// <see cref="Evict"/> when the row changes.
    /// </summary>
    public interface IConnectionResolver
    {
        Task<string> GetServiceConnectionAsync(string projectKey);

        /// <summary>
        /// Company of a tenant key and its first active branch. Used for requests that
        /// carry only the key (public customer-portal endpoints).
        /// Returns null when the key is unknown, inactive or not Ready.
        /// </summary>
        Task<ProjectScope?> GetProjectScopeAsync(string projectKey);

        /// <summary>Drop a cached entry (after the company's connection changes).</summary>
        void Evict(string projectKey);
    }
}
```

- [ ] **Step 3: Build and run the tests**

Run: `dotnet test EncryptzTests/EncryptzTests.csproj`
Expected: build succeeds, `Passed!` (40).

- [ ] **Step 4: Commit**

```bash
git add EncryptzBL/Common/Tenant/ConnectionResolver.cs EncryptzBL/Common/Tenant/IConnectionResolver.cs
git commit -m "Resolve the tenant connection from the company row"
```

---

### Task 9: Sync tenant users by company

**Files:**
- Modify: `EncryptzBL/Common/Tenant/ITenantUserSyncService.cs` (whole file)
- Modify: `EncryptzBL/Common/Tenant/TenantUserSyncService.cs` (whole file)

**Interfaces:**
- Consumes: `sp_Company_GetUsersForSync(@CompanyId, @UserId)` (Task 7); tenant-DB `sp_Tenant_SyncUsers(@CompanyId, @ProjectId, @LocationId, @UsersJson, @SyncSingleUser)` (existing).
- Produces: `ITenantUserSyncService.SyncCompanyUsersAsync(int companyId, int locationId = 0) : Task<List<TenantUserMap>>`; `SyncCompanyUserAsync(int companyId, int locationId, int mainUserId) : Task<TenantUserMap?>`; `TrySyncCompanyUsersAsync(int companyId) : Task`. The four old members are removed; the build is red until Tasks 10 to 12 update the callers.

- [ ] **Step 1: Replace the interface**

Replace the whole of `EncryptzBL/Common/Tenant/ITenantUserSyncService.cs` with:

```csharp
namespace EncryptzBL.Common.Tenant
{
    /// <summary>A MainDB user's ids inside one company database.</summary>
    public class TenantUserMap
    {
        public int MainUserId { get; set; }
        public int TenantUserId { get; set; }
        public int TechnicianId { get; set; }
        public int ProfileId { get; set; }
    }

    /// <summary>
    /// Users, roles and module access are owned by MainDB. A company database only
    /// mirrors the users allowed into the Service module (Users.MainUserId); this
    /// service refreshes that mirror.
    /// </summary>
    public interface ITenantUserSyncService
    {
        /// <summary>
        /// Pushes the company's Service users (with their company role) into the company
        /// database and returns the MainDB -> tenant id map. Throws when the sync cannot run.
        /// </summary>
        Task<List<TenantUserMap>> SyncCompanyUsersAsync(int companyId, int locationId = 0);

        /// <summary>Refreshes only the given MainDB user without deactivating other tenant users.</summary>
        Task<TenantUserMap?> SyncCompanyUserAsync(int companyId, int locationId, int mainUserId);

        /// <summary>Best-effort variant for membership changes: failures are logged, not thrown.</summary>
        Task TrySyncCompanyUsersAsync(int companyId);
    }
}
```

- [ ] **Step 2: Replace the implementation**

Replace the whole of `EncryptzBL/Common/Tenant/TenantUserSyncService.cs` with:

```csharp
using System.Data;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Common.Tenant
{
    public class TenantUserSyncService : ITenantUserSyncService
    {
        private readonly MainDbHelper _mainDb;
        private readonly IConnectionResolver _connectionResolver;
        private readonly ILogger<TenantUserSyncService> _logger;

        public TenantUserSyncService(
            MainDbHelper mainDb,
            IConnectionResolver connectionResolver,
            ILogger<TenantUserSyncService> logger)
        {
            _mainDb = mainDb;
            _connectionResolver = connectionResolver;
            _logger = logger;
        }

        public async Task<List<TenantUserMap>> SyncCompanyUsersAsync(int companyId, int locationId = 0)
        {
            var (tenantKey, scopeId, users) = await LoadAsync(companyId, null);

            var dt = await (await OpenAsync(tenantKey)).ExecuteDataTableAsync("sp_Tenant_SyncUsers", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ProjectId", scopeId),
                SqlParameterHelper.Input("@LocationId", locationId),
                SqlParameterHelper.Input("@UsersJson", JsonSerializer.Serialize(users))
            });

            return dt?.ToList<TenantUserMap>() ?? new List<TenantUserMap>();
        }

        public async Task<TenantUserMap?> SyncCompanyUserAsync(int companyId, int locationId, int mainUserId)
        {
            var (tenantKey, scopeId, users) = await LoadAsync(companyId, mainUserId);

            if (users.Count == 0)
                throw new InvalidOperationException("Your user does not have active access to this company.");

            var result = await (await OpenAsync(tenantKey)).ExecuteDataTableAsync("sp_Tenant_SyncUsers", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ProjectId", scopeId),
                SqlParameterHelper.Input("@LocationId", locationId),
                SqlParameterHelper.Input("@UsersJson", JsonSerializer.Serialize(users)),
                SqlParameterHelper.Input("@SyncSingleUser", true)
            });

            return result?.ToList<TenantUserMap>().FirstOrDefault();
        }

        public async Task TrySyncCompanyUsersAsync(int companyId)
        {
            try
            {
                await SyncCompanyUsersAsync(companyId);
            }
            catch (Exception ex)
            {
                // The MainDB change is already committed; the mirror catches up on the next set-scope.
                _logger.LogError(ex, "User sync to the company database failed for company {CompanyId}", companyId);
            }
        }

        /// <summary>The company's routing info and the users to mirror (all, or one).</summary>
        private async Task<(string TenantKey, int ScopeId, List<object> Users)> LoadAsync(int companyId, int? mainUserId)
        {
            var ds = await _mainDb.ExecuteDataSetAsync("sp_Company_GetUsersForSync", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@UserId", mainUserId ?? (object)DBNull.Value)
            });

            if (ds == null || ds.Tables.Count < 2 || ds.Tables[0].Rows.Count == 0)
                throw new InvalidOperationException($"Company {companyId} has no ready database in MainDB.");

            var company = ds.Tables[0].Rows[0];

            var users = ds.Tables[1].Rows.Cast<DataRow>().Select(r => (object)new
            {
                userId = Convert.ToInt32(r["UserId"]),
                fullName = r["FullName"]?.ToString() ?? "",
                email = r["Email"] == DBNull.Value ? null : r["Email"]?.ToString(),
                mobileNumber = r["MobileNumber"] == DBNull.Value ? null : r["MobileNumber"]?.ToString(),
                role = r["RoleInCompany"]?.ToString() ?? ""
            }).ToList();

            return (company["TenantKey"]?.ToString() ?? "", Convert.ToInt32(company["TenantScopeId"]), users);
        }

        private async Task<ExplicitDbHelper> OpenAsync(string tenantKey)
            => new ExplicitDbHelper(await _connectionResolver.GetServiceConnectionAsync(tenantKey));
    }
}
```

- [ ] **Step 3: Confirm the expected breakage**

Run: `dotnet build EncryptzAPI/EncryptzAPI.csproj 2>&1 | grep -E "error CS" | sed -E 's/.*(Sync[A-Za-z]+).*/\1/' | sort | uniq -c`
Expected: errors only for `SyncProjectUsersAsync`, `SyncProjectUserAsync`, `TrySyncProjectUsersAsync`, `TrySyncCompanyProjectsAsync` (in `AuthService.cs`, `PlatformService.cs`, `TechnicianService.cs`). These are fixed in Tasks 10 to 12.

- [ ] **Step 4: Commit**

```bash
git add EncryptzBL/Common/Tenant/ITenantUserSyncService.cs EncryptzBL/Common/Tenant/TenantUserSyncService.cs
git commit -m "Sync tenant users by company (callers updated in the next commits)"
```

---

### Task 10: Auth service: modules, branches, set-scope, invitations

**Files:**
- Modify: `EncryptzBL/DTO's/FlixDtos.cs` (`LoginResponseDto`, `SetScopeRequestDto`, new `ModuleDto`)
- Modify: `EncryptzBL/Infrastructure/User/Modules/IAuthService.cs`
- Modify: `EncryptzBL/Infrastructure/User/Modules/AuthService.cs`
- Modify: `EncryptzAPI/Controllers/AuthController.cs`
- Modify: `EncryptzAPI/Controllers/CompanyController.cs:76`
- Create: `EncryptzTests/ModuleDtoTests.cs`

**Interfaces:**
- Consumes: `sp_User_GetModules`, `sp_User_ValidateScope`, `sp_User_GetMenusForCompany(@ModuleKey)`, `sp_Company_InviteUser`, `sp_Company_AcceptInvitation`, `sp_Mgmt_SaveUser` (Task 7); `ModuleAccess` (Task 1); `TenantClaims.BuildScopeClaims` (Task 3); `ITenantUserSyncService` (Task 9); tenant-DB `sp_Project_GetLocations(@CompanyId, @ProjectId)` and `sp_Location_Validate(@CompanyId, @ProjectId, @LocationId)` (existing).
- Produces:
  - `ModuleDto { int ModuleId; string ModuleKey; string ModuleName; string Description; string Icon; int SortOrder; string State; }` with `ModuleDto.From(...)`
  - `IAuthService.GetModules(int userId, int companyId) : Task<ApiResponse<List<ModuleDto>>>`
  - `IAuthService.GetLocations(int userId, int companyId, string moduleKey) : Task<ApiResponse<List<LocationDto>>>`
  - `IAuthService.SetScope(int userId, int companyId, string moduleKey, int locationId) : Task<ApiResponse<LoginResponseDto>>`
  - `IAuthService.GetProjects(int userId, int companyId)` kept for the deployed UI
  - `IAuthService.InviteUser(int companyId, string email, string roleInCompany, int invitedBy, string remarks = null)`
  - `IAuthService.AcceptInvitation(Guid token, int userId)`
  - `IAuthService.SaveUser(SaveUserRequest req, int companyId, int savedBy)`
  - Endpoints: `GET api/auth/modules`, `GET api/auth/locations`, `POST api/auth/set-scope` (body `{ companyId, moduleKey, locationId }`), `GET api/auth/projects` (compatibility)
  - `LoginResponseDto.ModuleKey : string`

- [ ] **Step 1: Write the failing test for the module DTO**

Create `EncryptzTests/ModuleDtoTests.cs`:

```csharp
using EncryptzBL.DTO_s;
using Xunit;

namespace EncryptzTests
{
    public class ModuleDtoTests
    {
        [Theory]
        [InlineData(true, true, "Technician", "Available")]
        [InlineData(true, false, "Technician", "NoAccess")]
        [InlineData(true, false, "CompanyAdmin", "Available")]
        [InlineData(false, true, "Admin", "NotSubscribed")]
        public void State_is_the_name_of_the_module_state(bool companyEnabled, bool userGranted, string role, string expected)
        {
            var dto = ModuleDto.From(1, "SERVICE", "Service Management", "desc", "build", 1, companyEnabled, userGranted, role);

            Assert.Equal(expected, dto.State);
            Assert.Equal("SERVICE", dto.ModuleKey);
            Assert.Equal("Service Management", dto.ModuleName);
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet build EncryptzTests/EncryptzTests.csproj 2>&1 | grep -c "ModuleDto"`
Expected: a number greater than 0 (`'ModuleDto' could not be found`).

- [ ] **Step 3: Update the DTOs**

In `EncryptzBL/DTO's/FlixDtos.cs`, add `using EncryptzBL.Common.Tenant;` to the file's usings if it is not there.

In `LoginResponseDto`, replace the three scope members with:

```csharp
        // Scope currently baked into the token (Company -> Module -> Branch).
        // ProjectId / ProjectKey are the tenant scope id and tenant key: the names are
        // kept for the deployed UI.
        public int CompanyId { get; set; }
        public int ProjectId { get; set; }
        public string ProjectKey { get; set; } = string.Empty;
        public string ModuleKey { get; set; } = string.Empty;
```

Replace `SetScopeRequestDto` with:

```csharp
    public class SetScopeRequestDto
    {
        public int UserId { get; set; }
        public int CompanyId { get; set; }
        /// <summary>Module to open. Empty = SERVICE (the deployed UI does not send it).</summary>
        public string ModuleKey { get; set; } = string.Empty;
        /// <summary>Ignored: projects no longer exist. Still sent by the deployed UI.</summary>
        public int ProjectId { get; set; }
        public int LocationId { get; set; }
    }
```

Add after `LocationDto`:

```csharp
    /// <summary>One module of the catalogue as a user sees it inside a company.</summary>
    public class ModuleDto
    {
        public int ModuleId { get; set; }
        public string ModuleKey { get; set; } = string.Empty;
        public string ModuleName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
        public int SortOrder { get; set; }
        /// <summary>Available | NotSubscribed | NoAccess</summary>
        public string State { get; set; } = string.Empty;

        public static ModuleDto From(int moduleId, string moduleKey, string moduleName, string description,
            string icon, int sortOrder, bool companyEnabled, bool userGranted, string? roleInCompany)
        {
            return new ModuleDto
            {
                ModuleId = moduleId,
                ModuleKey = moduleKey,
                ModuleName = moduleName,
                Description = description,
                Icon = icon,
                SortOrder = sortOrder,
                State = ModuleAccess.Evaluate(companyEnabled, userGranted, roleInCompany).ToString()
            };
        }
    }
```

In `InviteUserRequestDto` and `AcceptInvitationRequestDto` leave `projectID` / `projectId` in place (the deployed UI sends them; they are ignored).

- [ ] **Step 4: Update the interface**

In `EncryptzBL/Infrastructure/User/Modules/IAuthService.cs` replace these six declarations:

```csharp
        Task<ApiResponse<object>> SaveUser(SaveUserRequest req, int companyId, int projectId, int savedBy);
```
```csharp
        Task<ApiResponse<List<ProjectDto>>> GetProjects(int userId, int companyId);
        Task<ApiResponse<List<LocationDto>>> GetLocations(int userId, int projectId);
        Task<ApiResponse<LoginResponseDto>> SetScope(int userId, int companyId, int projectId, int locationId);
        Task<ApiResponse<InvitationResponseDto>> InviteUser(int companyId, string email, string roleInCompany, int invitedBy, int projectID, string remarks = null);
        Task<ApiResponse<SelectCompanyResponseDto>> AcceptInvitation(Guid token, int userId,int projectId);
```

with:

```csharp
        Task<ApiResponse<object>> SaveUser(SaveUserRequest req, int companyId, int savedBy);
```
```csharp
        // Company -> Module -> Branch scoping
        Task<ApiResponse<List<ModuleDto>>> GetModules(int userId, int companyId);
        /// <summary>For the deployed UI: the Service module shown as the company's one "project".</summary>
        Task<ApiResponse<List<ProjectDto>>> GetProjects(int userId, int companyId);
        Task<ApiResponse<List<LocationDto>>> GetLocations(int userId, int companyId, string moduleKey);
        Task<ApiResponse<LoginResponseDto>> SetScope(int userId, int companyId, string moduleKey, int locationId);
        Task<ApiResponse<InvitationResponseDto>> InviteUser(int companyId, string email, string roleInCompany, int invitedBy, string remarks = null);
        Task<ApiResponse<SelectCompanyResponseDto>> AcceptInvitation(Guid token, int userId);
```

- [ ] **Step 5: Update the auth service: token**

In `EncryptzBL/Infrastructure/User/Modules/AuthService.cs` replace the whole `GenerateJwtTokenWithCompany` method with:

```csharp
        private string GenerateJwtTokenWithCompany(int userId, string fullName, string role, string email, string mobile, int companyId, string tenantKey = "", int scopeId = 0, int locationId = 0, string moduleKey = "", int tenantUserId = 0, int technicianId = 0, bool platformAdmin = false)
        {
            var jwtKey = _config["Jwt:Key"];
            if (string.IsNullOrEmpty(jwtKey))
                throw new Exception("JWT Key not configured");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, fullName),
                new Claim(ClaimTypes.Email, email ?? ""),
                new Claim(ClaimTypes.MobilePhone, mobile ?? ""),
                new Claim(ClaimTypes.Role, role),
                // Global role Admin = platform administrator (manages every company in MainDB)
                new Claim("PlatformAdmin", platformAdmin ? "true" : "false")
            };

            // Routing claims consumed by TenantResolutionMiddleware. NameIdentifier stays
            // the MainDB UserId; TenantUserId / TechnicianId are the ids in the company DB.
            claims.AddRange(TenantClaims.BuildScopeClaims(
                companyId, tenantKey, scopeId, locationId, moduleKey, tenantUserId, technicianId));

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: TimeHelper.IndianNow.AddHours(24),
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
```

In `SelectCompany`, replace the token call with:

```csharp
            // Company token only: no tenant key yet. Business data stays blocked until
            // the user picks a module + branch via set-scope.
            var token = GenerateJwtTokenWithCompany(
                userId, userInfo.FullName, role, userInfo.Email, userInfo.Mobile,
                companyId,
                platformAdmin: userInfo.Role == PlatformAdminRole);
```

In `GetUserCompanies` nothing changes (the extra `ProvisionStatus` column is not read yet; Plan 2 shows it).

- [ ] **Step 6: Update the auth service: modules, branches, set-scope**

In `AuthService.cs`, replace everything from the comment block that starts `// PROJECT (MainDB) -> LOCATION (project DB) SCOPING` down to and including the `GetAccessibleProject` method (the methods `GetProjects`, `GetLocations`, `SetScope`, `GetCompanyName`, `GetAccessibleProject`) with:

```csharp
        // ============================================
        // COMPANY -> MODULE -> BRANCH SCOPING
        // Modules and who may open them live in MainDB; branches live in the company DB.
        // ============================================

        /// <summary>The resolved company database + the caller's role for one module.</summary>
        private sealed record ModuleScope(string TenantKey, int ScopeId, string Role, string ModuleName);

        /// <summary>
        /// Checks that the user may open the module of the company and that the company's
        /// database is ready. Returns the scope, or the reason it was refused.
        /// </summary>
        private async Task<(ModuleScope? Scope, string Error)> ResolveModuleScope(int userId, int companyId, string moduleKey)
        {
            var dt = await GetDataTableAsync("sp_User_ValidateScope", new[]
            {
                SqlParameterHelper.Input("@UserId", userId),
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ModuleKey", moduleKey)
            });

            if (dt == null || dt.Rows.Count == 0)
                return (null, "You don't have access to this company");

            var row = dt.Rows[0];
            var role = row["RoleInCompany"]?.ToString() ?? "";

            var state = ModuleAccess.Evaluate(
                Convert.ToBoolean(row["CompanyEnabled"]), Convert.ToBoolean(row["UserGranted"]), role);

            if (state == ModuleState.NotSubscribed)
                return (null, "This module is not part of your company's subscription");
            if (state == ModuleState.NoAccess)
                return (null, "You don't have access to this module. Ask your administrator");

            var tenantKey = row["TenantKey"]?.ToString() ?? "";
            if (row["ProvisionStatus"]?.ToString() != "Ready" || string.IsNullOrEmpty(tenantKey))
                return (null, "Your company is still being set up. Please try again shortly");

            return (new ModuleScope(tenantKey, Convert.ToInt32(row["TenantScopeId"]), role,
                row["ModuleName"]?.ToString() ?? ""), "");
        }

        public async Task<ApiResponse<List<ModuleDto>>> GetModules(int userId, int companyId)
        {
            var dt = await GetDataTableAsync("sp_User_GetModules", new[]
            {
                SqlParameterHelper.Input("@UserId", userId),
                SqlParameterHelper.Input("@CompanyId", companyId)
            });

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<List<ModuleDto>>.Ok(new List<ModuleDto>(), "No modules found");

            // RoleInCompany is empty when the caller is not an active member
            if (string.IsNullOrEmpty(dt.Rows[0]["RoleInCompany"]?.ToString()))
                return ApiResponse<List<ModuleDto>>.Fail("You don't have access to this company");

            var modules = dt.Rows.Cast<DataRow>().Select(r => ModuleDto.From(
                Convert.ToInt32(r["ModuleId"]),
                r["ModuleKey"]?.ToString() ?? "",
                r["ModuleName"]?.ToString() ?? "",
                r["Description"]?.ToString() ?? "",
                r["Icon"]?.ToString() ?? "",
                Convert.ToInt32(r["SortOrder"]),
                Convert.ToBoolean(r["CompanyEnabled"]),
                Convert.ToBoolean(r["UserGranted"]),
                r["RoleInCompany"]?.ToString())).ToList();

            return ApiResponse<List<ModuleDto>>.Ok(modules, "Success");
        }

        public async Task<ApiResponse<List<ProjectDto>>> GetProjects(int userId, int companyId)
        {
            // The deployed UI asks for "projects": the Service module is the company's one.
            var (scope, _) = await ResolveModuleScope(userId, companyId, ModuleAccess.ServiceModuleKey);

            if (scope == null)
                return ApiResponse<List<ProjectDto>>.Ok(new List<ProjectDto>(), "No projects found");

            return ApiResponse<List<ProjectDto>>.Ok(new List<ProjectDto>
            {
                new ProjectDto
                {
                    ProjectId = scope.ScopeId,
                    CompanyId = companyId,
                    ProjectName = scope.ModuleName,
                    ProjectKey = scope.TenantKey
                }
            }, "Success");
        }

        public async Task<ApiResponse<List<LocationDto>>> GetLocations(int userId, int companyId, string moduleKey)
        {
            var (scope, error) = await ResolveModuleScope(userId, companyId, moduleKey);
            if (scope == null)
                return ApiResponse<List<LocationDto>>.Fail(error);

            // Branches live in the company's own DB
            var tenantDb = new ExplicitDbHelper(await _connectionResolver.GetServiceConnectionAsync(scope.TenantKey));

            var dt = await tenantDb.ExecuteDataTableAsync("sp_Project_GetLocations", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ProjectId", scope.ScopeId)
            });

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<List<LocationDto>>.Ok(new List<LocationDto>(), "No locations found");

            var locations = dt.Rows.Cast<DataRow>().Select(r => new LocationDto
            {
                LocationId = Convert.ToInt32(r["LocationId"]),
                LocationName = r["LocationName"]?.ToString() ?? "",
                LocationCode = r["LocationCode"]?.ToString(),
                City = r["City"]?.ToString()
            }).ToList();

            return ApiResponse<List<LocationDto>>.Ok(locations, "Success");
        }

        public async Task<ApiResponse<LoginResponseDto>> SetScope(int userId, int companyId, string moduleKey, int locationId)
        {
            _logger.LogInformation("SetScope started for user {UserId}, company {CompanyId}, module {ModuleKey}, location {LocationId}",
                userId, companyId, moduleKey, locationId);

            // 1) Company membership, module subscription + grant, database ready (MainDB)
            var (scope, error) = await ResolveModuleScope(userId, companyId, moduleKey);
            if (scope == null)
                return ApiResponse<LoginResponseDto>.Fail(error);

            // 2) The branch exists and is active in the COMPANY's OWN DB
            var tenantDb = new ExplicitDbHelper(await _connectionResolver.GetServiceConnectionAsync(scope.TenantKey));

            var vl = await tenantDb.ExecuteDataTableAsync("sp_Location_Validate", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ProjectId", scope.ScopeId),
                SqlParameterHelper.Input("@LocationId", locationId)
            });

            if (vl == null || vl.Rows.Count == 0)
                return ApiResponse<LoginResponseDto>.Fail("Invalid location for this company");

            // 3) Users/technicians are owned by MainDB: refresh the company DB's mirror and
            //    resolve this user's ids inside it (business procs + FKs use the local ids)
            TenantUserMap? me;
            try
            {
                me = await _userSync.SyncCompanyUserAsync(companyId, locationId, userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SetScope tenant user sync failed for user {UserId}, company {CompanyId}", userId, companyId);
                return ApiResponse<LoginResponseDto>.Fail("Could not prepare your user in this company. Please try again");
            }

            if (me == null)
                return ApiResponse<LoginResponseDto>.Fail("Your user is not set up for this company");

            var userInfo = await GetUserById(userId);

            // 4) Fully scoped token (the tenant key routes every later request)
            var token = GenerateJwtTokenWithCompany(
                userId, userInfo.FullName, scope.Role, userInfo.Email, userInfo.Mobile,
                companyId, scope.TenantKey, scope.ScopeId, locationId, moduleKey,
                me.TenantUserId, me.TechnicianId,
                platformAdmin: userInfo.Role == PlatformAdminRole);

            await ExecuteAsync("sp_User_UpdateSession", new[]
            {
                SqlParameterHelper.Input("@UserId", userId),
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@AuthToken", token),
                SqlParameterHelper.Input("@ProjectId", (object)DBNull.Value),
                SqlParameterHelper.Input("@LocationId", locationId)
            });

            var menuTable = await GetDataTableAsync("sp_User_GetMenusForCompany", new[]
            {
                SqlParameterHelper.Input("@UserId", userId),
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@ModuleKey", moduleKey)
            });
            var menus = menuTable != null ? menuTable.ToList<MenuDto>() : new List<MenuDto>();

            var response = new LoginResponseDto
            {
                Token = token,
                FullName = userInfo.FullName,
                Role = scope.Role,
                UserId = userId,
                Email = userInfo.Email,
                technicianId = me.TechnicianId,
                mobileNumber = userInfo.Mobile,
                IsPlatformAdmin = userInfo.Role == PlatformAdminRole,
                CompanyName = await GetCompanyName(companyId),
                Menus = menus,
                CompanyId = companyId,
                ProjectKey = scope.TenantKey,
                ProjectId = scope.ScopeId,
                ModuleKey = moduleKey,
                LocationId = locationId
            };

            _logger.LogInformation("SetScope completed for user {UserId}, company {CompanyId}", userId, companyId);
            return ApiResponse<LoginResponseDto>.Ok(response, "Scope updated successfully");
        }

        private async Task<string> GetCompanyName(int companyId)
        {
            var dt = await GetDataTableByQueryAsync(
                "SELECT CompanyName FROM dbo.Companies WHERE CompanyId = @CompanyId",
                new[] { SqlParameterHelper.Input("@CompanyId", companyId) });

            return dt != null && dt.Rows.Count > 0 ? dt.Rows[0]["CompanyName"]?.ToString() ?? "" : "";
        }
```

If `using System.Diagnostics;` is now unused at the top of the file, remove it.

- [ ] **Step 7: Update the auth service: invitations, users, customer tenant**

Still in `AuthService.cs`:

(a) Replace every `_userSync.TrySyncCompanyProjectsAsync(companyId)` with `_userSync.TrySyncCompanyUsersAsync(companyId)`. Check: `grep -c "TrySyncCompanyProjectsAsync" EncryptzBL/Infrastructure/User/Modules/AuthService.cs` prints `0`.

(b) Replace the signature and parameter array at the top of `SaveUser`:

```csharp
        public async Task<ApiResponse<object>> SaveUser(SaveUserRequest req, int companyId, int savedBy)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserId", req.UserId ?? 0),
                SqlParameterHelper.Input("@FullName", req.FullName),
                SqlParameterHelper.Input("@Email", req.Email),
                SqlParameterHelper.Input("@MobileNumber", req.MobileNumber),
                SqlParameterHelper.Input("@RoleId", req.RoleId),
                SqlParameterHelper.Input("@IsActive", req.IsActive),
                SqlParameterHelper.Input("@PasswordHash",
                    string.IsNullOrEmpty(req.Password) ? (object)DBNull.Value : BCrypt.Net.BCrypt.HashPassword(req.Password)),
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@SavedBy", savedBy > 0 ? savedBy : (object)DBNull.Value)
            };
```

(c) Replace the signature and parameter array at the top of `InviteUser`:

```csharp
        public async Task<ApiResponse<InvitationResponseDto>> InviteUser(int companyId, string email, string roleInCompany, int invitedBy, string remarks = null)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@Email", email),
                SqlParameterHelper.Input("@RoleInCompany", roleInCompany),
                SqlParameterHelper.Input("@InvitedBy", invitedBy),
                SqlParameterHelper.Input("@Remarks", (object?)remarks ?? DBNull.Value)
            };
```

(d) In `AcceptInvitation`, replace the signature, the parameter array and the sync call:

```csharp
        public async Task<ApiResponse<SelectCompanyResponseDto>> AcceptInvitation(Guid token, int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@Token", token),
                SqlParameterHelper.Input("@UserId", userId)
            };
```

and

```csharp
            // The new member (e.g. a technician) must show up in the company DB right away
            await _userSync.TrySyncCompanyUsersAsync(companyId);
```

(replacing `await _userSync.TrySyncProjectUsersAsync(projectId);`).

(e) Replace the query and mapping in `ResolveCustomerTenant` (keep the method signature and the `IsNullOrWhiteSpace` guard):

```csharp
            // One company = one database: a company code names exactly one tenant.
            // The DTO keeps its "project" names for the deployed customer pages.
            var dt = await GetDataTableByQueryAsync(
                @"SELECT c.CompanyName, c.TenantKey
                  FROM dbo.Companies c
                  WHERE c.CompanyCode = @CompanyCode AND c.IsActive = 1
                    AND c.ProvisionStatus = 'Ready' AND c.TenantKey IS NOT NULL",
                new[] { SqlParameterHelper.Input("@CompanyCode", companyCode.Trim()) });

            var projects = dt.Rows.Cast<DataRow>().Select(row => new CustomerTenantProjectDto
            {
                CompanyName = row["CompanyName"]?.ToString() ?? string.Empty,
                ProjectName = row["CompanyName"]?.ToString() ?? string.Empty,
                ProjectKey = row["TenantKey"]?.ToString() ?? string.Empty
            }).ToList();

            return projects.Count == 0
                ? ApiResponse<List<CustomerTenantProjectDto>>.Fail("Company code not found")
                : ApiResponse<List<CustomerTenantProjectDto>>.Ok(projects, "Company found", projects.Count);
```

- [ ] **Step 8: Update the controllers**

In `EncryptzAPI/Controllers/AuthController.cs`:

Add `using EncryptzBL.Common.Tenant;` at the top.

Replace the `SaveUser` action body:

```csharp
        public async Task<IActionResult> SaveUser([FromBody] SaveUserRequest req)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.SaveUser(req, GetCurrentCompanyId(), userId);
            return Ok(result);
        }
```

Replace the `GetProjects`, `GetLocations` and `SetScope` actions with:

```csharp
        // ── MODULE / BRANCH SCOPING (Company -> Modules -> Branches) ──────

        [HttpGet("modules")]
        [Authorize]
        public async Task<IActionResult> GetModules()
        {
            var companyId = GetCurrentCompanyId();
            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            return Ok(await _authService.GetModules(userId, companyId));
        }

        /// <summary>For the deployed UI: the Service module as the company's one "project".</summary>
        [HttpGet("projects")]
        [Authorize]
        public async Task<IActionResult> GetProjects([FromQuery] int companyId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.GetProjects(userId, companyId);
            return Ok(result);
        }

        /// <summary>
        /// Branches of the selected company. The company comes from the token.
        /// projectId is ignored (sent by the deployed UI).
        /// </summary>
        [HttpGet("locations")]
        [Authorize]
        public async Task<IActionResult> GetLocations([FromQuery] string? moduleKey = null, [FromQuery] int projectId = 0)
        {
            var companyId = GetCurrentCompanyId();
            if (companyId == 0)
                return BadRequest(ApiResponse<object>.Fail("No company selected"));

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.GetLocations(userId, companyId, ModuleOrService(moduleKey));
            return Ok(result);
        }

        [HttpPost("set-scope")]
        [Authorize]
        public async Task<IActionResult> SetScope([FromBody] SetScopeRequestDto dto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _authService.SetScope(userId, dto.CompanyId, ModuleOrService(dto.ModuleKey), dto.LocationId);
            return Ok(result);
        }
```

Add this helper inside the `#region Helper` block:

```csharp
        private static string ModuleOrService(string? moduleKey)
            => string.IsNullOrWhiteSpace(moduleKey) ? ModuleAccess.ServiceModuleKey : moduleKey.Trim().ToUpperInvariant();
```

In the `InviteUser` action replace the service call with:

```csharp
            var result = await _authService.InviteUser(companyId, dto.Email, dto.RoleInCompany, userId, dto.Remarks);
```

In the `AcceptInvitation` action replace the service call with:

```csharp
            var result = await _authService.AcceptInvitation(dto.Token, userId);
```

In `EncryptzAPI/Controllers/CompanyController.cs` replace the `InviteUser` service call (line 76) with the same line:

```csharp
            var result = await _authService.InviteUser(companyId, dto.Email, dto.RoleInCompany, userId, dto.Remarks);
```

- [ ] **Step 9: Verify**

Run: `dotnet build EncryptzAPI/EncryptzAPI.csproj 2>&1 | grep -E "error CS" | grep -vE "PlatformService|TechnicianService" | head`
Expected: no output (the remaining errors are in `PlatformService.cs` and `TechnicianService.cs`, fixed in Tasks 11 and 12).

- [ ] **Step 10: Commit**

```bash
git add "EncryptzBL/DTO's/FlixDtos.cs" EncryptzBL/Infrastructure/User/Modules/IAuthService.cs EncryptzBL/Infrastructure/User/Modules/AuthService.cs EncryptzAPI/Controllers/AuthController.cs EncryptzAPI/Controllers/CompanyController.cs EncryptzTests/ModuleDtoTests.cs
git commit -m "Scope sessions by company, module and branch"
```

---

### Task 11: Platform administration over companies

**Files:**
- Modify: `EncryptzBL/Infrastructure/User/Modules/PlatformService.cs`

**Interfaces:**
- Consumes: `sp_Platform_GetProject` returning `ProjectId, CompanyId, ProjectName, ProjectKey, IsActive, TenantScopeId` (Task 7); `ITenantUserSyncService.TrySyncCompanyUsersAsync` (Task 9).
- Produces: unchanged `IPlatformService`. Every `projectId` argument is a `CompanyId`.

- [ ] **Step 1: Carry the scope id through the helper**

In `PlatformService.cs` replace `GetManagedProject` with:

```csharp
        /// <summary>
        /// The company's routing key and tenant scope id, or null when the caller may not
        /// manage it. "projectId" is the CompanyId: a project is the company's Service database.
        /// </summary>
        private async Task<(string ProjectKey, int CompanyId, int ScopeId)?> GetManagedProject(int projectId, PlatformActor actor)
        {
            var dt = await GetDataTableAsync("sp_Platform_GetProject", new[]
            {
                SqlParameterHelper.Input("@ProjectId", projectId)
            });

            if (dt == null || dt.Rows.Count == 0)
                return null;

            var companyId = Convert.ToInt32(dt.Rows[0]["CompanyId"]);
            if (!actor.CanManageCompany(companyId))
                return null;

            return (dt.Rows[0]["ProjectKey"]?.ToString() ?? "", companyId, Convert.ToInt32(dt.Rows[0]["TenantScopeId"]));
        }
```

- [ ] **Step 2: Pass the scope id to the tenant database**

In `GetLocations`, replace the `@ProjectId` parameter line with:

```csharp
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId)
```

In `SaveLocation`, replace the `@ProjectId` parameter line with:

```csharp
                    SqlParameterHelper.Input("@ProjectId", project.Value.ScopeId),
```

In both methods replace the two user-facing failure messages so they carry no SQL text:

```csharp
                return ApiResponse<List<PlatformLocationDto>>.Fail("Could not read the company database");
```
```csharp
                return ApiResponse<int>.Fail("Could not save to the company database");
```

and log the exception instead. Add a logger to the class: add `using Microsoft.Extensions.Logging;`, a field `private readonly ILogger<PlatformService> _logger;`, a constructor parameter `ILogger<PlatformService> logger` (last), assign it, and change both `catch (Exception ex)` bodies to start with:

```csharp
                _logger.LogError(ex, "Company database access failed for company {CompanyId}", project.Value.CompanyId);
```

- [ ] **Step 3: Update SaveProject**

In `SaveProject`, replace the block that starts `if (result.Success)` with:

```csharp
            if (result.Success)
            {
                // routing is cached per key: forget the old target
                var saved = await GetDataTableAsync("sp_Platform_GetProject", new[]
                {
                    SqlParameterHelper.Input("@ProjectId", req.CompanyId)
                });
                if (saved != null && saved.Rows.Count > 0)
                    _connectionResolver.Evict(saved.Rows[0]["ProjectKey"]?.ToString() ?? "");

                if (req.IsActive)
                    await _userSync.TrySyncCompanyUsersAsync(req.CompanyId);
            }
```

- [ ] **Step 4: Update TestConnection**

In `TestConnection`, replace the stored-password query with one that reads the company row (`req.CompanyId` is the company; `req.ProjectId` is the same id when editing):

```csharp
            // editing without retyping the password: test with the stored one
            if (string.IsNullOrEmpty(password) && req.CompanyId > 0)
            {
                var stored = await GetDataTableByQueryAsync(
                    "SELECT DbPasswordEnc FROM dbo.Companies WHERE CompanyId = @CompanyId",
                    new[] { SqlParameterHelper.Input("@CompanyId", req.CompanyId) });

                if (stored.Rows.Count > 0)
                {
                    try { password = _protector.Unprotect(stored.Rows[0]["DbPasswordEnc"]?.ToString() ?? ""); }
                    catch { password = null; }
                }
            }
```

Replace the location-count block and the message with (one company per database, so all active branches count):

```csharp
                if (result.SchemaReady)
                {
                    var loc = await projectDb.ExecuteQueryDataTableAsync(
                        "SELECT COUNT(*) AS N FROM dbo.Locations WHERE IsActive = 1");
                    result.LocationCount = Convert.ToInt32(loc.Rows[0]["N"]);
                }

                result.Message = !result.SchemaReady
                    ? "Connected, but the tenant database scripts (Database/ProjectDB) have not been run on this database"
                    : result.LocationCount == 0
                        ? "Connected. Add at least one branch so users can enter the company"
                        : "Connected";
```

Replace the `catch (SqlException ex)` body with:

```csharp
                _logger.LogWarning(ex, "Connection test failed for company {CompanyId}", req.CompanyId);
                result.Message = "Could not connect. Check the server, database, user and password";
```

- [ ] **Step 5: Update SetProjectAccess**

In `SetProjectAccess`, replace the sync call with:

```csharp
            // the company DB mirrors who may work in it (users, technicians)
            await _userSync.TrySyncCompanyUsersAsync(projectId);
```

- [ ] **Step 6: Verify**

Run: `dotnet build EncryptzAPI/EncryptzAPI.csproj 2>&1 | grep -E "error CS" | grep -v "TechnicianService" | head`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add EncryptzBL/Infrastructure/User/Modules/PlatformService.cs
git commit -m "Run platform administration against the company row"
```

---

### Task 12: Technician and customer services

**Files:**
- Modify: `EncryptzBL/Infrastructure/Technician/modules/TechnicianService.cs:88-112`
- Modify: `EncryptzBL/Infrastructure/Customer/Modules/CustomerService.cs:333-357`
- Modify: `EncryptzAPI/Controllers/CustomerController.cs:37-46`

**Interfaces:**
- Consumes: `sp_Company_CreateTechnicianUser(@CompanyId, @FullName, @Email, @MobileNumber, @CreatedBy)` (Task 7); `ITenantUserSyncService.SyncCompanyUsersAsync` (Task 9); `TenantClaims.TenantKey` (Task 3); `TenantResolutionMiddleware.TenantKeyHeader` (Task 3).

- [ ] **Step 1: Technician creation**

In `TechnicianService.Create`, replace the MainDB call and the sync call:

```csharp
            // 1) The login, company role and Service module access live in MainDB
            var main = await _mainDb.ExecuteDataTableAsync("sp_Company_CreateTechnicianUser", new[]
            {
                SqlParameterHelper.Input("@CompanyId", CompanyId),
                SqlParameterHelper.Input("@FullName", dto.FullName),
                SqlParameterHelper.Input("@Email", dto.Email.Trim()),
                SqlParameterHelper.Input("@MobileNumber", dto.MobileNumber ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@CreatedBy", _tenant.MainUserId)
            });
```

```csharp
            // 2) Mirror the user into this company's DB (creates the technician rows)
            try
            {
                await _userSync.SyncCompanyUsersAsync(CompanyId, LocationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Technician sync failed for company {CompanyId}", CompanyId);
                return ApiResponse<int>.Fail("Technician user was created, but adding it to this company failed. Please try again");
            }
```

If `TechnicianService` has no `_logger` field, keep the original `catch` body but without the SQL text:

```csharp
            catch (Exception)
            {
                return ApiResponse<int>.Fail("Technician user was created, but adding it to this company failed. Please try again");
            }
```

Check which applies with: `grep -n "_logger" EncryptzBL/Infrastructure/Technician/modules/TechnicianService.cs | head -3`.

- [ ] **Step 2: Customer token**

In `CustomerService.GenerateJwtToken`, replace the routing claim lines with (add `using EncryptzBL.Common.Tenant;` if missing):

```csharp
                    // Route every later customer request to the company the customer logged in to.
                    // ProjectKey is the old name of the same value (see TenantClaims).
                    new Claim(TenantClaims.TenantKey, ProjectKey),
                    new Claim(TenantClaims.LegacyProjectKey, ProjectKey),
                    new Claim("CompanyId", CompanyId.ToString()),
                    new Claim("ProjectId", ProjectId.ToString()),
                    new Claim("LocationId", LocationId.ToString())
```

- [ ] **Step 3: Customer tenant-info endpoint**

In `CustomerController.GetTenantInfo`, replace the body with:

```csharp
            var tenantKey = Request.Headers[TenantResolutionMiddleware.TenantKeyHeader].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(tenantKey))
                tenantKey = Request.Headers[TenantResolutionMiddleware.ProjectKeyHeader].FirstOrDefault();

            var scope = await _connectionResolver.GetProjectScopeAsync(tenantKey ?? string.Empty);
            if (scope == null)
                return BadRequest(ApiResponse<string>.Fail("Unknown company"));

            return Ok(ApiResponse<string>.Ok(scope.CompanyName));
```

- [ ] **Step 4: Build everything and run all tests**

Run: `dotnet build EncryptzAPI/EncryptzAPI.csproj 2>&1 | grep -cE "error CS"`
Expected: `0`.

Run: `dotnet test EncryptzTests/EncryptzTests.csproj`
Expected: `Passed!` (44 tests).

Run: `grep -rnE "sp_Project_GetConnection|sp_Project_GetUsersForSync|sp_User_GetProjects|sp_User_ValidateProject|dbo\.Projects|ProjectConnections|UserProjectAccess" EncryptzAPI EncryptzBL --include=*.cs`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add EncryptzBL/Infrastructure/Technician/modules/TechnicianService.cs EncryptzBL/Infrastructure/Customer/Modules/CustomerService.cs EncryptzAPI/Controllers/CustomerController.cs
git commit -m "Create technicians and customer tokens at company level"
```

---

### Task 13: Verification on a non-live database (owner-gated)

**Files:**
- Create: `EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md`

This task needs databases that may be written to. Per the Global Constraints the assistant has none. **Stop here and ask the owner** for:

1. a restored COPY of the main database under another name (for example `MainDBEncryptz_Dev`), and
2. a restored COPY of one tenant database (for example `HamsterserviceDB_Dev`),

and for explicit permission to write to those two named databases. Do not continue this task without both. Until then report Tasks 1 to 12 as "implemented and unit-tested, SQL not executed".

- [ ] **Step 1: Write the release notes for the owner**

Create `EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md`:

```markdown
# Company-level tenancy: release steps

One company = one tenant = one database. The connection of a tenant is stored on
its `Companies` row; access to a module replaces access to a project.

## Before the release (any time, the running API is not affected)

1. Back up the main database and every tenant database.
2. In the main database run `13_Company_Tenancy_Schema.sql`.

## Release (short maintenance window)

1. Stop the API.
2. In the main database run `14_Company_Tenancy_Cutover.sql`.
   - It stops without changing anything if a company has more than one active
     project or a database is shared by two companies.
   - The last result set lists every company with its tenant key, database and
     the number of users who can open the Service module. Check it.
3. Deploy the new API. The UI does not have to change in this release.
4. Start the API.

## Check after the release

- Staff login, select company, pick branch, open the dashboard.
- Technician login, open work orders.
- Customer portal login.
- Platform Admin: the company's database is listed and "Test connection" succeeds.
- A user who was logged in before the release can keep working without logging in again.

## Undo

1. Stop the API.
2. In the main database run `15_Company_Tenancy_Rollback.sql`.
3. Deploy the previous API and start it.

Module access granted or removed after the cut-over is not carried back.

## What changed for administrators

- A company's database is attached on the company. The "Projects & Databases"
  tab now shows one entry per company.
- "Project access" is access to the Service module. Company administrators
  (Admin, CompanyAdmin) always have it.
- When attaching an existing database by hand, the tenant database script must be
  run with `ProjectId = 1` for a new company (`Companies.TenantScopeId`).
```

- [ ] **Step 2: Run the scripts on the COPY of the main database**

In SSMS, connected to the copy named by the owner, run `13_Company_Tenancy_Schema.sql`, then `14_Company_Tenancy_Cutover.sql`.
Expected: no errors; the final result set shows each company with `ProvisionStatus = Ready`, `TenantKey` equal to its old project key, and `ServiceUsers` greater than 0.

Run them both a second time.
Expected: no errors; the message `Project tables are already renamed: data copy skipped, procedures refreshed.`

- [ ] **Step 3: Point the copy at the tenant copy**

In the main-database copy, set the company's `DatabaseName` to the tenant copy named by the owner (so nothing reaches a live tenant database):

```sql
UPDATE dbo.Companies SET DatabaseName = N'<tenant copy name given by the owner>' WHERE CompanyCode = N'<its company code>';
SELECT CompanyId, CompanyCode, TenantKey, DatabaseName, ProvisionStatus FROM dbo.Companies;
```

Expected: the row shows the copy's name. Set every other company to `ProvisionStatus = 'None'` in the copy so the API cannot route to a live tenant database from this environment:

```sql
UPDATE dbo.Companies SET ProvisionStatus = 'None' WHERE CompanyCode <> N'<its company code>';
```

- [ ] **Step 4: Run the API against the copy**

Set the connection string for this run only, without editing `appsettings.json` (PowerShell; `<...>` values come from the owner):

```powershell
$env:ConnectionStrings__MainConnection = "Server=<server>;Database=<main copy name>;User Id=<user>;Password=<password>;TrustServerCertificate=True"
dotnet run --project EncryptzAPI/EncryptzAPI.csproj
```

Expected: `Now listening on: http://localhost:5092`.

- [ ] **Step 5: Walk the flow through Swagger (`http://localhost:5092/swagger`)**

| # | Call | Expected |
|---|---|---|
| 1 | `POST /api/Auth/login-v2` with a member of the test company | `success: true`, `companies` contains the company |
| 2 | `POST /api/Auth/select-company` with the token from 1 | `success: true`, a token |
| 3 | `GET /api/Auth/modules` with the token from 2 | one module, `moduleKey: "SERVICE"`, `state: "Available"` |
| 4 | `GET /api/Auth/locations` with the token from 2 | the company's branches |
| 5 | `GET /api/Dashboard/...` (any business endpoint) with the token from 2 | HTTP 403, `"Select a company, module and branch first"` or `"Open this module from the module list first"` |
| 6 | `POST /api/Auth/set-scope` `{ "companyId": <id>, "moduleKey": "SERVICE", "locationId": <a branch> }` | `success: true`, `projectKey` equals the company's tenant key, menus returned |
| 7 | The same business endpoint with the token from 6 | HTTP 200 with data |
| 8 | `POST /api/Auth/set-scope` with `"moduleKey": "NOPE"` | `success: false`, `"You don't have access to this company"` |
| 9 | `POST /api/Auth/set-scope` without `moduleKey` and with `"projectId": 99` | `success: true` (the deployed UI's request shape) |
| 10 | `GET /api/Auth/projects?companyId=<id>` with the token from 2 | one entry named after the Service module |

- [ ] **Step 6: Check the access rules in the copy**

For a member whose role is neither `Admin` nor `CompanyAdmin`:

```sql
DELETE FROM dbo.UserModuleAccess WHERE CompanyId = <id> AND UserId = <that user>;
```

Repeat calls 1 to 3 as that user. Expected: `state: "NoAccess"`; call 6 returns `success: false`, `"You don't have access to this module. Ask your administrator"`.

Then:

```sql
UPDATE dbo.CompanyModules SET IsEnabled = 0 WHERE CompanyId = <id>;
```

Repeat as a company `Admin`. Expected: `state: "NotSubscribed"`; call 6 returns `"This module is not part of your company's subscription"`. Set `IsEnabled = 1` again.

Then (Review Focus 5):

```sql
UPDATE dbo.Companies SET ProvisionStatus = 'Failed' WHERE CompanyId = <id>;
```

Restart the API (the resolver caches). Call 6. Expected: `success: false`, `"Your company is still being set up. Please try again shortly"`. Call 7 with the earlier scoped token. Expected: an error response, not data. Set `ProvisionStatus = 'Ready'` again.

- [ ] **Step 7: Check the rollback in the copy**

Stop the API. Run `15_Company_Tenancy_Rollback.sql` in the main-database copy.
Expected: `Project tables restored.` then `Rollback complete.` and:

```sql
SELECT OBJECT_ID('dbo.Projects') AS Projects, OBJECT_ID('dbo.sp_User_ValidateProject') AS OldProc;
```

returns two non-null values. Run `14_Company_Tenancy_Cutover.sql` again; expected: completes without error.

- [ ] **Step 8: Commit**

```bash
git add EncryptzAPI/Database/MainDB/14_Company_Tenancy_README.md
git commit -m "Add release steps for company-level tenancy"
```

---

## Deferred to later plans

| Spec item | Plan |
|---|---|
| Companies, Modules and Branches screens; module cards with disabled state; scope guard; "Branch" wording | 2 |
| Platform Admin tabs (company database, module switches); customer portal without project picker | 2 |
| Renaming the "project" identifiers and endpoints; removing `X-Project-Key` and `GET auth/projects` | 2 |
| Modules chosen at invite time (`Invitations` JSON) | 2 |
| `DbServers`, `PlatformSettings`, `create-company`, background provisioning, retry, `ProvisionError`, `CreatedBy` | 3 |
| 503 for an unreachable tenant database | 3 |
| `UserLocationAccess` and branch checks in `set-scope` | 4 |
