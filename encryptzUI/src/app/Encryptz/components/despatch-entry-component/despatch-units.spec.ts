import { describe, expect, it } from 'vitest';
import { isProductLine } from './despatch-units';

describe('despatch units', () => {
  it('a product from the master is despatched, with or without warranty', () => {
    expect(isProductLine({ productMasterId: 7, warrantyMonths: 24 })).toBe(true);
    expect(isProductLine({ productMasterId: 7, warrantyMonths: 0 })).toBe(true);
  });

  it('a typed-in product with a warranty is despatched', () => {
    expect(isProductLine({ productMasterId: null, warrantyMonths: 12 })).toBe(true);
  });

  it('a service line (no product, no warranty) is not a unit', () => {
    expect(isProductLine({ productMasterId: null, warrantyMonths: 0 })).toBe(false);
    expect(isProductLine({})).toBe(false);
  });
});
