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
  showFilters = signal(false);
  statuses = COMPLAINT_STATUSES;
  priorities = PRIORITIES;
  filter: ComplaintFilter = { pageNumber: 1, pageSize: 20 };
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
  // Reload whatever list this component shows
  // e.g. this.loadComplaints();  or  this.loadData();
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

  totalCount = computed(() => this.complaints().length);
  breachedCount = computed(() => this.complaints().filter(c => c.isSLABreached).length);
  onTimeCount = computed(() => this.complaints().filter(c => !c.isSLABreached).length);

  ngOnInit() {
    this.load();
  }

  load(): void {
    this.api.getComplaints(this.filter).subscribe((res) => {
      this.complaints.set(res.items);
      this.totalPages.set(res.totalPages);
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
