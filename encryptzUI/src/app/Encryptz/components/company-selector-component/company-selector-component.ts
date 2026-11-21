import { UppercaseInputDirective } from '../shared/uppercase-input';
import { Component, DestroyRef, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { NotificationBellComponent } from '../notification-bell-component/notification-bell-component';
import { moduleLanding, moduleRoute } from '../shared/module-route';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, finalize, interval, timeout } from 'rxjs';
import { AuthService, Company } from '../../Auth/auth-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocationDto, ModuleDto, PersonalApp } from '../../Models/ApiModels';
import { branchDecision, branchToEnter, moduleCaption } from '../../Auth/scope-flow';
import {
  anyProvisioning, canEnter, CompanyCreationState, emptyCompanyForm, NewCompanyForm, POLL_LIMIT_MS, POLL_MS,
  provisionLabel, requestErrorMessage, suggestCompanyCode, validateNewCompany
} from '../../Auth/company-creation';

type Stage = 'company' | 'branch';

/** One application on the home screen. */
interface HomeApp {
  key: string;
  label: string;
  description: string;
  icon: string;
  /** Colour of its icon. */
  tone: string;
  disabled: boolean;
  /** Why it cannot be opened ('' when it can). */
  note: string;
  open: () => void;
}

/** Icon colour of each application; a new application gets the neutral one. */
const APP_TONES: Record<string, string> = {
  SERVICE: 'blue', CRM: 'orange', JOBCONSULTANCY: 'purple', INVENTORY: 'green', ACCOUNTS: 'navy',
  PAYROLL: 'lime', SCHOOL: 'amber', JOBPORTAL: 'blue', EXPENSE: 'lime',
};
const appTone = (key: string): string => APP_TONES[(key || '').toUpperCase()] ?? 'slate';

/** The search box shows only when there are more companies than this. */
const SEARCH_ABOVE = 6;


@Component({
  selector: 'app-company-selector-component',
  imports: [UppercaseInputDirective, CommonModule, FormsModule, RouterModule, NotificationBellComponent],
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

    if (this.stage() === 'branch' && !this.auth.scopeState().companyId) {
      this.router.navigate(['/select-company'], { replaceUrl: true });
      return;
    }

    // after a reload on the branch step the list is not in memory: the name of
    // the company in the switcher and the user menu comes from it
    if (this.stage() !== 'company' && this.auth.companies().length === 0) {
      this.auth.getUserCompanies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
    }

    if (this.stage() === 'branch') {
      this.moduleKey = this.route.snapshot.queryParamMap.get('module') || this.auth.selectedModuleKey() || '';
      if (!this.moduleKey) {
        this.router.navigate(['/select-company'], { replaceUrl: true });
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
    if (this.stage() === 'branch') this.loadBranches();
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
    const firstKept = this.startingCompany(kept);
    if (firstKept) {
      this.activeCompany.set(firstKept);
      this.defaultToBusiness();
    }
    this.watchSetUps();
    this.refreshCompanies(() => {
      if (kept.length === 0) this.error.set('Could not load your companies. Please try again.');
    });
    this.loadPersonalApps();
  }

  /** The company the session is already in, else the first one that can be opened. */
  private startingCompany(list: Company[]): Company | undefined {
    const current = this.auth.selectedCompanyId?.();
    return list.find(c => c.companyId === current && this.enterable(c)) ?? list.find(c => this.enterable(c));
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
        if (!this.activeCompany()) {
          const first = this.startingCompany(list);
          if (first) {
            this.activeCompany.set(first);
            // Business is shown (by default or picked before the list came): read the modules now
            if (!this.defaultToBusiness() && this.mode() === 'business') this.loadBusinessModules();
          }
        }
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

        // its apps are listed on this same page
        this.enteringCompany = false;
        this.activeCompany.set(company);
        this.businessCompanyId = null;
        this.showMode('business');
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
  /** The ID was copied a moment ago: the copy button shows a tick. */
  idCopied = signal(false);

  copyIndividualId(id: string): void {
    navigator.clipboard?.writeText(id).then(() => {
      this.idCopied.set(true);
      setTimeout(() => this.idCopied.set(false), 2000);
    }, () => { /* the browser refused: the ID stays readable */ });
  }

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

  /** Company dropdown in the top bar. */
  companyMenuOpen = signal(false);
  /** First enterable company (pre-selected on load). */
  activeCompany = signal<Company | null>(null);

  toggleCompanyMenu(event: Event): void {
    event.stopPropagation();
    this.companyMenuOpen.update(v => !v);
    this.userMenuOpen.set(false);
    this.menuOpen.set(false);
  }

  pickCompany(company: Company, event: Event): void {
    event.stopPropagation();
    if (!this.enterable(company)) return;
    this.activeCompany.set(company);
    this.companyMenuOpen.set(false);
    this.appQuery.set('');
    if (this.mode() === 'business') this.loadBusinessModules();
  }

  /**
   * Home screen: the personal applications or the business modules of the company picked
   * in the top bar. 'choose' is the state before a company is known.
   */
  mode = signal<'choose' | 'personal' | 'business'>('choose');

  /** Business modules of the company in the top bar (read after the company is selected). */
  businessModules = signal<ModuleDto[]>([]);
  businessLoading = signal(false);
  businessError = signal('');
  /** Company whose modules are in businessModules (null = none read yet). */
  private businessCompanyId: number | null = null;
  private businessSeq = 0;

  /** The user picked a mode themselves: the default no longer applies. */
  private modeTouched = false;

  setMode(m: 'choose' | 'personal' | 'business'): void {
    this.modeTouched = true;
    this.appQuery.set('');
    this.showMode(m);
  }

  private showMode(m: 'choose' | 'personal' | 'business'): void {
    this.mode.set(m);
    if (m === 'business') this.loadBusinessModules();
  }

  /**
   * A user with a company that can be opened starts on Business (until they pick a mode).
   * Returns true when it switched (and so already reads the modules).
   */
  private defaultToBusiness(): boolean {
    if (this.modeTouched || this.mode() !== 'choose' || !this.hasBusinessCompany()) return false;
    this.showMode('business');
    return true;
  }

  /** Whether the company of the top bar can be opened (else the panel lists / creates one). */
  hasBusinessCompany(): boolean {
    const co = this.activeCompany();
    return !!co && this.enterable(co);
  }

  /** Selects the company of the top bar and reads its modules, staying on this screen. */
  private loadBusinessModules(force = false): void {
    const co = this.activeCompany();
    if (!co || !this.enterable(co)) {
      this.businessModules.set([]);
      return;
    }
    if (!force && this.businessCompanyId === co.companyId && this.businessModules().length > 0) return;

    const seq = ++this.businessSeq;
    this.businessLoading.set(true);
    this.businessError.set('');
    this.businessModules.set([]);
    this.canManageUsers.set(false);
    const failed = (msg: string) => {
      if (this.gone || seq !== this.businessSeq) return;
      this.businessLoading.set(false);
      this.businessError.set(msg);
    };
    const readModules = () => {
      this.auth.getModules().pipe(timeout(20000), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (m) => {
          if (this.gone || seq !== this.businessSeq) return;
          if (!m.success) { failed(m.message || 'Could not load the modules'); return; }
          this.businessLoading.set(false);
          this.businessCompanyId = co.companyId;
          this.businessModules.set(m.data || []);
          this.loadUsersRolesAccess(seq);
        },
        error: () => failed('Could not load the modules. Please try again.'),
      });
    };

    // selecting a company forgets the module and branch: coming back to the apps must not end the session's work
    if (this.auth.selectedCompanyId?.() === co.companyId) { readModules(); return; }

    this.auth.selectCompany(co.companyId).pipe(timeout(20000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (this.gone || seq !== this.businessSeq) return;
        if (!res.success || !res.data) { failed(res.message || 'Could not open this company'); return; }
        readModules();
      },
      error: () => failed('Could not open this company. Please try again.'),
    });
  }

  retryBusiness(): void { this.loadBusinessModules(true); }

  /** The tenant admin, and anyone they granted it, get the Users & Roles entry. */
  canManageUsers = signal(false);

  private loadUsersRolesAccess(seq: number): void {
    this.auth.getCompanyAccessMe?.().pipe(timeout(20000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (!this.gone && seq === this.businessSeq) this.canManageUsers.set(!!res.success && !!res.data?.canManage);
      },
      error: () => { if (!this.gone && seq === this.businessSeq) this.canManageUsers.set(false); },
    });
  }

  openUsersRoles(): void {
    this.companyMenuOpen.set(false);
    this.router.navigate(['/company/users-roles']);
  }

  // ── APP HOME ──────────────────────────────────────────────────────

  /** What the user typed to find an application. */
  appQuery = signal('');
  private appSearchInput = viewChild<ElementRef<HTMLInputElement>>('appSearchInput');

  /** The personal applications or the business modules, in their order. */
  homeApps = computed<HomeApp[]>(() => {
    const m = this.mode();
    if (m === 'personal') {
      return this.personalApps().map(a => {
        const disabled = !this.canOpenPersonalApp(a);
        return {
          key: a.moduleKey, label: a.moduleName, description: a.description || '', icon: a.icon || 'apps',
          tone: appTone(a.moduleKey), disabled, note: disabled ? (a.isReleased ? 'Unavailable' : 'Coming soon') : '',
          open: () => this.openPersonalApp(a),
        };
      });
    }
    if (m === 'business') {
      return this.businessModules().map(mod => {
        const disabled = mod.state !== 'Available';
        return {
          key: mod.moduleKey, label: mod.moduleName, description: mod.description || '', icon: mod.icon || 'apps',
          tone: appTone(mod.moduleKey), disabled,
          note: disabled ? (mod.state === 'ComingSoon' ? 'Coming soon' : this.caption(mod) || 'Unavailable') : '',
          open: () => this.openModule(mod),
        };
      });
    }
    return [];
  });

  private foundApps = computed(() => {
    const term = this.appQuery().trim().toLowerCase();
    return term ? this.homeApps().filter(a => a.label.toLowerCase().includes(term)) : this.homeApps();
  });
  openApps = computed(() => this.foundApps().filter(a => !a.disabled));
  lockedApps = computed(() => this.foundApps().filter(a => a.disabled));
  /** The Dock keeps every application that opens, whatever is typed in the search. */
  dockApps = computed(() => this.homeApps().filter(a => !a.disabled));

  /** One heading when the locked apps share a reason; otherwise each one shows its own. */
  lockedTitle = computed(() => {
    const notes = new Set(this.lockedApps().map(a => a.note));
    if (notes.size !== 1) return 'More Apps';
    const note = [...notes][0];
    return note === 'Not subscribed' ? 'Not Subscribed' : note === 'Coming soon' ? 'Coming Soon' : 'More Apps';
  });

  /** Administration needs the company selected, which reading its modules has done. */
  showAdminInDock(): boolean {
    return this.isPlatformAdmin() && this.mode() === 'business' && this.hasBusinessCompany()
      && !this.businessLoading() && this.businessModules().length > 0 && this.canAdminister();
  }

  /** Only the platform's own administrators get Platform Admin in the Dock. */
  isPlatformAdmin(): boolean {
    return !!this.auth.currentUser()?.isPlatformAdmin;
  }

  focusAppSearch(): void {
    this.appSearchInput()?.nativeElement.focus();
  }

  /** Ctrl + K (Cmd + K on a Mac) finds an application from anywhere on the home screen. */
  @HostListener('document:keydown', ['$event'])
  onSearchShortcut(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
    if (this.stage() !== 'company' || this.showCreate() || this.showChangePasswordModal()) return;
    event.preventDefault();
    this.focusAppSearch();
  }

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
    this.companyMenuOpen.set(false);
  }

  goPersonal(): void {
    this.menuOpen.set(false);
    if (this.stage() !== 'company') this.backToCompanies();
  }

  greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  greetingIcon(): string {
    const h = new Date().getHours();
    return h < 12 ? 'wb_sunny' : h < 17 ? 'light_mode' : 'dark_mode';
  }

  /** e.g. "Friday, 20 November" */
  todayLabel(): string {
    const now = new Date();
    return now.toLocaleDateString('en-GB', { weekday: 'long' }) + ', '
      + now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  }

  /** e.g. "Fri, 20 Nov" */
  shortDate(): string {
    const now = new Date();
    return now.toLocaleDateString('en-GB', { weekday: 'short' }) + ', '
      + now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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

  // ── OPENING A MODULE (from the app list) ──────────────────────────

  /** The module being entered: its card says "Opening…". */
  openingModule = signal<string | null>(null);

  caption(module: ModuleDto): string {
    return moduleCaption(module.state);
  }

  openModule(module: ModuleDto): void {
    if (module.state !== 'Available') return;

    if (this.openingModule()) return;

    // an application whose pages need no branch opens at once
    const to = moduleRoute(module);
    const toBranchStep = () => {
      this.openingModule.set(null);
      this.router.navigate(to.commands, to.queryParams ? { queryParams: to.queryParams } : undefined);
    };
    if (!to.queryParams) { toBranchStep(); return; }

    // the others open in their branch from here; the branch step only explains a problem
    this.openingModule.set(module.moduleKey);
    this.auth.getBranches(module.moduleKey).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        const branch = branchToEnter(res.success ? res.data ?? [] : [], this.auth.rememberedBranchId());
        if (!branch) { toBranchStep(); return; }
        this.auth.setScope(module.moduleKey, branch.locationId, branch.locationName).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (scope) => {
            if (!scope.success || !scope.data) { toBranchStep(); return; }
            this.openingModule.set(null);
            this.router.navigate([moduleLanding(module.moduleKey, scope.data.role)]);
          },
          error: () => toBranchStep(),
        });
      },
      error: () => toBranchStep(),
    });
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

        if (branchDecision(list.length) === 'none') {
          this.noBranch.set(true);
          return;
        }
        // asked only once: later the branch is changed from the top bar
        const branch = branchToEnter(list, this.auth.rememberedBranchId());
        if (branch) {
          this.entering.set(true);
          this.enterBranch(branch);
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
          this.router.navigate([moduleLanding(this.moduleKey, res.data.role)], extras);
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
