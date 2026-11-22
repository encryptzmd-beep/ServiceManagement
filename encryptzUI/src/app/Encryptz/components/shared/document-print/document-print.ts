import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface PrintLine {
  description: string;
  /** Smaller lines under the description: product details, MRP, HSN, warranty, serial numbers. */
  details: string[];
  rate: number;
  qty: number;
  /** Quantity x rate; discount and GST are shown in the totals. */
  amount: number;
}

export interface PrintDocument {
  title: string;
  metaRows: { label: string; value: string }[];
  billTo: { name: string; lines: string[]; phone?: string | null; email?: string | null; gstin?: string | null };
  lines: PrintLine[];
  subTotal: number;
  discountTotal: number;
  /** The rates already contain GST: it is shown as included, not added. */
  pricesIncludeGst?: boolean;
  taxableTotal?: number;
  isInterState: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  /** The document's own terms; blank uses Settings > Print. */
  terms?: string | null;
  notes?: string | null;
}

/** The login's company, used where Settings > Print is blank. */
export interface PrintCompany {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
}

const textLines = (value: string | null | undefined): string[] =>
  (value ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

/** The smaller lines under a product, the same on the quotation and the sales order. */
export function printLineDetails(i: {
  productDescription?: string | null; mrp?: number | null; hsnSac?: string | null; gstPercent?: number | null;
  warrantyMonths?: number | null; brandModel?: string | null; serialNumbers?: string | null; warrantyEndDate?: string | null;
}): string[] {
  const tax = [i.hsnSac ? `HSN/SAC ${i.hsnSac}` : '', i.gstPercent != null ? `GST ${i.gstPercent}%` : ''].filter(Boolean).join(' · ');
  return [
    ...(i.brandModel?.trim() ? [i.brandModel.trim()] : []),
    ...textLines(i.productDescription),
    ...(i.mrp ? [`[MRP : ${i.mrp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/-]`] : []),
    ...(tax ? [tax] : []),
    ...(i.warrantyMonths ? [`Warranty ${i.warrantyMonths} months${i.warrantyEndDate ? ` (till ${i.warrantyEndDate})` : ''}`] : []),
    ...(i.serialNumbers ? [`SN: ${i.serialNumbers}`] : []),
  ];
}

/** Indian numbering: "Twenty Lakh Ninety One Thousand Five Hundred Rupees Only". */
export function amountInWords(amount: number): string {
  const paiseTotal = Math.round(Math.abs(amount) * 100);
  const rupees = Math.floor(paiseTotal / 100), paise = paiseTotal % 100;
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number): string => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
  const three = (x: number): string => [x >= 100 ? ones[Math.floor(x / 100)] + ' Hundred' : '', two(x % 100)].filter(Boolean).join(' ');
  const words = (x: number): string => {
    if (x === 0) return 'Zero';
    const crore = Math.floor(x / 10000000), lakh = Math.floor(x / 100000) % 100, thousand = Math.floor(x / 1000) % 100, rest = x % 1000;
    return [crore ? words(crore) + ' Crore' : '', lakh ? two(lakh) + ' Lakh' : '', thousand ? two(thousand) + ' Thousand' : '', three(rest)]
      .filter(Boolean).join(' ');
  };
  return `${words(rupees)} Rupees${paise ? ' and ' + two(paise) + ' Paise' : ''} Only`;
}

/** The A4 quotation / sales order. Printing and "Save as PDF" both use this one layout. */
@Component({
  selector: 'app-document-print',
  standalone: true,
  templateUrl: './document-print.html',
  styleUrl: './document-print.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentPrintComponent {
  doc = input.required<PrintDocument>();
  settings = input<Record<string, string>>({});
  company = input<PrintCompany | null>(null);

  readonly words = computed(() => amountInWords(this.doc().grandTotal));
  readonly companyName = computed(() => this.s('Print.CompanyName') || this.company()?.name?.trim() || '');
  readonly addressLines = computed(() => {
    const own = textLines(this.s('Print.CompanyAddress'));
    return own.length ? own : textLines(this.company()?.address);
  });
  readonly phone = computed(() => this.s('Print.CompanyPhone') || this.company()?.phone?.trim() || '');
  readonly warranty = computed(() => textLines(this.s('Print.Warranty')));
  readonly terms = computed(() => {
    const own = textLines(this.doc().terms);
    return own.length ? own : textLines(this.s('Print.Terms'));
  });
  readonly closing = computed(() => textLines(this.s('Print.ClosingMessage')));
  readonly hasBank = computed(() => ['Holder', 'No', 'IFSC', 'Name'].some(k =>
    this.s(k === 'Holder' ? 'Print.BankAccountHolder' : k === 'No' ? 'Print.BankAccountNo' : k === 'IFSC' ? 'Print.BankIFSC' : 'Print.BankName')));
  readonly headerMode = computed(() => this.mode('Header'));
  readonly footerMode = computed(() => this.mode('Footer'));

  s(key: string): string { return (this.settings()[key] ?? '').trim(); }
  lines(key: string): string[] { return textLines(this.s(key)); }
  money(value: number): string {
    return (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private mode(part: 'Header' | 'Footer'): 'none' | 'text' | 'image' {
    const mode = this.s(`Print.${part}Mode`).toLowerCase();
    if (mode === 'image' && this.s(`Print.${part}Image`)) return 'image';
    if (mode === 'text' && this.s(`Print.${part}Text`)) return 'text';
    return 'none';
  }
}
