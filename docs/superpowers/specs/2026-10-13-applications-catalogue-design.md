# Applications: Personal and Commercial

Date: 2026-10-13
Branch: `feature/saas-tenant-db-routing`
Status: Design agreed in conversation; awaiting written-spec review.

## 1. Goal

The platform offers **applications**. An application is what the code calls a module
(`dbo.Modules`). There are two types:

- **Personal**: free, belongs to the person. Every registered user can open it without
  a company. Its data is the user's own.
- **Commercial**: a company (tenant) subscribes to it. Its data is in the company's
  database.

A platform administrator manages the catalogue. Personal applications are listed on the
company selection page after login. Commercial applications are listed, as today, on the
module page after a company is picked.

Success for phase 1 means: the platform administrator can add and edit applications of
both types; a logged-in user sees the personal applications on the company page; a
company's module page and subscription list show commercial applications only; nothing
that works today for the Service application changes.

## 2. Decisions

| # | Topic | Decision |
|---|---|---|
| A1 | Naming | "Application" in the UI is the existing "module". Tables and procedures keep the name `Module`. |
| A2 | Types | `Personal` and `Commercial`. The type cannot be changed while a company is subscribed to the application. |
| A3 | Personal data | One shared **Personal DB**, outside every tenant. Rows are keyed by the main database `UserId`. |
| A4 | Personal DB layout | One database, one schema per application (`jobs`, `expense`, ...). |
| A5 | Personal access | Every active user may open every released personal application. No subscription and no grant rows. |
| A6 | Commercial access | Unchanged: the company has it (`CompanyModules`) and the member was granted it (`UserModuleAccess`); company administrators always. |
| A7 | Tenant reads of personal data | A tenant never connects to the Personal DB. A commercial application may contain a named feature that reads one personal application through the API. The API checks the company's subscription and the user's access to that commercial application. |
| A8 | Candidate search | The Payroll application has "search for candidate". It is the only way a company sees Job Portal profiles. |
| A9 | Profile visibility | A Job Portal profile has an on/off switch owned by the user. Default **off**. The API enforces it, also for a profile opened by direct link or from a shortlist. |
| A10 | Expense Manager | Private. No commercial application gets a feature that reads it. |
| A11 | Not built yet | An application that is listed but not built carries a "Coming soon" flag. It cannot be opened and a company cannot be subscribed to it. Every list that shows it highlights the flag with a badge. |
| A13 | Family | An application has an optional family (free text, for example "Business", "HR", "Education"). Phase 1 stores, edits and shows it. Grouping and filtering by family come later. |
| A12 | Billing | Out of scope. The platform administrator switches a commercial application on for a company, as today. |

## 3. Phases

Each phase has its own plan and can be released alone.

1. **Foundation** (this spec, sections 4 to 7): application type in the catalogue, the
   Applications screen for the platform administrator, personal applications on the
   company page, the Personal DB connection.
2. **Job Portal** (personal): profile, skills, experience, education, resumes,
   visibility switch. Outline in section 8.
3. **Expense Manager** (personal).
4. **Payroll** (commercial) with candidate search. Outline in section 8.

Inventory, CRM, Accounts, Job Consultancy and School are catalogue entries only
("Coming soon") until each gets its own spec.

## 4. Main database (phase 1)

One new numbered script, `21_Applications.sql`. Scripts 13 to 20 are frozen and are not
edited. It refuses to run before script 20.

### 4.1 `dbo.Modules`: new columns

| Column | Type | Meaning |
|---|---|---|
| `AppType` | `NVARCHAR(20) NOT NULL`, default `'Commercial'`, check `IN ('Personal','Commercial')` | Type of the application. |
| `RoutePath` | `NVARCHAR(200) NULL` | Where the UI goes when a personal application is opened, for example `/apps/jobs`. Not used for commercial applications in phase 1. |
| `IsReleased` | `BIT NOT NULL`, default `0` | `0` = "Coming soon": listed, cannot be opened, cannot be subscribed. |
| `Family` | `NVARCHAR(100) NULL` | Category of the application. Free text, trimmed; empty is stored as `NULL`. |

The existing `SERVICE` row becomes `Commercial`, `IsReleased = 1`.
`IsActive = 0` keeps its meaning: the application is hidden from everyone but the
platform administrator.

### 4.2 Seed

Inserted when the key does not exist. Never overwrites a row that is there.
`Family` is left `NULL` for every row: the platform administrator fills it in.

| Key | Name | Type | Released |
|---|---|---|---|
| `SERVICE` | Service Management | Commercial | yes (exists) |
| `INVENTORY` | Inventory | Commercial | no |
| `CRM` | CRM | Commercial | no |
| `ACCOUNTS` | Accounts | Commercial | no |
| `PAYROLL` | Payroll | Commercial | no |
| `JOBCONSULTANCY` | Job Consultancy | Commercial | no |
| `SCHOOL` | School | Commercial | no |
| `JOBPORTAL` | Job Portal | Personal | no |
| `EXPENSE` | Expense Manager | Personal | no |

### 4.3 Procedures

New:

- `sp_Platform_GetModules`: the whole catalogue, inactive rows included, with the number
  of companies subscribed to each.
- `sp_Platform_SaveModule`: insert or update. Refuses a duplicate key. Refuses a change
  of `ModuleKey` on an existing row. Refuses a change of `AppType` when the application
  has a `CompanyModules` row. Refuses `IsReleased = 1` for a personal application
  without a `RoutePath`.
- `sp_User_GetPersonalApps`: active personal applications, in sort order, with
  `IsReleased` and `Family`.

`sp_Platform_GetModules` and `sp_Platform_SaveModule` read and write `Family`.

Re-created with one more condition, `AppType = 'Commercial'`:

- `sp_User_GetModules`, `sp_User_ValidateScope` (script 14)
- `sp_Platform_GetCompanyModules`, `sp_Platform_SetCompanyModule`,
  `sp_Platform_GetModuleAccess`, `sp_Platform_SetModuleAccess` (script 19)
- `sp_Company_GrantDefaultModules` is not changed: it reads `CompanyModules`, which can
  no longer hold a personal application.

`sp_Platform_SetCompanyModule` also refuses to switch on an application that is not
released.

`sp_User_GetModules` returns `IsReleased` and `Family`; the API maps `IsReleased = 0`
to the new module state `ComingSoon`.

**Re-run rule.** Scripts 14 and 19 re-create these procedures in their earlier form.
Every time script 14 or 19 is run again, run script 21 again afterwards. The header of
script 21 and `14_Company_Tenancy_README.md` say so (the README gets a new numbered
note file, it is not edited: `21_Applications_README.md`).

## 5. Personal DB (phase 1)

- A new SQL Server database. The name is the owner's choice; the spec calls it
  `PersonalDB`. It is created by hand, never by the API.
- Connection string `ConnectionStrings:PersonalConnection` in `appsettings.json`, next
  to `MainConnection`. It is never sent to a client and never stored on a company row.
- A new executor `PersonalDbHelper`, the third next to `MainDbHelper` (control plane)
  and `DbHelper` (tenant). It takes no tenant context.
- Scripts live in `EncryptzAPI/Database/PersonalDB/`, numbered from `01`.
- Phase 1 delivers `01_Schema.sql` only: the guard (refuses a system database, the main
  database and a tenant database) and an empty `dbo.SchemaInfo` table that marks the
  database as the Personal DB. Application schemas arrive with their phases.
- When `PersonalConnection` is missing, the API starts normally; personal applications
  that need it answer "This application is not available right now".

No copy of `dbo.Users` is kept in the Personal DB. A personal application stores the
display fields it needs on its own rows.

## 6. API (phase 1)

| Endpoint | Who | Does |
|---|---|---|
| `GET api/platform/applications` | platform administrator | catalogue from `sp_Platform_GetModules` |
| `POST api/platform/applications/save` | platform administrator | `sp_Platform_SaveModule` |
| `GET api/auth/personal-apps` | any logged-in user (login token is enough, no company) | `sp_User_GetPersonalApps` |

The two platform endpoints sit in `PlatformController` behind the existing
`[PlatformUnlocked]` filter and the `IsPlatformAdmin` check in `PlatformService`.
A company administrator gets "not allowed".

## 7. UI (phase 1)

- **Platform Admin, "Applications" section** (sidebar entry and tab, platform
  administrator only, placed after "Companies"): a table with name, key, family, type,
  status, active, subscribed companies; "+ New Application" and "Edit" open one
  dialog (key, name, description, icon, family, type, route, sort order, released,
  active). The key is read-only on edit. The family input suggests the families
  already in use, so the same family is not typed in two spellings.
- **"Coming soon" badge.** One shared style, an amber pill with the text
  "Coming soon", used in all four places below so it reads the same everywhere:
  the status column of the Applications table (a released application shows a green
  "Released" pill there), the personal application cards, the module cards, and the
  Modules dialog of a company.
- **Company page** (`/select-company`): a "Personal applications" block under the
  company list. One card per application. A released application opens its
  `RoutePath`; a "Coming soon" card carries the badge and is disabled. The block is
  hidden when the list is empty or the call fails; the company list is never blocked
  by it.
- **Module page** (`/select-module`): unchanged apart from the new state
  `ComingSoon` (card disabled, with the badge).
- **Modules dialog of a company** in Platform Admin: an application that is not
  released is listed with the badge and its switch is disabled.
- A personal application opens outside the company scope: its routes need a login
  only, not a company, module or branch. `scopeGuard` gets a third need, `none`.
  Phase 1 adds no such route, since no personal application is released yet.

## 8. Later phases (outline, each gets its own spec)

### Job Portal, schema `jobs` in the Personal DB

| Table | Holds |
|---|---|
| `jobs.Profiles` | one row per user: name, headline, summary, city, contact, `IsVisible` (default 0) |
| `jobs.Skills`, `jobs.ProfileSkills` | skill list and who has which |
| `jobs.Experience`, `jobs.Education` | work history and education |
| `jobs.Resumes` | file name and storage location; the file itself is outside the database |
| `jobs.ProfileViews` | which user of which company opened which profile, and when |

### Payroll, in the tenant database

- All applications of a company stay in its one database.
- Candidate search calls the API; the API checks the Payroll subscription and the
  user's Payroll access, reads `jobs.Profiles` where `IsVisible = 1`, and writes
  `jobs.ProfileViews` when a profile is opened.
- A shortlist row in the tenant database holds the candidate's `UserId` and the
  company's own notes. It holds no copy of the profile, so switching visibility off
  also closes the profile for companies that shortlisted it.

## 9. Error handling

- Catalogue save: the procedure returns `Success` + `Message`; the dialog shows the
  message and stays open.
- Personal applications list fails: the block is hidden, nothing else on the company
  page is affected.
- A company is subscribed to an application that is later set to not released or
  inactive: the subscription row stays, the card shows "Coming soon" (or disappears
  when inactive), nobody can enter.

## 10. Testing

- Unit tests (xUnit, `EncryptzTests`) for the rules that decide a module state,
  including `ComingSoon`, and for the save rules that are checked in C#.
- Script tests in the existing style (text checks on the `.sql` files): script 21
  re-creates each listed procedure, every re-created procedure contains the
  `AppType = 'Commercial'` condition, and the script refuses to run before script 20.
- Angular specs: the Applications section is shown to a platform administrator only;
  the personal applications block renders released and coming-soon cards and survives a
  failed call; the module page disables a `ComingSoon` card.
- Manual check on a copy of the main database before the live one: run script 21
  twice (safe to re-run), then the Service flow end to end.

## 11. Out of scope

Billing and payment, plans and trials, self-service subscription by a company
administrator, moving a personal application to its own database, any screen of
Inventory, CRM, Accounts, Job Consultancy and School.
