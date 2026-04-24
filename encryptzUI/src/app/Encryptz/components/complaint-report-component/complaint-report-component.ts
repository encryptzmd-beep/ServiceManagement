// src/app/modules/reports/components/complaint-report/complaint-report.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';
import {
  COMPLAINT_STATUSES,
  ComplaintFilter,
  ComplaintListItem,
  PRIORITIES,
} from '../../Models/ApiModels';

@Component({
  selector: 'app-complaint-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './complaint-report-component.html',
  styleUrls: ['./complaint-report-component.scss'],
})
export class ComplaintReportComponent {
  private api = inject(ApiService);
  statuses = COMPLAINT_STATUSES;
  priorities = PRIORITIES;
  filter: ComplaintFilter = { pageNumber: 1, pageSize: 100 };
  data = signal<ComplaintListItem[]>([]);
  load() {
    this.api.getComplaints(this.filter).subscribe((r) => this.data.set(r.items));
  }
}
