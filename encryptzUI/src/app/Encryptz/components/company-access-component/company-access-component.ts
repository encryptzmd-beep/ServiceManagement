import { AppToastComponent } from '../app-toast-component/app-toast-component';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { apiErrorMessage } from '../../Auth/api-error';
import { NotificationBellComponent } from '../notification-bell-component/notification-bell-component';
import {
  ACCESS_LEVELS, AccessModule, AccessOverview, AccessUser, CompanyAccessApi, CompanyRole, PERMISSIONS,
  PermissionKey, Permissions, RoleMenu, hasAnyPermission, noPermissions, withPermission,
} from './company-access';

type Tab = 'users' | 'roles' | 'access';

interface UserDraft {
  userId: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  isActive: boolean;
  isSelf: boolean;
  roleInCompany: string;
  hadRoles: boolean;
  roleIds: number[];
  locationIds: number[];
  canManage: boolean;
}

interface RoleDraft {
  companyRoleId: number;
  roleName: string;
  description: string;
  accessLevel: string;
  moduleKeys: string[];
  perms: Record<number, Permissions>;
}

@Component({
  selector: 'app-company-access',
  standalone: true,
  imports: [AppToastComponent, CommonModule, NotificationBellComponent],
  templateUrl: './company-access-component.html',
  styleUrl: './company-access-component.scss',
})
export class CompanyAccessComponent implements OnInit {
  private api = inject(CompanyAccessApi);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  auth = inject(AuthService);

  readonly accessLevels = ACCESS_LEVELS;
  readonly permissions = PERMISSIONS;

  tab = signal<Tab>('users');
  loading = signal(true);
  loadError = signal('');
  data = signal<AccessOverview | null>(null);
  query = signal('');
  toast = signal('');
  private toastTimer?: ReturnType<typeof setTimeout>;

  // ── user drawer ──
  draft = signal<UserDraft | null>(null);
  userError = signal('');
  savingUser = signal(false);

  // ── role editor ──
  roleDraft = signal<RoleDraft | null>(null);
  activeModule = signal('');
  roleError = signal('');
  savingRole = signal(false);
  confirmDelete = signal(false);

  // ── admin access ──
  grantId = signal(0);
  savingManager = signal(false);
  accessError = signal('');

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.toastTimer));
  }

  ngOnInit(): void { this.load(); }

  get companyName(): string {
    const fromLogin = this.auth.currentUser()?.companyName;
    if (fromLogin) return fromLogin.trim();
    const id = this.auth.selectedCompanyId();
    return this.auth.companies().find(c => c.companyId === id)?.companyName?.trim() ?? '';
  }
  get companyFirst(): string { return this.companyName.split(' ')[0] || 'Company'; }
  get companyRest(): string { return this.companyName.split(' ').slice(1).join(' '); }

  private load(keepRoleId?: number): void {
    this.loadError.set('');
    if (!this.data()) this.loading.set(true);
    this.api.overview().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success || !res.data) { this.loadError.set(res.message || 'Could not load users and roles'); return; }
        this.data.set(res.data);
        const wanted = res.data.roles.find(r => r.companyRoleId === (keepRoleId ?? this.roleDraft()?.companyRoleId));
        if (wanted) this.pickRole(wanted);
        else if (!this.roleDraft() || this.roleDraft()!.companyRoleId > 0) {
          if (res.data.roles.length) this.pickRole(res.data.roles[0]);
          else this.newRole();
        }
      },
      error: err => {
        this.loading.set(false);
        this.loadError.set(apiErrorMessage(err, 'Could not load users and roles'));
      },
    });
  }

  retry(): void { this.load(); }
  backToApps(): void { this.router.navigate(['/select-company']); }

  private flash(text: string): void {
    this.toast.set(text);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3200);
  }

  readonly pageTitle = computed(() => this.tab() === 'users' ? 'Users' : this.tab() === 'roles' ? 'Roles' : 'Admin Access');
  readonly pageSub = computed(() => this.tab() === 'users'
    ? 'Roles decide which apps and menus each person can use'
    : this.tab() === 'roles' ? 'Choose modules, then what each role can do'
    : 'The tenant admin always has access and can grant it to others');

  // ── helpers for the lists ──

  moduleOf(key: string): AccessModule | undefined { return this.data()?.modules.find(m => m.moduleKey === key); }
  moduleNames(keys: string[]): string { return keys.map(k => this.moduleOf(k)?.moduleName).filter(Boolean).join(', '); }
  roleName(id: number): string { return this.data()?.roles.find(r => r.companyRoleId === id)?.roleName ?? ''; }
  levelLabel(value: string): string { return ACCESS_LEVELS.find(l => l.value === value)?.label ?? value; }
  initials(name: string): string {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  userRoleLabels(u: AccessUser): string[] {
    if (u.isTenantAdmin) return ['Tenant Admin'];
    const named = u.roleIds.map(id => this.roleName(id)).filter(Boolean);
    return named.length ? named : [this.levelLabel(u.roleInCompany)];
  }

  branchText(u: AccessUser): string {
    const d = this.data();
    if (!d || d.branchNote) return '—';
    if (u.allBranches || (d.branches.length > 0 && u.locationIds.length === d.branches.length)) return 'All branches';
    if (u.locationIds.length === 0) return 'No branch';
    if (u.locationIds.length > 2) return `${u.locationIds.length} branches`;
    return u.locationIds.map(id => d.branches.find(b => b.locationId === id)?.locationName).filter(Boolean).join(', ');
  }

  /** A person who was only granted this access cannot change themselves or an administrator. */
  canEdit(u: AccessUser): boolean {
    const d = this.data();
    return !!d && !u.isTenantAdmin && (d.canGrant || u.userId !== d.actorUserId);
  }

  readonly filteredUsers = computed(() => {
    const users = this.data()?.users ?? [];
    const term = this.query().trim().toLowerCase();
    return term ? users.filter(u => u.fullName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)) : users;
  });

  readonly managers = computed(() => (this.data()?.users ?? []).filter(u => u.canManage && u.isActive));
  readonly grantable = computed(() => (this.data()?.users ?? []).filter(u => !u.canManage && u.isActive));

  // ── user drawer ──

  addUser(): void {
    this.userError.set('');
    this.draft.set({
      userId: 0, fullName: '', email: '', mobileNumber: '', password: '', isActive: true, isSelf: false,
      roleInCompany: '', hadRoles: false, roleIds: [],
      locationIds: (this.data()?.branches ?? []).map(b => b.locationId), canManage: false,
    });
  }

  editUser(u: AccessUser): void {
    if (!this.canEdit(u)) return;
    this.userError.set('');
    this.draft.set({
      userId: u.userId, fullName: u.fullName, email: u.email, mobileNumber: u.mobileNumber, password: '',
      isActive: u.isActive, isSelf: u.userId === this.data()?.actorUserId, roleInCompany: u.roleInCompany,
      hadRoles: u.roleIds.length > 0, roleIds: [...u.roleIds], locationIds: [...u.locationIds], canManage: u.canManage,
    });
  }

  closeUser(): void {
    if (!this.savingUser()) this.draft.set(null);
  }

  patchDraft(patch: Partial<UserDraft>): void {
    this.draft.update(d => d ? { ...d, ...patch } : d);
    this.userError.set('');
  }

  toggleDraftRole(id: number, on: boolean): void {
    const d = this.draft();
    if (d) this.patchDraft({ roleIds: on ? [...d.roleIds, id] : d.roleIds.filter(x => x !== id) });
  }

  toggleDraftBranch(id: number, on: boolean): void {
    const d = this.draft();
    if (d) this.patchDraft({ locationIds: on ? [...d.locationIds, id] : d.locationIds.filter(x => x !== id) });
  }

  readonly draftApps = computed(() => {
    const d = this.draft();
    const data = this.data();
    if (!d || !data) return '';
    if (!d.roleIds.length) {
      const current = data.users.find(u => u.userId === d.userId);
      return current?.moduleKeys.length ? this.moduleNames(current.moduleKeys) : 'Choose a role to see the apps';
    }
    const keys = new Set(data.roles.filter(r => d.roleIds.includes(r.companyRoleId)).flatMap(r => r.moduleKeys));
    return data.modules.filter(m => keys.has(m.moduleKey)).map(m => m.moduleName).join(', ');
  });

  saveUser(): void {
    const d = this.draft();
    const data = this.data();
    if (!d || !data || this.savingUser()) return;

    if (d.userId === 0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) { this.userError.set('Enter a valid email.'); return; }
      if (!d.roleIds.length) { this.userError.set('Choose at least one role.'); return; }
    } else if (d.hadRoles && !d.roleIds.length) {
      this.userError.set('Choose at least one role.');
      return;
    }
    const usesBranches = !data.branchNote && data.branches.length > 0;
    if (d.isActive && usesBranches && !d.locationIds.length) { this.userError.set('Choose at least one branch.'); return; }

    this.savingUser.set(true);
    this.api.saveUser({
      userId: d.userId, fullName: d.fullName.trim(), email: d.email.trim(), mobileNumber: d.mobileNumber.trim(),
      password: d.password, isActive: d.isActive, roleIds: d.roleIds,
      locationIds: usesBranches ? d.locationIds : null, canManage: d.canManage,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.savingUser.set(false);
        if (!res.success) { this.userError.set(res.message || 'The user could not be saved'); return; }
        this.draft.set(null);
        this.flash(res.message || 'User saved');
        this.load();
      },
      error: err => {
        this.savingUser.set(false);
        this.userError.set(apiErrorMessage(err, 'The user could not be saved'));
      },
    });
  }

  // ── role editor ──

  pickRole(role: CompanyRole): void {
    const perms: Record<number, Permissions> = {};
    role.menus.forEach(m => perms[m.menuId] = {
      canView: m.canView, canCreate: m.canCreate, canEdit: m.canEdit, canDelete: m.canDelete,
    });
    this.roleDraft.set({
      companyRoleId: role.companyRoleId, roleName: role.roleName, description: role.description,
      accessLevel: role.accessLevel, moduleKeys: [...role.moduleKeys], perms,
    });
    this.activeModule.set(this.data()?.modules.find(m => role.moduleKeys.includes(m.moduleKey))?.moduleKey ?? '');
    this.roleError.set('');
    this.confirmDelete.set(false);
  }

  newRole(): void {
    this.roleDraft.set({ companyRoleId: 0, roleName: '', description: '', accessLevel: 'Manager', moduleKeys: [], perms: {} });
    this.activeModule.set('');
    this.roleError.set('');
    this.confirmDelete.set(false);
  }

  patchRole(patch: Partial<RoleDraft>): void {
    this.roleDraft.update(r => r ? { ...r, ...patch } : r);
    this.roleError.set('');
  }

  readonly selectedModules = computed(() => {
    const keys = this.roleDraft()?.moduleKeys ?? [];
    return (this.data()?.modules ?? []).filter(m => keys.includes(m.moduleKey));
  });

  readonly currentModule = computed(() => {
    const list = this.selectedModules();
    return list.find(m => m.moduleKey === this.activeModule()) ?? list[0] ?? null;
  });

  readonly canDeleteRole = computed(() => {
    const r = this.roleDraft();
    const saved = this.data()?.roles.find(x => x.companyRoleId === r?.companyRoleId);
    return !!saved && saved.userCount === 0;
  });

  toggleModule(m: AccessModule, on: boolean): void {
    const r = this.roleDraft();
    if (!r) return;
    const perms = { ...r.perms };
    if (on) {
      m.menus.forEach(menu => perms[menu.menuId] = perms[menu.menuId] ?? { ...noPermissions(), canView: true });
      this.patchRole({ moduleKeys: [...r.moduleKeys, m.moduleKey], perms });
      this.activeModule.set(m.moduleKey);
    } else {
      m.menus.forEach(menu => delete perms[menu.menuId]);
      this.patchRole({ moduleKeys: r.moduleKeys.filter(k => k !== m.moduleKey), perms });
    }
  }

  isOn(menuId: number, key: PermissionKey): boolean { return !!this.roleDraft()?.perms[menuId]?.[key]; }

  setCell(menuId: number, key: PermissionKey, on: boolean): void {
    const r = this.roleDraft();
    if (r) this.patchRole({ perms: { ...r.perms, [menuId]: withPermission(r.perms[menuId], key, on) } });
  }

  columnOn(key: PermissionKey): boolean {
    const menus = this.currentModule()?.menus ?? [];
    return menus.length > 0 && menus.every(m => this.isOn(m.menuId, key));
  }

  setColumn(key: PermissionKey, on: boolean): void {
    const r = this.roleDraft();
    const menus = this.currentModule()?.menus ?? [];
    if (!r) return;
    const perms = { ...r.perms };
    menus.forEach(m => perms[m.menuId] = withPermission(perms[m.menuId], key, on));
    this.patchRole({ perms });
  }

  fullAccess(): boolean { return this.permissions.every(p => this.columnOn(p.key)); }

  setFullAccess(on: boolean): void {
    const r = this.roleDraft();
    const menus = this.currentModule()?.menus ?? [];
    if (!r) return;
    const perms = { ...r.perms };
    menus.forEach(m => perms[m.menuId] = on
      ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : noPermissions());
    this.patchRole({ perms });
  }

  saveRole(): void {
    const r = this.roleDraft();
    const data = this.data();
    if (!r || !data || this.savingRole()) return;

    if (!r.roleName.trim()) { this.roleError.set('Enter a role name.'); return; }
    if (!r.moduleKeys.length) { this.roleError.set('Choose at least one module.'); return; }
    const empty = this.selectedModules().find(m => m.menus.length > 0 && !m.menus.some(x => hasAnyPermission(r.perms[x.menuId])));
    if (empty) { this.roleError.set(`Give at least one permission in ${empty.moduleName}.`); return; }

    const allowed = new Set(this.selectedModules().flatMap(m => m.menus.map(x => x.menuId)));
    const menus: RoleMenu[] = Object.entries(r.perms)
      .map(([id, p]) => ({ menuId: +id, ...p }))
      .filter(m => allowed.has(m.menuId) && hasAnyPermission(m));

    this.savingRole.set(true);
    this.api.saveRole({
      companyRoleId: r.companyRoleId, roleName: r.roleName.trim(), description: r.description.trim(),
      accessLevel: r.accessLevel, moduleKeys: r.moduleKeys, menus,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.savingRole.set(false);
        if (!res.success) { this.roleError.set(res.message || 'The role could not be saved'); return; }
        this.flash('Role saved');
        this.load(res.data);
      },
      error: err => {
        this.savingRole.set(false);
        this.roleError.set(apiErrorMessage(err, 'The role could not be saved'));
      },
    });
  }

  deleteRole(): void {
    const r = this.roleDraft();
    if (!r || !r.companyRoleId) return;
    this.confirmDelete.set(false);
    this.api.deleteRole(r.companyRoleId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        if (!res.success) { this.roleError.set(res.message || 'The role could not be deleted'); return; }
        this.roleDraft.set(null);
        this.flash('Role deleted');
        this.load();
      },
      error: err => this.roleError.set(apiErrorMessage(err, 'The role could not be deleted')),
    });
  }

  // ── admin access ──

  setManager(userId: number, enabled: boolean): void {
    if (!userId || this.savingManager()) return;
    this.savingManager.set(true);
    this.accessError.set('');
    this.api.setManager(userId, enabled).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.savingManager.set(false);
        if (!res.success) { this.accessError.set(res.message || 'The access could not be changed'); return; }
        this.grantId.set(0);
        this.flash(res.message || 'Saved');
        this.load();
      },
      error: err => {
        this.savingManager.set(false);
        this.accessError.set(apiErrorMessage(err, 'The access could not be changed'));
      },
    });
  }

  valueOf(event: Event): string { return (event.target as HTMLInputElement).value; }
  checkedOf(event: Event): boolean { return (event.target as HTMLInputElement).checked; }
  numberOf(event: Event): number { return Number((event.target as HTMLSelectElement).value) || 0; }
}
