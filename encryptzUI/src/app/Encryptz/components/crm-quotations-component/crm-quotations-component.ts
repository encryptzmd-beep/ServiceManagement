import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LeadSaveDto, QuotationListRowDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { CrmProductPickerComponent } from '../crm-shell-component/crm-product-picker-component';
import { FORBIDDEN, isoDate, pill, refusalOf, rupees, showDate } from '../crm-shell-component/crm-ui';

const PAGE_SIZE = 20;

/** /crm/quotations: every quotation the person may see, with search, status and date filters. */
@Component({
  selector: 'app-crm-quotations',
  standalone: true,
  imports: [FormsModule, RouterLink, CrmRefusedComponent, CrmProductPickerComponent],
  templateUrl: './crm-quotations-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-quotations-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmQuotationsComponent {
  private crm = inject(CrmService);
  private router = inject(Router);
  private route = inject(ActivatedRoute, { optional: true });

  readonly forbidden = FORBIDDEN;
  readonly statuses = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Superseded', 'Cancelled'];
  readonly pill = pill;
  readonly rupees = rupees;
  readonly showDate = showDate;

  search = signal('');
  status = signal('');
  from = signal('');
  to = signal('');

  rows = signal<QuotationListRowDto[] | null>(null);
  total = signal(0);
  page = signal(1);
  error = signal('');
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  /** Quotations per status under the other filters; null until read (the tabs then show no counts). */
  statusCounts = signal<Record<string, number> | null>(null);
  /** The status the list shows ('' = all), as last read. */
  shownStatus = signal('');
  readonly tabs = computed(() => {
    const counts = this.statusCounts();
    const shown = this.shownStatus();
    return [
      { key: '', label: 'All', count: counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null, on: shown === '' },
      ...this.statuses.map(s => ({ key: s, label: s, count: counts ? counts[s] ?? 0 : null, on: shown === s })),
    ];
  });
  readonly shownFrom = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1));
  readonly shownTo = computed(() => Math.min(this.total(), this.page() * PAGE_SIZE));
  readonly filtered = computed(() => !!(this.search().trim() || this.from() || this.to()));

  /** The "New quotation" dialog: a small lead form, because a quotation belongs to a lead. */
  newOpen = signal(false);
  nq = signal({ contactName: '', mobile: '', city: '', productCategory: '', productMasterId: null as number | null });
  nqError = signal('');
  nqSaving = signal(false);

  constructor() {
    this.apply();
    // the toolbar "New" of a quotation comes here with ?new=1: open the New quotation form
    if (this.route?.snapshot?.queryParamMap?.get('new') === '1') this.openNew();
  }

  openNew(): void {
    this.nq.set({ contactName: '', mobile: '', city: '', productCategory: '', productMasterId: null });
    this.nqError.set('');
    this.nqSaving.set(false);
    this.newOpen.set(true);
  }

  closeNew(): void { if (!this.nqSaving()) this.newOpen.set(false); }

  setNq<K extends keyof ReturnType<typeof this.nq>>(key: K, value: ReturnType<typeof this.nq>[K]): void {
    this.nq.update(f => ({ ...f, [key]: value }));
  }

  /** Creates the lead behind the quotation, then opens the quotation editor on it. */
  saveNew(): void {
    if (this.nqSaving()) return;
    const f = this.nq();
    if (!f.contactName.trim()) { this.nqError.set('Enter the contact name'); return; }
    if (f.mobile.replace(/\D/g, '').length < 10) { this.nqError.set('Enter a valid 10-digit mobile number'); return; }
    this.nqError.set('');
    this.nqSaving.set(true);
    // No owner: the server makes the caller the owner.
    const dto: LeadSaveDto = {
      leadId: 0, leadDate: isoDate(new Date()), contactName: f.contactName.trim(), mobile: f.mobile.trim(), city: f.city.trim(),
      productCategory: f.productCategory || null, productMasterId: f.productMasterId, priority: 'Medium', remarks: 'Created from a quotation',
    };
    this.crm.saveLead(dto).subscribe({
      next: res => {
        if (res.success && res.data) {
          // Stay locked while navigating; a refused navigation unlocks the dialog.
          this.router.navigate(['/crm/quotations/new'], { queryParams: { leadId: res.data } }).then(ok => { if (!ok) this.nqSaving.set(false); });
          return;
        }
        this.nqSaving.set(false);
        this.nqError.set(res.message || 'The lead could not be saved');
      },
      error: err => { this.nqSaving.set(false); this.nqError.set(refusalOf(err)); },
    });
  }

  /** Reads page 1 (or the page asked) with the filter as it stands. */
  apply(page = 1): void {
    this.page.set(page);
    this.rows.set(null);
    this.error.set('');
    const asked: Record<string, string | number> = { page, pageSize: PAGE_SIZE };
    if (this.search().trim()) asked['search'] = this.search().trim();
    if (this.status()) asked['status'] = this.status();
    if (this.from()) asked['from'] = this.from();
    if (this.to()) asked['to'] = this.to();
    this.shownStatus.set(this.status());
    // the tab counts: the same filters, every status (a failure only hides the counts)
    this.crm.getQuotationStatusCounts(asked).subscribe({
      next: res => this.statusCounts.set(res.success ? Object.fromEntries((res.data ?? []).map(c => [c.status, c.count])) : null),
      error: () => this.statusCounts.set(null),
    });
    this.crm.getQuotations(asked).subscribe({
      next: res => {
        if (!res.success) { this.rows.set([]); this.total.set(0); this.error.set(res.message || 'The quotations could not be read'); return; }
        const items = res.data?.items ?? [];
        this.rows.set(items);
        // A page past the last one has no rows, so no count: treat as 0.
        this.total.set(res.data?.totalCount ?? items[0]?.totalCount ?? 0);
      },
      error: err => { this.rows.set([]); this.total.set(0); this.error.set(refusalOf(err)); },
    });
  }

  goTo(page: number): void { this.apply(Math.min(Math.max(1, page), this.pages())); }

  /** A status tab: the other filters stay. */
  pickTab(status: string): void {
    this.status.set(status);
    this.apply();
  }

  /** A date changed: show the result at once (the search waits for Enter). */
  setDate(which: 'from' | 'to', value: string): void {
    (which === 'from' ? this.from : this.to).set(value || '');
    this.apply();
  }

  /** Clears search and dates; the status tab stays. */
  clear(): void {
    this.search.set('');
    this.from.set('');
    this.to.set('');
    this.apply();
  }
}
