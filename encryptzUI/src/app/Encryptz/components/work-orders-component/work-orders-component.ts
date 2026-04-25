import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
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
export class WorkOrdersComponent implements OnInit {
  private api         = inject(ApiService);
  private auth        = inject(AuthService);
  private _destroyRef = inject(DestroyRef);
  private techSearchSubject = new Subject<string>();

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
repairForm = {
  partName: '',
  partSerialNumber: '',
  customerCode: '',
  notes: ''
};

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
  detailLoading = signal(false);

  // ── Spare parts ───────────────────────────────────────
  complaintSpares = signal<any[]>([]);
  sparesLoading   = signal(false);

  // ── Computed ──────────────────────────────────────────
  filteredOrders = computed(() => {
    const f = this.activeFilter();
    if (f === 'all') return this.orders();
    return this.orders().filter(o => o.status === f);
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
    this.techId = this.auth.technicianId();
    this.load();
    this.loadCheckInStatus();  // ← ADD
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
}

// ── Check Out ───────────────────────────────────────────
checkOut(): void {
  if (!this.techId) return;
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
        const list: WorkOrder[] = Array.isArray(res) ? res : (res?.data ?? []);
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
          this.show(`Status updated to ${status}`, false);
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
          this.show('Technician unassigned successfully', false);
          this.closeUnassign();
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

  // ── Detail popup ──────────────────────────────────────
  openDetail(wo: WorkOrder, event?: Event): void {
    event?.stopPropagation();
    this.showDetail.set(true);
    this.detailData.set(null);
    this.detailLoading.set(true);
    // load detail + spares in parallel
    this.api.getWorkOrderDetails(wo.assignmentId).subscribe({
      next: (res: any) => {
        this.detailData.set(Array.isArray(res) ? res[0] : (res?.data ?? res));
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false)
    });
    this.loadComplaintSpares(wo.complaintId);
  }

  closeDetail(): void {
    this.showDetail.set(false);
    this.detailData.set(null);
    this.complaintSpares.set([]);
  }

  // ── Spare parts ───────────────────────────────────────
  loadComplaintSpares(complaintId: number): void {
    this.sparesLoading.set(true);
    this.complaintSpares.set([]);
    this.api.getSpareByComplaint(complaintId).subscribe({
      next: (r: any) => {
        this.complaintSpares.set(r?.data ?? (Array.isArray(r) ? r : []));
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

  getUrgencyClass(u: string): string {
    return ({
      normal: 'u-normal', urgent: 'u-urgent', critical: 'u-critical'
    } as any)[u?.toLowerCase()] || 'u-normal';
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
  this.spareCart.update(list => list.filter((_, i) => i !== index));
}
// ── Open spare dialog from work order ───────────────────
openSpareDialog(wo: WorkOrder, event?: Event): void {
  event?.stopPropagation();
  this.spareDialogWo.set(wo);
  this.spareCart.set([]);
  this.spareSearch = '';
  this.spareResults.set([]);
  this.spareMsg.set('');
  this.spareMsgErr.set(false);
  this.showSpareDropdown = false;
  this.showSpareDialog.set(true);
  this.loadSpareOptions();
}

closeSpareDialog(): void {
  this.showSpareDialog.set(false);
  this.spareDialogWo.set(null);
  this.spareCart.set([]);
  this.spareSearch = '';
  this.spareResults.set([]);
  this.showSpareDropdown = false;
}

onSpareSearch(): void {
  this.showSpareDropdown = true;
  if (this.spareSearch.trim()) this.spareSubject.next(this.spareSearch);
  else this.loadSpareOptions();
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
      this.spareSubmitting.set(false);
      this.spareMsg.set(response?.message || 'Request submitted successfully');
      this.spareMsgErr.set(false);

      // reset
      this.spareCart.set([]);
      this.closeSpareDialog();
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
}

onRepairFilesSelected(event: Event, tag: string): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  this.addRepairFiles(Array.from(input.files), tag);
  input.value = '';
}

private addRepairFiles(files: File[], tag: string): void {
  const valid = files
    .filter(file => file.type.startsWith('image/'))
    .slice(0, 3);

  const items = valid.map(file => ({
    file,
    preview: URL.createObjectURL(file),
    tag
  }));

  this.repairImages.update(list => [...list.filter(item => item.tag !== tag), ...items]);
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
  const warrantyEnd = product.warrantyExpiryDate ? new Date(product.warrantyExpiryDate) : new Date();
  const purchaseDate = product.purchaseDate ? new Date(product.purchaseDate) : new Date();

  this.repairSubmitting.set(true);
  this.repairMsg.set('');
  this.repairMsgErr.set(false);

  this.api.createWarranty({
    complaintId: wo.complaintId,
    customerId: customer.CustomerId,
    productId: product.productId,
    productSerialNo: this.repairForm.partSerialNumber.trim(),
    warrantyStartDate: purchaseDate.toISOString(),
    warrantyEndDate: warrantyEnd.toISOString(),
    returnReason: `${this.repairForm.partName || wo.productName} - ${this.repairForm.notes || 'Repair request raised from work order'}`,
    returnType: 1,
    pickupAddress: customer.address || customer.customerAddress || detail.locationName || wo.customerAddress || ''
  }).subscribe({
    next: () => this.uploadRepairImagesSequentially(0),
    error: () => {
      this.repairSubmitting.set(false);
      this.repairMsg.set('Failed to create repair request');
      this.repairMsgErr.set(true);
    }
  });
}

private uploadRepairImagesSequentially(index: number): void {
  const wo = this.repairDialogWo();
  const images = this.repairImages();

  if (!wo) return;
  if (index >= images.length) {
    this.repairSubmitting.set(false);
    this.repairMsg.set('Repair request submitted successfully');
    this.repairMsgErr.set(false);
    this.load();
    setTimeout(() => this.closeRepairDialog(), 900);
    return;
  }

  const item = images[index];
  const formData = new FormData();
  formData.append('file', item.file);
  formData.append('imageType', item.tag === 'tagged' ? 'TaggedRepair' : 'BeforeRepair');
  formData.append('complaintId', wo.complaintId.toString());
  formData.append('assignmentId', wo.assignmentId.toString());

  this.api.uploadServiceImage(this.techId, formData).subscribe({
    next: () => this.uploadRepairImagesSequentially(index + 1),
    error: () => {
      this.repairSubmitting.set(false);
      this.repairMsg.set('Repair request saved, but image upload failed');
      this.repairMsgErr.set(true);
    }
  });
}








// ── Completion Dialog ───────────────────────────────────
showCompleteDialog = signal(false);
completeWo         = signal<WorkOrder | null>(null);
completeBusy       = signal(false);
completeMsg        = signal('');
completeMsgErr     = signal(false);

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
  this.showCompleteDialog.set(true);
}

closeCompleteDialog(): void {
  this.showCompleteDialog.set(false);
  this.completeWo.set(null);
  // Revoke preview URLs
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

private addFiles(files: File[]): void {
  const valid = files.filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024); // max 10MB
  const items = valid.map(f => ({
    file: f,
    preview: URL.createObjectURL(f),
    type: 'After', // default type
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
}
// ── Add to api-service.ts if not already present ─────────
// getSpareByComplaint(complaintId: number): Observable<any> {
//   return this.http.get(`${this.baseUrl}/spare-parts/by-complaint/${complaintId}`);
// }
