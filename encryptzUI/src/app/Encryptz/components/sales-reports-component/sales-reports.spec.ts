import { SalesReportData, buildSalesReport } from './sales-reports';

const today = new Date(2026, 10, 21);
const order = (id: number, over: any = {}) => ({
  salesOrderId: id, orderNo: `SO-${id}`, orderDate: '2026-11-10', status: 'Despatched', customerId: 1, customerName: 'Anu Mathew',
  subTotal: 1000, discountTotal: 100, cgst: 81, sgst: 81, igst: 0, grandTotal: 1062, lineCount: 1, totalQty: 2, ...over,
});
const despatch = (id: number, over: any = {}) => ({
  despatchId: id, despatchNo: `DS-${id}`, despatchDate: '2026-11-12', status: 'Despatched', salesOrderId: 1, orderNo: 'SO-1', grandTotal: 1062,
  customerId: 1, customerName: 'Anu Mathew', unitCount: 2, trackingNo: 'LR1', despatchMode: 'Courier', ...over,
});
const data = (orders: any[] = [], despatches: any[] = []): SalesReportData => ({ orders, despatches });

describe('sales reports', () => {
  it('the register lists cancelled bills but leaves them out of the totals', () => {
    const v = buildSalesReport('register', data([order(1), order(2, { status: 'Cancelled' })]), today);
    expect(v.rows.length).toBe(2);
    expect(v.stats[0].value).toBe('1');
    expect(v.stats[1].value).toBe('₹1,062');
  });

  it('the dates are inclusive', () => {
    const orders = [order(1, { orderDate: '2026-11-01' }), order(2, { orderDate: '2026-11-10' }), order(3, { orderDate: '2026-11-11' })];
    expect(buildSalesReport('register', data(orders), today, '2026-11-01', '2026-11-10').rows.length).toBe(2);
  });

  it('groups sales by customer, highest first', () => {
    const v = buildSalesReport('customers', data([
      order(1), order(2), order(3, { customerId: 2, customerName: 'Leo Joseph', grandTotal: 5000 }),
    ]), today);
    expect(v.rows[0]).toMatchObject({ customer: 'Leo Joseph', bills: 1 });
    expect(v.rows[1]).toMatchObject({ customer: 'Anu Mathew', bills: 2, value: 2124 });
  });

  it('the GST summary adds up each month', () => {
    const v = buildSalesReport('gst', data([order(1), order(2), order(3, { orderDate: '2026-10-05', cgst: 0, sgst: 0, igst: 162 })]), today);
    expect(v.rows.length).toBe(2);
    expect(v.rows[0]).toMatchObject({ bills: 2, taxable: 1800, cgst: 162, sgst: 162, tax: 324 });
    expect(v.rows[1]).toMatchObject({ igst: 162 });
  });

  it('pending despatch has only billed orders, oldest first', () => {
    const v = buildSalesReport('pending', data([
      order(1, { status: 'Billed', orderDate: '2026-11-20' }), order(2, { status: 'Billed', orderDate: '2026-11-01' }), order(3),
    ]), today);
    expect(v.rows.map(r => r['bill'])).toEqual(['SO-2', 'SO-1']);
    expect(v.rows[0]['age']).toBe(20);
  });

  it('despatch by mode counts older despatches as Not set and missing references', () => {
    const v = buildSalesReport('modes', data([], [despatch(1), despatch(2), despatch(3, { despatchMode: null, trackingNo: '' })]), today);
    expect(v.rows[0]).toMatchObject({ mode: 'Courier', count: 2, noRef: 0 });
    expect(v.rows[1]).toMatchObject({ mode: 'Not set', count: 1, noRef: 1 });
  });
});
