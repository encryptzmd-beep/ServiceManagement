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
