import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { CompanyInfoDto } from '../../Models/ApiModels';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../Services/dialog-service';

@Component({
  selector: 'app-company-request-component',
   imports: [CommonModule, FormsModule],
  templateUrl: './company-request-component.html',
  styleUrl: './company-request-component.scss',
})
export class CompanyRequestComponent {
  private dialog = inject(DialogService);
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
          this.dialog.alert('Request sent successfully!');
          this.showModal.set(false);
          this.loadCompanies();
          this.requestedRole.set('Technician');
          this.remarks.set('');
        } else {
          this.dialog.alert(res.message);
        }
      },
      error: () => {
        this.submitting.set(false);
        this.dialog.alert('Failed to send request');
      }
    });
  }

  goBack() {
    this.router.navigate(['/complaints/dashboard']);
  }
}
