# CRM redesign: side menu, Kanban dashboard, attention, reports, Excel/PDF

Date: 2026-11-18 · Module: CRM only (encryptzUI `crm-*` components, CRM API, ProjectDB `crm` schema)

## Intent and the why

The owner finds every CRM page plain and hard to read, and on a phone some pages scroll sideways.
The main problem in their words: the pages must **project the attention required area**. When a
salesperson or manager opens CRM, the first thing they see is what needs action now, not a wall of
counts. The other modules (Service Management, Job Consultancy) will be redone later in the same
style, so CRM is the pattern they will be measured against.

## Goals

1. A left **side menu** for CRM, like Service Management and Job Consultancy have, replacing the top
   tabs. Items: Dashboard, Leads, Quotations, Reports, Settings (Settings only for CRM managers, as
   today). On a phone it opens from a hamburger button.
2. **Dashboard = Kanban board** of open leads. Columns: New, Contacted, Qualified, Quotation,
   Negotiation. Each card is a lead: lead no, contact name, city, owner, priority, latest quotation
   value (if any), next follow-up, days in this stage, and attention badges.
3. **Attention required strip** at the top of the dashboard: one tile per attention rule with its
   count; clicking a tile filters the board to those cards (click again to clear).
4. **Drag a card to another column to change its status.** The drop opens the existing
   "Change status" dialog with the target status pre-selected and asks for the note; Cancel puts the
   card back. Dropping on **Lost** opens the existing "Mark lost" dialog (reason required).
   Converted is not a column; converting stays on the lead page (Convert to Sale).
5. **Beautify and make responsive every CRM page**: dashboard, leads list, new/edit lead, lead
   detail (tabs, dialogs, convert), quotation editor, quotation print, reports, settings.
   No page may scroll sideways at 375 px; tables become cards or scroll inside their own box.
6. **Five new reports** next to the two that exist (Leads & follow-ups, Sales conversion):
   Pipeline, Source performance, Team performance, Lost reasons, Quotation register.
7. **Excel and PDF** on every report (CSV is removed).
8. A **Quotations** page (menu item): every quotation of the company with search and status filter,
   opening the existing quotation editor.

## Attention rules (dashboard strip and card badges)

| Rule | Condition (open leads = status not Converted/Lost) |
|---|---|
| Overdue follow-ups | next follow-up date before today |
| Today's follow-ups | next follow-up date is today |
| New, not contacted | status New and lead created more than 24 hours ago |
| No next follow-up | open lead with no next follow-up date |
| Quotation waiting | latest quotation status Sent and sent more than 7 days ago |
| Stuck in stage | in the current status for more than 14 days |

The three numbers (24 hours, 7 days, 14 days) are fixed constants for now, defined in one place so
they can become CRM settings later. A card can carry several badges; Overdue is red, the rest amber.

### Definitions used everywhere (builder-check answers; all marked *my call*)

- **Sent date of a quotation** *(my call)*: `crm.Quotations` has no such column. File 16 adds
  `SentAt DATETIME2 NULL` and replaces `crm.sp_Quotation_SetStatus` so that marking Sent stamps
  `SentAt` (IST, same clock as the other dates); every other line of that procedure stays as in 15.
  Backfill once: quotations already Sent, Rejected, Accepted or Superseded get `SentAt = UpdatedAt`
  where it is null (close enough for old rows). This records a fact; it changes no rule.
- **Latest quotation of a lead** *(my call)*: of the lead's quotations that are Draft or Sent (the
  ones convert accepts), the newest by `QuotationId`. Its grand total is the lead's "quotation value"
  on cards, column totals, Pipeline and Lost reasons. A Draft counts; Rejected and Superseded do not.
  For Lost reasons, "value lost" uses the newest non-Superseded quotation the lead had when lost.
- **Date range of the new reports** *(my call)*: each figure is filtered by the date of its own
  event: leads by `LeadDate`, follow-ups by `FollowUpAt`, converted by `ConvertedAt`, lost by
  `LostAt`, quotations by `QuoteDate`. The existing two reports keep their behaviour. Pipeline is a
  snapshot of open leads now and hides the date range (owner filter only).
- **Team performance credit** *(my call)*: leads, converted, lost, converted value and overdue go to
  the lead's **current** owner; "follow-ups done" go to the user who logged the follow-up.
- **Lost drop target** *(my call)*: not a column. While a card is dragged, a "Mark lost" drop zone
  appears at the bottom of the board (sticky on a phone); it holds no cards.
- **Count tiles** *(my call)*: the current tiles row and the "Today's and overdue follow-ups" list are
  removed from the dashboard; the attention strip and column counts replace them. Converted and lost
  this month appear as two small figures in the dashboard header (from the board endpoint), and in
  the reports. `GET api/crm/dashboard` and `crm.sp_Dashboard` stay (unused by the UI) so nothing else
  breaks.

## Non-goals

- Service Management, Job Consultancy, Home and every other module: not touched (the owner will
  review them later; Service Management is live for Felix and must not change).
- No change to CRM business rules (who may change what, the convert flow, the convert marker).
- No e-mail, SMS or WhatsApp.
- No CSV export.

## Anti-goals (a failure even if it works)

- A drag that changes a status without the user confirming it in the dialog.
- A board that silently shows only part of the leads (if there are more than the board can hold,
  it must say so and point to the Leads list).
- Malayalam names broken in Excel or PDF.
- Any page that scrolls sideways on a phone.

## Constraints

- Angular 21.2 standalone components, signals; keep the existing `crm-*` component structure and
  `CrmService` (`${environment.apiUrl}/api/crm`). Specs (vitest) exist for each CRM component and
  must keep passing, updated where markup changes.
- Every SQL change is a **new numbered file**: `EncryptzAPI/Database/ProjectDB/16_CRM_Board_Reports.sql`
  (runs after 14 and 15, in each company database, additive and safe to re-run, same header and
  guards as 15). Never edit 14 or 15. The user runs SQL on existing company databases. New company
  databases get it through the follow-up mechanism (`TenantScript` runs every `NN_*.sql` with
  NN >= 10 after the base script), which needs one `<Content Include=...>` line for the file in
  `EncryptzAPI/EncryptzAPI.csproj`; `New_Tenant_Database.sql` is not touched.
- Procedures follow the existing pattern: `@CompanyId, @UserId, @IsManager, @LocationId`, non-managers
  see only their own leads, times in IST (`DATEADD(MINUTE, 330, GETUTCDATE())`).
- No git commit; leave changes staged.

## Approaches considered

**Excel / PDF**

1. **Picked: Excel in the browser, PDF through a print page.** Excel with `exceljs` (MIT), loaded
   only when the user clicks Excel (dynamic import), so the app bundle does not grow. PDF opens a
   styled print page of the report (same technique as the quotation print page) and the user saves
   it with the browser's "Save as PDF". Malayalam renders correctly; no server change. Trade-off:
   PDF is a print-dialog step, not a one-click file.
2. Both in the browser (`exceljs` + `jsPDF` with an embedded Noto Sans Malayalam font): one-click
   PDF, but 300-500 KB of font per export and weaker table layout.
3. Server side (ClosedXML + QuestPDF): best output, but new API packages, a QuestPDF licence check,
   fonts on the server and a download endpoint per report.

**Drag and drop:** `@angular/cdk` drag-drop (version matching Angular 21.2). It supports touch, so the
board works on a phone. Native HTML5 drag-and-drop was rejected: it does not work with touch.

## Design

### Layout shell — must match the Service Management view (owner's instruction, screenshot of /products)
`crm-shell-component` uses the same frame as Service Management:
- the existing `<app-header>` (company name in black + red, branch, credits chip, bell, user menu)
  and `<app-footer>`, imported unchanged; the header's `toggleSidebar` output drives
  `DashboardStateService.toggleSidebar()` exactly as `main-layout-component` does;
- a CRM side menu that looks like `sidebar-component`: dark navy (`var(--sidebar-bg)`,
  `--sidebar-text`, `--sidebar-hover`), 230 px wide, 60 px icons-only when collapsed (same collapse
  button and `DashboardStateService.sidebarOpen` state), "NAVIGATION" label, Material icons, version
  chip at the bottom; off-canvas with backdrop at 768 px and below. Items are fixed in code (CRM has
  no menus in the database): Dashboard `view_kanban`, Leads `contacts`, Quotations `request_quote`,
  Reports `bar_chart`, Settings `settings` (managers), then "Back to workspace" `arrow_back`.
  `sidebar-component` itself is not used or changed (it reads the module menus from the database).
- page visual language copied from the Products page (`product-list-component.scss`), not shared
  with it: background `#f5f7fa`; page header with 22 px title and 13 px grey subtitle; primary action
  red `#d42b2b`; secondary/apply buttons navy `#1B4A7A`; white stat cards with 11 px uppercase grey
  label, 28 px value and a small pill; a white table card with a toolbar (title + count pill on the
  left, search and selects on the right), uppercase 11 px column headers, rows with light dividers;
  status shown as soft pills (green/red/blue/amber). These become shared classes in
  `crm-pages.scss` used by every CRM page.
The old CRM top tabs are removed.

### Dashboard (Kanban)
- New endpoint `GET api/crm/board?ownerUserId=` backed by `crm.sp_Lead_Board`: open leads with the
  card fields, `StatusSince` (latest status change from `crm.LeadStatusHistory`, else `CreatedAt`),
  latest quotation (no, status, grand total, sent date) and one flag per attention rule; plus a second
  result set with the counts per rule. Limit 500 cards; the response says when it was cut.
- Managers get an Owner filter (as the Leads list has). Columns scroll horizontally inside the board
  on a phone (one column wide at a time, snap scrolling); cards are reachable by touch drag.
- Each column header shows count and total quotation value of its cards.
- Card click opens the lead. A drop calls the existing status / lost dialogs and endpoints; on
  success the card moves and the counts refresh; on failure (rule rejected) it moves back and the
  server message is shown. The server stays the judge of what is allowed.
- The current "Today's and overdue follow-ups" list is replaced by the attention strip and badges.

### Leads list, lead form, lead detail, quotation editor, print, settings
Restyled with the shared classes. Leads list: on a phone each row becomes a card; lost/converted leads
do not show a next follow-up. Lead detail: header with status, attention badges and actions that wrap
on small screens; dialogs full-screen on a phone. Quotation editor: product column wide enough to read
the name; lines become stacked cards on a phone. No behaviour change.

### Quotations page
`GET api/crm/quotations` backed by `crm.sp_Quotation_List` (search by quotation no / lead / contact,
status filter, date range, paged). Row opens `/crm/quotations/:id`. The same data feeds the Quotation
register report.

### Reports
One Reports page with a tab per report, a shared filter bar (date range, owner for managers) and
Excel / PDF buttons. Each report: a summary row of figures, a simple bar visual where it helps, and
the table.

| Report | Shows | Source |
|---|---|---|
| Leads & follow-ups | existing | `sp_Report_FollowUps` |
| Sales conversion | existing (by source, owner, month) | `sp_Report_Conversion` |
| Pipeline | per open stage: leads, quotation value, average days in stage | new `sp_Report_Pipeline` |
| Source performance | per source: leads, converted, lost, open, conversion %, converted value | new `sp_Report_Sources` |
| Team performance | per owner: leads, follow-ups done, overdue now, converted, lost, converted value | new `sp_Report_Team` |
| Lost reasons | per reason: leads, % of lost, quotation value lost | new `sp_Report_LostReasons` |
| Quotation register | every quotation: no/rev, date, lead, status, grand total, age in days | `sp_Quotation_List` |

Excel: one sheet per report, header row bold and frozen, money columns as numbers with the Indian
format, file name `CRM-<report>-<from>-<to>.xlsx`. PDF: print page with company name, report title,
filters, table, printed-on line, A4 landscape where the table is wide.

## Left to the builder

- Exact visual styling, spacing and colours within the shared classes.
- Whether Source performance extends the existing conversion procedure or is separate.
- Card field order and how badges are drawn.
- Test cases: specs for the board (drop opens the dialog, cancel restores, failed change restores),
  attention filters, exports (exceljs mocked), and a responsive check (no sideways scroll at 375 px)
  using the E2E data already created (leads LD-0001..LD-0008, quotations QT-0001..QT-0005).
