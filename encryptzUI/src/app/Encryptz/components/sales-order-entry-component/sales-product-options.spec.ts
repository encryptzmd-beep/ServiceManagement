import { describe, expect, it } from 'vitest';
import { salesProductOptions } from './sales-product-options';

const p = (o: any) => ({ productMasterId: 1, productName: 'Split AC 1.5T', productCode: 'AC-15', brand: 'Voltas', model: '185V', mrp: 42500, ...o });

describe('sales product options', () => {
  it('shows the name, then code · brand · model, and the rate at the right', () => {
    expect(salesProductOptions([p({})] as any)).toEqual([
      { value: 1, label: 'Split AC 1.5T', sub: 'AC-15 · Voltas · 185V', aside: '₹42,500.00' },
    ]);
  });

  it('leaves out empty parts and shows a zero rate', () => {
    expect(salesProductOptions([p({ productCode: '', brand: null, model: ' ', mrp: null })] as any)[0])
      .toEqual({ value: 1, label: 'Split AC 1.5T', sub: '', aside: '₹0.00' });
  });
});
