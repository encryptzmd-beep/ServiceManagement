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
  /** the open tab (a signal, so the filtered list below follows it) */
  activeGroup = signal('SLA');
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
  filteredSettings = computed(() => this.settings().filter(s => s.settingGroup === this.activeGroup()));

  constructor(private svc: ApiService) {}
  ngOnInit() { 
    this.loadData(); 
    this.loadPaymentSettings();
  }

  loadData() {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: d => { this.settings.set(d); if (d.length && !d.some(s => s.settingGroup === this.activeGroup())) this.activeGroup.set(d[0].settingGroup); this.loading.set(false); },
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
    if (this.activeGroup() === 'Payments') {
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

  /** "Print.CompanyAddress" -> "Company Address", "COMPLAINT_AUTO_ASSIGN" -> "Complaint Auto Assign" */
  formatKey(key: string): string {
    const name = key.includes('.') ? key.slice(key.indexOf('.') + 1) : key;
    if (name === name.toUpperCase()) return name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    return name.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase());
  }

  /** the control for a row: 'bool' | 'int' | 'time' | 'textarea' | 'image' | 'select' ("select:a,b,c") | 'string' */
  controlType(s: SystemSetting): string {
    const t = (s.dataType || '').toLowerCase();
    return t.startsWith('select') ? 'select' : t;
  }

  /** options of a "select:a,b,c" setting */
  optionsOf(s: SystemSetting): string[] {
    const t = s.dataType || '';
    const i = t.indexOf(':');
    return i < 0 ? [] : t.slice(i + 1).split(',').map(o => o.trim()).filter(Boolean);
  }

  // --- image settings (print header / footer): stored as a data URL in SettingValue ---
  onImagePicked(s: SystemSetting, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { this.showError('Only PNG, JPG or WEBP images can be used'); return; }
    if (file.size > 5 * 1024 * 1024) { this.showError('The image must be smaller than 5 MB'); return; }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxW = 1600;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { this.showError('Could not read the image'); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // PNG keeps transparency (logos); photos go to JPEG to stay small
      const dataUrl = file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88);
      if (dataUrl.length > 1.5 * 1024 * 1024) { this.showError('The image is still too large after scaling. Use a smaller or simpler image.'); return; }
      s.settingValue = dataUrl;
      this.markChanged(s);
    };
    img.onerror = () => { URL.revokeObjectURL(url); this.showError('Could not read the image'); };
    img.src = url;
  }

  clearImage(s: SystemSetting) { s.settingValue = ''; this.markChanged(s); }

  private showSuccess() { this.saveError.set(''); this.saveSuccess.set(true); setTimeout(() => this.saveSuccess.set(false), 3000); }
  private showError(message: string) { this.saveSuccess.set(false); this.saveError.set(message); setTimeout(() => this.saveError.set(''), 5000); }

}
