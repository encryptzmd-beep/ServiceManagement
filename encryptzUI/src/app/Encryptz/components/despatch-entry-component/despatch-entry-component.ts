import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';
import { DespatchCreate, DespatchDetail, SalesOrderDetail, PRIORITIES } from '../../Models/ApiModels';
import { ComplaintDetailPopupComponent } from '../complaint-detail-popup-component/complaint-detail-popup-component';
import { DialogService } from '../../Services/dialog-service';

/** One unit (bill line × qty) that receives a serial number at despatch. */
interface UnitRow {
  salesOrderItemId: number;
  unitNo: number;
  productName: string;
  brand?: string | null;
  model?: string | null;
  warrantyMonths: number;
  serialNumber: string;
}

/**
 * Two modes (route data `mode`):
 *   create: /sales/despatch/:orderId     despatch a billed sales order
 *   view:   /sales/despatch/view/:id     a despatch with its units, warranty and installation complaint
 */
@Component({
  selector: 'app-despatch-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ComplaintDetailPopupComponent],
  templateUrl: './despatch-entry-component.html',
  styleUrls: ['./despatch-entry-component.scss'],
})
export class DespatchEntryComponent implements OnInit {
  private dialog = inject(DialogService);
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly priorities = PRIORITIES;

  mode = signal<'create' | 'view'>('create');
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  toast = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // create mode
  order = signal<SalesOrderDetail | null>(null);
  units = signal<UnitRow[]>([]);
  despatchDate = this.todayInput();
  deliveryAddress = '';
  contactPerson = '';
  contactNumber = '';
  transporterName = '';
  vehicleNo = '';
  driverName = '';
  trackingNo = '';
  remarks = '';
  createInstallationComplaint = true;
  priority = 'Medium';
  preferredDate = '';

  // view mode
  detail = signal<DespatchDetail | null>(null);
  showComplaint = signal(false);

  private despatchDateSig = signal(this.despatchDate);
  unitCount = computed(() => this.units().length);
  missingSerials = computed(() => this.units().filter(u => !u.serialNumber?.trim()).length);
  duplicateSerial = computed(() => {
    const seen = new Set<string>();
    for (const u of this.units()) {
      const s = (u.serialNumber || '').trim().toUpperCase();
      if (!s) continue;
      if (seen.has(s)) return s;
      seen.add(s);
    }
    return '';
  });
  warrantyEndDates = computed(() => this.units().map(u => this.addMonths(this.despatchDateSig(), u.warrantyMonths)));

  ngOnInit(): void {
    const mode = (this.route.snapshot.data['mode'] as 'create' | 'view') || 'create';
    this.mode.set(mode);
    if (mode === 'view') {
      const id = Number(this.route.snapshot.paramMap.get('id') || 0);
      this.loadDespatch(id);
    } else {
      const orderId = Number(this.route.snapshot.paramMap.get('orderId') || 0);
      this.loadOrder(orderId);
    }
  }

  // =====================================================================
  // create
  // =====================================================================
  loadOrder(id: number): void {
    if (!id) { this.error.set('No bill selected'); return; }
    this.loading.set(true);
    this.api.getSalesOrder(id).subscribe({
      next: r => {
        this.loading.set(false);
        if (!r?.success || !r.data) { this.error.set(r?.message || 'Bill not found'); return; }
        const d = r.data;
        this.order.set(d);

        if (d.order.status === 'Despatched' && d.despatches?.length) {
          // already done: show the despatch instead
          this.router.navigate(['/sales/despatch/view', d.despatches[0].despatchId], { replaceUrl: true });
          return;
        }
        if (d.order.status !== 'Billed') { this.error.set(`Bill ${d.order.orderNo} is ${d.order.status.toLowerCase()} and cannot be despatched.`); }

        const o = d.order;
        this.deliveryAddress = [o.billingAddress, o.city, o.state, o.pinCode].filter(Boolean).join(', ');
        this.contactPerson = o.customerName;
        this.contactNumber = o.contactNumber || o.customerMobile || '';

        const rows: UnitRow[] = [];
        for (const it of d.items) {
          for (let n = 1; n <= Math.max(1, it.qty); n++) {
            rows.push({
              salesOrderItemId: it.salesOrderItemId, unitNo: n,
              productName: it.productName, brand: it.brand, model: it.model,
              warrantyMonths: it.warrantyMonths, serialNumber: '',
            });
          }
        }
        this.units.set(rows);
      },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message || 'Could not load the bill'); },
    });
  }

  onDateChange(): void { this.despatchDateSig.set(this.despatchDate); }
  touchUnits(): void { this.units.update(u => [...u]); }

  async submit(): Promise<void> {
    const o = this.order();
    if (!o) return;
    if (o.order.status !== 'Billed') { this.error.set('This bill cannot be despatched.'); return; }
    if (!this.despatchDate) { this.error.set('Despatch date is required'); return; }
    const dup = this.duplicateSerial();
    if (dup) { this.error.set(`Serial number ${dup} is entered more than once`); return; }
    if (this.missingSerials() > 0 && !(await this.dialog.confirm(`${this.missingSerials()} unit(s) have no serial number. A serial number will be generated from the bill number. Continue?`))) return;
    this.error.set('');

    const dto: DespatchCreate = {
      salesOrderId: o.order.salesOrderId,
      despatchDate: this.despatchDate,
      deliveryAddress: this.deliveryAddress || null,
      contactPerson: this.contactPerson || null,
      contactNumber: this.contactNumber || null,
      transporterName: this.transporterName || null,
      vehicleNo: this.vehicleNo || null,
      driverName: this.driverName || null,
      trackingNo: this.trackingNo || null,
      remarks: this.remarks || null,
      createInstallationComplaint: this.createInstallationComplaint,
      priority: this.priority,
      preferredDate: this.preferredDate || null,
      units: this.units().map(u => ({ salesOrderItemId: u.salesOrderItemId, serialNumber: u.serialNumber?.trim() || null })),
    };

    this.saving.set(true);
    this.api.createDespatch(dto).subscribe({
      next: r => {
        this.saving.set(false);
        if (!r?.success || !r.data) { this.error.set(r?.message || 'Could not despatch'); this.showToast('error', this.error()); return; }
        this.showToast('success', r.message || `Despatch ${r.data.despatchNo} saved`);
        setTimeout(() => this.router.navigate(['/sales/despatch/view', r.data!.despatchId], { replaceUrl: true }), 600);
      },
      error: e => { this.saving.set(false); const m = e?.error?.message || 'Could not despatch'; this.error.set(m); this.showToast('error', m); },
    });
  }

  // =====================================================================
  // view
  // =====================================================================
  loadDespatch(id: number): void {
    if (!id) { this.error.set('No despatch selected'); return; }
    this.loading.set(true);
    this.api.getDespatch(id).subscribe({
      next: r => {
        this.loading.set(false);
        if (!r?.success || !r.data) { this.error.set(r?.message || 'Despatch not found'); return; }
        this.detail.set(r.data);
      },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message || 'Could not load the despatch'); },
    });
  }

  openComplaint(): void { if (this.detail()?.despatch?.installationComplaintId) this.showComplaint.set(true); }
  closeComplaint(): void { this.showComplaint.set(false); }
  refreshDespatch(): void { const d = this.detail(); if (d) this.loadDespatch(d.despatch.despatchId); }

  openBill(): void {
    const id = this.detail()?.despatch?.salesOrderId ?? this.order()?.order?.salesOrderId;
    if (id) this.router.navigate(['/sales/orders', id]);
  }
  goDashboard(): void { this.router.navigate(['/complaints/dashboard']); }
  back(): void { this.router.navigate(['/sales/despatch']); }

  // =====================================================================
  // helpers
  // =====================================================================
  showToast(type: 'success' | 'error', text: string): void {
    this.toast.set({ type, text });
    setTimeout(() => this.toast.set(null), 3500);
  }

  addMonths(dateInput: string, months: number): Date | null {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    d.setMonth(d.getMonth() + (Number(months) || 0));
    return d;
  }

  private todayInput(): string {
    const dt = new Date();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${m}-${day}`;
  }
}
