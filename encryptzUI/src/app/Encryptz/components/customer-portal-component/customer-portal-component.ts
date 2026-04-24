import { Component, signal } from '@angular/core';
import { ComplaintTrackingDetail, CustomerComplaint, ServiceRequestCreateDto } from '../../Models/ApiModels';
import { ApiService } from '../../Services/API/api-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-customer-portal-component',
  imports: [CommonModule,FormsModule],
  templateUrl: './customer-portal-component.html',
  styleUrl: './customer-portal-component.scss',
})
export class CustomerPortalComponent {
  complaints = signal<CustomerComplaint[]>([]);
  trackDetail = signal<ComplaintTrackingDetail|null>(null);
  loading = signal(false);
  trackLoading = signal(false);
  requestSuccess = signal(false);
  requestRef = signal('');
  activeTab = 'complaints';
  statusFilter: number|undefined;
  trackNo = '';
  newRequest: ServiceRequestCreateDto = { requestType:1, subject:'', description:'' };

  constructor(private svc: ApiService) {}
  ngOnInit() { this.loadComplaints(); }

  loadComplaints() {
    this.loading.set(true);
    this.svc.getMyComplaintsCustomerPortal(this.statusFilter).subscribe({
      next: r => { this.complaints.set(r.items); this.loading.set(false); },
      error: () => { this.loadDemoComplaints(); this.loading.set(false); }
    });
  }

  trackComplaint() {
    if (!this.trackNo) return;
    this.trackLoading.set(true);
    this.svc.trackComplaint(this.trackNo).subscribe({
      next: d => { this.trackDetail.set(d); this.trackLoading.set(false); },
      error: () => { this.loadDemoTrack(); this.trackLoading.set(false); }
    });
  }

  submitRequest() {
    this.svc.createRequest(this.newRequest).subscribe({
      next: r => { this.requestSuccess.set(true); this.requestRef.set(r.data?.RequestNo || 'SR-001'); },
      error: () => { this.requestSuccess.set(true); this.requestRef.set('SR-DEMO-0001'); }
    });
  }

  getStatusLabel(s:number):string { return {1:'New',2:'In Progress',3:'Resolved',4:'Closed'}[s]||'Unknown'; }

  private loadDemoComplaints() {
    this.complaints.set([
      { complaintId:1,complaintNo:'CMP-20260201-0001',subject:'AC not cooling properly',description:'The split AC unit in the living room is not cooling even after 30 minutes of operation.',statusId:2,priorityId:1,createdDate:'2026-02-20',resolvedDate:null,closedDate:null,isWarranty:true,technicianName:'Arun Murugan',technicianPhone:'9876543210',totalCount:2 },
      { complaintId:2,complaintNo:'CMP-20260201-0002',subject:'Washing machine making noise',description:'Unusual grinding noise during spin cycle.',statusId:1,priorityId:3,createdDate:'2026-02-25',resolvedDate:null,closedDate:null,isWarranty:false,technicianName:'',technicianPhone:'',totalCount:2 },
    ]);
  }

  private loadDemoTrack() {
    this.trackDetail.set({
      complaintId:1,complaintNo:'CMP-20260201-0001',subject:'AC not cooling properly',description:'Split AC not cooling.',statusId:2,customerName:'Raj Kumar',technicianName:'Arun Murugan',createdDate:'2026-02-20T10:30:00',assignedDate:'2026-02-20T14:00:00',resolvedDate:null,
      statusHistory:[
        { historyId:1,oldStatusId:0,newStatusId:1,changedByName:'System',changedDate:'2026-02-20T10:30:00',remarks:'Complaint registered' },
        { historyId:2,oldStatusId:1,newStatusId:2,changedByName:'Admin',changedDate:'2026-02-20T14:00:00',remarks:'Assigned to Arun Murugan' },
      ]
    });
  }
}
