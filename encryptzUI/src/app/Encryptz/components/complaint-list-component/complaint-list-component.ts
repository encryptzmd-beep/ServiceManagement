import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';
import {
  COMPLAINT_STATUSES,
  ComplaintFilter,
  ComplaintListItem,
  PRIORITIES,
} from '../../Models/ApiModels';
import { ComplaintDetailPopupComponent } from "../complaint-detail-popup-component/complaint-detail-popup-component";

@Component({
  selector: 'app-complaint-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ComplaintDetailPopupComponent],
  templateUrl: './complaint-list-component.html',
  styleUrls: ['./complaint-list-component.scss'],
})
export class ComplaintListComponent implements OnInit {
  private api = inject(ApiService);
  complaints = signal<ComplaintListItem[]>([]);
  totalPages = signal(1);
  showFilters = signal(true);
  statuses = COMPLAINT_STATUSES;
  priorities = PRIORITIES;
  filter: ComplaintFilter = { pageNumber: 1, pageSize: 20 };
  cancelling = signal(false);
  cancelTarget = signal<ComplaintListItem | null>(null);
  cancelReason = '';
  cancelError = signal('');
  realTotal = signal(0);
  showDetailPopup = signal(false);
selectedComplaintId = signal<number | null>(null);

openComplaintDetails(complaintId: number, event?: Event): void {
  event?.stopPropagation();
  this.selectedComplaintId.set(complaintId);
  this.showDetailPopup.set(true);
}

closeDetailPopup(): void {
  this.showDetailPopup.set(false);
  this.selectedComplaintId.set(null);
}

handleRefresh(): void {
  this.load();
}

  // Client-side search on current page
  searchTerm = signal<string>('');
  filteredComplaints = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.complaints();
    return this.complaints().filter(c =>
      (c.complaintNumber || '').toLowerCase().includes(term)
      || (c.subject || '').toLowerCase().includes(term)
      || (c.customerName || '').toLowerCase().includes(term)
      || (c.productName || '').toLowerCase().includes(term)
    );
  });

  totalCount    = computed(() => this.realTotal());
  breachedCount = computed(() => this.filteredComplaints().filter(c => c.isSLABreached).length);
  onTimeCount   = computed(() => this.filteredComplaints().filter(c => !c.isSLABreached).length);

  ngOnInit() {
    this.setDefaultDateRange();
    this.load();
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  setDefaultDateRange(): void {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 29);
    this.filter.fromDate = this.formatDate(from);
    this.filter.toDate = this.formatDate(to);
  }

  canCancel(c: ComplaintListItem): boolean {
    return !['cancelled', 'closed', 'workcompleted'].includes((c.statusName || '').replace(/\s/g, '').toLowerCase());
  }

  openCancel(c: ComplaintListItem, event?: Event): void {
    event?.stopPropagation();
    this.cancelTarget.set(c); this.cancelReason = ''; this.cancelError.set('');
  }

  closeCancel(): void { if (!this.cancelling()) this.cancelTarget.set(null); }

  confirmCancel(): void {
    const c = this.cancelTarget();
    if (!c) return;
    if (!this.cancelReason.trim()) { this.cancelError.set('Cancellation reason is required.'); return; }
    this.cancelling.set(true); this.cancelError.set('');
    this.api.updateComplaintStatus(c.complaintId, 10, this.cancelReason.trim()).subscribe({
      next: r => {
        this.cancelling.set(false);
        if (r.success) { this.cancelTarget.set(null); this.load(); }
        else this.cancelError.set(r.message || 'Unable to cancel complaint.');
      },
      error: () => { this.cancelling.set(false); this.cancelError.set('Unable to cancel complaint.'); },
    });
  }

  load(): void {
    this.filter.pageNumber = this.filter.pageNumber || 1;
    this.api.getComplaints(this.filter).subscribe((res) => {
      this.complaints.set(res.items);

      // SP embeds TotalCount on each row; use it when the top-level count is missing or 0
      const total = res.totalCount > 0
        ? res.totalCount
        : (res.items?.[0]?.totalCount ?? 0);

      const pages = res.totalPages > 0
        ? res.totalPages
        : Math.max(1, Math.ceil(total / this.filter.pageSize));

      this.totalPages.set(pages);
      this.realTotal.set(total);
    });
  }

  prevPage(): void {
    if (this.filter.pageNumber > 1) {
      this.filter.pageNumber--;
      this.load();
    }
  }
  nextPage(): void {
    if (this.filter.pageNumber < this.totalPages()) {
      this.filter.pageNumber++;
      this.load();
    }
  }
}
