import { moduleOfMenu, normalizeMenuPath, rowAllows, storekeeperMayIssue } from './rights-service';

describe('user rights', () => {
  it('a Storekeeper may issue on the Despatch screen and nowhere else', () => {
    expect(storekeeperMayIssue('Storekeeper', 'create', '/sales/despatch')).toBe(true);
    expect(storekeeperMayIssue('Storekeeper', 'edit', '/sales/despatch')).toBe(true);
    expect(storekeeperMayIssue('Storekeeper', 'delete', '/sales/despatch')).toBe(false);
    expect(storekeeperMayIssue('Storekeeper', 'create', '/sales/orders')).toBe(false);
    expect(storekeeperMayIssue('Manager', 'create', '/sales/despatch')).toBe(false);
  });

  const row = (over: any = {}) => ({ path: 'sales/orders', canView: true, canCreate: false, canEdit: false, canDelete: false, ...over });

  it('compares menu paths with or without slashes', () => {
    expect(normalizeMenuPath('/Sales/Orders/')).toBe('sales/orders');
  });

  it('finds the module of a menu', () => {
    expect(moduleOfMenu('/crm/leads')).toBe('CRM');
    expect(moduleOfMenu('/consultancy/clients')).toBe('JOBCONSULTANCY');
    expect(moduleOfMenu('sales/orders')).toBe('SERVICE');
  });

  it('a missing row, or no View, allows nothing', () => {
    expect(rowAllows(undefined, 'create')).toBe(false);
    expect(rowAllows(row({ canView: false, canCreate: true }), 'create')).toBe(false);
  });

  it('each right is its own', () => {
    expect(rowAllows(row({ canCreate: true }), 'create')).toBe(true);
    expect(rowAllows(row({ canCreate: true }), 'edit')).toBe(false);
    expect(rowAllows(row({ canEdit: true }), 'delete')).toBe(false);
    expect(rowAllows(row({ canDelete: true }), 'delete')).toBe(true);
  });

  it('a form that can be new or existing opens with either right', () => {
    expect(rowAllows(row({ canCreate: true }), 'save')).toBe(true);
    expect(rowAllows(row({ canEdit: true }), 'save')).toBe(true);
    expect(rowAllows(row(), 'save')).toBe(false);
  });
});
