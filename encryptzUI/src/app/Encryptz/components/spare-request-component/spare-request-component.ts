import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../Services/API/api-service';
import { SparePart, SparePartRequest } from '../../Models/ApiModels';

interface CartItem {
  part: SparePart;
  quantity: number;
  urgencyLevel: string;
  remarks: string;
}

@Component({
  selector: 'app-spare-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './spare-request-component.html',
  styleUrls: ['./spare-request-component.scss'],
})
export class SpareRequestComponent implements OnInit {
  private api         = inject(ApiService);
  private _destroyRef = inject(DestroyRef);

  private techSubject      = new Subject<string>();
  private complaintSubject = new Subject<string>();
  private spareSubject     = new Subject<string>();

  requests   = signal<SparePartRequest[]>([]);
  showForm   = signal(true);
  loading    = signal(false);
  submitting = signal(false);
  msg        = signal('');
  msgErr     = signal(false);

  // Technician
  techSearch        = '';
  techResults       = signal<any[]>([]);
  showTechDropdown  = false;
  selectedTech      = signal<any>(null);
  techSearchLoading = signal(false);
  techId            = 0;

  // Complaint autocomplete
  complaintSearch        = '';
  complaintResults       = signal<any[]>([]);
  showComplaintDropdown  = false;
  selectedComplaint      = signal<any>(null);
  complaintSearchLoading = signal(false);

  // Spare part autocomplete
  spareSearch        = '';
  spareResults       = signal<SparePart[]>([]);
  showSpareDropdown  = false;
  spareSearchLoading = signal(false);

  // Cart
  cart      = signal<CartItem[]>([]);
  cartTotal = computed(() => this.cart().reduce((s, i) => s + i.quantity, 0));

  // Stats from current page of requests
  requestedCount = computed(() => this.requests().filter(r => r.status?.toLowerCase() === 'requested').length);
  approvedCount  = computed(() => this.requests().filter(r => r.status?.toLowerCase() === 'approved').length);
  dispatchedCount = computed(() => this.requests().filter(r => r.status?.toLowerCase() === 'dispatched').length);
  rejectedCount  = computed(() => this.requests().filter(r => r.status?.toLowerCase() === 'rejected').length);

  urgencyOptions = ['Normal', 'Urgent', 'Critical'];

  ngOnInit(): void {
    this.techSubject.pipe(debounceTime(300), takeUntilDestroyed(this._destroyRef))
      .subscribe(term => {
        if (!term.trim()) { this.techResults.set([]); return; }
        this.techSearchLoading.set(true);
        this.api.getTechnicians({ searchTerm: term, pageNumber: 1, pageSize: 10 } as any).subscribe({
          next: (d: any) => { this.techResults.set(d.items || d || []); this.techSearchLoading.set(false); },
          error: () => { this.techResults.set([]); this.techSearchLoading.set(false); }
        });
      });

    this.complaintSubject.pipe(debounceTime(300), takeUntilDestroyed(this._destroyRef))
      .subscribe(term => {
        if (!term.trim()) { this.complaintResults.set([]); return; }
        this.complaintSearchLoading.set(true);
        this.api.getComplaintsLookup(term).subscribe({
          next: (d: any) => { this.complaintResults.set(Array.isArray(d) ? d : []); this.complaintSearchLoading.set(false); },
          error: () => { this.complaintResults.set([]); this.complaintSearchLoading.set(false); }
        });
      });

    this.spareSubject.pipe(debounceTime(300), takeUntilDestroyed(this._destroyRef))
      .subscribe(term => {
        this.spareSearchLoading.set(true);
        this.api.searchSpareParts(term).subscribe({
          next: (d: any) => { this.spareResults.set(Array.isArray(d) ? d : (d?.data ?? [])); this.spareSearchLoading.set(false); },
          error: () => { this.spareResults.set([]); this.spareSearchLoading.set(false); }
        });
      });

    this.loadSpares();
  }

  loadSpares(): void {
    this.api.getSpareParts().subscribe({
      next: (d: any) => this.spareResults.set(Array.isArray(d) ? d : (d?.data ?? [])),
      error: () => {}
    });
  }

  // Technician
  onTechSearch(): void { this.showTechDropdown = true; this.techSubject.next(this.techSearch); }
  selectTech(t: any): void {
    this.selectedTech.set(t); this.techId = t.technicianId;
    this.techSearch = t.fullName; this.showTechDropdown = false;
    this.techResults.set([]); this.loadRequests();
  }
  clearTech(): void {
    this.selectedTech.set(null); this.techId = 0;
    this.techSearch = ''; this.techResults.set([]);
    this.showTechDropdown = false; this.requests.set([]);
  }

  // Complaint
  onComplaintSearch(): void { this.showComplaintDropdown = true; this.complaintSubject.next(this.complaintSearch); }
  selectComplaint(c: any): void {
    this.selectedComplaint.set(c);
    this.complaintSearch = `${c.complaintNumber} — ${c.subject}`;
    this.showComplaintDropdown = false; this.complaintResults.set([]);
  }
  clearComplaint(): void {
    this.selectedComplaint.set(null); this.complaintSearch = '';
    this.complaintResults.set([]); this.showComplaintDropdown = false;
  }

  // Spare part
  onSpareSearch(): void {
    this.showSpareDropdown = true;
    if (this.spareSearch.trim()) this.spareSubject.next(this.spareSearch);
    else this.loadSpares();
  }

  addToCart(part: SparePart): void {
    const idx = this.cart().findIndex(i => i.part.sparePartId === part.sparePartId);
    if (idx >= 0) {
      this.cart.update(list => { const c = [...list]; c[idx] = { ...c[idx], quantity: c[idx].quantity + 1 }; return c; });
    } else {
      this.cart.update(list => [...list, { part, quantity: 1, urgencyLevel: 'Normal', remarks: '' }]);
    }
    this.spareSearch = ''; this.showSpareDropdown = false;
  }

  removeFromCart(index: number): void {
    this.cart.update(list => list.filter((_, i) => i !== index));
  }

  updateCartQty(index: number, qty: number): void {
    if (qty < 1) return;
    this.cart.update(list => { const c = [...list]; c[index] = { ...c[index], quantity: qty }; return c; });
  }

  updateCartUrgency(index: number, urgency: string): void {
    this.cart.update(list => { const c = [...list]; c[index] = { ...c[index], urgencyLevel: urgency }; return c; });
  }

  updateCartRemarks(index: number, remarks: string): void {
    this.cart.update(list => { const c = [...list]; c[index] = { ...c[index], remarks }; return c; });
  }

  isInCart(part: SparePart): boolean {
    return this.cart().some(i => i.part.sparePartId === part.sparePartId);
  }

  loadRequests(): void {
    if (!this.techId) return;
    this.loading.set(true);
    this.api.getSparePartRequests(this.techId).subscribe({
      next: (d: any) => { this.requests.set(Array.isArray(d) ? d : (d?.data ?? [])); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openForm(): void {
    this.selectedComplaint.set(null); this.complaintSearch = '';
    this.spareSearch = ''; this.cart.set([]); this.msg.set('');
    this.showForm.set(true); this.loadSpares();
  }

  submit(): void {
    const complaint = this.selectedComplaint();
    if (!this.techId)           { this.show('Please select a technician', true); return; }
    if (!complaint)             { this.show('Please select a complaint', true); return; }
    if (this.cart().length === 0){ this.show('Please add at least one spare part', true); return; }

    this.submitting.set(true); this.msg.set('');
    const items = this.cart();
    let completed = 0, failed = 0;

    const next = (i: number) => {
      if (i >= items.length) {
        this.submitting.set(false);
        if (failed === 0) {
          this.show(`${completed} request(s) submitted successfully`, false);
          this.showForm.set(false); this.cart.set([]); this.loadRequests();
        } else {
          this.show(`${completed} submitted, ${failed} failed`, true);
        }
        return;
      }
      const item = items[i];
      this.api.requestSparePart(this.techId, {
        complaintId: complaint.complaintId, sparePartId: item.part.sparePartId,
        quantity: item.quantity, urgencyLevel: item.urgencyLevel, remarks: item.remarks
      }).subscribe({
        next: (r: any) => { if (r.success) completed++; else failed++; next(i + 1); },
        error: () => { failed++; next(i + 1); }
      });
    };
    next(0);
  }

  getTechAvailClass(s: number): string { return s === 1 ? 'av' : s === 2 ? 'busy' : 'leave'; }
  getTechAvailLabel(s: number): string { return s === 1 ? 'Available' : s === 2 ? 'Busy' : 'On Leave'; }
  getStatusClass(s: string): string {
    return ({ requested:'requested', approved:'approved', dispatched:'dispatched', used:'used', rejected:'rejected' } as any)[s?.toLowerCase()] || 'requested';
  }
  private show(m: string, err: boolean): void {
    this.msg.set(m); this.msgErr.set(err);
    if (!err) setTimeout(() => this.msg.set(''), 3000);
  }
}
