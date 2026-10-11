import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, finalize } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../Auth/auth-service';
import {
  CompanyModule,
  ConnectionTestResult,
  PlatformCompany,
  PlatformLocation,
  PlatformMenu,
  PlatformProject,
  PlatformService,
  ProjectAccess,
} from '../../Services/platform-service';

type Tab = 'companies' | 'projects' | 'locations' | 'access' | 'menus';

/**
 * Administration of the main database: companies and their modules, the database each
 * company is stored in, branches, who may open a module, and the menu tree.
 *
 * A platform administrator sees every company. A company administrator sees the
 * own company and can manage its branches and module access.
 */
@Component({
  selector: 'app-platform-admin-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './platform-admin-component.html',
  styleUrl: './platform-admin-component.scss',
})
export class PlatformAdminComponent implements OnInit {
  private api = inject(PlatformService);
  private auth = inject(AuthService);

  isPlatformAdmin = computed(() => !!this.auth.currentUser()?.isPlatformAdmin);

  tab = signal<Tab>('companies');
  loading = signal(false);
  saving = signal(false);
  toast = signal<{ text: string; ok: boolean } | null>(null);

  companies = signal<PlatformCompany[]>([]);
  projects = signal<PlatformProject[]>([]);
  locations = signal<PlatformLocation[]>([]);
  access = signal<ProjectAccess[]>([]);
  menus = signal<PlatformMenu[]>([]);

  /** Company whose Modules dialog is open (null = closed). */
  modulesCompany = signal<PlatformCompany | null>(null);
  companyModules = signal<CompanyModule[]>([]);
  /** Module keys with a switch request in flight. */
  switching = signal<ReadonlySet<string>>(new Set());
  /** Requests of the open Modules dialog; dropped when it closes or another opens. */
  private modulesSub = new Subscription();

  /** Module the Module Access tab works on, and the modules the picked company has. */
  accessModuleKey = signal<string>('SERVICE');
  accessModules = signal<CompanyModule[]>([]);
  /** The modules of the picked company could not be loaded. */
  modulesFailed = signal(false);
  /** Access changes in flight, keyed by company, module and user. */
  accessBusy = signal<ReadonlySet<string>>(new Set());
  /** The running load of the Branches or Module Access tab; dropped when another load starts or the tab changes. */
  private tabSub = new Subscription();
  private tabPending = false;

  /** Project the Locations / Access tabs work on. */
  selectedProjectId = signal<number | null>(null);
  /** Company filter of the Projects tab (0 = all). */
  companyFilter = signal<number>(0);

  activeCompanies = computed(() => this.companies().filter(c => c.isActive).length);
  activeProjects = computed(() => this.projects().filter(p => p.isActive).length);
  topLevelMenus = computed(() => this.menus().filter(m => !m.parentMenuId));
  usersWithAccess = computed(() => this.access().filter(a => a.hasAccess).length);

  // ── edit forms (null = dialog closed) ─────────────────────────────────────
  companyForm: PlatformCompany | null = null;
  projectForm: PlatformProject | null = null;
  locationForm: PlatformLocation | null = null;
  menuForm: PlatformMenu | null = null;

  formError = signal('');
  testing = signal(false);
  testResult = signal<ConnectionTestResult | null>(null);

  // ── access code lock ──────────────────────────────────────────────────────
  /** null = still checking, false = locked (code needed), true = open. */
  unlocked = signal<boolean | null>(null);
  otpSent = signal(false);
  otpSending = signal(false);
  otpVerifying = signal(false);
  otpMessage = signal('');
  otpError = signal('');
  otpCode = '';

  ngOnInit(): void {
    this.api.isUnlocked().subscribe({
      next: res => res.unlocked ? this.open() : this.unlocked.set(false),
      error: () => this.unlocked.set(false),
    });
  }

  private open(): void {
    this.unlocked.set(true);
    this.loadCompanies();
    this.loadProjects();
  }

  sendOtp(): void {
    this.otpError.set('');
    this.otpMessage.set('');
    this.otpSending.set(true);
    this.api.sendOtp().subscribe({
      next: res => {
        this.otpSending.set(false);
        if (res.success) {
          this.otpSent.set(true);
          this.otpCode = '';
          this.otpMessage.set(res.message);
        } else {
          this.otpError.set(res.message);
        }
      },
      error: err => { this.otpSending.set(false); this.otpError.set(this.message(err, 'Could not send the access code')); },
    });
  }

  verifyOtp(): void {
    const code = (this.otpCode || '').trim();
    if (!/^\d{4}$/.test(code)) { this.otpError.set('Enter the 4-digit code'); return; }

    this.otpError.set('');
    this.otpVerifying.set(true);
    this.api.verifyOtp(code).subscribe({
      next: res => {
        this.otpVerifying.set(false);
        if (res.success && res.data?.unlockToken) {
          this.api.setUnlockToken(res.data.unlockToken);
          this.otpCode = '';
          this.otpSent.set(false);
          this.open();
        } else {
          this.otpCode = '';
          this.otpError.set(res.message);
        }
      },
      error: err => { this.otpVerifying.set(false); this.otpError.set(this.message(err, 'Could not check the code')); },
    });
  }

  lockNow(): void {
    this.api.lock();
    this.relock('');
  }

  /** The unlock ran out (or was never there): back to the code screen. */
  private relock(reason: string): void {
    this.closeForms();
    this.companies.set([]); this.projects.set([]); this.locations.set([]);
    this.access.set([]); this.menus.set([]);
    this.accessModules.set([]);
    this.modulesFailed.set(false);
    this.resetTabLoad();
    this.otpSent.set(false);
    this.otpMessage.set('');
    this.otpError.set(reason);
    this.unlocked.set(false);
  }

  private isLocked(err: any): boolean {
    if (err?.status === 403 && err?.error?.code === 'PLATFORM_LOCKED') {
      this.saving.set(false);
      this.loading.set(false);
      this.testing.set(false);
      this.api.lock();
      this.relock('Your Platform Admin session has ended. Request a new access code.');
      return true;
    }
    return false;
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);

    this.resetTabLoad();

    if (tab === 'menus' && !this.menus().length) this.loadMenus();

    if (tab === 'locations' || tab === 'access') {
      // default to the project the admin is working in, else the first one
      if (!this.selectedProjectId()) {
        // a "project" is the company's database: its id is the company id
        const current = this.auth.selectedCompanyId();
        const match = this.projects().find(p => p.projectId === current) ?? this.projects()[0];
        if (match) this.selectedProjectId.set(match.projectId);
      }
      this.loadProjectData();
    }
  }

  onProjectPicked(projectId: number): void {
    this.selectedProjectId.set(projectId);
    this.loadProjectData();
  }

  // ── loading ───────────────────────────────────────────────────────────────

  loadCompanies(): void {
    this.loading.set(true);
    this.api.getCompanies().subscribe({
      next: res => {
        this.loading.set(false);
        if (res.success) this.companies.set(res.data ?? []);
        else this.notify(res.message, false);
      },
      error: err => this.fail(err, 'Could not load companies'),
    });
  }

  loadProjects(): void {
    this.api.getProjects(this.companyFilter()).subscribe({
      next: res => {
        if (res.success) this.projects.set(res.data ?? []);
        else this.notify(res.message, false);
      },
      error: err => this.fail(err, 'Could not load the company databases'),
    });
  }

  onCompanyFilter(companyId: number): void {
    this.companyFilter.set(+companyId);
    this.loadProjects();
  }

  private loadProjectData(): void {
    const projectId = this.selectedProjectId();
    if (!projectId) return;

    this.resetTabLoad();
    this.loading.set(true);
    this.tabPending = true;

    if (this.tab() === 'locations') {
      this.locations.set([]);
      this.tabSub.add(this.api.getLocations(projectId).subscribe({
        next: res => {
          this.tabPending = false;
          this.loading.set(false);
          if (res.success) this.locations.set(res.data ?? []);
          else this.notify(res.message, false);
        },
        error: err => { this.tabPending = false; this.fail(err, 'Could not load the branches'); },
      }));
    } else {
      // the picker holds a company id: a "project" is the company's database
      this.access.set([]);
      this.accessModules.set([]);
      this.modulesFailed.set(false);
      this.tabSub.add(this.api.getCompanyModules(projectId).subscribe({
        next: res => {
          if (!res.success) {
            this.modulesFailed.set(true);
            this.accessModuleKey.set('');
            this.tabPending = false;
            this.loading.set(false);
            this.notify(res.message, false);
            return;
          }
          const enabled = (res.data ?? []).filter(m => m.isEnabled);
          this.accessModules.set(enabled);
          if (!enabled.length) {
            // nothing to ask the server about
            this.accessModuleKey.set('');
            this.access.set([]);
            this.tabPending = false;
            this.loading.set(false);
            return;
          }
          // keep the picked module while the company has it, else fall back to the first
          if (!enabled.some(m => m.moduleKey === this.accessModuleKey()))
            this.accessModuleKey.set(enabled[0].moduleKey);
          this.loadModuleAccess(projectId);
        },
        error: err => {
          this.tabPending = false;
          this.modulesFailed.set(true);
          this.accessModuleKey.set('');
          this.fail(err, 'Could not load the modules');
        },
      }));
    }
  }

  /** Drop the running load of the Branches / Module Access tab so a late answer cannot land in a newer list. */
  private resetTabLoad(): void {
    this.tabSub.unsubscribe();
    this.tabSub = new Subscription();
    if (this.tabPending) { this.tabPending = false; this.loading.set(false); }
  }

  private loadModuleAccess(companyId: number): void {
    this.resetTabLoad();
    this.loading.set(true);
    this.tabPending = true;
    this.tabSub.add(this.api.getModuleAccess(companyId, this.accessModuleKey()).subscribe({
      next: res => {
        this.tabPending = false;
        this.loading.set(false);
        if (res.success) this.access.set(res.data ?? []);
        else this.notify(res.message, false);
      },
      error: err => { this.tabPending = false; this.fail(err, 'Could not load module access'); },
    }));
  }

  onAccessModulePicked(moduleKey: string): void {
    if (!this.accessModuleKey()) return;
    this.accessModuleKey.set(moduleKey);
    const companyId = this.selectedProjectId();
    if (companyId) { this.access.set([]); this.loadModuleAccess(companyId); }
  }

  loadMenus(): void {
    this.loading.set(true);
    this.api.getMenus().subscribe({
      next: res => {
        this.loading.set(false);
        if (res.success) this.menus.set(res.data ?? []);
        else this.notify(res.message, false);
      },
      error: err => this.fail(err, 'Could not load menus'),
    });
  }

  // ── companies ─────────────────────────────────────────────────────────────

  newCompany(): void {
    this.formError.set('');
    this.companyForm = {
      companyId: 0, companyName: '', companyCode: '', address: '', city: '', phoneNumber: '', isActive: true,
    };
  }

  editCompany(company: PlatformCompany): void {
    this.formError.set('');
    this.companyForm = { ...company };
  }

  saveCompany(): void {
    const form = this.companyForm;
    if (!form) return;
    if (!form.companyName.trim() || !form.companyCode.trim()) {
      this.formError.set('Company name and code are required');
      return;
    }

    this.saving.set(true);
    this.api.saveCompany(form).subscribe({
      next: res => {
        this.saving.set(false);
        if (!res.success) { this.formError.set(res.message); return; }
        this.companyForm = null;
        this.notify(res.message, true);
        this.loadCompanies();
      },
      error: err => this.failForm(err),
    });
  }

  // ── modules of a company ──────────────────────────────────────────────────

  openModules(company: PlatformCompany): void {
    this.formError.set('');
    this.modulesCompany.set(company);
    this.companyModules.set([]);
    this.switching.set(new Set());
    this.modulesSub.unsubscribe();
    this.modulesSub = new Subscription();
    this.modulesSub.add(this.api.getCompanyModules(company.companyId).subscribe({
      next: res => {
        if (res.success) this.companyModules.set(res.data ?? []);
        else this.formError.set(res.message);
      },
      error: err => { if (this.isLocked(err)) return; this.formError.set(this.message(err, 'Could not load the modules')); },
    }));
  }

  /** Reload the open dialog's list (without clearing it) so the member counts are real. */
  private refreshModules(companyId: number): void {
    // only the newest reload counts: an older answer must not undo a later switch
    this.refreshSub?.unsubscribe();
    this.refreshSub = this.api.getCompanyModules(companyId).subscribe({
      next: res => { if (res.success) this.companyModules.set(res.data ?? []); },
      error: err => { this.isLocked(err); /* else keep the list as it is */ },
    });
    this.modulesSub.add(this.refreshSub);
  }
  private refreshSub?: Subscription;

  closeModules(): void {
    this.modulesSub.unsubscribe();
    this.modulesSub = new Subscription();
    this.switching.set(new Set());
    this.modulesCompany.set(null);
    this.companyModules.set([]);
    this.formError.set('');
  }

  /** Which modules a company has is a platform decision: others see the list read-only. */
  toggleCompanyModule(module: CompanyModule, event?: Event): void {
    const company = this.modulesCompany();
    if (!company || !this.isPlatformAdmin()) { this.redraw(event, module.isEnabled); return; }

    if (this.switching().has(module.moduleKey)) { this.redraw(event, module.isEnabled); return; }

    const switchOn = !module.isEnabled;
    if (!switchOn && !window.confirm(
      `Switch ${module.moduleName} off for ${company.companyName}? Its people will not be able to open it until it is switched on again.`)) {
      this.redraw(event, module.isEnabled);
      return;
    }

    this.formError.set('');
    const key = module.moduleKey;
    this.switching.update(s => new Set(s).add(key));
    this.modulesSub.add(this.api.setCompanyModule(company.companyId, key, switchOn).pipe(
      finalize(() => this.switching.update(s => { const n = new Set(s); n.delete(key); return n; })),
    ).subscribe({
      next: res => {
        if (!res.success) {
          this.formError.set(res.message);
          this.redraw(event, module.isEnabled);
          return;
        }
        this.companyModules.update(list =>
          list.map(m => m.moduleKey === module.moduleKey ? { ...m, isEnabled: switchOn } : m));
        this.notify(res.message, true);
        this.refreshModules(company.companyId);
      },
      error: err => {
        this.redraw(event, module.isEnabled);
        if (this.isLocked(err)) return;
        this.formError.set(this.message(err, 'Could not switch the module'));
      },
    }));
  }

  /**
   * A click toggles the checkbox before we know the outcome. When the state did
   * not change, the [checked] binding sees the same value and does not touch the
   * element, so put the box back by hand.
   */
  private redraw(event: Event | undefined, checked: boolean): void {
    const box = event?.target as HTMLInputElement | null | undefined;
    if (box) box.checked = checked;
  }

  // ── projects + database ───────────────────────────────────────────────────

  newProject(): void {
    this.formError.set('');
    this.testResult.set(null);
    const company = this.companies().find(c => c.companyId === this.companyFilter()) ?? this.companies()[0];
    this.projectForm = {
      projectId: 0,
      companyId: company?.companyId ?? 0,
      projectName: '',
      projectKey: company ? `${company.companyCode}-P${String((company.projectCount ?? 0) + 1).padStart(3, '0')}` : '',
      isActive: true,
      serverName: '', databaseName: '', dbUser: '', dbPassword: '',
      extraOptions: '',
    };
  }

  editProject(project: PlatformProject): void {
    this.formError.set('');
    this.testResult.set(null);
    this.projectForm = { ...project, dbPassword: '' };
  }

  private projectFormError(form: PlatformProject): string {
    if (!form.companyId) return 'Select the company';
    if (!form.projectName.trim() || !form.projectKey.trim()) return 'Name and key are required';
    if (!form.serverName.trim() || !form.databaseName.trim() || !form.dbUser.trim())
      return 'Server, database and database user are required';
    if (!form.projectId && !form.dbPassword) return 'Database password is required';
    return '';
  }

  testProjectConnection(): void {
    const form = this.projectForm;
    if (!form) return;

    this.formError.set('');
    this.testResult.set(null);
    this.testing.set(true);
    this.api.testConnection(form).subscribe({
      next: res => {
        this.testing.set(false);
        if (res.success && res.data) this.testResult.set(res.data);
        else this.formError.set(res.message);
      },
      error: err => { if (this.isLocked(err)) return; this.testing.set(false); this.formError.set(this.message(err, 'Connection test failed')); },
    });
  }

  saveProject(): void {
    const form = this.projectForm;
    if (!form) return;

    const invalid = this.projectFormError(form);
    if (invalid) { this.formError.set(invalid); return; }

    this.saving.set(true);
    this.api.saveProject(form).subscribe({
      next: res => {
        this.saving.set(false);
        if (!res.success) { this.formError.set(res.message); return; }
        this.projectForm = null;
        this.notify(res.message, true);
        this.loadProjects();
        this.loadCompanies();
      },
      error: err => this.failForm(err),
    });
  }

  // ── locations ─────────────────────────────────────────────────────────────

  newLocation(): void {
    this.formError.set('');
    this.locationForm = { locationId: 0, locationName: '', locationCode: '', address: '', city: '', isActive: true };
  }

  editLocation(location: PlatformLocation): void {
    this.formError.set('');
    this.locationForm = { ...location };
  }

  saveLocation(): void {
    const form = this.locationForm;
    const projectId = this.selectedProjectId();
    if (!form || !projectId) return;
    if (!form.locationName.trim()) { this.formError.set('Branch name is required'); return; }

    this.saving.set(true);
    this.api.saveLocation(projectId, form).subscribe({
      next: res => {
        this.saving.set(false);
        if (!res.success) { this.formError.set(res.message); return; }
        this.locationForm = null;
        this.notify(res.message, true);
        this.loadProjectData();
      },
      error: err => this.failForm(err),
    });
  }

  // ── module access ─────────────────────────────────────────────────────────

  toggleAccess(user: ProjectAccess, event?: Event): void {
    const companyId = this.selectedProjectId();
    const moduleKey = this.accessModuleKey();
    if (!companyId || !moduleKey) { this.redraw(event, user.hasAccess); return; }
    const busyKey = this.accessBusyKey(companyId, moduleKey, user.userId);
    if (this.accessBusy().has(busyKey)) { this.redraw(event, user.hasAccess); return; }

    const grant = !user.hasAccess;
    this.accessBusy.update(s => new Set(s).add(busyKey));
    this.api.setModuleAccess(companyId, moduleKey, user.userId, grant).pipe(
      finalize(() => this.accessBusy.update(s => { const n = new Set(s); n.delete(busyKey); return n; })),
    ).subscribe({
      next: res => {
        this.notify(res.message, res.success);
        if (res.success) {
          // the list may belong to another company or module by now
          if (this.selectedProjectId() === companyId && this.accessModuleKey() === moduleKey)
            this.access.update(list => list.map(a => a.userId === user.userId ? { ...a, hasAccess: grant } : a));
          this.loadProjects();
        } else {
          this.redraw(event, user.hasAccess);
        }
      },
      error: err => {
        this.redraw(event, user.hasAccess);
        if (this.isLocked(err)) return;
        this.notify(this.message(err, 'Could not change access'), false);
      },
    });
  }

  /** Key of one member's access change in flight. */
  accessBusyKey(companyId: number | null, moduleKey: string, userId: number): string {
    return `${companyId}|${moduleKey}|${userId}`;
  }

  // ── menus ─────────────────────────────────────────────────────────────────

  newMenu(): void {
    this.formError.set('');
    this.menuForm = {
      menuId: 0, menuName: '', menuPath: '', icon: '', parentMenuId: null,
      sortOrder: this.menus().length + 1, isActive: true, module: 'Services',
    };
  }

  editMenu(menu: PlatformMenu): void {
    this.formError.set('');
    this.menuForm = { ...menu, parentMenuId: menu.parentMenuId ?? null };
  }

  saveMenu(): void {
    const form = this.menuForm;
    if (!form) return;
    if (!form.menuName.trim()) { this.formError.set('Menu name is required'); return; }

    this.saving.set(true);
    this.api.saveMenu(form).subscribe({
      next: res => {
        this.saving.set(false);
        if (!res.success) { this.formError.set(res.message); return; }
        this.menuForm = null;
        this.notify(res.message, true);
        this.loadMenus();
      },
      error: err => this.failForm(err),
    });
  }

  // ── shared ────────────────────────────────────────────────────────────────

  closeForms(): void {
    this.closeModules();
    this.companyForm = this.projectForm = this.locationForm = this.menuForm = null;
    this.formError.set('');
    this.testResult.set(null);
  }

  selectedProject(): PlatformProject | undefined {
    return this.projects().find(p => p.projectId === this.selectedProjectId());
  }

  private notify(text: string, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Saved' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }

  private message(err: any, fallback: string): string {
    if (err?.status === 403) return 'You are not allowed to do this';
    return err?.error?.message || fallback;
  }

  private fail(err: any, fallback: string): void {
    if (this.isLocked(err)) return;
    this.loading.set(false);
    this.notify(this.message(err, fallback), false);
  }

  private failForm(err: any): void {
    if (this.isLocked(err)) return;
    this.saving.set(false);
    this.formError.set(this.message(err, 'Save failed'));
  }
}
