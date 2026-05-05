import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';

@Component({
  selector: 'app-payment-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-settings-component.html',
  styleUrls: ['./payment-settings-component.scss']
})
export class PaymentSettingsComponent implements OnInit {
  private api = inject(ApiService);

  loading        = signal(true);
  savingCharge   = signal(false);
  savingUpi      = signal(false);
  toastMsg       = signal('');
  toastErr       = signal(false);
  showToast      = signal(false);

  // Service charge
  serviceCharge  = signal<number>(0);
  chargeInput    = 0;

  // UPI list
  upiList        = signal<any[]>([]);

  // Add UPI form
  showAddForm    = signal(false);
  newUpi  = { upiId: '', displayName: '' };

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loading.set(true);
    this.api.getDefaultServiceCharge().subscribe({
      next: (res: any) => {
        const v = Number(res?.data ?? res ?? 0) || 0;
        this.serviceCharge.set(v);
        this.chargeInput = v;
      },
      error: () => {}
    });
    this.api.getUPIConfigurations().subscribe({
      next: (res: any) => {
        this.upiList.set(Array.isArray(res?.data) ? res.data : []);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); }
    });
  }

  saveCharge() {
    if (this.chargeInput < 0) { this.toast('Amount must be 0 or more', true); return; }
    this.savingCharge.set(true);
    this.api.updateDefaultServiceCharge(this.chargeInput).subscribe({
      next: (r: any) => {
        this.savingCharge.set(false);
        if (r?.Success ?? r?.success ?? true) {
          this.serviceCharge.set(this.chargeInput);
          this.toast('Service charge updated');
        } else {
          this.toast(r?.Message || 'Update failed', true);
        }
      },
      error: () => { this.savingCharge.set(false); this.toast('Error updating service charge', true); }
    });
  }

  addUpi() {
    if (!this.newUpi.upiId.trim() || !this.newUpi.displayName.trim()) {
      this.toast('UPI ID and display name are required', true); return;
    }
    this.savingUpi.set(true);
    this.api.addUPIConfiguration({ upiId: this.newUpi.upiId.trim(), displayName: this.newUpi.displayName.trim() }).subscribe({
      next: (r: any) => {
        this.savingUpi.set(false);
        if (r?.Success ?? r?.success ?? true) {
          this.toast('UPI added');
          this.newUpi = { upiId: '', displayName: '' };
          this.showAddForm.set(false);
          this.loadAll();
        } else {
          this.toast(r?.Message || 'Failed to add UPI', true);
        }
      },
      error: () => { this.savingUpi.set(false); this.toast('Error adding UPI', true); }
    });
  }

  setDefault(id: number) {
    this.api.setDefaultUPI(id).subscribe({
      next: () => { this.toast('Default UPI updated'); this.loadAll(); },
      error: () => this.toast('Error setting default', true)
    });
  }

  toggle(id: number) {
    this.api.toggleUPIStatus(id).subscribe({
      next: () => { this.toast('UPI status toggled'); this.loadAll(); },
      error: () => this.toast('Error toggling UPI', true)
    });
  }

  deleteUpi(id: number) {
    if (!confirm('Delete this UPI configuration?')) return;
    this.api.deleteUPIConfiguration(id).subscribe({
      next: () => { this.toast('UPI deleted'); this.loadAll(); },
      error: () => this.toast('Error deleting UPI', true)
    });
  }

  private toast(msg: string, err = false) {
    this.toastMsg.set(msg);
    this.toastErr.set(err);
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 2800);
  }
}
