import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../Services/API/api-service';
import { ConflictResolveDto, Schedule, ScheduleConflictItem } from '../../Models/ApiModels';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-schedule-conflicts-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule-conflicts-component.html',
  styleUrl: './schedule-conflicts-component.scss',
})
export class ScheduleConflictsComponent {
load() {
throw new Error('Method not implemented.');
}
  conflicts = signal<any[]>([]);
  loading = signal(true);
  selectedDate = new Date().toISOString().split('T')[0];
  resolutionTexts: Record<number, string> = {};
date: any;

  constructor(private scheduleService: ApiService) {}
  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.scheduleService.detectConflicts(this.selectedDate).subscribe({
      next: (data) => {
        this.conflicts.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loadDemo();
        this.loading.set(false);
      },
    });
  }

  resolveConflict(c: ScheduleConflictItem) {
    const dto: ConflictResolveDto = {
      conflictId: c.conflictId,
      resolution: this.resolutionTexts[c.conflictId] || 'Resolved by admin',
    };
    this.scheduleService.resolveConflict(dto).subscribe({ next: () => this.loadData() });
  }

  getCriticalCount(): number {
    return this.conflicts().filter((c) => c.severity === 1).length;
  }
  getWarningCount(): number {
    return this.conflicts().filter((c) => c.severity === 2).length;
  }
  getInfoCount(): number {
    return this.conflicts().filter((c) => c.severity === 3).length;
  }
  getSeverityLabel(s: number): string {
    return { 1: 'Critical', 2: 'Warning', 3: 'Info' }[s] || 'Unknown';
  }
  getTaskTypeLabel(t: number): string {
    return { 1: 'Service Visit', 2: 'Installation', 3: 'Inspection', 4: 'Follow Up' }[t] || 'Task';
  }

  private loadDemo() {
    this.conflicts.set([
      {
        conflictId: 1,
        schedule1Id: 10,
        schedule2Id: 11,
        technicianId: 10,
        technicianName: 'Arun Murugan',
        employeeCode: 'EMP-001',
        conflictDate: this.selectedDate,
        conflictType: 1,
        severity: 1,
        schedule1Start: '09:00',
        schedule1End: '11:00',
        schedule1Type: 1,
        schedule2Start: '10:00',
        schedule2End: '12:00',
        schedule2Type: 2,
        complaint1No: 'CMP-001',
        complaint2No: 'CMP-003',
        isResolved: false,
      },
      {
        conflictId: 2,
        schedule1Id: 14,
        schedule2Id: 15,
        technicianId: 11,
        technicianName: 'Karthik Rajan',
        employeeCode: 'EMP-002',
        conflictDate: this.selectedDate,
        conflictType: 1,
        severity: 2,
        schedule1Start: '14:00',
        schedule1End: '15:30',
        schedule1Type: 1,
        schedule2Start: '15:00',
        schedule2End: '16:30',
        schedule2Type: 4,
        complaint1No: 'CMP-005',
        complaint2No: 'CMP-008',
        isResolved: false,
      },
    ]);
  }
}
