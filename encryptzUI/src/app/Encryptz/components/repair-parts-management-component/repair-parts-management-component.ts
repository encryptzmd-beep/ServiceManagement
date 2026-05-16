import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';

const STATUS_ORDER = ['Requested','ReceivedAtHQ','UnderRepair','Repaired','Dispatched','Delivered','Resolved'];

@Component({
  selector: 'app-repair-parts-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './repair-parts-management-component.html',
  styleUrl: './repair-parts-management-component.scss'
})
export class RepairPartsManagementComponent {
  private api = inject(ApiService);

  // Raw data from API (loaded once, filtered client-side)
  allItems  = signal<any[]>([]);
  loading   = signal(true);

  // Filter signals (computed depends on these)
  filterStatus = signal('');
  searchText   = signal('');
  fromDate     = signal('');
  toDate       = signal('');

  // ngModel props (update signals via change handlers)
  filterStatusVal = '';
  searchVal       = '';
  fromVal         = '';
  toVal           = '';
  today           = this.formatDate(new Date());

  // Pagination
  currentPage  = signal(1);
  itemsPerPage = signal(15);

  // Detail / images panel
  selected      = signal<any | null>(null);
  imagesList    = signal<any[]>([]);
  imagesLoading = signal(false);
  lightboxImg   = signal<string | null>(null);

  // Status update modal
  showStatusModal = signal(false);
  statusTarget    = signal<any | null>(null);
  newStatus       = '';
  statusNotes     = '';
  statusSaving    = signal(false);
  statusMsg       = signal('');
  statusMsgErr    = signal(false);

  // Toast
  toastMsg  = signal('');
  toastErr  = signal(false);
  showToast = signal(false);

  // ── Computed: all filters applied ──────────────────────────────────────
  filteredItems = computed(() => {
    let items  = this.allItems();
    const from   = this.fromDate();
    const to     = this.toDate();
    const status = this.filterStatus();
    const q      = this.searchText().toLowerCase().trim();

    if (from) {
      const fromD = new Date(from);
      items = items.filter(i => new Date(i.createdAt) >= fromD);
    }
    if (to) {
      const toD = new Date(to);
      toD.setHours(23, 59, 59, 999);
      items = items.filter(i => new Date(i.createdAt) <= toD);
    }
    if (status) items = items.filter(i => i.status === status);
    if (q) items = items.filter(i =>
      i.complaintNumber?.toLowerCase().includes(q) ||
      i.partName?.toLowerCase().includes(q) ||
      i.technicianName?.toLowerCase().includes(q) ||
      i.customerName?.toLowerCase().includes(q) ||
      i.partSerialNumber?.toLowerCase().includes(q)
    );
    return items;
  });

  // ── Computed: paginated slice ───────────────────────────────────────────
  displayItems = computed(() => {
    const all   = this.filteredItems();
    const start = (this.currentPage() - 1) * this.itemsPerPage();
    return all.slice(start, start + this.itemsPerPage());
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredItems().length / this.itemsPerPage()))
  );

  pageNumbers = computed((): (number | string)[] => {
    const total   = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | string)[] = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    if (total > 1) pages.push(total);
    return pages;
  });

  showingFrom = computed(() => this.filteredItems().length === 0 ? 0 : (this.currentPage() - 1) * this.itemsPerPage() + 1);
  showingTo   = computed(() => Math.min(this.currentPage() * this.itemsPerPage(), this.filteredItems().length));

  readonly STATUS_COLORS: Record<string, string> = {
    Requested:    '#6366f1',
    ReceivedAtHQ: '#0ea5e9',
    UnderRepair:  '#f59e0b',
    Repaired:     '#10b981',
    Dispatched:   '#8b5cf6',
    Delivered:    '#3b82f6',
    Resolved:     '#22c55e',
  };

  ngOnInit() {
    this.setLast15(false);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getRepairParts({ pageNumber: 1, pageSize: 500 }).subscribe({
      next: (res: any) => {
        const list = res?.data ?? res ?? [];
        this.allItems.set(Array.isArray(list) ? list : []);
        this.currentPage.set(1);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast('Failed to load repair requests', true); }
    });
  }

  // ── Filter handlers ─────────────────────────────────────────────────────
  onStatusChip(s: string) {
    this.filterStatusVal = this.filterStatusVal === s ? '' : s;
    this.filterStatus.set(this.filterStatusVal);
    this.currentPage.set(1);
  }

  onStatusDropdown() {
    this.filterStatus.set(this.filterStatusVal);
    this.currentPage.set(1);
  }

  onSearch() {
    this.searchText.set(this.searchVal);
    this.currentPage.set(1);
  }

  clearSearch() {
    this.searchVal = '';
    this.searchText.set('');
    this.currentPage.set(1);
  }

  onDateChange() {
    this.fromDate.set(this.fromVal);
    this.toDate.set(this.toVal);
    this.currentPage.set(1);
  }

  setLast15(reset = true) {
    const from = new Date();
    from.setDate(from.getDate() - 14);
    this.fromVal = this.formatDate(from);
    this.toVal   = this.today;
    this.fromDate.set(this.fromVal);
    this.toDate.set(this.toVal);
    if (reset) this.currentPage.set(1);
  }

  setLast30() {
    const from = new Date();
    from.setDate(from.getDate() - 29);
    this.fromVal = this.formatDate(from);
    this.toVal   = this.today;
    this.fromDate.set(this.fromVal);
    this.toDate.set(this.toVal);
    this.currentPage.set(1);
  }

  clearDates() {
    this.fromVal = '';
    this.toVal   = '';
    this.fromDate.set('');
    this.toDate.set('');
    this.currentPage.set(1);
  }

  isActiveDatePreset(days: number): boolean {
    if (!this.fromVal || !this.toVal) return false;
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return this.fromVal === this.formatDate(from) && this.toVal === this.today;
  }

  // ── Pagination ──────────────────────────────────────────────────────────
  changePage(p: number | string) {
    if (typeof p !== 'number') return;
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
  }

  onPageSizeChange() {
    this.currentPage.set(1);
  }

  // ── Detail panel ────────────────────────────────────────────────────────
  openDetail(item: any) {
    this.selected.set(item);
    this.imagesList.set([]);
    this.imagesLoading.set(true);
    this.api.getRepairImagesByRequest(item.repairRequestId).subscribe({
      next: (res: any) => {
        const list = res?.data ?? res ?? [];
        this.imagesList.set(list.map((img: any) => ({ ...img, base64: null, loaded: false })));
        this.imagesLoading.set(false);
      },
      error: () => { this.imagesLoading.set(false); }
    });
  }

  closeDetail() { this.selected.set(null); this.imagesList.set([]); this.lightboxImg.set(null); }

  loadImageBase64(img: any) {
    if (img.base64 || img.loaded) return;
    img.loaded = true;
    this.api.getRepairImageBase64(img.imageId).subscribe({
      next: (res: any) => { img.base64 = res?.data ?? res; }
    });
  }

  openLightbox(img: any) { this.lightboxImg.set(img.base64 ?? null); }
  closeLightbox() { this.lightboxImg.set(null); }

  // ── Status modal ────────────────────────────────────────────────────────
  openStatusModal(item: any) {
    this.statusTarget.set(item);
    this.newStatus   = item.status;
    this.statusNotes = '';
    this.statusMsg.set('');
    this.statusMsgErr.set(false);
    this.showStatusModal.set(true);
  }

  closeStatusModal() { this.showStatusModal.set(false); this.statusTarget.set(null); }

  saveStatus() {
    const item = this.statusTarget();
    if (!item || !this.newStatus) return;
    this.statusSaving.set(true);
    this.statusMsg.set('');
    this.api.updateRepairStatus(item.repairRequestId, this.newStatus, this.statusNotes || undefined).subscribe({
      next: (res: any) => {
        this.statusSaving.set(false);
        if (res?.success) {
          this.closeStatusModal();
          this.load();
          if (this.selected()?.repairRequestId === item.repairRequestId) {
            this.selected.update(s => s ? { ...s, status: this.newStatus } : s);
          }
          this.toast('Status updated');
        } else {
          this.statusMsg.set(res?.message ?? 'Update failed');
          this.statusMsgErr.set(true);
        }
      },
      error: () => {
        this.statusSaving.set(false);
        this.statusMsg.set('Update failed');
        this.statusMsgErr.set(true);
      }
    });
  }

  nextStatuses(current: string): string[] {
    const idx = STATUS_ORDER.indexOf(current);
    if (idx < 0 || idx >= STATUS_ORDER.length - 1) return [];
    return STATUS_ORDER.slice(idx + 1);
  }

  statusColor(s: string) { return this.STATUS_COLORS[s] ?? '#6b7280'; }

  isStatusDone(current: string, step: string): boolean {
    return STATUS_ORDER.indexOf(current) > STATUS_ORDER.indexOf(step);
  }

  private toast(msg: string, err = false) {
    this.toastMsg.set(msg); this.toastErr.set(err); this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 3000);
  }

  private formatDate(d: Date): string {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
