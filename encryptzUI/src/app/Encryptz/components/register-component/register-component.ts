// src/app/modules/customer-portal/components/register/register.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { ROLES } from '../../Models/ApiModels';
import { LoginBrandPanelComponent } from '../login-brand-panel/login-brand-panel';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LoginBrandPanelComponent],
  templateUrl: './register-component.html',
  styleUrls: ['./register-component.scss'],
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');
  success = signal('');
  /** The message of each field that is wrong, shown under it; a field's message goes when it changes. */
  fieldErrors = signal<Record<string, string>>({});
  showPassword = signal(false);

  fullName = '';
  email = '';
  mobileNumber = '';
  password = '';
  confirmPassword = '';
  aadhaarNumber = '';

  clearError(field: string): void {
    if (this.fieldErrors()[field]) {
      const { [field]: _, ...rest } = this.fieldErrors();
      this.fieldErrors.set(rest);
    }
    this.error.set('');
  }

  /** The same rules as the server (RegistrationRules), all fields at once. */
  private validate(): Record<string, string> {
    const e: Record<string, string> = {};
    const email = this.email.trim();
    const mobile = this.mobileNumber.trim();
    const mobileDigits = mobile.replace(/\D/g, '').length;

    if (!this.fullName.trim()) e['fullName'] = 'Enter your full name';
    if (!email) e['email'] = 'Enter your e-mail address';
    else if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"'.]{2,}$/.test(email)) e['email'] = 'Enter a valid e-mail address';
    if (!mobile) e['mobileNumber'] = 'Enter your mobile number';
    else if (!/^\+?[0-9 ()\-]+$/.test(mobile) || mobileDigits < 10 || mobileDigits > 15) e['mobileNumber'] = 'Enter a valid mobile number (10 digits)';
    if (this.aadhaarNumber.trim() && !/^\d{12}$/.test(this.aadhaarNumber.trim())) e['aadhaarNumber'] = 'The Aadhaar number must be 12 digits';
    if (!this.password) e['password'] = 'Enter a password';
    else if (this.password.length < 6) e['password'] = 'At least 6 characters';
    if (!this.confirmPassword) e['confirmPassword'] = 'Enter the password again';
    else if (this.password !== this.confirmPassword) e['confirmPassword'] = 'The passwords do not match';
    return e;
  }

  register(): void {
    const problems = this.validate();
    this.fieldErrors.set(problems);
    if (Object.keys(problems).length) {
      this.error.set('');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    this.auth.selfRegister({
      fullName: this.fullName.trim(),
      email: this.email.trim(),
      mobileNumber: this.mobileNumber.trim(),
      password: this.password,
      aadhaarNumber: this.aadhaarNumber.trim()
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.success.set(res.message || 'Registration successful! Redirecting to login...');
          // back to the job the person wanted to apply for, if they came from one (?next= stays)
          setTimeout(() => this.router.navigate(['/login'], { queryParamsHandling: 'preserve' }), 3000);
        } else {
          this.error.set(res.message || 'Registration failed');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Registration failed. Please try again.');
      }
    });
  }
}
