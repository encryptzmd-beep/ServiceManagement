import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, Company } from '../../Auth/auth-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectLocationSwitcherComponent } from '../project-location-switcher-component/project-location-switcher-component';

@Component({
  selector: 'app-company-selector-component',
  imports: [CommonModule, FormsModule, ProjectLocationSwitcherComponent],
  templateUrl: './company-selector-component.html',
  styleUrl: './company-selector-component.scss',
})
export class CompanySelectorComponent {
    private auth = inject(AuthService);
  private router = inject(Router);
   userId = this.auth.userId();
  loading = signal(true);
  error = signal('');
  companies = signal<Company[]>([]);
  showCreateCompany = signal(true); // Show disabled create company option

  // Two-stage flow: pick company -> pick project/location (scope)
  stage = signal<'company' | 'scope'>('company');
  selectedCompanyName = signal('');
  private pendingRole = '';

  // Change Password States
  showChangePasswordModal = signal(false);
  changePasswordOld = '';
  changePasswordNew = '';
  changePasswordConfirm = '';
  changePasswordLoading = signal(false);
  changePasswordError = signal('');
  changePasswordSuccess = signal('');

  ngOnInit() {
      console.log('CompanySelector initialized'); // Debug
    this.loadCompanies();
  }

loadCompanies() {
  this.loading.set(true);

  const companies = this.auth.companies();

  if (companies.length > 0) {
    this.companies.set(companies);
    this.loading.set(false);
    return;
  }

  const temp = localStorage.getItem('temp_login');

  if (temp) {
    const data = JSON.parse(temp);
    this.companies.set(data.companies || []);
    this.loading.set(false);
    return;
  }

  this.loading.set(false);
  this.error.set('No companies found. Please login again.');
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

      this.pendingRole = res.data.role;
      this.selectedCompanyName.set(company.companyName);

      // If a default project + location is already baked into the token, go
      // straight in. Otherwise let the user pick project/location for this company.
      if (res.data.projectId && res.data.locationId) {
        this.redirectByRole(res.data.role);
      } else {
        this.stage.set('scope');
      }
    },
    error: () => {
      this.loading.set(false);
      this.error.set('Failed to select company');
    }
  });
}

  /** Fired by the project/location switcher once a scope is applied. */
  onScopeApplied(): void {
    this.redirectByRole(this.pendingRole);
  }

  /** Return to the company list to pick a different company. */
  backToCompanies(): void {
    this.stage.set('company');
    this.error.set('');
  }

  private redirectByRole(role: string): void {
    switch (role) {
      case 'Admin':
      case 'CompanyAdmin':
        this.router.navigate(['/complaints/dashboard']);
        break;
      case 'Technician':
        this.router.navigate(['/technicians/work-orders']);
        break;
      case 'Storekeeper':
        this.router.navigate(['/store/inventory']);
        break;
      default:
        this.router.navigate(['/dashboard']);
    }
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
