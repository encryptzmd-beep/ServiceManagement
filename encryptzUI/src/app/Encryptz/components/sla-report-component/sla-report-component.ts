import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';
import { SlaData } from '../../Models/ApiModels';
import { DialogService } from '../../Services/dialog-service';

@Component({
  selector: 'app-sla-report-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './sla-report-component.html',
  styleUrl: './sla-report-component.scss',
})
export class SlaReportComponent  implements OnInit{
  private dialog = inject(DialogService);
  ngOnInit(): void {
    this.loadReport()
  }
  private api = inject(ApiService);

  data = signal<SlaData[]>([]);
  loading = signal(false);
  // local calendar dates: toISOString() is UTC, which is still "yesterday" in India
  // until 05:30 and left the complaints of today out of the default range
  fromDate = this.localDate(-30);
  toDate = this.localDate(0);

  private localDate(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** A priority (or the whole range) without complaints has no compliance figure. */
  hasData(d: SlaData): boolean {
    return d.total > 0 && d.compliancePercent != null;
  }

  // GET api/report/sla-compliance?startDate=&endDate=
  // Returns: List<SlaData> or ApiResponse wrapping it
loadReport(): void {
  if (!this.fromDate || !this.toDate) {
    this.dialog.alert('Please select both From Date and To Date');
    return;
  }

  this.loading.set(true);
  this.data.set([]);

  this.api.getSlaCompliance(this.fromDate, this.toDate).subscribe({
    next: (res: any) => {
      this.loading.set(false);
      const raw = res?.data ?? res?.items ?? res;
      this.data.set(Array.isArray(raw) ? raw : []);
    },
    error: () => {
      this.loading.set(false);
      this.data.set([]);
    }
  });
}

  getOverallCompliance(): number {
    const total = this.getTotalComplaints();
    if (total === 0) return 0;
    return (this.getTotalWithinSla() / total) * 100;
  }

  getOverallColor(): string {
    const c = this.getOverallCompliance();
    if (c >= 90) return '#22c55e';
    if (c >= 70) return '#f59e0b';
    return '#ef4444';
  }

  getTotalComplaints(): number {
    return this.data().reduce((s, d) => s + d.total, 0);
  }
  getTotalWithinSla(): number {
    return this.data().reduce((s, d) => s + d.withinSla, 0);
  }
  getTotalBreached(): number {
    return this.data().reduce((s, d) => s + d.breached, 0);
  }

  getComplianceClass(pct: number | null): string {
    if (pct == null) return 'none';
    if (pct >= 90) return 'good';
    if (pct >= 70) return 'warn';
    return 'critical';
  }

  getPriorityIcon(p: string): string {
    const m: Record<string, string> = {
      Critical: 'priority_high',
      High: 'arrow_upward',
      Medium: 'remove',
      Low: 'arrow_downward',
    };
    return m[p] || 'remove';
  }
}
