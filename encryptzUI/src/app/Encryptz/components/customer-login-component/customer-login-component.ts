import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerAuthService, CustomerTenantProject } from '../../Services/customer-auth-service';
import { apiErrorMessage } from '../../Auth/api-error';


@Component({
  selector: 'app-customer-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `

    <main class="page">
      <div class="card">

        <div class="brand">
          <div class="brand-icon">{{ (tenantCompanyName() || 'C').charAt(0) }}</div>
          <span class="brand-name">{{ tenantCompanyName() }}</span>
        </div>

        <h1 class="heading">Welcome back</h1>
        <p class="subheading">Sign in to your customer portal</p>

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
              <button type="button" class="login-btn" [disabled]="!selectedProjectKey" (click)="useTenantProject()">Continue</button>
            } @else if (tenantLoading()) {
              <div class="tenant-prompt">Checking company link…</div>
            } @else {
              <div class="tenant-prompt">Open the customer login link provided by your company.</div>
            }
            @if (tenantError()) { <div class="error-hint">{{ tenantError() }}</div> }
          </div>
        } @else {
          <div class="tenant-current">
            <span>{{ tenantCompanyName() }}</span>
          </div>

        @if (errorMessage()) {
          <div class="alert-error">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{{ errorMessage() }}</span>
            <button class="alert-close" type="button" (click)="errorMessage.set(null)" aria-label="Dismiss">×</button>
          </div>
        }

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm" novalidate>
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
                placeholder="••••••••"
                autocomplete="current-password"
                [class.invalid]="passwordField.invalid && passwordField.touched"
              />
              <button class="eye-btn" type="button" (click)="togglePasswordVisibility()" aria-label="Toggle password">
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
              <div class="error-hint">Password must be at least 6 characters</div>
            }
          </div>

          <div class="meta-row">
            <label class="remember">
              <input type="checkbox" [(ngModel)]="rememberMe" name="rememberMe"/>
              <span class="check-box">
                <svg width="9" height="9" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 12 12">
                  <polyline points="2,6 5,9 10,3"/>
                </svg>
              </span>
              Remember me
            </label>
            <button type="button" class="forgot" (click)="openForgotPassword()">Forgot password?</button>
          </div>

          <button
            type="submit"
            class="login-btn"
            [disabled]="loginForm.invalid || isLoading()"
          >
            @if (isLoading()) {
              <span class="spinner"></span>
              <span>Signing in…</span>
            } @else {
              <span>Sign In</span>
            }
          </button>
        </form>
        }

        <div class="divider"><span>or</span></div>

        <p class="register">Don't have an account? <a [routerLink]="registerUrl()">Register here</a></p>

      </div>
    </main>

    @if (forgotPasswordOpen()) {
      <div class="forgot-backdrop" (click)="closeForgotPassword()">
        <section class="forgot-panel" role="dialog" aria-modal="true" aria-labelledby="forgotTitle" (click)="$event.stopPropagation()">
          <button type="button" class="forgot-close" (click)="closeForgotPassword()" aria-label="Close">×</button>
          <h2 id="forgotTitle">Reset customer password</h2>
          <p class="forgot-copy">{{ tenantCompanyName() }}</p>

          @if (forgotPasswordStep() === 'email') {
            <label for="resetEmail">Email</label>
            <input id="resetEmail" type="email" [(ngModel)]="forgotEmail" name="resetEmail" autocomplete="email" placeholder="you&#64;example.com" />
            <button type="button" class="login-btn" [disabled]="forgotPasswordLoading()" (click)="requestPasswordReset()">
              {{ forgotPasswordLoading() ? 'Sending…' : 'Send reset code' }}
            </button>
          } @else {
            <label for="resetOtp">Email code</label>
            <input id="resetOtp" type="text" [(ngModel)]="forgotOtp" name="resetOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" />
            <label for="resetNewPassword">New password</label>
            <input id="resetNewPassword" type="password" [(ngModel)]="forgotNewPassword" name="resetNewPassword" autocomplete="new-password" minlength="6" placeholder="At least 6 characters" />
            <button type="button" class="login-btn" [disabled]="forgotPasswordLoading()" (click)="resetCustomerPassword()">
              {{ forgotPasswordLoading() ? 'Resetting…' : 'Reset password' }}
            </button>
          }

          @if (forgotPasswordMessage()) { <p class="forgot-message">{{ forgotPasswordMessage() }}</p> }
          @if (forgotPasswordError()) { <p class="forgot-error">{{ forgotPasswordError() }}</p> }
        </section>
      </div>
    }
  `,
  styleUrl: '../shared/customer-auth.scss',
})
export class CustomerLoginComponent implements OnInit {
  private authService = inject(CustomerAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  email = '';
  password = '';
  rememberMe = false;
  showPassword = false;

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  forgotPasswordOpen = signal(false);
  forgotPasswordStep = signal<'email' | 'otp'>('email');
  forgotPasswordLoading = signal(false);
  forgotPasswordMessage = signal('');
  forgotPasswordError = signal('');
  forgotEmail = '';
  forgotOtp = '';
  forgotNewPassword = '';
  tenantCompanyName = signal('Customer Portal');
  tenantSelected = signal(false);
  tenantProjects = signal<CustomerTenantProject[]>([]);
  tenantLoading = signal(false);
  tenantError = signal('');
  companyCode = '';
  selectedProjectKey = '';

  ngOnInit(): void {
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
        this.tenantError.set('Company link is unavailable. Enter your company code.');
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

  registerUrl(): string {
    const companyCode = this.route.snapshot.paramMap.get('companyCode') || localStorage.getItem('customer_company_code');
    if (companyCode) return `/customer/register/${encodeURIComponent(companyCode)}`;

    const projectKey = new URLSearchParams(window.location.search).get('project');
    return projectKey ? `/customer/register?project=${encodeURIComponent(projectKey)}` : '/customer/register';
  }

  openForgotPassword(): void {
    this.forgotEmail = this.email;
    this.forgotOtp = '';
    this.forgotNewPassword = '';
    this.forgotPasswordStep.set('email');
    this.forgotPasswordMessage.set('');
    this.forgotPasswordError.set('');
    this.forgotPasswordOpen.set(true);
  }

  closeForgotPassword(): void {
    this.forgotPasswordOpen.set(false);
    this.forgotPasswordLoading.set(false);
  }

  requestPasswordReset(): void {
    if (!this.forgotEmail.trim()) {
      this.forgotPasswordError.set('Enter your account email');
      return;
    }

    this.forgotPasswordLoading.set(true);
    this.forgotPasswordError.set('');
    this.authService.requestPasswordReset(this.forgotEmail.trim()).subscribe({
      next: response => {
        this.forgotPasswordLoading.set(false);
        if (!response.success) {
          this.forgotPasswordError.set(response.message || 'Could not send reset code');
          return;
        }
        this.forgotPasswordStep.set('otp');
        this.forgotPasswordMessage.set(response.message);
      },
      error: err => {
        this.forgotPasswordLoading.set(false);
        this.forgotPasswordError.set(err?.error?.message || 'Could not send reset code. Try again.');
      }
    });
  }

  resetCustomerPassword(): void {
    if (!this.forgotOtp.trim() || this.forgotNewPassword.length < 6) {
      this.forgotPasswordError.set('Enter the email code and a password of at least 6 characters');
      return;
    }

    this.forgotPasswordLoading.set(true);
    this.forgotPasswordError.set('');
    this.authService.resetPassword(this.forgotEmail.trim(), this.forgotOtp.trim(), this.forgotNewPassword).subscribe({
      next: response => {
        this.forgotPasswordLoading.set(false);
        if (!response.success) {
          this.forgotPasswordError.set(response.message || 'Could not reset password');
          return;
        }
        this.email = this.forgotEmail.trim();
        this.password = '';
        this.forgotPasswordMessage.set('Password reset. Close this panel and sign in with your new password.');
      },
      error: err => {
        this.forgotPasswordLoading.set(false);
        this.forgotPasswordError.set(err?.error?.message || 'Could not reset password. Try again.');
      }
    });
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage.set('Please enter both email and password');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success) {
          this.router.navigate(['/customer/complaints']);
        } else {
          this.errorMessage.set(response.message || 'Login failed. Please check your credentials.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'Login failed. Please try again.'));
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
}
