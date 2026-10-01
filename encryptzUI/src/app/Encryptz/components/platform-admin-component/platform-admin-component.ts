import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../Auth/auth-service';
import {
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
 * Administration of the main database: companies, projects and the database each
 * project is stored in, locations, who may enter a project, and the menu tree.
 *
 * A platform administrator sees every company. A company administrator sees the
 * own company and can manage its locations and project access.
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

    if (tab === 'menus' && !this.menus().length) this.loadMenus();

    if (tab === 'locations' || tab === 'access') {
      // default to the project the admin is working in, else the first one
      if (!this.selectedProjectId()) {
        const current = this.auth.selectedProjectId();
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
      error: err => this.fail(err, 'Could not load projects'),
    });
  }

  onCompanyFilter(companyId: number): void {
    this.companyFilter.set(+companyId);
    this.loadProjects();
  }

  private loadProjectData(): void {
    const projectId = this.selectedProjectId();
    if (!projectId) return;

    this.loading.set(true);

    if (this.tab() === 'locations') {
      this.locations.set([]);
      this.api.getLocations(projectId).subscribe({
        next: res => {
          this.loading.set(false);
          if (res.success) this.locations.set(res.data ?? []);
          else this.notify(res.message, false);
        },
        error: err => this.fail(err, 'Could not load locations'),
      });
    } else {
      this.access.set([]);
      this.api.getProjectAccess(projectId).subscribe({
        next: res => {
          this.loading.set(false);
          if (res.success) this.access.set(res.data ?? []);
          else this.notify(res.message, false);
        },
        error: err => this.fail(err, 'Could not load project access'),
      });
    }
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
    if (!form.projectName.trim() || !form.projectKey.trim()) return 'Project name and key are required';
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
    if (!form.locationName.trim()) { this.formError.set('Location name is required'); return; }

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

  // ── project access ────────────────────────────────────────────────────────

  toggleAccess(user: ProjectAccess): void {
    const projectId = this.selectedProjectId();
    if (!projectId) return;

    const grant = !user.hasAccess;
    this.api.setProjectAccess(projectId, user.userId, grant).subscribe({
      next: res => {
        this.notify(res.message, res.success);
        if (res.success) {
          this.access.update(list => list.map(a => a.userId === user.userId ? { ...a, hasAccess: grant } : a));
          this.loadProjects();
        }
      },
      error: err => this.fail(err, 'Could not change access'),
    });
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
