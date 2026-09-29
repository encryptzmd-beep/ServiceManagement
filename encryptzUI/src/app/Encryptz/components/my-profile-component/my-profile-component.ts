import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, MyProfile } from '../../Auth/auth-service';

/** The logged-in user's own details: view, edit name / mobile, change password. */
@Component({
  selector: 'app-my-profile-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './my-profile-component.html',
  styleUrl: './my-profile-component.scss',
})
export class MyProfileComponent implements OnInit {
  private auth = inject(AuthService);

  profile = signal<MyProfile | null>(null);
  loading = signal(true);
  loadError = signal('');

  // details form
  fullName = '';
  mobileNumber = '';
  saving = signal(false);
  detailsMessage = signal<{ text: string; ok: boolean } | null>(null);

  // password form
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  changingPassword = signal(false);
  passwordMessage = signal<{ text: string; ok: boolean } | null>(null);

  ngOnInit(): void {
    this.auth.getMyProfile().subscribe({
      next: res => {
        this.loading.set(false);
        if (res.success && res.data) this.show(res.data);
        else this.loadError.set(res.message || 'Could not load your profile');
      },
      error: err => {
        this.loading.set(false);
        this.loadError.set(err?.error?.message || 'Could not load your profile');
      },
    });
  }

  private show(profile: MyProfile): void {
    this.profile.set(profile);
    this.fullName = profile.fullName;
    this.mobileNumber = profile.mobileNumber;
  }

  get initials(): string {
    return (this.profile()?.fullName || '')
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  get role(): string {
    const p = this.profile();
    return p?.roleInCompany || p?.globalRole || this.auth.userRole();
  }

  get detailsChanged(): boolean {
    const p = this.profile();
    return !!p && (this.fullName.trim() !== p.fullName || this.mobileNumber.trim() !== p.mobileNumber);
  }

  saveDetails(): void {
    this.detailsMessage.set(null);

    if (!this.fullName.trim()) {
      this.detailsMessage.set({ text: 'Name is required', ok: false });
      return;
    }

    this.saving.set(true);
    this.auth.updateMyProfile({ fullName: this.fullName.trim(), mobileNumber: this.mobileNumber.trim() }).subscribe({
      next: res => {
        this.saving.set(false);
        if (res.success && res.data) this.show(res.data);
        this.detailsMessage.set({ text: res.message || (res.success ? 'Profile updated' : 'Update failed'), ok: res.success });
      },
      error: err => {
        this.saving.set(false);
        this.detailsMessage.set({ text: err?.error?.message || 'Update failed', ok: false });
      },
    });
  }

  resetDetails(): void {
    const p = this.profile();
    if (p) this.show(p);
    this.detailsMessage.set(null);
  }

  changePassword(): void {
    this.passwordMessage.set(null);

    if (!this.oldPassword || !this.newPassword || !this.confirmPassword) {
      this.passwordMessage.set({ text: 'Fill in all three fields', ok: false });
      return;
    }
    if (this.newPassword.length < 6) {
      this.passwordMessage.set({ text: 'The new password must have at least 6 characters', ok: false });
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordMessage.set({ text: 'New password and confirmation do not match', ok: false });
      return;
    }

    this.changingPassword.set(true);
    this.auth.changeMyPassword(this.oldPassword, this.newPassword).subscribe({
      next: res => {
        this.changingPassword.set(false);
        this.passwordMessage.set({ text: res.message || (res.success ? 'Password changed' : 'Could not change the password'), ok: res.success });
        if (res.success) this.oldPassword = this.newPassword = this.confirmPassword = '';
      },
      error: err => {
        this.changingPassword.set(false);
        this.passwordMessage.set({ text: err?.error?.message || 'Could not change the password', ok: false });
      },
    });
  }
}
