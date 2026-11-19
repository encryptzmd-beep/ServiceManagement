# Staff complaint registration page and an attention-first complaints dashboard — design

Date: 2026-11-19 · Client driver: Hamster AC proposal §5.1 and §14; owner request (Felix and Hamster)

## Intent

1. Office staff register a complaint for a customer who phones in, from a back-office page.
   Today only the customer portal (as the signed-in customer) and the anonymous public
   quick-complaint page create complaints.
2. The complaints dashboard answers "what needs attention now?" first, keeps the important
   KPIs and their detail view, and has quick access to the new page. Applies to Felix too
   (owner's decision).

## Approaches

- Page: **a new staff page reusing `CustomerService.CreatePublicQuickComplaint` behind a
  back-office endpoint (chosen)** — same customer-by-mobile find-or-create, numbering and
  procedure as today, no SQL. A staff form with customer product pick needs new procedures
  (later, if wanted). Embedding the public page would post anonymously from inside the app.
- Dashboard: **rearrange the existing component (chosen)**: data, tiles and the tile detail
  view stay; only the order and look change. A rewrite would risk the detail view and panels.

## Design

### Page `/complaints/register` (roles Admin, CompanyAdmin, ServiceManager, Manager)
- API `StaffComplaintController` `api/staff-complaints`, `[Authorize(Roles = "Admin,CompanyAdmin,ServiceManager,Manager")]`, `[AppModule("SERVICE")]`:
  - `GET customer?mobile=` → `{ found, customerName, email }` via `CheckByMobile` (10-digit mobile after removing spaces/+91; otherwise 400 "Enter a valid 10-digit mobile number").
  - `POST` body = `PublicQuickComplaintRequest_Dto` → `CreatePublicQuickComplaint`; 400 with the message on failure; same mobile rule; subject required ("Enter the subject").
- UI: sections Customer (mobile → lookup on 10 digits; found: name shown; new: name required, email optional) and Complaint (category from `getComplaintCategories`, subject, brand, model, description, location text, one optional photo ≤ 5 MB jpg/png/webp as base64). Save disabled while saving; success card with the complaint number, "Register another" (clears) and "Go to dashboard".
- No menu row (sidebar menus live in MainDB); reached from the dashboard button.

### Dashboard
- Header: "+ Register Complaint" (to the page), existing Assign Technician, period select, Refresh.
- "Needs attention now" band from existing numbers, only non-zero items, most urgent first:
  SLA breached (red), New (orange), On hold (orange), Spare requests pending (amber),
  Today's schedules (blue). Each opens the same detail view as its tile. All zero → "All clear".
- KPI tiles below: In Progress, Work Completed, Warranty, Active Assignments, Total, Closed —
  click → existing detail view (unchanged code). Spare summary bar stays.
- Responsive: band wraps; no sideways scroll at 375 px.

## Constraints

- Felix: no change to existing APIs, procedures or the public page; dashboard data calls unchanged.
- Never `git commit`; stage only. No SQL.

## Left to the builder

- Exact colours/icons; tests: endpoint source/attribute tests, mobile rule unit test, page and
  attention-band vitest specs.
