# CRM Products, Manual Quotation and Convert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Category/product dropdowns on the lead form, a "New quotation" that creates its lead, and "Convert to sales order" on the quotation page.

**Architecture:** One new company-DB script (17) adds `crm.Leads.ProductMasterId`, a categories procedure, a category filter on product search, product on lead save/get, and three deferred report fixes. C# exposes them; the Angular lead form, quotations page and quotation editor use them; the convert dialog moves out of the lead page into a shared component.

**Tech Stack:** Angular 21.2 (standalone, signals, vitest), ASP.NET Core (.NET 10), SQL Server, xUnit.

**Spec:** `docs/superpowers/specs/2026-11-19-crm-products-quotation-convert-design.md`

## Global Constraints
- CRM only (crm-* components, CrmModels.ts, crm-service.ts, CrmController.cs, EncryptzBL/Infrastructure/Crm/*, CrmDtos.cs, EncryptzTests/Crm*, 17 script, EncryptzAPI.csproj, app.routes.ts CRM block). Never edit header/footer/sidebar components, DashboardStateService, or any non-CRM page.
- SQL: new file `EncryptzAPI/Database/ProjectDB/17_CRM_Product_Fixes.sql`; 14, 15, 16 are frozen (already run). Replaced procedures are copied from their latest definition with only the stated change. Do not run SQL.
- Every procedure keeps `@CompanyId, @UserId, @IsManager, @LocationId` scoping where it has it today.
- Look: shared classes in crm-pages.scss (Products-page look); no sideways scroll at 375 px.
- Never `git commit`; stage only.

## Review Focus
- Old lead with a free-text category not in the product master: edit keeps it (option shown) → Task 3 test `keeps an old category that is not in the list`.
- Category changed after a product was chosen: product cleared → Task 3 test `changing the category clears the product`.
- New quotation form saved twice quickly: only one lead → Task 4 test `saving twice creates one lead` (button disabled while saving).
- Convert on a quotation whose lead is New: button disabled with hint, no request → Task 5 test `convert is disabled until the quotation is sent`.
- Lead page convert still works after the dialog extraction → Task 5: existing lead-detail convert specs keep passing unchanged in behaviour.

---

### Task 1: SQL 17
**Files:** Create `EncryptzAPI/Database/ProjectDB/17_CRM_Product_Fixes.sql`; modify `EncryptzAPI/EncryptzAPI.csproj` (Content line after 16); test `EncryptzTests/CrmProductScriptTests.cs` (helpers like CrmBoardScriptTests).
**Interfaces (produces):** `crm.Leads.ProductMasterId INT NULL`; `crm.sp_Product_Categories @CompanyId INT` → `Category`; `crm.sp_Product_Search @CompanyId, @Search = NULL, @Top = 20, @Category NVARCHAR(100) = NULL` → previous columns + `HsnSac` (NULL when dbo.ProductMaster has no HSN column — check the column list in the service schema script `servicetenantDB.sql` or `New_Tenant_Database.sql` and use the real column if it exists); `crm.sp_Lead_Save` (+ `@ProductMasterId INT = NULL`); `crm.sp_Lead_Get` (+ `ProductMasterId`, `ProductName`); `crm.sp_Report_Sources` (ConversionPct `DECIMAL(7,1)`), `crm.sp_Report_Team` (follow-up branch `AND (@IsManager = 1 OR f.UserId = @UserId)`), `crm.sp_Lead_Board` (`SET @OwnerUserId = NULLIF(@OwnerUserId, 0);`).
- [ ] Tests first: header guards + no USE; guard requires 16 (`COL_LENGTH('crm.Quotations', 'SentAt')`); column added idempotently; categories proc filters `IsActive = 1` and non-empty, `DISTINCT`, `ORDER BY`; search has `@Category`; Lead_Save has `@ProductMasterId` and validates it against active `dbo.ProductMaster`; Lead_Get returns `ProductMasterId` and `ProductName` and keeps `ConvertNeedsCheck`; Sources has `DECIMAL(7,1)`; Team has `f.UserId = @UserId`; Board has `NULLIF(@OwnerUserId, 0)`; each replaced proc keeps its scope filter; csproj ships 17; `TenantScript.ParseFollowUp("17_CRM_Product_Fixes.sql", text).Batches` not empty. Run `dotnet test EncryptzTests --filter CrmProductScriptTests` → FAIL.
- [ ] Write the script; run `dotnet test EncryptzTests --filter Crm` → PASS. Stage.

### Task 2: API
**Files:** `EncryptzBL/DTO's/CrmDtos.cs`, `EncryptzBL/Infrastructure/Crm/{ICrmService.cs,CrmService.Leads.cs,CrmService.Quotations.cs or wherever product search lives}`, `EncryptzAPI/Controllers/CrmController.cs`, `EncryptzTests/CrmEndpointsTests.cs`.
**Interfaces:** `LeadSaveDto.ProductMasterId int?`; `LeadDetailDto.ProductMasterId int?`, `ProductName string?`; `CrmProductDto.HsnSac string?`; `SearchProducts(..., string? term, string? category)`; new `GetProductCategories(int userId, bool isManager, int companyId) : Task<ApiResponse<List<string>>>`; endpoints `GET api/crm/products?term=&category=` (extend) and `GET api/crm/product-categories`.
- [ ] Tests first (endpoint theory gains `GET product-categories`; a CrmRules/validation test if lead rules check ProductMasterId > 0). RED → implement → `dotnet test EncryptzTests --filter Crm` PASS. Stage.

### Task 3: Lead form dropdowns, lead page product, quotation prefill
**Files:** `Models/CrmModels.ts`, `Services/crm-service.ts(+spec)`, `crm-lead-form-component/*`, `crm-lead-detail-component/*` (product shown), `crm-quotation-component/*` (prefill first line when opened for a lead with a product and the quotation is new).
**Interfaces:** `CrmService.productCategories()`, `searchProducts(term?, category?)`; `LeadSaveDto.productMasterId`, `LeadDetailDto.productMasterId/productName`, `CrmProductDto.hsnSac`.
- [ ] Specs first: `lists the categories from the product master`, `lists the products of the chosen category`, `changing the category clears the product`, `keeps an old category that is not in the list`, `saves the chosen product`, lead detail `shows the product`, quotation `a new quotation for a lead with a product starts with that product` (name, rate = mrp, warranty). RED → implement → CRM specs + `npx ng build` PASS. Stage.

### Task 4: New quotation without a lead
**Files:** `crm-quotations-component/*` (button + form dialog or a small form component in the same folder), reuse the dropdowns from Task 3 (extract a tiny shared `crm-product-picker` component in `crm-shell-component/` if both forms need it — preferred over duplicating).
**Interfaces:** on save: `CrmService.saveLead({ contactName, mobile, city, productCategory, productMasterId, remarks: 'Created from a quotation', priority: 'Medium', ... })` → navigate `/crm/quotations/new?leadId=<id>`.
- [ ] Specs first: `New quotation opens the form`, `name and mobile are required`, `saving creates the lead and opens the quotation editor`, `saving twice creates one lead`, `a server refusal shows the message`. RED → implement → PASS. Stage.

### Task 5: Convert from the quotation page
**Files:** create `crm-shell-component/crm-convert-dialog-component.{ts,html,scss}`; modify `crm-lead-detail-component/*` (use it, no behaviour change) and `crm-quotation-component/*` (button + dialog).
**Interfaces:** dialog inputs `leadId`, `quotationId`, `quotations` (for the picker on the lead page), output `converted: ConvertResultDto`, `cancelled`; it owns `previewConvert` / `convert` / `linkOrder` calls exactly as the lead page does today (read `crm-lead-detail-component.ts` openConvert/confirmConvert and keep the same requests, messages and refusal handling).
- [ ] Specs first: quotation page `shows Convert to sales order for a draft or sent quotation`, `convert is disabled until the quotation is sent` (lead New → disabled + hint, no request), `confirming converts and shows the order number`; dialog spec for preview + confirm + refusal; lead-detail existing convert specs keep passing (update selectors only). RED → implement → all CRM specs + build PASS. Stage.

### Task 6: Verify
- [ ] `dotnet test EncryptzTests` and all CRM UI specs pass; `npx ng build` ok.
- [ ] Ask the user to run 17 on the Encryptz company DB.
- [ ] Playwright (read-only, non-GET blocked, every dialog cancelled): lead form at 3 widths shows category/product selects with data; Quotations page "New quotation" form opens (cancel); quotation editor of QT-0002 shows Convert enabled (lead Negotiation) and QT-0001's lead (Qualified) shows it disabled with the hint; no sideways scroll, no console/HTTP errors.
