import { routes } from './app.routes';
import { scopeGuard } from './Encryptz/Auth/guard-guard';

describe('app routes', () => {
  const layout = routes.filter(r => r.children && r.component);
  const children = layout[0].children ?? [];
  const child = (path: string) => children.find(c => c.path === path);

  it('has the three step routes at the top level with their stage', () => {
    const stages = ['company', 'module', 'branch'];
    for (const stage of stages) {
      const route = routes.find(r => r.path === `select-${stage}`);
      expect(route).toBeDefined();
      expect(route?.data?.['stage']).toBe(stage);
    }
  });

  it('has exactly one main layout route and it guards its children with scopeGuard', () => {
    expect(layout.length).toBe(1);
    expect(layout[0].canActivateChild).toContain(scopeGuard);
  });

  it('marks exactly the company-only pages', () => {
    const marked = children.filter(c => c.data?.['scope'] === 'company').map(c => c.path);
    expect(marked.sort()).toEqual(
      ['admin/add-user', 'profile', 'settings/access-management', 'settings/platform', 'settings/roles'],
    );
  });

  it('leaves the business pages unmarked', () => {
    for (const path of ['complaints/dashboard', 'technicians/work-orders', 'products']) {
      const route = child(path);
      expect(route, path).toBeDefined();
      expect(route?.data?.['scope'], path).toBeUndefined();
    }
  });

  it('keeps the step routes out of the main layout', () => {
    for (const path of ['select-company', 'select-module', 'select-branch']) {
      expect(children.some(c => c.path === path)).toBe(false);
    }
  });
});
