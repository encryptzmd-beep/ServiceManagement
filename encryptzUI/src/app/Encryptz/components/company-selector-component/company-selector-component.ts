import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { NotificationBellComponent } from '../notification-bell-component/notification-bell-component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize, interval, timeout } from 'rxjs';
import { AuthService, Company } from '../../Auth/auth-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocationDto, ModuleDto, PersonalApp } from '../../Models/ApiModels';
import { branchDecision, landingRouteForRole, moduleCaption } from '../../Auth/scope-flow';
import {
  anyProvisioning, canEnter, CompanyCreationState, emptyCompanyForm, NewCompanyForm, POLL_LIMIT_MS, POLL_MS,
  provisionLabel, requestErrorMessage, suggestCompanyCode, validateNewCompany
} from '../../Auth/company-creation';

type Stage = 'company' | 'module' | 'branch';

/** The search box shows only when there are more companies than this. */
const SEARCH_ABOVE = 6;

/**
 * Commercial applications whose pages need no branch (they do not work on the database
 * of the company): opening one goes straight to its first page.
 */
const MODULE_HOME: Record<string, string> = {
  JOBCONSULTANCY: '/consultancy/dashboard',
};

@Component({
  selector: 'app-company-selector-component',
  imports: [CommonModule, FormsModule, NotificationBellComponent],
  templateUrl: './company-selector-component.html',
  styleUrl: './company-selector-component.scss',
})
export class CompanySelectorComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  userId = this.auth.userId();
  loading = signal(true);
  error = signal('');

  /** Which of the three steps this route shows (route data). */
  stage = signal<Stage>('company');

  companies = signal<Company[]>([]);
  /** What the user typed to find a company (name or code). */
  search = signal('');
  showSearch = computed(() => this.companies().length > SEARCH_ABOVE);
  filteredCompanies = computed(() => {
    const term = this.showSearch() ? this.search().trim().toLowerCase() : '';
    if (!term) return this.companies();
    return this.companies().filter(c =>
      (c.companyName || '').toLowerCase().includes(term) || (c.companyCode || '').toLowerCase().includes(term));
  });
  modules = signal<ModuleDto[]>([]);
  /** Empty also when the list could not be read: it never blocks the companies. */
  personalApps = signal<PersonalApp[]>([]);
  branches = signal<LocationDto[]>([]);
  /** The branch step found no branch for this user. */
  noBranch = signal(false);
  /** A single branch is being entered without asking. */
  entering = signal(false);

  private destroyRef = inject(DestroyRef);

  // ── creating a company ────────────────────────────────────────────
  /** Whether this user may create a company now (null = not known yet). */
  creation = signal<CompanyCreationState | null>(null);
  /** The creation state could not be read and is still not known. */
  creationFailed = signal(false);
  showCreate = signal(false);
  createForm: NewCompanyForm = emptyCompanyForm();
  createError = signal('');
  creating = signal(false);
  /** The code follows the name until the user types a code. */
  private codeTyped = false;
  /** Company whose set-up is being retried (null = none). */
  retrying = signal<number | null>(null);

  // ── watching a set-up ─────────────────────────────────────────────
  polling = signal(false);
  /** Polling ran out of time while a company was still being set up. */
  pollStopped = signal(false);
  private pollSub?: Subscription;
  private pollStarted = 0;
  private gone = false;
  /** A company is being entered: late answers must not touch the screen. */
  private enteringCompany = false;
  /** Number of the latest refresh; an answer of an older one is ignored. */
  private refreshSeq = 0;
  /** A refresh of the list is still on its way. */
  private refreshing = false;
  /** A create / retry went through but the list could not be read: keep asking until it shows. */
  private expectSetUp = false;

  private moduleKey = '';

  constructor() {
    this.destroyRef.onDestroy(() => { this.gone = true; this.stopPolling(); });
  }

  // Change Password States
  showChangePasswordModal = signal(false);
  changePasswordOld = '';
  changePasswordNew = '';
  changePasswordConfirm = '';
  changePasswordLoading = signal(false);
  changePasswordError = signal('');
  changePasswordSuccess = signal('');

  ngOnInit() {
    const stage = this.route.snapshot.data['stage'] as Stage | undefined;
    this.stage.set(stage ?? 'company');

    if ((this.stage() === 'module' || this.stage() === 'branch') && !this.auth.scopeState().companyId) {
      this.router.navigate(['/select-company'], { replaceUrl: true });
      return;
    }

    // after a reload on the module or branch step the list is not in memory: the name of
    // the company in the switcher and the user menu comes from it
    if (this.stage() !== 'company' && this.auth.companies().length === 0) {
      this.auth.getUserCompanies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
    }

    if (this.stage() === 'module') {
      this.loadModules();
    } else if (this.stage() === 'branch') {
      this.moduleKey = this.route.snapshot.queryParamMap.get('module') || this.auth.selectedModuleKey() || '';
      if (!this.moduleKey) {
        this.router.navigate(['/select-module'], { replaceUrl: true });
        return;
      }
      this.loadBranches();
    } else {
      this.loadCompanies();
    }
  }

  /** Reload whatever this step shows (the Retry button). */
  reload(): void {
    this.pollStopped.set(false);
    this.creationFailed.set(false);
    this.error.set('');
    if (this.stage() === 'module') this.loadModules();
    else if (this.stage() === 'branch') this.loadBranches();
    else this.loadCompanies();
  }

  // ── STEP 1: COMPANY ───────────────────────────────────────────────

  loadCompanies() {
    // what login kept is shown at once; the API has the current statuses
    let kept = this.auth.companies();
    if (kept.length === 0) {
      try {
        const temp = localStorage.getItem('temp_login');
        if (temp) kept = JSON.parse(temp).companies || [];
      } catch { kept = []; }
    }

    this.companies.set(kept);
    this.loading.set(kept.length === 0);
    this.watchSetUps();
    this.refreshCompanies(() => {
      if (kept.length === 0) this.error.set('Could not load your companies. Please try again.');
    });
    this.loadPersonalApps();
  }

  /** Reads the list and the creation state again, without the spinner. */
  private refreshCompanies(onError?: () => void): void {
    const seq = ++this.refreshSeq;
    this.refreshing = true;
    this.auth.getUserCompanies().pipe(
      timeout(20000),
      finalize(() => { if (seq === this.refreshSeq) this.refreshing = false; }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (list) => {
        if (this.gone || this.enteringCompany || seq !== this.refreshSeq) return;
        this.loading.set(false);
        this.companies.set(list);
        this.expectSetUp = false;
        this.watchSetUps();
      },
      error: () => {
        if (this.gone || this.enteringCompany || seq !== this.refreshSeq) return;
        this.loading.set(false);
        onError?.();
      }
    });

    this.auth.getCompanyCreation().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (this.gone || this.enteringCompany || seq !== this.refreshSeq) return;
        // a failed read keeps what was known before (null when nothing was)
        this.creation.set(res.success ? res.data ?? this.creation() : this.creation());
        this.creationFailed.set(!this.creation());
      },
      error: () => {
        // keeps the previous state; it is null when nothing was known yet
        if (this.gone || this.enteringCompany || seq !== this.refreshSeq) return;
        this.creationFailed.set(!this.creation());
      }
    });
  }

  selectCompany(company: Company) {
    if (!canEnter(company.provisionStatus)) return;
    if (this.enteringCompany) return;
    this.enteringCompany = true;
    this.stopPolling();
    this.loading.set(true);

    this.auth.selectCompany(company.companyId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.loading.set(false);

        if (!res.success || !res.data) {
          this.enteringCompany = false;
          this.error.set(res.message || 'Failed to select company');
          this.watchSetUps();
          return;
        }

        this.router.navigate(['/select-module']);
      },
      error: () => {
        this.loading.set(false);
        this.enteringCompany = false;
        this.error.set('Failed to select company');
        this.watchSetUps();
      }
    });
  }

  /** Text of a company whose database is not ready ('' when it is). */
  companyStatus(company: Company): string {
    return provisionLabel(company.provisionStatus);
  }

  /** Up to two letters that stand for a company on its card. */
  initials(name: string): string {
    const words = (name || '').split(/[^A-Za-z0-9]+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '').slice(0, 2);
    return letters.toUpperCase() || '?';
  }

  enterable(company: Company): boolean {
    return canEnter(company.provisionStatus);
  }

  /** Space / Enter on the row itself (not on a button inside it). */
  onRowKey(company: Company, event: Event, preventDefault = false): void {
    if (event.target !== event.currentTarget) return;
    if (preventDefault) event.preventDefault();
    this.selectCompany(company);
  }

  // ── creating a company ────────────────────────────────────────────

  openCreate(): void {
    if (!this.creation()?.canCreate) return;
    this.createForm = emptyCompanyForm();
    this.codeTyped = false;
    this.createError.set('');
    this.error.set('');
    this.showCreate.set(true);
  }

  closeCreate(): void {
    this.showCreate.set(false);
    this.createError.set('');
  }

  onNameTyped(): void {
    if (!this.codeTyped) this.createForm.companyCode = suggestCompanyCode(this.createForm.companyName);
  }

  onCodeTyped(): void {
    this.codeTyped = true;
  }

  submitCreate(): void {
    if (this.creating()) return;

    const problem = validateNewCompany(this.createForm);
    if (problem) { this.createError.set(problem); return; }

    this.createError.set('');
    this.creating.set(true);
    this.auth.createCompany(this.createForm).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.creating.set(false);
        if (!res.success) { this.createError.set(res.message || 'Could not create the company'); return; }
        this.showCreate.set(false);
        this.error.set('');
        this.pollStarted = Date.now();
        this.expectSetUp = true;
        this.refreshCompanies(() => this.watchSetUps());
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(requestErrorMessage(err, 'Could not create the company'));
        // the answer may have been lost after the company was made
        this.refreshCompanies();
      }
    });
  }

  /** Retry of a failed set-up: by the user who created the company. */
  retry(company: Company, event?: Event): void {
    event?.stopPropagation();
    if (this.retrying() !== null) return;

    this.error.set('');
    this.retrying.set(company.companyId);
    this.auth.retryProvision(company.companyId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.retrying.set(null);
        if (!res.success) {
          this.error.set(res.message || 'Could not retry the set-up');
          this.refreshCompanies();
          return;
        }
        this.pollStarted = Date.now();
        this.companies.update(list => list.map(c => c.companyId === company.companyId ? { ...c, provisionStatus: 'Provisioning' } : c));
        this.refreshCompanies(() => this.watchSetUps());
      },
      error: (err) => {
        this.retrying.set(null);
        this.error.set(requestErrorMessage(err, 'Could not retry the set-up'));
        this.refreshCompanies();
      }
    });
  }

  openInvitations(): void {
    this.router.navigate(['/no-company']);
  }

  // ── watching a set-up ─────────────────────────────────────────────

  /** Starts or stops asking again, depending on whether a company is being set up. */
  private watchSetUps(): void {
    if (!anyProvisioning(this.companies()) && !this.expectSetUp) { this.stopPolling(); return; }
    if (this.pollSub) return;

    this.pollStopped.set(false);
    this.pollStarted = Date.now();
    this.polling.set(true);
    this.pollSub = interval(POLL_MS).subscribe(() => {
      if (Date.now() - this.pollStarted >= POLL_LIMIT_MS) {
        this.stopPolling();
        this.pollStopped.set(true);
        return;
      }
      this.pollOnce();
    });
  }

  /** One round of asking again (also called by the timer). */
  pollOnce(): void {
    if (this.gone || this.refreshing) return;
    this.refreshCompanies();
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    this.expectSetUp = false;
    this.polling.set(false);
  }

  /** The user's lifelong ID as it is shown ('' when the account has none yet). */
  individualId(): string {
    return this.auth.currentUser()?.individualId || '';
  }

  /** Name of the signed-in user, for the top bar ('' when not known). */
  userName(): string {
    return this.auth.currentUser()?.fullName || '';
  }

  // ── PERSONAL APPLICATIONS (company step only) ─────────────────────

  private loadPersonalApps(): void {
    this.auth.getPersonalApps().pipe(timeout(20000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => { if (!this.gone) this.personalApps.set(res.success ? res.data ?? [] : []); },
      error: () => { if (!this.gone) this.personalApps.set([]); },
    });
  }

  /** Released, with a path inside this application to open. */
  canOpenPersonalApp(app: PersonalApp): boolean {
    return app.isReleased && /^\/(?!\/)[A-Za-z0-9\-_\/]*$/.test(app.routePath || '');
  }

  openPersonalApp(app: PersonalApp): void {
    if (!this.canOpenPersonalApp(app)) return;
    this.router.navigateByUrl(app.routePath);
  }

  // ── WORKSPACE LAYOUT ──────────────────────────────────────────────

  /** The workspace switcher in the sidebar and the user menu in the top bar. */
  menuOpen = signal(false);
  userMenuOpen = signal(false);

  /** What the user typed in the top bar to find one of their applications. */
  appSearch = signal('');
  filteredApps = computed(() => {
    const term = this.appSearch().trim().toLowerCase();
    if (!term) return this.personalApps();
    return this.personalApps().filter(a => (a.moduleName || '').toLowerCase().includes(term));
  });

  /** The Job Portal of the catalogue, when it can be opened (for "View All" of the job matches). */
  jobPortal = computed(() => this.personalApps().find(a => a.moduleKey === 'JOBPORTAL' && this.canOpenPersonalApp(a)) ?? null);

  /** The summary cards; the applications behind them fill them in once they are released. */
  readonly insights = [
    { title: 'Total Expenses', icon: 'currency_rupee', tone: 'violet' },
    { title: 'Income', icon: 'savings', tone: 'green' },
    { title: 'Active Tasks', icon: 'assignment', tone: 'orange' },
    { title: 'Jobs Applied', icon: 'work_outline', tone: 'sky' },
  ];

  readonly spending = [
    { label: 'Food', color: '#3B82F6' },
    { label: 'Transport', color: '#8B5CF6' },
    { label: 'Shopping', color: '#F59E0B' },
    { label: 'Bills', color: '#10B981' },
  ];

  private static readonly Tones = ['blue', 'green', 'orange', 'teal', 'red', 'violet', 'sky', 'purple'];

  /** A colour for the n-th icon tile, so neighbouring tiles differ. */
  tone(i: number): string {
    return CompanySelectorComponent.Tones[i % CompanySelectorComponent.Tones.length];
  }

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
    this.userMenuOpen.set(false);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update(v => !v);
    this.menuOpen.set(false);
  }

  /** A click anywhere else closes the menus (the menus stop their own clicks). */
  @HostListener('document:click')
  closeMenus(): void {
    this.menuOpen.set(false);
    this.userMenuOpen.set(false);
  }

  goPersonal(): void {
    this.menuOpen.set(false);
    if (this.stage() !== 'company') this.backToCompanies();
  }

  greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  }

  firstName(): string {
    return this.userName().trim().split(/\s+/)[0] || '';
  }

  /** Name of the company being opened (module and branch steps). */
  currentCompanyName(): string {
    const id = this.auth.scopeState().companyId;
    return this.auth.companies().find(c => c.companyId === id)?.companyName || 'Company';
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollToTop(): void {
    document.querySelector('.ws-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── STEP 2: MODULE ────────────────────────────────────────────────

  private loadModules(): void {
    this.loading.set(true);
    this.auth.getModules().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (!res.success) {
          this.error.set(res.message || 'Could not load the modules');
          return;
        }
        this.modules.set(res.data || []);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load the modules. Please try again.');
      }
    });
  }

  caption(module: ModuleDto): string {
    return moduleCaption(module.state);
  }

  openModule(module: ModuleDto): void {
    if (module.state !== 'Available') return;

    // an application whose pages need no branch opens at once
    const home = MODULE_HOME[module.moduleKey?.toUpperCase()];
    if (home) { this.router.navigate([home]); return; }

    this.router.navigate(['/select-branch'], { queryParams: { module: module.moduleKey } });
  }

  /** Administrators of a company can work on it before any module can be opened. */
  canAdminister(): boolean {
    const role = this.auth.userRole();
    return role === 'Admin' || role === 'CompanyAdmin' || !!this.auth.currentUser()?.isPlatformAdmin;
  }

  openAdministration(): void {
    this.router.navigate(['/settings/platform']);
  }


  // ── STEP 3: BRANCH ────────────────────────────────────────────────

  private loadBranches(): void {
    this.loading.set(true);
    this.noBranch.set(false);
    this.auth.getBranches(this.moduleKey).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (!res.success) {
          this.error.set(res.message || 'Could not load the branches');
          return;
        }

        const list = res.data || [];
        this.branches.set(list);

        const decision = branchDecision(list.length);
        if (decision === 'none') {
          this.noBranch.set(true);
        } else if (decision === 'auto') {
          this.entering.set(true);
          this.enterBranch(list[0]);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load the branches. Please try again.');
      }
    });
  }

  enterBranch(branch: LocationDto): void {
    // an automatic entry (single branch) must not leave this step in the browser history
    const extras = this.entering() ? { replaceUrl: true } : undefined;
    this.loading.set(true);
    this.error.set('');

    this.auth.setScope(this.moduleKey, branch.locationId, branch.locationName).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.router.navigate([landingRouteForRole(res.data.role)], extras);
          return;
        }
        // leave the "entering" spinner so the reason and the list are visible
        this.entering.set(false);
        this.error.set(res.message || 'Could not open this branch');
      },
      error: (err) => {
        this.loading.set(false);
        this.entering.set(false);
        this.error.set(err?.name === 'TimeoutError'
          ? 'Opening the branch timed out. Please try again.'
          : 'Could not open this branch. Please try again.');
      }
    });
  }

  backToCompanies(): void {
    this.router.navigate(['/select-company']);
  }

  backToModules(): void {
    this.router.navigate(['/select-module']);
  }

  getRoleClass(role: string): string {
    return role.toLowerCase();
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  // ============================================
  // CHANGE PASSWORD METHODS
  // ============================================

  openChangePassword(): void {
    this.showChangePasswordModal.set(true);
    this.changePasswordOld = '';
    this.changePasswordNew = '';
    this.changePasswordConfirm = '';
    this.changePasswordError.set('');
    this.changePasswordSuccess.set('');
  }

  closeChangePassword(): void {
    this.showChangePasswordModal.set(false);
  }

  submitChangePassword(): void {
    if (!this.changePasswordOld || !this.changePasswordNew || !this.changePasswordConfirm) {
      this.changePasswordError.set('Please fill all fields');
      return;
    }

    if (this.changePasswordNew !== this.changePasswordConfirm) {
      this.changePasswordError.set('New password and confirm password do not match');
      return;
    }

    this.changePasswordLoading.set(true);
    this.changePasswordError.set('');
    this.changePasswordSuccess.set('');
 const currentUser = this.auth.currentUser();
 let userId ;
 if (currentUser && currentUser.userId) {
   userId = currentUser.userId;
 } else {
   this.changePasswordLoading.set(false);
   this.changePasswordError.set('User not found. Please login again.');
   return;
 }
    this.auth.changePassword({
      oldPassword: this.changePasswordOld,
      newPassword: this.changePasswordNew,
      userId: currentUser.userId,
      Username: currentUser.fullName
    }).subscribe({
      next: (res) => {
        this.changePasswordLoading.set(false);
        if (res.success) {
          this.changePasswordSuccess.set('Password changed successfully! You will be logged out.');
          setTimeout(() => {
            this.closeChangePassword();
            this.logout();
          }, 2500);
        } else {
          this.changePasswordError.set(res.message || 'Failed to change password');
        }
      },
      error: () => {
        this.changePasswordLoading.set(false);
        this.changePasswordError.set('Network error occurred. Please try again.');
      }
    });
  }
}
