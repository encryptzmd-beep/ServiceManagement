import { TransporterPickerComponent } from '../transporter-component/transporter-component';
import { AppToastComponent } from '../app-toast-component/app-toast-component';
import { AppRightDirective } from '../shared/app-right/app-right';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';
import { AssignTechnician, DESPATCH_MODES, DespatchCreate, DespatchDetail, DespatchHeader, SalesOrderDetail, PRIORITIES } from '../../Models/ApiModels';
import { SalesDocumentsComponent } from '../shared/sales-documents/sales-documents';

/** A technician as the picker shows it. */
interface TechOption {
  technicianId: number;
  fullName: string;
  specialization?: string | null;
  availabilityStatus?: number;   // 1 Available · 2 Busy · 3 On leave
  todayAssignments?: number;
}
import { ComplaintDetailPopupComponent } from '../complaint-detail-popup-component/complaint-detail-popup-component';
import { DialogService } from '../../Services/dialog-service';
import { statusText, todayInIndia } from '../shared/sales-input-rules';
import { isProductLine } from './despatch-units';

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
  imports: [TransporterPickerComponent, AppToastComponent, AppRightDirective, CommonModule, FormsModule, RouterModule, ComplaintDetailPopupComponent, SalesDocumentsComponent],
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
  referenceDate = '';
  readonly despatchModes = DESPATCH_MODES;
  despatchMode = signal(DESPATCH_MODES[0].value);
  /** What the reference is called, and which details this mode has. */
  modeInfo = computed(() => DESPATCH_MODES.find(m => m.value === this.despatchMode()) ?? DESPATCH_MODES[0]);
  remarks = '';
  createInstallationComplaint = true;
  priority = 'Medium';
  preferredDate = '';
  /** Optional: the technician the installation job goes to as soon as it is created. */
  technicianId: number | null = null;

  // technicians (create-mode picker and the view-mode assign dialog)
  technicians = signal<TechOption[]>([]);
  techLoading = signal(false);
  techError = signal('');

  // view mode
  detail = signal<DespatchDetail | null>(null);
  showComplaint = signal(false);

  // view mode: assign dialog
  showAssign = signal(false);
  assigning = signal(false);
  assignError = signal('');
  assignTechId: number | null = null;
  assignRole: 'Primary' | 'Supporting' = 'Primary';
  assignDate = '';
  assignNotes = '';

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
      this.loadTechnicians();
    }
  }

  // =====================================================================
  // technicians
  // =====================================================================
  loadTechnicians(): void {
    if (this.techLoading() || this.technicians().length) return;
    this.techLoading.set(true);
    this.techError.set('');
    this.api.getTechnicians({ pageNumber: 1, pageSize: 200 }).subscribe({
      next: (d: any) => {
        this.techLoading.set(false);
        const raw = d?.data?.items ?? d?.data ?? d?.items ?? d;
        const list: TechOption[] = (Array.isArray(raw) ? raw : [])
          .filter((t: any) => t?.technicianId && t.isActive !== false)
          .map((t: any) => ({
            technicianId: t.technicianId, fullName: t.fullName || `Technician ${t.technicianId}`,
            specialization: t.specialization, availabilityStatus: t.availabilityStatus,
            todayAssignments: t.todayAssignments,
          }))
          // available first, then busy, then on leave; by name within each
          .sort((a: TechOption, b: TechOption) =>
            (a.availabilityStatus ?? 9) - (b.availabilityStatus ?? 9) || a.fullName.localeCompare(b.fullName));
        this.technicians.set(list);
      },
      error: () => { this.techLoading.set(false); this.techError.set('Could not load the technicians'); },
    });
  }

  techLabel(t: TechOption): string {
    const state = t.availabilityStatus === 1 ? 'Available' : t.availabilityStatus === 2 ? 'Busy' : t.availabilityStatus === 3 ? 'On leave' : '';
    const jobs = t.todayAssignments ? `${t.todayAssignments} job${t.todayAssignments === 1 ? '' : 's'} today` : '';
    return [t.fullName, t.specialization, state, jobs].filter(Boolean).join(' · ');
  }

  techName(id: number | null): string {
    return this.technicians().find(t => t.technicianId === id)?.fullName || 'the technician';
  }

  /** Assigns the installation complaint; the error text (or '') comes back. */
  private assign(p: AssignTechnician): Promise<string> {
    return new Promise(resolve => {
      this.api.assignTechnician(p).subscribe({
        next: (r: any) => resolve(r?.success === false ? (r?.message || 'The technician could not be assigned') : ''),
        error: e => resolve(e?.error?.message || 'The technician could not be assigned'),
      });
    });
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
        for (const it of d.items.filter(isProductLine)) {   // service lines get no serial / warranty
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

  /** The earliest despatch date: goods cannot leave before they are billed. */
  billDate = computed(() => String(this.order()?.order?.orderDate ?? '').slice(0, 10));
  readonly today = todayInIndia();
  readonly statusText = statusText;
  touchUnits(): void { this.units.update(u => [...u]); }

  async submit(): Promise<void> {
    const o = this.order();
    if (!o) return;
    if (o.order.status !== 'Billed') { this.error.set('This bill cannot be despatched.'); return; }
    if (!this.despatchDate) { this.error.set('Despatch date is required'); return; }
    if (this.billDate() && this.despatchDate < this.billDate()) { this.error.set('Despatch date cannot be before the bill date'); return; }
    if (!this.trackingNo.trim()) { this.error.set(`Enter the ${this.modeInfo().reference}`); return; }
    if (this.preferredDate && this.preferredDate < this.today) { this.error.set('Preferred installation date cannot be in the past'); return; }
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
      // details of another mode, typed before the mode was changed, are not saved
      transporterName: this.modeInfo().carrier ? this.transporterName || null : null,
      vehicleNo: this.modeInfo().vehicle ? this.vehicleNo || null : null,
      driverName: this.modeInfo().vehicle ? this.driverName || null : null,
      trackingNo: this.trackingNo.trim() || null,
      despatchMode: this.despatchMode(),
      referenceDate: this.referenceDate || null,
      remarks: this.remarks || null,
      createInstallationComplaint: this.createInstallationComplaint,
      priority: this.priority,
      preferredDate: this.preferredDate || null,
      units: this.units().map(u => ({ salesOrderItemId: u.salesOrderItemId, serialNumber: u.serialNumber?.trim() || null })),
    };

    this.saving.set(true);
    this.api.createDespatch(dto).subscribe({
      next: async r => {
        if (!r?.success || !r.data) { this.saving.set(false); this.error.set(r?.message || 'Could not despatch'); this.showToast('error', this.error()); return; }
        const saved = r.data;

        // the despatch is saved; now hand the installation job to the chosen technician
        let assignFailed = '';
        if (this.createInstallationComplaint && this.technicianId && saved.complaintId) {
          assignFailed = await this.assign({
            complaintId: saved.complaintId,
            technicianId: this.technicianId,
            assignmentRole: 'Primary',
            priority: this.priority,
            scheduledDate: this.preferredDate || undefined,
            notes: `Installation for despatch ${saved.despatchNo}`,
          });
        }
        this.saving.set(false);

        if (assignFailed) {
          this.showToast('error', `Despatch ${saved.despatchNo} saved, but ${assignFailed.toLowerCase()}. Assign it from the despatch page.`);
        } else if (this.technicianId && saved.complaintId) {
          this.showToast('success', `Despatch ${saved.despatchNo} saved; installation ${saved.complaintNumber} assigned to ${this.techName(this.technicianId)}.`);
        } else {
          this.showToast('success', r.message || `Despatch ${saved.despatchNo} saved`);
        }
        setTimeout(() => this.router.navigate(['/sales/despatch/view', saved.despatchId], { replaceUrl: true }), assignFailed ? 1800 : 900);
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

  /** A closed or cancelled installation job takes no new technician. */
  canAssign = computed(() => {
    const d = this.detail()?.despatch;
    if (!d?.installationComplaintId) return false;
    const s = (d.installationStatus || '').toLowerCase();
    return !(s.includes('closed') || s.includes('cancel'));
  });

  openAssign(): void {
    if (!this.canAssign()) return;
    const d = this.detail()!.despatch;
    this.assignTechId = null;
    this.assignRole = d.assignedTechnicians ? 'Supporting' : 'Primary';
    this.assignDate = '';
    this.assignNotes = `Installation for despatch ${d.despatchNo}`;
    this.assignError.set('');
    this.showAssign.set(true);
    this.loadTechnicians();
  }

  closeAssign(): void { if (!this.assigning()) this.showAssign.set(false); }

  async confirmAssign(): Promise<void> {
    const d = this.detail()?.despatch;
    if (!d?.installationComplaintId || !this.assignTechId) { this.assignError.set('Choose a technician'); return; }
    if (this.assignDate && this.assignDate < this.today) { this.assignError.set('Visit date cannot be in the past'); return; }
    this.assigning.set(true);
    this.assignError.set('');
    const failed = await this.assign({
      complaintId: d.installationComplaintId,
      technicianId: this.assignTechId,
      assignmentRole: this.assignRole,
      scheduledDate: this.assignDate || undefined,
      notes: this.assignNotes || undefined,
    });
    this.assigning.set(false);
    if (failed) { this.assignError.set(failed); return; }
    this.showAssign.set(false);
    this.showToast('success', `${this.techName(this.assignTechId)} assigned to installation ${d.installationComplaintNo}`);
    this.refreshDespatch();
  }

  referenceLabel(mode?: string | null): string {
    return DESPATCH_MODES.find(m => m.value === mode)?.reference ?? 'Reference No';
  }

  vehicleLine(d: DespatchHeader): string {
    return [d.vehicleNo, d.driverName].filter(Boolean).join(' · ') || '—';
  }

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
