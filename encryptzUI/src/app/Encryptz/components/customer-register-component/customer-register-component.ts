import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerAuthService } from '../../Services/customer-auth-service';


@Component({
  selector: 'app-customer-register',
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

        <h1 class="heading">Create account</h1>
        <p class="subheading">Register as a customer to get started</p>

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
            <span class="btn-shimmer"></span>
            @if (isLoading()) {
              <span class="spinner"></span>
              <span>Creating account…</span>
            } @else {
              <span>Create Account</span>
            }
          </button>
        </form>

        <div class="divider"><span>or</span></div>

        <p class="login-link">Already have an account? <a routerLink="/customer/login">Login here</a></p>

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
              <span class="btn-shimmer"></span>
              Continue
            </button>
          </div>
        </div>
      </div>
    }
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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      max-width: 560px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 40px 40px 36px;
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
      margin-bottom: 28px;
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
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: #fff;
      line-height: 1;
    }

    .heading {
      font-weight: 300;
      font-size: 1.55rem;
      letter-spacing: -0.025em;
      color: #ffffff;
      margin: 0 0 6px;
      animation: fadeUp 0.5s 0.13s both;
    }

    .subheading {
      font-size: 0.855rem;
      color: var(--text-muted);
      font-weight: 400;
      margin: 0 0 22px;
      animation: fadeUp 0.5s 0.17s both;
    }

    .alert {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      margin-bottom: 16px;
      border-radius: var(--radius);
      font-size: 0.82rem;
      animation: shake 0.4s ease;
    }
    .alert span { flex: 1; }
    .alert-error {
      background: rgba(232,0,28,0.16);
      border: 1px solid rgba(232,0,28,0.45);
      color: #ffd7dd;
    }
    .alert-success {
      background: rgba(22,163,74,0.16);
      border: 1px solid rgba(22,163,74,0.45);
      color: #c7f5d7;
    }
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

    .row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .field {
      margin-bottom: 14px;
      animation: fadeUp 0.5s both;
    }

    label {
      display: block;
      font-size: 0.72rem;
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
    input[type="text"],
    input[type="tel"] {
      width: 100%;
      padding: 12px 42px;
      background: var(--input-bg);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: var(--radius);
      color: #ffffff;
      font-family: inherit;
      font-size: 0.88rem;
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
      font-size: 0.72rem;
      margin-top: 6px;
    }

    .register-btn {
      width: 100%;
      padding: 13px;
      border-radius: var(--radius);
      border: none;
      background: var(--red);
      color: #fff;
      font-family: inherit;
      font-size: 0.84rem;
      font-weight: 600;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s, opacity 0.2s;
      box-shadow: 0 4px 20px var(--red-glow);
      margin: 8px 0 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      animation: fadeUp 0.5s 0.36s both;
    }
    .register-btn:hover:not(:disabled) {
      background: var(--red-deep);
      transform: translateY(-1px);
      box-shadow: 0 8px 28px var(--red-glow);
    }
    .register-btn:active:not(:disabled) { transform: translateY(0); }
    .register-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    .btn-shimmer {
      position: absolute; inset: 0;
      background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.18) 50%, transparent 62%);
      transform: translateX(-100%);
      transition: transform 0.5s;
      pointer-events: none;
    }
    .register-btn:hover:not(:disabled) .btn-shimmer,
    .btn-continue:hover:not(:disabled) .btn-shimmer { transform: translateX(100%); }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .divider {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 18px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.12);
    }
    .divider span {
      font-size: 0.74rem;
      color: rgba(200,220,255,0.42);
      font-weight: 500;
      letter-spacing: 0.04em;
    }

    .login-link {
      text-align: center;
      font-size: 0.855rem;
      color: var(--text-muted);
      margin: 0;
    }
    .login-link a {
      color: rgba(200,220,255,0.9);
      font-weight: 600;
      text-decoration: none;
      transition: color 0.2s;
    }
    .login-link a:hover { color: #fff; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ——— Company popup ——— */
    .popup-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(5, 10, 24, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 20px;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .popup-card {
      width: 100%;
      max-width: 460px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 18px;
      padding: 26px 24px;
      backdrop-filter: blur(40px) saturate(1.5);
      -webkit-backdrop-filter: blur(40px) saturate(1.5);
      box-shadow:
        0 0 0 0.5px rgba(255,255,255,0.12) inset,
        0 24px 64px rgba(0,0,0,0.6);
      color: #fff;
      animation: cardIn 0.3s ease;
    }

    .popup-header h3 {
      margin: 0 0 6px;
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .popup-header p {
      margin: 0 0 16px;
      color: var(--text-muted);
      font-size: 0.84rem;
    }

    .company-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 50vh;
      overflow-y: auto;
      padding-right: 2px;
    }

    .company-item {
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.06);
      border-radius: 12px;
      padding: 12px 14px;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }
    .company-item:hover {
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.3);
    }
    .company-item.selected {
      background: rgba(232,0,28,0.14);
      border-color: rgba(232,0,28,0.5);
    }

    .radio-dot {
      width: 16px; height: 16px;
      border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,0.35);
      background: transparent;
      position: relative;
      flex-shrink: 0;
      transition: border-color 0.2s, background 0.2s;
    }
    .radio-dot.on { border-color: var(--red); }
    .radio-dot.on::after {
      content: '';
      position: absolute;
      inset: 3px;
      border-radius: 50%;
      background: var(--red);
    }

    .company-details { flex: 1; min-width: 0; }
    .company-name {
      font-size: 0.95rem;
      font-weight: 600;
      color: #fff;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .company-role {
      margin-top: 2px;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .popup-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
    }

    .btn-cancel,
    .btn-continue {
      min-width: 110px;
      height: 42px;
      border: none;
      border-radius: var(--radius);
      padding: 0 18px;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.15s;
      font-family: inherit;
      position: relative;
      overflow: hidden;
    }

    .btn-cancel {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.2);
      color: rgba(230,240,255,0.9);
    }
    .btn-cancel:hover {
      background: rgba(255,255,255,0.14);
      border-color: rgba(255,255,255,0.32);
    }

    .btn-continue {
      background: var(--red);
      color: #fff;
      box-shadow: 0 4px 16px var(--red-glow);
    }
    .btn-continue:hover:not(:disabled) {
      background: var(--red-deep);
      transform: translateY(-1px);
      box-shadow: 0 6px 22px var(--red-glow);
    }
    .btn-continue:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ——— Responsive ——— */
    @media (max-width: 560px) {
      .card {
        padding: 30px 22px 28px;
        border-radius: 16px;
      }

      .row-2 {
        grid-template-columns: 1fr;
        gap: 0;
      }

      .heading { font-size: 1.4rem; }

      .popup-card { padding: 22px 18px; border-radius: 14px; }
      .popup-actions { flex-direction: column-reverse; }
      .btn-cancel, .btn-continue { width: 100%; }
    }
  `]
})
export class CustomerRegisterComponent {
  private authService = inject(CustomerAuthService);
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

  ngOnInit() { this.resetForm(); }

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
      CompanyId: this.selectedCompanyId ?? null
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
      .getExistingUserCompanies(data)
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
