import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { QuotationDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, refusalOf, showDate } from '../crm-shell-component/crm-ui';
import { DocumentPrintComponent, PrintDocument, printLineDetails } from '../shared/document-print/document-print';

/**
 * /crm/quotations/:id/print: the quotation on A4, printed (or saved as PDF) by the browser.
 * Company details, logo, bank, warranty and seal come from Settings > Print.
 */
@Component({
  selector: 'app-crm-quotation-print',
  standalone: true,
  imports: [RouterLink, CrmRefusedComponent, DocumentPrintComponent],
  templateUrl: './crm-quotation-print-component.html',
  styleUrl: './crm-quotation-print-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmQuotationPrintComponent {
  private crm = inject(CrmService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  readonly forbidden = FORBIDDEN;
  readonly id = Number(this.route.snapshot.paramMap.get('id') ?? 0);

  q = signal<QuotationDto | null>(null);
  error = signal('');
  settings = signal<Record<string, string>>({});
  /** The sheet waits for the settings, so it is never printed without its logo and bank details. */
  private settingsLoaded = signal(false);

  readonly company = computed(() => {
    const id = this.auth.selectedCompanyId();
    return this.auth.companies().find(c => c.companyId === id) ?? null;
  });

  readonly companyInfo = computed(() => {
    const c = this.company();
    return { name: c?.companyName, address: this.join(c?.address, c?.city), phone: c?.phoneNumber };
  });

  readonly document = computed<PrintDocument | null>(() => {
    const x = this.q();
    if (!x || !this.settingsLoaded()) return null;
    return {
      title: 'QUOTATION',
      metaRows: [
        { label: 'Quote No.', value: `${x.quotationNo} / R${x.revisionNo}` },
        { label: 'Quote Ref.', value: x.referenceNo ?? '' },
        { label: 'Date:', value: this.date(x.quoteDate) },
        { label: 'Payment Due Date:', value: this.date(x.paymentDueDate) },
        { label: 'Valid up to', value: this.date(x.validUntil) },
      ],
      billTo: {
        name: x.contactName,
        lines: [x.address, this.join(x.city, x.state, x.pinCode)].filter((l): l is string => !!l?.trim()),
        phone: x.mobile, email: x.email, gstin: x.customerGstin,
      },
      lines: x.items.map(i => ({
        description: i.productName,
        details: printLineDetails(i),
        rate: i.rate, qty: i.qty, amount: i.qty * i.rate,
      })),
      subTotal: x.subTotal, discountTotal: x.discountTotal, taxableTotal: x.taxableTotal,
      pricesIncludeGst: !!x.pricesIncludeGst, isInterState: x.isInterState,
      cgst: x.cgst, sgst: x.sgst, igst: x.igst, grandTotal: x.grandTotal, terms: x.terms,
    };
  });

  constructor() {
    this.crm.getQuotation(this.id).subscribe({
      next: res => (res.success && res.data ? this.q.set(res.data) : this.error.set(res.message || 'Quotation not found')),
      error: err => this.error.set(refusalOf(err)),
    });
    this.crm.getPrintSettings().subscribe({
      next: res => { this.settings.set(res?.data ?? {}); this.settingsLoaded.set(true); },
      error: () => this.settingsLoaded.set(true),   // the quotation still prints, with the login's company
    });
  }

  private date(value?: string | null): string { return value ? showDate(value) : ''; }

  join(...parts: (string | null | undefined)[]): string {
    return parts.filter(p => !!p && p.trim()).join(', ');
  }

  print(): void {
    window.print();
  }
}
