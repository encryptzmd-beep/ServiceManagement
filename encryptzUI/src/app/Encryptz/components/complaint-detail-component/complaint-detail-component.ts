// src/app/modules/backoffice/components/complaint-detail/complaint-detail.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';
import { Complaint, COMPLAINT_STATUSES } from '../../Models/ApiModels';


@Component({
  selector: 'app-complaint-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './complaint-detail-component.html',
  styleUrls: ['./complaint-detail-component.scss'],
})
export class ComplaintDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  complaint = signal<Complaint | null>(null);
  statuses = COMPLAINT_STATUSES;
  newStatusId = 1;
  remarks = '';

  ngOnInit() {
    const id = +this.route.snapshot.params['id'];
    this.api.getComplaint(id).subscribe((r) => {
      if (r.data) this.complaint.set(r.data);
    });
  }

  updateStatus(id: number) {
    this.api
      .updateComplaintStatus(id, this.newStatusId, this.remarks)
      .subscribe(() => this.ngOnInit());
  }
}
