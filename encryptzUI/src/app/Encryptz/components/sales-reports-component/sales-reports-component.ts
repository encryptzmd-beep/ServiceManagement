import { ChangeDetectionStrategy, Component, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Observable, catchError, expand, forkJoin, map, of, reduce } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { PagedResult, ServiceDespatchItem } from '../../Models/ApiModels';
import { ApiService } from '../../Services/API/api-service';
import { ReportColumn, ReportExport, exportExcel, openPrint, printReportHtml } from '../crm-reports-component/crm-export';
import { DESPATCH_REPORT_KEYS, SALES_REPORTS, SalesReportData, SalesReportRow, buildSalesReport, reportsBeside, rupees } from './sales-reports';

/** The API gives at most 200 rows a page; a report reads at most this many pages. */
const PAGE_SIZE = 200;
const MAX_PAGES = 50;

/** The Excel file and the print window, behind a service so the specs never load exceljs or open a window. */
@Injectable({ providedIn: 'root' })
export class SalesReportExporter {
  excel<T>(r: ReportExport<T>): Promise<void> { return exportExcel(r); }
  print(html: string): void { openPrint(html); }
}

/** Sales, Reports (/sales/reports/:report): one page, one report per entry of the Sales menu. */
@Component({
  selector: 'app-sales-reports',
  standalone: true,
  templateUrl: './sales-reports-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './sales-reports-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesReportsComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private exporter = inject(SalesReportExporter);
  private destroyRef = inject(DestroyRef);

  /** The tabs: the Sales reports, or the reports of the Despatch menu. */
  readonly reports = computed(() => reportsBeside(this.current().key));
  readonly isDespatchReport = computed(() => DESPATCH_REPORT_KEYS.includes(this.current().key));
  loading = signal(true);
  error = signal('');
  /** More rows exist than a report reads. */
  partial = signal(false);
  data = signal<SalesReportData | null>(null);
  query = signal('');
  from = signal('');
  to = signal('');

  private readonly param = toSignal(this.route.paramMap.pipe(map(p => p.get('report'))), { initialValue: this.route.snapshot.paramMap.get('report') });
  readonly current = computed(() => SALES_REPORTS.find(r => r.key === this.param()) ?? SALES_REPORTS[0]);

  readonly view = computed(() => {
    const d = this.data();
    return d ? buildSalesReport(this.current().key, d, new Date(), this.from(), this.to()) : null;
  });

  readonly shownRows = computed(() => {
    const v = this.view();
    if (!v) return [];
    const q = this.query().trim().toLowerCase();
    return q ? v.rows.filter(r => v.columns.some(c => String(r[c.key] ?? '').toLowerCase().includes(q))) : v.rows;
  });

  constructor() { this.load(); }

  go(key: string): void {
    this.router.navigate(['/sales/reports', key]);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      orders: this.all(page => this.api.getSalesOrders({ pageNumber: page, pageSize: PAGE_SIZE })),
      despatches: this.all(page => this.api.getDespatches({ pageNumber: page, pageSize: PAGE_SIZE })),
      servicePending: this.serviceRows('Pending'),
      serviceDespatched: this.serviceRows('Despatched'),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        this.data.set({
          orders: r.orders.items, despatches: r.despatches.items,
          servicePending: r.servicePending, serviceDespatched: r.serviceDespatched,
        });
        this.partial.set(r.orders.items.length < r.orders.total || r.despatches.items.length < r.despatches.total);
        this.loading.set(false);
      },
      error: e => {
        this.loading.set(false);
        this.error.set(e?.status === 403 ? 'You do not have access to the Sales reports.' : e?.error?.message || 'The report could not be read. Please try again.');
      },
    });
  }

  /** Spare and repaired parts; a database without script 25 still shows the sales rows. */
  private serviceRows(stage: 'Pending' | 'Despatched'): Observable<ServiceDespatchItem[]> {
    if (typeof this.api.getServiceDespatches !== 'function') return of([]);
    return this.all(page => this.api.getServiceDespatches({ stage, pageNumber: page, pageSize: PAGE_SIZE })
      .pipe(map(r => r?.data ?? ({ items: [], totalCount: 0 } as unknown as PagedResult<ServiceDespatchItem>)))).pipe(
      map(r => r.items),
      catchError(() => of([])),
    );
  }

  private all<T>(read: (page: number) => Observable<PagedResult<T>>): Observable<{ items: T[]; total: number }> {
    let page = 1;
    return read(page).pipe(
      expand(r => {
        const more = (r.items?.length ?? 0) > 0 && page * PAGE_SIZE < (r.totalCount ?? 0) && page < MAX_PAGES;
        return more ? read(++page) : EMPTY;
      }),
      reduce((all, r) => ({ items: [...all.items, ...(r.items ?? [])], total: r.totalCount ?? 0 }), { items: [] as T[], total: 0 }),
    );
  }

  isNumeric(c: ReportColumn<SalesReportRow>): boolean {
    return c.kind === 'number' || c.kind === 'money' || c.kind === 'percent';
  }

  cell(row: SalesReportRow, c: ReportColumn<SalesReportRow>): string {
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

  private exportOf(): ReportExport<SalesReportRow> | null {
    const v = this.view();
    if (!v) return null;
    const id = this.auth.selectedCompanyId?.();
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const range = v.dated && (this.from() || this.to()) ? `${this.from() || '…'} to ${this.to() || '…'}` : v.dated ? 'All dates' : 'As of today';
    return {
      key: v.key, title: v.title, filters: this.query().trim() ? `${range} · Search: ${this.query().trim()}` : range,
      columns: v.columns, rows: this.shownRows(),
      companyName: this.auth.companies?.().find(c => c.companyId === id)?.companyName ?? '',
      fileName: `${this.isDespatchReport() ? 'Despatch' : 'Sales'}-${v.key}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.xlsx`,
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
