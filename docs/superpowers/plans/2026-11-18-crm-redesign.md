# CRM Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give CRM a side menu, a Kanban dashboard that leads with what needs attention, responsive restyled pages, a Quotations page, five new reports, and Excel/PDF export.

**Architecture:** One new company-DB script (16) adds `SentAt`, a board procedure, a quotation list procedure and four report procedures. `CrmService`/`CrmController` expose them. The Angular CRM shell becomes side-menu + content; a new board component uses `@angular/cdk/drag-drop` and opens a small status dialog on drop; reports export Excel with `exceljs` (lazy import) and PDF via a print page.

**Tech Stack:** Angular 21.2 (standalone, signals, vitest), `@angular/cdk@21.2.0`, `exceljs@4.4.0`; ASP.NET Core (.NET 10) + ADO procedures; SQL Server; xUnit (script-text and endpoint tests).

**Spec:** `docs/superpowers/specs/2026-11-18-crm-redesign-design.md`

## Global Constraints

- Look: match the Service Management frame and the Products page (spec "Layout shell"). `HeaderComponent`, `FooterComponent`, `DashboardStateService` are imported/used, never edited.
- CRM only. No file outside `crm-*` components, `CrmModels.ts`, `crm-service.ts`, `CrmController.cs`, `EncryptzBL/Infrastructure/Crm/*`, `EncryptzBL/DTO's/CrmDtos.cs`, `EncryptzTests/Crm*`, `16_CRM_Board_Reports.sql`, `EncryptzAPI.csproj`, `encryptzUI/package.json`/lock, `app.routes.ts` (CRM block only).
- SQL: new file `EncryptzAPI/Database/ProjectDB/16_CRM_Board_Reports.sql`, header/guards like `15_CRM_Convert_Check.sql`, additive, safe to re-run, no `USE`. Never edit 14 or 15. Do not run SQL; the user runs it.
- Every procedure takes `@CompanyId INT, @UserId INT, @IsManager BIT, @LocationId INT` first; non-managers see only `OwnerUserId = @UserId`; always `l.LocationId = @LocationId`. Today = `CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE)`; now = `DATEADD(MINUTE, 330, GETUTCDATE())`.
- Attention constants (UI and SQL use the same numbers): new-not-contacted after **24 hours**, quotation waiting after **7 days**, stuck after **14 days**.
- Board limit **500** cards; `Truncated` true when more open leads exist.
- Converted is never a board column or drop target; Lost is a drop zone shown only while dragging.
- No CSV anywhere in CRM. Excel file name `CRM-<report-key>-<from>-<to>.xlsx` (Pipeline: `CRM-pipeline-<today>.xlsx`).
- No page may scroll sideways at 375 px width.
- Never `git commit`; stage with `git add` at the end of each task.

## Review Focus

- A drop whose status change the server refuses (e.g. lead being converted): card must return to its original column and the server message must show. → Task 5 test `restores the card when the server refuses`.
- Dialog cancelled after a drop: card back in place, no request sent. → Task 5 test `cancel puts the card back without a request`.
- Board with more than 500 open leads: a visible notice with a link to `/crm/leads`. → Task 5 test `shows the truncated notice`.
- Malayalam text in exports: Excel cell keeps the exact string; print page sets `<meta charset="utf-8">`. → Task 7 tests `keeps unicode text in cells` and `print page declares utf-8`.
- Lost or converted lead in the leads list: no next follow-up shown. → Task 9 test `hides next follow-up of closed leads`.

---

### Task 1: SQL 16 — SentAt, board and quotation list

**Files:**
- Create: `EncryptzAPI/Database/ProjectDB/16_CRM_Board_Reports.sql`
- Modify: `EncryptzAPI/EncryptzAPI.csproj` (add Content line after the 15 line)
- Test: `EncryptzTests/CrmBoardScriptTests.cs`

**Interfaces:**
- Produces: column `crm.Quotations.SentAt DATETIME2(0) NULL`; procedures
  - `crm.sp_Quotation_SetStatus` (same parameters and result as in 15; additionally `SentAt = <now>` when `@Status = 'Sent'`)
  - `crm.sp_Lead_Board @CompanyId, @UserId, @IsManager, @LocationId, @OwnerUserId INT = NULL` → set 1 cards (columns: `LeadId, LeadNo, ContactName, City, Status, Priority, OwnerUserId, OwnerName, NextFollowUpAt, StatusSince, DaysInStage, QuotationId, QuotationNo, QuotationStatus, QuotationValue, QuotationSentAt, IsOverdue, IsDueToday, IsNewNotContacted, HasNoFollowUp, IsQuotationWaiting, IsStuck` — flags BIT), set 2 one row `Overdue, DueToday, NewNotContacted, NoFollowUp, QuotationWaiting, Stuck, OpenLeads, ConvertedThisMonth, LostThisMonth` (counts over all open leads, not only the 500).
  - `crm.sp_Quotation_List @CompanyId, @UserId, @IsManager, @LocationId, @Search NVARCHAR(100) = NULL, @Status NVARCHAR(20) = NULL, @From DATE = NULL, @To DATE = NULL, @Page INT = 1, @PageSize INT = 25` → `QuotationId, QuotationNo, RevisionNo, QuoteDate, LeadId, LeadNo, ContactName, OwnerName, Status, GrandTotal, SentAt, AgeDays, TotalCount`. Search matches QuotationNo, LeadNo, ContactName, Mobile. AgeDays = days from `ISNULL(SentAt, QuoteDate)` to today.

- [ ] **Step 1: Write failing tests** in `CrmBoardScriptTests.cs` (reuse the `Root()/Read()/Procedures()` helpers pattern of `CrmScriptTests`):
  - `Script_has_header_guards_and_no_use`: contains `SET NOEXEC ON`, `Run 14_CRM.sql first`, no `\bUSE\s+\[` match.
  - `Adds_SentAt_idempotently`: contains `COL_LENGTH('crm.Quotations', 'SentAt') IS NULL`.
  - `Backfills_SentAt_from_UpdatedAt`: contains `SET SentAt = UpdatedAt` and `Status IN ('Sent', 'Rejected', 'Accepted', 'Superseded')` and `SentAt IS NULL`.
  - `SetStatus_stamps_SentAt_and_keeps_convert_check`: body of `sp_Quotation_SetStatus` contains `SentAt` and `ConvertNeedsCheck` and `N'A manager must check the sales orders for this lead first'`.
  - `Board_uses_attention_constants`: body of `sp_Lead_Board` contains `-24` (HOUR), `-7`, `-14`, `TOP (500)`, `l.Status NOT IN ('Converted', 'Lost')`, `l.LocationId = @LocationId`, `@IsManager = 1 OR l.OwnerUserId = @UserId`.
  - `Board_latest_quotation_is_draft_or_sent`: body contains `Status IN ('Draft', 'Sent')` and `ORDER BY q.QuotationId DESC`.
  - `Quotation_list_is_scoped_and_paged`: body of `sp_Quotation_List` contains `OFFSET`, `FETCH NEXT`, `l.LocationId = @LocationId`, `COUNT(*) OVER ()`.
  - `Csproj_ships_script_16`: `EncryptzAPI.csproj` contains `Database\ProjectDB\16_CRM_Board_Reports.sql`.
  - `Parses_as_follow_up`: `TenantScript.ParseFollowUp("16_CRM_Board_Reports.sql", text).Batches` not empty.
- [ ] **Step 2: Run** `dotnet test EncryptzTests --filter CrmBoardScriptTests` → FAIL (file missing).
- [ ] **Step 3: Write the script.** Header comment in the style of 15 (what it adds, run after 15, re-runnable). Guards: copy the database-kind block and the `crm.Leads is missing` block of 15; add `IF COL_LENGTH('crm.Leads','ConvertNeedsCheck') IS NULL → RAISERROR('Run 15_CRM_Convert_Check.sql first.')`. `sp_Quotation_SetStatus`: copy 15's version verbatim and add `, SentAt = CASE WHEN @Status = 'Sent' THEN DATEADD(MINUTE, 330, GETUTCDATE()) ELSE SentAt END` to its UPDATE. StatusSince = `MAX(ChangedAt)` from `crm.LeadStatusHistory` for the lead where `ToStatus = l.Status`, else `l.CreatedAt`. Rules: Overdue `CAST(NextFollowUpAt AS DATE) < @Today`; DueToday `= @Today`; NewNotContacted `Status='New' AND CreatedAt < DATEADD(HOUR,-24,@Now)`; HasNoFollowUp `NextFollowUpAt IS NULL`; QuotationWaiting `latest.Status='Sent' AND latest.SentAt < DATEADD(DAY,-7,@Now)`; Stuck `StatusSince < DATEADD(DAY,-14,@Now)`. Converted/lost this month as in `sp_Dashboard`. Order cards by `IsOverdue DESC, NextFollowUpAt, LeadId DESC`. End with `PRINT 'CRM board and reports applied.'`. Add the csproj Content line.
- [ ] **Step 4: Run** `dotnet test EncryptzTests --filter "CrmBoardScriptTests|CrmScriptTests"` → PASS.
- [ ] **Step 5: Stage** `git add EncryptzAPI/Database/ProjectDB/16_CRM_Board_Reports.sql EncryptzAPI/EncryptzAPI.csproj EncryptzTests/CrmBoardScriptTests.cs`

### Task 2: SQL 16 — report procedures

**Files:**
- Modify: `EncryptzAPI/Database/ProjectDB/16_CRM_Board_Reports.sql` (append before the final PRINT)
- Test: `EncryptzTests/CrmBoardScriptTests.cs`

**Interfaces:**
- Produces (all start with `@CompanyId, @UserId, @IsManager, @LocationId`):
  - `crm.sp_Report_Pipeline @OwnerUserId INT = NULL` → `Status, Leads, QuotationValue, AvgDaysInStage` for New, Contacted, Qualified, Quotation, Negotiation (all five rows always, zero-filled, in that order).
  - `crm.sp_Report_Sources @From DATE = NULL, @To DATE = NULL` → `SourceName, Leads, Converted, Lost, OpenLeads, ConversionPct DECIMAL(5,1), ConvertedValue`. Leads by `LeadDate`; Converted by `ConvertedAt`; Lost by `LostAt`; OpenLeads = leads in range still open. No source → `N'(none)'`.
  - `crm.sp_Report_Team @From DATE = NULL, @To DATE = NULL, @OwnerUserId INT = NULL` → `OwnerUserId, OwnerName, Leads, FollowUpsDone, OverdueNow, Converted, Lost, ConvertedValue`. Leads/Converted/Lost/value/overdue by current owner; FollowUpsDone by `FollowUps.UserId` with `FollowUpAt` in range.
  - `crm.sp_Report_LostReasons @From DATE = NULL, @To DATE = NULL, @OwnerUserId INT = NULL` → `ReasonName, Leads, PctOfLost DECIMAL(5,1), ValueLost` by `LostAt`; ValueLost = newest non-Superseded quotation grand total of each lost lead.
  - Converted value = grand total of the quotation with `Status = 'Accepted'` for the lead (0 if none).

- [ ] **Step 1: Failing tests:** `Pipeline_lists_five_open_stages` (body contains each of `'New'`,`'Contacted'`,`'Qualified'`,`'Quotation'`,`'Negotiation'` and no `'Converted'` in a VALUES list), `Sources_filters_each_figure_by_its_event_date` (contains `LeadDate`, `ConvertedAt`, `LostAt`), `Team_credits_follow_ups_to_who_logged_them` (contains `f.UserId`), `LostReasons_skips_superseded` (contains `<> 'Superseded'`), and every report body contains `l.LocationId = @LocationId` and `@IsManager = 1 OR l.OwnerUserId = @UserId`.
- [ ] **Step 2: Run** `dotnet test EncryptzTests --filter CrmBoardScriptTests` → new tests FAIL.
- [ ] **Step 3: Write the four procedures.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Stage** the script and test file.

### Task 3: API — DTOs, service, endpoints

**Files:**
- Modify: `EncryptzBL/DTO's/CrmDtos.cs`, `EncryptzBL/Infrastructure/Crm/ICrmService.cs`, `EncryptzBL/Infrastructure/Crm/CrmService.Reports.cs`, `EncryptzBL/Infrastructure/Crm/CrmService.Quotations.cs`, `EncryptzAPI/Controllers/CrmController.cs`
- Test: `EncryptzTests/CrmEndpointsTests.cs`

**Interfaces:**
- Consumes: Task 1/2 procedures and column names.
- Produces DTOs (properties = procedure columns, PascalCase): `CrmBoardCardDto`, `CrmAttentionCountsDto` (+ `OpenLeads, ConvertedThisMonth, LostThisMonth`), `CrmBoardDto { List<CrmBoardCardDto> Cards; CrmAttentionCountsDto Counts; bool Truncated }`, `QuotationListRowDto`, `QuotationFilterDto { string? Search; string? Status; DateTime? From; DateTime? To; int Page = 1; int PageSize = 25 }`, `CrmPipelineRowDto`, `CrmSourceRowDto`, `CrmTeamRowDto`, `CrmLostReasonRowDto`.
- Service (all `(int userId, bool isManager, int companyId, ...)` wrapped in `Guard`):
  - `GetBoard(..., int? ownerUserId) : Task<ApiResponse<CrmBoardDto>>` — `Truncated = Counts.OpenLeads > Cards.Count`.
  - `GetQuotations(..., QuotationFilterDto f) : Task<ApiResponse<PagedResult<QuotationListRowDto>>>` — page size clamp 1..200 like `GetLeads`.
  - `PipelineReport(..., int? ownerUserId)`, `SourcesReport(..., DateTime? from, DateTime? to)`, `TeamReport(..., DateTime? from, DateTime? to, int? ownerUserId)`, `LostReasonsReport(..., DateTime? from, DateTime? to, int? ownerUserId)` returning `ApiResponse<List<...RowDto>>`; from > to → `Fail("The From date is after the To date")`.
- Endpoints on `api/crm`: `GET board`, `GET quotations`, `GET reports/pipeline`, `GET reports/sources`, `GET reports/team`, `GET reports/lost-reasons` (query parameters as above, camelCase), each via `Answer(...)`.

- [ ] **Step 1: Failing tests:** add `[InlineData("GET", "board")]`, `[InlineData("GET", "quotations")]`, `[InlineData("GET", "reports/pipeline")]`, `[InlineData("GET", "reports/sources")]`, `[InlineData("GET", "reports/team")]`, `[InlineData("GET", "reports/lost-reasons")]` to the existing endpoint theory; add a test that the board `Truncated` is true when `OpenLeads` (3) > card count (2) using the existing fake-service pattern in that file if present, else test a static `CrmBoardDto.IsTruncated(int open, int shown)` helper.
- [ ] **Step 2: Run** `dotnet test EncryptzTests --filter CrmEndpointsTests` → FAIL.
- [ ] **Step 3: Implement** DTOs, interface, service methods, endpoints.
- [ ] **Step 4: Run** `dotnet build` and `dotnet test EncryptzTests --filter Crm` → PASS.
- [ ] **Step 5: Stage** the five files and the test.

### Task 4: UI — packages, models, service, side-menu shell, shared styles

**Files:**
- Modify: `encryptzUI/package.json` (+lock): `npm i @angular/cdk@21.2.0 exceljs@4.4.0`
- Modify: `encryptzUI/src/app/Encryptz/Models/CrmModels.ts`, `Services/crm-service.ts`, `Services/crm-service.spec.ts`
- Modify: `crm-shell-component/crm-shell-component.{ts,html,scss}`, `crm-shell-component/crm-pages.scss`, `crm-shell-component/crm-shell-component.spec.ts`

**Interfaces:**
- Produces TS models mirroring Task 3 DTOs in camelCase: `CrmBoardCardDto`, `CrmAttentionCountsDto`, `CrmBoardDto`, `QuotationListRowDto`, `QuotationFilterDto`, `CrmPipelineRowDto`, `CrmSourceRowDto`, `CrmTeamRowDto`, `CrmLostReasonRowDto`.
- `CrmService`: `getBoard(ownerUserId?: number)`, `getQuotations(filter: QuotationFilterDto)`, `pipelineReport(ownerUserId?: number)`, `sourcesReport(f: {from?: string; to?: string})`, `teamReport(f: FollowUpReportFilter)`, `lostReasonsReport(f: FollowUpReportFilter)` → `Observable<ApiResponse<...>>`, URLs `${base}/board`, `/quotations`, `/reports/pipeline|sources|team|lost-reasons`, params only when set.
- Shell = Service Management frame (spec "Layout shell"): template `<app-header (toggleSidebar)="dash.toggleSidebar()" />`, `<aside class="crm-side" [class.collapsed]="!dash.sidebarOpen()">`, `<main class="crm-main" [class.sidebar-open]="dash.sidebarOpen()"><router-outlet /><app-footer /></main>`, backdrop `.crm-backdrop` shown at ≤768 px when open. Imports `HeaderComponent`, `FooterComponent` (unchanged files); injects `DashboardStateService` as `dash`. On navigation at ≤768 px call `dash.closeSidebar()` (use the existing close method of that service; read it first). Menu links in order with Material icons: `/crm/dashboard` Dashboard `view_kanban`, `/crm/leads` Leads `contacts`, `/crm/quotations` Quotations `request_quote`, `/crm/reports` Reports `bar_chart`, `/crm/settings` Settings `settings` (managers only), then button Back to workspace `arrow_back` → `/select-company`. Collapsed: icons only with `title` tooltips. Styles copy `sidebar-component.scss` look (`var(--sidebar-bg)`, `--sidebar-text`, `--sidebar-hover`, 230/60 px); do not import or edit `sidebar-component`.
- Shared classes in `crm-pages.scss`, copying the Products page look (`product-list-component.scss`: bg `#f5f7fa`, title 22 px, subtitle 13 px, red `#d42b2b` primary, navy `#1B4A7A` secondary, stat card label 11 px uppercase, value 28 px): `.crm-page-head` (title, subtitle, actions), `.crm-btn.primary` (red), `.crm-btn.navy`, `.crm-stats` + `.crm-stat` (`.crm-stat-label`, `.crm-stat-val`, `.crm-stat-pill`), `.crm-table-card` with `.crm-table-toolbar` (`.crm-table-title`, `.crm-count-pill`) and `.crm-table-wrap` (overflow-x:auto; th 11 px uppercase), `.crm-pill` (+ `.green`, `.red`, `.blue`, `.amber`), `.crm-badge` (+ `.red`, `.amber`), `.crm-empty`, `.crm-skeleton`, `.crm-cards-sm` (table rows → cards below 640 px).

- [ ] **Step 1: Failing specs:** service spec — one `it` per new method asserting URL and params (`getBoard(7)` → `GET ${api}/board?ownerUserId=7`; `getQuotations({search:'QT', page:2})` → params search, page). Shell spec — `renders the shared header and footer` (`app-header`, `app-footer` present), `shows Quotations in the menu`, `hides Settings for a non-manager`, `collapses with the header toggle` (`dash.toggleSidebar()` → `.crm-side.collapsed`), `back to workspace goes to select-company`.
- [ ] **Step 2: Run** `npx ng test --watch=false --include='src/app/Encryptz/**/crm-s*.spec.ts'` → FAIL.
- [ ] **Step 3: Install packages; implement models, service methods, shell, shared styles.** Compare side by side with `/products` at 1366 px (screenshots) before finishing: header, sidebar colour/width and page header must look the same.
- [ ] **Step 4: Run** the same command → PASS; `npx ng build` → succeeds.
- [ ] **Step 5: Stage** all changed files.

### Task 5: Kanban dashboard with attention strip and drag to change status

**Files:**
- Create: `crm-dashboard-component/crm-board.ts` (pure helpers), `crm-dashboard-component/crm-board.spec.ts`
- Create: `crm-shell-component/crm-status-dialog-component.ts` (+ `.html`, `.scss`)
- Modify: `crm-dashboard-component/crm-dashboard-component.{ts,html,scss,spec.ts}`

**Interfaces:**
- Consumes: `CrmService.getBoard`, `changeStatus(id, {status, note, lostReasonId})`, `getMasters('lost-reasons')`, `me()`, `getMembers()` (owner filter for managers).
- `crm-board.ts` produces: `BOARD_COLUMNS = ['New','Contacted','Qualified','Quotation','Negotiation'] as const`; `type AttentionKey = 'overdue'|'today'|'newNotContacted'|'noFollowUp'|'quotationWaiting'|'stuck'`; `ATTENTION: {key: AttentionKey; label: string; flag: keyof CrmBoardCardDto; count: keyof CrmAttentionCountsDto; tone: 'red'|'amber'}[]` with labels exactly `Overdue follow-ups`, `Today's follow-ups`, `New, not contacted`, `No next follow-up`, `Quotation waiting`, `Stuck in stage`; `columnsOf(cards, filter: AttentionKey | null): Record<BoardColumn, CrmBoardCardDto[]>`; `columnValue(cards): number`; `badgesOf(card): {label, tone}[]`.
- `CrmStatusDialogComponent` inputs `mode: 'status'|'lost'`, `leadNo`, `toStatus`, `lostReasons`; outputs `confirmed: {note: string; lostReasonId: number|null}`, `cancelled`. Lost mode requires a reason (Confirm disabled until chosen).
- Dashboard: strip tiles `.crm-attn[data-key]` (click toggles filter, `.active`); columns `.crm-col[data-status]` with header count and `rupees(columnValue)`; cards `.crm-kcard` linking to `/crm/leads/:id`; `cdkDropListGroup`; `.crm-lost-zone` rendered only while dragging; header figures converted/lost this month; truncated notice `.crm-truncated` with link `/crm/leads`. On drop: card moves optimistically, dialog opens; cancel → move back, no request; confirm → `changeStatus`; failure → move back and show `refusalOf(err)` or `res.message`; success → reload board.

- [ ] **Step 1: Failing tests** (`crm-board.spec.ts`): `columnsOf groups by status and drops closed`, `filter keeps only flagged cards`, `badgesOf puts overdue first in red`, `columnValue sums quotationValue ignoring null`. (`crm-dashboard-component.spec.ts`, rewrite): `shows the six attention tiles with counts`, `clicking a tile filters the board`, `drop opens the status dialog with the target status`, `cancel puts the card back without a request`, `confirm calls changeStatus with note`, `restores the card when the server refuses` (changeStatus returns `throwError` → card in original column, message shown), `drop on Lost opens lost mode and needs a reason`, `shows the truncated notice` (`truncated: true` → `.crm-truncated a[href="/crm/leads"]`). Call the component's `onDrop(card, toStatus)` method directly instead of simulating CDK pointer events.
- [ ] **Step 2: Run** `npx ng test --watch=false --include='src/app/Encryptz/components/crm-dashboard-component/**'` → FAIL.
- [ ] **Step 3: Implement** helpers, dialog, dashboard. Phone (<640 px): board scrolls horizontally, one column ≈ 85 vw, `scroll-snap-type: x mandatory`; lost zone `position: sticky; bottom: 0`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Stage.**

### Task 6: Quotations page

**Files:**
- Create: `crm-quotations-component/crm-quotations-component.{ts,html,scss,spec.ts}`
- Modify: `encryptzUI/src/app/app.routes.ts` (CRM children: `{ path: 'quotations', loadComponent: ... }` placed before `quotations/:id`)

**Interfaces:**
- Consumes: `CrmService.getQuotations`, `pill()`, `rupees()`, `showDate()`.
- Produces: page with search, status select (All, Draft, Sent, Accepted, Rejected, Superseded), date range, table (`.crm-table-wrap` + `.crm-cards-sm`), pager; row link `/crm/quotations/:id`.

- [ ] **Step 1: Failing spec:** `loads the first page`, `searching sends the term and resets to page 1`, `status filter sends status`, `row links to the quotation`, `shows the empty state`.
- [ ] **Step 2: Run** `npx ng test --watch=false --include='src/app/Encryptz/components/crm-quotations-component/**'` → FAIL.
- [ ] **Step 3: Implement** component and route.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Stage.**

### Task 7: Report export helpers (Excel and PDF)

**Files:**
- Create: `crm-reports-component/crm-export.ts`, `crm-reports-component/crm-export.spec.ts`

**Interfaces:**
- Produces:
  - `interface ReportColumn<T> { key: keyof T & string; title: string; kind?: 'text'|'number'|'money'|'percent'|'date'|'datetime' }`
  - `interface ReportExport<T> { key: string; title: string; filters: string; columns: ReportColumn<T>[]; rows: T[]; companyName: string; fileName: string }`
  - `exportFileName(key: string, from?: string, to?: string, today?: Date): string` → `CRM-<key>-<from>-<to>.xlsx` or `CRM-<key>-<yyyy-mm-dd>.xlsx` when no range.
  - `async exportExcel<T>(r: ReportExport<T>, load = () => import('exceljs')): Promise<void>` — one sheet named by title (max 31 chars), bold frozen header, money `numFmt '#,##,##0.00'`, percent `'0.0"%"'`, column widths from content, downloads via Blob + anchor.
  - `printReportHtml<T>(r: ReportExport<T>, printedOn: Date): string` — full HTML document with `<meta charset="utf-8">`, company, title, filters, table, "Printed on" line, `@page { size: A4 landscape }` when columns > 6.
  - `openPrint(html: string): void` — same popup pattern as `payment-report-component.ts:295-456` (no inline script; `onafterprint` close).
- [ ] **Step 1: Failing spec:** `builds the file name with range`, `builds the file name for a snapshot`, `keeps unicode text in cells` (fake exceljs: assert the cell value equals `'E2E TEST ജോസഫ് മാത്യു'`), `formats money columns`, `print page declares utf-8`, `print page escapes html` (`<b>` → `&lt;b&gt;`), `print page is landscape for wide tables`.
- [ ] **Step 2: Run** `npx ng test --watch=false --include='src/app/Encryptz/components/crm-reports-component/crm-export.spec.ts'` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Stage.**

### Task 8: Reports page — seven reports, Excel/PDF, no CSV

**Files:**
- Modify: `crm-reports-component/crm-reports-component.{ts,html,scss,spec.ts}`

**Interfaces:**
- Consumes: Task 4 service methods, existing `followUpReport`, `conversionReport`, Task 7 helpers.
- Produces tabs (in order, `data-key`): `followups` Leads & follow-ups, `conversion` Sales conversion, `pipeline` Pipeline, `sources` Source performance, `team` Team performance, `lost` Lost reasons, `quotations` Quotation register (uses `getQuotations` with pageSize 200 and the date range). Filter bar: From/To (default `thisMonth()`; hidden on Pipeline), Owner (managers; on followups, pipeline, team, lost), Show. Each tab: summary figures row, horizontal bar per row for the main figure (CSS width %), table. Buttons `.crm-excel` and `.crm-pdf`; no `CSV` text anywhere.
- [ ] **Step 1: Failing spec:** `has seven tabs in order`, `pipeline hides the date range`, `excel exports the visible report` (spy `exportExcel` called with key and rows), `pdf opens the print page`, `does not offer CSV`, `from after to shows the server message`.
- [ ] **Step 2: Run** `npx ng test --watch=false --include='src/app/Encryptz/components/crm-reports-component/crm-reports-component.spec.ts'` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Stage.**

### Task 9: Restyle leads list, lead form, lead detail

**Files:**
- Modify: `crm-leads-component/*`, `crm-lead-form-component/*`, `crm-lead-detail-component/*` (html/scss/spec; ts only where noted)

**Interfaces:**
- Consumes: shared classes from Task 4.
- Leads list: `.crm-cards-sm` layout on phone; next follow-up column empty for `Converted`/`Lost` (ts: `followUpOf(row)` returns `''` for closed). Lead detail: actions wrap; dialogs `max-width: 100vw` full-screen below 640 px; attention badges next to status (from lead fields: overdue/today/no follow-up). No behaviour change otherwise; existing specs keep passing (update selectors only where markup changes).
- [ ] **Step 1: Failing spec:** `hides next follow-up of closed leads` (leads spec, Lost row with `nextFollowUpAt` set → cell empty).
- [ ] **Step 2: Run** `npx ng test --watch=false --include='src/app/Encryptz/components/crm-lead*/**'` → that test FAILS, others PASS.
- [ ] **Step 3: Restyle the three pages; implement `followUpOf`.**
- [ ] **Step 4: Run** → all PASS.
- [ ] **Step 5: Stage.**

### Task 10: Restyle quotation editor, print and settings

**Files:**
- Modify: `crm-quotation-component/*`, `crm-quotation-print-component/*`, `crm-settings-component/*` (html/scss; specs only for selector changes)

**Interfaces:**
- Quotation editor: product name column min 260 px on desktop; below 900 px each line is a stacked card (`.q-line-card`) with labelled inputs; input class names `q-name, q-hsn, q-qty, q-rate, q-disc, q-gst, q-warranty` unchanged. Opening a new quotation keeps its one blank line, and picking a product from search fills that blank line instead of adding a second one (ts change in `pick()`).
- [ ] **Step 1: Failing spec:** `picking a product fills the empty first line` (quotation spec: new quotation, `pick(p)` → one line with `productName === p.productName`).
- [ ] **Step 2: Run** `npx ng test --watch=false --include='src/app/Encryptz/components/crm-quotation*/**' --include='src/app/Encryptz/components/crm-settings*/**'` → that test FAILS.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Stage.**

### Task 11: Whole-CRM verification

**Files:**
- Create (scratchpad, not in repo): a Playwright script that logs in with the existing E2E state, visits `/crm/dashboard`, `/crm/leads`, `/crm/leads/4`, `/crm/leads/new`, `/crm/quotations`, `/crm/quotations/3`, `/crm/reports` (each tab), `/crm/settings` at 1366, 768 and 375 px.

- [ ] **Step 1: Run** `npx ng test --watch=false` (whole UI) and `dotnet test EncryptzTests` → all PASS (report any pre-existing failure separately, do not fix outside CRM).
- [ ] **Step 2: Ask the user to run** `16_CRM_Board_Reports.sql` on the Encryptz company database, then restart the API.
- [ ] **Step 3: Run the Playwright script:** expected `document.scrollingElement.scrollWidth - innerWidth <= 1` on every page and width, no console errors, no HTTP ≥ 400 from `/api/crm`; screenshots saved; one drag on the board in a visible browser (LD-0007 Qualified → Quotation, then Cancel) leaves the card in Qualified.
- [ ] **Step 4: Stage** nothing new; report results with screenshot paths.
