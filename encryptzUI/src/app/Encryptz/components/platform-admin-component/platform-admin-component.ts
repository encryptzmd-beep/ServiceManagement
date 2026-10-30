import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, finalize } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../Auth/auth-service';
import {
  Branch,
  BranchAccess,
  BranchAccessUser,
  CompanyMember,
  CompanyModule,
  ConnectionTestResult,
  DbServer,
  DbServerForm,
  PlatformApplication,
  PlatformCompany,
  PlatformLocation,
  PlatformMenu,
  PlatformProject,
  PlatformService,
  PlatformSetting,
  ProjectAccess,
} from '../../Services/platform-service';
import { provisionLabel, requestErrorMessage } from '../../Auth/company-creation';
import { PlatformNavService, PlatformTab } from '../../Services/platform-nav-service';
import { Router } from '@angular/router';
import { VerificationPanelComponent } from '../verification-panel-component/verification-panel-component';
import { LoginAdsPanelComponent } from '../login-ads-panel-component/login-ads-panel-component';
import { ScrollIntoViewOn } from '../shared/scroll-into-view';
import { EscapeClose } from '../shared/escape-close';

type Tab = PlatformTab;
const SECTION_TABS: Tab[] = ['companies', 'applications', 'verification', 'projects', 'locations', 'branchAccess', 'access', 'menus', 'servers', 'settings', 'loginAds'];

/**
 * Administration of the main database: companies and their modules, the database each
 * company is stored in, branches, who may open a module, and the menu tree.
 *
 * A platform administrator sees every company. A company administrator sees the
 * own company and can manage its branches and module access.
 */
@Component({
  selector: 'app-platform-admin-component',
  imports: [CommonModule, FormsModule, VerificationPanelComponent, LoginAdsPanelComponent, ScrollIntoViewOn, EscapeClose],
  templateUrl: './platform-admin-component.html',
  styleUrl: './platform-admin-component.scss',
})
export class PlatformAdminComponent implements OnInit {
  private api = inject(PlatformService);
  private auth = inject(AuthService);

  private nav = inject(PlatformNavService);
  private router = inject(Router);

  isPlatformAdmin = computed(() => !!this.auth.currentUser()?.isPlatformAdmin);
  /** The sidebar lists the sections: the tabs of this screen are hidden. */
  sectionsInSidebar = this.nav.inSidebar;

  tab = signal<Tab>('companies');
  loading = signal(false);
  saving = signal(false);
  toast = signal<{ text: string; ok: boolean } | null>(null);

  companies = signal<PlatformCompany[]>([]);
  projects = signal<PlatformProject[]>([]);
  locations = signal<PlatformLocation[]>([]);
  access = signal<ProjectAccess[]>([]);
  menus = signal<PlatformMenu[]>([]);
  servers = signal<DbServer[]>([]);
  settings = signal<PlatformSetting[]>([]);
  applications = signal<PlatformApplication[]>([]);
  /** Application dialog (null = closed). */
  applicationForm: PlatformApplication | null = null;
  /** Families already in use, each once: suggested in the dialog so one family has one spelling. */
  families = computed(() => [...new Set(this.applications().map(a => (a.family || '').trim()).filter(f => f))]
    .sort((a, b) => a.localeCompare(b)));
  private applicationsSub = new Subscription();
  /** Server dialog (null = closed). Dropped on close so a typed password does not stay in memory. */
  serverForm: DbServerForm | null = null;
  /** What is typed per setting key. */
  settingDraft: Record<string, string> = {};
  settingError = signal<Record<string, string>>({});
  /** Company whose set-up is being retried (null = none). */
  retryingCompany = signal<number | null>(null);
  /** Setting keys with a save in flight. */
  savingSettings = signal<ReadonlySet<string>>(new Set());
  /** Setting keys the user typed in since the last load / successful save. */
  private editedSettings = new Set<string>();
  /** The running loads of the servers list and the settings (and the re-reads after a save). */
  private serversSub = new Subscription();
  private settingsSub = new Subscription();
  /** Bumped whenever a dialog opens or closes; a connection-test answer of an older number is ignored. */
  private testToken = 0;
  /** Bumped whenever a dialog opens or closes; a save answer of an older number does not touch the dialog. */
  private saveToken = 0;

  readonly settingHelp: Record<string, { label: string; help: string }> = {
    MaxCompaniesPerUser: {
      label: 'Companies a user may create',
      help: '0 switches company creation off for everyone but platform administrators.',
    },
    TenantLookupSourceDb: {
      label: 'Lookup source database',
      help: 'Leave empty (recommended): new companies start with the built-in defaults. Never name a live company\'s database: its print header and running numbers would be copied.',
    },
    WelcomeCredits: {
      label: 'Welcome credits',
      help: 'Credits a new person gets once their profile has a name and mobile number. 0 = off.',
    },
    ReferralCredits: {
      label: 'Referral credits',
      help: 'Credits the inviter gets when an invited friend is onboarded (the friend gets the welcome credits). 0 = off.',
    },
    PublicUrl: {
      label: 'Platform address',
      help: 'The address used in the links of mails and invite links, such as https://serviceapp.encryptz.in.',
    },
    SmtpHost: { label: 'Mail server', help: 'Such as smtp.gmail.com. Empty = the value in appsettings.json.' },
    SmtpPort: { label: 'Mail server port', help: 'Usually 587. Empty = the value in appsettings.json.' },
    SmtpEnableSsl: { label: 'Mail server SSL', help: 'true or false. Empty = the value in appsettings.json.' },
    SmtpUserName: { label: 'Mail login', help: 'The account that sends the mails. Empty = the value in appsettings.json.' },
    SmtpPassword: {
      label: 'Mail password',
      help: 'For Gmail an app password. Stored encrypted and never shown again; save it empty to use appsettings.json.',
    },
    SmtpFromEmail: { label: 'Mails sent from', help: 'The sender address. Empty = the value in appsettings.json.' },
    SmtpFromName: { label: 'Sender name', help: 'Such as Encryptz Support. Empty = the value in appsettings.json.' },
  };

  /** A setting the server stores encrypted: shown only as set or not, typed again to change. */
  isSecretSetting(key: string): boolean {
    return key === 'SmtpPassword';
  }

  /** Company whose Modules dialog is open (null = closed). */
  /** Company whose members are shown in the Administrators dialog (null = closed). */
  membersCompany = signal<PlatformCompany | null>(null);
  companyMembers = signal<CompanyMember[]>([]);
  memberRoles = signal<string[]>([]);
  memberError = signal('');
  memberBusy = signal(false);
  /** The person to add: e-mail or Individual ID, and the role (administrator unless changed). */
  newMember = { lookup: '', roleName: 'Admin' };
  private membersSub = new Subscription();

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
  /** Branch Access tab: the members of the picked company and their branches (null = not loaded). */
  branchAccess = signal<BranchAccess | null>(null);
  /** Shown in place of the table (e.g. the company database has no branch access yet). */
  branchAccessNote = signal('');
  /** The branch access load ended with an HTTP error (not the "not set up" note). */
  branchAccessFailed = signal(false);
  branchBusy = signal<ReadonlySet<string>>(new Set());
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
  activeBranches = computed(() => (this.branchAccess()?.branches ?? []).filter(b => b.isActive));

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

  constructor() {
    // a section picked in the sidebar
    effect(() => {
      const wanted = this.nav.tab();
      untracked(() => { if (this.unlocked() && wanted !== this.tab()) this.setTab(wanted); });
    });
  }

  ngOnInit(): void {
    // a section in the address (?section=servers): opened again after a refresh or from a bookmark
    const wanted = this.router.parseUrl(this.router.url).queryParams['section'] as Tab | undefined;
    if (wanted && SECTION_TABS.includes(wanted)) this.nav.tab.set(wanted);

    this.api.isUnlocked().subscribe({
      next: res => res.unlocked ? this.open() : this.unlocked.set(false),
      error: () => this.unlocked.set(false),
    });
  }

  private open(): void {
    this.unlocked.set(true);
    this.loadCompanies();
    this.loadProjects();
    if (this.nav.tab() !== this.tab()) this.setTab(this.nav.tab());
    // the list was cleared when the screen locked: read it again
    else if (this.tab() === 'applications') this.loadApplications();
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
    this.cancelServersLoad(); this.cancelSettingsLoad();
    this.servers.set([]); this.settings.set([]); this.settingDraft = {}; this.editedSettings.clear();
    this.cancelApplicationsLoad(); this.applications.set([]);
    this.accessModules.set([]);
    this.modulesFailed.set(false);
    this.branchAccess.set(null);
    this.branchBusy.set(new Set());
    this.branchAccessNote.set('');
    this.branchAccessFailed.set(false);
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

  /** Each section has its own address, so it can be bookmarked and survives a refresh (QA BUG-032). */
  private showSectionInUrl(tab: Tab): void {
    const url = this.router.parseUrl(this.router.url);
    if (url.queryParams['section'] === tab) return;
    url.queryParams = { ...url.queryParams, section: tab };
    this.router.navigateByUrl(url, { replaceUrl: true }).catch(() => {});
  }

  setTab(tab: Tab): void {
    if ((tab === 'servers' || tab === 'settings' || tab === 'applications' || tab === 'verification' || tab === 'loginAds') && !this.isPlatformAdmin()) return;
    if (tab !== this.tab()) { this.closeForms(); this.cancelServersLoad(); this.cancelSettingsLoad(); this.cancelApplicationsLoad(); }
    this.tab.set(tab);
    this.nav.tab.set(tab);
    this.showSectionInUrl(tab);
    if (tab === 'servers') this.loadServers();
    if (tab === 'settings') this.loadSettings();
    if (tab === 'applications') this.loadApplications();

    this.resetTabLoad();

    if (tab === 'menus' && !this.menus().length) this.loadMenus();

    if (tab === 'locations' || tab === 'access' || tab === 'branchAccess') {
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

  refreshBranchAccess(): void { this.loadProjectData(); }

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
    } else if (this.tab() === 'branchAccess') {
      this.branchAccess.set(null);
      this.branchAccessNote.set('');
      this.branchAccessFailed.set(false);
      this.tabSub.add(this.api.getBranchAccess(projectId).subscribe({
        next: res => {
          this.tabPending = false;
          this.loading.set(false);
          if (res.success) { this.branchAccess.set(res.data ?? { branches: [], users: [] }); return; }
          // "not set up yet" is a state of the company database, not an error
          this.branchAccessNote.set(res.message || 'Could not load branch access');
        },
        error: err => { this.tabPending = false; this.branchAccessFailed.set(true); this.fail(err, 'Could not load branch access'); },
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
    this.saveToken++;
    this.companyForm = {
      companyId: 0, companyName: '', companyCode: '', address: '', city: '', phoneNumber: '', isActive: true,
    };
  }

  editCompany(company: PlatformCompany): void {
    this.formError.set('');
    this.saveToken++;
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
    const token = this.saveToken;
    this.api.saveCompany(form).subscribe({
      next: res => {
        const current = token === this.saveToken;
        if (current) this.saving.set(false);
        if (!res.success) { if (current) this.formError.set(res.message); return; }
        if (current) this.companyForm = null;
        this.notify(res.message, true);
        this.loadCompanies();
      },
      error: err => this.failForm(err, token),
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

  // ── members and administrators of a company (platform administrator only) ──

  openAdministrators(company: PlatformCompany): void {
    if (!this.isPlatformAdmin()) return;
    this.closeAdministrators();
    this.membersCompany.set(company);
    this.loadMembers();
  }

  private loadMembers(): void {
    const company = this.membersCompany();
    if (!company) return;

    this.membersSub.unsubscribe();
    this.membersSub = new Subscription();
    this.membersSub.add(this.api.getCompanyMembers(company.companyId).subscribe({
      next: res => {
        if (!res.success) { this.memberError.set(res.message); return; }
        this.companyMembers.set(res.data?.members ?? []);
        this.memberRoles.set(res.data?.roles ?? []);
      },
      error: err => { if (this.isLocked(err)) return; this.memberError.set(this.message(err, 'Could not load the members')); },
    }));
  }

  /** The roles to offer for a member: the list, and the member's own role when it is not on it. */
  rolesFor(member: CompanyMember): string[] {
    const roles = this.memberRoles();
    return roles.includes(member.roleInCompany) ? roles : [...roles, member.roleInCompany];
  }

  onMemberRoleChange(member: CompanyMember, event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.changeMemberRole(member, select.value, select);
  }

  /**
   * @param select the list that was changed. It already shows the new role, and the
   *   binding does not move it back when the stored role stays: on a refusal it is set
   *   back by hand.
   */
  changeMemberRole(member: CompanyMember, roleName: string, select?: HTMLSelectElement): void {
    const company = this.membersCompany();
    const back = () => { if (select) select.value = member.roleInCompany; };

    if (!company || roleName === member.roleInCompany) return;
    if (this.memberBusy()) { back(); return; }

    this.memberError.set('');
    this.memberBusy.set(true);
    this.api.setCompanyMemberRole(company.companyId, member.userId, roleName).subscribe({
      next: res => {
        this.memberBusy.set(false);
        if (!res.success) { this.memberError.set(res.message); back(); return; }
        this.notify(res.message, true);
        this.loadMembers();
      },
      error: err => {
        this.memberBusy.set(false);
        back();
        if (this.isLocked(err)) return;
        this.memberError.set(this.message(err, 'Could not change the role'));
      },
    });
  }

  addMember(): void {
    const company = this.membersCompany();
    if (!company || this.memberBusy()) return;

    const lookup = (this.newMember.lookup || '').trim();
    if (!lookup) { this.memberError.set('Enter the e-mail address or the Individual ID of the person'); return; }

    this.memberError.set('');
    this.memberBusy.set(true);
    this.api.addCompanyMember(company.companyId, lookup, this.newMember.roleName).subscribe({
      next: res => {
        this.memberBusy.set(false);
        if (!res.success) { this.memberError.set(res.message); return; }
        this.newMember.lookup = '';
        this.notify(res.message, true);
        this.loadMembers();
        this.loadCompanies();   // the number of users of the company changed
      },
      error: err => {
        this.memberBusy.set(false);
        if (this.isLocked(err)) return;
        this.memberError.set(this.message(err, 'Could not add the person'));
      },
    });
  }

  closeAdministrators(): void {
    this.membersSub.unsubscribe();
    this.membersSub = new Subscription();
    this.membersCompany.set(null);
    this.companyMembers.set([]);
    this.memberRoles.set([]);
    this.memberError.set('');
    this.memberBusy.set(false);
    this.newMember = { lookup: '', roleName: 'Admin' };
  }

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
    this.saveToken++;
    this.resetTest();
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
    this.saveToken++;
    this.resetTest();
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
    const token = ++this.testToken;
    this.api.testConnection(form).subscribe({
      next: res => {
        if (token !== this.testToken) return;
        this.testing.set(false);
        if (res.success && res.data) this.testResult.set(res.data);
        else this.formError.set(res.message);
      },
      error: err => { if (this.isLocked(err) || token !== this.testToken) return; this.testing.set(false); this.formError.set(this.message(err, 'Connection test failed')); },
    });
  }

  saveProject(): void {
    const form = this.projectForm;
    if (!form) return;

    const invalid = this.projectFormError(form);
    if (invalid) { this.formError.set(invalid); return; }

    this.saving.set(true);
    const token = this.saveToken;
    this.api.saveProject(form).subscribe({
      next: res => {
        const current = token === this.saveToken;
        if (current) this.saving.set(false);
        if (!res.success) { if (current) this.formError.set(res.message); return; }
        if (current) this.projectForm = null;
        this.notify(res.message, true);
        this.loadProjects();
        this.loadCompanies();
      },
      error: err => this.failForm(err, token),
    });
  }

  // ── locations ─────────────────────────────────────────────────────────────

  newLocation(): void {
    this.formError.set('');
    this.saveToken++;
    this.locationForm = { locationId: 0, locationName: '', locationCode: '', address: '', city: '', isActive: true };
  }

  editLocation(location: PlatformLocation): void {
    this.formError.set('');
    this.saveToken++;
    this.locationForm = { ...location };
  }

  saveLocation(): void {
    const form = this.locationForm;
    const projectId = this.selectedProjectId();
    if (!form || !projectId) return;
    if (!form.locationName.trim()) { this.formError.set('Branch name is required'); return; }

    const isNew = !form.locationId;
    this.saving.set(true);
    const token = this.saveToken;
    this.api.saveLocation(projectId, form).subscribe({
      next: res => {
        const current = token === this.saveToken;
        if (current) this.saving.set(false);
        if (!res.success) { if (current) this.formError.set(res.message); return; }
        if (current) this.locationForm = null;
        this.notify(isNew ? `${res.message}${/[.!?]$/.test(res.message ?? '') ? '' : '.'} Tick it for the members under Branch Access.` : res.message, true);
        // a late answer reloads the branches only while that tab is still shown
        if (current || this.tab() === 'locations') this.loadProjectData();
      },
      error: err => this.failForm(err, token),
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

  // ── branch access ─────────────────────────────────────────────────────────

  private branchKey(companyId: number, userId: number, locationId: number): string {
    return `${companyId}|${userId}|${locationId}`;
  }

  branchCellBusy(user: BranchAccessUser, branch: Branch): boolean {
    return this.branchBusy().has(this.branchKey(this.selectedProjectId() ?? 0, user.userId, branch.locationId));
  }

  hasBranch(user: BranchAccessUser, branch: Branch): boolean {
    return user.locationIds.includes(branch.locationId);
  }

  /** A member without any active branch cannot enter the company. */
  hasNoBranch(user: BranchAccessUser): boolean {
    return !user.allBranches && !this.activeBranches().some(b => user.locationIds.includes(b.locationId));
  }

  /** The note is only extended for the one state it explains. */
  readonly branchAccessNotSetUp = "Branch access is not set up in this company's database yet";

  toggleBranch(user: BranchAccessUser, branch: Branch, event?: Event): void {
    const companyId = this.selectedProjectId();
    const had = this.hasBranch(user, branch);
    if (!companyId || user.allBranches) { this.redraw(event, had); return; }

    const key = this.branchKey(companyId, user.userId, branch.locationId);
    if (this.branchBusy().has(key)) { this.redraw(event, had); return; }

    const grant = !had;
    this.branchBusy.update(set => new Set(set).add(key));
    this.api.setBranchAccess(companyId, user.userId, branch.locationId, grant).pipe(
      finalize(() => this.branchBusy.update(set => { const next = new Set(set); next.delete(key); return next; })),
    ).subscribe({
      next: res => {
        this.notify(res.message, res.success);
        if (!res.success) { this.redraw(event, had); return; }
        // the answer belongs to the company it was sent for
        if (this.selectedProjectId() !== companyId) return;
        this.branchAccess.update(data => data && ({
          ...data,
          users: data.users.map(u => u.userId !== user.userId ? u : {
            ...u,
            locationIds: grant
              ? [...u.locationIds.filter(id => id !== branch.locationId), branch.locationId].sort((a, b) => a - b)
              : u.locationIds.filter(id => id !== branch.locationId),
          }),
        }));
      },
      error: err => {
        this.redraw(event, had);
        if (this.isLocked(err)) return;
        this.notify(this.message(err, 'Could not change branch access'), false);
      },
    });
  }

  /** Key of one member's access change in flight. */
  accessBusyKey(companyId: number | null, moduleKey: string, userId: number): string {
    return `${companyId}|${moduleKey}|${userId}`;
  }

  // ── database servers ──────────────────────────────────────────────────────

  loadServers(): void {
    this.cancelServersLoad();
    this.serversSub.add(this.api.getDbServers().subscribe({
      next: res => { if (res.success) this.servers.set(res.data ?? []); else this.notify(res.message, false); },
      error: err => this.fail(err, 'Could not load the database servers'),
    }));
  }

  private cancelServersLoad(): void {
    this.serversSub.unsubscribe();
    this.serversSub = new Subscription();
  }

  newServer(): void {
    this.formError.set('');
    this.saveToken++;
    this.resetTest();
    this.serverForm = { dbServerId: 0, serverName: '', adminUser: '', adminPassword: '', extraOptions: '', isDefault: this.servers().length === 0, isActive: true };
  }

  editServer(server: DbServer): void {
    this.formError.set('');
    this.saveToken++;
    this.resetTest();
    // the password is never known here: the field starts empty each time
    this.serverForm = {
      dbServerId: server.dbServerId, serverName: server.serverName, adminUser: server.adminUser,
      adminPassword: '', extraOptions: server.extraOptions ?? '', isDefault: server.isDefault, isActive: server.isActive,
    };
  }

  private serverProblem(form: DbServerForm): string {
    if (!form.serverName.trim() || !form.adminUser.trim()) return 'Server and login are required';
    if (!form.dbServerId && !form.adminPassword) return 'Enter the password';
    return '';
  }

  saveServer(): void {
    const form = this.serverForm;
    if (!form || this.saving()) return;

    const problem = this.serverProblem(form);
    if (problem) { this.formError.set(problem); return; }

    this.formError.set('');
    this.saving.set(true);
    const token = this.saveToken;
    this.api.saveDbServer(form).subscribe({
      next: res => {
        const current = token === this.saveToken;
        if (current) this.saving.set(false);
        if (!res.success) { if (current) this.formError.set(res.message); return; }
        if (current) {
          this.serverForm = null;
          this.testResult.set(null);
        }
        this.notify(res.message, true);
        this.loadServers();
      },
      error: err => this.failForm(err, token),
    });
  }

  testServer(): void {
    const form = this.serverForm;
    if (!form || this.testing()) return;
    if (!form.serverName.trim() || !form.adminUser.trim()) { this.formError.set('Server and login are required'); return; }

    this.formError.set('');
    this.testResult.set(null);
    this.testing.set(true);
    const token = ++this.testToken;
    this.api.testDbServer(form).subscribe({
      next: res => {
        if (token !== this.testToken) return;
        this.testing.set(false);
        if (res.success && res.data) this.testResult.set(res.data);
        else this.formError.set(res.message);
      },
      error: err => { if (this.isLocked(err) || token !== this.testToken) return; this.testing.set(false); this.formError.set(this.message(err, 'Connection test failed')); },
    });
  }

  // ── platform settings ─────────────────────────────────────────────────────

  // ── applications (the catalogue) ──────────────────────────────────────────

  loadApplications(): void {
    this.cancelApplicationsLoad();
    this.applicationsSub.add(this.api.getApplications().subscribe({
      next: res => { if (res.success) this.applications.set(res.data ?? []); else this.notify(res.message, false); },
      error: err => this.fail(err, 'Could not load the applications'),
    }));
  }

  private cancelApplicationsLoad(): void {
    this.applicationsSub.unsubscribe();
    this.applicationsSub = new Subscription();
  }

  newApplication(): void {
    this.formError.set('');
    this.saveToken++;
    this.applicationForm = {
      moduleId: 0, moduleKey: '', moduleName: '', description: '', icon: '', family: '',
      appType: 'Commercial', routePath: '', sortOrder: 0, isReleased: false, isActive: true, companyCount: 0,
    };
  }

  editApplication(app: PlatformApplication): void {
    this.formError.set('');
    this.saveToken++;
    this.applicationForm = { ...app };
  }

  /** The same checks the API makes, so the common mistakes are answered at once. */
  private applicationProblem(form: PlatformApplication): string {
    if (!form.moduleKey.trim() || !form.moduleName.trim()) return 'Key and name are required';
    if (!/^[A-Za-z0-9_]+$/.test(form.moduleKey.trim())) return 'The key may hold letters, digits and _ only';
    const route = (form.routePath || '').trim();
    if (route && !/^\/(?!\/)[A-Za-z0-9\-_\/]*$/.test(route)) return 'The route must start with / and hold letters, digits, - _ and / only';
    if (form.appType === 'Personal' && form.isReleased && !route) return 'A personal application needs a route before it is released';
    return '';
  }

  saveApplication(): void {
    const form = this.applicationForm;
    if (!form || this.saving()) return;

    const problem = this.applicationProblem(form);
    if (problem) { this.formError.set(problem); return; }

    // "Coming soon" or inactive closes the application for every company that uses it
    const before = this.applications().find(a => a.moduleId === form.moduleId);
    const closes = !!before && before.companyCount > 0
      && ((before.isReleased && !form.isReleased) || (before.isActive && !form.isActive));
    if (closes && !window.confirm(
      `${before!.companyCount} ${before!.companyCount === 1 ? 'company uses' : 'companies use'} ${before!.moduleName}. Their people will not be able to open it until it is released and active again. Continue?`)) {
      return;
    }

    this.formError.set('');
    this.saving.set(true);
    const token = this.saveToken;
    this.api.saveApplication({ ...form, sortOrder: +form.sortOrder || 0 }).subscribe({
      next: res => {
        const current = token === this.saveToken;
        if (current) this.saving.set(false);
        if (!res.success) { if (current) this.formError.set(res.message); return; }
        if (current) this.applicationForm = null;
        this.notify(res.message, true);
        this.loadApplications();
      },
      error: err => this.failForm(err, token),
    });
  }


  loadSettings(): void {
    this.cancelSettingsLoad();
    this.settingsSub.add(this.api.getSettings().subscribe({
      next: res => {
        if (!res.success) { this.notify(res.message, false); return; }
        const list = res.data ?? [];
        this.settings.set(list);
        // what the user typed since this load started stays as typed
        this.settingDraft = Object.fromEntries(list.map(s =>
          [s.settingKey, this.editedSettings.has(s.settingKey) ? (this.settingDraft[s.settingKey] ?? '')
            : this.isSecretSetting(s.settingKey) ? '' : (s.settingValue ?? '')]));
        this.settingError.set({});
      },
      error: err => this.fail(err, 'Could not load the settings'),
    }));
  }

  private cancelSettingsLoad(): void {
    this.settingsSub.unsubscribe();
    this.settingsSub = new Subscription();
  }

  markSettingEdited(key: string): void {
    this.editedSettings.add(key);
  }

  saveSetting(key: string): void {
    if (this.savingSettings().has(key)) return;
    const value = this.settingDraft[key] ?? '';
    // typing from here on marks the key again; the stored value then must not replace it
    this.editedSettings.delete(key);
    this.settingError.update(e => ({ ...e, [key]: '' }));
    this.savingSettings.update(s => new Set(s).add(key));
    this.api.saveSetting(key, value).pipe(
      finalize(() => this.savingSettings.update(s => { const n = new Set(s); n.delete(key); return n; })),
    ).subscribe({
      next: res => {
        if (!res.success) { this.editedSettings.add(key); this.settingError.update(e => ({ ...e, [key]: res.message })); return; }
        // a secret is never kept in the page: only whether it is set
        const shown = this.isSecretSetting(key) ? (value.trim() ? '********' : '') : value.trim();
        this.settings.update(list => list.map(s => s.settingKey === key ? { ...s, settingValue: shown } : s));
        if (this.isSecretSetting(key)) this.settingDraft[key] = '';
        this.notify(res.message, true);
        this.showStoredValue(key);
      },
      error: err => { this.editedSettings.add(key); if (this.isLocked(err)) return; this.settingError.update(e => ({ ...e, [key]: this.message(err, 'Could not save the setting') })); },
    });
  }

  /** The server may store a setting differently from what was typed ("007" becomes "7"): show what it stored. */
  private showStoredValue(key: string): void {
    this.settingsSub.add(this.api.getSettings().subscribe({
      next: res => {
        const stored = res.success ? (res.data ?? []).find(s => s.settingKey === key) : undefined;
        if (!stored) return;
        const value = stored.settingValue ?? '';
        this.settings.update(list => list.map(s => s.settingKey === key ? { ...s, settingValue: value } : s));
        if (!this.editedSettings.has(key)) this.settingDraft[key] = this.isSecretSetting(key) ? '' : value;
      },
      error: () => { /* keep the typed value */ },
    }));
  }

  // ── database state of a company ───────────────────────────────────────────

  companyDatabase(company: PlatformCompany): string {
    switch (company.provisionStatus) {
      case 'Ready': return 'Ready';
      // an API on a main database without script 20/26 sends no status, only ProjectCount (QA BUG-028)
      case 'None': case undefined: case '': return company.projectCount ? 'Database attached' : 'No database';
      default: return provisionLabel(company.provisionStatus) || (company.provisionStatus ?? '');
    }
  }

  /** Only a company that never got a database can be retried. */
  canRetry(company: PlatformCompany): boolean {
    return company.provisionStatus === 'Failed' && !company.databaseName;
  }

  retryCompany(company: PlatformCompany): void {
    if (this.retryingCompany() !== null) return;

    this.retryingCompany.set(company.companyId);
    this.auth.retryProvision(company.companyId).subscribe({
      next: res => {
        this.retryingCompany.set(null);
        this.notify(res.message, res.success);
        this.loadCompanies();
      },
      error: err => {
        this.retryingCompany.set(null);
        this.notify(requestErrorMessage(err, 'Could not retry the set-up'), false);
        this.loadCompanies();
      },
    });
  }

  // ── menus ─────────────────────────────────────────────────────────────────

  newMenu(): void {
    this.formError.set('');
    this.saveToken++;
    this.menuForm = {
      menuId: 0, menuName: '', menuPath: '', icon: '', parentMenuId: null,
      sortOrder: this.menus().length + 1, isActive: true, module: 'Services',
    };
  }

  editMenu(menu: PlatformMenu): void {
    this.formError.set('');
    this.saveToken++;
    this.menuForm = { ...menu, parentMenuId: menu.parentMenuId ?? null };
  }

  saveMenu(): void {
    const form = this.menuForm;
    if (!form) return;
    if (!form.menuName.trim()) { this.formError.set('Menu name is required'); return; }

    this.saving.set(true);
    const token = this.saveToken;
    this.api.saveMenu(form).subscribe({
      next: res => {
        const current = token === this.saveToken;
        if (current) this.saving.set(false);
        if (!res.success) { if (current) this.formError.set(res.message); return; }
        if (current) this.menuForm = null;
        this.notify(res.message, true);
        this.loadMenus();
      },
      error: err => this.failForm(err, token),
    });
  }

  // ── shared ────────────────────────────────────────────────────────────────

  closeForms(): void {
    this.closeModules();
    this.closeAdministrators();
    this.companyForm = this.projectForm = this.locationForm = this.menuForm = null;
    this.serverForm = null;
    this.applicationForm = null;
    this.formError.set('');
    this.saveToken++;
    this.saving.set(false);
    this.resetTest();
  }

  /** A dialog opens or closes: an answer of a connection test started before is no longer wanted. */
  private resetTest(): void {
    this.testToken++;
    this.testing.set(false);
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

  private failForm(err: any, token: number): void {
    if (this.isLocked(err) || token !== this.saveToken) return;
    this.saving.set(false);
    this.formError.set(this.message(err, 'Save failed'));
  }
}
