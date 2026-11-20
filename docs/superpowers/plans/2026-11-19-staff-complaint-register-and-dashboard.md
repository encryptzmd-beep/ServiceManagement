# Staff Complaint Register and Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A back-office Register Complaint page and an attention-first complaints dashboard with quick access to it.

**Architecture:** New `StaffComplaintController` over existing `ICustomerService` methods; new standalone Angular page; dashboard template reorganised around a pure `attentionItems()` helper.

**Tech Stack:** ASP.NET Core (.NET 10), xUnit, Angular 21 (signals, vitest).

**Spec:** `docs/superpowers/specs/2026-11-19-staff-complaint-register-and-dashboard-design.md`

## Global Constraints
- Roles: `Admin, CompanyAdmin, ServiceManager, Manager` (API attribute and route guard).
- No SQL, no change to existing endpoints/procedures/public page. Stage only.
- Messages: "Enter a valid 10-digit mobile number", "Enter the subject", "Enter the customer name".

## Review Focus
- Mobile "+91 98470 12345" → "9847012345" accepted; 9 digits refused → Task 1 `Mobile_is_normalised`.
- New customer without a name → refused before the call → Task 1 `New_customer_needs_a_name` (API) and Task 2 spec.
- Double click on Register → one request → Task 2 spec `registers once`.
- All attention numbers zero → "All clear" → Task 3 spec.
- Clicking an attention item opens the same detail view as the tile → Task 3 spec (calls `onCardClick` with the tile card).

---

### Task 1: API
**Files:** create `EncryptzBL/Common/Service/StaffComplaintRules.cs` (`static string? NormaliseMobile(string?)` → 10 digits or null; `static string? Problem(PublicQuickComplaintRequest_Dto dto, bool customerFound)`), `EncryptzAPI/Controllers/StaffComplaintController.cs`; tests `EncryptzTests/StaffComplaintTests.cs`.
- [ ] Tests: `Mobile_is_normalised` ("+91 98470 12345", "09847012345", "9847012345" → "9847012345"; "98470", null, "abcdefghij" → null); `Problem_words` (bad mobile → mobile message; blank subject → subject message; not found + blank name → name message; ok → null); controller route `api/staff-complaints`, roles attribute exact, `AppModule("SERVICE")`, actions `GET customer` and `POST`, POST calls `CheckByMobile` and `CreatePublicQuickComplaint`. RED → implement → full suite PASS → stage.

### Task 2: Register page
**Files:** create `encryptzUI/src/app/Encryptz/components/staff-complaint-register-component/*` (ts/html/scss/spec); `api-service.ts` (`staffCustomerLookup(mobile)`, `staffRegisterComplaint(dto)`); route `complaints/register` in `app.routes.ts` next to `complaints/dashboard` with the role guard.
- [ ] Specs: `looks up the customer at 10 digits`, `asks the name of a new customer`, `name and subject are required`, `registers once` (double submit → one call), `shows the complaint number and registers another`, `shows the server message on refusal`. RED → implement → PASS, build → stage.

### Task 3: Dashboard
**Files:** create `complaint-dashboard-component/attention.ts` + spec (`attentionItems(cards: StatCard[]): AttentionItem[]` — keys sla, new, hold, spare, schedules; value > 0 only; that order; tone red/orange/orange/amber/blue); modify dashboard ts/html/scss.
- [ ] Specs (pure): `keeps only items that need attention`, `orders by urgency`, `empty when all clear`. Template: header button `routerLink="/complaints/register"`; band uses `onCardClick(item.card)`; KPI grid shows the other cards. RED → implement → PASS, build, full UI suite (only known failures) → stage.
