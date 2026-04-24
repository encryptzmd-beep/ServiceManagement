import { Component, inject, signal } from '@angular/core';
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
export class ProductivityReportComponent {
   private api = inject(ApiService);

  data = signal<TechProductivity[]>([]);
  loading = signal(false);
 fromDate = new Date(new Date().setMonth(new Date().getMonth() - 1))
  .toISOString()
  .substring(0, 10);

toDate = new Date().toISOString().substring(0, 10);

  loadReport(): void {
    this.loading.set(true);
    this.api.getProductivityReport(this.fromDate , this.toDate).subscribe({
      next: (result: any) => {
        this.loading.set(false);
        if (Array.isArray(result)) {
          this.data.set(result);
        } else if (result?.data) {
          this.data.set(result.data);
        } else {
          this.data.set(this.mapResult(result));
        }
      },
      error: () => {
        this.loading.set(false);
        // Demo fallback data

      }
    });
  }

  getTotalAssignments(): number { return this.data().reduce((s, d) => s + d.totalAssignments, 0); }
  getTotalCompleted(): number { return this.data().reduce((s, d) => s + d.completedAssignments, 0); }
  getTotalHours(): number { return this.data().reduce((s, d) => s + d.totalWorkHours, 0); }
  getTotalDistance(): number { return this.data().reduce((s, d) => s + d.totalDistanceKm, 0); }

  getTopPerformers(): TechProductivity[] {
    return [...this.data()].sort((a, b) => b.completionRate - a.completionRate).slice(0, 3);
  }

  getBarClass(rate: number): string {
    if (rate >= 90) return 'excellent';
    if (rate >= 80) return 'good';
    if (rate >= 70) return 'average';
    return 'poor';
  }

  private mapResult(raw: any): TechProductivity[] {
    if (!raw) return [];
    return [];
  }
}
