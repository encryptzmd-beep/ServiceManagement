# Job Portal, Phase 1: the Individual's Profile

Date: 2026-10-13
Branch: `feature/saas-tenant-db-routing`
Status: Design agreed in conversation; awaiting written-spec review.
Builds on: `2026-10-13-applications-catalogue-design.md` (personal applications, Personal DB).

## 1. Goal

Job Portal is the first personal application. A person keeps one profile there for
life: who they are, what they did, what they learned, what they can do, and the
documents that show it. The profile belongs to the person, not to any company.

Phase 1 is the profile only. Job advertisements, applications and the screens with
which a company searches profiles are later phases.

Success means: a logged-in user without any company opens Job Portal from the company
page, fills in profile, experience, education, skills, certificates and a resume,
switches "Employers can find me" on or off, and finds everything again at the next
login. Nobody else can read or change it.

## 2. Long-term direction (not built now)

The owner's blueprint (ENCRYPTZ.IN ecosystem) makes this the "Career App": one
Individual ID, one continuous profile, with institutions, employers and recruiters
adding records to it through explicit permissions. Phase 1 must not block that:

- the profile is keyed by the main database `UserId` (the person behind the Individual ID);
- it is private by default;
- a certificate has a verification status and a verifier from the first day, though
  only one status is used now;
- a company never reads the Personal DB: later features read it through the API.

## 3. Decisions

| # | Topic | Decision |
|---|---|---|
| J1 | Scope | Profile, experience, education, skills, certificates, resume, visibility. No jobs, no applications, no company-side screen, no "who viewed me", no photo. |
| J2 | Access | Any active, logged-in user. A login token without a company is enough. The user is always taken from the token. |
| J3 | Visibility | One switch, "Employers can find me". Default off. It cannot be switched on while name or headline is empty. Phase 1 only stores it: nothing can search profiles yet. |
| J4 | Files | Stored in the Personal DB (`VARBINARY(MAX)`), served only through the API. At most 5 MB each. Resume: PDF, DOC, DOCX. Certificate: PDF, JPG, PNG. The type is checked by extension and by the first bytes of the file. |
| J5 | Skills | Free text, with suggestions from the skills already in use. A level (Beginner, Intermediate, Expert) and an optional evidence link per skill. |
| J6 | Evidence links | `https://` only, at most 400 characters. Shown as a link that opens in a new tab with `rel="noopener noreferrer"`. |
| J7 | Certificates | Status is always `Uploaded` ("Uploaded by you"). The columns for a verified status, the verifier and the date exist and stay empty. |
| J8 | Age | No age check and no rules for minors in this phase. Date of birth is optional. To be revisited before an institution application exists. |
| J9 | Limits | Per user: 30 experience rows, 20 education rows, 50 skills, 30 certificates, 1 resume. |
| J10 | Release | The application is released by the platform administrator in Platform Admin, Applications: route `/apps/jobs`, Released. No script does it. |

## 4. Personal DB

One new script, `EncryptzAPI/Database/PersonalDB/02_Jobs_Profile.sql`. It refuses to
run in a database that is not marked as the Personal DB (`dbo.SchemaInfo`, key
`PERSONAL_DB`). Re-runnable. It creates the schema `jobs`.

Every table has `UserId INT NOT NULL` (the main database `UserId`; no foreign key,
it is another database). Every procedure takes `@UserId` and touches rows of that
user only: a row id that belongs to someone else is "not found".

| Table | Columns (besides `UserId`) |
|---|---|
| `jobs.Profiles` (one row per user, `UserId` is the key) | `FullName NVARCHAR(200)`, `Headline NVARCHAR(200)`, `Summary NVARCHAR(2000)`, `City NVARCHAR(100)`, `ContactEmail NVARCHAR(256)`, `ContactPhone NVARCHAR(30)`, `DateOfBirth DATE NULL`, `IsVisible BIT` default 0, `CreatedAt`, `UpdatedAt` |
| `jobs.Experience` | `ExperienceId` identity, `Organisation NVARCHAR(200)`, `Title NVARCHAR(200)`, `StartMonth DATE`, `EndMonth DATE NULL` (NULL = current), `Description NVARCHAR(2000)` |
| `jobs.Education` | `EducationId` identity, `Institution NVARCHAR(200)`, `Course NVARCHAR(200)`, `FieldOfStudy NVARCHAR(200)`, `StartYear SMALLINT NULL`, `EndYear SMALLINT NULL` |
| `jobs.Skills` | `SkillId` identity, `SkillName NVARCHAR(100)`, `Level NVARCHAR(20)` (`Beginner`, `Intermediate`, `Expert`), `EvidenceUrl NVARCHAR(400) NULL`; unique per user and name |
| `jobs.Files` | `FileId` identity, `Kind NVARCHAR(20)` (`Resume`, `Certificate`), `FileName NVARCHAR(260)`, `ContentType NVARCHAR(100)`, `SizeBytes INT`, `Content VARBINARY(MAX)`, `UploadedAt` |
| `jobs.Certificates` | `CertificateId` identity, `Title NVARCHAR(200)`, `Issuer NVARCHAR(200)`, `IssuedOn DATE NULL`, `FileId INT NULL` -> `jobs.Files`, `Status NVARCHAR(30)` default `Uploaded`, `VerifiedBy NVARCHAR(200) NULL`, `VerifiedAt DATETIME NULL` |

Procedures (all in schema `jobs`): `sp_Profile_Get` (the profile row and the lists,
never file content), `sp_Profile_Save`, `sp_Profile_SetVisible`,
`sp_Experience_Save` / `_Delete`, `sp_Education_Save` / `_Delete`,
`sp_Skill_Save` / `_Delete`, `sp_Skill_Suggest` (names in use that start with a
text, at most 10, no user data), `sp_Certificate_Save` / `_Delete` (deleting a
certificate deletes its file), `sp_Resume_Save` (replaces the user's resume),
`sp_Resume_Delete`, `sp_File_Get` (content of one file of the user).

A save returns `Success`, `Message` and the row id, like the procedures of the main
database. The limits of J9 are checked in the procedures.

## 5. API

A new `JobsService` on `PersonalDbHelper` and a new `JobsController`, route
`api/jobs`, `[Authorize]`. The user id comes from the token claim, never from the
request. When the Personal DB is not configured every endpoint answers
"This application is not available right now".

| Endpoint | Does |
|---|---|
| `GET profile` | everything the page shows: profile, experience, education, skills, certificates (with file name and size), resume (name and size), completeness |
| `POST profile` | save the profile fields |
| `POST profile/visible` | switch visibility; refuses "on" while name or headline is empty |
| `POST experience`, `DELETE experience/{id}` | add or change, remove |
| `POST education`, `DELETE education/{id}` | add or change, remove |
| `POST skills`, `DELETE skills/{id}` | add or change, remove |
| `GET skills/suggest?q=` | suggestions |
| `POST certificates` (multipart: fields + optional file), `DELETE certificates/{id}` | add or change, remove |
| `POST resume` (multipart), `DELETE resume` | replace, remove |
| `GET files/{id}` | download one file of the caller, as an attachment |

Rules checked in C# before the database (`JobsRules`, unit-tested): required fields
and lengths, month and year ranges (start not after end, not in the future, years
1950 to the current year + 10), level in the list, evidence link `https://`, file
size, extension and first bytes, file name without path parts.

Completeness is a number from 0 to 100 computed in C#: name 10, headline 15,
summary 15, city 5, contact 5, at least one experience 15, one education 10, three
skills 10, resume 15.

Downloads answer with `Content-Disposition: attachment`, the stored content type
from a fixed list, and `X-Content-Type-Options: nosniff`.

## 6. UI

- Route `/apps/jobs`, top level like `/select-company`: `authGuard` only, no company,
  no sidebar.
- A small shell for personal applications (`personal-shell`): the application name,
  the user's name and Individual ID, "Back to companies". Reused by later personal
  applications.
- One page, `job-profile`, light theme like Platform Admin, with the sections
  Profile, Experience, Education, Skills, Certificates, Resume. Each section lists
  its rows and adds or edits one row in a dialog, the way Platform Admin does.
- At the top: the visibility switch with one sentence that says what it means, and
  the completeness bar.
- A certificate row shows the status as a grey pill "Uploaded by you".
- Errors of a save are shown in the dialog; the dialog stays open.
- When the application is not available the page says so and offers "Back to
  companies".

## 7. Error handling

- Personal DB missing or unreachable: one message for the user, the cause in the API
  log. The company page is not affected.
- A row id of another user: "not found", never "not allowed" (it does not confirm
  that the row exists).
- A file that is too large, of another type, or whose content does not fit its
  extension: refused with a sentence that names the limit or the allowed types.
- A lost answer after an upload: the page reads the profile again.

## 8. Testing

- Unit tests (xUnit): `JobsRules` (every rule of section 5), completeness, file type
  detection.
- Script tests in the existing style: script 02 has no `USE` / database statements,
  refuses a database without the marker, every procedure takes `@UserId` and every
  statement that reads or writes a `jobs` table filters by it.
- Endpoint tests by reflection: routes, `[Authorize]`, no user id parameter anywhere.
- Angular specs: the page renders each section, a refused save keeps the dialog open,
  the visibility switch asks the API and shows the refusal, the "not available" state.
- Manual: run script 02 in `EZ_PERSONAL`, release the application in Platform Admin,
  fill a profile as one user, log in as another and confirm nothing of the first is
  reachable (including `GET files/{id}` with the first user's file id).

## 9. Out of scope

Job search and applications, company search of profiles and the audit of profile
views, profile photo, certificate verification, guardian consent and rules for
minors, portfolio galleries, import from other sites, notifications.
