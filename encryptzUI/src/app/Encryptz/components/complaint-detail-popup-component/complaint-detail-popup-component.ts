// complaint-detail-popup.component.ts  (v5)
// Changes vs v4:
//   • Removed "Request New Spare" button + form (spare tab is list-only now)
//   • Customer tab: "View Full Profile" button emits customerRequested event
//     so the parent dashboard can route to the customer details screen
//   • Product tab: same form fields in BOTH modes (linked / not linked).
//     When no product is linked and user fills ProductName, save creates
//     a new Products row and maps Complaints.ProductId to it.
//   • Kept: DBNull sanitizer, Leaflet maps, Mark Complete flow, event
//     delegation for assign/reassign/unassign.

import { CommonModule } from '@angular/common';
import {
  AfterViewChecked, Component, computed, ElementRef, EventEmitter,
  inject, Input, OnDestroy, OnInit, Output, signal, ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';
import { AuthService } from '../../Auth/auth-service';

declare var L: any;

@Component({
  selector: 'app-complaint-detail-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './complaint-detail-popup-component.html',
  styleUrls: ['./complaint-detail-popup-component.scss']
})
export class ComplaintDetailPopupComponent implements OnInit, AfterViewChecked, OnDestroy {
  @Input() complaintId!: number;

  @Output() closed             = new EventEmitter<void>();
  @Output() refreshed          = new EventEmitter<void>();
  @Output() assignRequested    = new EventEmitter<any>();
  @Output() reassignRequested  = new EventEmitter<any>();
  @Output() unassignRequested  = new EventEmitter<any>();
  @Output() customerRequested  = new EventEmitter<number>();   // NEW

  @ViewChild('customerMap') customerMapRef?: ElementRef<HTMLDivElement>;
  @ViewChild('locationMap') locationMapRef?: ElementRef<HTMLDivElement>;

  private api = inject(ApiService);

  // ── state ────────────────────────────────────────────
  loading        = signal(true);
  saving         = signal(false);
  savingSpare    = signal(false);
  savingComment  = signal(false);
  savingComplete = signal(false);
activeTab = signal<'overview'|'customer'|'product'|'location'|'assignments'|'spare'|'comments'|'images'>('overview');

  complaintData = signal<any>(null);
  customerData  = signal<any>(null);
  productData   = signal<any>(null);
  assignments   = signal<any[]>([]);
  spareParts    = signal<any[]>([]);
  comments      = signal<any[]>([]);
  complaintImages = signal<any[]>([]);
lightboxImage   = signal<any>(null);

  editing = { complaint: false, customer: false, product: false, location: false };
  editData: any = { complaint: {}, customer: {}, product: {}, location: {} };

  hasProduct = computed(() => {
    const p = this.productData();
    return !!(p && (p.HasProductRecord === true || p.HasProductRecord === 1 || p.ProductId));
  });

  // ── spare inline edit (EDIT existing only — no Add)
  editingSpareId: number | null = null;
  editSpare: any = {};

  // ── mark complete
  completingAssignmentId: number | null = null;
  completeForm: any = { WorkDone: '', PartsUsed: '', CompletionRemarks: '' };

  // ── comments
  newComment = '';
  isInternalComment = false;

  // ── toast
  toastMessage = signal('');
  toastType    = signal<'success'|'error'>('success');
  showToast    = signal(false);
  @Input() viewOnly = false;

  // ── map state (Leaflet)
  private customerMap: any = null;
  private customerMarker: any = null;
  private locationMap: any = null;
  private locationMarker: any = null;
  customerSearchResults: any[] = [];
  locationSearchResults: any[] = [];
  private searchTimeout: any = null;
  isSearching = false;
  private readonly DEFAULT_LAT = 9.9312;
  private readonly DEFAULT_LNG = 76.2673;

  ngOnInit() { this.loadAllData(); }

  ngAfterViewChecked() {
    if (this.editing.customer && this.customerMapRef?.nativeElement && !this.customerMap) {
      setTimeout(() => this.initCustomerMap(), 50);
    }
    if (this.editing.location && this.locationMapRef?.nativeElement && !this.locationMap) {
      setTimeout(() => this.initLocationMap(), 50);
    }
  }

  ngOnDestroy() { this.destroyMaps(); }

  // ───────────────────────── LOAD ─────────────────────────
  loadAllData() {
    this.loading.set(true);
    this.api.getCompleteComplaintDetails(this.complaintId).subscribe({
      next: (response: any) => {
        const d = response?.data ?? [];
        this.comments.set(Array.isArray(d[5]) ? d[5].map((x: any) => this._sanitize(x)) : []);
this.complaintImages.set(Array.isArray(d[6]) ? d[6].map((x: any) => this._sanitize(x)) : []);
// Debug — remove once images load correctly
const first = this.complaintImages()[0];
if (first) {
  console.log('[ComplaintImages] first row:', {
    hasPath: !!first.ImagePath,
    pathPreview: first.ImagePath ? String(first.ImagePath).substring(0, 80) : null,
    hasData: !!first.ImageData,
    dataType: typeof first.ImageData,
    isArray: Array.isArray(first.ImageData),
    dataLen: first.ImageData ? String(first.ImageData).length : 0,
    dataHead: first.ImageData ? String(first.ImageData).substring(0, 40) : null,
    contentType: first.ContentType
  });
}
        this.complaintData.set(this._sanitize(d[0]?.[0]));
        this.customerData.set(this._sanitize(d[1]?.[0]));
        this.productData.set(this._sanitize(d[2]?.[0]));
        this.assignments.set(Array.isArray(d[3]) ? d[3].map((x: any) => this._sanitize(x)) : []);
        this.spareParts.set(Array.isArray(d[4]) ? d[4].map((x: any) => this._sanitize(x)) : []);
        this.comments.set(Array.isArray(d[5]) ? d[5].map((x: any) => this._sanitize(x)) : []);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.showMessage('Failed to load complaint details', 'error'); }
    });
  }

  private _sanitize(raw: any): any {
    if (!raw || typeof raw !== 'object') return raw;
    const out: any = {};
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (v === null || v === undefined) { out[k] = null; continue; }
      if (typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        if (Object.keys(v).length === 0) { out[k] = null; continue; }
        out[k] = v; continue;
      }
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) &&
          (k.endsWith('Date') || k.endsWith('Expiry') || k === 'PreferredDate')) {
        out[k] = v.split('T')[0]; continue;
      }
      out[k] = v;
    }
    return out;
  }
// ─────────── Images ───────────
// ─────────── Images ───────────
getImageSrc(img: any): string {
  if (!img) return '';

  // Use ImagePath only if it looks like a real URL/path
  const path = img.ImagePath ? String(img.ImagePath).trim() : '';
  if (path && (path.startsWith('http') || path.startsWith('/') || path.startsWith('data:'))) {
    return path;
  }

  const raw = img.ImageData;
  if (raw === null || raw === undefined || raw === '') return '';

  let b64 = '';

  // Case A: came back as a byte array (e.g. [255,216,255,...])
  if (Array.isArray(raw)) {
    try {
      const bytes = new Uint8Array(raw);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      b64 = btoa(binary);
    } catch { return ''; }
  }
  // Case B: came back as a {type:'Buffer', data:[...]} style object
  else if (typeof raw === 'object' && Array.isArray((raw as any).data)) {
    return this.getImageSrc({ ...img, ImageData: (raw as any).data });
  }
  // Case C: came back as a string (normal happy path)
  else {
    b64 = String(raw).replace(/[\s\r\n]+/g, ''); // strip whitespace/newlines
  }

  if (!b64) return '';
  if (b64.startsWith('data:')) return b64;

  const ct = (img.ContentType && String(img.ContentType).trim())
              || this._detectImageMime(b64)
              || 'image/jpeg';
  return `data:${ct};base64,${b64}`;
}

private _detectImageMime(b64: string): string {
  // Magic-byte prefixes as they appear at the start of a base64 string
  const h = b64.substring(0, 16);
  if (h.startsWith('/9j/'))         return 'image/jpeg';  // FF D8 FF
  if (h.startsWith('iVBORw0KGgo'))  return 'image/png';   // 89 50 4E 47
  if (h.startsWith('R0lGOD'))       return 'image/gif';   // 47 49 46
  if (h.startsWith('UklGR'))        return 'image/webp';  // RIFF....WEBP
  if (h.startsWith('Qk'))           return 'image/bmp';   // BM
  return 'image/jpeg';
}
imageTypeClass(t: any): string {
  return 'it-' + String(t || 'other').toLowerCase().replace(/\s+/g, '');
}
openLightbox(img: any)  { this.lightboxImage.set(img); }
closeLightbox()          { this.lightboxImage.set(null); }
downloadImage(img: any) {
  const src = this.getImageSrc(img);
  if (!src) return;
  const a = document.createElement('a');
  a.href = src;
  a.download = img.ImageName || `complaint-image-${img.ImageId || ''}.jpg`;
  document.body.appendChild(a); a.click(); a.remove();
}
onImgError(ev: Event) {
  const t = ev.target as HTMLImageElement;
  t.style.display = 'none';
  (t.parentElement?.querySelector('.img-fail') as HTMLElement)?.style.setProperty('display', 'flex');
}
  // ───────────────────────── EDIT / SAVE ─────────────────────────
  startEdit(section: 'complaint'|'customer'|'product'|'location') {
      if (this.viewOnly) return;
    if (section === 'complaint') this.editData.complaint = this._sanitize({ ...(this.complaintData() || {}) });
    if (section === 'customer')  this.editData.customer  = this._sanitize({ ...(this.customerData()  || {}) });

    if (section === 'product') {
      const p = this.productData() || {};
      const c = this.complaintData() || {};
      const hasLinked = this.hasProduct();

      // Same shape in both modes so the form template stays identical
      this.editData.product = this._sanitize({
        __isProduct:        hasLinked,
        ProductName:        hasLinked ? p.ProductName  : '',
        SerialNumber:       hasLinked ? p.SerialNumber : '',
        ModelNumber:        p.ModelNumber     ?? c.ModelNumber ?? '',
        Brand:              p.Brand           ?? c.BrandName   ?? '',
        ProductCategory:    p.ProductCategory ?? c.Category    ?? '',
        PurchaseDate:       hasLinked ? p.PurchaseDate       : null,
        WarrantyExpiryDate: hasLinked ? p.WarrantyExpiryDate : null
      });
    }

    if (section === 'location') {
      const c = this.complaintData() || {};
      this.editData.location = this._sanitize({
        Latitude: c.Latitude, Longitude: c.Longitude,
        LocationAddress: c.LocationAddress, LocationName: c.LocationName
      });
    }
    (this.editing as any)[section] = true;
  }

  cancelEdit(section: 'complaint'|'customer'|'product'|'location') {
    (this.editing as any)[section] = false;
    if (section === 'customer') this.destroyCustomerMap();
    if (section === 'location') this.destroyLocationMap();
  }

  saveComplaint() {
    const e = this.editData.complaint;
    this.saving.set(true);
    this.api.updateComplaintDetails(this.complaintId, {
      subject: e.Subject, description: e.Description,
      priority: e.Priority, category: e.Category,
      brandName: e.BrandName, modelNumber: e.ModelNumber,
      preferredDate: e.PreferredDate || null,
      preferredTimeSlot: e.PreferredTimeSlot
    }).subscribe({
      next: (r: any) => this._afterSave(r, 'Complaint updated', 'complaint'),
      error: () => this._afterError('Error updating complaint')
    });
  }

  saveCustomer() {
    const e = this.editData.customer;
    const cid = this.customerData()?.CustomerId;
    if (!cid) { this.showMessage('Customer id missing', 'error'); return; }
    this.saving.set(true);
    this.api.updateCustomerDetails(cid, {
      customerName: e.CustomerName, customerEmail: e.Email,
      customerMobile: e.MobileNumber, alternatePhone: e.AlternatePhone,
      customerAddress: e.Address, city: e.City, state: e.State,
      pinCode: e.PinCode, landmark: e.Landmark,
      customerLatitude:  e.Latitude  ? Number(e.Latitude)  : null,
      customerLongitude: e.Longitude ? Number(e.Longitude) : null
    }).subscribe({
      next: (r: any) => { this.destroyCustomerMap(); this._afterSave(r, 'Customer updated', 'customer'); },
      error: () => this._afterError('Error updating customer')
    });
  }

  /**
   * Product save branches:
   *   • Linked product    → UPDATE_PRODUCT (writes to Products row)
   *   • Not linked + ProductName → CREATE_PRODUCT  (INSERTs into Products,
   *                                                  UPDATEs Complaints.ProductId)
   *   • Not linked + no ProductName → blocks with message; we need a name
   *     to create a real master row.
   */
  saveProduct() {
    const e = this.editData.product;

    if (e.__isProduct) {
      const pid = this.productData()?.ProductId;
      if (!pid) { this.showMessage('Product id missing', 'error'); return; }
      this.saving.set(true);
      this.api.updateProductDetails(pid, {
        productName: e.ProductName,
        serialNumber: e.SerialNumber,
        productModelNumber: e.ModelNumber,
        productBrand: e.Brand,
        productCategory: e.ProductCategory,
        purchaseDate: e.PurchaseDate || null,
        warrantyExpiryDate: e.WarrantyExpiryDate || null
      }).subscribe({
        next: (r: any) => this._afterSave(r, 'Product updated', 'product'),
        error: () => this._afterError('Error updating product')
      });
      return;
    }

    // Fallback mode — create a new master Products row and link it
    if (!e.ProductName || !String(e.ProductName).trim()) {
      this.showMessage('Product name is required to create a product record', 'error');
      return;
    }
    this.saving.set(true);
    this.api.createProductAndLink(this.complaintId, {
      productName: e.ProductName,
      serialNumber: e.SerialNumber,
      productModelNumber: e.ModelNumber,
      productBrand: e.Brand,
      productCategory: e.ProductCategory,
      purchaseDate: e.PurchaseDate || null,
      warrantyExpiryDate: e.WarrantyExpiryDate || null
    }).subscribe({
      next: (r: any) => this._afterSave(r, 'Product created and linked', 'product'),
      error: () => this._afterError('Error creating product')
    });
  }

  saveLocation() {
    const e = this.editData.location;
    this.saving.set(true);
    this.api.updateLocationDetails(this.complaintId, {
      latitude:  e.Latitude  ? Number(e.Latitude)  : null,
      longitude: e.Longitude ? Number(e.Longitude) : null,
      locationAddress: e.LocationAddress,
      locationName: e.LocationName
    }).subscribe({
      next: (r: any) => { this.destroyLocationMap(); this._afterSave(r, 'Location updated', 'location'); },
      error: () => this._afterError('Error updating location')
    });
  }

  private _afterSave(r: any, okMsg: string, section: 'complaint'|'customer'|'product'|'location') {
    this.saving.set(false);
    const ok = r?.Success ?? r?.success;
    if (ok) {
      this.showMessage(okMsg, 'success');
      this.loadAllData();
      (this.editing as any)[section] = false;
      this.refreshed.emit();
    } else {
      this.showMessage(r?.Message || r?.message || 'Update failed', 'error');
    }
  }
  private _afterError(msg: string) { this.saving.set(false); this.showMessage(msg, 'error'); }

  // ═══════════════ CUSTOMER NAV ═══════════════
  viewCustomer() {
    const cid = this.customerData()?.CustomerId;
    if (!cid) return;
    this.customerRequested.emit(cid);
    this.close();
  }
// ── Pagination per tab ────────────────────────────────
readonly TAB_PAGE_SIZE = 5;
readonly IMAGE_PAGE_SIZE = 8;

assignPage  = signal(1);
sparePage   = signal(1);
commentPage = signal(1);
imagePage   = signal(1);

pagedAssignments = computed(() => this._slice(this.assignments(),     this.assignPage(),  this.TAB_PAGE_SIZE));
pagedSpares      = computed(() => this._slice(this.spareParts(),      this.sparePage(),   this.TAB_PAGE_SIZE));
pagedComments    = computed(() => this._slice(this.comments(),        this.commentPage(), this.TAB_PAGE_SIZE));
pagedImages      = computed(() => this._slice(this.complaintImages(), this.imagePage(),   this.IMAGE_PAGE_SIZE));

assignTotalPages  = computed(() => Math.max(1, Math.ceil(this.assignments().length     / this.TAB_PAGE_SIZE)));
spareTotalPages   = computed(() => Math.max(1, Math.ceil(this.spareParts().length      / this.TAB_PAGE_SIZE)));
commentTotalPages = computed(() => Math.max(1, Math.ceil(this.comments().length        / this.TAB_PAGE_SIZE)));
imageTotalPages   = computed(() => Math.max(1, Math.ceil(this.complaintImages().length / this.IMAGE_PAGE_SIZE)));

private _slice<T>(arr: T[], page: number, size: number): T[] {
  const s = (page - 1) * size;
  return arr.slice(s, s + size);
}

prevAssign()  { if (this.assignPage()  > 1) this.assignPage.set(this.assignPage()  - 1); }
nextAssign()  { if (this.assignPage()  < this.assignTotalPages())  this.assignPage.set(this.assignPage()  + 1); }
prevSpare()   { if (this.sparePage()   > 1) this.sparePage.set(this.sparePage()   - 1); }
nextSpare()   { if (this.sparePage()   < this.spareTotalPages())   this.sparePage.set(this.sparePage()   + 1); }
prevComment() { if (this.commentPage() > 1) this.commentPage.set(this.commentPage() - 1); }
nextComment() { if (this.commentPage() < this.commentTotalPages()) this.commentPage.set(this.commentPage() + 1); }
prevImage()   { if (this.imagePage()   > 1) this.imagePage.set(this.imagePage()   - 1); }
nextImage()   { if (this.imagePage()   < this.imageTotalPages())   this.imagePage.set(this.imagePage()   + 1); }
  // ═══════════════ TECHNICIAN DELEGATION ═══════════════
  requestNewAssign() {
    const c = this.complaintData(); if (!c) return;
    this.assignRequested.emit({
      complaintId: c.ComplaintId,
      complaintNumber: c.ComplaintNumber,
      subject: c.Subject,
      customerName: this.customerData()?.CustomerName,
      customerPhone: this.customerData()?.MobileNumber,
      priority: c.Priority
    });
    this.close();
  }
  requestReassign(a: any) {
    this.reassignRequested.emit({
      ...a,
      complaintId: this.complaintData()?.ComplaintId,
      complaintNumber: this.complaintData()?.ComplaintNumber,
      subject: this.complaintData()?.Subject,
      customerName: this.customerData()?.CustomerName,
      customerPhone: this.customerData()?.MobileNumber,
      priority: this.complaintData()?.Priority
    });
    this.close();
  }
  requestUnassign(a: any) {
    this.unassignRequested.emit({
      ...a,
      complaintNumber: this.complaintData()?.ComplaintNumber,
      complaintSubject: this.complaintData()?.Subject
    });
    this.close();
  }

  startAssignment(a: any) {
    this.api.updateAssignment(a.AssignmentId, { status: 'InProgress' }).subscribe({
      next: (r: any) => {
        if (r?.Success ?? r?.success) {
          this.showMessage('Work started', 'success');
          this.loadAllData();
          this.refreshed.emit();
        } else {
          this.showMessage(r?.Message || r?.message || 'Failed to start work', 'error');
        }
      },
      error: () => this.showMessage('Error starting work', 'error')
    });
  }

  markComplaintResolved() {
    if (!confirm('Mark this complaint as completed/resolved?')) return;
    this.saving.set(true);
    // 5 is WorkCompleted in COMPLAINT_STATUSES
    this.api.updateComplaintStatus(this.complaintId, 5, 'Manually resolved via detail popup').subscribe({
      next: (r: any) => {
        this.saving.set(false);
        if (r?.Success ?? r?.success) {
          this.showMessage('Complaint resolved', 'success');
          this.loadAllData();
          this.refreshed.emit();
        } else {
          this.showMessage(r?.Message || r?.message || 'Failed to resolve', 'error');
        }
      },
      error: () => { this.saving.set(false); this.showMessage('Error resolving complaint', 'error'); }
    });
  }

  // ═══════════════ MARK COMPLETE ═══════════════
  startMarkComplete(a: any) {
      if (this.viewOnly) return;
    this.completingAssignmentId = a.AssignmentId;
    this.completeForm = {
      WorkDone: a.WorkDone || '',
      PartsUsed: a.PartsUsed || '',
      CompletionRemarks: a.CompletionRemarks || ''
    };
  }
  cancelMarkComplete() {
    this.completingAssignmentId = null;
    this.completeForm = { WorkDone: '', PartsUsed: '', CompletionRemarks: '' };
  }
  submitMarkComplete(a: any) {
    if (!this.completeForm.WorkDone?.trim()) {
      this.showMessage('Work done is required', 'error'); return;
    }
    this.savingComplete.set(true);
    this.api.updateAssignment(a.AssignmentId, {
      workDone:          this.completeForm.WorkDone,
      partsUsed:         this.completeForm.PartsUsed,
      completionRemarks: this.completeForm.CompletionRemarks,
      status:            'Completed'
    }).subscribe({
      next: (r: any) => {
        this.savingComplete.set(false);
        if (r?.Success ?? r?.success) {
          this.showMessage('Assignment marked complete', 'success');
          this.completingAssignmentId = null;
          this.loadAllData();
          this.refreshed.emit();
        } else {
          this.showMessage(r?.Message || r?.message || 'Failed to mark complete', 'error');
        }
      },
      error: () => { this.savingComplete.set(false); this.showMessage('Error marking complete', 'error'); }
    });
  }

  // ═══════════════ SPARE PARTS (edit existing only) ═══════════════
  startEditSpare(p: any) {
     if (this.viewOnly) return;
    this.editingSpareId = p.RequestId;
    this.editSpare = {
      Quantity: p.Quantity,
      UrgencyLevel: p.UrgencyLevel,
      Status: p.Status,
      Remarks: p.Remarks ?? ''
    };
  }
  cancelEditSpare() { this.editingSpareId = null; this.editSpare = {}; }
  saveEditSpare(p: any) {
    const q = Number(this.editSpare.Quantity);
    if (!q || q < 1) { this.showMessage('Quantity must be at least 1', 'error'); return; }
    this.savingSpare.set(true);
    this.api.updateSparePartRequest(p.RequestId, {
      spareQuantity: q, spareUrgency: this.editSpare.UrgencyLevel,
      spareRemarks: this.editSpare.Remarks, spareStatus: this.editSpare.Status
    }).subscribe({
      next: (r: any) => {
        this.savingSpare.set(false);
        if (r?.Success ?? r?.success) {
          this.showMessage('Spare updated', 'success');
          this.editingSpareId = null; this.editSpare = {};
          this.loadAllData();
        } else {
          this.showMessage(r?.Message || r?.message || 'Update failed', 'error');
        }
      },
      error: () => { this.savingSpare.set(false); this.showMessage('Error updating spare', 'error'); }
    });
  }
  deleteSpare(requestId: number) {
      if (this.viewOnly) return;
    if (!confirm('Delete this spare part request?')) return;
    this.savingSpare.set(true);
    this.api.deleteSparePartRequest(requestId).subscribe({
      next: (r: any) => {
        this.savingSpare.set(false);
        if (r?.Success ?? r?.success) { this.showMessage('Spare deleted', 'success'); this.loadAllData(); }
        else this.showMessage(r?.Message || r?.message || 'Delete failed', 'error');
      },
      error: () => { this.savingSpare.set(false); this.showMessage('Error deleting spare', 'error'); }
    });
  }

  // ───────────────────────── COMMENTS ─────────────────────────
  addComment() {
      if (this.viewOnly) return;
  if (!this.newComment.trim()) return;
    this.savingComment.set(true);
    this.api.addComment(this.complaintId, this.newComment, this.isInternalComment).subscribe({
      next: (r: any) => {
        this.savingComment.set(false);
        if (r?.Success ?? r?.success) {
          this.newComment = ''; this.isInternalComment = false;
          this.loadAllData();
          this.showMessage('Comment added', 'success');
        } else {
          this.showMessage(r?.Message || r?.message || 'Failed to add comment', 'error');
        }
      },
      error: () => { this.savingComment.set(false); this.showMessage('Error adding comment', 'error'); }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // LEAFLET MAP
  // ═══════════════════════════════════════════════════════════════════
  private initCustomerMap() {
    if (typeof L === 'undefined' || !this.customerMapRef?.nativeElement) return;
    this.customerMap?.remove();
    const lat = Number(this.editData.customer?.Latitude)  || this.DEFAULT_LAT;
    const lng = Number(this.editData.customer?.Longitude) || this.DEFAULT_LNG;
    this.customerMap = this._buildMap(this.customerMapRef.nativeElement, lat, lng);
    this.customerMarker = this._buildMarker(this.customerMap, lat, lng,
      (la, lo, addr) => this._updateCustomerLoc(la, lo, addr));
  }
  private initLocationMap() {
    if (typeof L === 'undefined' || !this.locationMapRef?.nativeElement) return;
    this.locationMap?.remove();
    const lat = Number(this.editData.location?.Latitude)  || this.DEFAULT_LAT;
    const lng = Number(this.editData.location?.Longitude) || this.DEFAULT_LNG;
    this.locationMap = this._buildMap(this.locationMapRef.nativeElement, lat, lng);
    this.locationMarker = this._buildMarker(this.locationMap, lat, lng,
      (la, lo, addr) => this._updateServiceLoc(la, lo, addr));
  }
  private _buildMap(el: HTMLElement, lat: number, lng: number): any {
    const map = L.map(el).setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
    setTimeout(() => map.invalidateSize(), 80);
    return map;
  }
  private _buildMarker(map: any, lat: number, lng: number,
                       onMove: (la: number, lo: number, addr?: string) => void): any {
    const icon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41]
    });
    const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map);
    marker.on('dragend', (ev: any) => {
      const p = ev.target.getLatLng();
      this._reverseGeocode(p.lat, p.lng).then(addr => onMove(p.lat, p.lng, addr));
    });
    map.on('click', (ev: any) => {
      marker.setLatLng(ev.latlng);
      this._reverseGeocode(ev.latlng.lat, ev.latlng.lng).then(addr => onMove(ev.latlng.lat, ev.latlng.lng, addr));
    });
    return marker;
  }
  private _updateCustomerLoc(lat: number, lng: number, addr?: string) {
    this.editData.customer.Latitude = lat;
    this.editData.customer.Longitude = lng;
    if (addr) this.editData.customer.Address = addr;
  }
  private _updateServiceLoc(lat: number, lng: number, addr?: string) {
    this.editData.location.Latitude = lat;
    this.editData.location.Longitude = lng;
    if (addr) {
      this.editData.location.LocationAddress = addr;
      this.editData.location.LocationName = addr.split(',')[0]?.trim() || this.editData.location.LocationName;
    }
  }
  useCurrentLocationCustomer() { this._useCurrentLocation('customer'); }
  useCurrentLocationLocation() { this._useCurrentLocation('location'); }
  private _useCurrentLocation(section: 'customer'|'location') {
    if (!navigator.geolocation) { this.showMessage('Geolocation not supported', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: la, longitude: lo } = pos.coords;
        if (section === 'customer' && this.customerMap && this.customerMarker) {
          this.customerMap.setView([la, lo], 16);
          this.customerMarker.setLatLng([la, lo]);
          this._reverseGeocode(la, lo).then(addr => this._updateCustomerLoc(la, lo, addr));
        }
        if (section === 'location' && this.locationMap && this.locationMarker) {
          this.locationMap.setView([la, lo], 16);
          this.locationMarker.setLatLng([la, lo]);
          this._reverseGeocode(la, lo).then(addr => this._updateServiceLoc(la, lo, addr));
        }
      },
      err => this.showMessage('Cannot access location: ' + (err.message || 'denied'), 'error'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }
  onCustomerSearchInput(event: Event) { this._debouncedSearch((event.target as HTMLInputElement).value, 'customer'); }
  onLocationSearchInput(event: Event) { this._debouncedSearch((event.target as HTMLInputElement).value, 'location'); }
  private _debouncedSearch(q: string, section: 'customer'|'location') {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    if (!q || q.length < 3) {
      if (section === 'customer') this.customerSearchResults = [];
      else this.locationSearchResults = [];
      return;
    }
    this.searchTimeout = setTimeout(() => this._searchPlaces(q, section), 400);
  }
  private _searchPlaces(q: string, section: 'customer'|'location') {
    this.isSearching = true;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&countrycodes=in&addressdetails=1`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (section === 'customer') this.customerSearchResults = Array.isArray(data) ? data : [];
        else this.locationSearchResults = Array.isArray(data) ? data : [];
        this.isSearching = false;
      })
      .catch(() => {
        this.isSearching = false;
        if (section === 'customer') this.customerSearchResults = [];
        else this.locationSearchResults = [];
      });
  }
  selectCustomerSearchResult(r: any) {
    const la = parseFloat(r.lat), lo = parseFloat(r.lon);
    if (this.customerMap && this.customerMarker) {
      this.customerMap.setView([la, lo], 16);
      this.customerMarker.setLatLng([la, lo]);
    }
    this._updateCustomerLoc(la, lo, r.display_name);
    this.customerSearchResults = [];
  }
  selectLocationSearchResult(r: any) {
    const la = parseFloat(r.lat), lo = parseFloat(r.lon);
    if (this.locationMap && this.locationMarker) {
      this.locationMap.setView([la, lo], 16);
      this.locationMarker.setLatLng([la, lo]);
    }
    this._updateServiceLoc(la, lo, r.display_name);
    this.locationSearchResults = [];
  }
  private _reverseGeocode(la: number, lo: number): Promise<string> {
    return fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${la}&lon=${lo}&zoom=18&addressdetails=1`)
      .then(r => r.json()).then(d => d?.display_name || '').catch(() => '');
  }
  private destroyCustomerMap() {
    try { this.customerMap?.remove(); } catch {}
    this.customerMap = null; this.customerMarker = null;
    this.customerSearchResults = [];
  }
  private destroyLocationMap() {
    try { this.locationMap?.remove(); } catch {}
    this.locationMap = null; this.locationMarker = null;
    this.locationSearchResults = [];
  }
  private destroyMaps() { this.destroyCustomerMap(); this.destroyLocationMap(); }

  // ───────────────────────── UTIL ─────────────────────────
  display(v: any, fallback = '—'): string {
    if (v === null || v === undefined) return fallback;
    if (typeof v === 'object') return fallback;
    const s = String(v).trim();
    return s === '' ? fallback : s;
  }
  formatDate(d: any): string {
    if (!d || (typeof d === 'object' && !(d instanceof Date))) return '—';
    const dt = new Date(d); return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN');
  }
  formatDateTime(d: any): string {
    if (!d || (typeof d === 'object' && !(d instanceof Date))) return '—';
    const dt = new Date(d); return isNaN(dt.getTime()) ? '—' : dt.toLocaleString('en-IN');
  }
  statusClass(id: any): string {
    const m: Record<number,string> = { 1:'status-new', 2:'status-progress', 3:'status-resolved', 4:'status-closed' };
    return m[Number(id)] || 'status-new';
  }
  priorityClass(p: any): string { return `priority-${String(p || 'medium').toLowerCase()}`; }
  assignStatusClass(s: any): string { return String(s || 'assigned').toLowerCase().replace(/\s+/g, ''); }
  isAssignmentActive(a: any): boolean {
    const s = String(a?.Status || '').toLowerCase();
    return s !== 'completed' && s !== 'removed';
  }
  isWarrantyExpired(): boolean {
    const e = this.productData()?.WarrantyExpiryDate;
    if (!e) return false;
    const dt = new Date(e); return !isNaN(dt.getTime()) && dt < new Date();
  }

  showMessage(msg: string, type: 'success'|'error') {
    this.toastMessage.set(msg); this.toastType.set(type);
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 2600);
  }
  refresh() { this.loadAllData(); this.refreshed.emit(); }
  close()   { this.destroyMaps(); this.closed.emit(); }
}
