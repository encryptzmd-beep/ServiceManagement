import { AppRightDirective } from '../shared/app-right/app-right';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { CrmMasterDto, CrmMemberDto, LEAD_STATUSES, LeadFilterDto, LeadListDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { CrmLeadDataComponent } from './crm-lead-data-component';
import { FORBIDDEN, pill, refusalOf, showDate, showDateTime } from '../crm-shell-component/crm-ui';

const PAGE_SIZE = 20;
const KEYS = ['search', 'status', 'sourceId', 'ownerUserId', 'from', 'to', 'due', 'closedFrom', 'closedTo', 'page'] as const;

/** /crm/leads: the leads the person may see, filtered by what is in the address (the dashboard sends its filter there). */
@Component({
  selector: 'app-crm-leads',
  standalone: true,
  imports: [AppRightDirective, FormsModule, RouterLink, CrmRefusedComponent, CrmLeadDataComponent],
  templateUrl: './crm-leads-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-leads-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmLeadsComponent {
  private crm = inject(CrmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly forbidden = FORBIDDEN;
  readonly statuses = LEAD_STATUSES;
  readonly pill = pill;
  readonly showDate = showDate;
  readonly showDateTime = showDateTime;

  isManager = signal(false);
  /** The signed-in tenant user, to know which leads are their own (they may delete those). */
  myUserId = signal(0);
  /** The lead waiting for "Delete?" to be confirmed, and whether the delete is under way. */
  deleting = signal<LeadListDto | null>(null);
  deleteBusy = signal(false);
  deleteError = signal('');
  sources = signal<CrmMasterDto[]>([]);
  owners = signal<CrmMemberDto[]>([]);

  /** The filter being edited; applied to the address with Apply. */
  filter = signal<LeadFilterDto>({});
  rows = signal<LeadListDto[] | null>(null);
  total = signal(0);
  page = signal(1);
  error = signal('');

  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  /** A status from the dashboard that is not one of the list ("Quotation,Negotiation"). */
  readonly extraStatus = computed(() => {
    const s = this.filter().status ?? '';
    return s && !(this.statuses as readonly string[]).includes(s) ? s : '';
  });

  /** Leads per status under the other filters; null until read (the tabs then show no counts). */
  statusCounts = signal<Record<string, number> | null>(null);
  /** The status the list shows (from the address), '' for all. */
  shownStatus = signal('');

  /** The status tabs: All, each status, and a combined one the dashboard may send ("Quotation + Negotiation"). */
  readonly tabs = computed(() => {
    const counts = this.statusCounts();
    const shown = this.shownStatus();
    const count = (statuses: string[]) => counts ? statuses.reduce((n, s) => n + (counts[s] ?? 0), 0) : null;
    const tabs: { key: string; label: string; count: number | null; on: boolean }[] = [
      { key: '', label: 'All', count: counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null, on: shown === '' },
    ];
    const extra = shown && !(this.statuses as readonly string[]).includes(shown) ? shown : '';
    if (extra) tabs.push({ key: extra, label: extra.split(',').join(' + '), count: count(extra.split(',')), on: true });
    for (const s of this.statuses) tabs.push({ key: s, label: s, count: count([s]), on: shown === s });
    return tabs;
  });

  /** First and last row number of the page, for "Showing 1–20 of 45". */
  readonly shownFrom = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1));
  readonly shownTo = computed(() => Math.min(this.total(), this.page() * PAGE_SIZE));

  /** Whether any filter other than the status is set (shows "Clear filters"). */
  readonly filtered = computed(() => {
    const f = this.filter();
    return !!(f.search || f.sourceId || f.ownerUserId || f.due || f.from || f.to || f.closedFrom || f.closedTo);
  });

  constructor() {
    this.crm.me().subscribe({ next: res => {
      const manager = !!(res.success && res.data?.isManager);
      this.isManager.set(manager);
      this.myUserId.set(res.success ? res.data?.userId ?? 0 : 0);
      if (manager) this.crm.getMembers().subscribe({ next: m => this.owners.set(m.success ? m.data?.members ?? [] : []), error: () => {} });
    }, error: () => {} });
    this.crm.getMasters('sources').subscribe({ next: res => this.sources.set(res.success ? res.data ?? [] : []), error: () => {} });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(q => this.load(this.fromQuery(q)));
  }

  private fromQuery(q: ParamMap): LeadFilterDto {
    const f: LeadFilterDto = {};
    const text = (k: string) => q.get(k) ?? undefined;
    const num = (k: string) => (q.get(k) && Number(q.get(k)) > 0 ? Number(q.get(k)) : undefined);
    f.search = text('search');
    f.status = text('status');
    f.sourceId = num('sourceId');
    f.ownerUserId = num('ownerUserId');
    f.from = text('from');
    f.to = text('to');
    f.due = text('due');
    f.closedFrom = text('closedFrom');
    f.closedTo = text('closedTo');
    f.page = num('page') ?? 1;
    return f;
  }

  /** New leads came from an Excel file. */
  reload(): void {
    this.load(this.fromQuery(this.route.snapshot.queryParamMap));
  }

  private load(f: LeadFilterDto): void {
    this.filter.set({ ...f });
    this.page.set(f.page ?? 1);
    this.shownStatus.set(f.status ?? '');
    this.rows.set(null);
    this.error.set('');
    const asked: LeadFilterDto = { ...f, page: f.page ?? 1, pageSize: PAGE_SIZE };
    for (const k of Object.keys(asked) as (keyof LeadFilterDto)[]) if (asked[k] === undefined) delete asked[k];
    // the tab counts: the same filters, every status (a failure only hides the counts)
    this.crm.getLeadStatusCounts(asked).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => this.statusCounts.set(res.success
        ? Object.fromEntries((res.data ?? []).map(c => [c.status, c.count]))
        : null),
      error: () => this.statusCounts.set(null),
    });
    this.crm.getLeads(asked).subscribe({
      next: res => {
        if (!res.success) { this.rows.set([]); this.error.set(res.message || 'The leads could not be read'); return; }
        const items = res.data?.items ?? [];
        this.rows.set(items);
        this.total.set(res.data?.totalCount ?? items[0]?.totalCount ?? items.length);
      },
      error: err => { this.rows.set([]); this.error.set(refusalOf(err)); },
    });
  }

  set<K extends keyof LeadFilterDto>(key: K, value: LeadFilterDto[K]): void {
    this.filter.update(f => ({ ...f, [key]: value === '' || value === null ? undefined : value }));
  }

  apply(page = 1): void {
    const f = { ...this.filter(), page };
    const queryParams: Record<string, string | null> = {};
    for (const k of KEYS) {
      const v = f[k];
      queryParams[k] = v === undefined || v === null || v === '' || (k === 'page' && v === 1) ? null : String(v);
    }
    this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  /** A filter select or date changed: show the result at once (the search waits for Enter). */
  setAndApply<K extends keyof LeadFilterDto>(key: K, value: LeadFilterDto[K]): void {
    this.set(key, value);
    this.apply();
  }

  /** A status tab: the other filters stay. */
  pickTab(status: string): void {
    this.set('status', status || undefined);
    this.apply();
  }

  /** Clears every filter but keeps the status tab. */
  clear(): void {
    const status = this.shownStatus();
    this.filter.set(status ? { status } : {});
    this.apply();
  }

  dueLabel(due?: string): string {
    return due === 'Today' ? "Today's follow-ups" : due === 'Overdue' ? 'Overdue follow-ups' : due === 'Pending' ? 'Follow-up pending' : '';
  }

  /** The next follow-up of an open lead, as text; closed leads (Converted, Lost) have none. */
  followUpOf(row: LeadListDto): string {
    if (!row.nextFollowUpAt || row.status === 'Converted' || row.status === 'Lost') return '';
    return showDateTime(row.nextFollowUpAt);
  }

  /** Delete is offered to the owner or a manager, never for a converted lead (the API checks the same). */
  canDelete(row: LeadListDto): boolean {
    if (row.status === 'Converted' || !!row.orderNo) return false;
    return this.isManager() || (this.myUserId() > 0 && row.ownerUserId === this.myUserId());
  }

  askDelete(row: LeadListDto): void {
    this.deleteError.set('');
    this.deleting.set(row);
  }

  cancelDelete(): void {
    if (this.deleteBusy()) return;
    this.deleting.set(null);
    this.deleteError.set('');
  }

  confirmDelete(): void {
    const row = this.deleting();
    if (!row || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.deleteError.set('');
    this.crm.deleteLead(row.leadId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.deleteBusy.set(false);
        if (!res.success) { this.deleteError.set(res.message || 'The lead could not be deleted'); return; }
        this.deleting.set(null);
        // the last row of a page that is not the first: go one page back
        const back = (this.rows()?.length ?? 0) <= 1 && this.page() > 1;
        if (back) this.apply(this.page() - 1); else this.load(this.fromQuery(this.route.snapshot.queryParamMap));
      },
      error: err => { this.deleteBusy.set(false); this.deleteError.set(refusalOf(err)); },
    });
  }

  isOverdue(row: LeadListDto): boolean {
    if (!row.nextFollowUpAt || row.status === 'Converted' || row.status === 'Lost') return false;
    const at = new Date(row.nextFollowUpAt);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return at < today;
  }
}
