import { ChangeDetectionStrategy, Component, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Observable, catchError, expand, forkJoin, map, of, reduce } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { ApiResponse } from '../../Models/ApiModels';
import { CompanyJobsService } from '../../Services/company-jobs-service';
import { ConsultancyService, OwnCandidate, OwnCandidateList } from '../../Services/consultancy-service';
import { ReportColumn, ReportExport, exportExcel, openPrint, printReportHtml } from '../crm-reports-component/crm-export';
import { CONSULTANCY_REPORTS, ConsultancyReportKey, ReportData, ReportRow, buildReport, rupees } from './consultancy-insights';

const REFUSED = "You don't have access to Job Consultancy. Ask your administrator";
const FAILED = 'The report could not be read. Please try again.';
/** The own-candidate list is paged: read at most this many pages for a report. */
const MAX_OWN_PAGES = 50;

/** The Excel file and the print window, behind a service so the specs never load exceljs or open a window. */
@Injectable({ providedIn: 'root' })
export class ConsultancyReportExporter {
  excel<T>(r: ReportExport<T>): Promise<void> { return exportExcel(r); }
  print(html: string): void { openPrint(html); }
}

/** Job Consultancy, Reports (/consultancy/reports/:report): one page, one report per side-menu entry. */
@Component({
  selector: 'app-consultancy-reports',
  standalone: true,
  templateUrl: './consultancy-reports-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './consultancy-reports-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultancyReportsComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private jobs = inject(CompanyJobsService);
  private api = inject(ConsultancyService);
  private exporter = inject(ConsultancyReportExporter);
  private destroyRef = inject(DestroyRef);

  loading = signal(true);
  error = signal('');
  data = signal<ReportData | null>(null);
  query = signal('');
  from = signal('');
  to = signal('');

  private readonly reportParam = toSignal(this.route.paramMap.pipe(map(p => p.get('report'))), { initialValue: this.route.snapshot.paramMap.get('report') });

  readonly current = computed(() => CONSULTANCY_REPORTS.find(r => r.key === this.reportParam()) ?? CONSULTANCY_REPORTS[0]);

  readonly view = computed(() => {
    const d = this.data();
    return d ? buildReport(this.current().key as ConsultancyReportKey, d, new Date(), this.from(), this.to()) : null;
  });

  readonly shownRows = computed(() => {
    const v = this.view();
    if (!v) return [];
    const q = this.query().trim().toLowerCase();
    return q ? v.rows.filter(r => v.columns.some(c => String(r[c.key] ?? '').toLowerCase().includes(q))) : v.rows;
  });

  constructor() {
    if (!this.auth.scopeState().companyId) { this.router.navigate(['/select-company']); return; }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      postings: this.read(this.jobs.getPostings(), []),
      postingClients: this.read(this.api.getPostingClients(), []),
      clients: this.read(this.api.getClients(), []),
      placements: this.read(this.api.getPlacements(), { items: [], thisMonth: 0, total: 0, feeOutstanding: 0, feePaidThisYear: 0 }),
      matchCounts: this.read(this.api.getPostingMatchCounts(), []).pipe(catchError(() => of([]))),   // only one column depends on it
      own: this.allOwnCandidates(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        this.data.set({
          postings: r.postings, postingClients: r.postingClients, clients: r.clients, placements: r.placements.items,
          matchCounts: r.matchCounts, ownCandidates: r.own.items, ownTotal: r.own.total,
        });
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.status === 403 ? err.error?.message || REFUSED : err?.reason || FAILED);
      },
    });
  }

  /** A refusal in the answer (success: false) fails the report with the reason the API gave. */
  private read<T>(call: Observable<ApiResponse<T>>, none: T): Observable<T> {
    return call.pipe(map(res => {
      if (!res.success) throw { reason: res.message || FAILED };
      return res.data ?? none;
    }));
  }

  private allOwnCandidates(): Observable<{ items: OwnCandidate[]; total: number }> {
    const page = (n: number) => this.read<OwnCandidateList>(this.api.getOwnCandidates('', n), { items: [], total: 0, page: n, pageSize: 0 });
    return page(1).pipe(
      expand(d => (d.items.length && d.page * d.pageSize < d.total && d.page < MAX_OWN_PAGES ? page(d.page + 1) : EMPTY)),
      reduce((all, d) => ({ items: [...all.items, ...d.items], total: d.total }), { items: [] as OwnCandidate[], total: 0 }),
      catchError(() => of({ items: [] as OwnCandidate[], total: 0 })),   // the other five reports do not need them
    );
  }

  isNumeric(c: ReportColumn<ReportRow>): boolean {
    return c.kind === 'number' || c.kind === 'money' || c.kind === 'percent';
  }

  cell(row: ReportRow, c: ReportColumn<ReportRow>): string {
    const v = row[c.key];
    if (v === null || v === undefined || v === '') return '—';
    if (c.kind === 'money') return rupees(Number(v));
    if (c.kind === 'percent') return `${v}%`;
    return String(v);
  }

  clearFilters(): void {
    this.query.set('');
    this.from.set('');
    this.to.set('');
  }

  private exportOf(): ReportExport<ReportRow> | null {
    const v = this.view();
    if (!v) return null;
    const id = this.auth.selectedCompanyId?.();
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const range = v.dated && (this.from() || this.to()) ? `Joined ${this.from() || '…'} to ${this.to() || '…'}` : 'As of today';
    return {
      key: v.key, title: v.title, filters: this.query().trim() ? `${range} · Search: ${this.query().trim()}` : range,
      columns: v.columns, rows: this.shownRows(),
      companyName: this.auth.companies?.().find(c => c.companyId === id)?.companyName ?? '',
      fileName: `Consultancy-${v.key}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.xlsx`,
    };
  }

  excel(): void {
    const r = this.exportOf();
    if (r) this.exporter.excel(r).catch(() => this.error.set('The Excel file could not be made. Please try again.'));
  }

  pdf(): void {
    const r = this.exportOf();
    if (r) this.exporter.print(printReportHtml(r, new Date()));
  }
}
