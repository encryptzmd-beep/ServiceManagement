import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';
import { Complaint } from '../../Models/ApiModels';


@Component({
  selector: 'app-complaint-tracking',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './complaint-tracking-component.html',
  styleUrls: ['./complaint-tracking-component.scss'],
})
export class ComplaintTrackingComponent implements OnInit {
  private api = inject(ApiService);

  complaints = signal<Complaint[]>([]);
  confirming = signal(false);
  expandedTimelines = new Set<number>();

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
    } else {
      this.expandedTimelines.add(complaintId);
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
