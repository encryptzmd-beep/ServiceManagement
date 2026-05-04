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

  totalCount = computed(() => this.realTotal());
  breachedCount = computed(() => this.complaints().filter(c => c.isSLABreached).length);
  onTimeCount = computed(() => this.complaints().filter(c => !c.isSLABreached).length);

  ngOnInit() {
    this.load();
  }

  load(): void {
    this.filter.pageNumber = this.filter.pageNumber || 1;
    this.api.getComplaints(this.filter).subscribe((res) => {
      this.complaints.set(res.items);
      this.totalPages.set(res.totalPages);
      this.realTotal.set(res.totalCount ?? res.totalPages * this.filter.pageSize);
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
