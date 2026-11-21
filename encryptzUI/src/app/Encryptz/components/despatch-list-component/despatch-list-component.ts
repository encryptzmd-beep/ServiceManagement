import { TransporterMasterComponent, TransporterPickerComponent } from '../transporter-component/transporter-component';
import { AppToastComponent } from '../app-toast-component/app-toast-component';
import { statusText } from '../shared/sales-input-rules';
import { AppRightDirective } from '../shared/app-right/app-right';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { ComplaintDetailPopupComponent } from '../complaint-detail-popup-component/complaint-detail-popup-component';
import { ApiService } from '../../Services/API/api-service';
import { AuthService } from '../../Auth/auth-service';
import { ModuleRefusedComponent, isModuleRefusal } from '../shared/module-refused';
import { DESPATCH_MODES, DespatchFilter, DespatchListItem, SalesOrderListItem, ServiceDespatchCreate, ServiceDespatchItem } from '../../Models/ApiModels';
import { todayInIndia } from '../shared/sales-input-rules';

type DespatchSource = 'sales' | 'spare' | 'repair';

@Component({
  selector: 'app-despatch-list',
  standalone: true,
  imports: [TransporterMasterComponent, TransporterPickerComponent, AppToastComponent, AppRightDirective, CommonModule, FormsModule, RouterModule, ModuleRefusedComponent, ComplaintDetailPopupComponent],
  templateUrl: './despatch-list-component.html',
  styleUrls: ['./despatch-list-component.scss'],
})
export class DespatchListComponent implements OnInit {
  readonly statusText = statusText;
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute, { optional: true });
  private auth = inject(AuthService);

  // ── one Despatch: sales orders, spare parts, repaired parts ──
  /** A Storekeeper reviews and issues parts; sales bills are not theirs to see. */
  readonly isStorekeeper = this.auth.userRole?.() === 'Storekeeper';
  readonly sources: { key: DespatchSource; label: string; icon: string }[] = ([
    { key: 'sales', label: 'Sales', icon: 'receipt_long' },
    { key: 'spare', label: 'Spare Parts', icon: 'build' },
    { key: 'repair', label: 'Repair Parts', icon: 'construction' },
  ] as { key: DespatchSource; label: string; icon: string }[]).filter(s => !this.isStorekeeper || s.key !== 'sales');
  readonly modes = DESPATCH_MODES;
  readonly today = todayInIndia();
  source = signal<DespatchSource>(this.isStorekeeper ? 'spare' : 'sales');
  serviceStage = signal<'Pending' | 'Despatched'>('Pending');
  serviceRows = signal<ServiceDespatchItem[]>([]);
  serviceTotal = signal(0);
  servicePages = signal(1);
  serviceLoading = signal(false);
  serviceError = signal('');
  serviceToast = signal('');
  transportersOpen = signal(false);
  serviceSearch = '';
  serviceFrom = '';
  serviceTo = '';
  servicePage = 1;
  private readonly servicePageSize = 20;

  /** The requests in the despatch window: one, or several selected on the Dashboard. */
  despatching = signal<ServiceDespatchItem[]>([]);
  sdSaving = signal(false);
  sdError = signal('');
  sd = this.blankServiceDespatch();
  sdMode = () => DESPATCH_MODES.find(m => m.value === this.sd.despatchMode) ?? DESPATCH_MODES[0];

  tab = signal<'despatched' | 'pending'>('pending');

  // despatched
  despatches = signal<DespatchListItem[]>([]);
  totalCount = signal(0);
  totalPages = signal(1);
  filter: DespatchFilter = { pageNumber: 1, pageSize: 20, searchTerm: '' };

  // bills waiting for despatch
  pending = signal<SalesOrderListItem[]>([]);
  pendingTotal = signal(0);
  pendingPages = signal(1);
  pendingSearch = '';
  pendingPage = 1;
  pendingPageSize = 20;
  readonly pageSizes = [10, 20, 50, 100];

  /** The API refused (403): the session was opened for another module. */
  refused = signal(false);
  loading = signal(false);

  inWarranty = computed(() => this.despatches().filter(d => d.warrantyStatus === 'In Warranty').length);
  unassigned = computed(() => this.despatches().filter(d => d.installationComplaintId && !d.assignedTechnicians).length);

  ngOnInit(): void {
    if (!this.isStorekeeper) { this.loadPending(); this.load(); }
    const asked = this.route?.snapshot?.queryParamMap?.get('source');
    if (asked === 'spare' || asked === 'repair') {
      this.setSource(asked);
      const ids = (this.route?.snapshot?.queryParamMap?.get('ids') ?? '').split(',').map(Number).filter(n => n > 0);
      if (ids.length) this.openRequested(asked, ids);
    } else if (this.isStorekeeper) {
      this.setSource('spare');
    }
  }

  // =====================================================================
  // older despatches: add the missing mode and reference
  // =====================================================================
  /** The sales despatch whose details are being added. */
  fillSales = signal<DespatchListItem | null>(null);
  /** The despatch window is adding details to a spare or repair despatch already made. */
  fillService = signal(false);
  /** The mode was recorded already, so it stays as it is. */
  modeLocked = signal(false);

  missingDetails(mode?: string | null, reference?: string | null): boolean { return !mode?.trim() || !reference?.trim(); }

  openSalesDetails(d: DespatchListItem): void {
    this.sd = {
      ...this.blankServiceDespatch(),
      despatchMode: d.despatchMode || DESPATCH_MODES[0].value, referenceNo: d.trackingNo || '',
      referenceDate: (d.referenceDate || '').slice(0, 10),
      transporterName: d.transporterName || '', vehicleNo: d.vehicleNo || '',
    };
    this.modeLocked.set(!!d.despatchMode?.trim());
    this.sdError.set('');
    this.fillSales.set(d);
  }

  openServiceDetails(r: ServiceDespatchItem): void {
    this.sd = {
      ...this.blankServiceDespatch(),
      despatchDate: (r.despatchDate || this.today).slice(0, 10),
      despatchMode: r.despatchMode || DESPATCH_MODES[0].value, referenceNo: r.referenceNo || '',
      referenceDate: (r.referenceDate || '').slice(0, 10),
      transporterName: r.transporterName || '', vehicleNo: r.vehicleNo || '', driverName: r.driverName || '', remarks: r.remarks || '',
    };
    this.modeLocked.set(!!r.despatchMode?.trim());
    this.sdError.set('');
    this.fillService.set(true);
    this.despatching.set([r]);
  }

  private async saveDetails(): Promise<void> {
    const mode = this.sdMode();
    const common = {
      despatchMode: this.sd.despatchMode, referenceNo: this.sd.referenceNo.trim(), referenceDate: this.sd.referenceDate || null,
      transporterName: mode.carrier ? this.sd.transporterName.trim() || null : null,
      vehicleNo: mode.vehicle ? this.sd.vehicleNo.trim() || null : null,
      driverName: mode.vehicle ? this.sd.driverName.trim() || null : null,
    };
    const sales = this.fillSales();
    const row = this.despatching()[0];
    this.sdSaving.set(true);
    this.sdError.set('');
    try {
      const res = sales
        ? await firstValueFrom(this.api.addDespatchDetails(sales.despatchId, common))
        : await firstValueFrom(this.api.addServiceDespatchDetails({
            ...common, sourceType: row.sourceType, sourceId: row.sourceId,
            despatchDate: this.sd.despatchDate, remarks: this.sd.remarks.trim() || null,
          }));
      if (!res?.success) throw { error: { message: res?.message } };
      this.closeDetails();
      this.serviceToast.set(res.message || 'Despatch details added.');
      setTimeout(() => this.serviceToast.set(''), 3500);
      if (sales) this.load(); else this.loadService();
    } catch (e: any) {
      this.sdError.set(e?.error?.message || 'The details could not be saved');
    } finally {
      this.sdSaving.set(false);
    }
  }

  private closeDetails(): void {
    this.fillSales.set(null);
    this.fillService.set(false);
    this.modeLocked.set(false);
    this.despatching.set([]);
  }

  /** Came from the Dashboard or Repair Parts: those requests open ready for their mode and reference. */
  private openRequested(source: 'spare' | 'repair', ids: number[]): void {
    this.api.getServiceDespatches({ stage: 'Pending', sourceType: source === 'spare' ? 'Spare' : 'Repair', pageNumber: 1, pageSize: 200 }).subscribe({
      next: r => {
        const rows = (r?.data?.items ?? []).filter(x => ids.includes(x.sourceId));
        if (rows.length) this.openServiceDespatch(rows);
        else this.serviceError.set('The selected request is not waiting for despatch.');
      },
      error: e => this.serviceError.set(e?.error?.message || 'The selected request could not be opened'),
    });
  }

  setTab(t: 'despatched' | 'pending'): void { this.tab.set(t); }

  // =====================================================================
  // spare and repaired parts
  // =====================================================================
  setSource(s: DespatchSource): void {
    if (s === 'sales' && this.isStorekeeper) return;
    this.source.set(s);
    if (s === 'sales') return;
    this.serviceSearch = ''; this.serviceFrom = ''; this.serviceTo = '';
    this.servicePage = 1;
    this.loadService();
  }

  setServiceStage(stage: 'Pending' | 'Despatched'): void {
    this.serviceStage.set(stage);
    this.servicePage = 1;
    this.loadService();
  }

  searchService(): void { this.servicePage = 1; this.loadService(); }

  resetService(): void {
    this.serviceSearch = ''; this.serviceFrom = ''; this.serviceTo = '';
    this.searchService();
  }

  goService(page: number): void {
    if (page < 1 || page > this.servicePages()) return;
    this.servicePage = page;
    this.loadService();
  }

  // ── the summary cards and the details window of a spare or repair despatch ──
  serviceStats = signal({ waiting: 0, despatched: 0, attention: 0, missing: 0 });
  viewing = signal<ServiceDespatchItem | null>(null);
  jobId = signal<number | null>(null);

  private loadServiceStats(source: 'spare' | 'repair'): void {
    const sourceType = source === 'spare' ? 'Spare' as const : 'Repair' as const;
    const read = (stage: 'Pending' | 'Despatched') =>
      this.api.getServiceDespatches({ stage, sourceType, pageNumber: 1, pageSize: 200 }).pipe(catchError(() => of(null)));
    forkJoin({ waiting: read('Pending'), despatched: read('Despatched') }).subscribe(r => {
      if (this.source() !== source) return;
      const waiting = r.waiting?.data?.items ?? [];
      const despatched = r.despatched?.data?.items ?? [];
      this.serviceStats.set({
        waiting: r.waiting?.data?.totalCount ?? 0,
        despatched: r.despatched?.data?.totalCount ?? 0,
        attention: source === 'spare'
          ? waiting.filter(x => x.urgencyLevel === 'Urgent' || x.urgencyLevel === 'Critical').length
          : waiting.filter(x => this.daysSince(x.readyAt) > 3).length,
        missing: despatched.filter(x => this.missingDetails(x.despatchMode, x.referenceNo)).length,
      });
    });
  }

  viewService(r: ServiceDespatchItem): void { this.viewing.set(r); }

  openJob(r: ServiceDespatchItem): void {
    this.viewing.set(null);
    this.jobId.set(r.complaintId ?? null);
  }

  referenceLabel(mode?: string | null): string {
    return DESPATCH_MODES.find(m => m.value === mode)?.reference ?? 'Reference No';
  }

  private daysSince(value?: string | null): number {
    if (!value) return 0;
    const from = value.slice(0, 10);
    return Math.max(0, Math.round((Date.parse(this.today) - Date.parse(from)) / 86_400_000));
  }

  daysWaiting(r: ServiceDespatchItem): string {
    const days = this.daysSince(r.readyAt);
    return days === 0 ? 'Today' : days === 1 ? '1 day waiting' : `${days} days waiting`;
  }

  addressText(r: ServiceDespatchItem): string {
    return [r.customerAddress, r.customerCity].map(x => x?.trim()).filter(Boolean).join(', ') || '—';
  }

  isShort(r: ServiceDespatchItem): boolean {
    return r.stockQuantity !== null && r.stockQuantity !== undefined && r.stockQuantity < r.quantity;
  }

  stockText(r: ServiceDespatchItem): string {
    return r.stockQuantity === null || r.stockQuantity === undefined ? 'Custom part' : `${r.stockQuantity} in stock`;
  }

  loadService(): void {
    const source = this.source();
    if (source === 'sales') return;
    this.loadServiceStats(source);
    if (this.serviceFrom && this.serviceTo && this.serviceFrom > this.serviceTo) {
      this.serviceError.set('To date cannot be before From date');
      return;
    }
    this.serviceLoading.set(true);
    this.serviceError.set('');
    this.api.getServiceDespatches({
      stage: this.serviceStage(), sourceType: source === 'spare' ? 'Spare' : 'Repair',
      searchTerm: this.serviceSearch.trim() || undefined,
      fromDate: this.serviceStage() === 'Despatched' ? this.serviceFrom || undefined : undefined,
      toDate: this.serviceStage() === 'Despatched' ? this.serviceTo || undefined : undefined,
      pageNumber: this.servicePage, pageSize: this.servicePageSize,
    }).subscribe({
      next: r => {
        this.serviceLoading.set(false);
        if (!r?.success) { this.serviceRows.set([]); this.serviceTotal.set(0); this.serviceError.set(r?.message || 'The list could not be read'); return; }
        const items = r.data?.items ?? [];
        const total = r.data?.totalCount ?? 0;
        this.serviceRows.set(items);
        this.serviceTotal.set(total);
        this.servicePages.set(Math.max(1, Math.ceil(total / this.servicePageSize)));
      },
      error: e => {
        this.serviceLoading.set(false);
        this.serviceRows.set([]);
        this.serviceTotal.set(0);
        this.serviceError.set(e?.error?.message || 'The list could not be read');
      },
    });
  }

  private blankServiceDespatch() {
    return {
      despatchDate: todayInIndia(), despatchMode: DESPATCH_MODES[0].value, referenceNo: '', referenceDate: '',
      transporterName: '', vehicleNo: '', driverName: '', remarks: '',
    };
  }

  openServiceDespatch(rows: ServiceDespatchItem[]): void {
    this.sd = this.blankServiceDespatch();
    this.sdError.set('');
    this.despatching.set(rows);
  }

  closeServiceDespatch(): void { if (!this.sdSaving()) this.closeDetails(); }

  async saveServiceDespatch(): Promise<void> {
    const rows = this.despatching();
    if (!rows.length && !this.fillSales()) return;
    if (!this.fillSales()) {
      if (!this.sd.despatchDate) { this.sdError.set('Despatch date is required'); return; }
      if (this.sd.despatchDate > this.today) { this.sdError.set('Despatch date cannot be in the future'); return; }
    }
    if (!this.sd.referenceNo.trim()) { this.sdError.set(`Enter the ${this.sdMode().reference}`); return; }
    if (this.sd.referenceDate && this.sd.referenceDate > this.today) { this.sdError.set('Reference date cannot be in the future'); return; }
    if (this.fillSales() || this.fillService()) { await this.saveDetails(); return; }

    const mode = this.sdMode();
    const details: Omit<ServiceDespatchCreate, 'sourceType' | 'sourceId'> = {
      despatchDate: this.sd.despatchDate, despatchMode: this.sd.despatchMode,
      referenceNo: this.sd.referenceNo.trim() || null,
      referenceDate: this.sd.referenceDate || null,
      // details of another mode, typed before the mode was changed, are not saved
      transporterName: mode.carrier ? this.sd.transporterName.trim() || null : null,
      vehicleNo: mode.vehicle ? this.sd.vehicleNo.trim() || null : null,
      driverName: mode.vehicle ? this.sd.driverName.trim() || null : null,
      remarks: this.sd.remarks.trim() || null,
    };
    this.sdSaving.set(true);
    this.sdError.set('');
    const numbers: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const res = await firstValueFrom(this.api.createServiceDespatch({ ...details, sourceType: r.sourceType, sourceId: r.sourceId }));
        if (!res?.success) throw { error: { message: res?.message } };
        numbers.push(res.data?.despatchNo ?? '');
      } catch (e: any) {
        // those saved are done; the rest stay in the window with the reason
        this.sdSaving.set(false);
        this.despatching.set(rows.slice(i));
        this.sdError.set(`${r.partName}: ${e?.error?.message || 'the despatch could not be saved'}`);
        if (numbers.length) this.loadService();
        return;
      }
    }
    this.sdSaving.set(false);
    this.despatching.set([]);
    this.serviceToast.set(numbers.length === 1 ? `Despatch ${numbers[0]} saved.` : `${numbers.length} despatches saved.`);
    setTimeout(() => this.serviceToast.set(''), 3500);
    this.loadService();
  }

  load(): void {
    this.loading.set(true);
    this.api.getDespatches({ ...this.filter, searchTerm: this.filter.searchTerm?.trim() || undefined }).subscribe({
      next: r => {
        this.loading.set(false);
        const items = r?.items ?? [];
        this.despatches.set(items);
        const total = r?.totalCount > 0 ? r.totalCount : (items[0]?.totalCount ?? 0);
        this.totalCount.set(total);
        this.totalPages.set(Math.max(1, Math.ceil(total / this.filter.pageSize)));
      },
      error: e => { this.loading.set(false); this.refused.set(isModuleRefusal(e)); this.despatches.set([]); },
    });
  }

  loadPending(): void {
    this.api.getSalesOrders({ pageNumber: this.pendingPage, pageSize: this.pendingPageSize, status: 'Billed', searchTerm: this.pendingSearch.trim() || undefined }).subscribe({
      next: r => {
        const items = r?.items ?? [];
        this.pending.set(items);
        const total = r?.totalCount > 0 ? r.totalCount : (items[0]?.totalCount ?? 0);
        this.pendingTotal.set(total);
        this.pendingPages.set(Math.max(1, Math.ceil(total / this.pendingPageSize)));
      },
      error: () => this.pending.set([]),
    });
  }

  search(): void { this.filter.pageNumber = 1; this.load(); }

  resetDespatched(): void {
    this.filter = { pageNumber: 1, pageSize: this.filter.pageSize, searchTerm: '' };
    this.load();
  }

  prevPage(): void { if (this.filter.pageNumber > 1) { this.filter.pageNumber--; this.load(); } }
  nextPage(): void { if (this.filter.pageNumber < this.totalPages()) { this.filter.pageNumber++; this.load(); } }

  goPage(n: number): void { if (n >= 1 && n <= this.totalPages() && n !== this.filter.pageNumber) { this.filter.pageNumber = n; this.load(); } }

  searchPending(): void { this.pendingPage = 1; this.loadPending(); }
  prevPending(): void { if (this.pendingPage > 1) { this.pendingPage--; this.loadPending(); } }
  nextPending(): void { if (this.pendingPage < this.pendingPages()) { this.pendingPage++; this.loadPending(); } }
  goPending(n: number): void { if (n >= 1 && n <= this.pendingPages() && n !== this.pendingPage) { this.pendingPage = n; this.loadPending(); } }

  /** up to five page numbers around the current one */
  pageWindow(current: number, total: number): number[] {
    const from = Math.max(1, current - 2), to = Math.min(total, from + 4);
    const out: number[] = [];
    for (let i = Math.max(1, to - 4); i <= to; i++) out.push(i);
    return out;
  }

  despatch(o: SalesOrderListItem): void { this.router.navigate(['/sales/despatch', o.salesOrderId]); }
  openBill(id: number): void { this.router.navigate(['/sales/orders', id]); }
  view(d: DespatchListItem): void { this.router.navigate(['/sales/despatch/view', d.despatchId]); }
}
