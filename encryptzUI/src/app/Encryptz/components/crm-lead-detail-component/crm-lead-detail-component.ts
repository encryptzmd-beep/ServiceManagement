import { AppRightDirective } from '../shared/app-right/app-right';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ConvertResultDto, CrmMasterDto, CrmMemberDto, FollowUpSaveDto, LEAD_STATUSES, LeadDetailDto, LeadSaveDto, QuotationSummaryDto,
} from '../../Models/CrmModels';
import { CrmLeadFieldsComponent } from '../crm-lead-form-component/crm-lead-fields';
import { TransactionMode, TransactionToolbarComponent } from '../shared/transaction-toolbar/transaction-toolbar';
import { FindQuery, FindRow, TransactionFindComponent } from '../shared/transaction-toolbar/transaction-find';
import { DialogService } from '../../Services/dialog-service';
import { CrmService } from '../../Services/crm-service';
import { CrmConvertDialogComponent } from '../crm-shell-component/crm-convert-dialog-component';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, amount, isoDateTime, pill, refusalOf, showDate, showDateTime } from '../crm-shell-component/crm-ui';

type Dialog = 'followup' | 'status' | 'lost' | 'reassign' | 'convert' | 'link' | 'cancel-convert' | null;
type Tab = 'timeline' | 'quotations';

interface TimelineEntry { key: string; at: string; kind: 'followup' | 'status'; title: string; text: string; by: string; next?: string; }

export const FOLLOW_UP_TYPES = ['Phone Call', 'Meeting', 'Site Visit', 'WhatsApp', 'Email', 'Other'];
export { PAYMENT_MODES } from '../crm-shell-component/crm-convert-dialog-component';
const OPEN_FOR_CONVERT = ['Quotation', 'Negotiation'];

/**
 * /crm/leads/:id: the lead, its timeline and quotations, and what may be done with it: a follow-up, a change of
 * status, lost, reassign (managers), a new quotation and the convert to a sales order. Converted and Lost leads
 * are read-only; a manager may reopen a lost one. The server decides; the page only hides what cannot apply.
 */
@Component({
  selector: 'app-crm-lead-detail',
  standalone: true,
  imports: [AppRightDirective, FormsModule, RouterLink, CrmRefusedComponent, CrmConvertDialogComponent, CrmLeadFieldsComponent, TransactionToolbarComponent, TransactionFindComponent],
  templateUrl: './crm-lead-detail-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-lead-detail-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmLeadDetailComponent {
  private crm = inject(CrmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private confirmDialog = inject(DialogService);

  readonly forbidden = FORBIDDEN;
  readonly followUpTypes = FOLLOW_UP_TYPES;
  readonly pill = pill;
  readonly amount = amount;
  readonly showDate = showDate;
  readonly showDateTime = showDateTime;

  /** The lead shown; Find replaces it in this same screen. */
  leadId = Number(this.route.snapshot.paramMap.get('id') ?? 0);

  lead = signal<LeadDetailDto | null>(null);
  error = signal('');
  notice = signal('');
  /** A refusal of an action taken without a dialog (reopen). */
  pageError = signal('');
  isManager = signal(false);
  lostReasons = signal<CrmMasterDto[]>([]);
  owners = signal<CrmMemberDto[]>([]);
  tab = signal<Tab>('timeline');
  sources = signal<CrmMasterDto[]>([]);

  // ── toolbar (New · Edit · Save · Print · Find), as on the quotation ──
  /** The lead opens read-only; Edit turns the two cards into inputs. */
  editing = signal(false);
  editForm = signal<LeadSaveDto | null>(null);
  editProductName = signal('');
  readonly mode = computed<TransactionMode>(() => this.editing() ? 'edit' : 'view');
  findOpen = signal(false);
  findRows = signal<FindRow[]>([]);
  findLoading = signal(false);

  /** The lead as the cards show it: the edit in progress, or the saved lead. */
  readonly fieldsForm = computed<LeadSaveDto | null>(() => this.editForm() ?? (this.lead() ? this.toSave(this.lead()!) : null));

  dialog = signal<Dialog>(null);
  dialogError = signal('');
  busy = signal(false);

  followUp = signal<FollowUpSaveDto>(this.blankFollowUp());
  statusTo = signal('');
  statusNote = signal('');
  lostReasonId = signal<number | null>(null);
  newOwner = signal<number | null>(null);
  orderNo = signal('');

  /** The quotation the convert dialog opens with; null is the most recently changed of `convertible`. */
  convertQuotationId = signal<number | null>(null);

  readonly isClosed = computed(() => ['Converted', 'Lost'].includes(this.lead()?.status ?? ''));

  /** What needs the owner's eye on an open lead: an overdue or due-today follow-up, or none planned. */
  readonly attention = computed<{ label: string; tone: 'red' | 'amber' }[]>(() => {
    const l = this.lead();
    if (!l || this.isClosed()) return [];
    if (!l.nextFollowUpAt) return [{ label: 'No next follow-up', tone: 'amber' }];
    const at = new Date(l.nextFollowUpAt);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    if (at < start) return [{ label: 'Overdue follow-up', tone: 'red' }];
    if (at < end) return [{ label: 'Follow-up today', tone: 'amber' }];
    return [];
  });

  /** The latest revisions that may still become an order (a superseded one never). */
  readonly convertible = computed<QuotationSummaryDto[]>(() =>
    (this.lead()?.quotations ?? []).filter(q => q.isLatest && (q.status === 'Draft' || q.status === 'Sent')));

  readonly canConvert = computed(() => {
    const l = this.lead();
    return !!l && !l.salesOrderId && !l.convertNeedsCheck && OPEN_FOR_CONVERT.includes(l.status) && this.convertible().length > 0;
  });

  /**
   * A convert whose order call failed leaves it unknown whether the order was made: the server flags the lead
   * (convertNeedsCheck) and blocks it until a manager checks the sales orders.
   */
  readonly needsCheck = computed(() => {
    const l = this.lead();
    return !!l && !!l.convertNeedsCheck && !l.salesOrderId;
  });

  /** The manager links the order that was made, or cancels the convert when none was. */
  readonly canLinkOrder = computed(() => this.isManager() && this.needsCheck());
  readonly canCancelConvert = computed(() => this.isManager() && this.needsCheck());

  /** The quotation a linked order belongs to: the latest non-superseded revision, most recently changed. */
  readonly linkQuotationId = computed<number | null>(() => {
    const list = (this.lead()?.quotations ?? []).filter(q => q.isLatest && q.status !== 'Superseded');
    return [...list].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]?.quotationId ?? null;
  });

  /** The statuses a person may move an open lead to by hand. */
  readonly statusChoices = computed(() =>
    LEAD_STATUSES.filter(s => s !== 'Converted' && s !== 'Lost' && s !== this.lead()?.status));

  readonly timeline = computed<TimelineEntry[]>(() => {
    const l = this.lead();
    if (!l) return [];
    const entries: TimelineEntry[] = [
      ...l.followUps.map(f => ({
        key: 'f' + f.followUpId, at: f.followUpAt, kind: 'followup' as const, title: f.type,
        text: [f.notes, f.remarks].filter(Boolean).join(' · '), by: f.userName,
        next: f.nextFollowUpAt ? `Next: ${showDateTime(f.nextFollowUpAt)}${f.nextAction ? ' · ' + f.nextAction : ''}` : undefined,
      })),
      ...l.history.map(h => ({
        key: 'h' + h.leadStatusHistoryId, at: h.changedAt, kind: 'status' as const,
        title: h.fromStatus && h.fromStatus !== h.toStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus,
        text: h.note, by: h.changedByName,
      })),
    ];
    return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  });

  constructor() {
    this.load();
    this.crm.me().subscribe({ next: res => {
      const manager = !!(res.success && res.data?.isManager);
      this.isManager.set(manager);
      if (manager) this.crm.getMembers().subscribe({
        next: m => this.owners.set(m.success ? (m.data?.members ?? []).filter(x => x.isActive) : []), error: () => {},
      });
    }, error: () => {} });
    this.crm.getMasters('sources').subscribe({
      next: res => this.sources.set(res.success ? (res.data ?? []).filter(s => s.isActive) : []), error: () => {},
    });
    this.crm.getMasters('lost-reasons').subscribe({
      next: res => this.lostReasons.set(res.success ? (res.data ?? []).filter(r => r.isActive) : []), error: () => {},
    });
  }

  /** The non-empty parts, comma separated. */
  join(...parts: (string | null | undefined)[]): string {
    return parts.filter(p => !!p && p.trim()).join(', ');
  }

  load(): void {
    this.crm.getLead(this.leadId).subscribe({
      next: res => {
        if (res.success && res.data) { this.lead.set(res.data); this.error.set(''); }
        else this.error.set(res.message || 'Lead not found');
      },
      error: err => this.error.set(refusalOf(err)),
    });
  }

  private blankFollowUp(): FollowUpSaveDto {
    return { followUpAt: isoDateTime(new Date()), type: 'Phone Call', notes: '', nextFollowUpAt: null, nextAction: '', remarks: '' };
  }

  open(d: Exclude<Dialog, null>): void {
    this.dialogError.set('');
    this.busy.set(false);
    if (d === 'followup') this.followUp.set(this.blankFollowUp());
    if (d === 'status') { this.statusTo.set(this.statusChoices()[0] ?? ''); this.statusNote.set(''); }
    if (d === 'lost') { this.lostReasonId.set(null); this.statusNote.set(''); }
    if (d === 'reassign') this.newOwner.set(this.lead()?.ownerUserId ?? null);
    if (d === 'link') this.orderNo.set('');
    this.dialog.set(d);
  }

  close(): void {
    this.dialog.set(null);
  }

  setFollowUp<K extends keyof FollowUpSaveDto>(key: K, value: FollowUpSaveDto[K]): void {
    this.followUp.update(f => ({ ...f, [key]: value }));
  }

  /** Runs a write; on success closes the dialog, says so and reads the lead again. */
  private write(call: ReturnType<CrmService['addFollowUp']>, done: string): void {
    this.busy.set(true);
    this.dialogError.set('');
    this.pageError.set('');
    this.notice.set('');
    call.subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success) { this.say(res.message || 'It could not be saved'); return; }
        this.dialog.set(null);
        this.notice.set(done);
        this.load();
      },
      error: err => {
        this.busy.set(false);
        const said = refusalOf(err);
        if (said === FORBIDDEN) this.error.set(said); else this.say(said);
      },
    });
  }

  private say(message: string): void {
    if (this.dialog()) this.dialogError.set(message); else this.pageError.set(message);
  }

  saveFollowUp(): void {
    const f = this.followUp();
    this.write(this.crm.addFollowUp(this.leadId, {
      ...f, nextFollowUpAt: f.nextFollowUpAt || null, notes: f.notes || null, nextAction: f.nextAction || null, remarks: f.remarks || null,
    }), 'Follow-up saved');
  }

  saveStatus(): void {
    if (!this.statusTo()) { this.dialogError.set('Choose the status'); return; }
    this.write(this.crm.changeStatus(this.leadId, { status: this.statusTo(), note: this.statusNote() || null }), 'Status changed');
  }

  saveLost(): void {
    if (!this.lostReasonId()) { this.dialogError.set('Choose why the lead was lost'); return; }
    this.write(this.crm.changeStatus(this.leadId, { status: 'Lost', lostReasonId: this.lostReasonId(), note: this.statusNote() || null }),
      'Marked lost');
  }

  /** A manager reopens a lost lead to the status it had before. */
  reopen(): void {
    const history = this.lead()?.history ?? [];
    const lost = [...history].sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt)).find(h => h.toStatus === 'Lost');
    const back = lost?.fromStatus && lost.fromStatus !== 'Lost' ? lost.fromStatus : 'New';
    this.dialog.set(null);
    this.write(this.crm.changeStatus(this.leadId, { status: back, note: 'Reopened' }), `Reopened as ${back}`);
  }

  saveReassign(): void {
    const owner = Number(this.newOwner());
    if (!owner) { this.dialogError.set('Choose the new owner'); return; }
    this.write(this.crm.reassign(this.leadId, { ownerUserId: owner }), 'Lead reassigned');
  }

  saveLink(): void {
    if (!this.orderNo().trim()) { this.dialogError.set('Enter the order number'); return; }
    this.write(this.crm.linkOrder(this.leadId, { orderNo: this.orderNo().trim(), quotationId: this.linkQuotationId() }), 'Order linked');
  }

  /** A manager has checked the sales orders and found none for this lead: the convert is cancelled. */
  saveCancelConvert(): void {
    this.write(this.crm.cancelConvert(this.leadId), 'Convert cancelled');
  }

  newQuotation(): void {
    this.router.navigate(['/crm/quotations', 'new'], { queryParams: { leadId: this.leadId } });
  }

  // ── convert to sale: app-crm-convert-dialog reads the preview and asks the server; the page hears the outcome ──

  openConvert(quotationId?: number): void {
    this.convertQuotationId.set(quotationId ?? null);
    this.dialog.set('convert');
  }

  converted(res: ConvertResultDto): void {
    this.dialog.set(null);
    this.notice.set(`Sales order ${res.orderNo} made. Despatch it from the Sales screens.`);
    this.load();
  }

  /** A 403 means the session is not for CRM: the page says so, as every page does. */
  convertForbidden(): void {
    this.dialog.set(null);
    this.error.set(FORBIDDEN);
  }

  // ── edit in place ──
  private toSave(l: LeadDetailDto): LeadSaveDto {
    return {
      leadId: l.leadId, leadDate: (l.leadDate ?? '').slice(0, 10), contactName: l.contactName, mobile: l.mobile, email: l.email,
      address: l.address, city: l.city, state: l.state, pinCode: l.pinCode, landmark: l.landmark, leadSourceId: l.leadSourceId ?? null,
      productCategory: l.productCategory, productMasterId: l.productMasterId ?? null, modelRequirement: l.modelRequirement,
      estimatedQty: l.estimatedQty ?? null, expectedPurchaseDate: l.expectedPurchaseDate ? l.expectedPurchaseDate.slice(0, 10) : null,
      ownerUserId: l.ownerUserId, priority: l.priority || 'Medium', remarks: l.remarks,
    };
  }

  setField(key: keyof LeadSaveDto, value: any): void {
    this.editForm.update(f => (f ? { ...f, [key]: value } : f));
  }

  onEdit(): void {
    const l = this.lead();
    if (!l || this.isClosed()) return;
    this.editForm.set(this.toSave(l));
    this.editProductName.set(l.productName ?? '');
    this.pageError.set('');
    this.notice.set('');
    this.editing.set(true);
  }

  private isDirty(): boolean {
    const f = this.editForm(), l = this.lead();
    return this.editing() && !!f && !!l && JSON.stringify(f) !== JSON.stringify(this.toSave(l));
  }

  /** Runs the action, after "Discard the changes?" when an edit is not saved. */
  private async leave(action: () => void): Promise<void> {
    if (this.isDirty() && !(await this.confirmDialog.confirm({ message: 'Discard the changes to this lead?', kind: 'danger', okText: 'Discard' }))) return;
    action();
  }

  onDiscard(): void { this.leave(() => { this.editing.set(false); this.editForm.set(null); this.pageError.set(''); }); }

  onSave(): void {
    const f = this.editForm();
    if (!f) return;
    if (!f.contactName?.trim()) { this.pageError.set('Enter the contact name'); return; }
    if ((f.mobile ?? '').replace(/\D/g, '').length < 10) { this.pageError.set('Enter a valid 10-digit mobile number'); return; }
    this.pageError.set('');
    this.busy.set(true);
    this.crm.saveLead({
      ...f,
      leadSourceId: f.leadSourceId ? Number(f.leadSourceId) : null,
      ownerUserId: f.ownerUserId ? Number(f.ownerUserId) : null,
      estimatedQty: f.estimatedQty ? Number(f.estimatedQty) : null,
      expectedPurchaseDate: f.expectedPurchaseDate || null,
    }).subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success) { this.pageError.set(res.message || 'The lead could not be saved'); return; }
        this.editing.set(false);
        this.editForm.set(null);
        this.notice.set('Lead saved');
        this.load();
      },
      error: err => { this.busy.set(false); this.pageError.set(refusalOf(err)); },
    });
  }

  onNew(): void { this.leave(() => this.router.navigate(['/crm/leads/new'])); }

  onPrint(): void { window.print(); }

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

  /** Shows another lead in this same screen (the route is reused). */
  onFindPick(id: number): void {
    this.findOpen.set(false);
    if (id === this.leadId) return;
    this.leave(() => {
      this.router.navigate(['/crm/leads', id], { replaceUrl: true });
      this.leadId = id;
      this.editing.set(false); this.editForm.set(null);
      this.notice.set(''); this.pageError.set(''); this.tab.set('timeline');
      this.lead.set(null);
      this.load();
    });
  }
}
