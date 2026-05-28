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
  createdAtDateStr: string; // "YYYY-MM-DD" in IST — used for date range filtering
  createdByName: string;
  serviceDescription?: string;
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

  fromDate = signal(this.defaultFrom());
  toDate   = signal(this.todayStr());

  // Filters
  filterSearch           = signal('');
  filterType             = signal('');
  filterMethod           = signal('');
  filterTechnician       = signal('');
  filterCompanyStatus    = signal('');
  filterAccountingStatus = signal('');

  verifyingIds  = signal<Set<number>>(new Set());
  commentingId  = signal<number | null>(null);
  commentDraft  = '';
  savingComment = signal(false);

  currentPage       = signal(1);
  readonly pageSize = 10;

  // ── Date-range only (summary cards ignore table-level filters)
  dateFilteredPayments = computed(() => {
    const from = this.fromDate();
    const to   = this.toDate();
    return this.payments().filter(p => p.createdAtDateStr >= from && p.createdAtDateStr <= to);
  });

  // ── Summary cards
  totalCollection         = computed(() => this.dateFilteredPayments().reduce((s, p) => s + (p.amountPaid ?? 0), 0));
  cashCollection          = computed(() => this.dateFilteredPayments().filter(p => p.paymentMethod === 'Cash').reduce((s, p) => s + (p.amountPaid ?? 0), 0));
  upiCollection           = computed(() => this.dateFilteredPayments().filter(p => p.paymentMethod === 'UPI').reduce((s, p)  => s + (p.amountPaid ?? 0), 0));
  cashPercent             = computed(() => this.totalCollection() > 0 ? +(this.cashCollection() / this.totalCollection() * 100).toFixed(2) : 0);
  upiPercent              = computed(() => this.totalCollection() > 0 ? +(this.upiCollection()  / this.totalCollection() * 100).toFixed(2) : 0);
  pendingCount            = computed(() => this.dateFilteredPayments().filter(p => (p.paymentStatus || '').toLowerCase() === 'pending').length);
  pendingAmount           = computed(() => this.dateFilteredPayments().filter(p => (p.paymentStatus || '').toLowerCase() === 'pending').reduce((s, p) => s + (p.amountPaid ?? 0), 0));
  pendingAccounting       = computed(() => this.dateFilteredPayments().filter(p => !p.isVerified).length);
  pendingAccountingAmount = computed(() => this.dateFilteredPayments().filter(p => !p.isVerified).reduce((s, p) => s + (p.amountPaid ?? 0), 0));

  // ── Unique technicians for dropdown
  technicianList = computed(() => {
    const names = new Set(this.payments().map(p => p.createdByName).filter(Boolean));
    return Array.from(names).sort();
  });

  // ── Full filtered list (for table)
  filteredPayments = computed(() => {
    const from    = this.fromDate();
    const to      = this.toDate();
    const search  = this.filterSearch().toLowerCase().trim();
    const type    = this.filterType().toLowerCase();
    const method  = this.filterMethod().toLowerCase();
    const tech    = this.filterTechnician().toLowerCase();
    const cStatus = this.filterCompanyStatus().toLowerCase();
    const aStatus = this.filterAccountingStatus();

    return this.payments().filter(p => {
      if (p.createdAtDateStr < from || p.createdAtDateStr > to) return false;
      if (type    && (p.paymentType   || '').toLowerCase() !== type)    return false;
      if (method  && (p.paymentMethod || '').toLowerCase() !== method)  return false;
      if (tech    && (p.createdByName || '').toLowerCase() !== tech)    return false;
      if (cStatus && (p.paymentStatus || '').toLowerCase() !== cStatus) return false;
      if (aStatus === 'verified'   && !p.isVerified) return false;
      if (aStatus === 'unverified' &&  p.isVerified) return false;
      if (search) {
        const hay = [p.customerName, p.mobileNo, p.complaintNumber].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredPayments().length / this.pageSize)));

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

  private todayStr(): string { return new Date().toISOString().slice(0, 10); }

  private defaultFrom(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true);
    this.api.getAllPayments().subscribe({
      next: (res: any) => {
        const rows: any[] = Array.isArray(res) ? res
          : Array.isArray(res?.data)  ? res.data
          : Array.isArray(res?.items) ? res.items
          : res?.data != null         ? [res.data] : [];
        this.payments.set(rows.map((p: any) => ({
          ...p,
          totalAmount:         +(p.totalAmount         ?? 0),
          amountPaid:          +(p.amountPaid          ?? 0),
          discountAmount:      +(p.discountAmount       ?? 0),
          serviceChargeAmount: +(p.serviceChargeAmount ?? 0),
          sparePartsAmount:    +(p.sparePartsAmount     ?? 0),
          createdAt:           this.toIST(p.createdAt),
          createdAtDateStr:    this.toISTDateStr(p.createdAt),
          isVerified:          !!p.isVerified,
          verifiedAt:          p.verifiedAt ? this.toIST(p.verifiedAt) : null
        })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private parseDate(raw: any): Date {
    if (!raw) return new Date(0);
    let s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z';
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  // Returns "YYYY-MM-DD" in IST — timezone-safe date-only string for filtering
  private toISTDateStr(raw: any): string {
    const d = this.parseDate(raw);
    if (d.getTime() === 0) return '';
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 10);
  }

  private toIST(raw: any): string {
    const d = this.parseDate(raw);
    if (d.getTime() === 0) return String(raw ?? '');
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });
  }

  formatDateDisplay(str: string): string {
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatINR(n: number): string {
    return '₹' + (n ?? 0).toLocaleString('en-IN');
  }

  onDateChange(): void   { this.currentPage.set(1); }
  onSearchChange(): void { this.currentPage.set(1); }

  setFilter(kind: string, val: string): void {
    if (kind === 'type')       this.filterType.set(val);
    if (kind === 'method')     this.filterMethod.set(val);
    if (kind === 'technician') this.filterTechnician.set(val);
    if (kind === 'company')    this.filterCompanyStatus.set(val);
    if (kind === 'accounting') this.filterAccountingStatus.set(val);
    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.filterSearch.set('');
    this.filterType.set('');
    this.filterMethod.set('');
    this.filterTechnician.set('');
    this.filterCompanyStatus.set('');
    this.filterAccountingStatus.set('');
    this.currentPage.set(1);
  }

  exportData(): void { /* TODO: export to Excel/PDF */ }
  addCollection(): void { /* TODO: open add collection dialog */ }

  // ── Status label / class helpers
  getCompanyStatusLabel(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'success': return 'Received';
      case 'pending': return 'Pending';
      case 'failed':  return 'Partially Received';
      default:        return status || '—';
    }
  }

  getCompanyStatusClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'success': return 'cs-received';
      case 'pending': return 'cs-pending';
      case 'failed':  return 'cs-partial';
      default:        return '';
    }
  }

  getAccountingLabel(p: AdminPayment): string {
    if (p.isVerified)     return 'Verified';
    if (p.verifiedByName) return 'Entered';
    return 'Pending Entry';
  }

  getAccountingClass(p: AdminPayment): string {
    if (p.isVerified)     return 'ac-verified';
    if (p.verifiedByName) return 'ac-entered';
    return 'ac-pending';
  }

  getAvatarLetter(name: string): string { return (name || '?').charAt(0).toUpperCase(); }

  getAvatarColor(name: string): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    return colors[(name || '').charCodeAt(0) % colors.length];
  }

  getAdvanceAmount(p: AdminPayment): number | null {
    return (p.paymentType || '').toLowerCase() === 'advance' ? p.amountPaid : null;
  }

  getFinalAmount(p: AdminPayment): number | null {
    return (p.paymentType || '').toLowerCase() === 'final' ? p.amountPaid : null;
  }

  // ── Totals (across ALL filtered records, not just current page)
  cashTotal = computed(() =>
    this.filteredPayments().filter(p => p.paymentMethod === 'Cash').reduce((s, p) => s + p.amountPaid, 0)
  );
  upiTotal = computed(() =>
    this.filteredPayments().filter(p => p.paymentMethod === 'UPI').reduce((s, p) => s + p.amountPaid, 0)
  );

  printReport(): void {
    const payments = this.filteredPayments();
    const fromStr  = this.formatDateDisplay(this.fromDate());
    const toStr    = this.formatDateDisplay(this.toDate());
    const cashTot  = this.formatINR(this.cashTotal());
    const upiTot   = this.formatINR(this.upiTotal());
    const grandTot = this.formatINR(this.cashTotal() + this.upiTotal());

    const rows = payments.map((p, i) => {
      const adv    = this.getAdvanceAmount(p);
      const fin    = this.getFinalAmount(p);
      const sLabel = this.getCompanyStatusLabel(p.paymentStatus);
      const sCls   = (p.paymentStatus || '').toLowerCase() === 'success' ? 'st-recv'
                   : (p.paymentStatus || '').toLowerCase() === 'pending'  ? 'st-pend' : 'st-part';
      const svc    = p.serviceDescription || (p.paymentType ? p.paymentType + ' Payment' : '—');
      return `<tr class="${p.isVerified ? 'vrf' : ''}">
        <td class="tc">${i + 1}</td>
        <td>${p.createdAt}</td>
        <td class="jn">${p.complaintNumber || '—'}</td>
        <td><b>${p.customerName}</b><br><small>${p.mobileNo}</small></td>
        <td>${svc}</td>
        <td class="tr">${this.formatINR(p.totalAmount)}</td>
        <td class="tr">${adv !== null ? this.formatINR(adv) : '<span class="dim">—</span>'}</td>
        <td class="tr">${this.formatINR(p.discountAmount)}</td>
        <td class="tr b">${this.formatINR(p.totalAmount - p.discountAmount)}</td>
        <td class="tr">${fin !== null ? '<b>' + this.formatINR(fin) + '</b>' : '<span class="dim">—</span>'}</td>
        <td>${p.createdByName || '—'}</td>
        <td class="tr ca">${p.paymentMethod === 'Cash' ? this.formatINR(p.amountPaid) : '<span class="dim">—</span>'}</td>
        <td class="tr up">${p.paymentMethod === 'UPI'  ? this.formatINR(p.amountPaid) : '<span class="dim">—</span>'}</td>
        <td><span class="${sCls}">${sLabel}</span></td>
      </tr>`;
    }).join('\n');

    const printedOn = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Payment Report – Felix Service Management</title>
<style>
@page { size: A4 landscape; margin: 10mm 8mm; }
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 8pt; color: #111827; }

.hd { border-bottom: 2px solid #1e1b4b; padding-bottom: 6px; margin-bottom: 10px; }
.co { font-size: 10pt; font-weight: 700; color: #1e1b4b; }
.rt { font-size: 13pt; font-weight: 700; margin: 2px 0; color: #111827; }
.mt { display: flex; gap: 12px; font-size: 8pt; color: #4b5563; margin-top: 5px; flex-wrap: wrap; align-items: center; }
.sp { color: #d1d5db; }
.mc { font-weight: 700; color: #15803d; }
.mu { font-weight: 700; color: #4338ca; }
.mg { font-weight: 700; color: #1e1b4b; }

table { width: 100%; border-collapse: collapse; font-size: 7.5pt; table-layout: fixed; }
thead tr { background: #1e1b4b; }
th { padding: 6px 5px; font-weight: 600; color: #fff; text-align: left;
     border-right: 1px solid rgba(255,255,255,.12); white-space: nowrap; vertical-align: top; overflow: hidden; }
th:last-child { border-right: none; }
.ts { font-size: 5.5pt; font-weight: 400; opacity: .75; display: block; margin-top: 2px; }
tbody tr:nth-child(even) { background: #f8fafc; }
.vrf { background: #f0fdf4 !important; }
td { padding: 5px 5px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; overflow: hidden; word-break: break-word; }
.tr { text-align: right; font-variant-numeric: tabular-nums; }
.tc { text-align: center; color: #6b7280; }
.b  { font-weight: 700; color: #111827; }
.dim { color: #9ca3af; }
.jn { color: #2563eb; font-weight: 600; }
.ca { color: #15803d; font-weight: 700; }
.up { color: #4338ca; font-weight: 700; }
small { font-size: 6.5pt; color: #6b7280; display: block; margin-top: 1px; }
.st-recv { background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 6.5pt; font-weight: 600; white-space: nowrap; display: inline-block; }
.st-pend { background: #fef9c3; color: #a16207; padding: 2px 6px; border-radius: 4px; font-size: 6.5pt; font-weight: 600; white-space: nowrap; display: inline-block; }
.st-part { background: #ffedd5; color: #c2410c; padding: 2px 6px; border-radius: 4px; font-size: 6.5pt; font-weight: 600; white-space: nowrap; display: inline-block; }
tfoot tr { background: #1e1b4b; }
tfoot td { padding: 7px 5px; color: #fff; border-top: 2px solid #3730a3; }
.fl  { color: #c7d2fe; font-size: 8.5pt; font-weight: 600; }
.flc { color: #6ee7b7; font-size: 8.5pt; font-weight: 700; text-align: right; }
.flu { color: #c4b5fd; font-size: 8.5pt; font-weight: 700; text-align: right; }
.fls { font-size: 6pt; opacity: .8; display: block; margin-bottom: 2px; }
.pf  { margin-top: 8px; font-size: 7pt; color: #9ca3af; text-align: right;
       border-top: 1px solid #e5e7eb; padding-top: 5px; }
</style>
</head>
<body>
<div class="hd">
  <div class="co">Felix Service Management</div>
  <div class="rt">Customer Payment Collection Report</div>
  <div class="mt">
    <span>Period: ${fromStr} – ${toStr}</span>
    <span class="sp">|</span>
    <span>Records: <b>${payments.length}</b></span>
    <span class="sp">|</span>
    <span class="mc">Cash Total: ${cashTot}</span>
    <span class="sp">|</span>
    <span class="mu">UPI Total: ${upiTot}</span>
    <span class="sp">|</span>
    <span class="mg">Grand Total: ${grandTot}</span>
  </div>
</div>
<table>
  <colgroup>
    <col style="width:22px">
    <col style="width:70px">
    <col style="width:78px">
    <col style="width:95px">
    <col style="width:80px">
    <col style="width:52px">
    <col style="width:52px">
    <col style="width:42px">
    <col style="width:62px">
    <col style="width:55px">
    <col style="width:68px">
    <col style="width:58px">
    <col style="width:52px">
    <col style="width:65px">
  </colgroup>
  <thead>
    <tr>
      <th class="tc">#</th>
      <th>Date</th>
      <th>Job Card No</th>
      <th>Customer Name</th>
      <th>Service / Product</th>
      <th class="tr">Bill Amt</th>
      <th class="tr">Advance<span class="ts">Collected</span></th>
      <th class="tr">Disc.</th>
      <th class="tr">Net Payable<span class="ts">Final – Disc</span></th>
      <th class="tr">Final Pmt<span class="ts">Received</span></th>
      <th>Collected By</th>
      <th class="tr">Cash</th>
      <th class="tr">UPI</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="11" class="fl">&#931;&nbsp; Total (${payments.length} records)</td>
      <td class="flc"><span class="fls">Cash</span>${cashTot}</td>
      <td class="flu"><span class="fls">UPI</span>${upiTot}</td>
      <td></td>
    </tr>
  </tfoot>
</table>
<div class="pf">Printed on ${printedOn}&nbsp;&nbsp;·&nbsp;&nbsp;Encryptz ERP</div>
<script>window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1400,height=900');
    if (win) { win.document.write(html); win.document.close(); win.focus(); }
  }

  verifyAll(): void {
    this.filteredPayments()
      .filter(p => !p.isVerified && !this.isVerifying(p.paymentId))
      .forEach(p => this.toggleVerify(p));
  }

  // ── Edit dialog
  edit(p: AdminPayment): void { this.editingPayment.set({ ...p }); }
  onSaved():     void { this.editingPayment.set(null); this.loadAll(); }
  onCancelled(): void { this.editingPayment.set(null); }

  // ── Verify
  isVerifying(id: number): boolean { return this.verifyingIds().has(id); }

  toggleVerify(p: AdminPayment): void {
    if (this.isVerifying(p.paymentId)) return;
    const newVal = !p.isVerified;
    this.verifyingIds.update(s => { const n = new Set(s); n.add(p.paymentId); return n; });
    this.api.verifyPayment(p.paymentId, newVal).subscribe({
      next: () => {
        this.payments.update(list => list.map(x => x.paymentId === p.paymentId
          ? { ...x, isVerified: newVal, verifiedByName: newVal ? 'You' : null, verifiedAt: newVal ? this.toIST(new Date().toISOString()) : null }
          : x));
        this.verifyingIds.update(s => { const n = new Set(s); n.delete(p.paymentId); return n; });
      },
      error: () => this.verifyingIds.update(s => { const n = new Set(s); n.delete(p.paymentId); return n; })
    });
  }

  // ── Comment
  openComment(p: AdminPayment): void { this.commentingId.set(p.paymentId); this.commentDraft = p.remarks ?? ''; }
  cancelComment(): void { this.commentingId.set(null); this.commentDraft = ''; }

  saveComment(p: AdminPayment): void {
    this.savingComment.set(true);
    const draft = this.commentDraft;
    this.api.updatePayment({ ...p, remarks: draft }).subscribe({
      next: () => {
        this.payments.update(list => list.map(x => x.paymentId === p.paymentId ? { ...x, remarks: draft } : x));
        this.savingComment.set(false);
        this.cancelComment();
      },
      error: () => this.savingComment.set(false)
    });
  }

  // ── Pagination
  goToPage(n: number): void { if (n >= 1 && n <= this.totalPages()) this.currentPage.set(n); }
  prevPage(): void { this.goToPage(this.currentPage() - 1); }
  nextPage(): void { this.goToPage(this.currentPage() + 1); }
  startIndex(): number { return (this.currentPage() - 1) * this.pageSize + 1; }
  endIndex():   number { return Math.min(this.currentPage() * this.pageSize, this.filteredPayments().length); }
}
