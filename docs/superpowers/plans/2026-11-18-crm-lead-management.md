# CRM Lead Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new commercial application "CRM" (leads, follow-ups, quotations, convert to the existing Sales Order) enabled only for Hamster AC, with nothing in the Service application changed.

**Architecture:** Company database gets a `crm` schema (ProjectDB/14). A new `CrmController` (`api/crm`, `[AppModule("CRM")]`) calls a new `CrmService` on the tenant `DbHelper`, exactly like `SalesController`/`SalesService`. Convert calls the existing `ISalesService.SearchCustomers / SaveCustomer / SaveOrder` in-process. Angular pages live under `/crm/...` with their own top navigation (like `/consultancy`), entered through the normal company → module → branch → set-scope flow.

**Tech Stack:** SQL Server procs, ASP.NET Core (.NET 10), xUnit (`EncryptzTests`), Angular standalone components with signals.

**Spec:** `docs/superpowers/specs/2026-11-18-crm-lead-management-design.md`

## Global Constraints

- No change to any existing table, procedure, screen or menu of the Service application. Existing files touched are wiring only and are listed below; anything beyond them needs the owner's OK first.
- SQL: new numbered files only (`ProjectDB/14_CRM.sql`, `MainDB/32_CRM_Release.sql`); never edit an existing `.sql` file.
- `14_CRM.sql`: additive, safe to re-run, same database guard block as `11_Consultancy.sql`, no `USE`, every table has `CompanyId INT NOT NULL`, every proc takes `@CompanyId` first and every statement on a `crm.` table names `@CompanyId`.
- User ids in CRM are tenant user ids (`User.GetTenantUserId()`), names from `dbo.Users.FullName`, as `SalesController` does.
- Manager = `ModuleAccess.IsCompanyAdminRole(role)` OR `crm.Members.IsManager = 1`.
- Notifications in-app only (`INotificationService`); no SMS, no WhatsApp.
- Never `git commit`; each task ends by staging (`git add`) its files.
- Run SQL scripts only on a database the owner names.

**Existing files touched (wiring only):**
- `EncryptzAPI/EncryptzAPI.csproj` — one `<Content Include="Database\ProjectDB\14_CRM.sql" …/>` line (so new company DBs run it as a follow-up script, like 11–13).
- `EncryptzAPI/SrvInjection/ServiceRegistration.cs` — one `AddScoped<ICrmService, CrmService>()` line.
- `encryptzUI/src/app/app.routes.ts` — the `/crm/...` routes appended.
- `encryptzUI/src/app/Encryptz/components/company-selector-component/company-selector-component.ts` — after `setScope` succeeds for module `CRM`, go to `/crm/dashboard` instead of `landingRouteForRole(...)`. Other modules unchanged.

## Review Focus

1. **A CRM user who has no Service access**: `SetScope` → `SyncCompanyUserAsync` mirrors Service users only, so it may answer "Your user is not set up for this company". Expected: phase 1 requires CRM users to also be granted Service (documented in the release note in Task 9); a test in Task 9 pins the refusal text so it is not mistaken for a CRM bug.
2. **Same mobile, several customers** in `dbo.Customers`: convert must not pick one silently. Expected: the convert preview returns all exact matches and Confirm requires a chosen `CustomerId` when more than one (Task 6 test `Several_matches_need_a_choice`).
3. **Double convert** (two clicks, two tabs): expected exactly one Sales Order. `crm.sp_Lead_BeginConvert` sets a `ConvertingAt` marker atomically; the second call is refused (Task 6 test `Second_convert_is_refused`).
4. **A sales user opening another user's lead by id** (`/crm/leads/57`): expected "Lead not found", not the data (Task 3 proc filter + test `Sales_user_sees_only_own`).
5. **Quotation totals vs order totals**: CRM must compute exactly as `sp_SalesOrder_Save` (`Taxable = Qty*Rate − Discount`; `Gst = ROUND(Taxable*GstPercent/100, 2)`; intra-state `CGST = ROUND(GstTotal/2, 2)`, `SGST = GstTotal − CGST`; inter-state all IGST). Task 2 test `Totals_match_sales_order_rounding` with an odd-paisa case.

---

### Task 1: Company database script `14_CRM.sql`

**Files:**
- Create: `EncryptzAPI/Database/ProjectDB/14_CRM.sql`
- Modify: `EncryptzAPI/EncryptzAPI.csproj` (one Content line, next to 13)
- Test: `EncryptzTests/CrmScriptTests.cs`

**Interfaces:**
- Produces: tables `crm.Members, crm.LeadSources, crm.LostReasons, crm.Leads, crm.LeadStatusHistory, crm.FollowUps, crm.Quotations, crm.QuotationItems` with the columns of spec §5, plus on `crm.Leads`: `ConvertingAt DATETIME2 NULL`. Seeds of spec §5 inserted per company lazily by `crm.sp_Masters_Ensure @CompanyId` (insert when the company has none).
- Produces procs (all `@CompanyId` first; list procs also take `@UserId INT, @IsManager BIT`):
  `crm.sp_Masters_Ensure`, `crm.sp_Source_List/Save`, `crm.sp_LostReason_List/Save`, `crm.sp_Member_List/Save`, `crm.sp_IsManager`,
  `crm.sp_Lead_NextNumber`, `crm.sp_Lead_Save`, `crm.sp_Lead_List` (filters: search, status, sourceId, ownerUserId, from, to, page, pageSize; returns `TotalCount`), `crm.sp_Lead_Get`, `crm.sp_Lead_SetStatus`, `crm.sp_Lead_Reassign`, `crm.sp_Lead_History`,
  `crm.sp_FollowUp_Add`, `crm.sp_FollowUp_List`,
  `crm.sp_Quotation_Save` (header + items as JSON `@ItemsJson`), `crm.sp_Quotation_Get`, `crm.sp_Quotation_ListForLead`, `crm.sp_Quotation_Revise`, `crm.sp_Quotation_SetStatus`,
  `crm.sp_Lead_BeginConvert`, `crm.sp_Lead_FinishConvert`, `crm.sp_Lead_CancelConvert`, `crm.sp_Lead_LinkOrder`,
  `crm.sp_Product_Search` (read-only on `dbo.ProductMaster`: ProductMasterId, ProductCode, ProductName, Brand, Model, Category, MRP, WarrantyMonths; active only),
  `crm.sp_Dashboard`, `crm.sp_Report_FollowUps`, `crm.sp_Report_Conversion`.
- Writes answer rows `Success BIT, Message NVARCHAR, Id INT` like the consult procs.

- [ ] **Step 1: Write the failing tests** in `CrmScriptTests` (copy the `Read/Root/Procs` helpers of `ConsultancyTests`):
  - `Script_creates_every_table` — `Assert.Contains("CREATE TABLE crm.{t}", script)` for the 8 tables.
  - `Script_guards_the_database` — contains `is the SaaS main database` and `is the Personal DB. Select a company database`; no `^\s*USE\s`.
  - `Every_proc_takes_company_first_and_names_it` — for each `CREATE OR ALTER PROCEDURE crm.X`, first parameter `@CompanyId`; every statement touching `crm.(Leads|FollowUps|Quotations|QuotationItems|Members|LeadSources|LostReasons|LeadStatusHistory)` contains `@CompanyId`.
  - `Script_changes_nothing_of_dbo` — no `ALTER TABLE dbo.`, no `CREATE OR ALTER PROCEDURE dbo.`, no `INSERT INTO dbo.` / `UPDATE dbo.` / `DELETE FROM dbo.`.
  - `Lead_list_filters_owner_for_sales_users` — body of `crm.sp_Lead_List` and `crm.sp_Lead_Get` contains `@IsManager = 1 OR l.OwnerUserId = @UserId`.
  - `Begin_convert_is_atomic` — body of `crm.sp_Lead_BeginConvert` contains `ConvertingAt IS NULL` and `SalesOrderId IS NULL` in the same `UPDATE`.
  - `Script_ships_with_the_api` — csproj contains `Database\ProjectDB\14_CRM.sql`.
- [ ] **Step 2:** `dotnet test EncryptzTests --filter CrmScriptTests` → FAIL (file not found).
- [ ] **Step 3:** Write `14_CRM.sql` and the csproj line. Status values exactly `New, Contacted, Qualified, Quotation, Negotiation, Converted, Lost`; quotation status `Draft, Sent, Accepted, Rejected, Superseded`; lead number `LD-` + 4-digit per company, quotation `QT-` + 4-digit. `sp_Lead_BeginConvert` = one `UPDATE … SET ConvertingAt = SYSUTCDATETIME() WHERE LeadId=@LeadId AND CompanyId=@CompanyId AND SalesOrderId IS NULL AND ConvertingAt IS NULL AND Status IN ('Quotation','Negotiation')`, answer Success when `@@ROWCOUNT = 1`. `sp_Lead_CancelConvert` clears the marker. Dashboard counts per spec §8, scoped by the owner rule.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** `git add` the three files.

### Task 2: `CrmRules` (validation, status flow, quotation maths)

**Files:**
- Create: `EncryptzBL/Common/Crm/CrmRules.cs`, `EncryptzBL/DTO's/CrmDtos.cs`
- Test: `EncryptzTests/CrmRulesTests.cs`

**Interfaces:**
- Produces DTOs (no `UserId`/`CompanyId` properties on request DTOs): `LeadSaveDto`, `LeadListDto`, `LeadDetailDto`, `LeadFilterDto`, `FollowUpSaveDto`, `FollowUpDto`, `StatusChangeDto { string Status; int? LostReasonId; string? Note }`, `ReassignDto { int OwnerUserId }`, `QuotationSaveDto { int QuotationId; int LeadId; DateTime QuoteDate; DateTime? ValidUntil; bool IsInterState; string? Terms; List<QuotationItemDto> Items }`, `QuotationItemDto` (fields of `SalesOrderItemSaveDto` + `TaxableAmount, GstAmount, LineTotal`), `QuotationDto` (header + totals + items + `RevisionNo`, `Status`), `QuoteTotals { SubTotal, DiscountTotal, TaxableTotal, CGST, SGST, IGST, GrandTotal }`, `CrmMasterDto { int Id; string Name; bool IsActive }`, `CrmMemberDto { int UserId; string FullName; bool IsManager; bool IsActive }`, `ConvertPreviewDto { List<SalesCustomerDto> Matches; QuotationDto Quotation }`, `ConvertRequestDto { int QuotationId; int? CustomerId; DateTime OrderDate; string? PaymentMode }`, `ConvertResultDto { int SalesOrderId; string OrderNo; int CustomerId }`, `CrmDashboardDto`, report row DTOs.
- Produces `static class CrmRules`:
  - `string[] LeadStatuses`, `string[] FollowUpTypes = { "Phone Call", "Meeting", "Site Visit", "WhatsApp", "Email", "Other" }`, `string[] Priorities = { "Low", "Medium", "High" }`
  - `string? LeadProblem(LeadSaveDto?)` — trims; needs ContactName and a valid 10-digit Indian mobile (same regex style as `ConsultancyRules.Phone`, digits after stripping `+91`/spaces); email optional valid; qty ≥ 1 when given.
  - `string? FollowUpProblem(FollowUpSaveDto?)` — type from the list; next date not before the follow-up date.
  - `string? StatusChangeProblem(string from, StatusChangeDto to, bool isManager)` — Converted/Lost read-only except manager reopening Lost; `Converted` never set by hand; `Lost` needs `LostReasonId`.
  - `string? AutoStatusAfterFollowUp(string current)` → `"Contacted"` when `New`, else null; `string? AutoStatusAfterQuoteSent(string current)` → `"Quotation"` when earlier in the flow, else null.
  - `string? QuotationProblem(QuotationSaveDto?)` — ≥ 1 item; qty ≥ 1; rate ≥ 0; discount ≤ qty×rate; GST in {0, 5, 12, 18, 28}.
  - `QuoteTotals Totals(IEnumerable<QuotationItemDto> items, bool isInterState)` — fills each item's amounts; formula in Review Focus 5.

- [ ] **Step 1: Write failing tests**: `Lead_needs_name_and_mobile` ("Enter the contact name", "Enter a valid 10-digit mobile number"), `Mobile_is_normalised` (`" +91 98470 12345 "` → `"9847012345"`), `Follow_up_type_from_list`, `Lost_needs_a_reason`, `Converted_cannot_be_set_by_hand`, `Only_manager_reopens_lost`, `First_follow_up_moves_new_to_contacted`, `Quote_sent_moves_to_quotation_only_forward` (Negotiation stays), `Totals_match_sales_order_rounding` (items: 1×1000.25 @18%, 2×333.33 disc 10 @28%, intra → assert CGST/SGST split with SGST = total − CGST; inter → IGST = GstTotal, CGST=SGST=0).
- [ ] **Step 2:** `dotnet test EncryptzTests --filter CrmRulesTests` → FAIL.
- [ ] **Step 3:** Implement `CrmRules` and the DTOs.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** `git add`.

### Task 3: Leads, follow-ups, masters, members — service + API

**Files:**
- Create: `EncryptzBL/Infrastructure/Crm/ICrmService.cs`, `EncryptzBL/Infrastructure/Crm/CrmService.cs`, `EncryptzBL/Infrastructure/Crm/CrmService.Leads.cs`, `EncryptzAPI/Controllers/CrmController.cs`
- Modify: `EncryptzAPI/SrvInjection/ServiceRegistration.cs` (one line)
- Test: `EncryptzTests/CrmEndpointsTests.cs`

**Interfaces:**
- Consumes: Task 1 procs, Task 2 rules/DTOs.
- Produces `public sealed partial class CrmService : BaseRepository, ICrmService` with ctor `(DbHelper db, ISalesService sales, INotificationService notifications, ILogger<CrmService> logger)`. Every method's first two parameters are `int userId, bool isManager` (company comes from the tenant `DbHelper`; procs get `@CompanyId` from the token's company — pass `int companyId` as third parameter).
  - `Task<ApiResponse<PagedResult<LeadListDto>>> GetLeads(int userId, bool isManager, int companyId, LeadFilterDto f)`
  - `GetLead(…, int leadId)` → `ApiResponse<LeadDetailDto>` (includes follow-ups, history, quotations list)
  - `SaveLead(…, LeadSaveDto)` → `ApiResponse<int>`; new lead's owner = caller unless a manager picks another.
  - `ChangeStatus(…, int leadId, StatusChangeDto)`, `Reassign(…, int leadId, ReassignDto)` (manager only; sends in-app notification to new owner — module key `CRM`, text "Lead LD-xxxx was assigned to you"), `AddFollowUp(…, int leadId, FollowUpSaveDto)` (applies `AutoStatusAfterFollowUp`).
  - `GetMasters(…, string kind)` / `SaveMaster(…, string kind, CrmMasterDto)` for `sources|lost-reasons` (save manager only), `GetMembers` / `SaveMember` (manager only).
  - `Task<bool> IsManager(int userId, string role, int companyId)`.
- Produces `CrmController`: `[ApiController] [Route("api/crm")] [Authorize] [AppModule("CRM")]`; no action takes a parameter named like user/company. Routes:
  `GET leads`, `GET leads/{id:int}`, `POST leads`, `POST leads/{id:int}/status`, `POST leads/{id:int}/reassign`, `POST leads/{id:int}/follow-ups`, `GET masters/{kind}`, `POST masters/{kind}`, `GET members`, `POST members`, `GET me` (→ `{ userId, fullName, isManager }`).

- [ ] **Step 1: Failing tests** (pattern of `ConsultancyEndpointsTests`): `Controller_is_crm_module_and_authorized` (route `api/crm`, `AppModuleAttribute.ModuleKey == "CRM"`, no `AllowAnonymous`, no user/company parameters), `Routes_are_as_planned` (Theory over the route list above), `Service_is_registered` (registration contains `services.AddScoped<ICrmService, CrmService>();`), `Request_dtos_carry_no_ids_of_people` (no `UserId|CompanyId` on `LeadSaveDto, FollowUpSaveDto, QuotationSaveDto, ConvertRequestDto`), `Sales_user_sees_only_own` (source of `CrmService.Leads.cs` passes `@IsManager` and `@UserId` to `crm.sp_Lead_List` and `crm.sp_Lead_Get`).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement service, controller, registration line. Map a missing `crm` proc (`SqlException` 2812/208) to `"CRM is not set up in your company's database yet. Ask Encryptz to finish it"`.
- [ ] **Step 4:** PASS; `dotnet build EncryptzAPI` clean.
- [ ] **Step 5:** `git add`.

### Task 4: Quotations — save, revise, status, product search

**Files:**
- Create: `EncryptzBL/Infrastructure/Crm/CrmService.Quotations.cs`
- Modify: `ICrmService.cs`, `CrmController.cs` (new files of this feature)
- Test: `EncryptzTests/CrmEndpointsTests.cs`, `EncryptzTests/CrmRulesTests.cs`

**Interfaces:**
- Produces: `SaveQuotation(…, QuotationSaveDto)` → `ApiResponse<int>` (only Draft editable; totals from `CrmRules.Totals` sent to the proc), `GetQuotation(…, int quotationId)` → `ApiResponse<QuotationDto>`, `ReviseQuotation(…, int quotationId)` → `ApiResponse<int>` (new revision id), `SetQuotationStatus(…, int quotationId, string status)` (Sent applies `AutoStatusAfterQuoteSent`), `SearchProducts(…, string? term)` → `ApiResponse<List<CrmProductDto>>`.
- Routes: `POST quotations`, `GET quotations/{id:int}`, `POST quotations/{id:int}/revise`, `POST quotations/{id:int}/status`, `GET products`.

- [ ] **Step 1: Failing tests**: routes Theory extended; `Only_draft_is_editable` (rules: `CrmRules.QuotationEditProblem("Sent")` == "Only a draft quotation can be changed. Revise it instead"); `Revise_supersedes_the_old` (proc body of `crm.sp_Quotation_Revise` sets `Status = 'Superseded'` on the old and inserts `RevisionNo + 1` as `Draft`).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5:** `git add`.

### Task 5: Dashboard and reports — API

**Files:**
- Create: `EncryptzBL/Infrastructure/Crm/CrmService.Reports.cs`
- Modify: `ICrmService.cs`, `CrmController.cs`
- Test: `EncryptzTests/CrmEndpointsTests.cs`

**Interfaces:**
- Produces: `GetDashboard(…)` → `ApiResponse<CrmDashboardDto { int New, FollowUpPending, TodayFollowUps, Overdue, Qualified, QuotationPending, ConvertedThisMonth, LostThisMonth; List<LeadListDto> DueFollowUps }>`; `FollowUpReport(…, DateTime from, DateTime to, int? ownerUserId)`; `ConversionReport(…, DateTime from, DateTime to, string groupBy /* source|owner|month */)` rows `{ Group, Leads, Converted, ConversionPercent, ConvertedValue }` (value = order `GrandTotal` read via `dbo.SalesOrders` SELECT only).
- Routes: `GET dashboard`, `GET reports/follow-ups`, `GET reports/conversion`.

- [ ] **Step 1:** Failing route tests + `Conversion_percent_is_zero_without_leads` (`CrmRules.Percent(0, 0) == 0m`, `Percent(3, 8) == 37.5m`).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** `git add`.

### Task 6: Convert to Sale

**Files:**
- Create: `EncryptzBL/Infrastructure/Crm/CrmService.Convert.cs`
- Modify: `ICrmService.cs`, `CrmController.cs`
- Test: `EncryptzTests/CrmConvertTests.cs`

**Interfaces:**
- Consumes: `ISalesService.SearchCustomers(string?, int)`, `SaveCustomer(SalesCustomerSaveDto)`, `SaveOrder(SalesOrderSaveDto, int userId)` — unchanged.
- Produces: `PreviewConvert(…, int leadId, int quotationId)` → `ApiResponse<ConvertPreviewDto>` (matches = customers whose `MobileNumber` equals the lead mobile after the same normalisation as `CrmRules`); `Convert(…, int leadId, ConvertRequestDto)` → `ApiResponse<ConvertResultDto>`; `LinkOrder(…, int leadId, string orderNo)` (manager only).
- Order mapping: `CustomerId`, `OrderDate`, `PaymentMode`, `ReferenceNo = "QT-0007/R2"`, `ContactNumber = lead mobile`, `BillingAddress/City/State/PinCode` from lead, `IsInterState` from quotation, `Notes = "From lead LD-0012"`, items copied field-for-field.
- Sequence: rules check → `sp_Lead_BeginConvert` (refuse "This lead is already being converted or has a sale") → customer → `SaveOrder` → `sp_Lead_FinishConvert(@SalesOrderId, @CustomerId, @QuotationId)` (status Converted, quotation Accepted, marker cleared, history row). On failure before the order exists → `sp_Lead_CancelConvert`. On failure after → log with order no, answer "The sale SO-xxxx was made but the lead could not be updated. A manager can link it from the lead".
- Routes: `GET leads/{id:int}/convert-preview?quotationId=`, `POST leads/{id:int}/convert`, `POST leads/{id:int}/link-order`.

- [ ] **Step 1: Failing tests** on a pure mapping: `SalesOrderSaveDto CrmRules.BuildOrder(LeadDetailDto lead, QuotationDto q, int customerId, ConvertRequestDto req)` in `CrmRules`:
  - `Order_carries_quotation_lines_unchanged` (each item's ProductMasterId/Name/HsnSac/Qty/Rate/Discount/Gst/Warranty equal).
  - `Order_references_quote_and_lead` (`ReferenceNo == "QT-0007/R2"`, `Notes == "From lead LD-0012"`).
  - `Several_matches_need_a_choice` (`CrmRules.CustomerChoiceProblem(matches: 2, chosen: null)` == "More than one customer has this mobile. Choose one"; chosen id must be one of the matches).
  - `Superseded_quotation_cannot_convert`.
  - `Second_convert_is_refused`: the script test of Task 1 (`Begin_convert_is_atomic`) plus a source test that in `CrmService.Convert.cs` the call to `crm.sp_Lead_BeginConvert` comes before `_sales.SaveOrder(` and its failure returns early.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** `git add`.

### Task 7: UI — service, routes, entry and layout

**Files:**
- Create: `encryptzUI/src/app/Encryptz/Services/crm-service.ts` (+ `crm-service.spec.ts`), `encryptzUI/src/app/Encryptz/Models/CrmModels.ts`, `encryptzUI/src/app/Encryptz/components/crm-shell-component/*` (top bar: Dashboard, Leads, Reports, Settings[manager], company/branch name, back to workspace; `<router-outlet>`)
- Modify: `encryptzUI/src/app/app.routes.ts`, `company-selector-component.ts` (CRM after set-scope)
- Test: `crm-service.spec.ts`, `company-selector-component` spec case

**Interfaces:**
- Produces `CrmService` (Angular, `providedIn: 'root'`) with one method per API route of Tasks 3–6, using `environment.apiUrl + '/crm/...'`, returning `Observable<ApiResponse<T>>`; TS models mirror the C# DTO names in camelCase.
- Routes: `/crm` → `/crm/dashboard`; children of `crm-shell`: `dashboard`, `leads`, `leads/new`, `leads/:id`, `quotations/:id`, `quotations/:id/print` (no shell, print layout), `reports`, `settings`; all `canActivate: [authGuard]`.

- [ ] **Step 1: Failing specs**: `crm-service.spec.ts` — `getLeads` hits `GET {api}/crm/leads` with filter params; `convert` posts to `{api}/crm/leads/5/convert`. Company selector: after `setScope` for `CRM` navigates to `/crm/dashboard`; for `SERVICE` still calls `landingRouteForRole`.
- [ ] **Step 2:** `npx ng test --watch=false` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS; `npx ng build` clean.
- [ ] **Step 5:** `git add`.

### Task 8: UI — dashboard, leads, lead detail, quotation editor, print, settings, reports

**Files:**
- Create: `crm-dashboard-component`, `crm-leads-component`, `crm-lead-form-component`, `crm-lead-detail-component` (tabs: Details, Timeline, Quotations; actions per spec §8; dialogs: follow-up, status/lost, reassign, convert), `crm-quotation-component` (line editor: product search via `GET products`, totals shown with the same formula as `CrmRules.Totals`), `crm-quotation-print-component`, `crm-settings-component`, `crm-reports-component` — all under `encryptzUI/src/app/Encryptz/components/`.
- Test: a spec per component for its key behaviour only.

**Interfaces:**
- Consumes: Task 7 `CrmService` and models.
- Look: same light style and tokens as the consultancy pages; desktop first, usable at phone width. Do not import or modify `sales-order-entry-component`; copy what is needed.

- [ ] **Step 1: Failing specs**: dashboard tile click navigates to `/crm/leads?status=…`; lead detail hides Convert unless status is Quotation/Negotiation and a non-superseded quotation exists; convert dialog disables Confirm when `matches.length > 1` and none chosen; quotation editor recomputes totals on qty/rate change (intra 18% on 1000 → CGST 90, SGST 90, total 1180); Settings link hidden for non-managers.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS + `npx ng build`. **Step 5:** `git add`.

### Task 9: Release script and end-to-end check

**Files:**
- Create: `EncryptzAPI/Database/MainDB/32_CRM_Release.sql` — `UPDATE dbo.Modules SET IsReleased = 1, Family = N'Sales' WHERE ModuleKey = N'CRM'`; re-runnable; nothing else.
- Test: `EncryptzTests/CrmScriptTests.cs` (`Release_touches_only_the_crm_row`: one UPDATE, `WHERE ModuleKey = N'CRM'`, no INSERT/DELETE).
- Note for the owner (in the final report, not a file): CRM users must also be granted Service in phase 1 (Review Focus 1).

- [ ] **Step 1:** Failing test → **Step 2:** FAIL → **Step 3:** write script → **Step 4:** PASS.
- [ ] **Step 5:** Full checks: `dotnet build EncryptzAPI`, `dotnet test EncryptzTests` (all green, existing tests included), `npx ng build`.
- [ ] **Step 6:** Ask the owner which database to run `14_CRM.sql` and `32_CRM_Release.sql` on (a test company first). After they name it and run it: enable CRM for that company in Platform Admin, grant a sales user and a manager, walk: new lead → follow-up (status Contacted) → quotation → Sent → revise → convert → order appears in the existing Sales Order list → despatch from there as usual. Confirm a Felix user's Service screens are unchanged.
- [ ] **Step 7:** `git add`; report to the owner, no commit.
