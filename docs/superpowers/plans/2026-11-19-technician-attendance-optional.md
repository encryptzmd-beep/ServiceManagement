# Optional Attendance per Technician Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-technician "attendance check-in required" flag (default Yes) that the API's check-in guards and the work orders screen respect.

**Architecture:** Column + two procedures in company-DB script 19; `TechnicianService.NeedsCheckIn` replaces `!IsCheckedIn` in three guards; three endpoints; a switch in the technician detail modal and a pure rule for the work orders buttons.

**Tech Stack:** SQL Server, ASP.NET Core (.NET 10), xUnit, Angular 21 (signals, vitest).

**Spec:** `docs/superpowers/specs/2026-11-19-technician-attendance-optional-design.md`

## Global Constraints

- Default required = 1; a missing column/row/NULL means required. The API must work unchanged before 19 is run.
- Do not modify `sp_Technician_Create/Update/GetAll` or the technician create/edit form.
- Check-in messages unchanged: "Please check in before working on a job", "… before requesting spare parts", "… before recording a payment".
- New SQL file only; owner runs it. Never `git commit`; `git add` only.
- Backend tests: `dotnet test EncryptzTests --artifacts-path EncryptzTests/bin/alt`.

## Review Focus

- API deployed before script 19 → every technician still needs check-in, no SQL error → Task 2 test `Needs_check_in_works_before_script_19` (dynamic SQL behind `COL_LENGTH`).
- Technician with no `dbo.Technicians` row (profile only) → required → Task 2 same test (`ISNULL(..., 1)`).
- Set called for an unknown user → "Technician not found", switch reverts → Task 1 test + Task 3 spec `puts the switch back when saving fails`.
- Not-required technician still can check in → Task 3 spec `check in stays available`.
- Back office in work orders → never blocked, as today → Task 3 spec `admin is never blocked`.

---

### Task 1: Script 19
**Files:** create `EncryptzAPI/Database/ProjectDB/19_Technician_Attendance_Optional.sql`; csproj line after 18; test `EncryptzTests/TechnicianAttendanceScriptTests.cs` (helpers as `ServiceWorkflowScriptTests`).
- [ ] Tests: guards + no USE; `COL_LENGTH('dbo.Technicians', 'AttendanceRequired') IS NULL` then `ADD AttendanceRequired BIT NOT NULL` with `DEFAULT (1)`; `CREATE OR ALTER PROCEDURE dbo.sp_Technician_AttendanceRequired_List` selecting `UserId, TechnicianId, AttendanceRequired`; `..._Set` with `@UserId INT, @Required BIT`, `'Technician not found'`, `UPDATE dbo.Technicians SET AttendanceRequired = @Required WHERE UserId = @UserId`; no `sp_Technician_Create`/`Update`/`GetAll` in the file; csproj ships 19; parses as follow-up. RED → write → `--filter "TechnicianAttendanceScriptTests|TenantScriptTests"` PASS → `git add`.

### Task 2: API
**Files:** `ITechnicianService.cs`, `TechnicianService.cs`, `TechnicianController.cs`, `SparePartController.cs`, `PaymentsController.cs`, DTO `TechnicianAttendanceRuleDto { int UserId; int TechnicianId; bool AttendanceRequired }` and `AttendanceRequiredSetDto { int UserId; bool Required }` in `EncryptzBL/DTO's/ServiceWorkflowDtos.cs`; test `EncryptzTests/TechnicianAttendanceEndpointTests.cs` (source tests).
**Produces:** `Task<bool> NeedsCheckIn(int technicianId)`, `Task<bool> IsAttendanceRequired(int technicianId)`, `Task<List<TechnicianAttendanceRuleDto>> GetAttendanceRules()`, `Task<ApiResponse<string>> SetAttendanceRequired(int userId, bool required)`; routes `GET attendance-required` + `PUT attendance-required` (`[Authorize(Roles = "Admin,Manager")]`), `GET my-attendance-rule` → `Ok(new { success = true, data = new { attendanceRequired } })` (true when `User.GetTechnicianId() <= 0`).
- [ ] Tests: `Needs_check_in_works_before_script_19` (`IsAttendanceRequired` body has `COL_LENGTH('dbo.Technicians', 'AttendanceRequired')`, `sp_executesql`, `ISNULL(`); `NeedsCheckIn` calls `IsAttendanceRequired` and `IsCheckedIn`; each of the three guards calls `NeedsCheckIn` and no longer `!await _technicians.IsCheckedIn` / `!await _service.IsCheckedIn`, messages kept; routes and roles as above. RED → implement → full suite PASS → `git add`.

### Task 3: UI
**Files:** `api-service.ts` (`getAttendanceRules()`, `setAttendanceRequired(userId, required)`, `getMyAttendanceRule()`), create `work-orders-component/attendance-rule.ts` + spec, `work-orders-component.{ts,html}`, `technician-list-component.{ts,html,scss}`.
**Produces:** `canWorkWithoutCheckIn(isAdmin: boolean, checkedIn: boolean, attendanceRequired: boolean): boolean` (= isAdmin || checkedIn || !attendanceRequired); component signal `attendanceRequired = signal(true)`; buttons `[disabled]="!canWork()"`; bar text "Attendance not required" when `!attendanceRequired() && !isCheckedIn()`.
- [ ] Specs (pure): `admin is never blocked`, `checked-in technician may work`, `technician without attendance may work`, `technician with attendance must check in`. Technician list: switch in detail modal bound to a `Map<userId, boolean>` from `getAttendanceRules()`; on change call set; on failure revert and show `dialog` error (spec optional: `puts the switch back when saving fails` as pure helper if extracted). `check in stays available`: Check In button condition unchanged (`!isCheckedIn()`). RED → implement → spec PASS, `npx ng build` ok → `git add`.

### Task 4: Verify
- [ ] Full backend + UI suites (only the known non-CRM failures); ask the owner to run 19.
