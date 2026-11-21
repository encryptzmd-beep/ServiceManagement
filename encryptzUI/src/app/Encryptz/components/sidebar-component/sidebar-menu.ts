const pathOf = (menu: any) => String(menu?.menuPath ?? '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();

// recognised by its entries: the path stored on a group row is a placeholder, not a page
const isComplaintsGroup = (menu: any) =>
  (menu?.children ?? []).some((child: any) => ['complaints/dashboard', 'complaints/list'].includes(pathOf(child)));

/** Opened from the Select Company page (Users & Roles, Administration), not from the side menu. */
const OUTSIDE_SIDE_MENU = new Set(['settings/roles', 'settings/access-management', 'settings/platform']);

export const inSideMenu = (menu: any) => !OUTSIDE_SIDE_MENU.has(pathOf(menu));

/**
 * Dashboard and Complaints are main menu entries, first in the list. The rows stay under the
 * Complaints group in the database, so the rights ticked on them keep working.
 */
export function promoteComplaintMenus(roots: any[]): any[] {
  const group = roots.find(isComplaintsGroup);
  const rest = roots.filter(menu => menu !== group);
  const moved = [...(group?.children ?? [])];
  const candidates = [...moved, ...rest];

  const dashboard = candidates.find(menu => pathOf(menu) === 'complaints/dashboard');
  const list = candidates.find(menu => pathOf(menu) === 'complaints/list');
  const first = [
    ...(dashboard ? [{ ...dashboard, menuName: 'Dashboard', children: [] }] : []),
    ...(list ? [{ ...list, menuName: 'Complaints', icon: group?.icon || list.icon, children: [] }] : []),
  ];
  const others = candidates.filter(menu => menu !== dashboard && menu !== list);
  return [...first, ...others];
}

/** The pages of the single Despatch menu, in order, with the name each shows there. */
const DESPATCH_PAGES: Record<string, { name: string; order: number }> = {
  'sales/despatch': { name: 'All Despatches', order: 1 },
  'sales/reports/pending': { name: 'Pending Despatch', order: 2 },
  'sales/reports/despatch': { name: 'Despatch Register', order: 3 },
  'sales/reports/modes': { name: 'Despatch by Mode', order: 4 },
};

/**
 * Despatch is one main menu for sales, spare and repaired parts, right after Sales. Its rows stay
 * under Sales in the database, so the rights ticked on them keep working.
 */
export function groupDespatchMenus(roots: any[], role?: string | null): any[] {
  const found: any[] = [];
  const rest = roots.flatMap(root => {
    if (DESPATCH_PAGES[pathOf(root)]) { found.push(root); return []; }
    const children = root.children ?? [];
    const staying = children.filter((child: any) => {
      if (!DESPATCH_PAGES[pathOf(child)]) return true;
      found.push(child);
      return false;
    });
    if (staying.length === children.length) return [root];
    return staying.length || pathOf(root) ? [{ ...root, children: staying }] : [];
  });
  // a Storekeeper issues parts here, without needing a menu row ticked in the main database
  if (role === 'Storekeeper' && !found.some(menu => pathOf(menu) === 'sales/despatch')) {
    found.push({ menuId: -1001, menuName: 'All Despatches', menuPath: 'sales/despatch', icon: 'local_shipping', children: [] });
  }
  if (!found.length) return roots;

  const group = {
    menuId: -1000, menuName: 'Despatch', menuPath: '', icon: 'local_shipping', parentMenuId: null,
    children: found
      .map(menu => ({ ...menu, menuName: DESPATCH_PAGES[pathOf(menu)].name, children: [] }))
      .sort((a, b) => DESPATCH_PAGES[pathOf(a)].order - DESPATCH_PAGES[pathOf(b)].order),
  };
  const salesAt = rest.findIndex(menu => String(menu.menuName ?? '').trim().toLowerCase() === 'sales');
  const at = salesAt >= 0 ? salesAt + 1 : rest.length;
  return [...rest.slice(0, at), group, ...rest.slice(at)];
}
