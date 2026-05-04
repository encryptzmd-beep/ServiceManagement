import { Component, Input, Output, EventEmitter, inject, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';

@Component({
  selector: 'app-edit-payment-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-payment-dialog.html',
  styleUrls: ['./edit-payment-dialog.scss']
})
export class EditPaymentDialog implements OnChanges {
  @Input() payment: any = null;
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private api = inject(ApiService);
  private fb  = inject(FormBuilder);

  form = this.fb.group({
    serviceChargeAmount:  [0, [Validators.required, Validators.min(0)]],
    sparePartsAmount:     [0, [Validators.required, Validators.min(0)]],
    discountAmount:       [0, [Validators.required, Validators.min(0)]],
    amountPaid:           [0, [Validators.required, Validators.min(0)]],
    paymentMethod:        ['Cash', Validators.required],
    paymentStatus:        ['Success', Validators.required],
    transactionReference: [''],
    remarks:              [''],
    adminPassword:        ['', Validators.required]
  });

  loading  = false;
  errorMsg = '';

  ngOnChanges(): void {
    if (this.payment) {
      const p = this.payment;
      this.form.patchValue({
        serviceChargeAmount:  p.serviceChargeAmount,
        sparePartsAmount:     p.sparePartsAmount,
        discountAmount:       p.discountAmount,
        amountPaid:           p.amountPaid,
        paymentMethod:        p.paymentMethod,
        paymentStatus:        p.paymentStatus,
        transactionReference: p.transactionReference ?? '',
        remarks:              p.remarks ?? ''
      });
      this.form.get('adminPassword')?.reset('');
      this.errorMsg = '';
    }
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading  = true;
    this.errorMsg = '';

    const payload = {
      paymentId:            this.payment.paymentId,
      serviceChargeAmount:  this.form.value.serviceChargeAmount,
      sparePartsAmount:     this.form.value.sparePartsAmount,
      discountAmount:       this.form.value.discountAmount,
      amountPaid:           this.form.value.amountPaid,
      paymentMethod:        this.form.value.paymentMethod,
      paymentStatus:        this.form.value.paymentStatus,
      transactionReference: this.form.value.transactionReference,
      remarks:              this.form.value.remarks,
      adminPassword:        this.form.value.adminPassword
    };

    this.api.updatePayment(payload).subscribe({
      next: () => {
        this.loading = false;
        this.saved.emit();
      },
      error: (err) => {
        this.loading  = false;
        this.errorMsg = err?.error?.Message || 'Update failed';
      }
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
