import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { CompanyInfoDto } from '../../Models/ApiModels';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-company-request-component',
   imports: [CommonModule, FormsModule],
  templateUrl: './company-request-component.html',
  styleUrl: './company-request-component.scss',
})
export class CompanyRequestComponent {
   private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(true);
  companies = signal<CompanyInfoDto[]>([]);
  showModal = signal(false);
  submitting = signal(false);
  selectedCompany = signal<CompanyInfoDto | null>(null);
  requestedRole = signal('Technician');
  remarks = signal('');

  ngOnInit() {
    this.loadCompanies();
  }

  loadCompanies() {
    this.loading.set(true);
    this.auth.getAllCompanies().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) this.companies.set(res.data);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  openRequestModal(company: CompanyInfoDto) {
    this.selectedCompany.set(company);
    this.showModal.set(true);
  }

  submitRequest() {
    const company = this.selectedCompany();
    if (!company) return;

    this.submitting.set(true);
    this.auth.createJoinRequest(company.companyId, this.requestedRole(), this.remarks()).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success) {
          alert('Request sent successfully!');
          this.showModal.set(false);
          this.loadCompanies();
          this.requestedRole.set('Technician');
          this.remarks.set('');
        } else {
          alert(res.message);
        }
      },
      error: () => {
        this.submitting.set(false);
        alert('Failed to send request');
      }
    });
  }

  goBack() {
    this.router.navigate(['/complaints/dashboard']);
  }
}
