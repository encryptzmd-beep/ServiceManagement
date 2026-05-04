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
  activeGroup = 'SLA';
  changedIds = new Set<number>();
  
  // Payment specific state
  defaultServiceCharge = signal<number>(0);
  upiConfigurations = signal<any[]>([]);
  showAddUpiModal = signal(false);
  newUpi = { upiId: '', displayName: '' };
  paymentsLoading = signal(false);

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
      error: () => { this.loadDemo(); this.loading.set(false); }
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
      this.svc.updateDefaultServiceCharge(this.defaultServiceCharge()).subscribe({
        next: () => this.showSuccess(),
        error: () => alert('Failed to save service charge')
      });
      return;
    }

    const updates: SettingUpdateDto[] = this.settings().filter(s => this.changedIds.has(s.settingId)).map(s => ({ settingId: s.settingId, settingValue: s.settingValue }));
    this.svc.bulkUpdate(updates).subscribe({
      next: () => { this.changedIds.clear(); this.showSuccess(); },
      error: () => { this.changedIds.clear(); this.showSuccess(); }
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
      next: (res) => { this.upiConfigurations.set(res.data); this.paymentsLoading.set(false); },
      error: () => this.paymentsLoading.set(false)
    });
  }

  addUpi() {
    if (!this.newUpi.upiId || !this.newUpi.displayName) return;
    this.svc.addUPIConfiguration(this.newUpi).subscribe({
      next: () => {
        this.showAddUpiModal.set(false);
        this.newUpi = { upiId: '', displayName: '' };
        this.loadUpiConfigs();
        this.showSuccess();
      },
      error: () => alert('Failed to add UPI')
    });
  }

  setDefaultUpi(id: number) {
    this.svc.setDefaultUPI(id).subscribe({
      next: () => { this.loadUpiConfigs(); this.showSuccess(); },
      error: () => alert('Failed to set default UPI')
    });
  }

  toggleUpiStatus(id: number) {
    this.svc.toggleUPIStatus(id).subscribe({
      next: () => { this.loadUpiConfigs(); this.showSuccess(); },
      error: () => alert('Failed to toggle UPI status')
    });
  }

  deleteUpi(id: number) {
    if (!confirm('Are you sure you want to delete this UPI ID?')) return;
    this.svc.deleteUPIConfiguration(id).subscribe({
      next: () => { this.loadUpiConfigs(); this.showSuccess(); },
      error: () => alert('Failed to delete UPI')
    });
  }

  formatKey(key: string): string { return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

  private showSuccess() { this.saveSuccess.set(true); setTimeout(() => this.saveSuccess.set(false), 3000); }

  private loadDemo() {
    this.settings.set([
      { settingId:1,settingKey:'SLA_DEFAULT_HOURS',settingValue:'24',settingGroup:'SLA',dataType:'int',description:'Default SLA resolution time in hours',isEditable:true,modifiedDate:'' },
      { settingId:2,settingKey:'SLA_CRITICAL_HOURS',settingValue:'4',settingGroup:'SLA',dataType:'int',description:'Critical priority SLA hours',isEditable:true,modifiedDate:'' },
      { settingId:3,settingKey:'MAX_DAILY_ASSIGNMENTS',settingValue:'8',settingGroup:'Schedule',dataType:'int',description:'Max daily assignments per technician',isEditable:true,modifiedDate:'' },
      { settingId:4,settingKey:'WORKING_HOURS_START',settingValue:'09:00',settingGroup:'Schedule',dataType:'time',description:'Working hours start time',isEditable:true,modifiedDate:'' },
      { settingId:5,settingKey:'WORKING_HOURS_END',settingValue:'18:00',settingGroup:'Schedule',dataType:'time',description:'Working hours end time',isEditable:true,modifiedDate:'' },
      { settingId:6,settingKey:'GPS_TRACKING_INTERVAL',settingValue:'30',settingGroup:'Tracking',dataType:'int',description:'GPS tracking interval in seconds',isEditable:true,modifiedDate:'' },
      { settingId:7,settingKey:'WARRANTY_DEFAULT_MONTHS',settingValue:'12',settingGroup:'Warranty',dataType:'int',description:'Default warranty period in months',isEditable:true,modifiedDate:'' },
      { settingId:8,settingKey:'NOTIFICATION_EMAIL_ENABLED',settingValue:'true',settingGroup:'Notification',dataType:'bool',description:'Enable email notifications',isEditable:true,modifiedDate:'' },
      { settingId:9,settingKey:'NOTIFICATION_SMS_ENABLED',settingValue:'false',settingGroup:'Notification',dataType:'bool',description:'Enable SMS notifications',isEditable:true,modifiedDate:'' },
      { settingId:10,settingKey:'COMPLAINT_AUTO_ASSIGN',settingValue:'false',settingGroup:'Complaint',dataType:'bool',description:'Auto-assign complaints to technicians',isEditable:true,modifiedDate:'' },
      { settingId:11,settingKey:'CUSTOMER_PORTAL_ENABLED',settingValue:'true',settingGroup:'Portal',dataType:'bool',description:'Enable customer portal access',isEditable:true,modifiedDate:'' },
    ]);
    this.activeGroup = 'SLA';
  }
}
