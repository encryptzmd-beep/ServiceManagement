import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ConvertPreviewDto, CrmMasterDto, CrmMemberDto, FollowUpSaveDto, LEAD_STATUSES, LeadDetailDto, QuotationSummaryDto,
} from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, amount, isoDate, isoDateTime, pill, refusalOf, showDate, showDateTime } from '../crm-shell-component/crm-ui';

type Dialog = 'followup' | 'status' | 'lost' | 'reassign' | 'convert' | 'link' | 'cancel-convert' | null;
type Tab = 'details' | 'timeline' | 'quotations';

interface TimelineEntry { key: string; at: string; kind: 'followup' | 'status'; title: string; text: string; by: string; next?: string; }

export const FOLLOW_UP_TYPES = ['Phone Call', 'Meeting', 'Site Visit', 'WhatsApp', 'Email', 'Other'];
export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Credit'];
const OPEN_FOR_CONVERT = ['Quotation', 'Negotiation'];

/**
 * /crm/leads/:id: the lead, its timeline and quotations, and what may be done with it: a follow-up, a change of
 * status, lost, reassign (managers), a new quotation and the convert to a sales order. Converted and Lost leads
 * are read-only; a manager may reopen a lost one. The server decides; the page only hides what cannot apply.
 */
@Component({
  selector: 'app-crm-lead-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, CrmRefusedComponent],
  templateUrl: './crm-lead-detail-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-lead-detail-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmLeadDetailComponent {
  private crm = inject(CrmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly forbidden = FORBIDDEN;
  readonly followUpTypes = FOLLOW_UP_TYPES;
  readonly paymentModes = PAYMENT_MODES;
  readonly pill = pill;
  readonly amount = amount;
  readonly showDate = showDate;
  readonly showDateTime = showDateTime;

  readonly leadId = Number(this.route.snapshot.paramMap.get('id') ?? 0);

  lead = signal<LeadDetailDto | null>(null);
  error = signal('');
  notice = signal('');
  /** A refusal of an action taken without a dialog (reopen). */
  pageError = signal('');
  isManager = signal(false);
  lostReasons = signal<CrmMasterDto[]>([]);
  owners = signal<CrmMemberDto[]>([]);
  tab = signal<Tab>('details');

  dialog = signal<Dialog>(null);
  dialogError = signal('');
  busy = signal(false);

  followUp = signal<FollowUpSaveDto>(this.blankFollowUp());
  statusTo = signal('');
  statusNote = signal('');
  lostReasonId = signal<number | null>(null);
  newOwner = signal<number | null>(null);
  orderNo = signal('');

  convertQuotationId = signal<number | null>(null);
  preview = signal<ConvertPreviewDto | null>(null);
  chosenCustomerId = signal<number | null>(null);
  orderDate = signal(isoDate(new Date()));
  paymentMode = signal('Cash');

  readonly isClosed = computed(() => ['Converted', 'Lost'].includes(this.lead()?.status ?? ''));

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

  readonly confirmDisabled = computed(() => {
    const p = this.preview();
    return this.busy() || !p || (p.matches.length > 1 && !this.chosenCustomerId());
  });

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

  // ── convert to sale ──

  openConvert(quotationId?: number): void {
    const list = this.convertible();
    const chosen = quotationId ?? [...list].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]?.quotationId ?? list[0]?.quotationId;
    this.dialogError.set('');
    this.preview.set(null);
    this.chosenCustomerId.set(null);
    this.orderDate.set(isoDate(new Date()));
    this.dialog.set('convert');
    if (!chosen) { this.dialogError.set('There is no quotation to convert'); return; }
    this.convertQuotationId.set(chosen);
    this.busy.set(true);
    this.crm.previewConvert(this.leadId, chosen).subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success || !res.data) { this.dialogError.set(res.message || 'The quotation could not be read'); return; }
        this.preview.set(res.data);
        if (res.data.matches.length === 1) this.chosenCustomerId.set(res.data.matches[0].customerId);
      },
      error: err => { this.busy.set(false); this.refuse(err); },
    });
  }

  /** A 403 means the session is not for CRM: the page says so, as every page does; anything else stays in the dialog. */
  private refuse(err: unknown): void {
    const said = refusalOf(err);
    if (said === FORBIDDEN) { this.dialog.set(null); this.error.set(said); } else this.dialogError.set(said);
  }

  chooseCustomer(id: number): void {
    this.chosenCustomerId.set(id);
  }

  confirmConvert(): void {
    const p = this.preview();
    const quotationId = this.convertQuotationId();
    if (!p || !quotationId || this.confirmDisabled()) return;
    this.busy.set(true);
    this.dialogError.set('');
    this.crm.convert(this.leadId, {
      quotationId, customerId: p.matches.length ? this.chosenCustomerId() : null, orderDate: this.orderDate(), paymentMode: this.paymentMode() || null,
    }).subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success || !res.data) { this.dialogError.set(res.message || 'The lead could not be converted'); return; }
        this.dialog.set(null);
        this.notice.set(`Sales order ${res.data.orderNo} made. Despatch it from the Sales screens.`);
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.refuse(err);
      },
    });
  }
}
