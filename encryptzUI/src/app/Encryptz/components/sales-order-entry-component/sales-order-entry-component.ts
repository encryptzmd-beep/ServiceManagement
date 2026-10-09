import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { ApiService } from '../../Services/API/api-service';
import { AuthService } from '../../Auth/auth-service';
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
  /** after despatch */
  serialNumbers?: string | null;
  warrantyEndDate?: string | null;
}

@Component({
  selector: 'app-sales-order-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sales-order-entry-component.html',
  styleUrls: ['./sales-order-entry-component.scss'],
})
export class SalesOrderEntryComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly paymentModes = SALES_PAYMENT_MODES;
  readonly gstRates = SALES_GST_RATES;
  readonly states = INDIAN_STATES;

  // ── bill header ──
  salesOrderId = signal(0);
  orderNo = signal('');
  status = signal('Billed');
  orderDate = this.todayInput();
  paymentMode = 'Cash';
  referenceNo = '';
  contactNumber = '';
  gstin = '';
  billingAddress = '';
  city = '';
  state = 'Kerala';
  pinCode = '';
  isInterState = false;
  notes = '';

  // ── customer ──
  customer = signal<SalesCustomer | null>(null);
  customerSearch = '';
  customerResults = signal<SalesCustomer[]>([]);
  customerDropdownOpen = signal(false);
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
  lines = signal<BillLine[]>([]);

  // ── despatch info of a saved bill ──
  detail = signal<SalesOrderDetail | null>(null);

  // ── print (Settings > Print) ──
  printSettings = signal<Record<string, string>>({});
  /** Settings > Print: 'none' | 'text' | 'image' for the invoice header and footer */
  headerMode = computed(() => this.printMode('Header'));
  footerMode = computed(() => this.printMode('Footer'));
  private printMode(part: 'Header' | 'Footer'): 'none' | 'text' | 'image' {
    const s = this.printSettings();
    const mode = (s[`Print.${part}Mode`] || '').trim().toLowerCase();
    if (mode === 'image' && (s[`Print.${part}Image`] || '').trim()) return 'image';
    if (mode === 'text' && (s[`Print.${part}Text`] || '').trim()) return 'text';
    return 'none';
  }
  printedAt = new Date();

  // ── ui state ──
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  toast = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  isEditable = computed(() => this.status() === 'Billed');
  isNew = computed(() => this.salesOrderId() === 0);

  // ── totals (same arithmetic as sp_SalesOrder_Save) ──
  private isInterStateSig = signal(false);
  subTotal = computed(() => this.lines().reduce((s, l) => s + this.num(l.qty) * this.num(l.rate), 0));
  discountTotal = computed(() => this.lines().reduce((s, l) => s + this.num(l.discountAmount), 0));
  taxableTotal = computed(() => this.lines().reduce((s, l) => s + this.lineTaxable(l), 0));
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
          this.isInterState = ['true', '1', 'yes'].includes((s['Sales.DefaultInterState'] || '').trim().toLowerCase());
          this.isInterStateSig.set(this.isInterState);
        }
      },
      error: () => this.printSettings.set({}),
    });

    if (id > 0) {
      this.load(id);
    } else {
      this.api.getNextSalesOrderNumber().subscribe({
        next: r => this.orderNo.set(r?.data || ''),
        error: () => this.orderNo.set(''),
      });
      this.addLine();
    }
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
          serialNumbers: i.serialNumbers, warrantyEndDate: i.warrantyEndDate,
        })));
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
    if (!f.mobileNumber?.trim() || f.mobileNumber.replace(/\D/g, '').length < 10) { this.customerFormError.set('A valid mobile number is required'); return; }
    if (f.gstin && f.gstin.trim() && !/^[0-9A-Z]{15}$/i.test(f.gstin.trim())) { this.customerFormError.set('GSTIN must be 15 characters'); return; }

    this.savingCustomer.set(true);
    this.customerFormError.set('');
    this.api.saveSalesCustomer({ ...f, gstin: f.gstin?.trim().toUpperCase() || null }).subscribe({
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
  }

  lineTaxable(l: BillLine): number { return this.num(l.qty) * this.num(l.rate) - this.num(l.discountAmount); }
  lineGst(l: BillLine): number { return this.round2(this.lineTaxable(l) * this.num(l.gstPercent) / 100); }
  lineTotal(l: BillLine): number { return this.round2(this.lineTaxable(l) + this.lineGst(l)); }

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
    const ls = this.lines();
    if (!ls.length) return 'Add at least one product';
    for (let i = 0; i < ls.length; i++) {
      const l = ls[i];
      if (!l.productName?.trim()) return `Line ${i + 1}: select a product`;
      if (this.num(l.qty) < 1) return `Line ${i + 1}: quantity must be at least 1`;
      if (this.num(l.rate) < 0 || this.num(l.discountAmount) < 0) return `Line ${i + 1}: rate / discount cannot be negative`;
      if (this.lineTaxable(l) < 0) return `Line ${i + 1}: discount is more than the line amount`;
      if (this.num(l.warrantyMonths) < 0) return `Line ${i + 1}: warranty months cannot be negative`;
    }
    return '';
  }

  save(andDespatch = true): void {
    const err = this.validate();
    if (err) { this.error.set(err); this.showToast('error', err); return; }
    this.error.set('');

    const dto: SalesOrderSave = {
      salesOrderId: this.salesOrderId(),
      orderDate: this.orderDate,
      customerId: this.customer()!.customerId,
      paymentMode: this.paymentMode || null,
      referenceNo: this.referenceNo || null,
      contactNumber: this.contactNumber || null,
      gstin: this.gstin?.trim().toUpperCase() || null,
      billingAddress: this.billingAddress || null,
      city: this.city || null,
      state: this.state || null,
      pinCode: this.pinCode || null,
      isInterState: !!this.isInterState,
      notes: this.notes || null,
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
        this.salesOrderId.set(r.data.salesOrderId);
        this.orderNo.set(r.data.orderNo);
        this.showToast('success', r.message || `Bill ${r.data.orderNo} saved`);
        if (andDespatch) {
          // the bill goes straight on to despatch
          setTimeout(() => this.router.navigate(['/sales/despatch', r.data!.salesOrderId]), 500);
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
  /** A Settings > Print value, blank when not set. */
  ps(key: string): string { return (this.printSettings()[key] || '').trim(); }

  /** Company name on the invoice: Settings > Print, else the company of the login. */
  printCompanyName(): string {
    return this.ps('Print.CompanyName') || String((this.auth.currentUser() as any)?.companyName || (this.auth.currentUser() as any)?.CompanyName || '');
  }

  printLines(key: string): string[] {
    return this.ps(key).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  }

  print(): void {
    if (this.isNew()) { this.showToast('error', 'Save the bill before printing'); return; }
    this.printedAt = new Date();
    setTimeout(() => window.print(), 50);
  }

  /** Grand total in words (Indian numbering), for the invoice. */
  amountInWords(amount: number): string {
    const n = Math.round(Math.abs(amount) * 100);
    const rupees = Math.floor(n / 100), paise = n % 100;
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const two = (x: number): string => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
    const three = (x: number): string => (x >= 100 ? ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
    const words = (x: number): string => {
      if (x === 0) return 'Zero';
      const parts: string[] = [];
      const crore = Math.floor(x / 10000000); x %= 10000000;
      const lakh = Math.floor(x / 100000); x %= 100000;
      const thousand = Math.floor(x / 1000); x %= 1000;
      if (crore) parts.push(two(crore) + ' Crore');
      if (lakh) parts.push(two(lakh) + ' Lakh');
      if (thousand) parts.push(two(thousand) + ' Thousand');
      if (x) parts.push(three(x));
      return parts.join(' ');
    };
    return 'Rupees ' + words(rupees) + (paise ? ' and ' + two(paise) + ' Paise' : '') + ' Only';
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
