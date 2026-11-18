import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CrmConversionRowDto, CrmFollowUpReportRowDto, CrmMemberDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, pill, refusalOf, rupees, showDateTime, thisMonth } from '../crm-shell-component/crm-ui';

type GroupBy = 'source' | 'owner' | 'month';

/** /crm/reports: the follow-ups logged in a period, and how many leads became sales (by source, owner or month). */
@Component({
  selector: 'app-crm-reports',
  standalone: true,
  imports: [FormsModule, RouterLink, CrmRefusedComponent],
  templateUrl: './crm-reports-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmReportsComponent {
  private crm = inject(CrmService);

  readonly forbidden = FORBIDDEN;
  readonly pill = pill;
  readonly rupees = rupees;
  readonly showDateTime = showDateTime;

  tab = signal<'followups' | 'conversion'>('followups');
  from = signal(thisMonth().from);
  to = signal(thisMonth().to);
  ownerUserId = signal<number | null>(null);
  groupBy = signal<GroupBy>('source');

  isManager = signal(false);
  owners = signal<CrmMemberDto[]>([]);
  followUps = signal<CrmFollowUpReportRowDto[] | null>(null);
  conversion = signal<CrmConversionRowDto[] | null>(null);
  error = signal('');

  readonly conversionTotal = computed(() => {
    const rows = this.conversion() ?? [];
    const leads = rows.reduce((s, r) => s + r.leads, 0);
    const converted = rows.reduce((s, r) => s + r.converted, 0);
    return { leads, converted, pct: leads ? Math.round((converted * 1000) / leads) / 10 : 0, value: rows.reduce((s, r) => s + r.convertedValue, 0) };
  });

  constructor() {
    this.crm.me().subscribe({ next: res => {
      const manager = !!(res.success && res.data?.isManager);
      this.isManager.set(manager);
      if (manager) this.crm.getMembers().subscribe({ next: m => this.owners.set(m.success ? m.data?.members ?? [] : []), error: () => {} });
    }, error: () => {} });
    this.loadFollowUps();
  }

  private fail(err: unknown): void {
    this.error.set(refusalOf(err));
  }

  show(tab: 'followups' | 'conversion'): void {
    this.tab.set(tab);
    this.run();
  }

  run(): void {
    if (this.tab() === 'conversion') this.loadConversion(); else this.loadFollowUps();
  }

  loadFollowUps(): void {
    this.followUps.set(null);
    this.error.set('');
    this.crm.followUpReport({ from: this.from() || undefined, to: this.to() || undefined, ownerUserId: this.ownerUserId() ?? undefined }).subscribe({
      next: res => { this.followUps.set(res.success ? res.data ?? [] : []); if (!res.success) this.error.set(res.message); },
      error: err => { this.followUps.set([]); this.fail(err); },
    });
  }

  loadConversion(): void {
    this.conversion.set(null);
    this.error.set('');
    this.crm.conversionReport({ from: this.from() || undefined, to: this.to() || undefined, groupBy: this.groupBy() }).subscribe({
      next: res => { this.conversion.set(res.success ? res.data ?? [] : []); if (!res.success) this.error.set(res.message); },
      error: err => { this.conversion.set([]); this.fail(err); },
    });
  }

  groupLabel(r: CrmConversionRowDto): string {
    const g = this.groupBy();
    if (g === 'owner') return r.ownerName || '–';
    if (g === 'month') {
      if (!r.month) return '–';
      const [y, m] = r.month.split('-').map(Number);
      return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    }
    return r.sourceName || 'No source';
  }

  /** The report as a CSV file the browser downloads. */
  download(): void {
    const quote = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let rows: unknown[][];
    if (this.tab() === 'conversion') {
      rows = [[this.groupBy(), 'Leads', 'Converted', 'Conversion %', 'Converted value'],
        ...(this.conversion() ?? []).map(r => [this.groupLabel(r), r.leads, r.converted, r.conversionPct, r.convertedValue])];
    } else {
      rows = [['Date', 'Lead', 'Contact', 'Mobile', 'Type', 'Notes', 'Next follow-up', 'Next action', 'By', 'Owner', 'Lead status'],
        ...(this.followUps() ?? []).map(r => [r.followUpAt, r.leadNo, r.contactName, r.mobile, r.type, r.notes, r.nextFollowUpAt ?? '',
          r.nextAction, r.userName, r.ownerName, r.leadStatus])];
    }
    const blob = new Blob([rows.map(r => r.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `crm-${this.tab()}-${this.from()}-${this.to()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
