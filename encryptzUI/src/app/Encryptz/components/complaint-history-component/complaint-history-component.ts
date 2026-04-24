import { Component, inject, OnInit, signal } from '@angular/core';
import { ComplaintDetail, CustomerComplaintList, STATUS_MAP } from '../../Models/ApiModels';
import { ApiService } from '../../Services/API/api-service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-complaint-history-component',
  imports: [CommonModule,ReactiveFormsModule,FormsModule],
  templateUrl: './complaint-history-component.html',
  styleUrl: './complaint-history-component.scss',
})
export class ComplaintHistoryComponent implements OnInit {
  private api = inject(ApiService);

  complaints = signal<CustomerComplaintList[]>([]);
  detail = signal<ComplaintDetail | null>(null);
  loadingDetail = signal(false);
  replying = signal(false);
  replySuccess = signal('');

  statusFilter: number | null = null;
  expandedId: number | null = null;
  replyMessage = '';

  ngOnInit(): void { this.loadComplaints(); }

  loadComplaints(): void {
    this.api.getMyComplaints(this.statusFilter || undefined).subscribe({
      next: (data: any) => this.complaints.set(data.items || []),
      error: () => this.complaints.set([]),
    });
  }

  toggleExpand(id: number): void {
    if (this.expandedId === id) { this.expandedId = null; this.detail.set(null); return; }
    this.expandedId = id;
    this.detail.set(null);
    this.replyMessage = '';
    this.replySuccess.set('');
    this.loadingDetail.set(true);
    this.api.getComplaintDetail(id).subscribe({
      next: (res: any) => { this.loadingDetail.set(false); this.detail.set(res.success ? res.data : null); },
      error: () => this.loadingDetail.set(false),
    });
  }

  sendReply(complaintId: number): void {
    if (!this.replyMessage.trim()) return;
    this.replying.set(true);
    this.replySuccess.set('');
    this.api.replyToComplaint(complaintId, this.replyMessage).subscribe({
      next: (res: any) => {
        this.replying.set(false);
        if (res.success) {
          this.replySuccess.set('Message sent!');
          this.replyMessage = '';
          this.toggleExpand(complaintId); // reload detail
          setTimeout(() => this.toggleExpand(complaintId), 100);
        }
      },
      error: () => this.replying.set(false),
    });
  }

  getStatusLabel(id: number): string { return STATUS_MAP[id]?.label || 'Unknown'; }
  getStatusClass(id: number): string { return { 1: 'new', 2: 'inprogress', 3: 'resolved', 4: 'closed', 5: 'reopened' }[id] || ''; }
  isSLABreached(deadline: string): boolean { return new Date(deadline) < new Date(); }
}
