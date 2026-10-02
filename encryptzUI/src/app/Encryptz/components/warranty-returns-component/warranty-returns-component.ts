import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../Services/API/api-service';
import { ComplaintLookup, WarrantyReturnFilter, WarrantyReturnListItem, WarrantyReturnStatusDto } from '../../Models/ApiModels';
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
  loadError = signal('');
  searchTimeout: any;

  // ── New Return ──────────────────────────────────────────
  showCreateModal = signal(false);
  saving = signal(false);
  createError = signal('');
  complaintSearch = '';
  complaintResults = signal<ComplaintLookup[]>([]);
  selectedComplaint = signal<ComplaintLookup | null>(null);
  private complaintSearchTimeout: any;
  newReturn = { returnType: 1, returnReason: '', pickupAddress: '' };
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
      next: (res) => {
        this.returns.set(res?.items ?? []);
        this.totalCount.set(res?.totalCount ?? 0);
        this.loadError.set('');
        this.loading.set(false);
      },
      error: () => {
        this.returns.set([]);
        this.totalCount.set(0);
        this.loadError.set('Warranty returns could not be loaded. Please try again.');
        this.loading.set(false);
      }
    });
  }

  onSearch() { clearTimeout(this.searchTimeout); this.searchTimeout = setTimeout(() => { this.filter.pageNumber = 1; this.loadData(); }, 400); }
  viewReturn(r: WarrantyReturnListItem) { this.selectedReturn.set(r); }

  updateStatus(r: WarrantyReturnListItem, statusId: number) {
    const dto: WarrantyReturnStatusDto = { returnId: r.returnId, statusId };
    this.wrService.updateStatus(dto).subscribe({ next: () => this.loadData() });
  }

  openCreate() {
    this.newReturn = { returnType: 1, returnReason: '', pickupAddress: '' };
    this.complaintSearch = '';
    this.complaintResults.set([]);
    this.selectedComplaint.set(null);
    this.createError.set('');
    this.showCreateModal.set(true);
  }

  closeCreate() {
    if (this.saving()) return;
    this.showCreateModal.set(false);
  }

  onComplaintSearch() {
    clearTimeout(this.complaintSearchTimeout);
    this.selectedComplaint.set(null);
    const term = this.complaintSearch.trim();
    if (term.length < 2) { this.complaintResults.set([]); return; }

    this.complaintSearchTimeout = setTimeout(() => {
      this.wrService.getComplaintsLookup(term, true).subscribe({
        next: (list) => this.complaintResults.set(list ?? []),
        error: () => this.complaintResults.set([])
      });
    }, 300);
  }

  pickComplaint(c: ComplaintLookup) {
    this.selectedComplaint.set(c);
    this.complaintSearch = c.complaintNumber + ' — ' + c.subject;
    this.complaintResults.set([]);
  }

  canSaveReturn(): boolean {
    return !!this.selectedComplaint() && this.newReturn.returnReason.trim().length > 0 && !this.saving();
  }

  saveReturn() {
    const complaint = this.selectedComplaint();
    if (!complaint || !this.canSaveReturn()) return;

    this.saving.set(true);
    this.createError.set('');
    this.wrService.createWarranty({
      complaintId: complaint.complaintId,
      returnType: +this.newReturn.returnType,
      returnReason: this.newReturn.returnReason.trim(),
      pickupAddress: this.newReturn.pickupAddress.trim()
    }).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res?.success === false) {
          this.createError.set(res.message || 'The return could not be created.');
          return;
        }
        this.showCreateModal.set(false);
        this.filter.pageNumber = 1;
        this.loadData();
      },
      error: (err) => {
        this.saving.set(false);
        this.createError.set(err?.error?.message || 'The return could not be created. Please try again.');
      }
    });
  }

  getTypeLabel(t: number): string { return { 1: 'Replacement', 2: 'Repair', 3: 'Refund' }[t] || 'Unknown'; }
  getWStatusLabel(s: number): string { return { 1: 'Pending', 2: 'Approved', 3: 'Rejected', 4: 'In Transit', 5: 'Completed' }[s] || 'Unknown'; }

}
