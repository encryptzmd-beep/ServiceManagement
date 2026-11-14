import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { ConsultClient, ConsultancyService } from '../../Services/consultancy-service';
import { CONSULTANCY_MENU } from '../personal-shell-component/consultancy-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';
import { ScrollIntoViewOn } from '../shared/scroll-into-view';
import { EscapeClose } from '../shared/escape-close';

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"'.]{2,}$/;
const PHONE = /^[0-9 +()\-]{6,30}$/;

/**
 * Job Consultancy, Clients: the companies the consultancy recruits for. A job can be
 * linked to a client on the Job postings page; people never see the client.
 */
@Component({
  selector: 'app-consultancy-clients-component',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PersonalShellComponent, ScrollIntoViewOn, EscapeClose],
  templateUrl: './consultancy-clients-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-board-component/job-board-component.scss',
    './consultancy-clients-component.scss',
  ],
})
export class ConsultancyClientsComponent implements OnInit {
  private api = inject(ConsultancyService);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly menu = CONSULTANCY_MENU;

  loading = signal(true);
  unavailable = signal('');
  clients = signal<ConsultClient[]>([]);
  search = signal('');
  showInactive = signal(false);

  readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.clients().filter(c =>
      (this.showInactive() || c.isActive)
      && (!q || [c.name, c.contactPerson, c.city, c.industry].some(v => (v || '').toLowerCase().includes(q))));
  });

  form = signal<ConsultClient | null>(null);
  formError = signal('');
  saving = signal(false);
  toast = signal<{ text: string; ok: boolean } | null>(null);

  ngOnInit(): void {
    if (!this.auth.scopeState().companyId) { this.router.navigate(['/select-company']); return; }
    this.load();
  }

  load(): void {
    this.api.getClients().subscribe({
      next: res => {
        this.loading.set(false);
        if (res.success) { this.unavailable.set(''); this.clients.set(res.data ?? []); }
        else this.unavailable.set(res.message || 'This application is not available right now');
      },
      error: err => {
        this.loading.set(false);
        this.unavailable.set(err?.status === 403 ? (err.error?.message || "You don't have access to Job Consultancy. Ask your administrator") : 'The clients could not be loaded. Please try again.');
      },
    });
  }

  openNew(): void {
    this.openForm({ clientId: 0, name: '', contactPerson: '', phone: '', email: '', city: '', industry: '', notes: '', isActive: true });
  }

  openEdit(c: ConsultClient): void {
    this.openForm({ ...c });
  }

  private openForm(c: ConsultClient): void {
    this.formError.set('');
    this.saving.set(false);
    this.form.set(c);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.form.set(null);
  }

  save(): void {
    const f = this.form();
    if (!f || this.saving()) return;

    const t = (v: unknown) => String(v ?? '').trim();
    if (!t(f.name)) { this.formError.set('Enter the name of the client'); return; }
    if (t(f.email) && !EMAIL.test(t(f.email))) { this.formError.set('Enter a valid e-mail address'); return; }
    if (t(f.phone) && !PHONE.test(t(f.phone))) { this.formError.set('Enter a valid phone number'); return; }

    this.formError.set('');
    this.saving.set(true);
    this.api.saveClient({
      ...f, name: t(f.name), contactPerson: t(f.contactPerson), phone: t(f.phone), email: t(f.email),
      city: t(f.city), industry: t(f.industry), notes: t(f.notes),
    }).subscribe({
      next: res => {
        this.saving.set(false);
        if (!res.success) { this.formError.set(res.message || 'Could not save. Please try again'); return; }
        this.form.set(null);
        this.notify(res.message, true);
        this.load();
      },
      error: () => { this.saving.set(false); this.formError.set('Could not save. Please try again'); this.load(); },
    });
  }

  remove(c: ConsultClient): void {
    if (!window.confirm(`Remove the client "${c.name}"? Its jobs stay, without the client.`)) return;
    this.api.deleteClient(c.clientId).subscribe({
      next: res => { this.notify(res.message, res.success); if (res.success) this.load(); },
      error: () => this.notify('Could not remove it. Please try again', false),
    });
  }

  initial(name: string): string {
    const first = Array.from((name ?? '').trim())[0];
    return first ? first.toUpperCase() : '?';
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Done' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
