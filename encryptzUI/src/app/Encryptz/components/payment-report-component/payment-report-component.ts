import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../Services/API/api-service';
import { EditPaymentDialog } from '../edit-payment-dialog/edit-payment-dialog';

interface AdminPayment {
  paymentId: number;
  complaintId: number;
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
  createdByName: string;
}

@Component({
  selector: 'app-payment-report',
  standalone: true,
  imports: [CommonModule, EditPaymentDialog],
  templateUrl: './payment-report-component.html',
  styleUrls: ['./payment-report-component.scss']
})
export class PaymentReportComponent implements OnInit {
  loading        = signal(false);
  payments       = signal<AdminPayment[]>([]);
  editingPayment = signal<AdminPayment | null>(null);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadAll();
  }

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
          createdAt: this.toIST(p.createdAt)
        })));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('[PaymentReport] load error', err);
      }
    });
  }

  /** Convert a UTC datetime string (with or without Z) to IST display string */
  private toIST(raw: any): string {
    if (!raw) return '';
    let str = String(raw).trim();
    // Bare ISO datetime = server UTC without timezone marker — force UTC
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str) && !str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
      str += 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(raw); // already formatted or unparseable
    return d.toLocaleString('en-IN', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    }) + ' IST';
  }

  edit(payment: AdminPayment): void {
    this.editingPayment.set({ ...payment });
  }

  onSaved(): void {
    this.editingPayment.set(null);
    this.loadAll();
  }

  onCancelled(): void {
    this.editingPayment.set(null);
  }
}
