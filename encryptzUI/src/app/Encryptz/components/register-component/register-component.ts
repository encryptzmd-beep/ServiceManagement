// src/app/modules/customer-portal/components/register/register.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { ROLES } from '../../Models/ApiModels';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register-component.html',
  styleUrls: ['./register-component.scss'],
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');
  success = signal('');
  passwordMismatch = signal(false);

  fullName = '';
  email = '';
  mobileNumber = '';
  password = '';
  confirmPassword = '';
  aadhaarNumber = '';

  register(): void {
    // Validation
    if (!this.fullName || !this.email || !this.mobileNumber || !this.password) {
      this.error.set('Please fill all required fields');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.passwordMismatch.set(true);
      return;
    }
    this.passwordMismatch.set(false);

    if (this.password.length < 6) {
      this.error.set('Password must be at least 6 characters');
      return;
    }

    if (this.aadhaarNumber && !/^\d{12}$/.test(this.aadhaarNumber)) {
      this.error.set('Aadhaar number must be 12 digits');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    this.auth.selfRegister({
      fullName: this.fullName,
      email: this.email,
      mobileNumber: this.mobileNumber,
      password: this.password,
      aadhaarNumber: this.aadhaarNumber || ""
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.success.set(res.message || 'Registration successful! Redirecting to login...');
          setTimeout(() => this.router.navigate(['/login']), 3000);
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
