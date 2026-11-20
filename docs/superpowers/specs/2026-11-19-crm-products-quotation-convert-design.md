# CRM: product dropdowns, quotation without a lead, convert from the quotation page

Date: 2026-11-19 · Module: CRM only · Follows `2026-11-18-crm-redesign-design.md` (same look, same rules)

## Intent
The owner asked, after using the redesigned CRM: "product and category should be from drop down. need
manual quotation entry, convert to sales order option". Clarified answers: (1) dropdowns on the lead form —
category, then product of that category, both from the product master; (2) "manual quotation" = a quotation
started without first creating a lead; (3) convert to sales order also from the quotation page.

## Goals
1. **Lead form dropdowns.** "Product category" becomes a select of the active product-master categories.
   A new "Product" select lists the active products of the chosen category (changing the category clears
   the product). "Model / requirement" stays as free text. A lead whose saved category is not in the list
   (old free-text value) still shows it as a selectable option, so nothing is lost on edit.
   The chosen product is stored on the lead (`ProductMasterId`) and shown on the lead page. A new quotation
   opened from such a lead starts with that product on its first line (name, HSN if known, rate = MRP,
   warranty months), still editable.
2. **New quotation without a lead.** The Quotations page gets a red "New quotation" button. It opens a small
   form: contact name *, mobile *, city, product category, product (same dropdowns). Save creates a lead
   through the existing lead save (owner = the current user, status New, remark "Created from a quotation")
   and opens the quotation editor for it (`/crm/quotations/new?leadId=<id>`), with the product prefilled as in 1.
   The lead appears on the board and in reports like any other.
3. **Convert from the quotation page.** The quotation editor shows "Convert to sales order" for a Draft or Sent
   quotation of an open lead. It opens the same convert dialog the lead page uses (customer match, order date,
   payment mode, confirm), extracted into a shared component used by both pages; the rules and API calls do not
   change. When the lead is not in Quotation or Negotiation the button is disabled with the hint
   "Mark the quotation as sent first". After a successful convert the page shows the order number and links to
   the lead.

## Non-goals
No change to the convert rules, the sales-order module, Service Management, or any non-CRM page. No quotation
without any lead in the database (every quotation keeps a lead). No SMS/e-mail.

## Database (new file `EncryptzAPI/Database/ProjectDB/17_CRM_Product_Fixes.sql`, user runs it; 14/15/16 frozen)
- `crm.Leads.ProductMasterId INT NULL` (idempotent add).
- `crm.sp_Product_Categories @CompanyId` → distinct non-empty `Category` of active `dbo.ProductMaster`, sorted.
- `crm.sp_Product_Search` replaced: adds `@Category NVARCHAR(100) = NULL` (exact match when given) and returns
  `HsnSac` if the product master has such a column, else NULL; everything else as in 14.
- `crm.sp_Lead_Save` replaced (from 14's text): adds `@ProductMasterId INT = NULL`, saved on insert/update
  (NULLIF 0; must be an active product, else saved as NULL).
- `crm.sp_Lead_Get` replaced (from 15's text): also returns `ProductMasterId` and `ProductName`
  (join `dbo.ProductMaster`).
- Deferred fixes from the redesign review, folded in: `crm.sp_Report_Sources` ConversionPct as `DECIMAL(7,1)`;
  `crm.sp_Report_Team` follow-up branch adds `AND (@IsManager = 1 OR f.UserId = @UserId)`;
  `crm.sp_Lead_Board` treats `@OwnerUserId = 0` as all (`NULLIF`). Each replaced procedure is copied from its
  latest definition (16 for these three) with only that change.
- Same header/guards style as 16, plus a guard that 16 ran (`COL_LENGTH('crm.Quotations','SentAt')`).
  One Content line in `EncryptzAPI.csproj`.

## Approach
Only one sensible way: reuse the existing lead save, product search, quotation editor and convert flow; add
the smallest SQL (one column, one list procedure, parameters) and extract the convert dialog so two pages share
it. Alternatives rejected: a quotation table without a lead (breaks board, reports and convert, which all hang
off the lead); a separate convert implementation on the quotation page (two copies of a money-moving flow).

## Constraints
Same as the redesign: CRM only, look of the Products page, no sideways scroll at 375 px, never git commit
(stage only), SQL as a new numbered file the user runs.
