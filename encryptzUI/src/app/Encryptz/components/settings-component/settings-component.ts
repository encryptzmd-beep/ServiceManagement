import { Component, computed, signal } from '@angular/core';
import { SettingUpdateDto, SystemSetting } from '../../Models/ApiModels';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';

@Component({
  selector: 'app-settings-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-component.html',
  styleUrl: './settings-component.scss',
})
export class SettingsComponent {
  settings = signal<SystemSetting[]>([]);
  loading = signal(true);
  saveSuccess = signal(false);
  saveError = signal('');
  activeGroup = 'SLA';
  changedIds = new Set<number>();
  
  // Payment specific state
  defaultServiceCharge = signal<number>(0);
  upiConfigurations = signal<any[]>([]);
  showAddUpiModal = signal(false);
  newUpi = { upiId: '', displayName: '' };
  paymentsLoading = signal(false);
  upiError = signal('');
  savingUpi = signal(false);
  /** Row waiting for "Delete? Yes / No" (asked in the page, not with a browser dialog). */
  confirmDeleteUpiId = signal<number | null>(null);

  // name@bank, e.g. shop.name@okhdfcbank (the API checks the same)
  private static readonly UPI_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

  groups = computed(() => [...new Set(this.settings().map(s => s.settingGroup)), 'Payments']);
  filteredSettings = computed(() => this.settings().filter(s => s.settingGroup === this.activeGroup));

  constructor(private svc: ApiService) {}
  ngOnInit() { 
    this.loadData(); 
    this.loadPaymentSettings();
  }

  loadData() {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: d => { this.settings.set(d); if(d.length) this.activeGroup=d[0].settingGroup; this.loading.set(false); },
      error: () => { this.settings.set([]); this.loading.set(false); }
    });
  }

  hasChanges(): boolean { return this.changedIds.size > 0; }
  markChanged(s: SystemSetting) { this.changedIds.add(s.settingId); }

  onToggle(s: SystemSetting, e: Event) {
    s.settingValue = (e.target as HTMLInputElement).checked ? 'true' : 'false';
    this.markChanged(s);
  }

  saveAll() {
    if (this.activeGroup === 'Payments') {
      const charge = Number(this.defaultServiceCharge());
      if (!Number.isFinite(charge) || charge < 0) {
        this.showError('Default service charge must be zero or more');
        return;
      }
      this.svc.updateDefaultServiceCharge(charge).subscribe({
        next: () => this.showSuccess(),
        error: () => this.showError('Failed to save the service charge')
      });
      return;
    }

    const updates: SettingUpdateDto[] = this.settings().filter(s => this.changedIds.has(s.settingId)).map(s => ({ settingId: s.settingId, settingValue: s.settingValue }));
    if (updates.length === 0) { this.showSuccess(); return; }
    this.svc.bulkUpdate(updates).subscribe({
      next: () => { this.changedIds.clear(); this.showSuccess(); },
      // the changes stay marked, so "Save" can be pressed again
      error: () => this.showError('The settings could not be saved. Please try again.')
    });
  }

  // --- Payment Methods ---
  loadPaymentSettings() {
    this.paymentsLoading.set(true);
    this.svc.getDefaultServiceCharge().subscribe({
      next: (res) => this.defaultServiceCharge.set(res.data),
      error: () => {}
    });
    this.loadUpiConfigs();
  }

  loadUpiConfigs() {
    this.svc.getUPIConfigurations().subscribe({
      next: (res) => { this.upiConfigurations.set(res?.data ?? []); this.paymentsLoading.set(false); },
      error: () => this.paymentsLoading.set(false)
    });
  }

  openAddUpi() {
    this.newUpi = { upiId: '', displayName: '' };
    this.upiError.set('');
    this.showAddUpiModal.set(true);
  }

  isValidUpiId(value: string): boolean {
    return SettingsComponent.UPI_ID.test((value || '').trim());
  }

  addUpi() {
    const upiId = (this.newUpi.upiId || '').trim();
    const displayName = (this.newUpi.displayName || '').trim();
    if (!displayName) { this.upiError.set('Display name is required'); return; }
    if (!this.isValidUpiId(upiId)) { this.upiError.set('Enter a valid UPI ID in the form name@bank'); return; }

    this.savingUpi.set(true);
    this.upiError.set('');
    this.svc.addUPIConfiguration({ upiId, displayName }).subscribe({
      next: (res: any) => {
        this.savingUpi.set(false);
        if (res?.success === false) { this.upiError.set(res.message || 'Failed to add the UPI ID'); return; }
        this.showAddUpiModal.set(false);
        this.newUpi = { upiId: '', displayName: '' };
        this.loadUpiConfigs();
        this.showSuccess();
      },
      error: (err) => {
        this.savingUpi.set(false);
        this.upiError.set(err?.error?.message || 'Failed to add the UPI ID');
      }
    });
  }

  setDefaultUpi(id: number) {
    this.svc.setDefaultUPI(id).subscribe({
      next: () => { this.loadUpiConfigs(); this.showSuccess(); },
      error: () => this.showError('Failed to set the default UPI')
    });
  }

  toggleUpiStatus(id: number) {
    this.svc.toggleUPIStatus(id).subscribe({
      next: () => { this.loadUpiConfigs(); this.showSuccess(); },
      error: () => this.showError('Failed to change the UPI status')
    });
  }

  askDeleteUpi(id: number) { this.confirmDeleteUpiId.set(id); }
  cancelDeleteUpi() { this.confirmDeleteUpiId.set(null); }

  deleteUpi(id: number) {
    this.confirmDeleteUpiId.set(null);
    this.svc.deleteUPIConfiguration(id).subscribe({
      next: () => {
        this.upiConfigurations.update(list => (list ?? []).filter(u => u.id !== id));   // gone at once
        this.loadUpiConfigs();
        this.showSuccess();
      },
      error: () => this.showError('Failed to delete the UPI ID')
    });
  }

  formatKey(key: string): string { return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

  private showSuccess() { this.saveError.set(''); this.saveSuccess.set(true); setTimeout(() => this.saveSuccess.set(false), 3000); }
  private showError(message: string) { this.saveSuccess.set(false); this.saveError.set(message); setTimeout(() => this.saveError.set(''), 5000); }

}
