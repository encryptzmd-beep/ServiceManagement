import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';
import { Complaint } from '../../Models/ApiModels';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-complaint-tracking',
  standalone: true,
  imports: [CommonModule, RouterModule,FormsModule],
  templateUrl: './complaint-tracking-component.html',
  styleUrls: ['./complaint-tracking-component.scss'],
})
export class ComplaintTrackingComponent implements OnInit {
  private api = inject(ApiService);

  complaints = signal<Complaint[]>([]);
  confirming = signal(false);
  expandedTimelines = new Set<number>();

  // Confirmation dialog signals
  confirmVisible = signal(false);
  confirmMessage = signal('');
  confirmAction: (() => void) | null = null;

  // Edit Modal signals
  showEditModal = signal(false);
  editingComplaint = signal<Complaint | null>(null);
  editForm = { subject: '', description: '', priority: '' };
  saving = signal(false);

  // Toast signals
  toastVisible = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error'>('success');
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadComplaints();
  }

  loadComplaints(): void {
    this.api.getMyComplaints().subscribe({
      next: (res) => {
        this.complaints.set(res.data.items);
      },
      error: () => {}
    });
  }

  toggleTimeline(complaintId: number): void {
  if (this.expandedTimelines.has(complaintId)) {
    this.expandedTimelines.delete(complaintId);
    return;
  }

  this.expandedTimelines.add(complaintId);

  const complaint = this.complaints().find(c => c.complaintId === complaintId);

  // ✅ Only fetch if timeline is missing OR empty
  if (complaint && (!complaint.timeline || complaint.timeline.length === 0)) {
    this.api.getComplaintDetail(complaintId).subscribe({
     next: (res) => {
  if (!res.success || !res.data) return;

  const data = res.data; // ✅ store in local variable

  this.complaints.update(list => {
    const index = list.findIndex(c => c.complaintId === complaintId);

    if (index !== -1) {
      const existing = list[index];

      list[index] = {
        ...existing,
        ...data,
        timeline: Array.isArray(data.timeline)
          ? data.timeline.map((t: any) => ({
              timelineId: t.timelineId ?? t.id ?? 0,
              statusName: t.statusName ?? t.status ?? '',
              actionAt: t.actionAt ?? t.date ?? new Date().toISOString(),
              statusColor: t.statusColor ?? '#94a3b8',
              remarks: t.remarks ?? '',
              actionByName: t.actionByName ?? ''
            }))
          : []
      };
    }

    return [...list];
  });
},
      error: () => {
        console.error('Failed to load complaint details');
      }
    });
  }
}

  confirmClosure(complaintId: number): void {
    this.confirming.set(true);
    this.api.confirmClosure(complaintId).subscribe({
      next: (res) => {
        this.confirming.set(false);
        if (res.success) this.loadComplaints();
      },
      error: () => this.confirming.set(false),
    });
  }

  editComplaint(complaint: Complaint): void {
    this.editingComplaint.set(complaint);
    this.editForm = {
      subject: complaint.subject,
      description: complaint.description || '',
      priority: complaint.priority
    };
    this.showEditModal.set(true);
  }

  saveComplaint(): void {
    const complaint = this.editingComplaint();
    if (!complaint) return;

    this.saving.set(true);
    this.api.updateComplaintDetails(complaint.complaintId, this.editForm).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.showToast('Complaint updated successfully', 'success');
          this.showEditModal.set(false);
          this.loadComplaints();
        } else {
          this.showToast(res.message || 'Failed to update complaint', 'error');
        }
      },
      error: () => {
        this.saving.set(false);
        this.showToast('Error updating complaint', 'error');
      }
    });
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingComplaint.set(null);
  }

  deleteComplaint(complaint: Complaint): void {
    this.openConfirm(
      `Are you sure you want to delete complaint "${complaint.complaintNumber} - ${complaint.subject}"? This action cannot be undone.`,
      () => {
        this.api.deleteComplaint(complaint.complaintId).subscribe({
          next: (res) => {
            if (res.success) {
              this.showToast('Complaint deleted successfully', 'success');
              this.loadComplaints();
            } else {
              this.showToast(res.message || 'Failed to delete complaint', 'error');
            }
          },
          error: (err) => {
            console.error('Error deleting complaint:', err);
            this.showToast('Error deleting complaint', 'error');
          }
        });
      }
    );
  }

  openConfirm(message: string, action: () => void): void {
    this.confirmMessage.set(message);
    this.confirmAction = action;
    this.confirmVisible.set(true);
  }

  cancelConfirm(): void {
    this.confirmVisible.set(false);
    this.confirmMessage.set('');
    this.confirmAction = null;
  }

  proceedConfirm(): void {
    const action = this.confirmAction;
    this.cancelConfirm();
    if (action) {
      action();
    }
  }

  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.toastVisible.set(true);

    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }

    this.toastTimeoutId = setTimeout(() => {
      this.toastVisible.set(false);
      this.toastTimeoutId = null;
    }, 3500);
  }

  hideToast(): void {
    this.toastVisible.set(false);
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
  }

  getOpenCount(): number {
    return this.complaints().filter((c) => c.statusName !== 'Closed').length;
  }

  getClosedCount(): number {
    return this.complaints().filter((c) => c.statusName === 'Closed').length;
  }

  getBreachedCount(): number {
    return this.complaints().filter((c) => c.isSLABreached).length;
  }
}
