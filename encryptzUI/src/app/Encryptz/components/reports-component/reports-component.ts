import { Component, signal } from '@angular/core';
import {
  ComplaintSummaryReport,
  ReportFilter,
  TechPerformanceReport,
} from '../../Models/ApiModels';
import { ApiService } from '../../Services/API/api-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-reports-component',
   imports: [CommonModule, FormsModule],
  templateUrl: './reports-component.html',
  styleUrl: './reports-component.scss',
})
export class ReportsComponent {
  complaintReports = signal<ComplaintSummaryReport[]>([]);
  perfReports = signal<TechPerformanceReport[]>([]);
  loading = signal(false);
  tab = 'complaint';
  filter: ReportFilter = {
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  };

  constructor(private svc: ApiService) {}
  ngOnInit() {
    this.generateReport();
  }

  generateReport() {
    this.loading.set(true);
    if (this.tab === 'complaint') {
      this.svc.getComplaintSummary(this.filter).subscribe({
        next: (d) => {
          this.complaintReports.set(d);
          this.loading.set(false);
        },
        error: () => {
          this.loadDemoComplaint();
          this.loading.set(false);
        },
      });
    } else {
      this.svc.getTechnicianPerformance(this.filter).subscribe({
        next: (d) => {
          this.perfReports.set(d);
          this.loading.set(false);
        },
        error: () => {
          this.loadDemoPerf();
          this.loading.set(false);
        },
      });
    }
  }

  getTotalComplaints(): number {
    return this.complaintReports().reduce((s, r) => s + r.complaintCount, 0);
  }
  getTotalWarranty(): number {
    return this.complaintReports().reduce((s, r) => s + r.warrantyCount, 0);
  }
  getTotalSLA(): number {
    return this.complaintReports().reduce((s, r) => s + r.slaBreached, 0);
  }
  getAvgHours(): number {
    const d = this.complaintReports().filter((r) => r.avgResolutionHours);
    return d.length ? d.reduce((s, r) => s + (r.avgResolutionHours || 0), 0) / d.length : 0;
  }
  getCompletionRate(t: TechPerformanceReport): number {
    return t.totalAssigned ? (t.resolved / t.totalAssigned) * 100 : 0;
  }
  getCompletionColor(t: TechPerformanceReport): string {
    const r = this.getCompletionRate(t);
    return r >= 90 ? '#10b981' : r >= 70 ? '#3b82f6' : r >= 50 ? '#f59e0b' : '#ef4444';
  }
  getColor(n: string): string {
    const c = ['#4f46e5', '#7c3aed', '#ec4899', '#f59e0b', '#10b981'];
    return c[n.charCodeAt(0) % c.length];
  }
  getInit(n: string): string {
    return n
      .split(' ')
      .map((x) => x[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  private loadDemoComplaint() {
    const data: ComplaintSummaryReport[] = [];
    for (let i = 14; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      data.push({
        reportDate: d.toISOString().split('T')[0],
        statusId: 1,
        priorityId: 1,
        complaintCount: Math.floor(Math.random() * 10) + 3,
        warrantyCount: Math.floor(Math.random() * 3),
        slaBreached: Math.floor(Math.random() * 2),
        avgResolutionHours: Math.random() * 24 + 4,
      });
    }
    this.complaintReports.set(data);
  }

  private loadDemoPerf() {
    this.perfReports.set([
      {
        userId: 10,
        fullName: 'Arun Murugan',
        employeeCode: 'EMP-001',
        specialization: 'AC Repair',
        totalAssigned: 45,
        resolved: 42,
        closed: 38,
        slaBreached: 1,
        avgResolutionHours: 6.5,
        rating: 4.8,
      },
      {
        userId: 11,
        fullName: 'Karthik Rajan',
        employeeCode: 'EMP-002',
        specialization: 'Electrical',
        totalAssigned: 38,
        resolved: 30,
        closed: 28,
        slaBreached: 3,
        avgResolutionHours: 8.2,
        rating: 4.5,
      },
      {
        userId: 12,
        fullName: 'Priya Lakshmi',
        employeeCode: 'EMP-003',
        specialization: 'Plumbing',
        totalAssigned: 52,
        resolved: 50,
        closed: 48,
        slaBreached: 0,
        avgResolutionHours: 5.1,
        rating: 4.9,
      },
    ]);
  }
}
