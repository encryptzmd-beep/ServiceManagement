/** Send via WhatsApp: the PDF's file name and the message typed into the customer's chat. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A part of a file name: letters and digits kept (any script), every other run of characters one hyphen. */
const part = (value: string | null | undefined): string =>
  (value ?? '').normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

/**
 * "QTN-001_ABC-ENTERPRISES.pdf": the quotation number, then the customer's name in capitals. A later revision
 * carries its number ("QTN-001-R2_ABC-ENTERPRISES.pdf") so it is not mistaken for the first one.
 */
export function quotationWhatsAppFileName(quotationNo: string, revisionNo: number | null | undefined, customerName: string | null | undefined): string {
  const no = part(quotationNo) + ((revisionNo ?? 1) > 1 ? `-R${revisionNo}` : '');
  const name = part(customerName).toUpperCase();
  return `${[no || 'Quotation', name].filter(Boolean).join('_')}.pdf`;
}

const day = (value: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};

const rupees = (n: number | null | undefined): string =>
  `Rs. ${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The message the chat opens with; the person attaches the downloaded PDF and presses Send. */
export function quotationWhatsAppMessage(q: {
  quotationNo: string; revisionNo?: number | null; quoteDate?: string | null; validUntil?: string | null;
  grandTotal?: number | null; contactName?: string | null;
}, companyName?: string | null): string {
  const no = (q.revisionNo ?? 1) > 1 ? `${q.quotationNo} (revision ${q.revisionNo})` : q.quotationNo;
  const dated = day(q.quoteDate) ? ` dated ${day(q.quoteDate)}` : '';
  const valid = day(q.validUntil) ? `, valid until ${day(q.validUntil)}` : '';
  return [
    `Dear ${(q.contactName ?? '').trim() || 'Customer'},`,
    `Please find attached our quotation ${no}${dated} for ${rupees(q.grandTotal)}${valid}.`,
    'Please let us know if you have any questions.',
    '',
    `Thank you${companyName?.trim() ? `,\n${companyName.trim()}` : '.'}`,
  ].join('\n');
}
