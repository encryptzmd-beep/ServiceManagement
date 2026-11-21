import { AppRightDirective } from '../shared/app-right/app-right';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CrmMasterDto, CrmMemberDto, LeadSaveDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { TransactionToolbarComponent } from '../shared/transaction-toolbar/transaction-toolbar';
import { FindQuery, FindRow, TransactionFindComponent } from '../shared/transaction-toolbar/transaction-find';
import { CrmLeadFieldsComponent, leadProductsForSave } from './crm-lead-fields';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, isoDate, refusalOf } from '../crm-shell-component/crm-ui';

const blank = (): LeadSaveDto => ({
  leadId: 0, leadDate: isoDate(new Date()), contactName: '', mobile: '', email: '', address: '', city: '', state: '',
  pinCode: '', landmark: '', leadSourceId: null, productCategory: '', productMasterId: null, modelRequirement: '', estimatedQty: null,
  expectedPurchaseDate: null, ownerUserId: null, priority: 'Medium', remarks: '', products: [],
});

/**
 * /crm/leads/new: a new lead; /crm/leads/new?id=5 changes lead 5. A manager may give it to another owner;
 * a sales person's leads are their own. The server checks everything again.
 */
@Component({
  selector: 'app-crm-lead-form',
  standalone: true,
  imports: [AppRightDirective, FormsModule, RouterLink, CrmRefusedComponent, CrmLeadFieldsComponent, TransactionToolbarComponent, TransactionFindComponent],
  templateUrl: './crm-lead-form-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-lead-form-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmLeadFormComponent {
  private crm = inject(CrmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly forbidden = FORBIDDEN;

  form = signal<LeadSaveDto>(blank());
  isManager = signal(false);
  sources = signal<CrmMasterDto[]>([]);
  owners = signal<CrmMemberDto[]>([]);
  productName = signal('');
  error = signal('');
  saving = signal(false);
  /** The number of the lead being changed (empty for a new one). */
  leadNo = signal('');
  findOpen = signal(false);
  findRows = signal<FindRow[]>([]);
  findLoading = signal(false);

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
          this.leadNo.set(l.leadNo);
          this.form.set({
            leadId: l.leadId, leadDate: (l.leadDate ?? '').slice(0, 10), contactName: l.contactName, mobile: l.mobile, email: l.email,
            address: l.address, city: l.city, state: l.state, pinCode: l.pinCode, landmark: l.landmark, leadSourceId: l.leadSourceId ?? null,
            productCategory: l.productCategory, productMasterId: l.productMasterId ?? null, modelRequirement: l.modelRequirement, estimatedQty: l.estimatedQty ?? null,
            expectedPurchaseDate: l.expectedPurchaseDate ? l.expectedPurchaseDate.slice(0, 10) : null, ownerUserId: l.ownerUserId,
            priority: l.priority || 'Medium', remarks: l.remarks, products: l.products ?? [],
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
      expectedPurchaseDate: f.expectedPurchaseDate || null,
      ...leadProductsForSave(f),
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

  /** Toolbar New: a blank lead in this screen. */
  onNew(): void {
    this.router.navigate(['/crm/leads/new'], { replaceUrl: true });
    this.form.set(blank());
    this.productName.set('');
    this.leadNo.set('');
    this.error.set('');
  }

  onFind(): void { this.findRows.set([]); this.findOpen.set(true); }

  onFindSearch(q: FindQuery): void {
    this.findLoading.set(true);
    this.crm.getLeads({ search: q.term || undefined, from: q.from || undefined, to: q.to || undefined, page: 1, pageSize: 30 }).subscribe({
      next: res => {
        this.findLoading.set(false);
        this.findRows.set((res.success ? res.data?.items ?? [] : []).map(l => ({
          id: l.leadId, number: l.leadNo, date: l.leadDate, party: l.contactName, amount: 0, status: l.status,
        })));
      },
      error: () => { this.findLoading.set(false); this.findRows.set([]); },
    });
  }

  onFindPick(id: number): void {
    this.findOpen.set(false);
    this.router.navigate(['/crm/leads', id]);
  }

  cancel(): void {
    const id = this.form().leadId;
    this.router.navigate(id ? ['/crm/leads', id] : ['/crm/leads']);
  }
}
