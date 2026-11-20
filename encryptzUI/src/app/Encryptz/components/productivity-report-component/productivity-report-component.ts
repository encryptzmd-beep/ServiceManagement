import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { TechProductivity } from '../../Models/ApiModels';
import { ApiService } from '../../Services/API/api-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-productivity-report-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './productivity-report-component.html',
  styleUrl: './productivity-report-component.scss',
})
export class ProductivityReportComponent implements OnInit {
  private api = inject(ApiService);

  data = signal<TechProductivity[]>([]);
  loading = signal(false);
  /** True once a report was asked for: the empty state then says "nothing in this range". */
  loaded = signal(false);

  // local calendar dates: toISOString() is UTC, which is still "yesterday" in India until 05:30
  fromDate = this.localDate(-30);
  toDate = this.localDate(0);

  /** Most jobs completed first; ties go to the higher completion rate, then the faster technician. */
  ranked = computed(() => [...this.data()].sort((a, b) =>
    (b.completedAssignments - a.completedAssignments)
    || (b.completionRate - a.completionRate)
    || ((a.avgResolutionHours ?? 0) - (b.avgResolutionHours ?? 0))));

  totalAssignments = computed(() => this.data().reduce((s, d) => s + d.totalAssignments, 0));
  totalCompleted = computed(() => this.data().reduce((s, d) => s + d.completedAssignments, 0));
  totalPending = computed(() => this.data().reduce((s, d) => s + d.pendingAssignments, 0));
  totalHours = computed(() => this.data().reduce((s, d) => s + d.totalWorkHours, 0));
  totalDistance = computed(() => this.data().reduce((s, d) => s + d.totalDistanceKm, 0));
  /** Completed out of assigned over the whole team; null when nothing was assigned. */
  overallRate = computed(() => this.totalAssignments() > 0 ? (this.totalCompleted() / this.totalAssignments()) * 100 : null);

  ngOnInit(): void {
    this.loadReport();
  }

  private localDate(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  loadReport(): void {
    if (!this.fromDate || !this.toDate) return;
    this.loading.set(true);
    this.api.getProductivityReport(this.fromDate, this.toDate).subscribe({
      next: (result: any) => {
        this.loading.set(false);
        this.loaded.set(true);
        const raw = Array.isArray(result) ? result : result?.data;
        this.data.set(Array.isArray(raw) ? raw : []);
      },
      error: () => {
        this.loading.set(false);
        this.loaded.set(true);
        this.data.set([]);
      },
    });
  }

  /** good ≥ 90 % · warn ≥ 70 % · critical below. */
  tone(rate: number | null | undefined): string {
    if (rate == null) return 'none';
    if (rate >= 90) return 'good';
    if (rate >= 70) return 'warn';
    return 'critical';
  }

  initials(name: string | null | undefined): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  }
}
