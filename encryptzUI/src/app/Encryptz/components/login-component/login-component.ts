// Encryptz/components/login-component/login-component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login-component.html',
  styleUrls: ['./login-component.scss']
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  mode = signal<'email' | 'otp'>('email');
  loading = signal(false);
  error = signal('');
  otpSent = signal(false);
  locationPrompt = signal(false);
  locationError = signal('');
  locationLogoutMsg = signal('');

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
    const msg = sessionStorage.getItem('encryptz_location_logout');
    if (msg) {
      this.locationLogoutMsg.set(msg);
      sessionStorage.removeItem('encryptz_location_logout');
    }
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

      const companies = res.data.companies || [];

      if (companies.length === 0) {
        this.router.navigate(['/no-company']);
        return;
      }

      this.router.navigate(['/select-company']);
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


  const companies = data.companies || [];

  if (companies.length === 0) {
    this.router.navigate(['/no-company']);
  } else {
    this.router.navigate(['/select-company']);
  }
}

  private handlePostLoginWithData(userData: any, companies: any[]): void {
    if (companies.length === 0) {
      this.router.navigate(['/no-company']);
    } else if (companies.length === 1) {
      this.auth.selectCompany(companies[0].companyId).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.redirectByRole(res.data.role);
          }
        }
      });
    } else {
      this.router.navigate(['/select-company']);
    }
  }

  private redirectByRole(role: string): void {
    if (role === 'Technician') {
      this.locationPrompt.set(true);
      this.requestLocation();
    } else if (role === 'Admin' || role === 'CompanyAdmin') {
      this.router.navigate(['/complaints/dashboard']);
    } else if (role === 'Storekeeper') {
      this.router.navigate(['/store/inventory']);
    } else {
      this.router.navigate(['/complaints/dashboard']);
    }
  }

  requestLocation(): void {
    this.locationError.set('');

    if (!navigator.geolocation) {
      this.locationError.set('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        localStorage.setItem('encryptz_last_lat', position.coords.latitude.toString());
        localStorage.setItem('encryptz_last_lng', position.coords.longitude.toString());
        this.locationPrompt.set(false);
        this.router.navigate(['/technicians/work-orders']);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            this.locationError.set('Location permission denied. Please enable it to continue.');
            break;
          case err.POSITION_UNAVAILABLE:
            this.locationError.set('Location unavailable. Please check your GPS.');
            break;
          case err.TIMEOUT:
            this.locationError.set('Location request timed out. Please try again.');
            break;
          default:
            this.locationError.set('Unable to get location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
