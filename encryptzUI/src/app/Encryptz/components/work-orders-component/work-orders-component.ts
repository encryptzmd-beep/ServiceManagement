import { Component, inject, OnInit, signal, computed, DestroyRef, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../Services/API/api-service';
import { WorkOrder } from '../../Models/ApiModels';
import { AuthService } from '../../Auth/auth-service';
import { GpsTracking } from '../../Services/gps-tracking';
import { GeocodeService } from '../../Services/API/geocode-service';
type SpareCartItem = {
  part?: any;                 // for master item
  isCustom: boolean;          // flag
  customPartName?: string;
  customPartNumber?: string;
  customPartPhoto?: { file: File; preview: string } | null;
  quantity: number;
  urgencyLevel: string;
  remarks: string;
};
@Component({
  selector: 'app-work-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './work-orders-component.html',
  styleUrls: ['./work-orders-component.scss'],
})
export class WorkOrdersComponent implements OnInit, OnDestroy {
  private api         = inject(ApiService);
  private auth        = inject(AuthService);
  private router      = inject(Router);
  private _destroyRef = inject(DestroyRef);
  private techSearchSubject = new Subject<string>();
constructor() {}
  // ── Role-based visibility ─────────────────────────────
  isAdmin = computed(() => this.auth.userRole() === 'Admin');
  readonly gpsService = inject(GpsTracking);

// ── Check-in/out state ──────────────────────────────────
isCheckedIn  = signal(false);
checkInTime  = signal<Date | null>(null);
currentCoords = signal('');
checkInBusy  = signal(false);
checkInMsg   = signal('');
checkInErr   = signal(false);
private geocode = inject(GeocodeService);

// Change currentCoords to locationName
locationName = signal('');
spareCart = signal<SpareCartItem[]>([]);
urgencyOptions = ['Normal', 'Urgent', 'Critical'];

spareSubmitting = signal(false);
spareMsg = signal('');
spareMsgErr = signal(false);

spareCartTotal = computed(() =>
  this.spareCart().reduce((sum, i) => sum + i.quantity, 0)
);
spareCartCount = computed(() => this.spareCart().length);
hasInvalidCustomParts = computed(() =>
  this.spareCart().some(item => item.isCustom && !item.customPartName?.trim())
);

showRepairDialog = signal(false);
repairDialogWo = signal<WorkOrder | null>(null);
repairMeta = signal<any>(null);
repairLoading = signal(false);
repairSubmitting = signal(false);
repairMsg = signal('');
repairMsgErr = signal(false);
repairImages = signal<{ file: File; preview: string; tag: string }[]>([]);
repairUploadProgress = signal(0);
repairUploadStep = signal(0);
repairUploadTotal = signal(0);
repairForm = {
  partName: '',
  partSerialNumber: '',
  customerCode: '',
  notes: ''
};
repairAdvanceAmount = signal<number | null>(null);
spareAdvanceAmount  = signal<number | null>(null);
spareAdvanceMethod  = signal<'Cash' | 'UPI'>('Cash');
repairAdvanceMethod = signal<'Cash' | 'UPI'>('Cash');

  // ── Orders ────────────────────────────────────────────
  orders       = signal<WorkOrder[]>([]);
  activeFilter = signal<string>('all');
  loading      = signal(false);
  msg          = signal('');
  msgErr       = signal(false);

  // ── Technician autocomplete (Admin only) ──────────────
  techSearch        = '';
  techResults       = signal<any[]>([]);
  showTechDropdown  = false;
  selectedTech      = signal<any>(null);
  techId            = 0;
  techSearchLoading = signal(false);

  // ── Unassign ──────────────────────────────────────────
  showUnassignDialog = signal(false);
  unassignTarget     = signal<WorkOrder | null>(null);
  unassignReason     = '';
  unassigning        = signal(false);

  // ── Detail popup ──────────────────────────────────────
  showDetail    = signal(false);
  detailData    = signal<any>(null);
  detailWorkOrder = signal<WorkOrder | null>(null);
  detailLoading = signal(false);
  detailTab     = signal<string>('info'); // 'info' | 'map' | 'spares' | 'repairs' | 'timeline' | 'images' | 'payments'

  // ── Payments ──────────────────────────────────────────
  paymentsList = signal<any[]>([]);
  paymentsLoading = signal(false);
  paymentForm = signal({
    paymentType: 'Final' as string,
    serviceChargeAmount: 0 as number,
    sparePartsAmount: 0 as number,
    discountAmount: 0 as number,
    amountPaid: 0 as number,
    paymentMethod: 'Cash' as string,
    transactionReference: '' as string,
    remarks: '' as string,
  });
  paymentSubmitting = signal(false);
  defaultUpiId = signal<string>('');
  minimumServiceCharge = signal<number>(0);
  paymentMsg = signal('');
  paymentMsgErr = signal(false);
  showNewPaymentForm = signal(false);
  paymentFormTouched = signal(false);

  pf(field: string, val: any): void {
    const numericFields = ['serviceChargeAmount', 'sparePartsAmount', 'discountAmount', 'amountPaid'];
    const nextVal = numericFields.includes(field) ? this.normalizeAmountValue(val) : val;

    this.paymentForm.update(f => {
      const next: any = { ...f, [field]: nextVal };
      // Don't clamp serviceChargeAmount while typing — only validate on submit
      if (field === 'paymentType' && next.paymentType === 'Final') {
        if ((Number(next.serviceChargeAmount) || 0) > 0) {
          next.serviceChargeAmount = Math.max(Number(next.serviceChargeAmount) || 0, this.minimumServiceCharge());
        }
        next.amountPaid = this.payableNowFor(next);
      }
      if (field === 'paymentType' && next.paymentType === 'Advance') {
        next.amountPaid = 0;
      }
      if (next.paymentType === 'Final' && ['serviceChargeAmount', 'sparePartsAmount', 'discountAmount'].includes(field)) {
        next.amountPaid = this.payableNowFor(next);
      }
      return next;
    });
  }

  normalizePaymentNumber(field: string): void {
    this.paymentForm.update(f => {
      let value = this.normalizeAmountValue((f as any)[field]);
      if (field === 'serviceChargeAmount' && value > 0) {
        value = Math.max(value, this.minimumServiceCharge());
      }
      return { ...f, [field]: value };
    });
  }

  onPaymentAmountInput(field: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalized = this.normalizeAmountText(input.value);
    if (input.value !== normalized) input.value = normalized;
    this.paymentFormTouched.set(true);
    this.pf(field, normalized);
  }

  private normalizeAmountValue(value: any): number {
    const raw = this.normalizeAmountText(value);
    if (!raw) return 0;
    return Math.max(Number(raw) || 0, 0);
  }

  private normalizeAmountText(value: any): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const cleaned = raw
      .replace(/[^\d.]/g, '')
      .replace(/(\..*)\./g, '$1');

    if (!cleaned) return '';

    const [wholeRaw, decimalRaw] = cleaned.split('.');
    const whole = wholeRaw.replace(/^0+(?=\d)/, '') || '0';

    if (cleaned.includes('.')) {
      return `${whole}.${decimalRaw ?? ''}`;
    }

    return wholeRaw.replace(/^0+(?=\d)/, '') || '0';
  }

  get netTotal(): number {
    const f = this.paymentForm();
    return (f.serviceChargeAmount || 0) + (f.sparePartsAmount || 0) - (f.discountAmount || 0);
  }

  private payableNowFor(form: any): number {
    const gross = (form.serviceChargeAmount || 0) + (form.sparePartsAmount || 0) - (form.discountAmount || 0);
    const advance = this.showCompleteDialog() ? this.completeAdvancePaid : this.advancePaid;
    return Math.max(gross - advance, 0);
  }

  get advancePaid(): number {
    return this.paymentsList()
      .filter((p: any) => String(p.paymentType || '').toLowerCase() === 'advance')
      .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  }

  get completeAdvancePaid(): number {
    return this.completePayments()
      .filter((p: any) => String(p.paymentType || '').toLowerCase() === 'advance')
      .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  }

  get payableNow(): number {
    return this.paymentForm().paymentType === 'Final'
      ? this.payableNowFor(this.paymentForm())
      : Number(this.paymentForm().amountPaid) || 0;
  }

  get totalPaid(): number {
    return this.paymentsList().reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  }

  get totalBilled(): number {
    const list = this.paymentsList();
    if (!list.length) return 0;
    // Use the Final payment's totalAmount as the authoritative bill; fall back to max seen
    const finalPay = [...list].reverse().find((p: any) => String(p.paymentType || '').toLowerCase() === 'final');
    if (finalPay) return Number(finalPay.totalAmount) || 0;
    return list.reduce((max: number, p: any) => Math.max(max, Number(p.totalAmount) || 0), 0);
  }

  get balanceDue(): number {
    return this.totalBilled - this.totalPaid;
  }

  get qrCodeUrl(): string {
    if (this.paymentForm().paymentMethod === 'UPI' && this.defaultUpiId() && this.payableNow > 0) {
      const upiString = `upi://pay?pa=${this.defaultUpiId()}&pn=Encryptz&am=${this.payableNow.toFixed(2)}&cu=INR`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`;
    }
    return '';
  }

  // ── Spare parts ───────────────────────────────────────
  complaintSpares = signal<any[]>([]);
  sparesLoading   = signal(false);

  // ── Location Device Prompt ────────────────────────────
  showLocationPrompt = signal(false);
  locationDeviceChoice = signal<'mobile' | 'computer' | 'tablet' | null>(null);

  // ── Repair Image Modal ──────────────────────────────
  showRepairImagesModal = signal(false);
  repairImagesLoading = signal(false);
  repairImagesList = signal<any[]>([]);
  activeRepairRequest = signal<any>(null);

  // ── Computed ──────────────────────────────────────────
  filteredOrders = computed(() => {
    const f = this.activeFilter();
    if (f === 'all') return this.orders();
    return this.orders().filter(o => o.status === f);
  });

  todayCount = computed(() => {
    const t = new Date();
    const ymd = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    return this.orders().filter(o => {
      const d = (o.assignedAt as any) ? new Date(o.assignedAt as any).toISOString().slice(0,10) : '';
      return d === ymd;
    }).length;
  });



// ... inside the class, add these fields:


// Add to ngOnInit, inside the else block (non-admin):
ngOnInit(): void {
  if (this.isAdmin()) {
    this.techSearchSubject.pipe(
      debounceTime(300),
      takeUntilDestroyed(this._destroyRef)
    ).subscribe(term => {
      if (!term.trim()) { this.techResults.set([]); return; }
      this.techSearchLoading.set(true);
      this.api.getTechnicians({ searchTerm: term, pageNumber: 1, pageSize: 10 } as any).subscribe({
        next: (d: any) => {
          this.techResults.set(d.items || d || []);
          this.techSearchLoading.set(false);
        },
        error: () => { this.techResults.set([]); this.techSearchLoading.set(false); }
      });
    });
  } else {
    this.checkTechnicianLocation();
    this.techId = this.auth.technicianId();
    this.load();
    this.loadCheckInStatus();
  }
  this.spareSubject.pipe(
  debounceTime(300),
  takeUntilDestroyed(this._destroyRef)
).subscribe(term => {
  this.spareSearchLoading.set(true);
  this.api.searchSpareParts(term).subscribe({
    next: (d: any) => {
      this.spareResults.set(Array.isArray(d) ? d : (d?.data ?? []));
      this.spareSearchLoading.set(false);
    },
    error: () => { this.spareResults.set([]); this.spareSearchLoading.set(false); }
  });
});
  this.refreshInterval = setInterval(() => {
    if (!this.isAdmin()) {
      if (this.isAnyDialogOpen()) return;
      this.load();
    }
  }, 60000);
}

private refreshInterval: any;

// ── Confirmation Dialog ─────────────────────────────────
showConfirmDialog = signal(false);
confirmData = signal<{ message: string; title: string; onConfirm: () => void } | null>(null);

openConfirm(title: string, message: string, onConfirm: () => void): void {
  this.confirmData.set({ title, message, onConfirm });
  this.showConfirmDialog.set(true);
}

closeConfirm(): void {
  this.showConfirmDialog.set(false);
  this.confirmData.set(null);
}

executeConfirm(): void {
  const data = this.confirmData();
  if (data) data.onConfirm();
  this.closeConfirm();
}

isAnyDialogOpen(): boolean {
  return this.showSpareDialog() || this.showRepairDialog() || this.showCompleteDialog() || this.showDetail() || this.showConfirmDialog() || this.showUnassignDialog();
}

private checkTechnicianLocation(): void {
  if (!navigator.geolocation) { this.showLocationPrompt.set(true); return; }
  if (!navigator.permissions) { this.showLocationPrompt.set(true); return; }
  navigator.permissions.query({ name: 'geolocation' }).then(status => {
    if (status.state === 'denied') {
      this.showLocationPrompt.set(true);
    }
    status.onchange = () => {
      if (status.state === 'granted') this.showLocationPrompt.set(false);
      if (status.state === 'denied')  this.showLocationPrompt.set(true);
    };
  }).catch(() => { this.showLocationPrompt.set(true); });
}

retryLocation(): void {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      localStorage.setItem('encryptz_last_lat', pos.coords.latitude.toString());
      localStorage.setItem('encryptz_last_lng', pos.coords.longitude.toString());
      this.showLocationPrompt.set(false);
      this.locationDeviceChoice.set(null);
    },
    () => { /* stay on prompt */ }
  );
}

logoutFromLocation(): void {
  sessionStorage.setItem('felix_location_error',
    'Location permission is required. Please enable it and log in again.');
  this.auth.logout();
}

ngOnDestroy(): void {
  if (this.refreshInterval) {
    clearInterval(this.refreshInterval);
  }
}

private loadCheckInStatus(): void {
  if (!this.techId) return;
  const today = this.formatDate(new Date());
  this.api.getAttendance(this.techId, today, today).subscribe({
    next: (res: any) => {
      const records: any[] = Array.isArray(res?.data ?? res) ? (res?.data ?? res) : [];
      const active = records.find((a: any) => a.checkInTime && !a.checkOutTime);
      if (active) {
        this.isCheckedIn.set(true);
        this.checkInTime.set(new Date(active.checkInTime));
        // Reverse geocode the check-in location
        if (active.checkInLatitude && active.checkInLongitude) {
          this.geocode.reverseGeocode(active.checkInLatitude, active.checkInLongitude)
            .subscribe(name => this.locationName.set(name));
        } else {
          this.locationName.set(active.checkInAddress || '');
        }
        if (!this.gpsService.isTracking()) {
          this.gpsService.startTracking(this.techId);
        }
      } else {
        this.isCheckedIn.set(false);
        this.checkInTime.set(null);
        this.locationName.set('');
      }
    },
    error: () => this.isCheckedIn.set(false)
  });
}

// Update checkIn() — resolve after successful check-in:
checkIn(): void {
  if (!this.techId) return;
  this.openConfirm('Confirm Check In', 'Are you sure you want to check in now?', () => {
    this.checkInBusy.set(true);
    this.checkInMsg.set('');

    this.getGeo().then(pos => {
      this.api.checkIn(this.techId, {
        latitude: pos.latitude, longitude: pos.longitude, address: null
      }).subscribe({
        next: (res: any) => {
          this.checkInBusy.set(false);
          if (res.success) {
            this.isCheckedIn.set(true);
            this.checkInTime.set(new Date());
            // Reverse geocode
            this.geocode.reverseGeocode(pos.latitude, pos.longitude)
              .subscribe(name => this.locationName.set(name));
            this.showCheckInMsg('Checked in successfully!', false);
            this.gpsService.startTracking(this.techId);
          } else {
            this.showCheckInMsg(res.message || 'Check-in failed', true);
          }
        },
        error: () => { this.checkInBusy.set(false); this.showCheckInMsg('Check-in failed', true); }
      });
    }).catch(() => {
      this.checkInBusy.set(false);
      this.showCheckInMsg('Unable to get GPS location.', true);
    });
  });
}

// ── Check Out ───────────────────────────────────────────
checkOut(): void {
  if (!this.techId) return;
  this.openConfirm('Confirm Check Out', 'Are you sure you want to check out?', () => {
    this.checkInBusy.set(true);
    this.checkInMsg.set('');

    this.getGeo().then(pos => {
      this.api.checkOut(this.techId, {
        latitude: pos.latitude, longitude: pos.longitude, address: null
      }).subscribe({
        next: (res: any) => {
          this.checkInBusy.set(false);
          if (res.success) {
            this.isCheckedIn.set(false);
            this.checkInTime.set(null);
            this.currentCoords.set('');
            this.showCheckInMsg('Checked out successfully!', false);
            this.gpsService.stopTracking();
          } else {
            this.showCheckInMsg(res.message || 'Check-out failed', true);
          }
        },
        error: () => { this.checkInBusy.set(false); this.showCheckInMsg('Check-out failed', true); }
      });
    }).catch(() => {
      this.checkInBusy.set(false);
      this.showCheckInMsg('Unable to get GPS location.', true);
    });
  });
}

// ── Start Work (status update + site arrival) ───────────
startWork(wo: WorkOrder): void {
  this.msg.set('');

  // 1. Update status to InProgress
  this.api.updateServiceStatus({ AssignmentId: wo.assignmentId, Status: 'InProgress' }).subscribe({
    next: (r: any) => {
      if (r.success) {
        this.show('Status updated to InProgress', false);
        this.load();

        // 2. Auto-record site arrival for this complaint
        this.recordSiteArrival(wo.complaintId, wo.complaintNumber);
        this.showDetail.set(false);
      } else {
        this.show(r.message, true);
      }
    },
    error: () => this.show('Failed to update status.', true),
  });
}

// ── Site Arrival (auto on Start Work) ───────────────────
private recordSiteArrival(complaintId: number, complaintNumber: string): void {
  this.getGeo().then(pos => {
    this.api.recordSiteArrival(this.techId, {
      complaintId,
      latitude: pos.latitude,
      longitude: pos.longitude,
      address: null
    }).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.show(`Site arrival recorded for ${complaintNumber}`, false);
        }
        // Don't show error for site arrival — status update already succeeded
      },
      error: () => { /* silent — main action already done */ }
    });
  }).catch(() => { /* GPS unavailable — skip site arrival silently */ });
}

// ── Helpers ─────────────────────────────────────────────
private getGeo(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject('Not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      e => {
        // Fallback: use last known GPS from tracking service
        const last = this.gpsService.lastPosition();
        if (last) {
          resolve({ latitude: last.lat, longitude: last.lng });
        } else {
          // Fallback: use stored coords from check-in
          const lat = localStorage.getItem('felix_last_lat');
          const lng = localStorage.getItem('felix_last_lng');
          if (lat && lng) {
            resolve({ latitude: parseFloat(lat), longitude: parseFloat(lng) });
          } else {
            reject(e);
          }
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  });
}

private formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

private showCheckInMsg(m: string, err: boolean): void {
  this.checkInMsg.set(m);
  this.checkInErr.set(err);
  if (!err) setTimeout(() => this.checkInMsg.set(''), 3000);
}
  // ── Technician autocomplete (Admin only) ──────────────
  onTechSearch(): void {
    this.showTechDropdown = true;
    this.techSearchSubject.next(this.techSearch);
  }

  selectTech(t: any): void {
    this.selectedTech.set(t);
    this.techId      = t.technicianId;
    this.techSearch  = t.fullName;
    this.showTechDropdown = false;
    this.techResults.set([]);
    this.load();
  }

  clearTech(): void {
    this.selectedTech.set(null);
    this.techId      = 0;
    this.techSearch  = '';
    this.techResults.set([]);
    this.showTechDropdown = false;
    this.orders.set([]);
    this.msg.set('');
    this.complaintSpares.set([]);
  }


  getTechAvailClass(status: number): string {
    return status === 1 ? 'av' : status === 2 ? 'busy' : 'leave';
  }

  getTechAvailLabel(status: number): string {
    return status === 1 ? 'Available' : status === 2 ? 'Busy' : 'On Leave';
  }

  // ── Load work orders ──────────────────────────────────
  load(): void {
    if (!this.techId) return;
    this.loading.set(true);
    this.msg.set('');
    this.api.getWorkOrders(this.techId).subscribe({
      next: (res: any) => {
        const list: WorkOrder[] = (Array.isArray(res) ? res : (res?.data ?? []))
          .filter((o: any) => this.isActiveAssignmentStatus(o?.status));
        this.orders.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.show('Failed to load work orders.', true);
      },
    });
  }

  countByStatus(status: string): number {
    return this.orders().filter(o => o.status === status).length;
  }

  // ── Status update ─────────────────────────────────────
  updateStatus(AssignmentId: number, Status: string): void {
    this.msg.set('');
    this.api.updateServiceStatus({ AssignmentId, Status }).subscribe({
      next: (r: any) => {
        if (r.success) {
          this.show(`Status updated to ${Status}`, false);
          this.load();
        } else {
          this.show(r.message, true);
        }
      },
      error: () => this.show('Failed to update status.', true),
    });
  }

  // ── Unassign ──────────────────────────────────────────
  openUnassign(wo: WorkOrder, event?: Event): void {
    event?.stopPropagation();
    this.unassignTarget.set(wo);
    this.unassignReason = '';
    this.showUnassignDialog.set(true);
  }

  closeUnassign(): void {
    this.showUnassignDialog.set(false);
    this.unassignTarget.set(null);
    this.unassignReason = '';
  }

  confirmUnassign(): void {
    const target = this.unassignTarget();
    if (!target) return;
    this.unassigning.set(true);
    this.api.unAssignTechnician({
      assignmentId: (target as any).assignmentId,
      reason: this.unassignReason
    }).subscribe({
      next: (r: any) => {
        this.unassigning.set(false);
        if (r.success) {
          this.api.setComplaintHold((target as any).complaintId, this.unassignReason || undefined).subscribe();
          this.show('Work order placed on hold', false);
          this.orders.update(list => list.filter(order => order.assignmentId !== target.assignmentId));
          this.closeUnassign();
          this.closeDetail();
          this.load();
        } else {
          this.show(r.message || 'Unassign failed', true);
        }
      },
      error: () => {
        this.unassigning.set(false);
        this.show('Failed to unassign technician', true);
      }
    });
  }

  canUnassign(wo: WorkOrder): boolean {
    return this.isActiveAssignmentStatus(wo?.status) && wo.status !== 'Completed';
  }

  canComplete(): boolean {
    const repairs = (this.detailData()?.repairDetails ?? []) as any[];
    const spares  = this.complaintSpares();
    const pendingRepair = repairs.some(r => !['Resolved','Cancelled','Rejected'].includes(r.status ?? ''));
    const pendingSpare  = spares.some(s => !['Used','Rejected','Cancelled'].includes(s.status ?? ''));
    return !pendingRepair && !pendingSpare;
  }

  hasPendingParts(): boolean {
    return !this.canComplete() && (
      (this.detailData()?.repairDetails?.length > 0) ||
      (this.complaintSpares().length > 0)
    );
  }

  getUnassignTechnicianName(wo: WorkOrder | null): string {
    if (!wo) return '';
    return wo.technicianName || this.selectedTech()?.fullName || this.auth.currentUser()?.fullName || 'Assigned Technician';
  }

  // ── Detail popup ──────────────────────────────────────
  openDetail(wo: WorkOrder, event?: Event): void {
    event?.stopPropagation();
    this.showDetail.set(true);
    this.detailWorkOrder.set(wo);
    this.detailData.set(wo as any);
    this.detailLoading.set(true);
    this.detailTab.set('info'); // always start on Info tab
    // load detail + spares in parallel
    this.api.getWorkOrderDetails(wo.assignmentId).subscribe({
      next: (res: any) => {
        const detail = Array.isArray(res) ? res[0] : (res?.data ?? res);
        this.detailData.set({
          ...(wo as any),
          ...(detail || {})
        });
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false)
    });
    this.loadComplaintSpares(wo.complaintId);
  }

  closeDetail(): void {
    this.showDetail.set(false);
    this.detailData.set(null);
    this.detailWorkOrder.set(null);
    this.complaintSpares.set([]);
    this.paymentsList.set([]);
  }

  // ── Load Payments ─────────────────────────────────────
  loadPayments(complaintId: number): void {
    this.paymentsLoading.set(true);
    this.api.getComplaintPayments(complaintId).subscribe({
      next: (res: any) => {
        const raw: any[] = Array.isArray(res) ? res
          : Array.isArray(res?.data)  ? res.data
          : Array.isArray(res?.items) ? res.items
          : [];
        // Append 'Z' to bare ISO datetimes so Angular date pipe treats them as UTC
        // and the ':+0530' timezone arg converts to IST for display
        raw.forEach((p: any) => {
          if (p.createdAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(p.createdAt)
              && !p.createdAt.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(p.createdAt)) {
            p.createdAt += 'Z';
          }
        });
        this.paymentsList.set(raw);
        const hasFinal = raw.some((p: any) => String(p.paymentType || '').toLowerCase() === 'final');
        this.showNewPaymentForm.set(!hasFinal);
        if (!hasFinal) this.paymentFormTouched.set(false);
        if (this.paymentForm().paymentType === 'Final') {
          this.paymentForm.update(f => ({ ...f, amountPaid: this.payableNowFor(f) }));
        }
        this.paymentsLoading.set(false);
      },
      error: () => this.paymentsLoading.set(false)
    });
  }

  initPaymentForm(): void {
    this.paymentMsg.set('');

    // Calculate total for valid spare parts
    const spares = this.complaintSpares() || [];
    const validStatuses = ['Used', 'Dispatched', 'Approved'];
    const totalSparesAmount = spares
      .filter((s: any) => s.sparePartId && s.unitPrice && validStatuses.includes(s.status))
      .reduce((sum: number, s: any) => sum + (s.unitPrice * (s.quantity || 1)), 0);

    this.paymentForm.set({
      paymentType: 'Final',
      serviceChargeAmount: 0,
      sparePartsAmount: 0,
      discountAmount: 0,
      amountPaid: 0,
      paymentMethod: 'Cash',
      transactionReference: '',
      remarks: ''
    });

    this.api.getDefaultServiceCharge().subscribe({
      next: (res: any) => {
        const charge = Number(res?.data ?? 0) || 0;
        this.minimumServiceCharge.set(charge);
        if (charge > 0) {
          this.paymentForm.update(f => ({
            ...f,
            serviceChargeAmount: charge,
            amountPaid: f.paymentType === 'Final'
              ? this.payableNowFor({ ...f, serviceChargeAmount: charge })
              : f.amountPaid
          }));
        }
      }
    });

    this.api.getUPIConfigurations().subscribe({
      next: (res: any) => {
        const defaultUpi = (res.data || []).find((u: any) => u.isDefault && u.isActive);
        if (defaultUpi) this.defaultUpiId.set(defaultUpi.upiId);
      }
    });
  }

  setDetailTab(tab: string): void {
    this.detailTab.set(tab);
    if (tab === 'payments') {
      const cid = this.detailData()?.complaintId;
      if (cid) {
        this.loadPayments(cid);
        this.initPaymentForm();
      }
    }
  }

  openNewPaymentForm(): void {
    this.showNewPaymentForm.set(true);
    this.paymentFormTouched.set(false);
    this.initPaymentForm();
  }

  submitPayment(): void {
    const cid = this.detailData()?.complaintId;
    if (!cid) return;

    this.paymentSubmitting.set(true);
    this.paymentMsg.set('');

    const f = this.paymentForm();
    if (f.paymentType === 'Final' && (Number(f.serviceChargeAmount) || 0) < this.minimumServiceCharge()) {
      this.paymentSubmitting.set(false);
      this.paymentMsg.set(`Service charge cannot be below ₹${this.minimumServiceCharge().toFixed(2)}`);
      this.paymentMsgErr.set(true);
      this.paymentForm.update(x => ({ ...x, serviceChargeAmount: this.minimumServiceCharge() }));
      return;
    }

    const amountPaid = f.paymentType === 'Final' ? this.payableNow : Number(f.amountPaid) || 0;
    if (amountPaid <= 0) {
      this.paymentSubmitting.set(false);
      this.paymentMsg.set('Amount paid must be greater than zero');
      this.paymentMsgErr.set(true);
      return;
    }

    const payload = {
      complaintId: cid,
      paymentType: f.paymentType,
      serviceChargeAmount: f.serviceChargeAmount,
      sparePartsAmount: f.sparePartsAmount,
      discountAmount: f.discountAmount,
      totalAmount: this.netTotal,
      amountPaid,
      paymentMethod: f.paymentMethod,
      upiIdUsed: f.paymentMethod === 'UPI' ? this.defaultUpiId() : null,
      transactionReference: f.transactionReference,
      remarks: f.remarks
    };

    this.api.recordComplaintPayment(payload).subscribe({
      next: (_res: any) => {
        this.paymentSubmitting.set(false);
        this.paymentMsg.set('Payment recorded successfully');
        this.paymentMsgErr.set(false);
        this.loadPayments(cid);
        this.initPaymentForm();
      },
      error: () => {
        this.paymentSubmitting.set(false);
        this.paymentMsg.set('Failed to record payment');
        this.paymentMsgErr.set(true);
      }
    });
  }

  submitCompletionPayment(): void {
    const wo = this.completeWo();
    if (!wo) return;

    this.paymentSubmitting.set(true);
    this.paymentMsg.set('');

    const f = this.paymentForm();
    if ((Number(f.serviceChargeAmount) || 0) < this.minimumServiceCharge()) {
      this.paymentSubmitting.set(false);
      this.paymentMsg.set(`Service charge cannot be below ₹${this.minimumServiceCharge().toFixed(2)}`);
      this.paymentMsgErr.set(true);
      return;
    }

    const amountPaid = f.paymentType === 'Final' ? this.payableNow : Number(f.amountPaid) || 0;
    if (amountPaid <= 0) {
      this.paymentSubmitting.set(false);
      this.paymentMsg.set('Amount paid must be greater than zero');
      this.paymentMsgErr.set(true);
      return;
    }

    const payload = {
      complaintId: wo.complaintId,
      paymentType: f.paymentType,
      serviceChargeAmount: f.serviceChargeAmount,
      sparePartsAmount: f.sparePartsAmount,
      discountAmount: f.discountAmount,
      totalAmount: this.netTotal,
      amountPaid,
      paymentMethod: f.paymentMethod,
      upiIdUsed: f.paymentMethod === 'UPI' ? this.defaultUpiId() : null,
      transactionReference: f.transactionReference,
      remarks: f.remarks
    };

    this.api.recordComplaintPayment(payload).subscribe({
      next: (_res: any) => {
        this.paymentSubmitting.set(false);
        this.paymentMsg.set('');
        this.completePaymentStep.set(false);
      },
      error: () => {
        this.paymentSubmitting.set(false);
        this.paymentMsg.set('Failed to record payment');
        this.paymentMsgErr.set(true);
      }
    });
  }

  // ── Spare parts ───────────────────────────────────────
  loadComplaintSpares(complaintId: number): void {
    this.sparesLoading.set(true);
    this.complaintSpares.set([]);
    this.api.getSpareByComplaint(complaintId).subscribe({
      next: (r: any) => {
        const spares = r?.data ?? (Array.isArray(r) ? r : []);
        this.complaintSpares.set(spares);
        this.sparesLoading.set(false);
      },
      error: () => this.sparesLoading.set(false)
    });
  }

  getSpareStatusClass(s: string): string {
    return ({
      requested: 's-requested', approved: 's-approved',
      dispatched: 's-dispatched', used: 's-used', rejected: 's-rejected'
    } as any)[s?.toLowerCase()] || 's-requested';
  }

  private isActiveAssignmentStatus(status?: string | null): boolean {
    const normalized = (status || '').toLowerCase();
    return !['removed', 'cancelled', 'canceled', 'unassigned', 'unassign'].includes(normalized);
  }

  getUrgencyClass(u: string): string {
    return ({
      normal: 'u-normal', urgent: 'u-urgent', critical: 'u-critical'
    } as any)[u?.toLowerCase()] || 'u-normal';
  }

  markSpareAsUsed(requestId: number): void {
    if (!confirm('Are you sure you want to mark this part as used?')) return;
    this.api.updateSpareStatus(requestId, 'Used').subscribe({
      next: (res) => {
        if (res.success) {
          this.show('Part marked as used', false);
          this.loadComplaintSpares(this.detailData().complaintId);
        } else {
          this.show(res.message || 'Failed to update status', true);
        }
      },
      error: () => this.show('Error updating status', true)
    });
  }

  markRepairDelivered(repairRequestId: number): void {
    if (!confirm('Confirm that this part has been delivered back to site?')) return;
    this.api.updateRepairStatus(repairRequestId, 'Delivered').subscribe({
      next: (res) => {
        if (res.success) {
          this.show('Marked as Delivered', false);
          this.refreshRepairDetails();
        } else {
          this.show(res.message || 'Failed to update status', true);
        }
      },
      error: () => this.show('Error updating status', true)
    });
  }

  markRepairResolved(repairRequestId: number): void {
    if (!confirm('Mark this repair as fully resolved?')) return;
    this.api.updateRepairStatus(repairRequestId, 'Resolved').subscribe({
      next: (res) => {
        if (res.success) {
          this.show('Repair marked as Resolved', false);
          this.refreshRepairDetails();
        } else {
          this.show(res.message || 'Failed to update status', true);
        }
      },
      error: () => this.show('Error updating status', true)
    });
  }

  private refreshRepairDetails(): void {
    const d = this.detailData();
    if (!d?.assignmentId) return;
    this.api.getWorkOrderDetails(d.assignmentId).subscribe({
      next: (res: any) => {
        this.detailData.set(Array.isArray(res) ? res[0] : (res?.data ?? res));
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────
  getAuditIcon(action: string): string {
    const map: Record<string, string> = {
      Created: 'person_add', Modified: 'edit',
      Removed: 'person_remove', Completed: 'check_circle',
      InProgress: 'build'
    };
    return map[action] || 'history';
  }

  private show(m: string, err: boolean): void {
    this.msg.set(m);
    this.msgErr.set(err);
    if (!err) setTimeout(() => this.msg.set(''), 3000);
  }








  // ── Spare Request Dialog ────────────────────────────────
showSpareDialog    = signal(false);
spareDialogWo      = signal<WorkOrder | null>(null);
spareSearch        = '';
spareResults       = signal<any[]>([]);
showSpareDropdown  = false;
spareSearchLoading = signal(false);
// spareCart          = signal<{ part: any; quantity: number; urgencyLevel: string; remarks: string }[]>([]);
// spareCartTotal     = computed(() => this.spareCart().reduce((s, i) => s + i.quantity, 0));
// spareSubmitting    = signal(false);
// spareMsg           = signal('');
// spareMsgErr        = signal(false);
// urgencyOptions     = ['Normal', 'Urgent', 'Critical'];

private spareSubject = new Subject<string>();

// Add to ngOnInit (inside the method, after existing code):

removeSpareFromCart(index: number): void {
  const item = this.spareCart()[index];
  if (item?.customPartPhoto) URL.revokeObjectURL(item.customPartPhoto.preview);
  this.spareCart.update(list => list.filter((_, i) => i !== index));
}
getAdvanceQrUrl(amount: number | null): string {
  if (!amount || amount <= 0 || !this.defaultUpiId()) return '';
  const str = `upi://pay?pa=${this.defaultUpiId()}&pn=Encryptz&am=${Number(amount).toFixed(2)}&cu=INR`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(str)}`;
}

private loadDefaultUpiId(): void {
  if (this.defaultUpiId()) return;
  this.api.getUPIConfigurations().subscribe({
    next: (res: any) => {
      const d = (res.data || []).find((u: any) => u.isDefault && u.isActive);
      if (d) this.defaultUpiId.set(d.upiId);
    }
  });
}

// ── Open spare dialog from work order ───────────────────
openSpareDialog(wo: WorkOrder, event?: Event): void {
  event?.stopPropagation();
  this.spareDialogWo.set(wo);
  this.clearAllCustomPhotos();
  this.spareCart.set([]);
  this.spareSearch = '';
  this.spareResults.set([]);
  this.spareMsg.set('');
  this.spareMsgErr.set(false);
  this.showSpareDropdown = false;
  this.spareAdvanceMethod.set('Cash');
  this.showSpareDialog.set(true);
  this.loadSpareOptions();
  this.loadDefaultUpiId();
}

closeSpareDialog(): void {
  this.clearAllCustomPhotos();
  this.showSpareDialog.set(false);
  this.spareDialogWo.set(null);
  this.spareCart.set([]);
  this.spareSearch = '';
  this.spareResults.set([]);
  this.showSpareDropdown = false;
  this.spareAdvanceAmount.set(null);
  this.spareAdvanceMethod.set('Cash');
}

onSpareSearch(): void {
  this.showSpareDropdown = true;
  if (this.spareSearch.trim()) this.spareSubject.next(this.spareSearch);
  else this.loadSpareOptions();
}

@HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.sp-search-wrap') && !target.closest('.sp-dropdown')) {
    this.showSpareDropdown = false;
  }
}

addSpareToCart(part: any): void {
  const exists = this.spareCart().some(
    i => !i.isCustom && i.part?.sparePartId === part.sparePartId
  );

  if (exists) return;

  this.spareCart.update(list => [
    ...list,
    {
      part,
      isCustom: false,
      quantity: 1,
      urgencyLevel: 'Normal',
      remarks: ''
    }
  ]);
  this.spareSearch = '';
  this.showSpareDropdown = false;
}
addCustomPart(): void {
  this.spareCart.update(list => [
    ...list,
    {
      isCustom: true,
      customPartName: '',
      customPartNumber: '',
      customPartPhoto: null,
      quantity: 1,
      urgencyLevel: 'Normal',
      remarks: ''
    }
  ]);
  this.spareMsg.set('');
  this.spareMsgErr.set(false);
}


updateSpareUrgency(index: number, urgency: string): void {
  this.spareCart.update(list => {
    const updated = [...list];
    updated[index].urgencyLevel = urgency;
    return updated;
  });
}

updateSpareRemarks(index: number, remarks: string): void {
  this.spareCart.update(list => {
    const updated = [...list];
    updated[index].remarks = remarks;
    return updated;
  });
}
isSpareInCart(part: any): boolean {
  return this.spareCart().some(
    i => !i.isCustom && i.part?.sparePartId === part.sparePartId
  );
}
updateSpareQty(index: number, qty: number): void {
  const parsedQty = Number(qty);
  if (!Number.isFinite(parsedQty) || parsedQty < 1) return;

  this.spareCart.update(list => {
    const updated = [...list];
    const item = updated[index];
    if (!item) return list;

    const maxQty = item.isCustom
      ? parsedQty
      : Math.max(1, Number(item.part?.stockQuantity ?? 1));

    item.quantity = Math.min(parsedQty, maxQty);
    return updated;
  });
}
getSpareItemMaxQty(item: SpareCartItem): number {
  return item.isCustom ? 999 : Math.max(1, Number(item.part?.stockQuantity ?? 1));
}
getSpareSubmitLabel(): string {
  const count = this.spareCartCount();
  return count === 1 ? 'Submit 1 Request' : `Submit ${count} Requests`;
}
private loadSpareOptions(searchTerm: string = ''): void {
  this.spareSearchLoading.set(true);
  this.api.searchSpareParts(searchTerm).subscribe({
    next: (d: any) => {
      this.spareResults.set(Array.isArray(d) ? d : (d?.data ?? []));
      this.spareSearchLoading.set(false);
    },
    error: () => {
      this.spareResults.set([]);
      this.spareSearchLoading.set(false);
    }
  });
}
submitSpareRequest(): void {
  const wo = this.spareDialogWo();

  if (!wo) return;
  if (this.spareCart().length === 0) {
    this.spareMsg.set('Add at least one part to continue');
    this.spareMsgErr.set(true);
    return;
  }

  for (const item of this.spareCart()) {
    if (item.isCustom && !item.customPartName?.trim()) {
      this.spareMsg.set('Custom part name is required');
      this.spareMsgErr.set(true);
      return;
    }
  }

  const payload = this.spareCart().map(item => ({
    complaintId: wo.complaintId,
    technicianId: this.techId,
    sparePartId: item.isCustom ? null : item.part?.sparePartId,
    quantity: item.quantity,
    urgencyLevel: item.urgencyLevel,
    remarks: item.remarks,
    customPartName: item.isCustom ? item.customPartName?.trim() || null : null,
    customPartNumber: item.isCustom ? item.customPartNumber?.trim() || null : null
  }));

  this.spareSubmitting.set(true);
  this.spareMsg.set('');
  this.spareMsgErr.set(false);

  this.api.createSpareRequest(payload).subscribe({
    next: (response: any) => {
      const customPhotos = this.spareCart()
        .filter(item => item.isCustom && item.customPartPhoto)
        .map(item => item.customPartPhoto!);

      const advance = Number(this.spareAdvanceAmount()) || 0;
      if (advance > 0) {
        this.api.recordComplaintPayment({
          complaintId: wo.complaintId,
          paymentType: 'Advance',
          serviceChargeAmount: 0, sparePartsAmount: 0, discountAmount: 0,
          totalAmount: advance, amountPaid: advance,
          paymentMethod: this.spareAdvanceMethod(),
          upiIdUsed: this.spareAdvanceMethod() === 'UPI' ? this.defaultUpiId() : null,
          remarks: 'Advance collected at spare parts request'
        }).subscribe();
      }

      const finish = () => {
        this.spareSubmitting.set(false);
        this.spareMsg.set(response?.message || 'Request submitted successfully');
        this.spareMsgErr.set(false);
        this.spareCart.set([]);
        this.closeSpareDialog();
      };

      if (customPhotos.length === 0) { finish(); return; }

      const uploadNext = (idx: number) => {
        if (idx >= customPhotos.length) { finish(); return; }
        const fd = new FormData();
        fd.append('file', customPhotos[idx].file);
        fd.append('imageType', 'SpareRequest');
        fd.append('complaintId', wo.complaintId.toString());
        fd.append('assignmentId', wo.assignmentId.toString());
        this.api.uploadServiceImage(this.techId, fd).subscribe({
          next: () => uploadNext(idx + 1),
          error: () => uploadNext(idx + 1)
        });
      };
      uploadNext(0);
    },
    error: () => {
      this.spareSubmitting.set(false);
      this.spareMsg.set('Failed to submit request');
      this.spareMsgErr.set(true);
    }
  });
}

openRepairDialog(wo: WorkOrder, event?: Event): void {
  event?.stopPropagation();
  this.repairDialogWo.set(wo);
  this.showRepairDialog.set(true);
  this.repairLoading.set(true);
  this.repairSubmitting.set(false);
  this.repairMsg.set('');
  this.repairMsgErr.set(false);
  this.repairMeta.set(null);
  this.repairAdvanceMethod.set('Cash');
  this.loadDefaultUpiId();
  this.repairUploadProgress.set(0);
  this.repairUploadStep.set(0);
  this.repairUploadTotal.set(0);
  this.repairImages().forEach(item => URL.revokeObjectURL(item.preview));
  this.repairImages.set([]);
  this.repairForm = {
    partName: '',
    partSerialNumber: '',
    customerCode: '',
    notes: ''
  };

  this.api.getCompleteComplaintDetails(wo.complaintId).subscribe({
    next: (response: any) => {
      const detail = response?.data ?? response;
      const customerId = (detail?.[1]?.[0] as any)?.CustomerId;
      this.repairMeta.set(detail);
      this.repairForm = {
        partName: wo.productName || '',
        partSerialNumber: detail[2]?.[0]?.serialNumber || '',
        customerCode: customerId ? `CUST-${String(customerId).padStart(4, '0')}` : (wo.complaintNumber || ''),
        notes: ''
      };
      this.repairLoading.set(false);
    },
    error: () => {
      this.repairLoading.set(false);
      this.repairMsg.set('Unable to load complaint details for repair request');
      this.repairMsgErr.set(true);
    }
  });
}

closeRepairDialog(): void {
  this.showRepairDialog.set(false);
  this.repairDialogWo.set(null);
  this.repairMeta.set(null);
  this.repairImages().forEach(item => URL.revokeObjectURL(item.preview));
  this.repairImages.set([]);
  this.repairMsg.set('');
  this.repairMsgErr.set(false);
  this.repairUploadProgress.set(0);
  this.repairUploadStep.set(0);
  this.repairUploadTotal.set(0);
  this.repairAdvanceAmount.set(null);
  this.repairAdvanceMethod.set('Cash');
}

onRepairFilesSelected(event: Event, tag: string): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  this.addRepairFiles(Array.from(input.files), tag);
  input.value = '';
}

private async addRepairFiles(files: File[], tag: string): Promise<void> {
  const filtered = files.filter(file => file.type.startsWith('image/'));
  const limit = tag === 'before' ? 1 : 3;
  const existing = this.getRepairImages(tag);
  const toAdd = tag === 'before'
    ? filtered.slice(0, 1)
    : filtered.slice(0, Math.max(0, limit - existing.length));

  if (toAdd.length === 0) {
    this.repairMsg.set(tag === 'before'
      ? 'Only 1 part image can be uploaded'
      : 'Maximum 3 tagged images can be uploaded');
    this.repairMsgErr.set(true);
    return;
  }

  const compressed = await Promise.all(toAdd.map(f => this.compressImage(f)));
  const items = compressed.map(file => ({ file, preview: URL.createObjectURL(file), tag }));

  this.repairMsg.set('');
  this.repairMsgErr.set(false);

  this.repairImages.update(list => {
    if (tag === 'before') {
      list.filter(item => item.tag === 'before').forEach(item => URL.revokeObjectURL(item.preview));
      return [...list.filter(item => item.tag !== 'before'), ...items];
    }
    return [...list, ...items];
  });
}

removeRepairImage(tag: string, index: number = 0): void {
  this.repairImages.update(list => {
    const matches = list.filter(item => item.tag === tag);
    const target = matches[index];
    if (target) URL.revokeObjectURL(target.preview);

    let seen = -1;
    return list.filter(item => {
      if (item.tag !== tag) return true;
      seen++;
      return seen !== index;
    });
  });
}

getRepairImages(tag: string): { file: File; preview: string; tag: string }[] {
  return this.repairImages().filter(item => item.tag === tag);
}

getNatureOfJob(source: any): string {
  const value = source?.natureOfJob ?? source?.NatureOfJob ?? '';
  return typeof value === 'string' ? value.trim() : String(value || '').trim();
}

hasDetailLocation(): boolean {
  const detail = this.detailData();
  const workOrder = this.detailWorkOrder();
  return !!(
    detail?.locationName
    || detail?.locationAddress
    || detail?.customerAddress
    || detail?.customerPlace
    || workOrder?.locationName
    || workOrder?.locationAddress
    || workOrder?.customerAddress
    || workOrder?.customerPlace
    || (detail?.latitude && detail?.longitude)
    || (workOrder?.latitude && workOrder?.longitude)
  );
}

getDetailLocationName(): string {
  const detail = this.detailData();
  const workOrder = this.detailWorkOrder();
  return detail?.locationName
    || detail?.locationAddress
    || detail?.customerAddress
    || detail?.customerPlace
    || workOrder?.locationName
    || workOrder?.locationAddress
    || workOrder?.customerAddress
    || workOrder?.customerPlace
    || 'Location not available';
}

openDetailMap(): void {
  const lat = this.detailData()?.latitude ?? this.detailWorkOrder()?.latitude;
  const lng = this.detailData()?.longitude ?? this.detailWorkOrder()?.longitude;
  const locationText = this.getDetailLocationName();
  const query = (lat && lng)
    ? `${lat},${lng}`
    : locationText;

  if (!query || query === 'Location not available') return;

  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
}

openSpareFromDetail(event?: Event): void {
  event?.stopPropagation();
  const wo = this.detailData() as WorkOrder | null;
  if (!wo) return;

  this.closeDetail();
  this.openSpareDialog(wo, event);
}

openRepairFromDetail(event?: Event): void {
  event?.stopPropagation();

  const wo = this.detailWorkOrder(); // ✅ CORRECT SOURCE
  if (!wo) return;

  this.closeDetail();
  this.openRepairDialog(wo, event);
}

openCompleteFromDetail(event?: Event): void {
  event?.stopPropagation();
  const wo = this.detailData() as WorkOrder | null;
  if (!wo) return;

  this.closeDetail();
  this.openCompleteDialog(wo, event);
}

submitRepairRequest(): void {
  const wo = this.repairDialogWo();
  const detail = this.repairMeta();

  if (!wo || !detail) return;
  if (!this.repairForm.partSerialNumber.trim()) {
    this.repairMsg.set('Part serial number is required');
    this.repairMsgErr.set(true);
    return;
  }
  if (this.getRepairImages('before').length === 0 || this.getRepairImages('tagged').length === 0) {
    this.repairMsg.set('Please upload both part and tagged images');
    this.repairMsgErr.set(true);
    return;
  }

  const customer = detail[1]?.[0] ?? {};
  const product = detail[2]?.[0] ?? {};
  if (!customer.CustomerId ) {
    this.repairMsg.set('Repair request needs customer and product details');
    this.repairMsgErr.set(true);
    return;
  }

  this.repairSubmitting.set(true);
  this.repairMsg.set('');
  this.repairMsgErr.set(false);

  const payload = {
    complaintId: wo.complaintId,
    assignmentId: wo.assignmentId,
    technicianId: this.auth.currentUser()?.userId ?? 0,
    customerId: customer.CustomerId,
    productId: product.productId,
    partName: this.repairForm.partName || wo.productName,
    partSerialNumber: this.repairForm.partSerialNumber.trim(),
    notes: this.repairForm.notes
  };

  this.api.createRepairPartRequest(payload).subscribe({
    next: (res: any) => {
      const requestId = res.data || res.requestId || res;
      const advance = Number(this.repairAdvanceAmount()) || 0;
      if (advance > 0) {
        this.api.recordComplaintPayment({
          complaintId: wo.complaintId,
          paymentType: 'Advance',
          serviceChargeAmount: 0, sparePartsAmount: 0, discountAmount: 0,
          totalAmount: advance, amountPaid: advance,
          paymentMethod: this.repairAdvanceMethod(),
          upiIdUsed: this.repairAdvanceMethod() === 'UPI' ? this.defaultUpiId() : null,
          remarks: 'Advance collected at repair request'
        }).subscribe();
      }
      this.uploadRepairImagesSequentially(0, requestId);
    },
    error: () => {
      this.repairSubmitting.set(false);
      this.repairMsg.set('Failed to create repair request');
      this.repairMsgErr.set(true);
    }
  });
}

private uploadRepairImagesSequentially(index: number, requestId: any): void {
  const images = this.repairImages();
  const rId = typeof requestId === 'object' ? requestId.data : requestId;

  if (index === 0) {
    this.repairUploadTotal.set(images.length);
    this.repairUploadStep.set(0);
    this.repairUploadProgress.set(0);
  }

  if (index >= images.length) {
    this.repairUploadProgress.set(100);
    this.repairSubmitting.set(false);
    this.repairMsg.set('Repair request submitted successfully');
    this.repairMsgErr.set(false);
    this.load();
    setTimeout(() => this.closeRepairDialog(), 900);
    return;
  }

  const item = images[index];
  this.compressImage(item.file, 1).then(compressed => {
    this.api.uploadRepairImage(rId, compressed, item.tag === 'tagged' ? 'TaggedRepair' : 'BeforeRepair')
      .subscribe({
        next: () => {
          this.repairUploadStep.set(index + 1);
          this.repairUploadProgress.set(Math.round(((index + 1) / images.length) * 100));
          this.uploadRepairImagesSequentially(index + 1, rId);
        },
        error: () => {
          this.repairSubmitting.set(false);
          this.repairMsg.set('Repair request saved, but image upload failed');
          this.repairMsgErr.set(true);
        }
      });
  });
}








// ── Completion Dialog ───────────────────────────────────
showCompleteDialog     = signal(false);
completeWo             = signal<WorkOrder | null>(null);
completeBusy           = signal(false);
completeMsg            = signal('');
completeMsgErr         = signal(false);
completePaymentStep    = signal(false);
completePaymentLoading = signal(false);
completePayments       = signal<any[]>([]);

get completeBalanceDue(): number {
  const payments = this.completePayments();
  const finalP = payments.find(p => String(p.paymentType ?? '').toLowerCase() === 'final');
  if (finalP) return 0;
  const totalBilled = payments.reduce((s: number, p: any) =>
    String(p.paymentType ?? '').toLowerCase() === 'final' ? s + (Number(p.totalAmount) || 0) : s, 0);
  const totalPaid   = payments.reduce((s: number, p: any) => s + (Number(p.amountPaid) || 0), 0);
  return Math.max(0, totalBilled - totalPaid);
}

completeForm = {
  remarks: '',
  workDone: '',
  partsUsed: '',
  customerFeedback: '',
};

// ── Image Upload ────────────────────────────────────────
uploadQueue    = signal<{ file: File; preview: string; type: string; status: string; error?: string }[]>([]);
uploadProgress = signal(0);
imageTypes     = ['Before', 'After', 'Part', 'Signature', 'Other'];

// ── Open complete dialog ────────────────────────────────
openCompleteDialog(wo: WorkOrder, event?: Event): void {
  event?.stopPropagation();
  this.completeWo.set(wo);
  this.completeForm = { remarks: '', workDone: '', partsUsed: '', customerFeedback: '' };
  this.uploadQueue.set([]);
  this.completeMsg.set('');
  this.uploadProgress.set(0);
  this.completePaymentStep.set(false);
  this.completePayments.set([]);
  this.showCompleteDialog.set(true);
  this.completePaymentLoading.set(true);
  this.api.getComplaintPayments(wo.complaintId).subscribe({
    next: (res: any) => {
      const raw: any[] = Array.isArray(res) ? res
        : Array.isArray(res?.data)  ? res.data
        : Array.isArray(res?.items) ? res.items
        : [];
      this.completePayments.set(raw);
      this.paymentsList.set(raw);
      const hasFinal = raw.some(p => String(p.paymentType ?? '').toLowerCase() === 'final');
      if (!hasFinal) {
        this.completePaymentStep.set(true);
        this.initPaymentForm();
      }
      this.completePaymentLoading.set(false);
    },
    error: () => this.completePaymentLoading.set(false)
  });
}

closeCompleteDialog(): void {
  this.showCompleteDialog.set(false);
  this.completeWo.set(null);
  this.completePaymentStep.set(false);
  this.completePayments.set([]);
  this.uploadQueue().forEach(q => URL.revokeObjectURL(q.preview));
  this.uploadQueue.set([]);
}

// ── File handling ───────────────────────────────────────
onFilesSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  this.addFiles(Array.from(input.files));
  input.value = ''; // reset for re-select
}

onDrop(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer?.files.length) {
    this.addFiles(Array.from(event.dataTransfer.files));
  }
}

onDragOver(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

private async addFiles(files: File[]): Promise<void> {
  const valid = files.filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024);
  const compressed = await Promise.all(valid.map(f => this.compressImage(f)));
  const items = compressed.map(f => ({
    file: f,
    preview: URL.createObjectURL(f),
    type: 'After',
    status: 'pending'
  }));
  this.uploadQueue.update(q => [...q, ...items]);
}

removeFromQueue(index: number): void {
  this.uploadQueue.update(q => {
    const item = q[index];
    if (item) URL.revokeObjectURL(item.preview);
    return q.filter((_, i) => i !== index);
  });
}

updateImageType(index: number, type: string): void {
  this.uploadQueue.update(q => {
    const c = [...q]; c[index] = { ...c[index], type }; return c;
  });
}

formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Submit completion ───────────────────────────────────
submitCompletion(): void {
  const wo = this.completeWo();
  if (!wo) return;

  if (!this.completeForm.workDone.trim()) {
    this.completeMsg.set('Please describe the work done');
    this.completeMsgErr.set(true);
    return;
  }

  this.completeBusy.set(true);
  this.completeMsg.set('');
  this.uploadProgress.set(0);

  const queue = this.uploadQueue();
  const totalSteps = queue.length + 1; // images + status update
  let step = 0;

  const updateProgress = () => {
    step++;
    this.uploadProgress.set(Math.round((step / totalSteps) * 100));
  };

  // Step 1: Upload images sequentially
  const uploadNext = (idx: number) => {
    if (idx >= queue.length) {
      // All images uploaded → complete the work order
      this.finalizeCompletion(wo, updateProgress);
      return;
    }

    const item = queue[idx];
    this.uploadQueue.update(q => {
      const c = [...q]; c[idx] = { ...c[idx], status: 'uploading' }; return c;
    });

    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('imageType', item.type);
    formData.append('complaintId', wo.complaintId.toString());
    formData.append('assignmentId', wo.assignmentId.toString());

    this.api.uploadServiceImage(this.techId, formData).subscribe({
      next: (r: any) => {
        this.uploadQueue.update(q => {
          const c = [...q]; c[idx] = { ...c[idx], status: r?.success !== false ? 'done' : 'error', error: r?.message }; return c;
        });
        updateProgress();
        uploadNext(idx + 1);
      },
      error: (err) => {
        this.uploadQueue.update(q => {
          const c = [...q]; c[idx] = { ...c[idx], status: 'error', error: 'Upload failed' }; return c;
        });
        updateProgress();
        uploadNext(idx + 1); // continue with next
      }
    });
  };

  if (queue.length > 0) {
    uploadNext(0);
  } else {
    this.finalizeCompletion(wo, updateProgress);
  }
}

private finalizeCompletion(wo: WorkOrder, updateProgress: () => void): void {
  this.api.updateServiceStatus({
    AssignmentId: wo.assignmentId,
    Status: 'Completed',
    remarks: this.completeForm.remarks,
    WorkDone: this.completeForm.workDone,
    PartsUsed: this.completeForm.partsUsed,
    CustomerFeedback: this.completeForm.customerFeedback
  }).subscribe({
    next: (r: any) => {
      updateProgress();
      this.completeBusy.set(false);
      if (r.success) {
        this.completeMsg.set('Work order completed successfully!');
        this.completeMsgErr.set(false);
        this.uploadProgress.set(100);
        setTimeout(() => {
          this.closeCompleteDialog();
          this.load();
        }, 1500);
      } else {
        this.completeMsg.set(r.message || 'Failed to complete');
        this.completeMsgErr.set(true);
      }
    },
    error: () => {
      this.completeBusy.set(false);
      this.completeMsg.set('Failed to complete work order');
      this.completeMsgErr.set(true);
    }
  });
}
viewRepairImages(repairRequest: any): void {
  this.activeRepairRequest.set(repairRequest);
  this.showRepairImagesModal.set(true);
  this.repairImagesLoading.set(true);
  this.repairImagesList.set([]);

  this.api.getRepairImagesByRequest(repairRequest.repairRequestId).subscribe({
    next: (res: any) => {
      const list = res.data || res || [];
      this.repairImagesList.set(list.map((img: any) => ({ ...img, base64: null, loading: false })));
      this.repairImagesLoading.set(false);
    },
    error: () => {
      this.repairImagesLoading.set(false);
    }
  });
}

fetchImageBase64(image: any): void {
  if (image.base64 || image.loading) return;

  image.loading = true;
  this.api.getRepairImageBase64(image.imageId).subscribe({
    next: (res: any) => {
      image.base64 = res.data || res;
      image.loading = false;
    },
    error: () => {
      image.loading = false;
    }
  });
}

closeRepairImagesModal(): void {
  this.showRepairImagesModal.set(false);
  this.repairImagesList.set([]);
  this.activeRepairRequest.set(null);
}

// ── Per-custom-item photo handlers ─────────────────────
private clearAllCustomPhotos(): void {
  this.spareCart().forEach(item => {
    if (item.customPartPhoto) URL.revokeObjectURL(item.customPartPhoto.preview);
  });
}

onCustomPartPhotoSelected(index: number, event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  this.compressImage(file).then(compressed => {
    this.spareCart.update(list => {
      const updated = [...list];
      const item = updated[index];
      if (item?.customPartPhoto) URL.revokeObjectURL(item.customPartPhoto.preview);
      updated[index] = { ...item, customPartPhoto: { file: compressed, preview: URL.createObjectURL(compressed) } };
      return updated;
    });
  });
  input.value = '';
}

clearCustomPartPhoto(index: number): void {
  this.spareCart.update(list => {
    const updated = [...list];
    const item = updated[index];
    if (item?.customPartPhoto) URL.revokeObjectURL(item.customPartPhoto.preview);
    updated[index] = { ...item, customPartPhoto: null };
    return updated;
  });
}

// ── Image compression ───────────────────────────────────
private compressImage(file: File, maxSizeMB = 1): Promise<File> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1280;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        const name = file.name.replace(/\.[^.]+$/, '.jpg');
        const compressed = blob ? new File([blob], name, { type: 'image/jpeg' }) : file;
        // if still over limit, compress again at lower quality
        if (compressed.size > maxSizeMB * 1024 * 1024) {
          canvas.toBlob(blob2 => {
            resolve(blob2 ? new File([blob2], name, { type: 'image/jpeg' }) : compressed);
          }, 'image/jpeg', 0.6);
        } else {
          resolve(compressed);
        }
      }, 'image/jpeg', 0.75);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

}
// ── Add to api-service.ts if not already present ─────────
// getSpareByComplaint(complaintId: number): Observable<any> {
//   return this.http.get(`${this.baseUrl}/spare-parts/by-complaint/${complaintId}`);
// }
