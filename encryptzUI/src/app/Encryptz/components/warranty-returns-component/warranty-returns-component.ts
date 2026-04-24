import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../Services/API/api-service';
import { WarrantyReturn, WarrantyReturnFilter, WarrantyReturnListItem, WarrantyReturnStatusDto } from '../../Models/ApiModels';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-warranty-returns-component',
  imports: [CommonModule,FormsModule],
  templateUrl: './warranty-returns-component.html',
  styleUrl: './warranty-returns-component.scss',
})
export class WarrantyReturnsComponent {
   returns = signal<WarrantyReturnListItem[]>([]);
  selectedReturn = signal<WarrantyReturnListItem | null>(null);
  loading = signal(true);
  totalCount = signal(0);
  showCreateModal = false;
  searchTimeout: any;
  filter: WarrantyReturnFilter = { pageNumber: 1, pageSize: 10 };

  // Stats from current page
  pendingCount = computed(() => this.returns().filter(r => r.statusId === 1).length);
  approvedCount = computed(() => this.returns().filter(r => r.statusId === 2).length);
  completedCount = computed(() => this.returns().filter(r => r.statusId === 5).length);
  rejectedCount = computed(() => this.returns().filter(r => r.statusId === 3).length);

  constructor(private wrService: ApiService) {}
  ngOnInit() { this.loadData(); }
  totalPages = () => Math.ceil(this.totalCount() / this.filter.pageSize);

  loadData() {
    this.loading.set(true);
    this.wrService.getAllWarranty(this.filter).subscribe({
      next: (res) => { this.returns.set(res.items); this.totalCount.set(res.totalCount); this.loading.set(false); },
      error: () => { this.loadDemo(); this.loading.set(false); }
    });
  }

  onSearch() { clearTimeout(this.searchTimeout); this.searchTimeout = setTimeout(() => { this.filter.pageNumber = 1; this.loadData(); }, 400); }
  viewReturn(r: WarrantyReturnListItem) { this.selectedReturn.set(r); }

  updateStatus(r: WarrantyReturnListItem, statusId: number) {
    const dto: WarrantyReturnStatusDto = { returnId: r.returnId, statusId };
    this.wrService.updateStatus(dto).subscribe({ next: () => this.loadData() });
  }

  getTypeLabel(t: number): string { return { 1: 'Replacement', 2: 'Repair', 3: 'Refund' }[t] || 'Unknown'; }
  getWStatusLabel(s: number): string { return { 1: 'Pending', 2: 'Approved', 3: 'Rejected', 4: 'In Transit', 5: 'Completed' }[s] || 'Unknown'; }

  private loadDemo() {
    this.returns.set([
      { returnId: 1, returnNo: 'WR-20260225-0001', complaintId: 1, complaintNo: 'CMP-001', complaintSubject: 'AC not cooling', customerId: 5, customerName: 'Raj Kumar', customerPhone: '9876543210', productId: 1, productSerialNo: 'SN-AC-2024-001', warrantyStartDate: '2025-01-01', warrantyEndDate: '2026-12-31', returnReason: 'Compressor defective', returnType: 1, statusId: 1, approvedBy: null, approvedDate: null, pickupDate: null, pickupAddress: '123 Main St, Nagercoil', trackingNumber: '', resolutionNotes: '', refundAmount: null, createdDate: '2026-02-25', totalCount: 2 },
      { returnId: 2, returnNo: 'WR-20260224-0002', complaintId: 3, complaintNo: 'CMP-003', complaintSubject: 'Fridge leak', customerId: 8, customerName: 'Suresh V', customerPhone: '9876543212', productId: 3, productSerialNo: 'SN-FR-2024-003', warrantyStartDate: '2024-06-15', warrantyEndDate: '2025-06-15', returnReason: 'Coolant leak - manufacturing defect', returnType: 2, statusId: 2, approvedBy: 1, approvedDate: '2026-02-24', pickupDate: null, pickupAddress: '456 South St, Nagercoil', trackingNumber: 'TRK-12345', resolutionNotes: 'Approved for repair', refundAmount: null, createdDate: '2026-02-24', totalCount: 2 },
    ]);
    this.totalCount.set(2);
  }
}
