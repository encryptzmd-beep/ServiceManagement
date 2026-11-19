# Service Workflow Settings: Completion Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-company settings for the number of photos needed to complete a job (default 1) and the photo categories, enforced by the API and shown in the technician's complete dialog.

**Architecture:** Two new `dbo.SystemSettings` rows (group `ServiceWorkflow`) from company-DB script 18. A pure `ServiceWorkflowRules` class parses them and words the refusal; `TechnicianService` reads them and counts photos; `TechnicianController` exposes `GET api/technician/completion-rules` and uses the count in `update-status`. The Angular work-orders complete dialog loads the rules.

**Tech Stack:** SQL Server, ASP.NET Core (.NET 10) + ADO.NET `BaseRepository`, xUnit (`EncryptzTests`), Angular 21 (standalone, signals, vitest).

**Spec:** `docs/superpowers/specs/2026-11-19-service-completion-photos-settings-design.md`

## Global Constraints

- Felix is live: with the default values (`1`, `Before,After,Part,Signature,Other`) behaviour must be identical to today, including the message "Upload at least one service photo before completing the work order".
- Back-office (not technician-scoped) completion: never checked, as today. `appsettings` `WorkOrders:RequireCompletionPhoto = false` still switches the check off.
- SQL: new file `EncryptzAPI/Database/ProjectDB/18_Service_Workflow_Settings.sql`; 14–17 are frozen. Do not run SQL; the owner runs it.
- Do not touch Settings page code unless the tab needs a label (spec §3); no other Service screen changes.
- Never `git commit` (also subagents); `git add` only.
- Run backend tests with `dotnet test EncryptzTests --artifacts-path EncryptzTests/bin/alt` (Visual Studio locks `EncryptzAPI/bin`).

## Review Focus

- Setting edited to text, a negative number or blank → treated as 1 (not 0, not a crash) → Task 2 test `Bad_min_falls_back_to_one`.
- Categories edited to `" , ,Front View ,"` → `["Front View"]`; all blank → the five defaults → Task 2 tests `Categories_are_trimmed` / `Blank_categories_fall_back`.
- Script 18 run on Hamster after the admin already changed a value → value kept (insert-only MERGE) → Task 1 test `Merge_only_inserts`.
- Rules call fails in the dialog → Complete stays enabled, server decides → Task 4 spec `completes as today when the rules cannot be loaded`.
- Photos already uploaded on an earlier visit count toward the minimum (same join as today's `HasServiceImage`) → Task 3 test `Count_uses_the_complaint_of_the_assignment`.

---

### Task 1: Script 18

**Files:**
- Create: `EncryptzAPI/Database/ProjectDB/18_Service_Workflow_Settings.sql`
- Modify: `EncryptzAPI/EncryptzAPI.csproj` (Content line after the 17 line, same attributes)
- Test: `EncryptzTests/ServiceWorkflowScriptTests.cs` (copy `Root()/Read()` helpers of `CrmProductScriptTests`)

**Interfaces:** Produces rows `Service.MinCompletionPhotos` (`1`, `ServiceWorkflow`, `int`, IsEditable 1) and `Service.PhotoCategories` (`Before,After,Part,Signature,Other`, `ServiceWorkflow`, `string`, IsEditable 1), descriptions from the spec.

- [ ] **Step 1: Failing tests:** `Script_has_header_guards_and_no_use` (contains the company-DB guard block of 17 — `dbo.Locations is missing` — and `SET NOEXEC ON`, no line starting `USE `; no `crm.` guard); `Seeds_both_settings_with_felix_defaults` (contains `'Service.MinCompletionPhotos', N'1', 'ServiceWorkflow', 'int'` and `'Service.PhotoCategories', N'Before,After,Part,Signature,Other', 'ServiceWorkflow', 'string'`); `Merge_only_inserts` (contains `WHEN NOT MATCHED THEN` and not `WHEN MATCHED`, no `UPDATE dbo.SystemSettings`); `Csproj_ships_18` (contains `Database\ProjectDB\18_Service_Workflow_Settings.sql`); `Script_parses_as_follow_up` (`TenantScript.ParseFollowUp("18_Service_Workflow_Settings.sql", text).Batches` not empty).
- [ ] **Step 2:** `dotnet test EncryptzTests --artifacts-path EncryptzTests/bin/alt --filter ServiceWorkflowScriptTests` → FAIL (file missing).
- [ ] **Step 3:** Write the script: header comment in the style of 17 (what it adds, run after 17 in each company DB, re-runnable, changes no existing row), the guards, the MERGE in the style of `09_Sales_Order_Despatch.sql` §3b, `PRINT 'Service workflow settings applied.'`. Add the csproj line.
- [ ] **Step 4:** Same command with `--filter "ServiceWorkflowScriptTests|TenantScriptTests"` → PASS.
- [ ] **Step 5:** `git add` the three files.

### Task 2: Rules

**Files:**
- Create: `EncryptzBL/Common/Service/ServiceWorkflowRules.cs` (namespace `EncryptzBL.Common.Service`, `public static class`)
- Create: `EncryptzBL/DTO's/ServiceWorkflowDtos.cs` — `public class CompletionRulesDto { public int MinPhotos { get; set; } public List<string> PhotoCategories { get; set; } = new(); public int PhotosUploaded { get; set; } }`
- Test: `EncryptzTests/ServiceWorkflowRulesTests.cs`

**Interfaces (produces):** `const string MinPhotosKey = "Service.MinCompletionPhotos"`, `const string CategoriesKey = "Service.PhotoCategories"`, `static readonly IReadOnlyList<string> DefaultCategories` (the five), `int ParseMinPhotos(string? value)`, `List<string> ParseCategories(string? value)`, `string? PhotoProblem(int uploaded, int min)`.

- [ ] **Step 1: Failing tests:**
  - `Min_parses_whole_numbers`: `"4"`→4, `" 0 "`→0, `"6"`→6.
  - `Bad_min_falls_back_to_one`: `null`, `""`, `"abc"`, `"-2"`, `"2.5"` → 1.
  - `Categories_are_trimmed`: `" , ,Front View ,"` → `["Front View"]`; `"A,B"` → `["A","B"]`.
  - `Blank_categories_fall_back`: `null`, `" , "` → `["Before","After","Part","Signature","Other"]`.
  - `Photo_problem_words`: `(0,1)` → `"Upload at least one service photo before completing the work order"`; `(2,4)` → `"Upload at least 4 service photos before completing the work order"`; `(4,4)`, `(0,0)`, `(5,4)` → `null`.
- [ ] **Step 2:** run `--filter ServiceWorkflowRulesTests` → FAIL.
- [ ] **Step 3:** Implement (`int.TryParse` with `NumberStyles.None` after trim; negative impossible then).
- [ ] **Step 4:** PASS. **Step 5:** `git add`.

### Task 3: API

**Files:**
- Modify: `EncryptzBL/Infrastructure/Technician/modules/ITechnicianService.cs`, `TechnicianService.cs` (next to `HasServiceImage`), `EncryptzAPI/Controllers/TechnicianController.cs`
- Test: `EncryptzTests/ServiceWorkflowEndpointTests.cs` (source-text tests in the style of `CrmEndpointsTests`: read the .cs files)

**Interfaces:**
- Consumes: Task 2.
- Produces: `Task<int> CountServiceImages(int assignmentId)`; `Task<CompletionRulesDto> GetCompletionRules(int? assignmentId)` (reads both keys with one query on `dbo.SystemSettings`, parses with `ServiceWorkflowRules`, `PhotosUploaded` = `CountServiceImages` when an id is given, else 0); endpoint `GET api/technician/completion-rules?assignmentId=` → `Ok(new { success = true, data = rules })` (for a technician caller with an id, run `GuardAssignment(id)` first). JSON: `minPhotos`, `photoCategories`, `photosUploaded`.

- [ ] **Step 1: Failing tests:** `Count_uses_the_complaint_of_the_assignment` (service source: `CountServiceImages` query has `COUNT(` and the join `a.ComplaintId = si.ComplaintId` and `a.AssignmentId = @AssignmentId`); `Rules_read_both_keys` (service source contains `ServiceWorkflowRules.MinPhotosKey` and `CategoriesKey` or the literal keys, and `ParseMinPhotos`, `ParseCategories`); `Completion_rules_route` (controller has `[HttpGet("completion-rules")]`, no `[Authorize(Roles` on it); `Update_status_uses_the_count` (controller `UpdateStatus` calls `CountServiceImages`, `PhotoProblem`, and still `RequireCompletionPhoto && User.IsTechnicianScoped()`; no longer calls `HasServiceImage`).
- [ ] **Step 2:** FAIL. 
- [ ] **Step 3:** Implement. In `UpdateStatus`: when the old condition held, `var rules = await _service.GetCompletionRules(null); var problem = ServiceWorkflowRules.PhotoProblem(await _service.CountServiceImages(dto.AssignmentId), rules.MinPhotos);` → `BadRequest(new { success = false, message = problem })` when not null. Keep `HasServiceImage` (unused is fine; do not delete shared code).
- [ ] **Step 4:** `dotnet test EncryptzTests --artifacts-path EncryptzTests/bin/alt` (all) → PASS; `dotnet build EncryptzAPI --artifacts-path EncryptzTests/bin/alt` clean.
- [ ] **Step 5:** `git add`.

### Task 4: Complete dialog

**Files:**
- Modify: `encryptzUI/src/app/Encryptz/Services/API/api-service.ts` (`getCompletionRules(assignmentId: number): Observable<any>` → `GET {apiUrl}/technician/completion-rules?assignmentId=`), `encryptzUI/src/app/Encryptz/components/work-orders-component/work-orders-component.{ts,html}`
- Test: create `encryptzUI/src/app/Encryptz/components/work-orders-component/work-orders-complete.spec.ts` (TestBed with `ApiService` stubbed; only the complete-dialog members)

**Interfaces:** consumes Task 3 JSON. In the component: `completionRules = signal<{ minPhotos: number; photoCategories: string[]; photosUploaded: number } | null>(null)`; `photosStillNeeded = computed(...)` = `max(0, minPhotos − photosUploaded − queued items not in 'error')`, 0 when rules null; `imageTypes` becomes the rules' categories when loaded (default the current five). `openCompleteDialog` calls `getCompletionRules(wo.assignmentId)`; error → rules stay null.

- [ ] **Step 1: Failing specs:** `offers the photo categories from the settings` (rules `['Front View','Fault Area']` → `imageTypes` equals them); `disables Complete until enough photos are added` (min 4, uploaded 1, queue 2 → `photosStillNeeded()` 1, Complete button disabled, text `Add 1 more photo`); `enables Complete when the photos are enough` (min 4, uploaded 1, queue 3 → 0, enabled); `completes as today when the rules cannot be loaded` (rules call errors → `photosStillNeeded()` 0, `imageTypes` the five defaults); `min 0 never blocks`.
- [ ] **Step 2:** `npx ng test --watch=false --include src/app/Encryptz/components/work-orders-component/work-orders-complete.spec.ts` → FAIL.
- [ ] **Step 3:** Implement; Complete button `[disabled]="completeBusy() || photosStillNeeded() > 0"`, hint `Add {{ n }} more photo{{ n === 1 ? '' : 's' }}` next to it.
- [ ] **Step 4:** spec PASS; `npx ng build` ok. **Step 5:** `git add`.

### Task 5: Verify

- [ ] All backend tests and all UI specs that passed before still pass (UI: the 39 known non-CRM failures in company-selector and "should create" specs are pre-existing; no new failure).
- [ ] Ask the owner to run 18 on the Hamster company database (and on Felix when they choose; defaults change nothing).
- [ ] Report: Settings › ServiceWorkflow shows both rows; on Hamster set `4` and `Front View,Back View,Left Side,Right Side,Serial Number,Fault Area`.
