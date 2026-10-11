import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, Company } from '../../Auth/auth-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocationDto, ModuleDto } from '../../Models/ApiModels';
import { branchDecision, landingRouteForRole, moduleCaption } from '../../Auth/scope-flow';

type Stage = 'company' | 'module' | 'branch';

@Component({
  selector: 'app-company-selector-component',
  imports: [CommonModule, FormsModule],
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
  modules = signal<ModuleDto[]>([]);
  branches = signal<LocationDto[]>([]);
  /** The branch step found no branch for this user. */
  noBranch = signal(false);
  /** A single branch is being entered without asking. */
  entering = signal(false);

  private moduleKey = '';

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
    this.error.set('');
    if (this.stage() === 'module') this.loadModules();
    else if (this.stage() === 'branch') this.loadBranches();
    else this.loadCompanies();
  }

  // ── STEP 1: COMPANY ───────────────────────────────────────────────

  loadCompanies() {
    this.loading.set(true);

    const companies = this.auth.companies();

    if (companies.length > 0) {
      this.companies.set(companies);
      this.loading.set(false);
      return;
    }

    let tempList: Company[] = [];
    try {
      const temp = localStorage.getItem('temp_login');
      if (temp) tempList = JSON.parse(temp).companies || [];
    } catch { tempList = []; }

    if (tempList.length > 0) {
      this.companies.set(tempList);
      this.loading.set(false);
      return;
    }

    // after a reload inside the application nothing is kept: ask the API
    this.auth.getUserCompanies().subscribe({
      next: (list) => {
        this.companies.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load your companies. Please try again.');
      }
    });
  }

  selectCompany(company: Company) {
    this.loading.set(true);

    this.auth.selectCompany(company.companyId).subscribe({
      next: (res) => {
        this.loading.set(false);

        if (!res.success || !res.data) {
          this.error.set(res.message || 'Failed to select company');
          return;
        }

        this.router.navigate(['/select-module']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to select company');
      }
    });
  }

  /** Text of a company whose database is not ready ('' when it is). */
  companyStatus(company: Company): string {
    switch (company.provisionStatus) {
      case 'Provisioning': return 'Setting up…';
      case 'Failed': return 'Setup failed';
      case 'None': return 'No database yet';
      default: return '';
    }
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
