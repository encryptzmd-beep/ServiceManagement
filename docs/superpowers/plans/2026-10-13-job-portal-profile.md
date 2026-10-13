# Job Portal Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged-in user without a company opens Job Portal at `/apps/jobs` and keeps a profile (profile, experience, education, skills, certificates, resume, visibility) that only they can read or change.

**Architecture:** The data lives in the Personal DB (`EZ_PERSONAL`), schema `jobs`, every row keyed by the main database `UserId`; every procedure takes `@UserId` and filters by it. A new `JobsService` on `PersonalDbHelper` and a `JobsController` (`api/jobs`, login only, user from the token) expose it; input rules live in a pure `JobsRules` class. The UI is one top-level page in a small shell for personal applications.

**Tech Stack:** SQL Server scripts, ASP.NET Core (.NET 10) with ADO.NET, xUnit, Angular 21 (standalone components, signals, Vitest through `ng test`).

**Spec:** `docs/superpowers/specs/2026-10-13-job-portal-profile-design.md`

**Note on form:** the owner chose inline execution in the same session that wrote this plan, so the plan fixes structure, interfaces, rules and tests, and the code is written test-first during execution instead of being copied from the plan.

## Global Constraints

- The SQL Server in `appsettings.json` is LIVE. Only `EZ_PERSONAL` may be touched by this plan, and only by `PersonalDB/02_Jobs_Profile.sql` and by smoke checks that use the user id `-1` and remove their rows. Never touch `MainDBEncryptz` or a company database. Do not print or commit `appsettings.json`.
- SQL changes are new numbered files; `PersonalDB/01_Schema.sql` is frozen. New script: `02_Jobs_Profile.sql`, re-runnable, no `USE` / `CREATE DATABASE` / `DROP DATABASE` / `DROP TABLE`, refuses a database without the `PERSONAL_DB` marker.
- The user id always comes from the token. No endpoint and no DTO takes a user id from the client.
- A row id of another user is answered "not found".
- Files: at most 5 MB; resume `.pdf .doc .docx`; certificate `.pdf .jpg .jpeg .png`; extension and first bytes must agree; served as attachment with `X-Content-Type-Options: nosniff`.
- Limits per user: 30 experience, 20 education, 50 skills, 30 certificates, 1 resume.
- Evidence links: `https://` only, at most 400 characters.
- Messages to users never contain server names, database names or SQL text.
- `dotnet test` runs with `--artifacts-path .superpowers/artifacts` (Visual Studio locks `EncryptzAPI\bin`). UI commands run from `encryptzUI` with `.\node_modules\.bin\ng.cmd test --watch=false --include "<glob>"`.

## Review Focus

1. User A asks for user B's row or file by id (experience, education, skill, certificate, `GET files/{id}`): must be "not found" at the SQL level, not only in the UI.
2. A file named `resume.pdf` whose content is an executable or HTML: refused; and a stored file can never be rendered inline by the browser.
3. The Personal DB is not configured or unreachable: every endpoint answers the one "not available" message, nothing throws to the client, the company page still works.
4. Name or headline is cleared while visibility is on: visibility must go off (a profile without them must not be discoverable later).
5. An evidence link like `javascript:alert(1)` or `http://`: refused on the server; the UI never puts a stored link into `href` unchecked.

## File Structure

| File | Responsibility |
|---|---|
| `EncryptzAPI/Database/PersonalDB/02_Jobs_Profile.sql` (new) | schema `jobs`, six tables, procedures |
| `EncryptzBL/DTO's/JobsDtos.cs` (new) | DTOs of the page and of each row |
| `EncryptzBL/Common/Jobs/JobsRules.cs` (new) | every input rule, file checks, completeness |
| `EncryptzBL/Infrastructure/Jobs/IJobsService.cs`, `JobsService.cs` (new) | calls the procedures through `PersonalDbHelper` |
| `EncryptzAPI/Controllers/JobsController.cs` (new) | `api/jobs` endpoints |
| `EncryptzAPI/SrvInjection/ServiceRegistration.cs` | registers `IJobsService` |
| `encryptzUI/.../Services/jobs-service.ts` (new) | HTTP calls and types |
| `encryptzUI/.../components/personal-shell-component/*` (new) | frame of a personal application |
| `encryptzUI/.../components/job-profile-component/*` (new) | the page |
| `encryptzUI/src/app/app.routes.ts` | route `apps/jobs` |

## Interfaces

Procedures (schema `jobs`; every one has `@UserId INT` first):

- `sp_Profile_Get` → 6 result sets: profile (0 or 1 row), experience, education, skills, certificates (with `FileName`, `SizeBytes`), resume (0 or 1 row: `FileId, FileName, SizeBytes, UploadedAt`).
- `sp_Profile_Save(@FullName, @Headline, @Summary, @City, @ContactEmail, @ContactPhone, @DateOfBirth)` → `Success, Message`; clears `IsVisible` when name or headline is empty.
- `sp_Profile_SetVisible(@IsVisible)` → `Success, Message`.
- `sp_Experience_Save(@ExperienceId, @Organisation, @Title, @StartMonth, @EndMonth, @Description)`, `sp_Education_Save(@EducationId, @Institution, @Course, @FieldOfStudy, @StartYear, @EndYear)`, `sp_Skill_Save(@SkillId, @SkillName, @Level, @EvidenceUrl)` → `Success, Message, Id`.
- `sp_Experience_Delete(@ExperienceId)`, `sp_Education_Delete(@EducationId)`, `sp_Skill_Delete(@SkillId)`, `sp_Certificate_Delete(@CertificateId)`, `sp_Resume_Delete` → `Success, Message`.
- `sp_Skill_Suggest(@Query)` → `SkillName` (at most 10; the one procedure that reads other users' rows, names only).
- `sp_Certificate_Save(@CertificateId, @Title, @Issuer, @IssuedOn, @FileName, @ContentType, @SizeBytes, @Content)` → `Success, Message, Id` (`@Content NULL` = keep the file).
- `sp_Resume_Save(@FileName, @ContentType, @SizeBytes, @Content)` → `Success, Message, Id`.
- `sp_File_Get(@FileId)` → `FileName, ContentType, Content` (0 rows = not found).

C#:

- `JobsRules.ProfileProblem(JobProfileDto)`, `ExperienceProblem(JobExperienceDto, DateTime today)`, `EducationProblem(JobEducationDto, int currentYear)`, `SkillProblem(JobSkillDto)`, `CertificateProblem(JobCertificateDto, DateTime today)` → `string?` (null = fine; they trim the DTO).
- `JobsRules.FileProblem(string kind, string? fileName, long size, ReadOnlySpan<byte> head)` → `string?`; `JobsRules.ContentTypeFor(string fileName)` → `string`; `JobsRules.SafeFileName(string?)` → `string`.
- `JobsRules.Completeness(JobProfilePageDto)` → `int`.
- `IJobsService`: `GetPage`, `SaveProfile`, `SetVisible`, `SaveExperience`, `DeleteExperience`, `SaveEducation`, `DeleteEducation`, `SaveSkill`, `DeleteSkill`, `SuggestSkills`, `SaveCertificate`, `DeleteCertificate`, `SaveResume`, `DeleteResume`, `GetFile`; every method takes `int userId` first and returns `ApiResponse<T>`.

Endpoints (`api/jobs`): `GET profile`, `POST profile`, `POST profile/visible`, `POST experience`, `DELETE experience/{id}`, `POST education`, `DELETE education/{id}`, `POST skills`, `DELETE skills/{id}`, `GET skills/suggest`, `POST certificates` (multipart), `DELETE certificates/{id}`, `POST resume` (multipart), `DELETE resume`, `GET files/{id}`.

## Tasks

### Task 1: Personal DB script

- [ ] Script tests (`EncryptzTests/JobsScriptTests.cs`): no `USE` / database statements; refuses without the marker; every `jobs.sp_*` has `@UserId` as first parameter; every `FROM/JOIN/UPDATE/DELETE` on a `jobs` table inside a procedure other than `sp_Skill_Suggest` is in a statement that mentions `UserId = @UserId`; the limits and the messages of the spec are in the script. Run: FAIL (file missing).
- [ ] Write `02_Jobs_Profile.sql`. Run tests: PASS.
- [ ] Run the script in `EZ_PERSONAL` twice (second run changes nothing), then smoke-check with `@UserId = -1` and `-2`: save profile, rows of each kind, a file; user `-2` gets "not found" for user `-1`'s ids and file; clearing the headline switches visibility off; remove the rows of `-1` and `-2`.
- [ ] Commit.

### Task 2: Rules

- [ ] Tests (`EncryptzTests/JobsRulesTests.cs`) for every rule in the spec section 5, the file checks (PDF, DOC, DOCX, JPG, PNG magic bytes; wrong content; too large; empty; path in the name) and completeness. Run: FAIL.
- [ ] Write `JobsDtos.cs` and `JobsRules.cs`. Run: PASS. Commit.

### Task 3: Service and endpoints

- [ ] Tests (`EncryptzTests/JobsEndpointsTests.cs`): each route and verb; `[Authorize]` on the controller, no `AllowAnonymous`; no action parameter and no DTO property named `UserId`; upload actions have `RequestSizeLimit`; `IJobsService` methods all take `int userId` first; the service is registered; source check that every service method tests `IsConfigured` (through one guard) before the database. Run: FAIL.
- [ ] Write `IJobsService`, `JobsService`, `JobsController`, register. Run: PASS; whole suite PASS. Commit.

### Task 4: UI

- [ ] Specs (`job-profile-component.spec.ts`): renders the six sections from the API answer; a refused save keeps the dialog open with the message; the visibility switch calls the API and shows a refusal and stays off; "not available" state; an evidence link that is not `https://` is not rendered as a link; the Individual ID is shown in the shell. Run: FAIL.
- [ ] Write `jobs-service.ts`, `personal-shell-component`, `job-profile-component`, the route. Run: PASS; `ng build` succeeds. Commit.

### Task 5: Verification

- [ ] Whole API suite and the UI specs of the touched areas; production build.
- [ ] Restart the background API on 5092 with the new build.
- [ ] Final whole-branch review by a fresh reviewer (Review Focus above), one fix pass with a failing test first for each Critical / Important finding.
- [ ] Hand the manual steps to the owner: release Job Portal in Platform Admin (route `/apps/jobs`), fill a profile, check a second account sees nothing of it.
