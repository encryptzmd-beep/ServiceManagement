# Transaction toolbar for Sales Order and Quotation — design

Date: 2026-11-19 · Owner request. Sales Order is not used by Felix (owner), so it may change.

## Intent
ERP-style document screens: one toolbar — New, Edit, Save, Print, Cancel (void), Previous,
Next, Find — on the Sales Order and the CRM Quotation screens, with a search of earlier
documents that loads one into the same screen.

## Approaches
1. **One shared toolbar + one shared find dialog, wired by each screen (chosen).** Same look
   and keys everywhere; reusable for Despatch later.
2. A toolbar per screen: drifts apart. 3. Prev/Next from a list loaded in the browser: slow on big lists.

## Design
- Modes: **new** (blank, editable) · **view** (loaded, read-only) · **edit** (after Edit). Save
  returns to view. Unsaved changes → "Discard the changes?" before New/Prev/Next/Find load.
- Sales Order: editable only while `Billed` (as today); Save = save without despatch (the
  footer "Save & Despatch" stays); Cancel = existing `orders/{id}/cancel`, confirmed.
- Quotation: Draft → Edit unlocks; Sent → Edit means Revise (confirmed); Accepted, Superseded,
  Cancelled → no Edit. Cancel = status **Cancelled** (new), not for Accepted/Superseded; the
  existing lead-converted/lost refusal stays. Converting a cancelled quotation is already refused
  (only Draft/Sent convert).
- Prev/Next by id (numbers are sequential) within what the caller may see; disabled at the ends;
  from a new document, Previous = the latest.
- Find: dialog with text (number / customer) and date range over the existing list APIs; a row
  loads that document.
- SQL `EncryptzAPI/Database/ProjectDB/20_Transaction_Toolbar.sql` (after 19): CHECK on
  `crm.Quotations.Status` + `Cancelled`; `crm.sp_Quotation_SetStatus` copied from 16 with
  `Cancelled` allowed from Draft/Sent/Rejected; `crm.sp_Quotation_Neighbours` (latest revisions,
  same owner/location scope); `dbo.sp_SalesOrder_Neighbours`.
- API: `GET api/Sales/orders/{id}/neighbours`, `GET api/crm/quotations/{id}/neighbours` →
  `{ previousId, nextId }` (id 0 = from a new document).

## Constraints
- Scripts 14–19 frozen; owner runs 20. No commit unless asked. Felix: Sales Order unused; CRM is Hamster-only.

## Left to the builder
- Icons, keyboard shortcuts (optional), exact wording.
