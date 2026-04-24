import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../Services/API/api-service';
import { Technician, TechnicianFilter, TechnicianListItem } from '../../Models/ApiModels';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-technician-list-component',
    imports: [CommonModule,FormsModule],
  templateUrl: './technician-list-component.html',
  styleUrl: './technician-list-component.scss',
})
export class TechnicianListComponent {
   technicians = signal<TechnicianListItem[]>([]);
  selectedTech = signal<TechnicianListItem | null>(null);
  loading = signal(true);
  totalCount = signal(0);
  showCreateModal = false;
  showEditModal = false;
  searchTimeout: any;

  filter: TechnicianFilter = { pageNumber: 1, pageSize: 12, sortBy: 'FullName', sortDir: 'ASC' };

  // Stats computed from current page of technicians
  availableCount = computed(() => this.technicians().filter(t => t.isActive && t.availabilityStatus === 1).length);
  onJobCount = computed(() => this.technicians().filter(t => t.isActive && t.availabilityStatus === 2).length);
  onLeaveCount = computed(() => this.technicians().filter(t => t.isActive && t.availabilityStatus === 3).length);
  inactiveCount = computed(() => this.technicians().filter(t => !t.isActive).length);
 formData: any = {
  fullName: '', email: '', mobileNumber: '', specialization: '',
  experienceYears: 0, certificationDetails: '', maxDailyAssignments: 5,
  joinDate: '', availabilityStatus: 1
};

  constructor(private techService: ApiService) {}

  ngOnInit() { this.loadData(); }

  totalPages = () => Math.ceil(this.totalCount() / this.filter.pageSize);

  loadData() {
    this.loading.set(true);
    this.techService.getAllTechnicianFilter(this.filter).subscribe({
      next: (res) => { this.technicians.set(res.items); this.totalCount.set(res.totalCount); this.loading.set(false); },
      error: () => { this.loading.set(false); }
    });
  }

  onSearch() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => { this.filter.pageNumber = 1; this.loadData(); }, 400);
  }

  viewDetail(tech: TechnicianListItem) { this.selectedTech.set(tech); }
editTech(tech: TechnicianListItem) {
  this.formData = {
    profileId: tech.profileId,
    specialization: tech.specialization,
    experienceYears: tech.experienceYears,
    certificationDetails: '',
    maxDailyAssignments: tech.maxDailyAssignments,
    availabilityStatus:
      !tech.isActive ? 4 :
      tech.availabilityStatus === 0 ? 2 :
      tech.availabilityStatus
  };

  this.showEditModal = true;
}

  deleteTech(tech: TechnicianListItem) {
    if (confirm(`Deactivate ${tech.fullName}?`)) {
      this.techService.deleteTechnicianFilter(tech.profileId).subscribe({ next: () => this.loadData() });
    }
  }

  saveTechnician() {
    if (this.showEditModal) {
      this.techService.updateTechnician(this.formData).subscribe({ next: () => { this.closeModals(); this.loadData(); } });
    } else {
      this.techService.createTechnician(this.formData).subscribe({ next: () => { this.closeModals(); this.loadData(); } });
    }
  }

closeModals() {
  this.showCreateModal = false;
  this.showEditModal = false;
  this.formData = {
    fullName: '', email: '', mobileNumber: '', specialization: '',
    experienceYears: 0, certificationDetails: '', maxDailyAssignments: 5,
    joinDate: '', availabilityStatus: 1
  };
}
getAvailableStatuses(currentStatus: number) {
  const statuses = [
    { value: 1, label: 'Available' },
    { value: 2, label: 'On Job' },
    { value: 3, label: 'On Leave' },
    { value: 4, label: 'Inactive' }
  ];

  // If currently inactive, allow reactivation by showing all statuses
  if (currentStatus === 4) {
    return statuses;
  }

  // Otherwise normal active users can still choose any status
  return statuses;
}
 // getStatusColor(s: number): string { return { 1: '#10b981', 2: '#f59e0b', 3: '#6366f1', 4: '#ef4444' }[s] || '#6b7280'; }
//  getStatusLabel(s: number): string { return { 1: 'Available', 2: 'On Job', 3: 'On Leave', 4: 'Inactive' }[s] || 'Unknown'; }
  getAvatarBg(name: string): string { const c = ['#4f46e5','#7c3aed','#ec4899','#f59e0b','#10b981','#06b6d4']; return c[name.charCodeAt(0) % c.length]; }
  getInitials(name: string): string { return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(); }
getStatusColor(status: number, isActive: boolean = true): string {
  if (!isActive) return '#ef4444'; // Inactive

  switch (status) {
    case 1: return '#10b981'; // Available
    case 2: return '#f59e0b'; // On Job
    case 3: return '#6366f1'; // On Leave
    default: return '#6b7280';
  }
}

getStatusLabel(status: number, isActive: boolean = true): string {
  if (!isActive) return 'Inactive';

  switch (status) {
    case 1: return 'Available';
    case 2: return 'On Job';
    case 3: return 'On Leave';
    default: return 'Unknown';
  }
}
}
