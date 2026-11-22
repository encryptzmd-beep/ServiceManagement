import { UppercaseInputDirective } from '../shared/uppercase-input';
import { ProductFormComponent, ProductFormResult } from '../product-form-component/product-form-component';
import { AppRightDirective } from '../shared/app-right/app-right';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConvertResultDto, CrmProductDto, LeadDetailDto, LeadListDto, LeadSaveDto, QuotationDto, QuotationItemDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmConvertDialogComponent } from '../crm-shell-component/crm-convert-dialog-component';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, amount, isoDate, pill, quoteTotals, refusalOf, showDate } from '../crm-shell-component/crm-ui';
import { TransactionMode, TransactionToolbarComponent } from '../shared/transaction-toolbar/transaction-toolbar';
import { FindQuery, FindRow, TransactionFindComponent } from '../shared/transaction-toolbar/transaction-find';
import { DialogService } from '../../Services/dialog-service';
import { RightsService } from '../../Services/rights-service';

export const GST_RATES = [0, 5, 12, 18, 28];
const OPEN_FOR_CONVERT = ['Quotation', 'Negotiation'];

const blankLine = (sortOrder: number): QuotationItemDto => ({
  quotationItemId: 0, productMasterId: null, productName: '', hsnSac: '', qty: 1, rate: 0, discountAmount: 0, gstPercent: 18,
  warrantyMonths: 0, taxableAmount: 0, gstAmount: 0, lineTotal: 0, sortOrder,
});

/** The header of the quotation being edited. */
interface Head { quoteDate: string; validUntil: string; isInterState: boolean; terms: string; referenceNo: string; paymentDueDate: string; customerGstin: string; pricesIncludeGst: boolean; warrantyText: string; }

/** A customer typed on a new quotation; it becomes a lead when the quotation is saved. */
interface NewCustomer { contactName: string; mobile: string; email: string; address: string; city: string; state: string; pinCode: string; }
const blankCustomer = (): NewCustomer => ({ contactName: '', mobile: '', email: '', address: '', city: '', state: '', pinCode: '' });

/**
 * /crm/quotations/:id (and /crm/quotations/new?leadId=5): the line editor. The amounts are worked out while typing
 * with the formula of CrmRules.Totals; after a save the server's figures are read back and are the ones kept.
 * Only a Draft is changed; a Sent one is revised into a new Draft revision.
 */
@Component({
  selector: 'app-crm-quotation',
  standalone: true,
  imports: [UppercaseInputDirective, ProductFormComponent, AppRightDirective, FormsModule, RouterLink, CrmRefusedComponent, CrmConvertDialogComponent, TransactionToolbarComponent, TransactionFindComponent],
  templateUrl: './crm-quotation-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-quotation-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmQuotationComponent {
  private crm = inject(CrmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(DialogService);
  readonly rights = inject(RightsService);

  readonly forbidden = FORBIDDEN;
  readonly gstRates = GST_RATES;
  readonly amount = amount;
  readonly pill = pill;
  readonly showDate = showDate;

  quotationId = signal(0);
  leadId = signal(0);
  saved = signal<QuotationDto | null>(null);
  leadTitle = signal('');
  head = signal<Head>({ quoteDate: isoDate(new Date()), validUntil: '', isInterState: false, terms: '', referenceNo: '', paymentDueDate: '', customerGstin: '', pricesIncludeGst: false, warrantyText: '' });
  lines = signal<QuotationItemDto[]>([]);
  error = signal('');
  notice = signal('');
  /** The lead's product is not in the product master (a warning, not a success). */
  warning = signal('');
  busy = signal(false);
  loaded = signal(false);

  term = signal('');
  products = signal<CrmProductDto[]>([]);
  searching = signal(false);

  readonly status = computed(() => this.saved()?.status ?? 'Draft');

  // ── toolbar (New · Edit · Save · Print · Cancel · Previous · Next · Find) ──
  /** A saved quotation opens read-only; Edit unlocks a draft. */
  editing = signal(false);
  readonly mode = computed<TransactionMode>(() => !this.quotationId() ? 'new' : this.editing() ? 'edit' : 'view');
  readonly editable = computed(() => this.status() === 'Draft' && this.mode() !== 'view');
  private readonly open = computed(() => !!this.saved()?.isLatest && ['Draft', 'Sent', 'Rejected'].includes(this.status())
    && !['Converted', 'Lost'].includes(this.saved()?.leadStatus ?? ''));
  /** Draft: edit it. Sent or rejected: Edit makes a new revision. */
  readonly canEditDoc = computed(() => this.open());
  readonly editLabel = computed(() => this.status() === 'Draft' ? 'Edit' : 'Revise');
  readonly canCancelDoc = computed(() => this.open());
  neighbours = signal<{ previousId: number | null; nextId: number | null }>({ previousId: null, nextId: null });
  findOpen = signal(false);
  findRows = signal<FindRow[]>([]);
  findLoading = signal(false);
  private savedSnapshot = '';
  readonly totals = computed(() => quoteTotals(this.lines(), this.head().isInterState, this.head().pricesIncludeGst));

  /** The convert dialog is open; after a convert, the order that was made. */
  convertOpen = signal(false);
  convertedOrderNo = signal('');

  /** Convert to sales order is offered for the latest Draft or Sent revision of a lead still open. */
  readonly showConvert = computed(() => {
    const q = this.saved();
    return !!q && q.isLatest && (q.status === 'Draft' || q.status === 'Sent') && !['Converted', 'Lost'].includes(q.leadStatus ?? '');
  });

  /** The server converts only a lead in Quotation or Negotiation (CrmRules.ConvertProblem). */
  /** The lead's convert flags (the quotation does not carry them); null until read. */
  lead = signal<LeadDetailDto | null>(null);
  /** False until the lead read has answered (success or failure); Convert stays disabled meanwhile. */
  leadLoaded = signal(false);

  /** Why a shown Convert button is disabled, or '' when the convert may go ahead. Same wording as the lead page. */
  readonly convertHint = computed(() => {
    if (!this.showConvert()) return '';
    const l = this.lead();
    if (l?.salesOrderId) return 'This lead has already been converted to a sales order';
    if (l?.convertNeedsCheck) return 'A manager must check the sales orders for this lead first, then link the order or cancel the convert';
    if (!OPEN_FOR_CONVERT.includes(this.saved()?.leadStatus ?? '')) return 'Mark the quotation as sent first';
    return '';
  });
  readonly canConvert = computed(() => this.showConvert() && this.leadLoaded() && !this.convertHint());

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (id === 'new') this.startNew(Number(this.route.snapshot.queryParamMap?.get('leadId') ?? 0));
    else this.load(Number(id));
  }

  /** A blank quotation; with a lead, its customer and product are filled in, without one the customer is chosen here. */
  private startNew(leadId: number): void {
    this.quotationId.set(0);
    this.saved.set(null);
    this.editing.set(false);
    this.head.set({ quoteDate: isoDate(new Date()), validUntil: '', isInterState: false, terms: '', referenceNo: '', paymentDueDate: '', customerGstin: '', pricesIncludeGst: false, warrantyText: '' });
    this.lines.set([blankLine(1)]);
    this.lead.set(null);
    this.leadLoaded.set(false);
    this.leadId.set(0);
    this.leadTitle.set('');
    this.custMode.set('pick');
    this.newCust.set(blankCustomer());
    this.leadTerm.set('');
    this.leadResults.set([]);
    this.leadListOpen.set(false);
    this.loaded.set(true);
    this.markSaved();
    this.crm.quotationNeighbours(0)?.subscribe({
      next: r => this.neighbours.set({ previousId: r?.data?.previousId ?? null, nextId: null }),
      error: () => {},
    });
    this.loadDefaultTexts();
    if (leadId > 0) this.useLead(leadId, true);
  }

  /** A new quotation starts with the terms and warranty of Print Settings; what is saved is this quotation's own copy. */
  private loadDefaultTexts(): void {
    this.crm.getPrintSettings().subscribe({
      next: res => {
        if (this.quotationId() || this.saved()) return;
        const d = res?.data ?? {};
        const untouched = !this.isDirty();
        // never over what the person has typed meanwhile
        this.head.update(h => ({ ...h, terms: h.terms || (d['Print.Terms'] ?? ''), warrantyText: h.warrantyText || (d['Print.Warranty'] ?? '') }));
        if (untouched) this.markSaved();   // the defaults are not a change of the user
      },
      error: () => {},   // the boxes stay blank and can be typed in
    });
  }

  // ── customer: the quotation is always for a lead; a new quotation picks one or makes one ──

  /** "Pick" an existing lead, or type a "new" customer (the lead is made when the quotation is saved). */
  custMode = signal<'pick' | 'new'>('pick');
  newCust = signal<NewCustomer>(blankCustomer());
  leadTerm = signal('');
  leadResults = signal<LeadListDto[]>([]);
  leadListOpen = signal(false);
  leadSearching = signal(false);

  /** What the Customer card shows: the saved quotation's copy, or the lead of a new one. */
  readonly customer = computed(() => {
    const q = this.saved();
    if (q) return { leadId: q.leadId, leadNo: q.leadNo, name: q.contactName, mobile: q.mobile, email: q.email,
      address: q.address, city: q.city, state: q.state, pinCode: q.pinCode, leadStatus: q.leadStatus };
    const l = this.lead();
    if (l) return { leadId: l.leadId, leadNo: l.leadNo, name: l.contactName, mobile: l.mobile, email: l.email,
      address: l.address, city: l.city, state: l.state, pinCode: l.pinCode, leadStatus: l.status };
    return null;
  });
  readonly addressLine = computed(() => {
    const c = this.customer();
    return c ? [c.address, c.city, c.state, c.pinCode].filter(x => !!(x ?? '').toString().trim()).join(', ') : '';
  });
  /** Only a new quotation may change its customer. */
  readonly canChangeCustomer = computed(() => !this.quotationId());

  /** On focus the latest customers, then whatever is typed: at most 20 that can take a quotation. */
  searchLeads(term: string): void {
    this.leadTerm.set(term);
    this.leadListOpen.set(true);
    this.leadSearching.set(true);
    // more than 20 are read because converted and lost leads are dropped below
    this.crm.getLeads({ search: term.trim() || undefined, page: 1, pageSize: 100 }).subscribe({
      next: res => {
        this.leadSearching.set(false);
        if (this.leadTerm() !== term) return;
        // a converted or lost lead takes no new quotation
        this.leadResults.set((res.success ? res.data?.items ?? [] : []).filter(l => !['Converted', 'Lost'].includes(l.status)).slice(0, 20));
      },
      error: () => { this.leadSearching.set(false); this.leadResults.set([]); },
    });
  }

  /** Focus moving to a row of the list keeps it open; anywhere else closes it. */
  onLeadSearchBlur(event: FocusEvent): void {
    const box = event.currentTarget as HTMLElement;
    if (!box.contains(event.relatedTarget as Node | null)) this.leadListOpen.set(false);
  }

  /** Reads the lead into the Customer card. Picking a customer leaves the lines alone; only a quotation opened from a lead starts with its products. */
  useLead(leadId: number, withProduct = false): void {
    this.leadId.set(leadId);
    this.leadListOpen.set(false);
    this.leadResults.set([]);
    this.leadTerm.set('');
    this.error.set('');
    this.crm.getLead(leadId).subscribe({
      next: res => {
        this.leadLoaded.set(true);
        if (!res.success || !res.data) { this.error.set(res.message || 'Lead not found'); return; }
        this.lead.set(res.data);
        this.leadTitle.set(`${res.data.leadNo} · ${res.data.contactName}`);
        if (withProduct) this.startWithProduct(res.data);
      },
      error: err => { this.leadLoaded.set(true); this.fail(err); },
    });
  }

  changeCustomer(): void {
    if (!this.canChangeCustomer()) return;
    this.leadId.set(0);
    this.lead.set(null);
    this.leadTitle.set('');
    this.custMode.set('pick');
  }

  setCust<K extends keyof NewCustomer>(key: K, value: NewCustomer[K]): void {
    this.newCust.update(c => ({ ...c, [key]: value }));
  }

  /** The customer problem of a new quotation, or null when it has one. */
  private customerProblem(): string | null {
    if (this.leadId()) return null;
    if (this.custMode() === 'pick') return 'Choose the customer (search a lead) or add a new customer';
    const c = this.newCust();
    if (!c.contactName.trim()) return 'Enter the customer name';
    if (c.mobile.replace(/\D/g, '').length < 10) return 'Enter a valid 10-digit mobile number';
    return null;
  }

  /** A new customer becomes a lead first; then the quotation is saved against it. */
  private withLead(next: () => void): void {
    if (this.leadId()) { next(); return; }
    const c = this.newCust();
    const dto: LeadSaveDto = {
      leadId: 0, leadDate: this.head().quoteDate || isoDate(new Date()), contactName: c.contactName.trim(), mobile: c.mobile.trim(),
      email: c.email.trim() || null, address: c.address.trim() || null, city: c.city.trim() || null,
      state: c.state.trim() || null, pinCode: c.pinCode.trim() || null, priority: 'Medium', remarks: 'Created from a quotation',
    };
    this.busy.set(true);
    this.crm.saveLead(dto).subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success || !res.data) { this.error.set(res.message || 'The customer could not be saved'); return; }
        this.leadId.set(res.data);
        this.useLead(res.data, false);
        next();
      },
      error: err => { this.busy.set(false); this.fail(err); },
    });
  }

  /** A lead with a chosen product: the empty first line starts with it, at its MRP, warranty and HSN. */
  private startWithProduct(lead: LeadDetailDto): void {
    // every product of the lead becomes a line, with its quantity
    if (lead.products?.length) {
      lead.products.forEach(p => this.pick(p, p.qty));
      this.markSaved();
      return;
    }
    const id = lead.productMasterId;
    if (!id) return;
    const missed = () => this.warning.set("The lead's product was not found in the product master");
    this.crm.searchProducts(undefined, lead.productCategory || undefined, 100).subscribe({
      next: res => {
        const p = (res.success ? res.data ?? [] : []).find(x => x.productMasterId === id);
        if (p) { this.pick(p); this.markSaved(); } else missed();   // the prefill is not a change of the user
      },
      error: () => missed(),
    });
  }

  private fail(err: unknown): void {
    this.error.set(refusalOf(err));
  }

  load(id: number): void {
    this.crm.getQuotation(id).subscribe({
      next: res => {
        const q = res.data;
        if (!res.success || !q) { this.error.set(res.message || 'Quotation not found'); return; }
        this.quotationId.set(q.quotationId);
        this.leadId.set(q.leadId);
        this.saved.set(q);
        this.leadTitle.set(`${q.leadNo} · ${q.contactName}`);
        this.head.set({
          quoteDate: (q.quoteDate ?? '').slice(0, 10), validUntil: (q.validUntil ?? '').slice(0, 10), isInterState: q.isInterState, terms: q.terms ?? '',
          referenceNo: q.referenceNo ?? '', paymentDueDate: (q.paymentDueDate ?? '').slice(0, 10), customerGstin: q.customerGstin ?? '',
          pricesIncludeGst: !!q.pricesIncludeGst, warrantyText: q.warrantyText ?? '',
        });
        this.lines.set([...(q.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map(i => ({ ...i })));
        this.loaded.set(true);
        // a loaded quotation opens read-only; Edit unlocks a draft
        this.editing.set(false);
        this.markSaved();
        this.crm.quotationNeighbours(q.quotationId).subscribe({
          next: r => this.neighbours.set({ previousId: r?.data?.previousId ?? null, nextId: r?.data?.nextId ?? null }),
          error: () => this.neighbours.set({ previousId: null, nextId: null }),
        });
        this.crm.getLead(q.leadId).subscribe({ next: r => { this.lead.set(r.success ? r.data ?? null : null); this.leadLoaded.set(true); }, error: () => { this.lead.set(null); this.leadLoaded.set(true); } });
      },
      error: err => this.fail(err),
    });
  }

  // ── toolbar ──
  private snapshot(): string { return JSON.stringify([this.head(), this.lines()]); }
  private markSaved(): void { this.savedSnapshot = this.snapshot(); }
  isDirty(): boolean { return this.mode() !== 'view' && this.snapshot() !== this.savedSnapshot; }

  /** Runs the action, after "Discard the changes?" when there is unsaved work. */
  private async leave(action: () => void): Promise<void> {
    if (this.isDirty() && !(await this.dialog.confirm({ message: 'Discard the changes to this quotation?', kind: 'danger', okText: 'Discard' }))) return;
    action();
  }

  /** Shows another quotation in this screen (the route is reused). */
  private openQuotation(id: number): void {
    // replace the address: the screen is reused, so Back must not show another quotation under this one's address
    this.router.navigate(['/crm/quotations', id], { replaceUrl: true });
    this.error.set(''); this.notice.set(''); this.warning.set(''); this.convertedOrderNo.set('');
    this.lead.set(null); this.leadLoaded.set(false);
    this.load(id);
  }

  /** A blank quotation in this same screen; the customer is chosen on it. */
  onNew(): void {
    this.leave(() => {
      this.router.navigate(['/crm/quotations', 'new'], { replaceUrl: true });
      this.error.set(''); this.notice.set(''); this.warning.set(''); this.convertedOrderNo.set('');
      this.startNew(0);
    });
  }

  async onEdit(): Promise<void> {
    if (!this.canEditDoc()) return;
    if (this.status() === 'Draft') { this.editing.set(true); return; }
    const q = this.saved();
    if (await this.dialog.confirm({ message: `Make a new draft revision of ${q?.quotationNo}? This one stays as it was sent.`, okText: 'Revise' })) this.revise();
  }

  onDiscard(): void { this.leave(() => this.load(this.quotationId())); }

  onSave(): void { this.save(); }

  onPrint(): void {
    const id = this.quotationId();
    if (id) window.open(this.router.serializeUrl(this.router.createUrlTree(['/crm/quotations', id, 'print'])), '_blank');
  }

  async onCancelDoc(): Promise<void> {
    const q = this.saved();
    if (!q || !this.canCancelDoc()) return;
    const ok = await this.dialog.confirm({
      message: `Cancel quotation ${q.quotationNo}? It cannot be sent or converted after this.`, kind: 'danger', okText: 'Cancel quotation', cancelText: 'Keep it',
    });
    if (!ok) return;
    this.busy.set(true);
    this.crm.setQuotationStatus(q.quotationId, 'Cancelled').subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success) { this.error.set(res.message || 'The quotation could not be cancelled'); return; }
        this.notice.set(`Quotation ${q.quotationNo} cancelled`);
        this.load(q.quotationId);
      },
      error: err => { this.busy.set(false); this.fail(err); },
    });
  }

  onPrevious(): void { const id = this.neighbours().previousId; if (id) this.leave(() => this.openQuotation(id)); }

  onNext(): void { const id = this.neighbours().nextId; if (id) this.leave(() => this.openQuotation(id)); }

  onFind(): void { this.findRows.set([]); this.findOpen.set(true); }

  onFindSearch(q: FindQuery): void {
    this.findLoading.set(true);
    this.crm.getQuotations({ search: q.term || undefined, from: q.from || undefined, to: q.to || undefined, page: 1, pageSize: 30 }).subscribe({
      next: res => {
        this.findLoading.set(false);
        this.findRows.set((res.success ? res.data?.items ?? [] : []).map(r => ({
          id: r.quotationId, number: `${r.quotationNo} / R${r.revisionNo}`, date: r.quoteDate, party: r.contactName, amount: r.grandTotal, status: r.status,
        })));
      },
      error: () => { this.findLoading.set(false); this.findRows.set([]); },
    });
  }

  onFindPick(id: number): void {
    this.findOpen.set(false);
    if (id !== this.quotationId()) this.leave(() => this.openQuotation(id));
  }

  setHead<K extends keyof Head>(key: K, value: Head[K]): void {
    this.head.update(h => ({ ...h, [key]: value }));
  }

  setLine<K extends keyof QuotationItemDto>(index: number, key: K, value: QuotationItemDto[K]): void {
    this.lines.update(list => list.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  }

  /** A number from an input; empty or not a number is 0. */
  num(event: Event): number {
    const v = Number((event.target as HTMLInputElement).value);
    return Number.isFinite(v) ? v : 0;
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  addLine(): void {
    this.lines.update(list => [...list, blankLine(list.length + 1)]);
  }

  removeLine(index: number): void {
    this.lines.update(list => list.filter((_, i) => i !== index).map((l, i) => ({ ...l, sortOrder: i + 1 })));
  }

  search(term: string): void {
    this.term.set(term);
    this.searching.set(true);
    this.crm.searchProducts(term.trim() || undefined, undefined, 100).subscribe({
      next: res => { this.searching.set(false); if (this.term() === term) this.products.set(res.success ? res.data ?? [] : []); },
      error: () => { this.searching.set(false); this.products.set([]); },
    });
  }

  newProduct = signal(false);
  newProductName = signal('');
  searchOpen = signal(false);

  /** Every product shows as soon as the box opens, before anything is typed. */
  openProductSearch(): void {
    this.searchOpen.set(true);
    if (!this.products().length) this.search(this.term());
  }

  canAddProduct(): boolean {
    return this.rights.can('create', '/products');
  }

  startNewProduct(): void {
    this.newProductName.set(this.term().trim());
    this.searchOpen.set(false);
    this.newProduct.set(true);
  }

  /** A product made here goes on the quotation like a picked one. */
  closeNewProduct(result: ProductFormResult): void {
    this.newProduct.set(false);
    if (typeof result !== 'object' || !result.product) return;
    const p = result.product;
    this.pick({
      productMasterId: p.productMasterId, productCode: p.productCode, productName: p.productName,
      brand: p.brand ?? '', model: p.model ?? '', category: p.category ?? '',
      mrp: Number(p.mrp ?? 0), warrantyMonths: Number(p.warrantyMonths ?? 0),
    });
  }

  /** The product goes on the first empty line, or a new one, at its MRP and warranty. */
  pick(p: CrmProductDto, qty = 1): void {
    const line: Partial<QuotationItemDto> = {
      productMasterId: p.productMasterId,
      productName: p.productName,
      qty,
      rate: p.mrp ?? 0,
      warrantyMonths: p.warrantyMonths ?? 0,
      ...(p.hsnSac ? { hsnSac: p.hsnSac } : {}),
    };
    this.lines.update(list => {
      const empty = list.findIndex(l => !l.productName.trim() && !l.productMasterId);
      if (empty >= 0) return list.map((l, i) => (i === empty ? { ...l, ...line } : l));
      return [...list, { ...blankLine(list.length + 1), ...line }];
    });
    this.term.set('');
    this.products.set([]);
    this.searchOpen.set(false);
  }

  private problem(): string | null {
    const list = this.lines();
    if (list.length === 0) return 'Add at least one product line';
    for (const l of list) {
      if (!l.productName.trim()) return 'Enter the product on every line';
      if (!(l.qty >= 1)) return 'The quantity must be at least 1';
      if (l.rate < 0) return 'The rate cannot be below 0';
      if (l.discountAmount < 0 || l.discountAmount > l.qty * l.rate) return 'The discount cannot exceed the line amount';
    }
    const h = this.head();
    if (h.validUntil && h.validUntil < h.quoteDate) return 'The quotation cannot be valid until a date before it is dated';
    if (h.paymentDueDate && h.paymentDueDate < h.quoteDate) return 'The payment due date cannot be before the quotation date';
    return null;
  }

  save(then?: () => void): void {
    const problem = this.customerProblem() ?? this.problem();
    if (problem) { this.error.set(problem); return; }
    this.withLead(() => this.saveQuotation(then));
  }

  private saveQuotation(then?: () => void): void {
    const h = this.head();
    const t = this.totals();
    this.error.set('');
    this.notice.set('');
    this.busy.set(true);
    this.crm.saveQuotation({
      quotationId: this.quotationId(), leadId: this.leadId(), quoteDate: h.quoteDate, validUntil: h.validUntil || null,
      isInterState: h.isInterState, terms: h.terms || null, referenceNo: h.referenceNo.trim() || null,
      paymentDueDate: h.paymentDueDate || null, customerGstin: h.customerGstin.trim().toUpperCase() || null,
      pricesIncludeGst: h.pricesIncludeGst, warrantyText: h.warrantyText.trim() || null,
      items: this.lines().map((l, i) => ({
        ...l, sortOrder: i + 1, qty: Number(l.qty), rate: Number(l.rate), discountAmount: Number(l.discountAmount),
        gstPercent: Number(l.gstPercent), warrantyMonths: Number(l.warrantyMonths),
        taxableAmount: t.lines[i].taxableAmount, gstAmount: t.lines[i].gstAmount, lineTotal: t.lines[i].lineTotal,
      })),
    }).subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success || !res.data) { this.error.set(res.message || 'The quotation could not be saved'); return; }
        const id = res.data;
        if (id !== this.quotationId()) this.router.navigate(['/crm/quotations', id], { replaceUrl: true });
        this.quotationId.set(id);
        this.notice.set('Quotation saved');
        this.load(id);
        then?.();
      },
      error: err => { this.busy.set(false); this.fail(err); },
    });
  }

  setStatus(status: 'Sent' | 'Rejected'): void {
    const go = () => {
      this.busy.set(true);
      this.crm.setQuotationStatus(this.quotationId(), status).subscribe({
        next: res => {
          this.busy.set(false);
          if (!res.success) { this.error.set(res.message || 'The status could not be changed'); return; }
          this.notice.set(status === 'Sent' ? 'Marked sent' : 'Marked rejected');
          this.load(this.quotationId());
        },
        error: err => { this.busy.set(false); this.fail(err); },
      });
    };
    // a draft is saved first, so what is sent is what is on the screen
    if (this.editable()) this.save(go); else go();
  }

  revise(): void {
    this.busy.set(true);
    this.crm.reviseQuotation(this.quotationId()).subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success || !res.data) { this.error.set(res.message || 'The quotation could not be revised'); return; }
        this.router.navigate(['/crm/quotations', res.data], { replaceUrl: true });
        this.notice.set('A new draft revision was made');
        this.load(res.data);
      },
      error: err => { this.busy.set(false); this.fail(err); },
    });
  }

  // ── convert to sales order: app-crm-convert-dialog (shared with the lead page) reads the preview and asks the server ──

  openConvert(): void {
    if (!this.canConvert() || this.busy()) return;
    this.error.set('');
    this.notice.set('');
    this.convertedOrderNo.set('');
    // a draft is saved first, so what is converted is what is on the screen; a failed save leaves the dialog shut
    if (this.editable()) this.save(() => this.convertOpen.set(true));
    else this.convertOpen.set(true);
  }

  converted(res: ConvertResultDto): void {
    this.convertOpen.set(false);
    this.notice.set('');
    this.convertedOrderNo.set(res.orderNo);
    // the quotation is Accepted now and the lead Converted
    this.load(this.quotationId());
  }

  /** A 403 means the session is not for CRM: the page says so, as every page does. */
  convertForbidden(): void {
    this.convertOpen.set(false);
    this.error.set(FORBIDDEN);
  }
}
