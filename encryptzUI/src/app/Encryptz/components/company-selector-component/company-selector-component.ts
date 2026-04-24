import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, Company } from '../../Auth/auth-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-company-selector-component',
  imports: [CommonModule],
  templateUrl: './company-selector-component.html',
  styleUrl: './company-selector-component.scss',
})
export class CompanySelectorComponent {
    private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(true);
  error = signal('');
  companies = signal<Company[]>([]);
  showCreateCompany = signal(true); // Show disabled create company option

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
}
