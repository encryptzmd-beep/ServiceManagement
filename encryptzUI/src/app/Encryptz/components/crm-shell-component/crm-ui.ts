// What the CRM pages share: the quotation totals, the dates, the amounts and how a refusal is said.

/** The answer of a page that the API refused with 403: the token is not for CRM. */
export const FORBIDDEN = 'forbidden';

/** Round to 2 decimals, half away from zero (as SQL ROUND and CrmRules.Totals). */
export function round2(value: number): number {
  const sign = value < 0 ? -1 : 1;
  // toPrecision first so 1.005 * 100 (100.49999…) is read as 100.5
  return sign * Math.round(Number((Math.abs(value) * 100).toPrecision(15))) / 100;
}

export interface QuoteLineInput { qty: number; rate: number; discountAmount: number; gstPercent: number; }
export interface QuoteLineAmounts { taxableAmount: number; gstAmount: number; lineTotal: number; }
export interface QuoteTotals {
  subTotal: number; discountTotal: number; taxableTotal: number;
  cgst: number; sgst: number; igst: number; grandTotal: number;
  lines: QuoteLineAmounts[];
}

/**
 * The amounts of a quotation, exactly as CrmRules.Totals (and sp_SalesOrder_Save): taxable = qty x rate - discount,
 * GST = round2(taxable x percent / 100), intra-state CGST = round2(GST / 2) and SGST the rest, inter-state all IGST.
 * With pricesIncludeGst the line amount already holds the GST: taxable = round2(amount x 100 / (100 + percent)), GST = the rest.
 * The server's figures are the ones kept; this is what the editor shows while typing.
 */
export function quoteTotals(items: QuoteLineInput[], isInterState: boolean, pricesIncludeGst = false): QuoteTotals {
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const lines = items.map(i => {
    const lineAmount = round2(num(i.qty) * num(i.rate) - num(i.discountAmount));
    const taxableAmount = pricesIncludeGst ? round2(lineAmount * 100 / (100 + num(i.gstPercent))) : lineAmount;
    const gstAmount = pricesIncludeGst ? round2(lineAmount - taxableAmount) : round2(taxableAmount * num(i.gstPercent) / 100);
    return { taxableAmount, gstAmount, lineTotal: round2(taxableAmount + gstAmount) };
  });
  const sum = (f: (x: QuoteLineAmounts, i: number) => number) => round2(lines.reduce((s, x, i) => s + f(x, i), 0));
  const gst = sum(x => x.gstAmount);
  const taxableTotal = sum(x => x.taxableAmount);
  const cgst = isInterState ? 0 : round2(gst / 2);
  return {
    subTotal: sum((_, i) => num(items[i].qty) * num(items[i].rate)),
    discountTotal: sum((_, i) => num(items[i].discountAmount)),
    taxableTotal,
    cgst,
    sgst: isInterState ? 0 : round2(gst - cgst),
    igst: isInterState ? gst : 0,
    grandTotal: round2(taxableTotal + gst),
    lines,
  };
}

/** What to show for a failed call: FORBIDDEN for a 403, else the server's sentence as it is. */
export function refusalOf(err: any): string {
  if (err?.status === 403) return FORBIDDEN;
  const said = err?.error?.message;
  if (typeof said === 'string' && said.trim()) return said;
  if (err?.status === 0 || err?.status === undefined) return 'The server could not be reached. Try again';
  return 'Something went wrong. Try again';
}

/** 1,180.00 */
export function amount(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ₹1,25,000 */
export function rupees(value: number | null | undefined): string {
  return '₹' + Math.round(value ?? 0).toLocaleString('en-IN');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-MM-dd of a local date. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** yyyy-MM-ddTHH:mm of a local date and time, for datetime-local inputs. */
export function isoDateTime(d: Date): string {
  return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The first and the last day of this month. */
export function thisMonth(today = new Date()): { from: string; to: string } {
  return {
    from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

/** 10 Nov 2026 */
export function showDate(value: string | null | undefined): string {
  if (!value) return '';
  const at = new Date(value.length === 10 ? value + 'T00:00:00' : value);
  return Number.isNaN(at.getTime()) ? '' : at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 10 Nov 2026, 10:30 am */
export function showDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? ''
    : at.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** The CSS class of a status pill. */
export function pill(status: string | null | undefined): string {
  return 'crm-pill ' + (status ?? '').toLowerCase().replace(/[^a-z]/g, '');
}
