# Job Portal, Phase 2: Job Postings and Applications

Date: 2026-10-13
Branch: `feature/saas-tenant-db-routing`
Status: Written from the owner's direction "continue with phase 2"; awaiting written-spec review.
Builds on: `2026-10-13-job-portal-profile-design.md` (the profile) and
`2026-10-13-applications-catalogue-design.md` (personal applications, Personal DB).

## 1. Goal

Phase 1 gave every person a profile. Phase 2 gives the profile a use: companies
publish job postings, people find them, apply with their profile, and follow what
happens to each application.

Success means: an administrator of a company publishes a posting; a person without
any company finds it under "Search jobs", saves it, applies; the administrator sees
the applicant with profile and resume and moves the application to Shortlisted,
Rejected or Hired; the person sees that status under "My applications" and can
withdraw. A company sees a profile only of a person who applied to it.

## 2. Decisions

| # | Topic | Decision |
|---|---|---|
| P1 | Who posts | An **administrator of a company** (role `Admin` in that company). No subscription is needed in this phase. Reason: the commercial applications that should own hiring (Payroll, Job Consultancy) are "Coming soon" and a company cannot be subscribed to an application that is not released. When one of them is built, posting moves under it and its subscription becomes the condition (decision A7/A8 of the catalogue spec). The check lives in one place so that this is a small change. |
| P2 | Who applies | Any active, logged-in user whose profile has a name and a headline. A resume is recommended, not required. |
| P3 | What applying shares | Applying is the person's consent that **this company** sees their profile, experience, education, skills, certificates (titles, not files) and resume, for as long as the application is not withdrawn. The dialog that sends the application says so. The "Employers can find me" switch is not involved: it stays the switch for being *found by search*, which no screen offers yet. |
| P4 | Live data, no copy | The company reads the applicant's current profile through the API. Nothing of it is copied to the posting or to a tenant database. After a withdrawal the company no longer sees the profile. |
| P5 | Where the data lives | Postings, applications and saved postings are in the Personal DB, schema `jobs`: people of every company and of none search them. A tenant database gets nothing in this phase. |
| P6 | Posting states | `Draft` (only the company sees it), `Open` (searchable, takes applications), `Closed` (not searchable, takes none; its applications stay). A posting with a closing date behaves as closed after that date. A posting with applications cannot be deleted, only closed. |
| P7 | Application states | `Applied` -> `Shortlisted` / `Rejected` / `Hired`, set by the company; `Withdrawn`, set by the person. One application per person and posting; after a withdrawal the person may apply again while the posting is open. |
| P8 | Company name | The posting carries the company's name as it was when published (a snapshot from the main database), and the `CompanyId`. |
| P9 | Audit | Every time a company user opens an applicant's profile or resume a row is written to `jobs.ProfileViews`. No screen shows it in this phase. |
| P10 | Limits | Per company: 100 postings that are not closed. Per person: 200 applications that are not withdrawn, 200 saved postings. |
| P11 | Not in this phase | Searching profiles ("candidate search"), messages between company and applicant, e-mail notifications, interview scheduling, paid or featured postings, moderation by the platform administrator, postings by a person without a company. |

## 3. Personal DB

One new script, `EncryptzAPI/Database/PersonalDB/05_Jobs_Postings.sql`. Same guards
as scripts 02 to 04; re-runnable; changes no existing table or procedure.

| Table | Columns |
|---|---|
| `jobs.Postings` | `PostingId` identity, `CompanyId INT`, `CompanyName NVARCHAR(200)`, `Title NVARCHAR(200)`, `City NVARCHAR(100)`, `EmploymentType NVARCHAR(20)` (`Full-time`, `Part-time`, `Contract`, `Internship`), `WorkMode NVARCHAR(20)` (`On-site`, `Remote`, `Hybrid`), `ExperienceMinYears TINYINT NULL`, `ExperienceMaxYears TINYINT NULL`, `SalaryMin INT NULL`, `SalaryMax INT NULL` (per month, shown only when given), `Skills NVARCHAR(400)` (free text), `Description NVARCHAR(4000)`, `Status NVARCHAR(10)` (`Draft`, `Open`, `Closed`), `ClosesOn DATE NULL`, `PostedBy INT`, `PublishedAt DATETIME NULL`, `CreatedAt`, `UpdatedAt` |
| `jobs.Applications` | `ApplicationId` identity, `PostingId` -> `jobs.Postings`, `UserId INT`, `Note NVARCHAR(1000)`, `Status NVARCHAR(12)`, `AppliedAt`, `StatusAt`; unique on (`PostingId`, `UserId`) |
| `jobs.SavedPostings` | `UserId INT`, `PostingId` -> `jobs.Postings`, `SavedAt`; key (`UserId`, `PostingId`) |
| `jobs.ProfileViews` | `ViewId` identity, `CompanyId INT`, `ViewerUserId INT`, `UserId INT`, `PostingId INT`, `What NVARCHAR(10)` (`Profile`, `Resume`), `ViewedAt` |

The rule of schema `jobs` is extended, not relaxed:

- A procedure for a **person** takes `@UserId` first. Every statement on
  `jobs.Applications` and `jobs.SavedPostings` names it. Postings are read by
  everybody, but only those that are open and not past their closing date, and never
  the columns `PostedBy` or `Status = 'Draft'` rows.
- A procedure for a **company** takes `@CompanyId` first. Every statement on
  `jobs.Postings` names it, and every read of an application, a profile or a file goes
  through a posting of that company **and** an application that is not withdrawn. A
  posting or applicant of another company is "Not found".

Procedures, person side: `sp_Posting_Search` (text, city, employment type, work mode;
paged; newest first; says per row whether the person saved it or applied),
`sp_Posting_Get`, `sp_Application_Apply`, `sp_Application_Withdraw`,
`sp_Application_ListMine`, `sp_Saved_Set` (save or unsave), `sp_Saved_ListMine`.

Procedures, company side: `sp_Company_Posting_List` (with applicant counts),
`sp_Company_Posting_Get`, `sp_Company_Posting_Save`, `sp_Company_Posting_SetStatus`,
`sp_Company_Posting_Delete` (refused when it has applications),
`sp_Company_Applicant_List` (one posting), `sp_Company_Applicant_Get` (the page of
`sp_Profile_Get` for one applicant, after the check above; writes the view),
`sp_Company_Applicant_Resume` (content; writes the view),
`sp_Company_Applicant_SetStatus`.

## 4. API

**Person**, added to `JobsController` (`api/jobs`, a login is enough, the user is the
main-database user of the token):

| Endpoint | Does |
|---|---|
| `GET postings?q=&city=&type=&mode=&page=` | search open postings |
| `GET postings/{id}` | one open posting (also one the person applied to, when it has closed since) |
| `POST postings/{id}/apply` | apply, with an optional note |
| `POST postings/{id}/save`, `DELETE postings/{id}/save` | save, unsave |
| `GET applications` | the person's applications with posting title, company and status |
| `POST applications/{id}/withdraw` | withdraw |
| `GET saved` | saved postings |

**Company**, a new `CompanyJobsController` (`api/company-jobs`). The company is the
company of the token (the one chosen on the company page); the caller must be an
administrator of it. Both come from the token, never from the request; the rule is
one method (`HiringAccess`) so that P1 can change in one place.

| Endpoint | Does |
|---|---|
| `GET postings` | the company's postings with counts per application state |
| `GET postings/{id}`, `POST postings`, `DELETE postings/{id}` | read, add or change, remove |
| `POST postings/{id}/status` | publish, close, reopen |
| `GET postings/{id}/applicants` | applicants of one posting |
| `GET postings/{id}/applicants/{applicationId}` | the applicant's profile page |
| `GET postings/{id}/applicants/{applicationId}/resume` | the applicant's resume, as a download |
| `POST postings/{id}/applicants/{applicationId}/status` | Shortlisted, Rejected, Hired, or back to Applied |

Rules in C# (`JobPostingRules`, unit-tested): required title, city and description;
lengths; lists of employment type and work mode; experience and salary ranges (minimum
not above maximum); closing date not in the past when publishing; the allowed moves
between states of a posting and of an application.

## 5. UI

**Person.** The side menu of Job Portal gets its three pages; "Soon" disappears:

- `apps/jobs/search` - **Search jobs**: a search box, filters (city, type, mode), a
  list of cards (title, company, city, type, mode, experience, salary when given,
  "Applied" or "Saved" marks). A posting opens in a panel with its description,
  **Apply** and **Save**. Apply opens a dialog that names the company, says what the
  company will see (P3), takes an optional note, and is refused with a link to the
  profile when name or headline is missing.
- `apps/jobs/applications` - **My applications**: posting, company, date, status as a
  badge, **Withdraw**.
- `apps/jobs/saved` - **Saved jobs**.

**Company.** A page for administrators, outside the Service layout, in the same shell
as the personal applications:

- Opened from the company's application page by a card **Job postings** that only an
  administrator sees. Route `hiring`, needs a login and a chosen company.
- **Postings**: list with state and applicant counts; add and edit in a dialog;
  Publish, Close, Reopen, Delete.
- **Applicants** of one posting: name, headline, city, applied date, status; opening
  one shows the profile (the sections of the profile page, read-only) and the resume
  download; buttons for the status.

## 6. Error handling

- Personal DB missing or unreachable: "This application is not available right now",
  as in phase 1; the cause goes to the log only.
- A posting that closed between search and apply: "This job no longer takes
  applications".
- A second application to the same posting: "You have already applied".
- A posting or applicant of another company, or an applicant who withdrew: "Not found".
- A caller who is not an administrator of the chosen company: HTTP 403 with one sentence.

## 7. Testing

- Unit tests: `JobPostingRules` (every rule of section 4), `HiringAccess`.
- Script tests in the existing style: the guards of script 05; every person procedure
  takes `@UserId` and every company procedure `@CompanyId` first; every statement on
  the tables names the one or the other.
- Endpoint tests by reflection: routes, `[Authorize]`, no user id and no company id
  parameter anywhere.
- Against `EZ_PERSONAL` with test ids (negative user and company ids, removed at the
  end): a second company cannot read or change a posting or an applicant of the first;
  a withdrawn applicant is not readable; a draft is not searchable; a view is recorded.
- Angular specs for the three person pages and the two company pages.
- Manual: publish as an administrator, apply as a person without a company, move the
  status, withdraw.

## 8. Order of work

1. Script 05 and its checks against `EZ_PERSONAL`.
2. Rules, service and endpoints, person side; then company side.
3. Person pages (search, applications, saved) and the menu.
4. Company pages and the card on the application page.
