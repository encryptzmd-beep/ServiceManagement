import { groupDespatchMenus, inSideMenu, promoteComplaintMenus } from './sidebar-menu';

describe('groupDespatchMenus', () => {
  const item = (menuId: number, menuPath: string, menuName = menuPath) => ({ menuId, menuPath, menuName, children: [] });
  const sales = (...children: any[]) => ({ menuId: 9, menuName: 'Sales', menuPath: '', children });
  const products = { menuId: 20, menuName: 'Products', menuPath: '', children: [item(21, 'products')] };

  it('makes Despatch a main menu after Sales, with its reports', () => {
    const menu = groupDespatchMenus([sales(item(1, 'sales/orders'), item(4, 'sales/reports/modes'), item(2, 'sales/despatch'),
      item(3, 'sales/reports/pending'), item(5, 'sales/reports/despatch'), item(6, 'sales/reports/gst')), products]);
    expect(menu.map(m => m.menuName)).toEqual(['Sales', 'Despatch', 'Products']);
    expect(menu[0].children.map((c: any) => c.menuPath)).toEqual(['sales/orders', 'sales/reports/gst']);
    expect(menu[1].children.map((c: any) => c.menuName)).toEqual(['All Despatches', 'Pending Despatch', 'Despatch Register', 'Despatch by Mode']);
  });

  it('removes a Sales group left empty', () => {
    expect(groupDespatchMenus([sales(item(2, '/sales/despatch')), products]).map(m => m.menuName)).toEqual(['Products', 'Despatch']);
  });

  it('gives a Storekeeper the Despatch menu without a menu row', () => {
    const menu = groupDespatchMenus([products], 'Storekeeper');
    expect(menu.map(m => m.menuName)).toEqual(['Products', 'Despatch']);
    expect(menu[1].children.map((c: any) => c.menuPath)).toEqual(['sales/despatch']);
    expect(groupDespatchMenus([products], 'Manager').map(m => m.menuName)).toEqual(['Products']);
  });

  it('shows only the pages the user has, and nothing without any', () => {
    expect(groupDespatchMenus([sales(item(1, 'sales/orders'), item(3, 'sales/reports/pending'))])[1].children.length).toBe(1);
    const none = [sales(item(1, 'sales/orders'))];
    expect(groupDespatchMenus(none)).toBe(none);
  });
});

describe('inSideMenu', () => {
  it('leaves out the administration pages only', () => {
    for (const menuPath of ['settings/roles', '/settings/access-management', 'Settings/Platform/']) {
      expect(inSideMenu({ menuPath })).toBe(false);
    }
    expect(inSideMenu({ menuPath: 'settings' })).toBe(true);
    expect(inSideMenu({ menuPath: '' })).toBe(true);
  });
});

describe('promoteComplaintMenus', () => {
  const dashboard = { menuId: 2, menuName: 'Dashboard', menuPath: 'complaints/dashboard', icon: 'dashboard', children: [] };
  const list = { menuId: 3, menuName: 'All Complaints', menuPath: '/complaints/list', icon: 'list', children: [] };
  const group = (children: any[]) => ({ menuId: 1, menuName: 'Complaints', menuPath: '', icon: 'report_problem', children });
  const sales = { menuId: 9, menuName: 'Sales', menuPath: '', children: [{ menuId: 10 }] };

  it('puts Dashboard and Complaints first and removes the group', () => {
    const menu = promoteComplaintMenus([group([dashboard, list]), sales]);
    expect(menu.map(m => m.menuName)).toEqual(['Dashboard', 'Complaints', 'Sales']);
    expect(menu[1].icon).toBe('report_problem');
  });

  it('removes the group whatever placeholder path it has', () => {
    const menu = promoteComplaintMenus([{ ...group([dashboard, list]), menuPath: '#complaints' }, sales]);
    expect(menu.map(m => m.menuName)).toEqual(['Dashboard', 'Complaints', 'Sales']);
  });

  it('shows only the entries the user has', () => {
    expect(promoteComplaintMenus([group([list]), sales]).map(m => m.menuName)).toEqual(['Complaints', 'Sales']);
  });

  it('keeps any other entry of the group in the menu', () => {
    const other = { menuId: 4, menuName: 'Warranty', menuPath: 'complaints/warranty', children: [] };
    expect(promoteComplaintMenus([group([dashboard, other])]).map(m => m.menuName)).toEqual(['Dashboard', 'Warranty']);
  });

  it('leaves a menu without these entries alone', () => {
    expect(promoteComplaintMenus([sales])).toEqual([sales]);
  });
});
