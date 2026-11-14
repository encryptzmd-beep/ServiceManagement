# SaaS Tenancy Redesign: One Company = One Database

Date: 2026-10-11
Branch: `feature/saas-tenant-db-routing` (based on `MigrationSASS` at `8dfae0b`)
Status: Design approved section by section in conversation; awaiting written-spec review.

## 1. Goal

Make the application behave as the SaaS product the owner intends:

1. A person registers with their own identity (no company).
2. After login they see the companies they belong to and can **create their own company** from that screen.
3. Creating a company **immediately provisions a dedicated database** for it on a SQL Server taken from settings held in the SaaS main database.
4. After selecting a company they see the **module list**. Every module is listed for everyone (marketing); the button is disabled when the user has no access. Only the Service module exists today.
5. They then pick a **branch** and enter the application. All requests are routed to that company's database.

Success means a newly registered user can go from registration to a working, isolated Service application for their own company without any manual step by a platform administrator, and the existing tenants keep working unchanged.

## 2. Decisions

| # | Topic | Decision |
|---|---|---|
| D1 | Tenant model | One company = one tenant = one database. |
| D2 | Modules | All modules of a company live in that one database. A module is an access concept, not a database. |
| D3 | Branches | A tenant can have many branches. "Branch" is the existing tenant-DB `Locations` table; no new entity. |
| D4 | Project layer | Removed from the control plane and from everything the user sees (Approach 2). The tenant database is not restructured. |
| D5 | Provisioning | Immediate and automatic when the user creates a company. No approval step. |
| D6 | Server settings | The main DB holds a list of SQL servers with credentials; one is the default for new tenants. |
| D7 | Credentials | One login per server: it creates the database and is also used to connect to it. |
| D8 | Connection storage | The tenant's connection details are stored on the company's own row. |
| D9 | Abuse limit | Configurable maximum companies a user may create, stored in main-DB settings, default 1. |
| D10 | Screen flow | Companies screen and Modules screen are always shown. The Branches screen is skipped when the user has exactly one branch. |
| D11 | Branch access | Per user, managed by the company admin. Admin roles see all branches. |
| D12 | Module access | Enabled only when the company has the module AND the user was granted it. Company admins get all of the company's modules. |
| D13 | New company defaults | Service module is switched on; the creator becomes company Admin. |

## 3. Current state (verified)

Code on this branch already has a control plane (`MainDBEncryptz`) and per-request routing to a tenant database:

- `TenantResolutionMiddleware` reads the `ProjectKey` claim and fills a scoped `TenantContext`.
- `ConnectionResolver` resolves `ProjectKey` to a connection string via `Projects` + `ProjectConnections` and caches it.
- `DbHelper` (tenant) and `MainDbHelper` (control plane) are separate executors; tenant connections publish scope to `SESSION_CONTEXT`, and a row-level security policy in the tenant DB filters by `ProjectId` + `LocationId`.
- Flow today: `login-v2` → `select-company` → `projects` → `locations` → `set-scope`.

Read-only inspection of the live main database on 2026-10-11:

| Company | Code | Project | ProjectKey | Database | Active members |
|---|---|---|---|---|---|
| Felix Fitness (Demo), id 1 | C001 | id 1 | `C001-P001` | `FelixServiceDB` | 6 |
| Hamster A/C, id 2 | C002 | id 2 | `C002-P001` | `HamsterserviceDB` | 3 |

- Each company has exactly one project and its own database, so the data already fits D1.
- Company 1 has one project grant whose user has no active company membership.
- `Companies` has only: `CompanyId, CompanyName, CompanyCode, Address, City, PhoneNumber, IsActive, CreatedAt`.
- `HamsterserviceDB`: 45 tables, 318 procedures, one location (`LocationId 1, CompanyId 2, ProjectId 2`), `Users.MainUserId` present, one active security policy, no `UserLocationAccess` table.

Gaps against the goal:

- `AuthService.CreateCompany` always returns "disabled"; only a platform admin can create a company, and must type server/database/user/password by hand.
- No module concept.
- The user must pick a project.
- `sp_User_GetCompanies` lists only companies where the user has a project grant, so a company without one is invisible.
- Any member can pick any location; an `X-Location-Id` header overrides the token's location without a check.
- A business call without a selected scope fails with HTTP 500.
- The UI `companyGuard` exists but no route uses it.

## 4. Main database changes

### 4.1 New tables

| Table | Purpose | Columns |
|---|---|---|
| `DbServers` | SQL servers on which tenant databases are created | `DbServerId`, `ServerName`, `AdminUser`, `AdminPasswordEnc`, `ExtraOptions`, `IsDefault`, `IsActive`, `CreatedAt` |
| `PlatformSettings` | Key/value platform settings | `SettingKey` (PK), `SettingValue`, `UpdatedAt`, `UpdatedBy`. Seeded with `MaxCompaniesPerUser = 1` |
| `Modules` | Module catalogue shown to everyone | `ModuleId`, `ModuleKey` (unique, e.g. `SERVICE`), `ModuleName`, `Description`, `Icon`, `SortOrder`, `IsActive` |
| `CompanyModules` | Which modules a company has | `CompanyId`, `ModuleId`, `IsEnabled`, `UpdatedAt`; unique on (`CompanyId`, `ModuleId`) |
| `UserModuleAccess` | Which modules a user may open in a company | `CompanyId`, `UserId`, `ModuleId`, `GrantedBy`, `GrantedAt`; unique on all three |

- A filtered unique index guarantees at most one `DbServers` row with `IsDefault = 1`.
- `AdminPasswordEnc` uses the existing `ITenantSecretProtector` (AES, key `Tenant:SecretKey`).

### 4.2 New columns on `Companies`

| Column | Meaning |
|---|---|
| `TenantKey` | Stable routing key carried in the token. Unique. Never changes when `CompanyCode` is edited. |
| `DbServerId` | Server that hosts the database (nullable for manually attached databases on an unlisted server). |
| `ServerName`, `DatabaseName`, `DbUser`, `DbPasswordEnc`, `ExtraOptions` | Connection details of this tenant. |
| `TenantScopeId` | Constant written to the tenant DB's `ProjectId` columns and passed as `@ProjectId`. Existing tenants keep their current project id; new tenants use 1. |
| `ProvisionStatus` | `None`, `Provisioning`, `Ready`, `Failed`. |
| `ProvisionError` | Last failure text; visible to platform admins only. |
| `ProvisionStartedAt` | Used to detect stuck jobs. |
| `CreatedBy` | User who created the company; used for the limit. |

Connection details are stored as parts, not as one string, so that only the password needs encrypting and "which tenants are on which server" is a plain query. The API builds and caches the connection string.

### 4.3 Other changes

- `MenuItems.ModuleId` added; all existing menus are assigned to `SERVICE`.
- `Projects`, `ProjectConnections`, `UserProjectAccess` are no longer used. The migration renames them with an `_Old` suffix; they are not dropped.
- `UserSessions.SelectedProjectId` is no longer written.
- `Invitations` gains the modules and branches chosen at invite time (stored as JSON text) so they can be applied on acceptance.

## 5. Company creation and provisioning

### 5.1 Request

`POST /api/auth/create-company` (identity token is enough). Body: company name, company code, address, city, phone, first branch name.

Validated in the request:

1. Companies created by this user with status other than `Failed` is below `MaxCompaniesPerUser`. Platform admins are exempt.
2. Company code is unused.
3. A default active `DbServers` row exists.

Then, in one main-DB transaction: insert `Companies` (`ProvisionStatus = Provisioning`, generated `TenantKey`, `TenantScopeId = 1`, `CreatedBy`), `CompanyUsers` (creator as `Admin`), `CompanyModules` (Service enabled), `UserModuleAccess` (creator). The request returns immediately with the new company in `Provisioning` state.

### 5.2 Background job

Provisioning runs in an in-process background worker because the tenant script has about 1,470 batches and can outlast a proxy timeout.

1. Connect to the default server's `master` with its admin login and run `CREATE DATABASE` for a server-generated name.
2. Run `New_Tenant_Database.sql` against the new database on a single connection, supplying `CompanyId`, scope id and first branch.
3. Write the connection details to the company row and set `Ready`.

Rules:

- The database name is generated on the server from the company id (for example `EncryptzTenant_000123`). No user-typed text is ever placed in a database name or in dynamic SQL.
- On any failure the database created in this attempt is dropped, status becomes `Failed` and the error is stored in `ProvisionError` and logged.
- `POST /api/auth/companies/{id}/retry-provision` restarts a `Failed` company; allowed for its creator and for platform admins; refused while status is `Provisioning`.
- On API start-up, rows that have been `Provisioning` for more than 15 minutes are set to `Failed`.
- `create-company` is rate limited.

### 5.3 Tenant script

`Build-NewTenantScript.ps1` is changed so the generated script takes its settings from values the API supplies, while still being runnable by hand in SSMS. The script's existing guard (refuses `master`, the main DB and non-empty databases) is kept.

### 5.4 Platform admin

- Database Servers: list, add, edit, test connection, set default.
- Platform Settings: edit `MaxCompaniesPerUser`.
- Company database: view status and error, retry, attach an existing database by hand, switch modules on and off.

## 6. Login, token and routing

| Step | Endpoint | Token contains | Allows |
|---|---|---|---|
| 1 | `login-v2` | user | list/create companies, invitations |
| 2 | `select-company` | + company, role in company | module list, branch list, company administration |
| 3 | `set-scope` | + `TenantKey`, module, branch, tenant user id, technician id | business data |

- The company list is driven by `CompanyUsers` membership and includes `ProvisionStatus`.
- `set-scope` takes `moduleKey` and `locationId` (no project). It verifies: company is active and `Ready`; module is enabled for the company; user has the module; user has the branch. It then syncs the user into the tenant DB and issues the scoped token.
- Menus returned are those of the selected module, filtered by role.
- `TenantResolutionMiddleware` reads `TenantKey`; `ConnectionResolver` resolves it from `Companies` (active and `Ready` only) and caches it. The cache entry is evicted when a company's connection changes or the company is deactivated.
- The value sent to the tenant DB as `ProjectId` is `Companies.TenantScopeId`. Tenant procedures are unchanged.

Compatibility with tokens issued before deployment:

- Each existing company's `TenantKey` is set to its current `ProjectKey`.
- The middleware falls back to the `ProjectKey` claim and, for anonymous customer-portal calls, to the `X-Project-Key` header. This fallback is temporary and can be removed once old tokens have expired.

Fixes included:

- A business endpoint called without a resolved scope returns 403 with a clear message instead of 500.
- The `X-Location-Id` override header is removed. Switching branch means calling `set-scope` again. Any UI use of the header is replaced.

Customer portal: resolving a company code returns that company's single `TenantKey`; the project picker is removed.

Not changed: a user removed from a company keeps a valid token until it expires (up to 24 hours).

## 7. Module and branch access

### 7.1 Modules

`GET /api/auth/modules` (company token) returns every active module with a state:

| State | Condition | UI |
|---|---|---|
| `Available` | company has it and user has it | enabled |
| `NotSubscribed` | company does not have it | disabled, "Not subscribed" |
| `NoAccess` | company has it, user does not | disabled, "Ask your administrator" |

- Platform admin manages `CompanyModules`. Company admin manages `UserModuleAccess`.
- Users with company role `Admin` or `CompanyAdmin` have every module the company has.
- Enforcement is on the server: in `set-scope`, and by a filter on business controllers that checks the token's module claim. The disabled button is presentation only.

### 7.2 Branches

- New tenant-DB table `UserLocationAccess` (`UserId`, `LocationId`), keyed on the tenant-local user id.
- Company admin assigns branches per user. `Admin` and `CompanyAdmin` have all branches.
- The branch list returns only the user's branches; `set-scope` re-checks.
- A user with no branch cannot enter the company and sees "No branch assigned". Invitations require at least one branch.
- Data separation relies on the existing row-level security policy, which already filters location-scoped tables by the token's branch.

Known and accepted: tables the tenant DB treats as company-wide (users, technicians, customers, products, masters, settings) stay visible from every branch. Only location-scoped data (complaints and dependants, schedule, attendance, tracking, payments) is separated.

## 8. User interface

Flow: Login → Companies (always) → Modules (always) → Branches (skipped if one) → App.

1. Companies (`/select-company`): cards with name, role, status (`Ready`, `Setting up…`, `Setup failed` with Retry); Create Company button, disabled with a reason when the limit is reached; pending invitations and join requests on the same screen; empty state replaces the separate `/no-company` screen; polls while any company is `Provisioning`.
2. Create Company form.
3. Modules (`/select-module`), new: one card per module with icon, name, description and state.
4. Branches (`/select-branch`): built from the existing project/location picker with the project part removed.
5. In the app: header branch switcher with links to Modules and Switch company; "Location" is labelled "Branch"; "Project" is removed from the wording; a scope guard on all app routes redirects to the first missing step.
6. User management and invite form: module and branch checkboxes; project picker removed.
7. Platform admin tabs: Companies (database status, retry, attach, modules), Database Servers (new), Settings (new), Branches, Menus (with module); the Projects & Databases tab is removed.
8. Customer portal login/register: project picker removed.

## 9. Migration and rollout

All scripts are re-runnable. They are written here and run on the live server by the owner.

### 9.1 Main DB migration script

1. Pre-check: stop without changes if any company has more than one active project or any database is shared by more than one company.
2. Create the new tables and columns.
3. For each company copy its project's connection onto the company row: `TenantKey = ProjectKey`, `TenantScopeId = ProjectId`, `ProvisionStatus = Ready`. Passwords are copied as stored (same key). Companies without a database get `ProvisionStatus = None`.
4. Insert one `DbServers` row from the existing connection details and mark it default.
5. Seed `Modules` with `SERVICE`; enable it for every company with a database; grant it to every active company member; assign all menus to it.
6. Seed `PlatformSettings`.
7. Replace the login/company procedures.
8. Rename `Projects`, `ProjectConnections`, `UserProjectAccess` to `_Old`.
9. Report, without changing them, project grants whose user has no active company membership (one exists in company 1).

### 9.2 Tenant DB script

- Creates `UserLocationAccess`, grants every existing tenant user every active branch, and updates the branch list/validate procedures to filter by user.
- Additive: works with the old API, so it can be run ahead of the deployment.
- Added to the sources of `New_Tenant_Database.sql`.

### 9.3 Order

1. Back up the main DB and the tenant DBs.
2. Rehearse on restored copies.
3. Run the tenant script on each tenant DB.
4. Maintenance window: stop API → main DB migration → deploy API and UI → start API.
5. Verify: staff login through company, module and branch to the dashboard; technician work orders; customer portal login; create a test company and enter it.

### 9.4 Rollback

A rollback script renames the `_Old` tables back and restores the previous procedures. New tables and columns are left in place and are ignored by the old API. Redeploying the previous API and UI restores the earlier behaviour. No tenant business data is modified by the migration.

### 9.5 Operational note

The connection login needs the `dbcreator` server role. If the current login is `sa`, replacing it with a dedicated login limited to `dbcreator` is recommended; this is a server setting, not a code change.

## 10. Error handling

| Situation | Behaviour |
|---|---|
| No default server | create-company refused: "Company creation is not available right now" |
| Limit reached | refused, states the limit |
| Company code in use | refused |
| `CREATE DATABASE` fails | `Failed`; generic message and Retry for the user; detail for platform admins and in logs |
| Tenant script fails part-way | database from this attempt dropped; `Failed` |
| Concurrent retry | second refused while `Provisioning` |
| API restart mid-job | stuck rows marked `Failed` at start-up |
| Company not `Ready` | `set-scope` refused |
| No module or branch access | `set-scope` 403 with reason |
| Business call without scope | 403 |
| Tenant database unreachable | 503 for that tenant only |

Messages shown to users never contain server names, database names or SQL errors.

## 11. Testing

There are no backend tests today. A test project is added and new logic is built test-first.

Unit tests (no database):

- database name generation never contains user input
- splitting the tenant script into `GO` batches
- company limit calculation
- module state calculation
- token claims and the `ProjectKey` fallback
- middleware routing and the 403 for a missing scope

Integration tests (need a SQL Server; run only when a connection string is supplied through an environment variable):

- main-DB scripts on an empty database
- create company → database created → `set-scope` → a business endpoint
- two tenants: one tenant's token cannot read the other's data
- branch access refusal
- provisioning failure drops the partial database
- migration from the old structure, then rollback

UI tests (Vitest): scope guard, module card states, skipping the branch screen.

Manual: the rollout verification list, first on copies.

### Test environment constraint

There is no separate test server. The owner allows careful use of the live server, limited to databases they name. Named so far: `MainDBEncryptz` and `HamsterserviceDB`, both treated as read-only. Still to be confirmed before any integration test or migration rehearsal is run by the assistant: which databases may be written to, and whether creating and dropping prefixed test databases on that server is allowed. Until confirmed, integration tests and rehearsals are run by the owner.

## 12. Out of scope

- Email verification before company creation.
- Immediate token revocation when membership is removed.
- An "all branches" combined view.
- Branch-level separation of customers, products and other company-wide tables.
- Removing `ProjectId` from the tenant database (Approach 3).
- Per-tenant SQL logins.
- Billing or subscription payment.
