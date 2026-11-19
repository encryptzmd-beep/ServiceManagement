import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CrmMasterDto, CrmMemberDto, LeadSaveDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmProductPickerComponent } from '../crm-shell-component/crm-product-picker-component';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, isoDate, refusalOf } from '../crm-shell-component/crm-ui';

const blank = (): LeadSaveDto => ({
  leadId: 0, leadDate: isoDate(new Date()), contactName: '', mobile: '', email: '', address: '', city: '', state: '',
  pinCode: '', landmark: '', leadSourceId: null, productCategory: '', productMasterId: null, modelRequirement: '', estimatedQty: null,
  expectedPurchaseDate: null, ownerUserId: null, priority: 'Medium', remarks: '',
});

/**
 * /crm/leads/new: a new lead; /crm/leads/new?id=5 changes lead 5. A manager may give it to another owner;
 * a sales person's leads are their own. The server checks everything again.
 */
@Component({
  selector: 'app-crm-lead-form',
  standalone: true,
  imports: [FormsModule, RouterLink, CrmRefusedComponent, CrmProductPickerComponent],
  templateUrl: './crm-lead-form-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-lead-form-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmLeadFormComponent {
  private crm = inject(CrmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly forbidden = FORBIDDEN;
  readonly priorities = ['Low', 'Medium', 'High'];

  form = signal<LeadSaveDto>(blank());
  isManager = signal(false);
  sources = signal<CrmMasterDto[]>([]);
  owners = signal<CrmMemberDto[]>([]);
  productName = signal('');
  error = signal('');
  saving = signal(false);

  constructor() {
    const id = Number(this.route.snapshot.queryParamMap.get('id') ?? 0);
    this.crm.me().subscribe({ next: res => {
      const manager = !!(res.success && res.data?.isManager);
      this.isManager.set(manager);
      if (manager) this.crm.getMembers().subscribe({
        next: m => this.owners.set(m.success ? (m.data?.members ?? []).filter(x => x.isActive) : []), error: () => {},
      });
    }, error: err => this.fail(err) });
    this.crm.getMasters('sources').subscribe({
      next: res => this.sources.set(res.success ? (res.data ?? []).filter(s => s.isActive) : []), error: () => {},
    });
    if (id > 0) {
      this.crm.getLead(id).subscribe({
        next: res => {
          const l = res.data;
          if (!res.success || !l) { this.error.set(res.message || 'Lead not found'); return; }
          this.productName.set(l.productName ?? '');
          this.form.set({
            leadId: l.leadId, leadDate: (l.leadDate ?? '').slice(0, 10), contactName: l.contactName, mobile: l.mobile, email: l.email,
            address: l.address, city: l.city, state: l.state, pinCode: l.pinCode, landmark: l.landmark, leadSourceId: l.leadSourceId ?? null,
            productCategory: l.productCategory, productMasterId: l.productMasterId ?? null, modelRequirement: l.modelRequirement, estimatedQty: l.estimatedQty ?? null,
            expectedPurchaseDate: l.expectedPurchaseDate ? l.expectedPurchaseDate.slice(0, 10) : null, ownerUserId: l.ownerUserId,
            priority: l.priority || 'Medium', remarks: l.remarks,
          });
        },
        error: err => this.fail(err),
      });
    }
  }

  private fail(err: unknown): void {
    this.error.set(refusalOf(err));
  }

  set<K extends keyof LeadSaveDto>(key: K, value: LeadSaveDto[K]): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  save(): void {
    const f = this.form();
    if (!f.contactName?.trim()) { this.error.set('Enter the contact name'); return; }
    if ((f.mobile ?? '').replace(/\D/g, '').length < 10) { this.error.set('Enter a valid 10-digit mobile number'); return; }
    this.error.set('');
    this.saving.set(true);
    const dto: LeadSaveDto = {
      ...f,
      leadSourceId: f.leadSourceId ? Number(f.leadSourceId) : null,
      ownerUserId: f.ownerUserId ? Number(f.ownerUserId) : null,
      estimatedQty: f.estimatedQty ? Number(f.estimatedQty) : null,
      expectedPurchaseDate: f.expectedPurchaseDate || null,
    };
    this.crm.saveLead(dto).subscribe({
      next: res => {
        this.saving.set(false);
        if (res.success && res.data) this.router.navigate(['/crm/leads', res.data]);
        else this.error.set(res.message || 'The lead could not be saved');
      },
      error: err => { this.saving.set(false); this.fail(err); },
    });
  }

  cancel(): void {
    const id = this.form().leadId;
    this.router.navigate(id ? ['/crm/leads', id] : ['/crm/leads']);
  }
}
