# Job Portal Phase 2 (Job Postings and Applications) Implementation Plan

**Goal:** Companies publish job postings; people search, save and apply with their profile and follow the status.

**Spec:** `docs/superpowers/specs/2026-10-13-job-portal-jobs-design.md`

**Execution:** native (the same session), test first, one commit per task.

## Global constraints

- Personal DB only (`EZ_PERSONAL`, schema `jobs`); script `06_Jobs_Postings.sql`, re-runnable, guarded like 02 to 05; no existing script is edited.
- A person procedure takes `@UserId` first, a company procedure `@CompanyId` first; every statement on `jobs.Applications`, `jobs.SavedPostings`, `jobs.Postings` (company side) names the one or the other.
- No endpoint takes a user id or a company id from the request. The person is `MainIdentity.UserId(User)`; the company is the `CompanyId` claim, and the caller's role in it is read from the main database on every call (`HiringAccess`).
- Nothing of a profile is copied; a company reads an applicant only through an application that is not withdrawn.

## Tasks

1. **Script 06** - tables `jobs.Postings`, `jobs.Applications`, `jobs.SavedPostings`, `jobs.ProfileViews`; person procedures `sp_Posting_Search`, `sp_Posting_Get`, `sp_Application_Apply`, `sp_Application_Withdraw`, `sp_Application_ListMine`, `sp_Saved_Set`, `sp_Saved_ListMine`; company procedures `sp_Company_Posting_List/_Get/_Save/_SetStatus/_Delete`, `sp_Company_Applicant_List/_Get/_Resume/_SetStatus`. Script tests (`JobPostingsScriptTests`) and a run against `EZ_PERSONAL` with negative test ids.
2. **Rules and DTOs** - `JobPostingDtos.cs`, `JobPostingRules` (posting fields, lists, ranges, note, paging), `HiringAccess` (who may post). Unit tests.
3. **Services** - `IJobPostingsService` (person) and `ICompanyJobsService` (company), implemented in `JobsService.Postings.cs` / `JobsService.Company.cs` (partial class: the one guard is shared). The profile mapping of `GetPage` becomes `MapPage` and is reused for an applicant.
4. **Endpoints** - `JobPostingsController` (`api/jobs`: postings, apply, save, applications, withdraw, saved) and `CompanyJobsController` (`api/company-jobs`). Reflection tests: routes, `[Authorize]`, no user or company parameter.
5. **Person pages** - `job-board-component` for the routes `apps/jobs/search`, `apps/jobs/applications`, `apps/jobs/saved`; the side menu loses "Soon". Specs.
6. **Company pages** - `hiring-component` (route `hiring`): postings with dialog and status buttons, applicants with profile and resume; the card "Job postings" on the company's application page for administrators. Specs.
7. **Whole-branch check** - full API suite, the UI specs of the touched components, a production build, a self-review of the diff against the spec.

## Review focus

- A posting or an applicant of another company must be "Not found" in every company procedure.
- An applicant who withdrew must not be readable (list, profile, resume, status).
- A draft, a closed posting and one past its closing date must not be searchable or take applications.
- Applying twice, and applying again after a withdrawal.
- A caller who lost the administrator role keeps a token: the role is read from the database, not the token.
