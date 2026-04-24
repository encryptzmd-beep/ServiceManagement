import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';
import { ActiveAssignment, AssignTechnician, AuditLog, ComplaintLookup, Technician } from '../../Models/ApiModels';
import { debounceTime, Subject } from 'rxjs';



@Component({
  selector: 'app-technician-assignment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './technician-assignment-component.html',
  styleUrl: './technician-assignment-component.scss',
})
export class TechnicianAssignmentComponent implements OnInit {
  private api = inject(ApiService);
  private searchSubject = new Subject<string>();

  technicians = signal<Technician[]>([]);
  auditLogs = signal<AuditLog[]>([]);
  activeAssignments = signal<ActiveAssignment[]>([]);
  complaintResults = signal<ComplaintLookup[]>([]);
  saving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');

  activeTab: 'assign' | 'complete' = 'assign';
  searchTerm = '';
  filterStatus: number | null = null;
  editingAssignment: any = null;
  complaintSearch = '';
  showComplaintDropdown = false;
  selectedComplaint: ComplaintLookup | null = null;
  assignmentSearch = '';
  today = new Date().toISOString().split('T')[0];

  priorities = [
    { value: 'Low', label: 'Low', icon: 'arrow_downward', color: '#10b981' },
    { value: 'Medium', label: 'Medium', icon: 'remove', color: '#f59e0b' },
    { value: 'High', label: 'High', icon: 'arrow_upward', color: '#ef4444' },
    { value: 'Critical', label: 'Critical', icon: 'priority_high', color: '#7c3aed' },
  ];
  timeSlots = [
    { value: 'morning', label: 'Morning', time: '9AM-12PM', icon: 'wb_sunny' },
    { value: 'afternoon', label: 'Afternoon', time: '12PM-4PM', icon: 'wb_cloudy' },
    { value: 'evening', label: 'Evening', time: '4PM-7PM', icon: 'nights_stay' },
  ];

  form = {
    complaintId: null as number | null,
    technicianId: null as number | null,
    assignmentRole: 'Primary',
    priority: 'Medium',
    isScheduled: false,
    scheduledDate: '',
    timeSlot: '',
    startTime: '',
    endTime: '',
    estimatedDuration: null as number | null,
    notes: '',
  };
  completeForm = { assignmentId: null as number | null, remarks: '' };
  auditComplaintId: number | null = null;

  filteredTechnicians = computed(() => {
    let list = this.technicians();
    const term = this.searchTerm?.toLowerCase() || '';
    if (term) list = list.filter((t: any) => t.fullName?.toLowerCase().includes(term) || t.specialization?.toLowerCase().includes(term) || t.mobileNumber?.includes(term));
    if (this.filterStatus !== null) list = list.filter((t: any) => t.availabilityStatus === this.filterStatus);
    return list;
  });

  filteredAssignments = computed(() => {
    const term = this.assignmentSearch?.toLowerCase() || '';
    if (!term) return this.activeAssignments();
    return this.activeAssignments().filter((a: any) => a.technicianName?.toLowerCase().includes(term) || a.complaintNumber?.toLowerCase().includes(term) || a.customerName?.toLowerCase().includes(term) || a.customerPhone?.includes(term));
  });

  ngOnInit(): void {
    this.loadTechnicians();
    this.loadActiveAssignments();
    this.searchSubject.pipe(debounceTime(300)).subscribe((term: string) => {
      this.api.getComplaintsLookup(term).subscribe({
        next: (data: any) => this.complaintResults.set(Array.isArray(data) ? data : []),
        error: () => this.complaintResults.set([]),
      });
    });
  }

  loadTechnicians(): void {
    this.api.getTechnicians().subscribe({ next: (data: any) => this.technicians.set(data.items || data || []), error: () => {} });
  }
  loadActiveAssignments(): void {
    this.api.getActiveAssignments().subscribe({ next: (data: any) => this.activeAssignments.set(Array.isArray(data) ? data : []), error: () => this.activeAssignments.set([]) });
  }

  onComplaintSearch(): void { this.showComplaintDropdown = true; this.searchSubject.next(this.complaintSearch); }
  selectComplaint(c: ComplaintLookup): void { this.selectedComplaint = c; this.form.complaintId = c.complaintId; this.complaintSearch = c.complaintNumber + ' - ' + c.subject; this.showComplaintDropdown = false; }
  clearComplaint(): void { this.selectedComplaint = null; this.form.complaintId = null; this.complaintSearch = ''; this.complaintResults.set([]); }
  selectTechnician(id: number): void { this.form.technicianId = id; }
  selectAssignment(a: ActiveAssignment): void { this.completeForm.assignmentId = a.assignmentId; this.completeForm.remarks = ''; }
  getAvailableCount(): number { return this.technicians().filter((t: any) => t.availabilityStatus === 1).length; }
  getBusyCount(): number { return this.technicians().filter((t: any) => t.availabilityStatus === 2).length; }

  assign(): void {
    if (!this.form.complaintId || !this.form.technicianId) return;
    this.saving.set(true); this.successMsg.set(''); this.errorMsg.set('');

    const payload: any = {
      complaintId: this.form.complaintId, technicianId: this.form.technicianId,
      assignmentRole: this.form.assignmentRole, priority: this.form.priority, notes: this.form.notes,
    };
    if (this.form.isScheduled) {
      payload.scheduledDate = this.form.scheduledDate; payload.startTime = this.form.startTime;
      payload.endTime = this.form.endTime; payload.estimatedDuration = this.form.estimatedDuration;
      payload.timeSlot = this.form.timeSlot;
    }

    this.api.assignTechnician(payload).subscribe({
      next: (res: any) => {
        this.saving.set(false);
        if (res.success) {
          const techName = this.technicians().find((t: any) => t.technicianId === this.form.technicianId)?.fullName || '';
          this.successMsg.set(techName + ' assigned as ' + this.form.assignmentRole + ' to Complaint #' + this.form.complaintId);
          this.loadTechnicians(); this.loadActiveAssignments();
          if (this.form.complaintId) { this.auditComplaintId = this.form.complaintId; this.loadAuditLog(); }
          // MULTI-ASSIGN: keep complaint, reset only tech + switch role to Supporting
          this.form.technicianId = null;
          this.form.assignmentRole = 'Supporting';
          this.form.notes = '';
        } else { this.errorMsg.set(res.message || 'Assignment failed'); }
      },
      error: (err: any) => { this.saving.set(false); this.errorMsg.set(err?.error?.message || 'An error occurred.'); },
    });
  }

  completeAssignment(): void {
    if (!this.completeForm.assignmentId) return;
    this.saving.set(true); this.successMsg.set(''); this.errorMsg.set('');
    this.api.completeAssignment({ assignmentId: this.completeForm.assignmentId, remarks: this.completeForm.remarks }).subscribe({
      next: (res: any) => {
        this.saving.set(false);
        if (res.success) { this.successMsg.set(res.message || 'Completed.'); this.loadActiveAssignments(); this.loadTechnicians(); this.completeForm = { assignmentId: null, remarks: '' }; }
        else { this.errorMsg.set(res.message || 'Failed'); }
      },
      error: () => { this.saving.set(false); this.errorMsg.set('An error occurred.'); },
    });
  }

  quickComplete(assignmentId: number): void { this.completeForm.assignmentId = assignmentId; this.completeForm.remarks = 'Work completed'; this.completeAssignment(); }

  editAssignment(a: any): void {
    this.editingAssignment = a; this.activeTab = 'assign'; this.form.complaintId = a.complaintId;
    this.form.technicianId = null; this.form.assignmentRole = a.assignmentRole;
    if (a.scheduledDate) { this.form.isScheduled = true; this.form.scheduledDate = a.scheduledDate; this.form.startTime = a.startTime || ''; this.form.endTime = a.endTime || ''; }
  }
  cancelEdit(): void { this.editingAssignment = null; this.resetForm(); }

  resetForm(): void {
    this.form = { complaintId: null, technicianId: null, assignmentRole: 'Primary', priority: 'Medium', isScheduled: false, scheduledDate: '', timeSlot: '', startTime: '', endTime: '', estimatedDuration: null, notes: '' };
    this.editingAssignment = null; this.selectedComplaint = null; this.complaintSearch = '';
  }

  loadAuditLog(): void {
    if (!this.auditComplaintId) return;
    this.api.getAuditLog(this.auditComplaintId).subscribe({ next: (data: any) => this.auditLogs.set(Array.isArray(data) ? data : data.data || []), error: () => this.auditLogs.set([]) });
  }

  getAuditIcon(action: string): string {
    return ({ Created: 'person_add', Modified: 'edit', Removed: 'person_remove', Completed: 'check_circle' } as any)[action] || 'history';
  }
}
