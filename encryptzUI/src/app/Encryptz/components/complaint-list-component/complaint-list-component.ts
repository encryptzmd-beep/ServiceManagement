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
    this.load();
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
