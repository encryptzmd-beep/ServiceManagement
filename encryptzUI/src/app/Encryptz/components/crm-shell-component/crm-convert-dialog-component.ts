import { AppRightDirective } from '../shared/app-right/app-right';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConvertPreviewDto, ConvertResultDto, QuotationSummaryDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { FORBIDDEN, amount, isoDate, refusalOf } from './crm-ui';

export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Credit'];

/** The server converts only a lead in Quotation or Negotiation (CrmRules.ConvertProblem). */
const OPEN_FOR_CONVERT = ['Quotation', 'Negotiation'];

/**
 * Why a shown Convert button is disabled, or '' when the convert may go ahead. The lead page and the quotation
 * editor both ask this, so the button is disabled for the same reasons, with the same words, on either screen.
 */
export function convertBlockedReason(leadStatus: string | null | undefined,
                                     lead: { salesOrderId?: number | null; convertNeedsCheck?: boolean } | null): string {
  if (lead?.salesOrderId) return 'This lead has already been converted to a sales order';
  if (lead?.convertNeedsCheck) return 'A manager must check the sales orders for this lead first, then link the order or cancel the convert';
  if (!OPEN_FOR_CONVERT.includes(leadStatus ?? '')) return 'Mark the quotation as sent first';
  return '';
}

/**
 * Convert to sales order, shared by the lead page and the quotation editor: it reads the convert preview of the chosen
 * quotation (the customers with the lead's mobile and the quotation's lines), asks the customer when several match,
 * the order date and the payment mode, and on Confirm asks the server to make the sales order. The server decides;
 * a refusal is shown here as the server said it, except a 403, which the page shows as every page does.
 */
@Component({
  selector: 'app-crm-convert-dialog',
  standalone: true,
  imports: [AppRightDirective, FormsModule],
  templateUrl: './crm-convert-dialog-component.html',
  styleUrls: ['./crm-pages.scss', './crm-convert-dialog-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmConvertDialogComponent implements OnInit {
  private crm = inject(CrmService);

  readonly paymentModes = PAYMENT_MODES;
  readonly amount = amount;

  leadId = input.required<number>();
  /** The quotation to convert; when none is given, the most recently changed of `quotations`. */
  quotationId = input<number | null>(null);
  /** The quotations that may be converted (the picker shows when there are several). */
  quotations = input<QuotationSummaryDto[]>([]);
  /** The lead's mobile, said when no customer has it. */
  mobile = input('');

  converted = output<ConvertResultDto>();
  cancelled = output<void>();
  /** The server refused with 403: the page shows the module-list refusal. */
  forbidden = output<void>();

  convertQuotationId = signal<number | null>(null);
  preview = signal<ConvertPreviewDto | null>(null);
  chosenCustomerId = signal<number | null>(null);
  orderDate = signal(isoDate(new Date()));
  paymentMode = signal('Cash');
  comment = signal('');
  error = signal('');
  busy = signal(false);
  /** The convert call is out: the dialog stays open until its answer, so the page learns what was made. */
  converting = signal(false);

  readonly confirmDisabled = computed(() => {
    const p = this.preview();
    return this.busy() || !p || (p.matches.length > 1 && !this.chosenCustomerId());
  });

  ngOnInit(): void {
    this.open(this.quotationId() ?? undefined);
  }

  join(...parts: (string | null | undefined)[]): string {
    return parts.filter(p => !!p && p.trim()).join(', ');
  }

  /** Reads the preview of a quotation (the chosen one, else the most recently changed). */
  open(quotationId?: number): void {
    const list = this.quotations();
    const chosen = quotationId ?? [...list].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]?.quotationId ?? list[0]?.quotationId;
    this.error.set('');
    this.preview.set(null);
    this.chosenCustomerId.set(null);
    this.orderDate.set(isoDate(new Date()));
    if (!chosen) { this.error.set('There is no quotation to convert'); return; }
    this.convertQuotationId.set(chosen);
    this.busy.set(true);
    this.crm.previewConvert(this.leadId(), chosen).subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success || !res.data) { this.error.set(res.message || 'The quotation could not be read'); return; }
        this.preview.set(res.data);
        if (res.data.matches.length === 1) this.chosenCustomerId.set(res.data.matches[0].customerId);
      },
      error: err => { this.busy.set(false); this.refuse(err); },
    });
  }

  private refuse(err: unknown): void {
    const said = refusalOf(err);
    if (said === FORBIDDEN) this.forbidden.emit(); else this.error.set(said);
  }

  chooseCustomer(id: number): void {
    this.chosenCustomerId.set(id);
  }

  confirm(): void {
    const p = this.preview();
    const quotationId = this.convertQuotationId();
    if (!p || !quotationId || this.confirmDisabled()) return;
    this.busy.set(true);
    this.converting.set(true);
    this.error.set('');
    this.crm.convert(this.leadId(), {
      quotationId, customerId: p.matches.length ? this.chosenCustomerId() : null, orderDate: this.orderDate(), paymentMode: this.paymentMode() || null,
      ...(this.comment().trim() ? { comment: this.comment().trim() } : {}),
    }).subscribe({
      next: res => {
        this.busy.set(false);
        this.converting.set(false);
        if (!res.success || !res.data) { this.error.set(res.message || 'The lead could not be converted'); return; }
        this.converted.emit(res.data);
      },
      error: err => {
        this.busy.set(false);
        this.converting.set(false);
        this.refuse(err);
      },
    });
  }

  cancel(): void {
    if (!this.converting()) this.cancelled.emit();
  }
}
