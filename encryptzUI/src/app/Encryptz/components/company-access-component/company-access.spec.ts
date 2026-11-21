import { hasAnyPermission, noPermissions, withPermission } from './company-access';

describe('role permissions', () => {
  it('turns View on with any other permission', () => {
    expect(withPermission(undefined, 'canDelete', true)).toEqual({ canView: true, canCreate: false, canEdit: false, canDelete: true });
  });

  it('clears everything when View is taken away', () => {
    const full = { canView: true, canCreate: true, canEdit: true, canDelete: true };
    expect(withPermission(full, 'canView', false)).toEqual(noPermissions());
  });

  it('keeps View when another permission is taken away', () => {
    const p = { canView: true, canCreate: true, canEdit: false, canDelete: false };
    expect(withPermission(p, 'canCreate', false)).toEqual({ ...noPermissions(), canView: true });
  });

  it('knows an empty row', () => {
    expect(hasAnyPermission(noPermissions())).toBe(false);
    expect(hasAnyPermission(undefined)).toBe(false);
    expect(hasAnyPermission({ ...noPermissions(), canView: true })).toBe(true);
  });
});
