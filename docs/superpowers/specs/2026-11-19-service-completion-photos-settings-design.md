# Service Workflow settings: completion photos — design

Date: 2026-11-19 · Client driver: Hamster AC proposal, section 6.6 (service images)

## Intent

Hamster AC wants a technician to upload a set number of photos, in its own photo
categories, before a job can be completed. Felix runs the same Service application
live and must keep working exactly as today. Rule agreed with the owner: **every
Hamster-driven change to an existing module becomes a per-company setting whose
default is Felix's current behaviour.** This is the first one, and it also opens the
"Service Workflow" tab of Settings where the later ones (En Route, technician
suggestions, customer confirmation …) will go, each with its own design.

## Today

- Server rule ([TechnicianController.cs](../../../EncryptzAPI/Controllers/TechnicianController.cs)
  `UpdateStatus`): when a **technician** completes, the complaint needs at least one
  row in `dbo.ServiceImages` (`HasServiceImage`), unless `appsettings`
  `WorkOrders:RequireCompletionPhoto` is `false` (one switch for all companies).
  Back-office users complete without photos.
- The complete dialog ([work-orders-component.ts](../../../encryptzUI/src/app/Encryptz/components/work-orders-component/work-orders-component.ts))
  does not check photos; it uploads the queue, then calls `update-status`, and shows
  the server's refusal. Photo types are hard-coded: `Before, After, Part, Signature, Other`.
- Settings page shows `dbo.SystemSettings` rows as one tab per `SettingGroup`,
  control by `DataType` (`int`, `bool`, `string`, `textarea`, `select:…`, `image`).
  The Settings API is Admin-only. Each company has its own database, so a row is
  per company.

## Goals / non-goals / anti-goals

- Goal: a company sets the number of photos needed to complete a job and the list of
  photo categories; Hamster sets 4 and its six categories.
- Non-goal: per-category mandatory photos (which 4 of the 6); counting per technician
  or per visit; any other Hamster feature.
- Anti-goal: any change Felix notices. With defaults, behaviour is identical to today.

## Approaches

1. **Rows in the existing `dbo.SystemSettings` (chosen).** Settings page, API, bulk save
   and per-company scope already exist; a new group gives the new tab for free.
2. A new settings table / page: rebuilds what exists, for nothing.
3. `appsettings.json` per company: not per company (one API serves all), and needs a deploy.

## Design

1. **SQL** `EncryptzAPI/Database/ProjectDB/18_Service_Workflow_Settings.sql` (company DB,
   follow-up after 17, re-runnable, MERGE that only inserts missing keys, the same
   guards as 17 minus the CRM ones):
   - `Service.MinCompletionPhotos` = `1`, group `ServiceWorkflow`, `int`,
     "Photos a technician must upload before completing a job (0 = none)".
   - `Service.PhotoCategories` = `Before,After,Part,Signature,Other`, group
     `ServiceWorkflow`, `string`, "Photo types offered when uploading, separated by commas".
2. **API**
   - Reading the rules (one place, e.g. `TechnicianService.GetCompletionRules()`):
     min = `TRY_CAST` of the row; missing or not a whole number ≥ 0 → **1**; categories =
     the comma list trimmed, empty items dropped; empty → the five defaults.
   - `GET api/technician/completion-rules` → `{ minPhotos, photoCategories[] }`, for any
     Service user (technicians cannot read the Admin-only Settings API).
   - `UpdateStatus` Completed, technician caller, `RequireCompletionPhoto` not false:
     count the complaint's `ServiceImages` (same join as `HasServiceImage`); if
     count < min → 400 "Upload at least N service photos before completing the work order"
     (N = 1 keeps today's text: "Upload at least one service photo …"). min 0 → no check.
     `appsettings` `false` still turns the check off for everyone. Back office: unchanged.
3. **Settings page**: no code change expected; the `ServiceWorkflow` tab appears from
   the rows. Shown tab label "Service Workflow" if the page has a label map, else the
   group name as is (builder's call).
4. **Complete dialog** (technician): loads the rules once; photo-type dropdowns use the
   categories; when min > 0 and (photos already on the complaint + queue) < min, the
   Complete button is disabled with "Add K more photo(s)". If the rules cannot be
   loaded, the dialog behaves as today (the server still decides).

Hamster after running 18: Settings › Service Workflow → photos `4`, categories
`Front View,Back View,Left Side,Right Side,Serial Number,Fault Area`.

## Constraints

- Felix live: with defaults nothing changes; only additive SQL and code.
- SQL as a new numbered file; the owner runs it; never edit 14–17.
- Never `git commit`; stage only.

## Left to the builder

- Where the count of existing photos comes from in the dialog (detail data or a count
  in the rules call for the assignment).
- Wording of hints; tests (`EncryptzTests` for the rules reading, script, endpoint,
  message; vitest for the dialog).
