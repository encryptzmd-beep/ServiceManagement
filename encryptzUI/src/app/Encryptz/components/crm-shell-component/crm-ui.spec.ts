import { quoteTotals, round2, refusalOf } from './crm-ui';

describe('crm-ui', () => {
  const line = (qty: number, rate: number, discountAmount: number, gstPercent: number) =>
    ({ qty, rate, discountAmount, gstPercent } as any);

  it('rounds half away from zero, as SQL ROUND does', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('works out an intra-state quotation: 18% on 1000 is CGST 90, SGST 90, total 1180', () => {
    const inclusive = quoteTotals([line(47, 44500, 0, 18)], false, true);
    expect(inclusive.taxableTotal).toBe(1772457.63);
    expect(inclusive.grandTotal).toBe(2091500);
    const t = quoteTotals([line(1, 1000, 0, 18)], false);
    expect(t.taxableTotal).toBe(1000);
    expect(t.cgst).toBe(90);
    expect(t.sgst).toBe(90);
    expect(t.igst).toBe(0);
    expect(t.grandTotal).toBe(1180);
  });

  it('splits an odd paisa: CGST is the rounded half, SGST the rest', () => {
    // 5% on 100.10 = 5.005 -> 5.01; CGST round(2.505) = 2.51, SGST 2.50
    const t = quoteTotals([line(1, 100.1, 0, 5)], false);
    expect(t.cgst).toBe(2.51);
    expect(t.sgst).toBe(2.5);
    expect(t.grandTotal).toBe(105.11);
  });

  it('puts all the GST on IGST between states, after the discount', () => {
    const t = quoteTotals([line(2, 500, 100, 12), line(3, 0.1, 0, 0)], true);
    expect(t.subTotal).toBe(1000.3);
    expect(t.discountTotal).toBe(100);
    expect(t.taxableTotal).toBe(900.3);
    expect(t.igst).toBe(108);
    expect(t.cgst).toBe(0);
    expect(t.sgst).toBe(0);
    expect(t.grandTotal).toBe(1008.3);
    expect(t.lines[0]).toEqual({ taxableAmount: 900, gstAmount: 108, lineTotal: 1008 });
  });

  it('says how to open CRM when the token is not for it', () => {
    expect(refusalOf({ status: 403 })).toBe('forbidden');
    expect(refusalOf({ status: 400, error: { message: 'Lead not found' } })).toBe('Lead not found');
    expect(refusalOf({ status: 0 })).toBe('The server could not be reached. Try again');
  });
});
