/**
 * Quotation defaults set by the Company Admin on Settings > Print Settings (31_Quotation_Defaults.sql).
 * A NEW quotation takes them; the user can still change both on that quotation.
 */
export const QUOTATION_VALIDITY_KEY = 'Print.QuotationValidity';
export const QUOTATION_PRICES_KEY = 'Print.QuotationPrices';

export interface SettingChoice { value: string; label: string; }

/** The validity periods the admin can choose (the setting row's type lists the same values). */
export const QUOTATION_VALIDITY_CHOICES: SettingChoice[] = [
  { value: 'none', label: 'No default (entered by hand)' },
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '15d', label: '15 days' },
  { value: '30d', label: '30 days' },
  { value: '1m', label: '1 month' },
  { value: '2m', label: '2 months' },
  { value: '3m', label: '3 months' },
];

export const QUOTATION_PRICE_CHOICES: SettingChoice[] = [
  { value: 'exclusive', label: 'GST exclusive (GST is added to the rates)' },
  { value: 'inclusive', label: 'GST inclusive (the rates include GST)' },
];

/**
 * The Valid Until date for a quotation dated `quoteDate` (YYYY-MM-DD) with the period `period` (7d, 1m, ...),
 * or '' when there is no period. A month ahead of the 31st is the month's last day (31 Jan + 1 month = 28/29 Feb).
 */
export function validUntilFor(quoteDate: string, period: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(quoteDate ?? '');
  const p = /^([1-9]\d{0,2})([dm])$/.exec((period ?? '').trim().toLowerCase());
  if (!m || !p) return '';
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const n = Number(p[1]);
  let at: Date;
  if (p[2] === 'd') {
    at = new Date(Date.UTC(y, mo, d + n));
  } else {
    const lastDay = new Date(Date.UTC(y, mo + n + 1, 0)).getUTCDate();
    at = new Date(Date.UTC(y, mo + n, Math.min(d, lastDay)));
  }
  return at.toISOString().slice(0, 10);
}

/** Whether a new quotation's rates include GST, from the admin's setting (exclusive when not set). */
export const pricesIncludeGstByDefault = (setting: string | null | undefined): boolean =>
  (setting ?? '').trim().toLowerCase() === 'inclusive';
