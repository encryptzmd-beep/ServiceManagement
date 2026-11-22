import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { QuotationDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, refusalOf } from '../crm-shell-component/crm-ui';
import { DocumentPdfService, documentFileName } from '../shared/document-print/document-pdf';
import { DocumentPrintComponent, PrintDocument, printCompanyOf } from '../shared/document-print/document-print';
import { quotationPrintDocument } from '../shared/document-print/quotation-document';

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
  private pdf = inject(DocumentPdfService);

  readonly forbidden = FORBIDDEN;
  readonly id = Number(this.route.snapshot.paramMap.get('id') ?? 0);

  q = signal<QuotationDto | null>(null);
  error = signal('');
  settings = signal<Record<string, string>>({});
  /** The sheet waits for the settings, so it is never printed without its logo and bank details. */
  private settingsLoaded = signal(false);

  readonly companyInfo = computed(() => printCompanyOf(this.auth));

  readonly document = computed<PrintDocument | null>(() => {
    const x = this.q();
    return x && this.settingsLoaded() ? quotationPrintDocument(x) : null;
  });

  pdfBusy = signal(false);
  pdfError = signal('');

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

  async downloadPdf(): Promise<void> {
    const doc = this.document(), x = this.q();
    if (!doc || !x || this.pdfBusy()) return;
    this.pdfBusy.set(true);
    this.pdfError.set('');
    try {
      await this.pdf.download(doc, this.settings(), documentFileName('Quotation', `${x.quotationNo}-R${x.revisionNo}`, x.contactName));
    } catch {
      this.pdfError.set('The PDF could not be made. Try again');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  print(): void {
    window.print();
  }
}
