// Encryptz/components/login-component/login-component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { safeNextUrl } from '../../Auth/return-url';
import { LoginBrandPanelComponent } from '../login-brand-panel/login-brand-panel';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LoginBrandPanelComponent],
  templateUrl: './login-component.html',
  styleUrls: ['./login-component.scss']
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  /** A Job Portal page to come back to (the public job pages send people here to apply). */
  readonly next = safeNextUrl(inject(ActivatedRoute).snapshot.queryParamMap.get('next'));

  mode = signal<'email' | 'otp'>('email');
  loading = signal(false);
  error = signal('');
  otpSent = signal(false);
  locationLogoutMsg = signal('');

  showPassword = signal(false);
  rememberMe = true;
  private static readonly RememberKey = 'encryptz_remember_email';

  // Forgot Password States
  showForgotPasswordModal = signal(false);
  forgotPasswordStep = signal<'email' | 'otp'>('email');
  forgotPasswordEmail = '';
  forgotPasswordOtp = '';
  forgotPasswordNewPwd = '';
  forgotPasswordLoading = signal(false);
  forgotPasswordError = signal('');
  forgotPasswordSuccess = signal('');

  email = '';
  password = '';
  mobile = '';
  otpCode = '';

  constructor() {
    // Clear any existing session so pressing back+forward can't skip login
    this.auth.clearSession();

    // Show location-error message if redirected here due to location denial
    const msg = sessionStorage.getItem('encryptz_location_error')
              || sessionStorage.getItem('encryptz_location_logout');
    if (msg) {
      this.locationLogoutMsg.set(msg);
      sessionStorage.removeItem('encryptz_location_error');
      sessionStorage.removeItem('encryptz_location_logout');
    }

    this.email = this.readRemembered();
  }

  /** Remember me keeps only the sign-in name on this browser, never the password. */
  private readRemembered(): string {
    try { return localStorage.getItem(LoginComponent.RememberKey) ?? ''; } catch { return ''; }
  }

  private saveRemembered(): void {
    try {
      if (this.rememberMe) localStorage.setItem(LoginComponent.RememberKey, this.email);
      else localStorage.removeItem(LoginComponent.RememberKey);
    } catch { /* storage blocked: nothing to remember */ }
  }

 loginEmail(): void {
  this.loading.set(true);
  this.error.set('');

  this.auth.loginWithCompanies(this.email, this.password).subscribe({
    next: (res) => {
      this.loading.set(false);

      if (!res.success || !res.data) {
        this.error.set(res.message);
        return;
      }

      this.saveRemembered();

      // A platform administrator manages the platform: no company to pick.
      if (res.data.isPlatformAdmin) {
        this.router.navigate(['/settings/platform']);
        return;
      }

      this.goOn();
    },
    error: () => {
      this.loading.set(false);
      this.error.set('Login failed. Please try again.');
    }
  });
}

  sendOtp(): void {
    if (!this.mobile) {
      this.error.set('Please enter mobile number');
      return;
    }

    this.loading.set(true);
    this.auth.sendOtp(this.mobile).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.otpSent.set(true);
          this.error.set('');
        } else {
          this.error.set(res.message || 'Failed to send OTP');
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to send OTP. Please try again.');
      }
    });
  }

  verifyOtp(): void {
    if (!this.otpCode || this.otpCode.length !== 6) {
      this.error.set('Please enter valid 6-digit OTP');
      return;
    }

    this.loading.set(true);
    this.auth.verifyOtp(this.mobile, this.otpCode).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          // After OTP verification, get user companies
          this.auth.getUserCompanies().subscribe({
            next: (companies) => {
              this.handlePostLoginWithData(res.data, companies);
            }
          });
        } else {
          this.error.set(res.message || 'Invalid OTP');
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('OTP verification failed. Please try again.');
      }
    });
  }

private handlePostLogin(data: any): void {
  this.goOn();
}

  /**
   * After signing in: back to the job the person wanted to apply for, else the company list.
   * The company list is always shown (also with no company): it is where a user creates or
   * joins a company.
   */
  private goOn(): void {
    if (this.next) this.router.navigateByUrl(this.next);
    else this.router.navigate(['/select-company']);
  }

  private handlePostLoginWithData(userData: any, companies: any[]): void {
    // The company list is always shown, also for a single company (it is where a
    // user creates or joins a company); the module and branch steps follow it.
    this.goOn();
  }

  // ============================================
  // FORGOT PASSWORD METHODS
  // ============================================

  openForgotPassword(): void {
    this.showForgotPasswordModal.set(true);
    this.forgotPasswordStep.set('email');
    this.forgotPasswordEmail = '';
    this.forgotPasswordOtp = '';
    this.forgotPasswordNewPwd = '';
    this.forgotPasswordError.set('');
    this.forgotPasswordSuccess.set('');
  }

  closeForgotPassword(): void {
    this.showForgotPasswordModal.set(false);
  }

  submitForgotPasswordEmail(): void {
    if (!this.forgotPasswordEmail) {
      this.forgotPasswordError.set('Please enter your email address');
      return;
    }

    this.forgotPasswordLoading.set(true);
    this.forgotPasswordError.set('');
    
    this.auth.forgotPassword(this.forgotPasswordEmail).subscribe({
      next: (res) => {
        this.forgotPasswordLoading.set(false);
        if (res.success) {
          this.forgotPasswordStep.set('otp');
          // For testing, backend returns OTP in data. In production, this would be hidden.
          // Optional: this.forgotPasswordSuccess.set(`OTP sent! (Test OTP: ${res.data})`);
          this.forgotPasswordSuccess.set('OTP has been sent to your email.');
        } else {
          this.forgotPasswordError.set(res.message || 'Failed to send OTP');
        }
      },
      error: () => {
        this.forgotPasswordLoading.set(false);
        this.forgotPasswordError.set('Network error occurred. Please try again.');
      }
    });
  }

  submitForgotPasswordReset(): void {
    if (!this.forgotPasswordOtp || !this.forgotPasswordNewPwd) {
      this.forgotPasswordError.set('Please fill all fields');
      return;
    }

    this.forgotPasswordLoading.set(true);
    this.forgotPasswordError.set('');
    this.forgotPasswordSuccess.set('');

    this.auth.resetPassword({
      email: this.forgotPasswordEmail,
      otpCode: this.forgotPasswordOtp,
      newPassword: this.forgotPasswordNewPwd
    }).subscribe({
      next: (res) => {
        this.forgotPasswordLoading.set(false);
        if (res.success) {
          this.forgotPasswordSuccess.set('Password reset successfully! You can now login.');
          setTimeout(() => {
            this.closeForgotPassword();
          }, 3000);
        } else {
          this.forgotPasswordError.set(res.message || 'Failed to reset password');
        }
      },
      error: () => {
        this.forgotPasswordLoading.set(false);
        this.forgotPasswordError.set('Network error occurred. Please try again.');
      }
    });
  }
}
