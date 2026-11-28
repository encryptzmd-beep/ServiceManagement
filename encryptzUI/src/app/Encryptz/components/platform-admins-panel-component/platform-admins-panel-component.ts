import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { PlatformAdmin, PlatformAdminCandidate, PlatformService } from '../../Services/platform-service';
import { DialogService } from '../../Services/dialog-service';
import { AuthService } from '../../Auth/auth-service';
import { ToastService } from '../../Services/toast-service';

/**
 * Platform Admin, Platform Admins: the users whose global role is Admin, so they manage
 * every company. A platform administrator makes an existing user one (searched by name,
 * email or mobile) or takes it away; the user's previous global role comes back. The own
 * account and the last active administrator cannot be removed (the API refuses it too).
 * A change takes effect at the user's next sign-in.
 */
@Component({
  selector: 'app-platform-admins-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './platform-admins-panel-component.html',
  styleUrl: './platform-admins-panel-component.scss',
})
export class PlatformAdminsPanelComponent implements OnInit {
  private api = inject(PlatformService);
  private dialog = inject(DialogService);
  private auth = inject(AuthService);
  private toasts = inject(ToastService);

  admins = signal<PlatformAdmin[]>([]);
  loading = signal(true);
  error = signal('');

  search = '';
  candidates = signal<PlatformAdminCandidate[]>([]);
  searching = signal(false);
  searched = signal(false);
  searchError = signal('');

  /** The user being added or removed. */
  busy = signal<number | null>(null);

  readonly myUserId = computed(() => Number(this.auth.currentUser()?.userId ?? 0));
  readonly activeCount = computed(() => this.admins().filter(a => a.isActive).length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getAdmins().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: res => res.success ? this.admins.set(res.data ?? []) : this.error.set(res.message || 'Could not load the administrators'),
      error: err => this.error.set(this.message(err, 'Could not load the administrators')),
    });
  }

  find(): void {
    const text = this.search.trim();
    this.searchError.set('');
    if (text.length < 3) { this.searchError.set('Type at least 3 letters of the name, email or mobile'); return; }

    this.searching.set(true);
    this.api.findAdminCandidates(text).pipe(finalize(() => this.searching.set(false))).subscribe({
      next: res => {
        this.searched.set(true);
        if (res.success) this.candidates.set(res.data ?? []);
        else this.searchError.set(res.message || 'Search failed');
      },
      error: err => this.searchError.set(this.message(err, 'Search failed')),
    });
  }

  async add(user: PlatformAdminCandidate): Promise<void> {
    if (this.busy() !== null) return;
    const ok = await this.dialog.confirm({
      message: `Make ${user.fullName || user.email} a platform administrator? They will manage every company.`,
      okText: 'Make admin',
    });
    if (!ok) return;

    this.busy.set(user.userId);
    this.api.addAdmin(user.userId).pipe(finalize(() => this.busy.set(null))).subscribe({
      next: res => {
        this.notify(res.message, res.success);
        if (!res.success) return;
        this.candidates.update(list => list.filter(c => c.userId !== user.userId));
        this.load();
      },
      error: err => this.notify(this.message(err, 'Could not add the administrator'), false),
    });
  }

  canRemove(admin: PlatformAdmin): boolean {
    if (admin.userId === this.myUserId()) return false;
    return !(admin.isActive && this.activeCount() <= 1);
  }

  async remove(admin: PlatformAdmin): Promise<void> {
    if (this.busy() !== null || !this.canRemove(admin)) return;
    const ok = await this.dialog.confirm({
      message: `Remove platform administrator access of ${admin.fullName || admin.email}?`,
      kind: 'danger',
      okText: 'Remove',
    });
    if (!ok) return;

    this.busy.set(admin.userId);
    this.api.removeAdmin(admin.userId).pipe(finalize(() => this.busy.set(null))).subscribe({
      next: res => {
        this.notify(res.message, res.success);
        if (res.success) this.load();
      },
      error: err => this.notify(this.message(err, 'Could not remove the administrator'), false),
    });
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toasts.flash(text || (ok ? 'Saved' : 'Something went wrong'), ok ? 'success' : 'error');
  }

  private message(err: any, fallback: string): string {
    if (err?.status === 403) return err?.error?.message || 'You are not allowed to do this';
    return err?.error?.message || fallback;
  }
}
