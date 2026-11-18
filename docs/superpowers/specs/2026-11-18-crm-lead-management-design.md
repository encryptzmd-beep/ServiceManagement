# CRM application: Lead Management (phase 1) — design

Date: 2026-11-18 · Client driver: Hamster AC proposal, section 12 (Simple Lead Management) and 13 (Sales integration)

## 1. Intent

Hamster AC's sales team needs to track an enquiry from the first call, through
follow-ups and a quotation, to a sale. When the customer buys, the sale must land
in the **existing Sales Order** of the Service application, so the existing
Despatch → New Installation complaint → Warranty chain carries on with no second
entry.

The existing Service application is in live use by Felix. **Nothing in it may
change.** Lead Management is therefore a separate commercial application, the
"CRM" row that already sits in the catalogue as "Coming soon"
(`EncryptzAPI/Database/MainDB/21_Applications.sql`, key `CRM`), enabled per
company through `CompanyModules`. Only Hamster gets it.

## 2. Goals, non-goals, anti-goals

**Goals**
- Leads with the fields of proposal 12.1, a status flow with history (12.4).
- Follow-ups with next date and next action (12.3); a dashboard of what is due (12.2).
- Quotations made inside CRM: items, rate, discount, GST, revisions, print/PDF.
- Convert a quotation into a Sales Order of the existing module, with the customer
  matched or created, and the lead linked to the order.
- Sales users see their own leads; CRM managers see and reassign all.
- Lead and conversion reports (proposal section 15).

**Non-goals (phase 1)**
- Public enquiry form / customer-created leads (needs OTP; SMS not available).
- SMS or WhatsApp anything. Reminders are in-app only.
- Scheduled reminder pushes (a background job). Due follow-ups show on the dashboard.
- Editing a Sales Order from CRM, or any change to Sales Order, Despatch or Customer screens.

**Anti-goals (a failure even if it works)**
- Any change to an existing table, procedure, screen or menu of the Service
  application, or anything Felix's users would see differently. One exception is
  in section 10 and needs the owner's OK.
- A sale typed twice: lines must flow quotation → order untouched.
- A sales user seeing another sales user's leads.

## 3. Constraints

- Follow the Job Consultancy pattern: company database, own schema, every row
  carries `CompanyId`, every procedure takes `@CompanyId` first and filters by it
  (`EncryptzAPI/Database/ProjectDB/11_Consultancy.sql`).
- SQL changes are new numbered files; existing SQL files are never edited.
  This work adds `ProjectDB/14_CRM.sql` (additive, safe to re-run, same guard
  block as script 11) and a MainDB script for the catalogue row (section 10).
  `New_Tenant_Database.sql` / `Build-NewTenantScript.ps1` pick up 14 the same way
  they pick up 11.
- The live SQL server: run scripts only on databases the owner names.
- No git commits; leave changes staged.
- Branch (Location) access applies as in the Service app (`BranchAccessRules`).

## 4. Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| A | **Separate CRM app; convert inside CRM** — a "Convert to Sale" dialog; the server calls the existing `SalesService.SaveCustomer` / `SaveOrder` | No change to existing code; the user confirms in a CRM dialog, not the familiar bill screen | **Chosen** by the owner |
| B | Separate CRM app; convert by opening the existing `sales-order-entry` screen pre-filled | Familiar screen, but that live component must learn pre-fill and lead linking | Rejected: changes a screen Felix uses |
| C | Lead menu inside the Service app; quotations as a "Quotation" status on `SalesOrders` | Fewer new tables, but changes the live menu, table and order list | Rejected: touches Felix |

Quotation as a status only (no document) was also considered and rejected by the
owner: rates are negotiated and revised, and the proposal asks for no duplicate entry.

## 5. Data (ProjectDB/14_CRM.sql, schema `crm`)

All tables: `CompanyId INT NOT NULL`, audit columns where useful (`CreatedBy`,
`CreatedAt`, `UpdatedAt`), `IsActive BIT` on masters.

| Table | Purpose / key columns |
|---|---|
| `crm.Members` | Who is on the sales team. `UserId`, `IsManager BIT`, `IsActive`. A company admin (`ModuleAccess.IsCompanyAdminRole`) is always treated as a manager. |
| `crm.LeadSources` | Editable master. Seed: Walk-in, Phone Call, Website, Referral, Dealer, Social Media, Existing Customer, Other. |
| `crm.LostReasons` | Editable master. Seed: Price, Bought Elsewhere, Not Interested, No Response, Other. |
| `crm.Leads` | `LeadId`, `LeadNo` (`LD-0001`, per company), `LeadDate`, `ContactName`, `Mobile`, `Email`, `Address`, `City`, `State`, `PinCode`, `Landmark`, `LeadSourceId`, `ProductCategory`, `ModelRequirement`, `EstimatedQty`, `ExpectedPurchaseDate`, `OwnerUserId` (sales person), `Priority` (Low/Medium/High), `Status`, `LostReasonId`, `LostNote`, `NextFollowUpAt` (copy of the latest follow-up's next date, for the dashboard), `CustomerId` NULL, `SalesOrderId` NULL, `ConvertedAt`, `Remarks`, `LocationId`. |
| `crm.LeadStatusHistory` | `LeadId`, `FromStatus`, `ToStatus`, `ChangedBy`, `ChangedAt`, `Note`. Also records owner changes (`Note` = "Reassigned from X to Y"). |
| `crm.FollowUps` | `FollowUpId`, `LeadId`, `FollowUpAt`, `Type` (Phone Call, Meeting, Site Visit, WhatsApp, Email, Other — text, logged by hand), `Notes`, `NextFollowUpAt`, `NextAction`, `UserId`, `Remarks`. |
| `crm.Quotations` | `QuotationId`, `LeadId`, `QuotationNo` (`QT-0001`), `RevisionNo` (1, 2, …), `QuoteDate`, `ValidUntil`, `IsInterState`, `SubTotal`, `DiscountTotal`, `TaxableTotal`, `CGST`, `SGST`, `IGST`, `GrandTotal`, `Terms`, `Status` (Draft, Sent, Accepted, Rejected, Superseded). |
| `crm.QuotationItems` | Same fields as `SalesOrderItemSaveDto`: `ProductMasterId`, `ProductName`, `HsnSac`, `Qty`, `Rate`, `DiscountAmount`, `GstPercent`, `WarrantyMonths`, plus computed `TaxableAmount`, `GstAmount`, `LineTotal`, `SortOrder`. |

`crm.Leads.CustomerId` / `SalesOrderId` point at `dbo.Customers` / `dbo.SalesOrders`
by value. No foreign key is added to those tables and nothing is written to them
except through the existing procedures (section 7).

## 6. Behaviour

**Lead status flow**: New → Contacted → Qualified → Quotation → Negotiation → Converted;
Lost from any open status. Every change writes `LeadStatusHistory`.
- Automatic moves *(builder's call, keep or drop)*: the first follow-up moves New → Contacted;
  marking a quotation Sent moves the lead to Quotation if it is earlier in the flow;
  convert sets Converted.
- Lost needs a lost reason. Converted and Lost leads are read-only; a manager may
  reopen a Lost lead (back to its previous status).

**Follow-ups**: adding one sets `Leads.NextFollowUpAt` to its next date (or NULL
if none). "Today" / "Overdue" use that column and the company's local date.

**Quotations**: one lead may have several quotations; each has revisions. "Revise"
copies the latest revision to `RevisionNo + 1` as Draft and marks the old one
Superseded. Only Draft can be edited. GST: intra-state CGST+SGST split, inter-state
IGST, the same as the Sales Order screen; the convert re-runs the order proc, which
recomputes totals, so a rounding difference is fixed by the order, not by CRM.
Print/PDF: a print-friendly page (browser print to PDF), company name/address
from the company record.

**Access**
- CRM app opened only by users granted the module (existing `ModuleAccess`).
- A sales user lists, opens and edits only leads where `OwnerUserId` = self.
- A manager sees all, filters by owner, reassigns (writes history, notifies the new owner).
- Branch scope: a user sees leads of the locations they have access to.
- The rule lives in the procedures (pass `@UserId`, `@IsManager`), not only in the UI.

**Notifications (in-app, existing `INotificationService`)**: lead assigned or
reassigned → the new owner. Nothing else in phase 1.

## 7. Convert to Sale

From a lead in status Quotation or Negotiation with a non-superseded quotation
revision. The CRM "Convert to Sale" dialog shows: the customer match (below),
order date (today), payment mode, the quotation lines and totals, and a Confirm button.

On Confirm, `CrmService.Convert` (server):
1. Refuses if the lead already has `SalesOrderId` (no second order).
2. Customer: `SalesService.SearchCustomers(mobile)`. If exactly one customer has the
   same mobile, use it (the dialog showed it). Otherwise `SalesService.SaveCustomer`
   with the lead's name, mobile, email and address. If several match, the dialog
   lets the user pick one.
3. `SalesService.SaveOrder` with the customer, the quotation lines unchanged,
   `ReferenceNo` = quotation number + revision, `Notes` = "From lead LD-xxxx",
   billing address from the lead, `IsInterState` from the quotation.
4. Writes `CustomerId`, `SalesOrderId`, `ConvertedAt`, status Converted, marks
   the quotation Accepted.

Steps 2–4 cross two services, so they are not one transaction. If step 4 fails
after the order exists, the order number is shown and logged, and a manager can
"Link existing order" on the lead (enter the order number). The builder may
narrow this window further.

After conversion the lead shows the order number. Despatch and the installation
complaint happen in the existing Sales screens, unchanged.

## 8. Screens (Angular, routes under `/crm`, like `/consultancy`)

- `/crm/dashboard`: counts for New, Follow-up Pending, Today's Follow-ups,
  Overdue, Qualified, Quotation Pending (Quotation + Negotiation), Converted
  (this month), Lost (this month). Each opens the filtered list. Below that, a
  list of today's and overdue follow-ups.
- `/crm/leads`: list with search, status, source, owner (managers), date range.
- `/crm/leads/new`, `/crm/leads/:id`: details; a timeline of follow-ups and status
  changes; a Quotations tab; actions: Add follow-up, Change status, Mark lost,
  Reassign (manager), New quotation, Convert to Sale.
- `/crm/quotations/:id`: editor (product picker from `ProductMaster`, like the
  Sales Order screen) and a print view.
- `/crm/settings` (managers): lead sources, lost reasons, team members and managers.
- `/crm/reports`: Lead & Follow-up report; Sales Conversion report (by source,
  by owner, by month: leads, converted, conversion %, converted value).

Mobile-responsive; desktop first.

## 9. API

New `CrmController` (`api/crm`, `[Authorize]`), new `EncryptzBL/Infrastructure/Crm`
(`ICrmService`, `CrmService`, DTOs in `CrmDtos.cs`), registered in `SrvInjection`.
`CrmService` takes `ISalesService` for the convert. Pattern as `ConsultancyController`:
company from the token, refusals as 403.

## 10. Release (approved by the owner 2026-11-18)

A MainDB numbered script sets the `CRM` row `IsReleased = 1` (and `Family`).
**Effect on Felix:** in Felix's catalogue/workspace the CRM card stops showing
"Coming soon" and becomes subscribable, but stays off, because Felix has no
`CompanyModules` row for it. Hamster is then enabled from Platform Admin.

## 11. Left to the builder

- Exact column sizes, indexes, number formats; reuse of the Sales Order line
  editor's look in the quotation editor (copy, do not share/modify the component).
- Whether the automatic status moves in section 6 stay.
- Tests: `EncryptzTests` for the access rule (own vs manager), status rules,
  revision copy and convert guards (already converted, missing quotation).
