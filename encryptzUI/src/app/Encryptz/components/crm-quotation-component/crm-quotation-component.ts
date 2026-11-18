import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CrmProductDto, QuotationDto, QuotationItemDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, amount, isoDate, pill, quoteTotals, refusalOf, showDate } from '../crm-shell-component/crm-ui';

export const GST_RATES = [0, 5, 12, 18, 28];

const blankLine = (sortOrder: number): QuotationItemDto => ({
  quotationItemId: 0, productMasterId: null, productName: '', hsnSac: '', qty: 1, rate: 0, discountAmount: 0, gstPercent: 18,
  warrantyMonths: 0, taxableAmount: 0, gstAmount: 0, lineTotal: 0, sortOrder,
});

/** The header of the quotation being edited. */
interface Head { quoteDate: string; validUntil: string; isInterState: boolean; terms: string; }

/**
 * /crm/quotations/:id (and /crm/quotations/new?leadId=5): the line editor. The amounts are worked out while typing
 * with the formula of CrmRules.Totals; after a save the server's figures are read back and are the ones kept.
 * Only a Draft is changed; a Sent one is revised into a new Draft revision.
 */
@Component({
  selector: 'app-crm-quotation',
  standalone: true,
  imports: [FormsModule, RouterLink, CrmRefusedComponent],
  templateUrl: './crm-quotation-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-quotation-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmQuotationComponent {
  private crm = inject(CrmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly forbidden = FORBIDDEN;
  readonly gstRates = GST_RATES;
  readonly amount = amount;
  readonly pill = pill;
  readonly showDate = showDate;

  quotationId = signal(0);
  leadId = signal(0);
  saved = signal<QuotationDto | null>(null);
  leadTitle = signal('');
  head = signal<Head>({ quoteDate: isoDate(new Date()), validUntil: '', isInterState: false, terms: '' });
  lines = signal<QuotationItemDto[]>([]);
  error = signal('');
  notice = signal('');
  busy = signal(false);
  loaded = signal(false);

  term = signal('');
  products = signal<CrmProductDto[]>([]);
  searching = signal(false);

  readonly status = computed(() => this.saved()?.status ?? 'Draft');
  readonly editable = computed(() => this.status() === 'Draft');
  readonly totals = computed(() => quoteTotals(this.lines(), this.head().isInterState));

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (id === 'new') {
      const leadId = Number(this.route.snapshot.queryParamMap?.get('leadId') ?? 0);
      this.leadId.set(leadId);
      this.lines.set([blankLine(1)]);
      this.loaded.set(true);
      if (leadId > 0) this.crm.getLead(leadId).subscribe({
        next: res => { if (res.success && res.data) this.leadTitle.set(`${res.data.leadNo} · ${res.data.contactName}`); },
        error: err => this.fail(err),
      });
      else this.error.set('Open the quotation from its lead');
    } else {
      this.load(Number(id));
    }
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
        });
        this.lines.set([...(q.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map(i => ({ ...i })));
        this.loaded.set(true);
      },
      error: err => this.fail(err),
    });
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
    if (term.trim().length < 2) { this.products.set([]); return; }
    this.searching.set(true);
    this.crm.searchProducts(term.trim()).subscribe({
      next: res => { this.searching.set(false); if (this.term() === term) this.products.set(res.success ? res.data ?? [] : []); },
      error: () => { this.searching.set(false); this.products.set([]); },
    });
  }

  /** The product goes on the first empty line, or a new one, at its MRP and warranty. */
  pick(p: CrmProductDto): void {
    const line: Partial<QuotationItemDto> = {
      productMasterId: p.productMasterId,
      productName: p.productName,
      rate: p.mrp ?? 0,
      warrantyMonths: p.warrantyMonths ?? 0,
    };
    this.lines.update(list => {
      const empty = list.findIndex(l => !l.productName.trim() && !l.productMasterId);
      if (empty >= 0) return list.map((l, i) => (i === empty ? { ...l, ...line } : l));
      return [...list, { ...blankLine(list.length + 1), ...line }];
    });
    this.term.set('');
    this.products.set([]);
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
    return null;
  }

  save(then?: () => void): void {
    const problem = this.problem();
    if (problem) { this.error.set(problem); return; }
    const h = this.head();
    const t = this.totals();
    this.error.set('');
    this.notice.set('');
    this.busy.set(true);
    this.crm.saveQuotation({
      quotationId: this.quotationId(), leadId: this.leadId(), quoteDate: h.quoteDate, validUntil: h.validUntil || null,
      isInterState: h.isInterState, terms: h.terms || null,
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
}
