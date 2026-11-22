import { UppercaseInputDirective } from '../shared/uppercase-input';
import { ProductFormComponent, ProductFormResult } from '../product-form-component/product-form-component';
import { AppToastComponent } from '../app-toast-component/app-toast-component';
import { AppRightDirective } from '../shared/app-right/app-right';
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { ApiService } from '../../Services/API/api-service';
import { AutocompleteComponent } from '../autocomplete-component/autocomplete-component';
import { salesProductOptions } from './sales-product-options';
import { TransactionMode, TransactionToolbarComponent } from '../shared/transaction-toolbar/transaction-toolbar';
import { FindQuery, FindRow, TransactionFindComponent } from '../shared/transaction-toolbar/transaction-find';
import { SalesDocumentsComponent } from '../shared/sales-documents/sales-documents';
import { DocumentPrintComponent, PrintCompany, PrintDocument, printCompanyOf, printLineDetails } from '../shared/document-print/document-print';
import { DocumentPdfService, documentFileName } from '../shared/document-print/document-pdf';
import { RightsService } from '../../Services/rights-service';
import { DialogService } from '../../Services/dialog-service';
import { AuthService } from '../../Auth/auth-service';
import { isEmailOrBlank, isPinOrBlank, normalizeMobile, statusText } from '../shared/sales-input-rules';
import {
  INDIAN_STATES, ProductMasterDTO, SALES_GST_RATES, SALES_PAYMENT_MODES,
  SalesCustomer, SalesCustomerSave, SalesOrderDetail, SalesOrderItemSave, SalesOrderSave,
} from '../../Models/ApiModels';

/** One bill line on the screen (amounts are recomputed by the API on save). */
interface BillLine {
  salesOrderItemId: number;
  productMasterId: number | null;
  productName: string;
  brand?: string | null;
  model?: string | null;
  hsnSac: string;
  qty: number;
  rate: number;
  discountAmount: number;
  gstPercent: number;
  warrantyMonths: number;
  /** from the product master, for the print */
  productDescription?: string | null;
  mrp?: number | null;
  /** after despatch */
  serialNumbers?: string | null;
  warrantyEndDate?: string | null;
}

@Component({
  selector: 'app-sales-order-entry',
  standalone: true,
  imports: [UppercaseInputDirective, ProductFormComponent, AppToastComponent, AppRightDirective, CommonModule, FormsModule, RouterModule, AutocompleteComponent, TransactionToolbarComponent, TransactionFindComponent, SalesDocumentsComponent, DocumentPrintComponent],
  templateUrl: './sales-order-entry-component.html',
  styleUrls: ['./sales-order-entry-component.scss'],
})
export class SalesOrderEntryComponent implements OnInit {
  readonly statusText = statusText;
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private dialog = inject(DialogService);
  private pdf = inject(DocumentPdfService);
  readonly rights = inject(RightsService);

  readonly paymentModes = SALES_PAYMENT_MODES;
  readonly gstRates = SALES_GST_RATES;
  readonly states = INDIAN_STATES;

  // ── bill header ──
  salesOrderId = signal(0);
  orderNo = signal('');
  status = signal('Billed');
  orderDate = this.todayInput();
  paymentMode = 'Cash';
  paymentDueDate = '';
  referenceNo = '';
  contactNumber = '';
  gstin = '';
  billingAddress = '';
  city = '';
  state = 'Kerala';
  pinCode = '';
  isInterState = false;
  notes = '';
  /** This bill's own copy; a new bill starts from Print Settings. */
  terms = '';
  warrantyText = '';

  // ── customer ──
  customer = signal<SalesCustomer | null>(null);
  customerSearch = '';
  customerResults = signal<SalesCustomer[]>([]);
  customerDropdownOpen = signal(false);
  /** The Customer Details card is folded to its header; its fields keep their values. */
  customerCollapsed = signal(false);
  searchingCustomers = signal(false);
  private customerSearch$ = new Subject<string>();

  // new / edit customer panel
  customerPanelOpen = signal(false);
  customerPanelMode = signal<'new' | 'edit'>('new');
  savingCustomer = signal(false);
  customerForm: SalesCustomerSave = this.blankCustomer();
  customerFormError = signal('');

  // ── products ──
  products = signal<ProductMasterDTO[]>([]);
  /** The products as autocomplete choices, each with its rate. */
  productOptions = computed(() => salesProductOptions(this.products()));
  lines = signal<BillLine[]>([]);

  // ── despatch info of a saved bill ──
  detail = signal<SalesOrderDetail | null>(null);

  // ── print (Settings > Print) ──
  printSettings = signal<Record<string, string>>({});
  /** What the sheet prints; built when Print is pressed, from the bill as it stands. */
  printDoc = signal<PrintDocument | null>(null);

  // ── ui state ──
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  toast = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  isNew = computed(() => this.salesOrderId() === 0);

  // ── toolbar (New · Edit · Save · Print · Cancel · Previous · Next · Find) ──
  /** An existing bill opens read-only; Edit unlocks it. */
  editing = signal(false);
  mode = computed<TransactionMode>(() => this.isNew() ? 'new' : this.editing() ? 'edit' : 'view');
  /** The fields can be changed now: a Billed bill that is new or being edited. */
  isEditable = computed(() => this.status() === 'Billed' && this.mode() !== 'view');
  canEditBill = computed(() => !this.isNew() && this.status() === 'Billed');
  /** Only a bill not yet despatched can be cancelled (as sp_SalesOrder_Cancel decides). */
  canCancelBill = computed(() => !this.isNew() && this.status() === 'Billed');
  neighbours = signal<{ previousId: number | null; nextId: number | null }>({ previousId: null, nextId: null });
  findOpen = signal(false);
  findRows = signal<FindRow[]>([]);
  findLoading = signal(false);
  /** The form as last loaded or saved: a change from it is unsaved work. */
  private savedSnapshot = '';

  // ── totals (same arithmetic as sp_SalesOrder_Save) ──
  private isInterStateSig = signal(false);
  // a value Save would refuse counts as nothing, so no negative total shows while typing
  subTotal = computed(() => this.lines().reduce((s, l) => s + Math.max(0, this.num(l.qty)) * Math.max(0, this.num(l.rate)), 0));
  discountTotal = computed(() => this.lines().reduce((s, l) => s + Math.min(Math.max(0, this.num(l.discountAmount)), Math.max(0, this.num(l.qty)) * Math.max(0, this.num(l.rate))), 0));
  taxableTotal = computed(() => this.lines().reduce((s, l) => s + this.lineNet(l), 0));
  gstTotal = computed(() => this.lines().reduce((s, l) => s + this.lineGst(l), 0));
  cgst = computed(() => this.isInterStateSig() ? 0 : this.round2(this.gstTotal() / 2));
  sgst = computed(() => this.isInterStateSig() ? 0 : this.round2(this.gstTotal() - this.round2(this.gstTotal() / 2)));
  igst = computed(() => this.isInterStateSig() ? this.round2(this.gstTotal()) : 0);
  grandTotal = computed(() => this.round2(this.taxableTotal() + this.gstTotal()));

  ngOnInit(): void {
    this.customerSearch$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => this.runCustomerSearch(term));

    this.api.getProductMasterList(undefined, 500).subscribe({
      next: r => this.products.set((r?.data ?? []).filter(p => p.isActive !== false)),
      error: () => this.products.set([]),
    });

    const id = Number(this.route.snapshot.paramMap.get('id') || 0);

    this.api.getSalesSettings().subscribe({
      next: r => {
        const s = r?.data ?? {};
        this.printSettings.set(s);
        // Settings > Sales: IGST ticked by default on a NEW bill
        if (id === 0 && this.salesOrderId() === 0) {
          const untouched = !this.isDirty();
          this.isInterState = ['true', '1', 'yes'].includes((s['Sales.DefaultInterState'] || '').trim().toLowerCase());
          this.isInterStateSig.set(this.isInterState);
          // never over what the person has typed meanwhile
          this.terms = this.terms || (s['Print.Terms'] || '');
          this.warrantyText = this.warrantyText || (s['Print.Warranty'] || '');
          if (untouched) this.markSaved();   // the default is not a change of the user
        }
      },
      error: () => this.printSettings.set({}),
    });

    if (id > 0) {
      this.load(id);
    } else {
      this.resetNew();
    }
  }

  // =====================================================================
  // toolbar
  // =====================================================================
  /** Everything that a save would send, to tell unsaved work. */
  private snapshot(): string {
    return JSON.stringify([this.orderDate, this.paymentMode, this.paymentDueDate, this.referenceNo, this.contactNumber, this.gstin, this.billingAddress,
      this.city, this.state, this.pinCode, this.isInterState, this.notes, this.terms, this.warrantyText, this.customer()?.customerId ?? null,
      this.lines().map(l => [l.productMasterId, l.productName, l.hsnSac, l.qty, l.rate, l.discountAmount, l.gstPercent, l.warrantyMonths])]);
  }

  private markSaved(): void { this.savedSnapshot = this.snapshot(); }

  isDirty(): boolean { return this.mode() !== 'view' && this.snapshot() !== this.savedSnapshot; }

  /** Runs the action, after "Discard the changes?" when there is unsaved work. */
  private async leave(action: () => void): Promise<void> {
    if (this.isDirty() && !(await this.dialog.confirm({ message: 'Discard the changes to this bill?', kind: 'danger', okText: 'Discard' }))) return;
    action();
  }

  private loadNeighbours(id: number): void {
    this.api.getSalesOrderNeighbours(id).subscribe({
      next: r => this.neighbours.set({ previousId: r?.data?.previousId ?? null, nextId: r?.data?.nextId ?? null }),
      error: () => this.neighbours.set({ previousId: null, nextId: null }),
    });
  }

  /** A blank bill, as a new page shows it. */
  /** What the folded Customer Details header shows. */
  customerSummary(): string {
    return [this.customer()?.customerName, this.contactNumber, this.city].filter(Boolean).join(' · ');
  }

  private resetNew(): void {
    this.customerCollapsed.set(false);
    this.salesOrderId.set(0); this.orderNo.set(''); this.status.set('Billed'); this.detail.set(null);
    this.editing.set(false); this.error.set('');
    this.orderDate = this.todayInput(); this.paymentMode = 'Cash'; this.paymentDueDate = ''; this.referenceNo = ''; this.contactNumber = '';
    this.gstin = ''; this.billingAddress = ''; this.city = ''; this.state = 'Kerala'; this.pinCode = ''; this.notes = '';
    this.terms = this.printSettings()['Print.Terms'] || '';
    this.warrantyText = this.printSettings()['Print.Warranty'] || '';
    this.isInterState = ['true', '1', 'yes'].includes((this.printSettings()['Sales.DefaultInterState'] || '').trim().toLowerCase());
    this.isInterStateSig.set(this.isInterState);
    this.customer.set(null);
    this.lines.set([]);
    this.addLine();
    this.api.getNextSalesOrderNumber().subscribe({
      next: r => this.orderNo.set(r?.data || ''),
      error: () => this.orderNo.set(''),
    });
    this.loadNeighbours(0);
    this.markSaved();
  }

  /** Opens a bill in this screen (the route is reused, so it loads by itself). */
  private open(id: number): void {
    const onIdRoute = !!this.route.snapshot.paramMap.get('id');
    // replace the address: the screen is reused, so Back must not show another bill under this one's address
    this.router.navigate(['/sales/orders', id], { replaceUrl: onIdRoute });
    if (onIdRoute) this.load(id);
  }

  onNew(): void {
    this.leave(() => this.isNew() ? this.resetNew() : this.router.navigate(['/sales/orders/new']));
  }

  onEdit(): void { if (this.canEditBill()) this.editing.set(true); }

  onDiscard(): void { this.leave(() => this.load(this.salesOrderId())); }

  onSave(): void { this.save(false); }

  onPrevious(): void { const id = this.neighbours().previousId; if (id) this.leave(() => this.open(id)); }

  onNext(): void { const id = this.neighbours().nextId; if (id) this.leave(() => this.open(id)); }

  async onCancelBill(): Promise<void> {
    const id = this.salesOrderId();
    if (!id) return;
    const ok = await this.dialog.confirm({
      message: `Cancel bill ${this.orderNo()}? It cannot be used again.`, kind: 'danger', okText: 'Cancel bill', cancelText: 'Keep it',
    });
    if (!ok) return;
    this.saving.set(true);
    this.api.cancelSalesOrder(id).subscribe({
      next: r => {
        this.saving.set(false);
        if (r?.success === false) { this.showToast('error', r.message || 'The bill could not be cancelled'); return; }
        this.showToast('success', r?.message || `Bill ${this.orderNo()} cancelled`);
        this.load(id);
      },
      error: e => { this.saving.set(false); this.showToast('error', e?.error?.message || 'The bill could not be cancelled'); },
    });
  }

  onFind(): void { this.findRows.set([]); this.findOpen.set(true); }

  onFindSearch(q: FindQuery): void {
    this.findLoading.set(true);
    this.api.getSalesOrders({ searchTerm: q.term || undefined, fromDate: q.from || undefined, toDate: q.to || undefined, pageNumber: 1, pageSize: 30 })
      .subscribe({
        next: r => {
          this.findLoading.set(false);
          this.findRows.set((r?.items ?? []).map(o => ({
            id: o.salesOrderId, number: o.orderNo, date: o.orderDate, party: o.customerName, amount: o.grandTotal, status: o.status,
          })));
        },
        error: () => { this.findLoading.set(false); this.findRows.set([]); },
      });
  }

  onFindPick(id: number): void {
    this.findOpen.set(false);
    if (id !== this.salesOrderId()) this.leave(() => this.open(id));
  }

  // =====================================================================
  // load an existing bill
  // =====================================================================
  load(id: number): void {
    this.loading.set(true);
    this.api.getSalesOrder(id).subscribe({
      next: r => {
        this.loading.set(false);
        if (!r?.success || !r.data) { this.error.set(r?.message || 'Bill not found'); return; }
        const d = r.data;
        this.detail.set(d);
        const o = d.order;
        this.salesOrderId.set(o.salesOrderId);
        this.orderNo.set(o.orderNo);
        this.status.set(o.status);
        this.orderDate = this.toDateInput(o.orderDate);
        this.paymentMode = o.paymentMode || 'Cash';
        this.paymentDueDate = o.paymentDueDate ? this.toDateInput(o.paymentDueDate) : '';
        this.referenceNo = o.referenceNo || '';
        this.contactNumber = o.contactNumber || '';
        this.gstin = o.gstin || '';
        this.billingAddress = o.billingAddress || '';
        this.city = o.city || '';
        this.state = o.state || '';
        this.pinCode = o.pinCode || '';
        this.isInterState = !!o.isInterState;
        this.isInterStateSig.set(this.isInterState);
        this.notes = o.notes || '';
        this.terms = o.terms || '';
        this.warrantyText = o.warrantyText || '';
        this.customer.set({
          customerId: o.customerId, customerName: o.customerName, mobileNumber: o.customerMobile || '',
          email: o.customerEmail, address: o.billingAddress, city: o.city, state: o.state, pinCode: o.pinCode, gstin: o.gstin,
        });
        this.lines.set(d.items.map(i => ({
          salesOrderItemId: i.salesOrderItemId,
          productMasterId: i.productMasterId ?? null,
          productName: i.productName,
          brand: i.brand, model: i.model,
          hsnSac: i.hsnSac || '',
          qty: i.qty, rate: i.rate, discountAmount: i.discountAmount, gstPercent: i.gstPercent,
          warrantyMonths: i.warrantyMonths,
          productDescription: i.productDescription, mrp: i.mrp,
          serialNumbers: i.serialNumbers, warrantyEndDate: i.warrantyEndDate,
        })));
        // a loaded bill opens read-only; Edit unlocks it
        this.editing.set(false);
        this.error.set('');
        this.markSaved();
        this.loadNeighbours(o.salesOrderId);
      },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message || 'Could not load the bill'); },
    });
  }

  // =====================================================================
  // customer picker
  // =====================================================================
  onCustomerSearch(term: string): void {
    this.customerSearch = term;
    this.customerDropdownOpen.set(true);
    this.customerSearch$.next(term.trim());
  }

  openCustomerDropdown(): void {
    this.customerDropdownOpen.set(true);
    if (!this.customerResults().length) this.runCustomerSearch(this.customerSearch.trim());
  }

  closeCustomerDropdownLater(): void {
    setTimeout(() => this.customerDropdownOpen.set(false), 180);
  }

  private runCustomerSearch(term: string): void {
    this.searchingCustomers.set(true);
    this.api.searchSalesCustomers(term || undefined, 30).subscribe({
      next: r => { this.searchingCustomers.set(false); this.customerResults.set(r?.data ?? []); },
      error: () => { this.searchingCustomers.set(false); this.customerResults.set([]); },
    });
  }

  selectCustomer(c: SalesCustomer): void {
    this.customer.set(c);
    this.customerSearch = '';
    this.customerDropdownOpen.set(false);
    this.error.set('');
    // billing details from the master; the bill can still change them
    this.contactNumber = c.mobileNumber || '';
    this.gstin = c.gstin || '';
    this.billingAddress = c.address || '';
    this.city = c.city || '';
    this.state = c.state || this.state;
    this.pinCode = c.pinCode || '';
  }

  /** The customer master has a mapped position (set from a complaint / the customer portal). */
  hasLocation(c: SalesCustomer | null | undefined): boolean {
    return !!c && c.latitude !== null && c.latitude !== undefined && c.longitude !== null && c.longitude !== undefined
      && !(Number(c.latitude) === 0 && Number(c.longitude) === 0);
  }

  mapsUrl(c: SalesCustomer): string {
    return `https://www.google.com/maps?q=${c.latitude},${c.longitude}`;
  }

  clearCustomer(): void {
    if (!this.isEditable()) return;
    this.customer.set(null);
    this.contactNumber = ''; this.gstin = ''; this.billingAddress = ''; this.city = ''; this.pinCode = '';
  }

  openNewCustomer(): void {
    this.customerPanelMode.set('new');
    this.customerForm = this.blankCustomer();
    // a search term that looks like a phone number is probably the new customer's mobile
    const t = this.customerSearch.trim();
    if (/^\+?[\d\s-]{6,}$/.test(t)) this.customerForm.mobileNumber = t;
    else if (t) this.customerForm.customerName = t;
    this.customerForm.state = this.state || 'Kerala';
    this.customerFormError.set('');
    this.customerDropdownOpen.set(false);
    this.customerPanelOpen.set(true);
  }

  openEditCustomer(): void {
    const c = this.customer();
    if (!c) return;
    this.customerPanelMode.set('edit');
    this.customerForm = {
      customerId: c.customerId, customerName: c.customerName, mobileNumber: c.mobileNumber,
      alternatePhone: c.alternatePhone || '', email: c.email || '', address: c.address || '',
      city: c.city || '', state: c.state || '', pinCode: c.pinCode || '', landmark: c.landmark || '', gstin: c.gstin || '',
    };
    this.customerFormError.set('');
    this.customerPanelOpen.set(true);
  }

  closeCustomerPanel(): void { this.customerPanelOpen.set(false); }

  saveCustomer(): void {
    const f = this.customerForm;
    if (!f.customerName?.trim()) { this.customerFormError.set('Customer name is required'); return; }
    const mobile = normalizeMobile(f.mobileNumber);
    if (!mobile) { this.customerFormError.set('Enter a valid 10-digit mobile number'); return; }
    if (!isEmailOrBlank(f.email)) { this.customerFormError.set('Enter a valid e-mail address'); return; }
    if (!isPinOrBlank(f.pinCode)) { this.customerFormError.set('PIN code must be 6 digits'); return; }
    if (f.gstin && f.gstin.trim() && !/^[0-9A-Z]{15}$/i.test(f.gstin.trim())) { this.customerFormError.set('GSTIN must be 15 characters'); return; }

    this.savingCustomer.set(true);
    this.customerFormError.set('');
    this.api.saveSalesCustomer({ ...f, mobileNumber: mobile, gstin: f.gstin?.trim().toUpperCase() || null }).subscribe({
      next: r => {
        this.savingCustomer.set(false);
        if (!r?.success || !r.data) { this.customerFormError.set(r?.message || 'Could not save the customer'); return; }
        const saved = r.data.customer ?? {
          customerId: r.data.customerId, customerName: f.customerName, mobileNumber: f.mobileNumber,
          email: f.email, address: f.address, city: f.city, state: f.state, pinCode: f.pinCode, gstin: f.gstin,
        };
        this.selectCustomer(saved);
        this.customerPanelOpen.set(false);
        this.showToast('success', r.data.isNew ? 'Customer added to the customer master' : 'Customer master updated');
      },
      error: e => { this.savingCustomer.set(false); this.customerFormError.set(e?.error?.message || 'Could not save the customer'); },
    });
  }

  // =====================================================================
  // bill lines
  // =====================================================================
  addLine(): void {
    if (!this.isEditable()) return;
    this.lines.update(ls => [...ls, {
      salesOrderItemId: 0, productMasterId: null, productName: '', hsnSac: '',
      qty: 1, rate: 0, discountAmount: 0, gstPercent: 18, warrantyMonths: 12,
    }]);
  }

  removeLine(index: number): void {
    if (!this.isEditable()) return;
    this.lines.update(ls => ls.filter((_, i) => i !== index));
  }

  // ── a new product without leaving the bill ──
  newProductLine = signal<BillLine | null>(null);
  newProductName = signal('');

  openNewProduct(line: BillLine, typed = ''): void {
    if (!this.isEditable()) return;
    this.newProductName.set(typed);
    this.newProductLine.set(line);
  }

  closeNewProduct(result: ProductFormResult): void {
    const line = this.newProductLine();
    this.newProductLine.set(null);
    if (typeof result !== 'object' || !result.product || !line) return;
    const product = result.product;
    this.products.update(list => [product, ...list.filter(x => x.productMasterId !== product.productMasterId)]);
    this.onProductChange(line, String(product.productMasterId));
    this.showToast('success', result.message || 'Product created successfully');
  }

  onProductChange(line: BillLine, value: string): void {
    const id = Number(value || 0);
    const p = this.products().find(x => x.productMasterId === id);
    line.productMasterId = p ? p.productMasterId : null;
    line.productName = p ? p.productName : '';
    line.brand = p?.brand; line.model = p?.model;
    if (p) {
      line.rate = Number(p.mrp || 0);
      line.warrantyMonths = Number(p.warrantyMonths ?? 12);
    }
    this.touch();
  }

  /** signals only see a new array, so edits of a line go through here */
  touch(): void {
    this.lines.update(ls => [...ls]);
    this.isInterStateSig.set(this.isInterState);
    if (this.error()) this.error.set('');
  }

  lineTaxable(l: BillLine): number { return this.num(l.qty) * this.num(l.rate) - this.num(l.discountAmount); }
  /** What the line adds to the bill: never below zero on the screen. */
  private lineNet(l: BillLine): number {
    return Math.max(0, Math.max(0, this.num(l.qty)) * Math.max(0, this.num(l.rate)) - Math.max(0, this.num(l.discountAmount)));
  }
  lineGst(l: BillLine): number { return this.round2(this.lineNet(l) * this.num(l.gstPercent) / 100); }
  lineTotal(l: BillLine): number { return this.round2(this.lineNet(l) + this.lineGst(l)); }

  productLabel(p: ProductMasterDTO): string {
    const bits = [p.productName, p.model, p.brand].filter(Boolean);
    return bits.join(' · ');
  }

  // =====================================================================
  // save
  // =====================================================================
  validate(): string {
    if (!this.customer()) return 'Select a customer or add a new one';
    if (!this.orderDate) return 'Invoice date is required';
    if (this.paymentDueDate && this.paymentDueDate < this.orderDate) return 'The payment due date cannot be before the invoice date';
    const ls = this.lines();
    if (!ls.length) return 'Add at least one product';
    for (let i = 0; i < ls.length; i++) {
      const l = ls[i];
      if (!l.productName?.trim()) return `Line ${i + 1}: select a product`;
      if (this.num(l.qty) < 1) return `Line ${i + 1}: quantity must be at least 1`;
      if (!Number.isInteger(this.num(l.qty))) return `Line ${i + 1}: quantity must be a whole number`;
      if (l.rate === null || l.rate === undefined || (l.rate as unknown) === '') return `Line ${i + 1}: enter the rate`;
      if (this.num(l.rate) < 0 || this.num(l.discountAmount) < 0) return `Line ${i + 1}: rate / discount cannot be negative`;
      if (this.lineTaxable(l) < 0) return `Line ${i + 1}: discount is more than the line amount`;
      if (this.num(l.warrantyMonths) < 0) return `Line ${i + 1}: warranty months cannot be negative`;
    }
    return '';
  }

  async save(andDespatch = true): Promise<void> {
    const err = this.validate();
    if (err) {
      this.customerCollapsed.set(false);   // the field to correct may be in the folded card
      this.error.set(err); this.showToast('error', err); return;
    }
    this.error.set('');

    const free = this.lines().findIndex(l => this.num(l.rate) === 0);
    if (free >= 0 && !(await this.dialog.confirm(`Line ${free + 1} has a rate of ₹0. Save it as a free item?`))) return;

    const dto: SalesOrderSave = {
      salesOrderId: this.salesOrderId(),
      orderDate: this.orderDate,
      customerId: this.customer()!.customerId,
      paymentMode: this.paymentMode || null,
      paymentDueDate: this.paymentDueDate || null,
      referenceNo: this.referenceNo || null,
      contactNumber: this.contactNumber || null,
      gstin: this.gstin?.trim().toUpperCase() || null,
      billingAddress: this.billingAddress || null,
      city: this.city || null,
      state: this.state || null,
      pinCode: this.pinCode || null,
      isInterState: !!this.isInterState,
      notes: this.notes || null,
      terms: this.terms.trim() || null,
      warrantyText: this.warrantyText.trim() || null,
      items: this.lines().map<SalesOrderItemSave>(l => ({
        salesOrderItemId: l.salesOrderItemId,
        productMasterId: l.productMasterId,
        productName: l.productName.trim(),
        hsnSac: l.hsnSac?.trim() || null,
        qty: this.num(l.qty),
        rate: this.num(l.rate),
        discountAmount: this.num(l.discountAmount),
        gstPercent: this.num(l.gstPercent),
        warrantyMonths: this.num(l.warrantyMonths),
      })),
    };

    this.saving.set(true);
    this.api.saveSalesOrder(dto).subscribe({
      next: r => {
        this.saving.set(false);
        if (!r?.success || !r.data) { this.error.set(r?.message || 'Could not save the bill'); this.showToast('error', this.error()); return; }
        const wasNew = this.isNew();
        this.salesOrderId.set(r.data.salesOrderId);
        this.orderNo.set(r.data.orderNo);
        this.showToast('success', r.message || `Bill ${r.data.orderNo} saved`);
        this.markSaved();
        if (andDespatch) {
          // the bill goes straight on to despatch
          setTimeout(() => this.router.navigate(['/sales/despatch', r.data!.salesOrderId]), 500);
        } else if (wasNew) {
          // the address of the saved bill (a new page that loads it)
          this.router.navigate(['/sales/orders', r.data.salesOrderId], { replaceUrl: true });
        } else {
          this.load(r.data.salesOrderId);
        }
      },
      error: e => {
        this.saving.set(false);
        const msg = e?.error?.message || 'Could not save the bill';
        this.error.set(msg); this.showToast('error', msg);
      },
    });
  }

  goToDespatch(): void {
    if (this.salesOrderId() > 0) this.router.navigate(['/sales/despatch', this.salesOrderId()]);
  }

  viewDespatch(despatchId: number): void {
    this.router.navigate(['/sales/despatch/view', despatchId]);
  }

  back(): void { this.router.navigate(['/sales/orders']); }

  // =====================================================================
  // print
  // =====================================================================
  /** The login's company, used where Settings > Print is blank. */
  printCompany(): PrintCompany { return printCompanyOf(this.auth); }

  pdfBusy = signal(false);

  async downloadPdf(): Promise<void> {
    if (this.isNew() || this.pdfBusy()) return;
    this.pdfBusy.set(true);
    try {
      await this.pdf.download(this.buildPrintDoc(), this.printSettings(),
        documentFileName('Invoice', this.orderNo(), this.customer()?.customerName));
    } catch {
      this.showToast('error', 'The PDF could not be made. Try again');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  private showPrintDate(value: string): string {
    const [y, m, d] = (value || '').slice(0, 10).split('-');
    return d ? `${d}/${m}/${y}` : '';
  }

  private buildPrintDoc(): PrintDocument {
    const despatch = this.detail()?.despatches?.[0];
    return {
      title: 'TAX INVOICE',
      metaRows: [
        { label: 'Invoice No.', value: this.orderNo() },
        { label: 'Reference / PO', value: this.referenceNo },
        { label: 'Date:', value: this.showPrintDate(this.orderDate) },
        { label: 'Payment Due Date:', value: this.showPrintDate(this.paymentDueDate) },
        { label: 'Payment Mode', value: this.paymentMode },
        { label: 'Place of Supply', value: this.state },
        { label: 'Status', value: this.status() },
        ...(despatch ? [{ label: 'Despatch', value: `${despatch.despatchNo} · ${this.showPrintDate(String(despatch.despatchDate))}` }] : []),
      ],
      billTo: {
        name: this.customer()?.customerName ?? '',
        lines: [this.billingAddress, [this.city, this.state, this.pinCode].filter(Boolean).join(', ')].filter(Boolean),
        phone: this.contactNumber, email: this.customer()?.email, gstin: this.gstin,
      },
      lines: this.lines().map(l => ({
        description: l.productName,
        details: printLineDetails({
          ...l, brandModel: [l.brand, l.model].filter(Boolean).join(' '),
          warrantyEndDate: l.warrantyEndDate ? this.showPrintDate(l.warrantyEndDate) : null,
        }),
        rate: this.num(l.rate), qty: this.num(l.qty), amount: this.num(l.qty) * this.num(l.rate),
      })),
      subTotal: this.subTotal(), discountTotal: this.discountTotal(), isInterState: this.isInterState,
      cgst: this.cgst(), sgst: this.sgst(), igst: this.igst(), grandTotal: this.grandTotal(), notes: this.notes,
      terms: this.terms, warranty: this.warrantyText,
    };
  }

  print(): void {
    if (this.isNew()) { this.showToast('error', 'Save the bill before printing'); return; }
    this.printDoc.set(this.buildPrintDoc());
    // the logo and seal must be ready, or the page prints without them
    setTimeout(async () => {
      const images = Array.from(document.querySelectorAll<HTMLImageElement>('.invoice-print img'));
      await Promise.all(images.map(i => i.decode().catch(() => undefined)));
      window.print();
    }, 50);
  }

  // =====================================================================
  // helpers
  // =====================================================================
  showToast(type: 'success' | 'error', text: string): void {
    this.toast.set({ type, text });
    setTimeout(() => this.toast.set(null), 3500);
  }

  num(v: any): number { const n = Number(v); return isNaN(n) ? 0 : n; }
  round2(v: number): number { return Math.round((v + Number.EPSILON) * 100) / 100; }

  private blankCustomer(): SalesCustomerSave {
    return { customerId: 0, customerName: '', mobileNumber: '', alternatePhone: '', email: '', address: '', city: '', state: 'Kerala', pinCode: '', landmark: '', gstin: '' };
  }

  private todayInput(): string { return this.toDateInput(new Date()); }

  private toDateInput(d: string | Date | null | undefined): string {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(dt.getTime())) return '';
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${m}-${day}`;
  }
}
