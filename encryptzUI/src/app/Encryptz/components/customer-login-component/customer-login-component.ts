import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerAuthService } from '../../Services/customer-auth-service';


@Component({
  selector: 'app-customer-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="bg-canvas">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
    </div>

    <main class="page">
      <div class="card">

        <div class="brand">
          <div class="brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <span class="brand-name">Felix Fitness</span>
        </div>

        <h1 class="heading">Welcome back</h1>
        <p class="subheading">Sign in to your customer portal</p>

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
            <a href="#" class="forgot">Forgot password?</a>
          </div>

          <button
            type="submit"
            class="login-btn"
            [disabled]="loginForm.invalid || isLoading()"
          >
            <span class="btn-shimmer"></span>
            @if (isLoading()) {
              <span class="spinner"></span>
              <span>Signing in…</span>
            } @else {
              <span>Sign In</span>
            }
          </button>
        </form>

        <div class="divider"><span>or</span></div>

        <p class="register">Don't have an account? <a routerLink="/customer/register">Register here</a></p>

      </div>
    </main>
  `,
  styles: [`
    :host {
      --red: #e8001c;
      --red-deep: #c0001a;
      --red-glow: rgba(232,0,28,0.32);

      --glass-bg: rgba(255,255,255,0.13);
      --glass-border: rgba(255,255,255,0.22);

      --text-main: #ffffff;
      --text-muted: rgba(220,232,255,0.72);
      --text-label: rgba(210,228,255,0.85);

      --input-bg: rgba(255,255,255,0.14);
      --input-focus: rgba(255,255,255,0.22);

      --radius: 10px;

      display: block;
      min-height: 100dvh;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #050d24;
      color: var(--text-main);
      overflow-x: hidden;
      position: relative;
    }

    *, *::before, *::after { box-sizing: border-box; }

    .bg-canvas {
      position: fixed;
      inset: 0;
      z-index: 0;
      background:
        radial-gradient(ellipse 80% 60% at 10% 15%, #0a2a6e 0%, transparent 55%),
        radial-gradient(ellipse 65% 50% at 90% 85%, #0d4070 0%, transparent 50%),
        linear-gradient(155deg, #060e28 0%, #071540 50%, #060f2e 100%);
      pointer-events: none;
    }

    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(110px);
      animation: drift 20s ease-in-out infinite alternate;
      pointer-events: none;
    }
    .blob-1 { width: 550px; height: 550px; background: #1148a0; opacity: 0.35; top: -180px; left: -120px; }
    .blob-2 { width: 450px; height: 450px; background: #1265a0; opacity: 0.28; bottom: -130px; right: -80px; animation-delay: -8s; }

    @keyframes drift {
      from { transform: translate(0, 0); }
      to   { transform: translate(25px, 35px); }
    }

    .page {
      position: relative;
      z-index: 1;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }

    .card {
      width: 100%;
      max-width: 400px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 44px 40px 42px;
      backdrop-filter: blur(40px) saturate(1.5);
      -webkit-backdrop-filter: blur(40px) saturate(1.5);
      box-shadow:
        0 0 0 0.5px rgba(255,255,255,0.12) inset,
        0 2px 0 rgba(255,255,255,0.08) inset,
        0 24px 64px rgba(0,0,0,0.55),
        0 4px 20px rgba(0,0,0,0.3);
      animation: cardIn 0.6s cubic-bezier(.22,1,.36,1) both;
    }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(24px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 36px;
      animation: fadeUp 0.5s 0.08s both;
    }

    .brand-icon {
      width: 36px; height: 36px;
      background: var(--red);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 3px 14px var(--red-glow);
    }

    .brand-name {
      font-family: 'Cormorant Garamond', 'Georgia', serif;
      font-weight: 700;
      font-size: 1.4rem;
      letter-spacing: 0.025em;
      color: #fff;
      line-height: 1;
    }

    .heading {
      font-family: inherit;
      font-weight: 300;
      font-size: 1.65rem;
      letter-spacing: -0.025em;
      color: #ffffff;
      margin: 0 0 6px;
      animation: fadeUp 0.5s 0.13s both;
    }

    .subheading {
      font-size: 0.855rem;
      color: var(--text-muted);
      font-weight: 400;
      margin: 0 0 24px;
      animation: fadeUp 0.5s 0.17s both;
    }

    .alert-error {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      margin-bottom: 18px;
      border-radius: var(--radius);
      background: rgba(232,0,28,0.16);
      border: 1px solid rgba(232,0,28,0.45);
      color: #ffd7dd;
      font-size: 0.82rem;
      animation: shake 0.4s ease;
    }
    .alert-error span { flex: 1; }
    .alert-close {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0 4px;
      opacity: 0.8;
    }
    .alert-close:hover { opacity: 1; }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }

    .field {
      margin-bottom: 14px;
      animation: fadeUp 0.5s both;
    }
    .field:nth-of-type(1) { animation-delay: 0.22s; }
    .field:nth-of-type(2) { animation-delay: 0.27s; }

    label {
      display: block;
      font-size: 0.73rem;
      font-weight: 600;
      color: var(--text-label);
      margin-bottom: 7px;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .input-wrap { position: relative; }

    .input-icon {
      position: absolute;
      left: 13px;
      top: 50%; transform: translateY(-50%);
      color: rgba(200,220,255,0.45);
      pointer-events: none;
      transition: color 0.2s;
      display: flex;
      align-items: center;
    }
    .input-wrap:focus-within .input-icon { color: rgba(210,230,255,0.85); }

    input[type="email"],
    input[type="password"],
    input[type="text"] {
      width: 100%;
      padding: 12px 42px;
      background: var(--input-bg);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: var(--radius);
      color: #ffffff;
      font-family: inherit;
      font-size: 0.9rem;
      font-weight: 400;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
      box-shadow: 0 1px 0 rgba(255,255,255,0.08) inset;
    }
    input::placeholder { color: rgba(200,220,255,0.38); }
    input:focus {
      background: var(--input-focus);
      border-color: rgba(255,255,255,0.42);
      box-shadow:
        0 1px 0 rgba(255,255,255,0.08) inset,
        0 0 0 3px rgba(255,255,255,0.07);
    }
    input.invalid {
      border-color: rgba(232,0,28,0.6);
    }

    .eye-btn {
      position: absolute;
      right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      color: rgba(200,220,255,0.4);
      display: flex; align-items: center;
      transition: color 0.2s;
      padding: 2px;
    }
    .eye-btn:hover { color: rgba(220,235,255,0.85); }

    .error-hint {
      color: #ff8b97;
      font-size: 0.74rem;
      margin-top: 6px;
      letter-spacing: 0.01em;
    }

    .meta-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 24px;
      margin-top: 4px;
      animation: fadeUp 0.5s 0.32s both;
    }

    .remember {
      display: flex; align-items: center; gap: 8px;
      cursor: pointer;
      font-size: 0.84rem;
      color: var(--text-muted);
      user-select: none;
      text-transform: none;
      letter-spacing: 0;
      font-weight: 400;
      margin-bottom: 0;
    }
    .remember input[type="checkbox"] {
      position: absolute;
      opacity: 0;
      pointer-events: none;
      width: 0; height: 0;
    }
    .check-box {
      width: 16px; height: 16px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.28);
      background: rgba(255,255,255,0.10);
      display: flex; align-items: center; justify-content: center;
      transition: border-color 0.2s, background 0.2s;
      flex-shrink: 0;
    }
    .remember input:checked + .check-box {
      background: var(--red);
      border-color: var(--red);
    }
    .check-box svg { display: none; }
    .remember input:checked + .check-box svg { display: block; }

    .forgot {
      font-size: 0.84rem;
      color: rgba(210,228,255,0.62);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s;
    }
    .forgot:hover { color: #ffffff; }

    .login-btn {
      width: 100%;
      padding: 13px;
      border-radius: var(--radius);
      border: none;
      background: var(--red);
      color: #fff;
      font-family: inherit;
      font-size: 0.86rem;
      font-weight: 600;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s, opacity 0.2s;
      box-shadow: 0 4px 20px var(--red-glow);
      animation: fadeUp 0.5s 0.36s both;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .login-btn:hover:not(:disabled) {
      background: var(--red-deep);
      transform: translateY(-1px);
      box-shadow: 0 8px 28px var(--red-glow);
    }
    .login-btn:active:not(:disabled) { transform: translateY(0); }
    .login-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-shimmer {
      position: absolute; inset: 0;
      background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.18) 50%, transparent 62%);
      transform: translateX(-100%);
      transition: transform 0.5s;
      pointer-events: none;
    }
    .login-btn:hover:not(:disabled) .btn-shimmer { transform: translateX(100%); }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .divider {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 20px;
      animation: fadeUp 0.5s 0.38s both;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.12);
    }
    .divider span {
      font-size: 0.75rem;
      color: rgba(200,220,255,0.42);
      font-weight: 500;
      letter-spacing: 0.04em;
    }

    .register {
      text-align: center;
      font-size: 0.855rem;
      color: var(--text-muted);
      margin: 0;
      animation: fadeUp 0.5s 0.40s both;
    }
    .register a {
      color: rgba(200,220,255,0.9);
      font-weight: 600;
      text-decoration: none;
      transition: color 0.2s;
    }
    .register a:hover { color: #fff; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 480px) {
      .card { padding: 34px 24px 32px; border-radius: 16px; }
    }
  `]
})
export class CustomerLoginComponent {
  private authService = inject(CustomerAuthService);
  private router = inject(Router);

  email = '';
  password = '';
  rememberMe = false;
  showPassword = false;

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

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
        this.errorMessage.set(err.error?.message || 'Login failed. Please try again.');
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
}
