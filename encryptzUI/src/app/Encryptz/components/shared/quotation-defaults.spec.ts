import { QUOTATION_PRICE_CHOICES, QUOTATION_VALIDITY_CHOICES, pricesIncludeGstByDefault, validUntilFor } from './quotation-defaults';

describe('quotation defaults', () => {
  it('adds days to the quotation date', () => {
    expect(validUntilFor('2026-11-27', '7d')).toBe('2026-12-04');
    expect(validUntilFor('2026-12-25', '14d')).toBe('2027-01-08');
  });

  it('adds months, ending on the last day of a shorter month', () => {
    expect(validUntilFor('2026-11-27', '1m')).toBe('2026-12-27');
    expect(validUntilFor('2027-01-31', '1m')).toBe('2027-02-28');
    expect(validUntilFor('2028-01-31', '1m')).toBe('2028-02-29');
    expect(validUntilFor('2026-11-30', '3m')).toBe('2027-02-28');
  });

  it('gives no date without a period or a date', () => {
    expect(validUntilFor('2026-11-27', 'none')).toBe('');
    expect(validUntilFor('2026-11-27', '')).toBe('');
    expect(validUntilFor('', '7d')).toBe('');
  });

  it('offers only periods it can work out', () => {
    for (const c of QUOTATION_VALIDITY_CHOICES.filter(c => c.value !== 'none'))
      expect(validUntilFor('2026-11-27', c.value)).not.toBe('');
  });

  it('takes GST inclusive only when the admin chose it', () => {
    expect(pricesIncludeGstByDefault('inclusive')).toBe(true);
    expect(pricesIncludeGstByDefault('exclusive')).toBe(false);
    expect(pricesIncludeGstByDefault('')).toBe(false);
    expect(QUOTATION_PRICE_CHOICES.map(c => c.value)).toEqual(['exclusive', 'inclusive']);
  });
});
