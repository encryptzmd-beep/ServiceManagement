import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../Auth/auth-service';
import { CompanyService } from '../../Services/company-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-user-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-user-component.html',
  styleUrl: './add-user-component.scss',
})
export class AddUserComponent {
   private companyService = inject(CompanyService);
  private auth = inject(AuthService);

  email = '';
  selectedRole = '';
  remarks = '';
  emailValid = false;
  userChecked = false;
  userExists = false;
  foundUserName = '';

  loading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  companyUsers = signal<any[]>([]);
  roles = signal<string[]>(['Admin', 'Technician', 'Storekeeper', 'Manager']);

  ngOnInit() {
    this.loadCompanyUsers();
    this.loadRoles();
  }

  loadRoles() {
    this.companyService.getAvailableRoles().subscribe({
      next: (roles) => this.roles.set(roles)
    });
  }

  onEmailChange() {
    this.userChecked = false;
    this.userExists = false;
    this.emailValid = this.validateEmail(this.email);
  }

  checkUser() {
    if (!this.emailValid) return;

    this.auth.checkUserExists(this.email).subscribe({
      next: (res) => {
        this.userChecked = true;
        this.userExists = res.exists;
        if (res.exists) this.foundUserName = res.fullName || '';
      }
    });
  }

  inviteUser() {
    if (!this.emailValid || !this.selectedRole || !this.userExists) return;

    this.loading.set(true);
    this.companyService.inviteUser(this.email, this.selectedRole, this.remarks).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.successMessage.set(res.message);
          this.email = '';
          this.selectedRole = '';
          this.remarks = '';
          this.userChecked = false;
          this.userExists = false;
          setTimeout(() => this.successMessage.set(''), 3000);
          this.loadCompanyUsers();
        } else {
          this.errorMessage.set(res.message);
          setTimeout(() => this.errorMessage.set(''), 3000);
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Failed to send invitation');
        setTimeout(() => this.errorMessage.set(''), 3000);
      }
    });
  }

  loadCompanyUsers() {
    this.companyService.getCompanyUsers().subscribe({
      next: (users) => this.companyUsers.set(users)
    });
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
