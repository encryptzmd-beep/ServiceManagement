import { Component, OnInit, signal } from '@angular/core';
import { ApiService } from '../../Services/API/api-service';
import { ConflictResolveDto, ScheduleConflictItem } from '../../Models/ApiModels';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Two open assignments of one technician that overlap on the selected day.
 * Shows what the API returns — nothing is made up when the call fails.
 */
@Component({
  selector: 'app-schedule-conflicts-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule-conflicts-component.html',
  styleUrl: './schedule-conflicts-component.scss',
})
export class ScheduleConflictsComponent implements OnInit {
  conflicts = signal<ScheduleConflictItem[]>([]);
  loading = signal(true);
  loadError = signal('');
  resolvingId = signal<number | null>(null);
  selectedDate = new Date().toISOString().split('T')[0];
  resolutionTexts: Record<number, string> = {};

  constructor(private scheduleService: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.loadError.set('');
    this.scheduleService.detectConflicts(this.selectedDate).subscribe({
      next: (data) => {
        this.conflicts.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
      },
      error: () => {
        this.conflicts.set([]);
        this.loadError.set('Schedule conflicts could not be loaded. Please try again.');
        this.loading.set(false);
      },
    });
  }

  resolveConflict(c: ScheduleConflictItem) {
    const dto: ConflictResolveDto = {
      conflictId: c.conflictId,
      resolution: this.resolutionTexts[c.conflictId]?.trim() || 'Resolved by admin',
    };
    this.resolvingId.set(c.conflictId);
    this.scheduleService.resolveConflict(dto).subscribe({
      next: () => { this.resolvingId.set(null); this.loadData(); },
      error: () => {
        this.resolvingId.set(null);
        this.loadError.set('The conflict could not be marked as resolved.');
      },
    });
  }

  getOpenCount(): number {
    return this.conflicts().filter((c) => !c.isResolved).length;
  }
  getCriticalCount(): number {
    return this.conflicts().filter((c) => !c.isResolved && c.severity === 1).length;
  }
  getWarningCount(): number {
    return this.conflicts().filter((c) => !c.isResolved && c.severity === 2).length;
  }
  getResolvedCount(): number {
    return this.conflicts().filter((c) => c.isResolved).length;
  }
  getSeverityLabel(s: number): string {
    return { 1: 'Critical', 2: 'Warning', 3: 'Info' }[s] || 'Unknown';
  }

  /** "09:00:00" -> "09:00"; assignments without a time show a dash. */
  formatTime(value: string | null | undefined): string {
    return value ? String(value).substring(0, 5) : '—';
  }
}
