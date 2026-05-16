import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';
import { EditPaymentDialog } from '../edit-payment-dialog/edit-payment-dialog';

interface AdminPayment {
  paymentId: number;
  complaintId: number;
  complaintNumber?: string;
  customerName: string;
  mobileNo: string;
  paymentType: string;
  serviceChargeAmount: number;
  sparePartsAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  paymentMethod: string;
  upiIdUsed: string | null;
  transactionReference: string | null;
  paymentStatus: string;
  remarks: string;
  createdAt: string;
  createdAtRaw: Date;
  createdByName: string;
  isVerified: boolean;
  verifiedByName: string | null;
  verifiedAt: string | null;
}

@Component({
  selector: 'app-payment-report',
  standalone: true,
  imports: [CommonModule, FormsModule, EditPaymentDialog],
  templateUrl: './payment-report-component.html',
  styleUrls: ['./payment-report-component.scss']
})
export class PaymentReportComponent implements OnInit {
  loading        = signal(false);
  payments       = signal<AdminPayment[]>([]);
  editingPayment = signal<AdminPayment | null>(null);

  // Date filter — default: last 7 days → today
  fromDate = signal(this.defaultFrom());
  toDate   = signal(this.todayStr());

  // Search & segmented filters
  filterSearch = signal('');
  filterType   = signal('');   // '' | 'Advance' | 'Final'
  filterMethod = signal('');   // '' | 'Cash' | 'UPI'
  filterStatus = signal('');   // '' | 'Success' | 'Pending' | 'Failed'

  // Tracks which rows are mid-verify API call
  verifyingIds = signal<Set<number>>(new Set());

  // Inline comment
  commentingId  = signal<number | null>(null);
  commentDraft  = '';
  savingComment = signal(false);

  // Pagination
  currentPage    = signal(1);
  readonly pageSize = 10;

  // ── Computed ──────────────────────────────────────────────────────────────

  filteredPayments = computed(() => {
    const from   = new Date(this.fromDate() + 'T00:00:00');
    const to     = new Date(this.toDate()   + 'T23:59:59');
    const search = this.filterSearch().toLowerCase().trim();
    const type   = this.filterType().toLowerCase();
    const method = this.filterMethod().toLowerCase();
    const status = this.filterStatus().toLowerCase();

    return this.payments().filter(p => {
      if (p.createdAtRaw < from || p.createdAtRaw > to) return false;
      if (type   && (p.paymentType   || '').toLowerCase() !== type)   return false;
      if (method && (p.paymentMethod || '').toLowerCase() !== method) return false;
      if (status && (p.paymentStatus || '').toLowerCase() !== status) return false;
      if (search) {
        const hay = [p.customerName, p.mobileNo, p.complaintNumber]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredPayments().length / this.pageSize))
  );

  paginatedPayments = computed(() => {
    const s = (this.currentPage() - 1) * this.pageSize;
    return this.filteredPayments().slice(s, s + this.pageSize);
  });

  visiblePages = computed((): (number | null)[] => {
    const total = this.totalPages();
    const cur   = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | null)[] = [1];
    if (cur > 3) pages.push(null);
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
    if (cur < total - 2) pages.push(null);
    pages.push(total);
    return pages;
  });

  constructor(private api: ApiService) {}

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private defaultFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true);
    this.api.getAllPayments().subscribe({
      next: (res: any) => {
        const rows: any[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)  ? res.data
          : Array.isArray(res?.items) ? res.items
          : res?.data != null         ? [res.data]
          : [];

        this.payments.set(rows.map((p: any) => ({
          ...p,
          createdAtRaw: this.parseDate(p.createdAt),
          createdAt:    this.toIST(p.createdAt),
          isVerified:   !!p.isVerified,
          verifiedAt:   p.verifiedAt ? this.toIST(p.verifiedAt) : null
        })));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('[PaymentReport] load error', err);
      }
    });
  }

  private parseDate(raw: any): Date {
    if (!raw) return new Date(0);
    let s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z';
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  private toIST(raw: any): string {
    const d = this.parseDate(raw);
    if (d.getTime() === 0) return String(raw ?? '');
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'Asia/Kolkata'
    }) + ' IST';
  }

  onDateChange(): void { this.currentPage.set(1); }

  setFilter(kind: 'type' | 'method' | 'status', val: string): void {
    if (kind === 'type')   this.filterType.set(val);
    if (kind === 'method') this.filterMethod.set(val);
    if (kind === 'status') this.filterStatus.set(val);
    this.currentPage.set(1);
  }

  onSearchChange(): void { this.currentPage.set(1); }

  verifyAll(): void {
    const targets = this.filteredPayments()
      .filter(p => !p.isVerified && !this.isVerifying(p.paymentId));
    targets.forEach(p => this.toggleVerify(p));
  }

  // ── Edit dialog ────────────────────────────────────────────────────────────
  edit(p: AdminPayment): void { this.editingPayment.set({ ...p }); }
  onSaved():     void { this.editingPayment.set(null); this.loadAll(); }
  onCancelled(): void { this.editingPayment.set(null); }

  // ── Verify (calls API) ────────────────────────────────────────────────────
  isVerifying(id: number): boolean { return this.verifyingIds().has(id); }

  toggleVerify(p: AdminPayment): void {
    if (this.isVerifying(p.paymentId)) return;

    const newVal = !p.isVerified;

    // mark as in-progress
    this.verifyingIds.update(s => { const n = new Set(s); n.add(p.paymentId); return n; });

    this.api.verifyPayment(p.paymentId, newVal).subscribe({
      next: () => {
        this.payments.update(list =>
          list.map(x => x.paymentId === p.paymentId
            ? { ...x, isVerified: newVal, verifiedByName: newVal ? 'You' : null, verifiedAt: newVal ? this.toIST(new Date().toISOString()) : null }
            : x)
        );
        this.verifyingIds.update(s => { const n = new Set(s); n.delete(p.paymentId); return n; });
      },
      error: () => {
        this.verifyingIds.update(s => { const n = new Set(s); n.delete(p.paymentId); return n; });
        console.error('[PaymentReport] verify failed for', p.paymentId);
      }
    });
  }

  // ── Comment ───────────────────────────────────────────────────────────────
  openComment(p: AdminPayment): void {
    this.commentingId.set(p.paymentId);
    this.commentDraft = p.remarks ?? '';
  }

  cancelComment(): void {
    this.commentingId.set(null);
    this.commentDraft = '';
  }

  saveComment(p: AdminPayment): void {
    this.savingComment.set(true);
    const draft = this.commentDraft;
    this.api.updatePayment({ ...p, remarks: draft }).subscribe({
      next: () => {
        this.payments.update(list =>
          list.map(x => x.paymentId === p.paymentId ? { ...x, remarks: draft } : x)
        );
        this.savingComment.set(false);
        this.cancelComment();
      },
      error: () => this.savingComment.set(false)
    });
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  goToPage(n: number): void {
    if (n >= 1 && n <= this.totalPages()) this.currentPage.set(n);
  }
  prevPage(): void { this.goToPage(this.currentPage() - 1); }
  nextPage(): void { this.goToPage(this.currentPage() + 1); }

  startIndex(): number { return (this.currentPage() - 1) * this.pageSize + 1; }
  endIndex():   number { return Math.min(this.currentPage() * this.pageSize, this.filteredPayments().length); }
}
