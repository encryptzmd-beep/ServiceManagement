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

  items       = signal<any[]>([]);
  loading     = signal(true);
  totalCount  = signal(0);
  pageNumber  = signal(1);
  pageSize    = signal(20);

  filterStatus = '';
  searchTimeout: any;

  // Detail / images panel
  selected        = signal<any | null>(null);
  imagesList      = signal<any[]>([]);
  imagesLoading   = signal(false);
  lightboxImg     = signal<string | null>(null);

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

  totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()));

  readonly STATUS_COLORS: Record<string, string> = {
    Requested:    '#6366f1',
    ReceivedAtHQ: '#0ea5e9',
    UnderRepair:  '#f59e0b',
    Repaired:     '#10b981',
    Dispatched:   '#8b5cf6',
    Delivered:    '#3b82f6',
    Resolved:     '#22c55e',
  };

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const filter: any = { pageNumber: this.pageNumber(), pageSize: this.pageSize() };
    if (this.filterStatus) filter.status = this.filterStatus;
    this.api.getRepairParts(filter).subscribe({
      next: (res: any) => {
        const list = res?.data ?? res ?? [];
        this.items.set(list);
        this.totalCount.set(list[0]?.totalCount ?? list.length);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast('Failed to load repair requests', true); }
    });
  }

  onFilterChange() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => { this.pageNumber.set(1); this.load(); }, 350);
  }

  changePage(p: number) { this.pageNumber.set(p); this.load(); }

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
}
