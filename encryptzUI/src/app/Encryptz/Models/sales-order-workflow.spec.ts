import { SALES_ORDER_STATUSES, SALES_ORDER_STEPS, isOpenSalesOrder, nextSalesOrderStep, notDespatchableReason } from './SalesModels';

describe('sales order workflow', () => {
  it('runs Sales Order → Sales Confirmed → Billed → Despatched', () => {
    expect([...SALES_ORDER_STEPS]).toEqual(['Sales Order', 'Sales Confirmed', 'Billed', 'Despatched']);
    expect(SALES_ORDER_STATUSES).toContain('Cancelled');
  });

  it('moves one step at a time, and never past Billed by hand', () => {
    expect(nextSalesOrderStep('Sales Order')).toBe('Sales Confirmed');
    expect(nextSalesOrderStep('Sales Confirmed')).toBe('Billed');
    expect(nextSalesOrderStep('Billed')).toBeNull();
    expect(nextSalesOrderStep('Despatched')).toBeNull();
    expect(nextSalesOrderStep('Cancelled')).toBeNull();
  });

  it('lets an order change only until it is billed', () => {
    expect(isOpenSalesOrder('Sales Order')).toBe(true);
    expect(isOpenSalesOrder('Sales Confirmed')).toBe(true);
    expect(isOpenSalesOrder('Billed')).toBe(false);
    expect(isOpenSalesOrder('Despatched')).toBe(false);
  });

  it('sends only a billed order to Despatch, and says why not otherwise', () => {
    expect(notDespatchableReason('INV-0007', 'Billed')).toBe('');
    expect(notDespatchableReason('INV-0007', 'Sales Confirmed'))
      .toBe('Sales order INV-0007 is not billed yet. Attach its invoice and mark it billed first.');
    expect(notDespatchableReason('INV-0007', 'Cancelled')).toBe('Sales order INV-0007 is cancelled and cannot be despatched.');
  });
});
