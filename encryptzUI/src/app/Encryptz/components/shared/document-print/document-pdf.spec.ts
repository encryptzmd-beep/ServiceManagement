import { documentFileName, pageEnds } from './document-pdf';

describe('document PDF', () => {
  it('keeps a short document on one page', () => {
    expect(pageEnds(800, 1000, [100, 500])).toEqual([800]);
  });

  it('ends a page after the last row that fits', () => {
    expect(pageEnds(1500, 1000, [400, 950, 1200])).toEqual([950, 1500]);
  });

  it('still moves on when one block is taller than a page', () => {
    expect(pageEnds(2500, 1000, [])).toEqual([1000, 2000, 2500]);
  });

  it('makes a safe file name', () => {
    expect(documentFileName('Quotation', 'QT-0008/R1', 'MEERA  NAIR')).toBe('Quotation-QT-0008-R1-MEERA NAIR.pdf');
    expect(documentFileName('Invoice', 'INV-1', null)).toBe('Invoice-INV-1.pdf');
  });
});
