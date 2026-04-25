import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, Company } from '../../Auth/auth-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-company-selector-component',
  imports: [CommonModule, FormsModule],
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

      this.redirectByRole(res.data.role);
    },
    error: () => {
      this.loading.set(false);
      this.error.set('Failed to select company');
    }
  });
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
