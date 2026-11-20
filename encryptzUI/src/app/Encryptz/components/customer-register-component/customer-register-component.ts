import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerAuthService, CustomerTenantProject } from '../../Services/customer-auth-service';


@Component({
  selector: 'app-customer-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `

    <main class="page">
      <div class="card">

        <div class="brand">
          <div class="brand-icon">{{ (tenantCompanyName() || 'C').charAt(0) }}</div>
          <span class="brand-name">{{ tenantCompanyName() }}</span>
        </div>

        <h1 class="heading">Create account</h1>
        <p class="subheading">Register as a customer to get started</p>

        @if (!tenantSelected()) {
          <div class="tenant-form">
            @if (tenantProjects().length > 0) {
              <div class="field">
                <label for="tenantProject">Project</label>
                <select id="tenantProject" name="tenantProject" class="tenant-project-select" [(ngModel)]="selectedProjectKey" required>
                  <option value="" disabled>Select your project</option>
                  @for (project of tenantProjects(); track project.projectKey) {
                    <option [value]="project.projectKey">{{ project.projectName }}</option>
                  }
                </select>
              </div>
              <button type="button" class="register-btn" [disabled]="!selectedProjectKey" (click)="useTenantProject()">Continue</button>
            } @else if (tenantLoading()) {
              <div class="tenant-prompt">Checking company link…</div>
            } @else {
              <div class="tenant-prompt">Open the customer registration link provided by your company.</div>
            }
            @if (tenantError()) { <div class="error-hint">{{ tenantError() }}</div> }
          </div>
        } @else {
          <div class="tenant-current">
            <span>{{ tenantCompanyName() }}</span>
          </div>

        @if (successMessage()) {
          <div class="alert alert-success">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>{{ successMessage() }}</span>
            <button class="alert-close" type="button" (click)="successMessage.set(null)" aria-label="Dismiss">×</button>
          </div>
        }

        @if (errorMessage()) {
          <div class="alert alert-error">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{{ errorMessage() }}</span>
            <button class="alert-close" type="button" (click)="errorMessage.set(null)" aria-label="Dismiss">×</button>
          </div>
        }

        <form (ngSubmit)="onSubmit()" #registerForm="ngForm" novalidate>

          <div class="field">
            <label for="fullName">Full name</label>
            <div class="input-wrap">
              <span class="input-icon">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                type="text"
                id="fullName"
                name="fullName"
                [(ngModel)]="fullName"
                required
                minlength="3"
                #fullNameField="ngModel"
                placeholder="Your full name"
                autocomplete="name"
                [class.invalid]="fullNameField.invalid && fullNameField.touched"
              />
            </div>
            @if (fullNameField.invalid && fullNameField.touched) {
              <div class="error-hint">Name must be at least 3 characters</div>
            }
          </div>

          <div class="row-2">
            <div class="field">
              <label for="email">Email</label>
              <div class="input-wrap">
                <span class="input-icon">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m2 7 10 7 10-7"/>
                  </svg>
                </span>
                <input
                  type="email"
                  id="email"
                  name="email"
                  [(ngModel)]="email"
                  required
                  email
                  #emailField="ngModel"
                  placeholder="you&#64;example.com"
                  autocomplete="email"
                  [class.invalid]="emailField.invalid && emailField.touched"
                />
              </div>
              @if (emailField.invalid && emailField.touched) {
                <div class="error-hint">Please enter a valid email</div>
              }
            </div>

            <div class="field">
              <label for="mobileNumber">Mobile</label>
              <div class="input-wrap">
                <span class="input-icon">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </span>
                <input
                  type="tel"
                  id="mobileNumber"
                  name="mobileNumber"
                  [(ngModel)]="mobileNumber"
                  required
                  pattern="^[0-9]{10}$"
                  #mobileField="ngModel"
                  placeholder="10-digit number"
                  autocomplete="tel"
                  [class.invalid]="mobileField.invalid && mobileField.touched"
                />
              </div>
              @if (mobileField.invalid && mobileField.touched) {
                <div class="error-hint">Enter a valid 10-digit number</div>
              }
            </div>
          </div>

          <div class="row-2">
            <div class="field">
              <label for="password">Password</label>
              <div class="input-wrap">
                <span class="input-icon">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  id="password"
                  name="password"
                  [(ngModel)]="password"
                  required
                  minlength="6"
                  #passwordField="ngModel"
                  placeholder="Create a password"
                  autocomplete="new-password"
                  [class.invalid]="passwordField.invalid && passwordField.touched"
                />
                <button class="eye-btn" type="button" (click)="togglePasswordVisibility('password')" aria-label="Toggle password">
                  @if (showPassword) {
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  } @else {
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  }
                </button>
              </div>
              @if (passwordField.invalid && passwordField.touched) {
                <div class="error-hint">At least 6 characters</div>
              }
            </div>

            <div class="field">
              <label for="confirmPassword">Confirm password</label>
              <div class="input-wrap">
                <span class="input-icon">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  [type]="showConfirmPassword ? 'text' : 'password'"
                  id="confirmPassword"
                  name="confirmPassword"
                  [(ngModel)]="confirmPassword"
                  required
                  #confirmField="ngModel"
                  placeholder="Repeat password"
                  autocomplete="new-password"
                  [class.invalid]="confirmField.touched && password !== confirmPassword"
                />
                <button class="eye-btn" type="button" (click)="togglePasswordVisibility('confirm')" aria-label="Toggle password">
                  @if (showConfirmPassword) {
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  } @else {
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  }
                </button>
              </div>
              @if (confirmField.touched && password !== confirmPassword) {
                <div class="error-hint">Passwords do not match</div>
              }
            </div>
          </div>

          <button
            type="submit"
            class="register-btn"
            [disabled]="registerForm.invalid || password !== confirmPassword || isLoading()"
          >
            @if (isLoading()) {
              <span class="spinner"></span>
              <span>Creating account…</span>
            } @else {
              <span>Create Account</span>
            }
          </button>
        </form>
        }

        <div class="divider"><span>or</span></div>

        <p class="login-link">Already have an account? <a [routerLink]="loginUrl()">Login here</a></p>

      </div>
    </main>

    @if (showCompanyPopup()) {
      <div class="popup-backdrop" (click)="showCompanyPopup.set(false)">
        <div class="popup-card" (click)="$event.stopPropagation()">
          <div class="popup-header">
            <h3>Select user details</h3>
            <p>Email / Mobile already registered. Please choose one to continue.</p>
          </div>

          <div class="company-list">
            @for (company of companyList(); track company.companyId) {
              <div
                class="company-item"
                [class.selected]="selectedCompanyId() === company.companyId"
                (click)="selectedCompanyId.set(company.companyId)"
              >
                <div class="radio-dot" [class.on]="selectedCompanyId() === company.companyId"></div>
                <div class="company-details">
                  <div class="company-name">{{ company.companyName }}</div>
                  <div class="company-role">{{ company.roleInCompany }}</div>
                </div>
              </div>
            }
          </div>

          <div class="popup-actions">
            <button type="button" class="btn-cancel" (click)="showCompanyPopup.set(false)">Cancel</button>
            <button
              type="button"
              class="btn-continue"
              [disabled]="!selectedCompanyId()"
              (click)="continueWithSelectedCompany()"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: '../shared/customer-auth.scss',
})
export class CustomerRegisterComponent implements OnInit {
  private authService = inject(CustomerAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Form fields
  fullName = '';
  email = '';
  mobileNumber = '';
  password = '';
  confirmPassword = '';
  address = '';
  city = '';
  state = '';
  pinCode = '';
  acceptTerms = false;

  // UI state
  showPassword = false;
  showConfirmPassword = false;
  isLoading = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  existingUserId = signal<number>(0);
  showCompanyPopup = signal(false);
  selectedCompanyId = signal<number | null>(null);
  companyList = signal<any[]>([]);
  tenantCompanyName = signal('Customer Portal');
  tenantSelected = signal(false);
  tenantProjects = signal<CustomerTenantProject[]>([]);
  tenantLoading = signal(false);
  tenantError = signal('');
  companyCode = '';
  selectedProjectKey = '';

  ngOnInit() {
    this.resetForm();
    const companyCode = this.route.snapshot.paramMap.get('companyCode');
    if (companyCode) {
      this.companyCode = companyCode;
      this.authService.clearTenantSelection();
      this.resolveTenant();
      return;
    }

    if (!this.authService.hasTenantProject()) return;

    this.tenantSelected.set(true);
    const savedName = localStorage.getItem('customer_company_name');
    if (savedName) this.tenantCompanyName.set(savedName);

    this.authService.getTenantCompanyName().subscribe({
      next: response => {
        if (response.success && response.data?.trim()) {
          this.tenantCompanyName.set(response.data);
          localStorage.setItem('customer_company_name', response.data);
        }
      },
      error: () => {
        this.tenantSelected.set(false);
        this.authService.clearTenantSelection();
        this.tenantError.set('Company link is unavailable. Reopen the registration link provided by your company.');
      }
    });
  }

  resolveTenant(): void {
    this.tenantLoading.set(true);
    this.tenantError.set('');
    this.authService.resolveTenant(this.companyCode).subscribe({
      next: response => {
        this.tenantLoading.set(false);
        if (!response.success || !response.data?.length) {
          this.tenantError.set(response.message || 'Company code was not found.');
          return;
        }
        this.tenantProjects.set(response.data);
        if (response.data.length === 1) this.useTenantProject(response.data[0]);
      },
      error: err => {
        this.tenantLoading.set(false);
        this.tenantError.set(err?.error?.message || 'Could not find that company. Try again.');
      }
    });
  }

  useTenantProject(project?: CustomerTenantProject): void {
    const selected = project ?? this.tenantProjects().find(item => item.projectKey === this.selectedProjectKey);
    if (!selected) return;
    this.authService.setTenantProject(selected, this.companyCode);
    this.tenantCompanyName.set(selected.companyName);
    this.tenantSelected.set(true);
    this.tenantError.set('');
  }

  loginUrl(): string {
    const companyCode = this.route.snapshot.paramMap.get('companyCode') || localStorage.getItem('customer_company_code');
    if (companyCode) return `/customer/login/${encodeURIComponent(companyCode)}`;

    const projectKey = new URLSearchParams(window.location.search).get('project');
    return projectKey ? `/customer/login?project=${encodeURIComponent(projectKey)}` : '/customer/login';
  }

  onSubmit() {
    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match');
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage.set('Password must be at least 6 characters');
      return;
    }

    const payload = {
      FullName: this.fullName,
      Email: this.email,
      MobileNumber: this.mobileNumber,
      PasswordHash: this.password,
      Address: this.address,
      City: this.city,
      State: this.state,
      PinCode: this.pinCode,
      CompanyId: this.selectedCompanyId() ?? null
    };

    this.isLoading.set(true);
    this.authService.register(payload).subscribe({
      next: (res: any) => {
        this.isLoading.set(false);

        if (res.success && res.data.message != 'UserAlreadyExists') {
          this.successMessage.set('Registration successful');
          this.router.navigate(['/customer/login']);
        }
        else if (res.success && res.data.message == 'UserAlreadyExists') {
          this.existingUserId.set(res.data.userId);
          this.loadCompanyList();
        }
        else {
          this.errorMessage.set(res.message);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Unable to register');
      }
    });
  }

  loadCompanyList() {
    const data = this.existingUserId();

    this.authService
      .getExistingUserCompanies(data, this.password)
      .subscribe({
        next: (res: any) => {
          if (!res?.success) {
            this.errorMessage.set(res?.message || 'Unable to load company list');
            return;
          }

          const companies = res.data || [];
          this.companyList.set(companies);

          if (companies.length === 0) {
            this.selectedCompanyId.set(null);
            this.continueWithSelectedCompany();
            return;
          }

          if (companies.length === 1) {
            this.selectedCompanyId.set(companies[0].companyId);
          } else {
            this.selectedCompanyId.set(null);
          }

          this.showCompanyPopup.set(true);
        },
        error: () => {
          this.errorMessage.set('Unable to load company list');
        }
      });
  }

  continueWithSelectedCompany() {
    this.errorMessage.set(null);

    const payload = {
      UserId: this.existingUserId(),
      Password: this.password,   // proves the existing account is the caller's
      CompanyId: this.selectedCompanyId(),
      Address: this.address,
      City: this.city,
      State: this.state,
      PinCode: this.pinCode
    };

    this.authService.insertCustomerForExistingUser(payload).subscribe({
      next: (res: any) => {
        if (!res?.success) {
          this.errorMessage.set(res?.message || 'Unable to create customer');
          this.router.navigate(['/customer/login']);
          return;
        }

        if (res.success) {
          this.showCompanyPopup.set(false);
          this.selectedCompanyId.set(null);
          this.companyList.set([]);

          this.successMessage.set(res.message);

          setTimeout(() => {
            this.router.navigate(['/customer/login']);
          }, 20);
        } else {
          this.errorMessage.set(res.message);
        }
      },
      error: (err) => {
        this.errorMessage.set(
          err?.error?.message ||
          err?.error?.data?.message ||
          'Unable to create customer'
        );
      }
    });
  }

  private resetForm(): void {
    this.fullName = '';
    this.email = '';
    this.mobileNumber = '';
    this.password = '';
    this.confirmPassword = '';
    this.address = '';
    this.city = '';
    this.state = '';
    this.pinCode = '';
    this.acceptTerms = false;
  }

  togglePasswordVisibility(field: 'password' | 'confirm'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }
}
