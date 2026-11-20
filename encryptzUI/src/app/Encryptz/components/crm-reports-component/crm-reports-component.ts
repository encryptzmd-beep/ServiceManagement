import { ChangeDetectionStrategy, Component, computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { ApiResponse } from '../../Models/ApiModels';
import {
  CrmConversionRowDto, CrmFollowUpReportRowDto, CrmLostReasonRowDto, CrmMemberDto, CrmPipelineRowDto, CrmSourceRowDto,
  CrmTeamRowDto, QuotationListRowDto,
} from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, pill, refusalOf, rupees, showDate, showDateTime, thisMonth } from '../crm-shell-component/crm-ui';
import { CRM_REPORTS, ReportKey } from './crm-reports';
import { exportExcel, exportFileName, openPrint, printReportHtml, ReportColumn, ReportExport } from './crm-export';

/** The Excel file and the print window, behind a service so the specs never load exceljs or open a window. */
@Injectable({ providedIn: 'root' })
export class CrmReportExporter {
  excel<T>(r: ReportExport<T>): Promise<void> { return exportExcel(r); }
  print(html: string): void { openPrint(html); }
}

export type { ReportKey };
type GroupBy = 'source' | 'owner' | 'month';
type Row = Record<string, any>;
type Kind = 'text' | 'number' | 'money' | 'percent';

interface ReportTab { key: ReportKey; label: string; dates: boolean; owner: boolean; }

/** The reports in order (labels from the shared list). Pipeline is a snapshot of open leads now: no date range. */
const RULES: Record<ReportKey, { dates: boolean; owner: boolean }> = {
  followups: { dates: true, owner: true },
  conversion: { dates: true, owner: false },
  pipeline: { dates: false, owner: true },
  sources: { dates: true, owner: false },
  team: { dates: true, owner: true },
  lost: { dates: true, owner: true },
  quotations: { dates: true, owner: false },
};
export const REPORT_TABS: ReportTab[] = CRM_REPORTS.map(r => ({ key: r.key, label: r.label, ...RULES[r.key] }));

/** Most quotations the register reads in one go. */
const REGISTER_SIZE = 200;

/** A column of the table on screen; `sub` is a muted second line, `link` the route of the cell. */
interface Col { key: string; title: string; kind?: Kind; pill?: boolean; sub?: string; link?: (r: Row) => unknown[]; }
interface Bar { label: string; value: number; text: string; pct: number; }
interface Stat { label: string; value: string; }

interface ReportView {
  key: ReportKey;
  title: string;
  stats: Stat[];
  barTitle: string;
  bars: Bar[];
  cols: Col[];
  exportCols: ReportColumn<Row>[];
  rows: Row[];
  footer?: Row;
  empty: string;
  note?: string;
}

/** What was asked for the report on screen, kept with its rows so the export says the same. */
interface Asked { tab: ReportKey; from?: string; to?: string; ownerUserId?: number; groupBy: GroupBy; }
interface Loaded { asked: Asked; rows: any[]; total: number; }

const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
const pct1 = (part: number, whole: number) => (whole ? Math.round((part * 1000) / whole) / 10 : 0);
const count = (n: number) => n.toLocaleString('en-IN');

/** One bar per item, as a share of the largest. */
function barsOf(items: { label: string; value: number; text: string }[]): Bar[] {
  const max = Math.max(0, ...items.map(i => i.value));
  return items.map(i => ({ ...i, pct: max > 0 ? Math.round((Math.max(i.value, 0) * 1000) / max) / 10 : 0 }));
}

/** Rows grouped by a label, counted or summed. */
function groupBars(rows: Row[], label: (r: Row) => string, value: (r: Row) => number, text: (v: number) => string): Bar[] {
  const by = new Map<string, number>();
  for (const r of rows) by.set(label(r), (by.get(label(r)) ?? 0) + value(r));
  return barsOf([...by].sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ label: l, value: v, text: text(v) })));
}

/** Stacked-bar colours: a status or stage keeps its colour from the lists; the rest take PALETTE in turn. */
const SEGMENT_COLORS: Record<string, string> = {
  new: '#3b82f6', contacted: '#8b5cf6', qualified: '#0e9f9e', quotation: '#d97706', negotiation: '#db2777',
  converted: '#2d7a38', accepted: '#2d7a38', lost: '#d42b2b', rejected: '#d42b2b', cancelled: '#b42323',
  draft: '#94a3b8', sent: '#d97706', superseded: '#cbd5e1', other: '#cbd5e1',
};
const PALETTE = ['#1b4a7a', '#0e9f6e', '#d97706', '#7c3aed', '#0e7490', '#db2777'];

const text = (key: string, title: string): ReportColumn<Row> => ({ key, title, kind: 'text' });
const exp = (cols: Col[]): ReportColumn<Row>[] => cols.map(c => ({ key: c.key, title: c.title, kind: c.kind ?? 'text' }));

/** /crm/reports: seven reports with one filter bar, figures, bars, the table, Excel and PDF. */
@Component({
  selector: 'app-crm-reports',
  standalone: true,
  imports: [FormsModule, RouterLink, CrmRefusedComponent],
  templateUrl: './crm-reports-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-reports-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmReportsComponent {
  private crm = inject(CrmService);
  private auth = inject(AuthService);
  private exporter = inject(CrmReportExporter);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private title = inject(Title);

  readonly forbidden = FORBIDDEN;
  readonly pill = pill;

  tab = signal<ReportKey>('followups');
  from = signal(thisMonth().from);
  to = signal(thisMonth().to);
  ownerUserId = signal<number | null>(null);
  groupBy = signal<GroupBy>('source');

  isManager = signal(false);
  owners = signal<CrmMemberDto[]>([]);
  loaded = signal<Loaded | null>(null);
  error = signal('');
  private seq = 0;

  readonly current = computed(() => REPORT_TABS.find(t => t.key === this.tab())!);
  readonly showOwner = computed(() => this.current().owner && this.isManager());
  readonly view = computed(() => { const l = this.loaded(); return l ? this.viewOf(l) : null; });

  /** The search box of the table: narrows the rows on screen (Excel and PDF keep the whole report). */
  query = signal('');
  readonly shownRows = computed(() => {
    const v = this.view();
    if (!v) return [];
    const q = this.query().trim().toLowerCase();
    if (!q) return v.rows;
    return v.rows.filter(r => v.cols.some(c => this.cell(r, c).toLowerCase().includes(q) || (c.sub ? String(r[c.sub] ?? '').toLowerCase().includes(q) : false)));
  });

  /**
   * The breakdown as ONE stacked bar: each group's share of the whole, the six largest by name
   * and the rest as "Other". A status or stage keeps its own colour, anything else takes the palette.
   */
  readonly segments = computed(() => {
    const bars = this.view()?.bars ?? [];
    const total = bars.reduce((s, b) => s + Math.max(b.value, 0), 0);
    if (total <= 0) return [];
    const top = bars.slice(0, 6);
    const rest = bars.slice(6);
    const items = top.map(b => ({ label: b.label, value: b.value, text: b.text }));
    if (rest.length) {
      const v = rest.reduce((s, b) => s + Math.max(b.value, 0), 0);
      const money = rest.some(b => b.text.includes('₹'));
      items.push({ label: 'Other', value: v, text: money ? rupees(v) : count(v) });
    }
    return items.map((i, n) => ({
      ...i,
      pct: Math.round((Math.max(i.value, 0) * 1000) / total) / 10,
      color: SEGMENT_COLORS[i.label.toLowerCase()] ?? PALETTE[n % PALETTE.length],
    }));
  });
  readonly segmentTotal = computed(() => {
    const bars = this.view()?.bars ?? [];
    const v = bars.reduce((s, b) => s + Math.max(b.value, 0), 0);
    return bars.some(b => b.text.includes('₹')) ? rupees(v) : count(v);
  });

  /** A filter changed: read the report again at once (there is no Show button). */
  setFilter(which: 'from' | 'to' | 'owner', value: string): void {
    if (which === 'from') this.from.set(value || '');
    else if (which === 'to') this.to.set(value || '');
    else this.ownerUserId.set(value ? +value : null);
    this.run();
  }

  private readonly companyName = computed(() => {
    const id = this.auth.selectedCompanyId();
    return this.auth.companies().find(c => c.companyId === id)?.companyName ?? '';
  });

  constructor() {
    this.crm.me().subscribe({ next: res => {
      const manager = !!(res.success && res.data?.isManager);
      this.isManager.set(manager);
      if (manager) this.crm.getMembers().subscribe({ next: m => this.owners.set(m.success ? m.data?.members ?? [] : []), error: () => {} });
    }, error: () => {} });
    // the component is reused when moving between reports: follow the :report parameter
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const key = p.get('report') as ReportKey;
      if (!REPORT_TABS.some(t => t.key === key)) {
        this.router.navigate(['/crm/reports', 'followups'], { replaceUrl: true });
        return;
      }
      this.tab.set(key);
      this.query.set('');
      this.title.setTitle('CRM · ' + this.current().label);
      this.run();
    });
  }

  /** Reads the report of the tab with the filter as it stands; an older answer arriving late is dropped. */
  run(): void {
    const t = this.current();
    const asked: Asked = {
      tab: t.key,
      from: t.dates ? this.from() || undefined : undefined,
      to: t.dates ? this.to() || undefined : undefined,
      ownerUserId: t.owner && this.isManager() ? this.ownerUserId() ?? undefined : undefined,
      groupBy: this.groupBy(),
    };
    const seq = ++this.seq;
    this.loaded.set(null);
    this.error.set('');
    this.fetch(asked).subscribe({
      next: res => {
        if (seq !== this.seq) return;
        if (!res.success) {
          this.error.set(res.message || 'The report could not be read');
          this.loaded.set({ asked, rows: [], total: 0 });
          return;
        }
        const paged = asked.tab === 'quotations';
        const rows = (paged ? res.data?.items : res.data) ?? [];
        this.loaded.set({ asked, rows, total: paged ? res.data?.totalCount ?? rows.length : rows.length });
      },
      error: err => {
        if (seq !== this.seq) return;
        this.loaded.set({ asked, rows: [], total: 0 });
        this.error.set(refusalOf(err));
      },
    });
  }

  private fetch(a: Asked): Observable<ApiResponse<any>> {
    const range = { from: a.from, to: a.to };
    switch (a.tab) {
      case 'conversion': return this.crm.conversionReport({ ...range, groupBy: a.groupBy });
      case 'pipeline': return this.crm.pipelineReport(a.ownerUserId);
      case 'sources': return this.crm.sourcesReport(range);
      case 'team': return this.crm.teamReport({ ...range, ownerUserId: a.ownerUserId });
      case 'lost': return this.crm.lostReasonsReport({ ...range, ownerUserId: a.ownerUserId });
      case 'quotations': return this.crm.getQuotations({ ...range, page: 1, pageSize: REGISTER_SIZE });
      default: return this.crm.followUpReport({ ...range, ownerUserId: a.ownerUserId });
    }
  }

  /** What a table cell shows. */
  cell(r: Row, c: Col): string {
    const v = r[c.key];
    if (v === null || v === undefined || v === '') return '';
    if (c.kind === 'money') return rupees(Number(v));
    if (c.kind === 'percent') return `${Math.round(Number(v) * 10) / 10}%`;
    if (c.kind === 'number') return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 1 });
    return String(v);
  }

  private viewOf(l: Loaded): ReportView {
    const title = REPORT_TABS.find(t => t.key === l.asked.tab)!.label;
    switch (l.asked.tab) {
      case 'conversion': return { key: 'conversion', title, ...this.conversionView(l.rows, l.asked.groupBy) };
      case 'pipeline': return { key: 'pipeline', title, ...this.pipelineView(l.rows) };
      case 'sources': return { key: 'sources', title, ...this.sourcesView(l.rows) };
      case 'team': return { key: 'team', title, ...this.teamView(l.rows) };
      case 'lost': return { key: 'lost', title, ...this.lostView(l.rows) };
      case 'quotations': return { key: 'quotations', title, ...this.quotationsView(l.rows, l.total) };
      default: return { key: 'followups', title, ...this.followUpsView(l.rows) };
    }
  }

  private followUpsView(src: CrmFollowUpReportRowDto[]): Omit<ReportView, 'key' | 'title'> {
    const rows: Row[] = src.map(r => ({
      leadId: r.leadId, date: showDateTime(r.followUpAt), leadNo: r.leadNo, contactName: r.contactName, mobile: r.mobile,
      contact: [r.contactName, r.mobile].filter(Boolean).join(' · '), type: r.type, notes: r.notes, remarks: r.remarks,
      next: showDateTime(r.nextFollowUpAt), nextAction: r.nextAction, userName: r.userName, ownerName: r.ownerName, leadStatus: r.leadStatus,
    }));
    const leads = new Set(src.map(r => r.leadId));
    const converted = new Set(src.filter(r => r.leadStatus === 'Converted').map(r => r.leadId));
    return {
      stats: [
        { label: 'Follow-ups', value: count(src.length) },
        { label: 'Leads followed up', value: count(leads.size) },
        { label: 'Of them converted', value: count(converted.size) },
      ],
      barTitle: 'Follow-ups by type',
      bars: groupBars(rows, r => r['type'] || 'Other', () => 1, count),
      cols: [
        { key: 'date', title: 'Date' },
        { key: 'leadNo', title: 'Lead', sub: 'contact', link: r => ['/crm/leads', r['leadId']] },
        { key: 'type', title: 'Type' },
        { key: 'notes', title: 'Notes', sub: 'remarks' },
        { key: 'next', title: 'Next', sub: 'nextAction' },
        { key: 'userName', title: 'By' },
        { key: 'ownerName', title: 'Owner' },
        { key: 'leadStatus', title: 'Status', pill: true },
      ],
      exportCols: [
        text('date', 'Date'), text('leadNo', 'Lead'), text('contactName', 'Contact'), text('mobile', 'Mobile'), text('type', 'Type'),
        text('notes', 'Notes'), text('remarks', 'Remarks'), text('next', 'Next follow-up'), text('nextAction', 'Next action'),
        text('userName', 'By'), text('ownerName', 'Owner'), text('leadStatus', 'Lead status'),
      ],
      rows,
      empty: 'No follow-up in this period.',
    };
  }

  private conversionView(src: CrmConversionRowDto[], groupBy: GroupBy): Omit<ReportView, 'key' | 'title'> {
    const rows: Row[] = src.map(r => ({ label: this.groupLabel(r, groupBy), leads: r.leads, converted: r.converted, conversionPct: r.conversionPct, convertedValue: r.convertedValue }));
    const leads = sum(rows, 'leads');
    const converted = sum(rows, 'converted');
    const value = sum(rows, 'convertedValue');
    const cols: Col[] = [
      { key: 'label', title: groupBy === 'owner' ? 'Owner' : groupBy === 'month' ? 'Month' : 'Source' },
      { key: 'leads', title: 'Leads', kind: 'number' },
      { key: 'converted', title: 'Converted', kind: 'number' },
      { key: 'conversionPct', title: 'Conversion', kind: 'percent' },
      { key: 'convertedValue', title: 'Converted value', kind: 'money' },
    ];
    return {
      stats: [
        { label: 'Leads', value: count(leads) },
        { label: 'Converted', value: count(converted) },
        { label: 'Conversion', value: `${pct1(converted, leads)}%` },
        { label: 'Converted value', value: rupees(value) },
      ],
      barTitle: 'Converted',
      bars: barsOf(rows.map(r => ({ label: r['label'], value: r['converted'], text: `${count(r['converted'])} of ${count(r['leads'])}` }))),
      cols,
      exportCols: exp(cols),
      rows,
      footer: rows.length > 1 ? { label: 'All', leads, converted, conversionPct: pct1(converted, leads), convertedValue: value } : undefined,
      empty: 'No lead in this period.',
    };
  }

  private groupLabel(r: CrmConversionRowDto, g: GroupBy): string {
    if (g === 'owner') return r.ownerName || '–';
    if (g === 'month') {
      if (!r.month) return '–';
      const [y, m] = r.month.split('-').map(Number);
      return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    }
    return r.sourceName || 'No source';
  }

  private pipelineView(src: CrmPipelineRowDto[]): Omit<ReportView, 'key' | 'title'> {
    const rows: Row[] = src.map(r => ({ ...r }));
    const leads = sum(rows, 'leads');
    const days = leads ? Math.round((rows.reduce((s, r) => s + r['leads'] * r['avgDaysInStage'], 0) * 10) / leads) / 10 : 0;
    const cols: Col[] = [
      { key: 'status', title: 'Stage', pill: true },
      { key: 'leads', title: 'Leads', kind: 'number' },
      { key: 'quotationValue', title: 'Quotation value', kind: 'money' },
      { key: 'avgDaysInStage', title: 'Average days in stage', kind: 'number' },
    ];
    return {
      stats: [
        { label: 'Open leads', value: count(leads) },
        { label: 'Quotation value', value: rupees(sum(rows, 'quotationValue')) },
        { label: 'Average days in stage', value: String(days) },
      ],
      barTitle: 'Open leads by stage',
      bars: barsOf(rows.map(r => ({ label: r['status'], value: r['leads'], text: count(r['leads']) }))),
      cols,
      exportCols: exp(cols),
      rows,
      empty: 'No open lead.',
    };
  }

  private sourcesView(src: CrmSourceRowDto[]): Omit<ReportView, 'key' | 'title'> {
    const rows: Row[] = src.map(r => ({ ...r, sourceName: r.sourceName || 'No source' }));
    const leads = sum(rows, 'leads');
    const converted = sum(rows, 'converted');
    const cols: Col[] = [
      { key: 'sourceName', title: 'Source' },
      { key: 'leads', title: 'Leads', kind: 'number' },
      { key: 'converted', title: 'Converted', kind: 'number' },
      { key: 'lost', title: 'Lost', kind: 'number' },
      { key: 'openLeads', title: 'Open', kind: 'number' },
      { key: 'conversionPct', title: 'Conversion', kind: 'percent' },
      { key: 'convertedValue', title: 'Converted value', kind: 'money' },
    ];
    return {
      stats: [
        { label: 'Leads', value: count(leads) },
        { label: 'Converted', value: count(converted) },
        { label: 'Conversion', value: `${pct1(converted, leads)}%` },
        { label: 'Converted value', value: rupees(sum(rows, 'convertedValue')) },
      ],
      barTitle: 'Leads by source',
      bars: barsOf(rows.map(r => ({ label: r['sourceName'], value: r['leads'], text: count(r['leads']) }))),
      cols,
      exportCols: exp(cols),
      rows,
      empty: 'No lead in this period.',
    };
  }

  private teamView(src: CrmTeamRowDto[]): Omit<ReportView, 'key' | 'title'> {
    const rows: Row[] = src.map(r => ({ ...r }));
    const cols: Col[] = [
      { key: 'ownerName', title: 'Owner' },
      { key: 'leads', title: 'Leads', kind: 'number' },
      { key: 'followUpsDone', title: 'Follow-ups done', kind: 'number' },
      { key: 'overdueNow', title: 'Overdue now', kind: 'number' },
      { key: 'converted', title: 'Converted', kind: 'number' },
      { key: 'lost', title: 'Lost', kind: 'number' },
      { key: 'convertedValue', title: 'Converted value', kind: 'money' },
    ];
    return {
      stats: [
        { label: 'Leads', value: count(sum(rows, 'leads')) },
        { label: 'Follow-ups done', value: count(sum(rows, 'followUpsDone')) },
        { label: 'Overdue now', value: count(sum(rows, 'overdueNow')) },
        { label: 'Converted value', value: rupees(sum(rows, 'convertedValue')) },
      ],
      barTitle: 'Converted value by owner',
      bars: barsOf(rows.map(r => ({ label: r['ownerName'], value: r['convertedValue'], text: rupees(r['convertedValue']) }))),
      cols,
      exportCols: exp(cols),
      rows,
      empty: 'No lead in this period.',
    };
  }

  private lostView(src: CrmLostReasonRowDto[]): Omit<ReportView, 'key' | 'title'> {
    const rows: Row[] = src.map(r => ({ ...r, reasonName: r.reasonName || 'No reason' }));
    const top = [...rows].sort((a, b) => b['leads'] - a['leads'])[0];
    const cols: Col[] = [
      { key: 'reasonName', title: 'Reason' },
      { key: 'leads', title: 'Leads', kind: 'number' },
      { key: 'pctOfLost', title: '% of lost', kind: 'percent' },
      { key: 'valueLost', title: 'Quotation value lost', kind: 'money' },
    ];
    return {
      stats: [
        { label: 'Lost leads', value: count(sum(rows, 'leads')) },
        { label: 'Quotation value lost', value: rupees(sum(rows, 'valueLost')) },
        { label: 'Top reason', value: top ? top['reasonName'] : '–' },
      ],
      barTitle: 'Lost leads by reason',
      bars: barsOf(rows.map(r => ({ label: r['reasonName'], value: r['leads'], text: count(r['leads']) }))),
      cols,
      exportCols: exp(cols),
      rows,
      empty: 'No lead lost in this period.',
    };
  }

  private quotationsView(src: QuotationListRowDto[], total: number): Omit<ReportView, 'key' | 'title'> {
    const rows: Row[] = src.map(r => ({
      quotationId: r.quotationId, leadId: r.leadId, quotationNo: r.quotationNo, revisionNo: r.revisionNo,
      quote: r.revisionNo > 1 ? `${r.quotationNo} rev ${r.revisionNo}` : r.quotationNo,
      date: showDate(r.quoteDate), leadNo: r.leadNo, contactName: r.contactName, ownerName: r.ownerName,
      status: r.status, grandTotal: r.grandTotal, ageDays: r.ageDays,
    }));
    const partial = total > rows.length;
    const accepted = rows.filter(r => r['status'] === 'Accepted');
    const open = rows.filter(r => r['status'] === 'Draft' || r['status'] === 'Sent');
    return {
      stats: [
        { label: 'Quotations', value: count(total) },
        { label: partial ? 'Value of shown' : 'Total value', value: rupees(sum(rows, 'grandTotal')) },
        { label: 'Open (draft or sent)', value: count(open.length) },
        { label: partial ? 'Accepted value of shown' : 'Accepted value', value: rupees(sum(accepted, 'grandTotal')) },
      ],
      barTitle: 'Value by status',
      bars: groupBars(rows, r => r['status'], r => Number(r['grandTotal']) || 0, rupees),
      cols: [
        { key: 'quote', title: 'Quotation', link: r => ['/crm/quotations', r['quotationId']] },
        { key: 'date', title: 'Date' },
        { key: 'leadNo', title: 'Lead', sub: 'contactName', link: r => ['/crm/leads', r['leadId']] },
        { key: 'ownerName', title: 'Owner' },
        { key: 'status', title: 'Status', pill: true },
        { key: 'grandTotal', title: 'Grand total', kind: 'money' },
        { key: 'ageDays', title: 'Age (days)', kind: 'number' },
      ],
      exportCols: [
        text('quotationNo', 'Quotation'), { key: 'revisionNo', title: 'Rev', kind: 'number' }, text('date', 'Date'), text('leadNo', 'Lead'),
        text('contactName', 'Contact'), text('ownerName', 'Owner'), text('status', 'Status'),
        { key: 'grandTotal', title: 'Grand total', kind: 'money' }, { key: 'ageDays', title: 'Age in days', kind: 'number' },
      ],
      rows,
      empty: 'No quotation in this period.',
      note: partial ? `Showing the first ${count(rows.length)} of ${count(total)} quotations. Narrow the dates to see the rest.` : undefined,
    };
  }

  /** The filters of the report on screen, in words, for the export. */
  private filtersOf(a: Asked, v: ReportView): string {
    const t = REPORT_TABS.find(x => x.key === a.tab)!;
    const parts: string[] = [];
    if (!t.dates) parts.push('Open leads now');
    else if (a.from || a.to) parts.push(`From ${a.from ? showDate(a.from) : 'the start'} to ${a.to ? showDate(a.to) : 'today'}`);
    else parts.push('All dates');
    if (a.tab === 'conversion') parts.push(`By ${a.groupBy}`);
    if (t.owner) {
      if (!this.isManager()) parts.push('Your own leads');
      else parts.push(`Owner: ${a.ownerUserId ? this.owners().find(o => o.userId === a.ownerUserId)?.fullName ?? a.ownerUserId : 'Everyone'}`);
    }
    if (v.note) parts.push(v.note);
    return parts.join(' · ');
  }

  private exportOf(): ReportExport<Row> | null {
    const l = this.loaded();
    const v = this.view();
    if (!l || !v) return null;
    const dated = REPORT_TABS.find(t => t.key === l.asked.tab)!.dates;
    return {
      key: v.key,
      title: v.title,
      filters: this.filtersOf(l.asked, v),
      columns: v.exportCols,
      rows: v.footer ? [...v.rows, v.footer] : v.rows,
      companyName: this.companyName(),
      fileName: dated ? exportFileName(v.key, l.asked.from, l.asked.to) : exportFileName(v.key),
    };
  }

  excel(): void {
    const r = this.exportOf();
    if (r) this.exporter.excel(r).catch(() => this.error.set('The Excel file could not be made. Try again'));
  }

  pdf(): void {
    const r = this.exportOf();
    if (r) this.exporter.print(printReportHtml(r, new Date()));
  }
}
