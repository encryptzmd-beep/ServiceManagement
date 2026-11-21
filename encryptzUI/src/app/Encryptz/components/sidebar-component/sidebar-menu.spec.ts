import { inSideMenu, promoteComplaintMenus } from './sidebar-menu';

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
