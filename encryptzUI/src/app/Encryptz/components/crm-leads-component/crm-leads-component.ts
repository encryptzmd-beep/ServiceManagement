import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { CrmMasterDto, CrmMemberDto, LEAD_STATUSES, LeadFilterDto, LeadListDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, pill, refusalOf, showDate, showDateTime } from '../crm-shell-component/crm-ui';

const PAGE_SIZE = 20;
const KEYS = ['search', 'status', 'sourceId', 'ownerUserId', 'from', 'to', 'due', 'closedFrom', 'closedTo', 'page'] as const;

/** /crm/leads: the leads the person may see, filtered by what is in the address (the dashboard sends its filter there). */
@Component({
  selector: 'app-crm-leads',
  standalone: true,
  imports: [FormsModule, RouterLink, CrmRefusedComponent],
  templateUrl: './crm-leads-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss'],
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

  constructor() {
    this.crm.me().subscribe({ next: res => {
      const manager = !!(res.success && res.data?.isManager);
      this.isManager.set(manager);
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

  private load(f: LeadFilterDto): void {
    this.filter.set({ ...f });
    this.page.set(f.page ?? 1);
    this.rows.set(null);
    this.error.set('');
    const asked: LeadFilterDto = { ...f, page: f.page ?? 1, pageSize: PAGE_SIZE };
    for (const k of Object.keys(asked) as (keyof LeadFilterDto)[]) if (asked[k] === undefined) delete asked[k];
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

  clear(): void {
    this.filter.set({});
    this.apply();
  }

  dueLabel(due?: string): string {
    return due === 'Today' ? "Today's follow-ups" : due === 'Overdue' ? 'Overdue follow-ups' : due === 'Pending' ? 'Follow-up pending' : '';
  }

  isOverdue(row: LeadListDto): boolean {
    if (!row.nextFollowUpAt || row.status === 'Converted' || row.status === 'Lost') return false;
    const at = new Date(row.nextFollowUpAt);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return at < today;
  }
}
