import { QuotationDto } from '../../../Models/CrmModels';
import { showDate } from '../../crm-shell-component/crm-ui';
import { PrintDocument, printLineDetails } from './document-print';

const shown = (value?: string | null): string => (value ? showDate(value) : '');
const joined = (...parts: (string | null | undefined)[]): string => parts.filter(p => !!p && p.trim()).join(', ');

/** A saved quotation as the print and the PDF show it. */
export function quotationPrintDocument(x: QuotationDto): PrintDocument {
  return {
    title: 'QUOTATION',
    metaRows: [
      { label: 'Quote No.', value: `${x.quotationNo} / R${x.revisionNo}` },
      { label: 'Quote Ref.', value: x.referenceNo ?? '' },
      { label: 'Date:', value: shown(x.quoteDate) },
      { label: 'Payment Due Date:', value: shown(x.paymentDueDate) },
      { label: 'Valid up to', value: shown(x.validUntil) },
    ],
    billTo: {
      name: x.contactName,
      lines: [x.address, joined(x.city, x.state, x.pinCode)].filter((l): l is string => !!l?.trim()),
      phone: x.mobile, email: x.email, gstin: x.customerGstin,
    },
    lines: x.items.map(i => ({
      description: i.productName,
      details: printLineDetails(i),
      rate: i.rate, qty: i.qty, amount: i.qty * i.rate,
    })),
    subTotal: x.subTotal, discountTotal: x.discountTotal, taxableTotal: x.taxableTotal,
    pricesIncludeGst: !!x.pricesIncludeGst, isInterState: x.isInterState,
    cgst: x.cgst, sgst: x.sgst, igst: x.igst, grandTotal: x.grandTotal,
    terms: x.terms ?? '', warranty: x.warrantyText ?? '',
  };
}
