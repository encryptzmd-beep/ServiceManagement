import { AppRightDirective } from '../shared/app-right/app-right';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CrmMasterDto, CrmMasterKind, CrmMemberDto, CrmUserOptionDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, refusalOf } from '../crm-shell-component/crm-ui';
import {
  QUOTATION_PRICES_KEY, QUOTATION_PRICE_CHOICES, QUOTATION_VALIDITY_CHOICES, QUOTATION_VALIDITY_KEY,
} from '../shared/quotation-defaults';

/** /crm/settings (managers): quotation defaults, the lead sources, the lost reasons, and who is on the sales team. */
@Component({
  selector: 'app-crm-settings',
  standalone: true,
  imports: [AppRightDirective, FormsModule, CrmRefusedComponent],
  templateUrl: './crm-settings-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-settings-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmSettingsComponent {
  private crm = inject(CrmService);

  readonly forbidden = FORBIDDEN;
  readonly lists: { kind: CrmMasterKind; title: string; hint: string }[] = [
    { kind: 'sources', title: 'Lead sources', hint: 'Where a lead came from.' },
    { kind: 'lost-reasons', title: 'Lost reasons', hint: 'Why a lead was lost; one is asked when a lead is marked lost.' },
  ];

  masters = signal<Record<string, CrmMasterDto[]>>({ sources: [], 'lost-reasons': [] });
  drafts = signal<Record<string, string>>({ sources: '', 'lost-reasons': '' });
  members = signal<CrmMemberDto[]>([]);
  available = signal<CrmUserOptionDto[]>([]);
  newMemberId = signal<number | null>(null);
  newMemberManager = signal(false);
  error = signal('');
  notice = signal('');

  // ── quotation defaults: what a new quotation starts with ──
  readonly validityChoices = QUOTATION_VALIDITY_CHOICES;
  readonly priceChoices = QUOTATION_PRICE_CHOICES;
  validity = signal('none');
  prices = signal('exclusive');
  private savedDefaults = signal({ validity: 'none', prices: 'exclusive' });
  defaultsLoaded = signal(false);
  savingDefaults = signal(false);
  readonly defaultsChanged = computed(() =>
    this.validity() !== this.savedDefaults().validity || this.prices() !== this.savedDefaults().prices);

  constructor() {
    this.loadDefaults();
    for (const l of this.lists) this.loadMasters(l.kind);
    this.loadMembers();
  }

  loadDefaults(): void {
    this.crm.getPrintSettings().subscribe({
      next: res => {
        const d = res?.data ?? {};
        const validity = (d[QUOTATION_VALIDITY_KEY] || 'none').trim().toLowerCase();
        const prices = (d[QUOTATION_PRICES_KEY] || 'exclusive').trim().toLowerCase();
        this.savedDefaults.set({ validity, prices });
        this.validity.set(validity);
        this.prices.set(prices);
        this.defaultsLoaded.set(true);
      },
      error: err => { this.defaultsLoaded.set(true); this.fail(err); },
    });
  }

  saveDefaults(): void {
    this.savingDefaults.set(true);
    this.crm.saveQuotationDefaults({ validity: this.validity(), prices: this.prices() }).subscribe({
      next: res => {
        this.savingDefaults.set(false);
        this.done(res, 'Quotation defaults saved', () => this.savedDefaults.set({ validity: this.validity(), prices: this.prices() }));
      },
      error: err => { this.savingDefaults.set(false); this.error.set(err?.error?.message || refusalOf(err)); },
    });
  }

  private fail(err: unknown): void {
    this.error.set(refusalOf(err));
  }

  loadMasters(kind: CrmMasterKind): void {
    this.crm.getMasters(kind).subscribe({
      next: res => {
        if (!res.success) { this.error.set(res.message); return; }
        const list = [...(res.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
        this.masters.update(m => ({ ...m, [kind]: list }));
      },
      error: err => this.fail(err),
    });
  }

  loadMembers(): void {
    this.crm.getMembers().subscribe({
      next: res => {
        if (!res.success) { this.error.set(res.message); return; }
        this.members.set(res.data?.members ?? []);
        this.available.set(res.data?.available ?? []);
      },
      error: err => this.fail(err),
    });
  }

  setDraft(kind: string, value: string): void {
    this.drafts.update(d => ({ ...d, [kind]: value }));
  }

  private done(res: { success: boolean; message: string }, what: string, reload: () => void): void {
    if (res.success) { this.error.set(''); this.notice.set(what); reload(); }
    else this.error.set(res.message || 'It could not be saved');
  }

  addMaster(kind: CrmMasterKind, name: string): void {
    const clean = (name ?? '').trim();
    if (!clean) return;
    const list = this.masters()[kind] ?? [];
    const sortOrder = list.reduce((max, m) => Math.max(max, m.sortOrder), 0) + 1;
    this.crm.saveMaster(kind, { id: 0, name: clean, sortOrder, isActive: true }).subscribe({
      next: res => this.done(res, `${clean} added`, () => { this.setDraft(kind, ''); this.loadMasters(kind); }),
      error: err => this.fail(err),
    });
  }

  saveMaster(kind: CrmMasterKind, m: CrmMasterDto, change: Partial<CrmMasterDto>): void {
    const dto = { ...m, ...change, name: (change.name ?? m.name).trim() };
    if (!dto.name) { this.loadMasters(kind); return; }
    this.crm.saveMaster(kind, dto).subscribe({
      next: res => this.done(res, `${dto.name} saved`, () => this.loadMasters(kind)),
      error: err => this.fail(err),
    });
  }

  addMember(userId: number | null, isManager: boolean): void {
    const user = this.available().find(u => u.userId === Number(userId));
    if (!user) return;
    this.crm.saveMember({ userId: user.userId, fullName: user.fullName, isManager, isActive: true }).subscribe({
      next: res => this.done(res, `${user.fullName} added to the team`, () => {
        this.newMemberId.set(null); this.newMemberManager.set(false); this.loadMembers();
      }),
      error: err => this.fail(err),
    });
  }

  saveMember(m: CrmMemberDto, change: Partial<CrmMemberDto>): void {
    const dto = { ...m, ...change };
    this.crm.saveMember(dto).subscribe({
      next: res => this.done(res, `${m.fullName} saved`, () => this.loadMembers()),
      error: err => this.fail(err),
    });
  }

  checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
