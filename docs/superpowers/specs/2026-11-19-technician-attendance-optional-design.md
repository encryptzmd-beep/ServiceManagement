# Optional attendance per technician — design

Date: 2026-11-19 · Client driver: Hamster AC proposal, section 6.3

## Intent

Hamster wants "Attendance Tracking Required: Yes/No" per technician. Felix is live and
every Felix technician must keep checking in as today. Same rule as the photo setting:
a new setting whose default is Felix's current behaviour (required = Yes).

## Today

A technician-scoped caller must be checked in today (`TechnicianService.IsCheckedIn`:
open `dbo.TechnicianAttendance` row) to start/complete a job
(`TechnicianController.GuardAssignment(requireCheckIn: true)`), to request spares
(`SparePartController.GuardTechnicianRequest`) and to record a payment
(`PaymentsController`). Work orders disables Start/Complete buttons when
`!isAdmin() && !isCheckedIn()`.

## Approaches

1. **Column `dbo.Technicians.AttendanceRequired BIT NOT NULL DEFAULT 1` + its own small
   procedures (chosen).** Per technician as the proposal says; existing create/update/list
   procedures and the technician form stay untouched.
2. One company setting for all technicians: not what the proposal asks.
3. Extend `sp_Technician_Create/Update/GetAll`: touches procedures Felix uses daily.

## Design

1. **SQL** `EncryptzAPI/Database/ProjectDB/19_Technician_Attendance_Optional.sql` (after 18,
   re-runnable, guards as 18): add the column if missing (default 1, so existing rows = 1);
   `dbo.sp_Technician_AttendanceRequired_List` → `UserId, TechnicianId, AttendanceRequired`
   of all technicians; `dbo.sp_Technician_AttendanceRequired_Set @UserId INT, @Required BIT`
   → `Success, Message` ("Technician not found" when no row).
2. **API**
   - `TechnicianService.NeedsCheckIn(int technicianId)` = attendance required (missing row,
     NULL or column not there yet → required) AND not checked in. The query must work before
     19 is run (column referenced only through dynamic SQL behind a `COL_LENGTH` check), so a
     deploy before the script changes nothing.
   - The three guards call `NeedsCheckIn` instead of `!IsCheckedIn`; messages unchanged.
   - `GET api/technician/attendance-required` (Admin, Manager) → list;
     `PUT api/technician/attendance-required` `{ userId, required }` (Admin, Manager);
     `GET api/technician/my-attendance-rule` → `{ attendanceRequired }` for the caller's own
     technician id (true when the caller has none).
3. **UI**
   - Technician detail modal: "Attendance check-in required" switch, loaded from the list
     call, saved on change; a refusal shows the message and puts the switch back.
   - Work orders (technician): loads `my-attendance-rule`; when not required, the
     Start/Complete buttons do not wait for check-in, and the check-in bar shows
     "Attendance not required" (Check In stays available).
4. Attendance report, GPS tracking, check-in itself: unchanged.

## Constraints

- Felix: with the default (1) nothing changes. SQL as a new numbered file, run by the owner.
- Never `git commit`; stage only.

## Left to the builder

- Wording, styling of the switch; tests (script text, `NeedsCheckIn` source + guards,
  vitest for the pure UI rule).
