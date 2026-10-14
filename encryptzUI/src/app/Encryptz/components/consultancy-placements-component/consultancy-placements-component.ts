import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { CompanyJobsService, CompanyPosting } from '../../Services/company-jobs-service';
import {
  ConsultClient,
  ConsultancyService,
  FEE_STATUSES,
  FeeStatus,
  Placement,
  PlacementList,
  PlacementSave,
} from '../../Services/consultancy-service';
import { CONSULTANCY_MENU } from '../personal-shell-component/consultancy-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** What is typed in the dialog: numbers as text until they are saved. */
interface PlacementForm extends PlacementSave {
  ctcText: string;
  feeText: string;
}

/**
 * Job Consultancy, Placements: who was placed where, the CTC, the fee and the replacement
 * guarantee. A placement opens filled in when it comes from a candidate of the pool or
 * from an applicant who was hired.
 */
@Component({
  selector: 'app-consultancy-placements-component',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PersonalShellComponent],
  templateUrl: './consultancy-placements-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-board-component/job-board-component.scss',
    './consultancy-placements-component.scss',
  ],
})
export class ConsultancyPlacementsComponent implements OnInit {
  private api = inject(ConsultancyService);
  private jobs = inject(CompanyJobsService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly menu = CONSULTANCY_MENU;
  readonly feeStatuses = FEE_STATUSES;

  loading = signal(true);
  unavailable = signal('');
  data = signal<PlacementList>({ items: [], thisMonth: 0, total: 0, feeOutstanding: 0, feePaidThisYear: 0 });
  clients = signal<ConsultClient[]>([]);
  postings = signal<CompanyPosting[]>([]);
  feeFilter = signal<FeeStatus | ''>('');

  readonly shown = computed(() => this.data().items.filter(p => !this.feeFilter() || p.feeStatus === this.feeFilter()));

  form = signal<PlacementForm | null>(null);
  formError = signal('');
  saving = signal(false);
  toast = signal<{ text: string; ok: boolean } | null>(null);

  ngOnInit(): void {
    if (!this.auth.scopeState().companyId) { this.router.navigate(['/select-company']); return; }
    this.load();
    this.api.getClients().subscribe({ next: res => this.clients.set(res.success ? res.data ?? [] : []), error: () => {} });
    this.jobs.getPostings().subscribe({ next: res => this.postings.set(res.success ? res.data ?? [] : []), error: () => {} });

    // from a candidate of the pool, or from an applicant who was hired
    const q = this.route.snapshot.queryParamMap;
    if (q.get('candidate') || q.get('application')) {
      const posting = Number(q.get('posting')) || null;
      this.openForm({
        ...this.blank(),
        candidateKey: q.get('candidate'),
        applicationId: Number(q.get('application')) || null,
        candidateName: q.get('name') ?? '',
        postingId: posting,
        jobTitle: q.get('title') ?? '',
      });
    }
  }

  load(): void {
    this.api.getPlacements().subscribe({
      next: res => {
        this.loading.set(false);
        if (res.success && res.data) { this.unavailable.set(''); this.data.set(res.data); }
        else this.unavailable.set(res.message || 'This application is not available right now');
      },
      error: err => {
        this.loading.set(false);
        this.unavailable.set(err?.status === 403 ? (err.error?.message || "You don't have access to Job Consultancy. Ask your administrator") : 'The placements could not be loaded. Please try again.');
      },
    });
  }

  private blank(): PlacementForm {
    return {
      placementId: 0, clientId: null, postingId: null, candidateName: '', jobTitle: '', joinDate: this.today(),
      annualCtc: null, feeAmount: null, feeStatus: 'Pending', guaranteeUntil: null, notes: '',
      candidateKey: null, applicationId: null, ctcText: '', feeText: '',
    };
  }

  openNew(): void {
    this.openForm(this.blank());
  }

  openEdit(p: Placement): void {
    this.openForm({
      ...this.blank(), ...p,
      joinDate: (p.joinDate || '').slice(0, 10),
      guaranteeUntil: p.guaranteeUntil ? p.guaranteeUntil.slice(0, 10) : null,
      ctcText: p.annualCtc != null ? String(p.annualCtc) : '',
      feeText: p.feeAmount != null ? String(p.feeAmount) : '',
    });
  }

  private openForm(f: PlacementForm): void {
    this.formError.set('');
    this.saving.set(false);
    this.form.set(f);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.form.set(null);
  }

  /** Choosing the job fills in its title and its client when they are still empty. */
  onPostingChosen(f: PlacementForm): void {
    const job = this.postings().find(p => p.postingId === f.postingId);
    if (!job) return;
    if (!f.jobTitle.trim()) f.jobTitle = job.title;
  }

  save(): void {
    const f = this.form();
    if (!f || this.saving()) return;

    const t = (v: unknown) => String(v ?? '').trim();
    const amount = (text: string): number | null | undefined => (!t(text) ? null : /^\d{1,10}$/.test(t(text)) && Number(t(text)) <= 1_000_000_000 ? Number(t(text)) : undefined);

    const named = !!f.candidateKey || !!f.applicationId || !!t(f.candidateName);
    if (!named || !t(f.jobTitle) || !t(f.joinDate)) { this.formError.set('Enter the candidate, the job and the joining date'); return; }

    const ctc = amount(f.ctcText);
    if (ctc === undefined || ctc === 0) { this.formError.set('Enter the CTC per year as an amount, or leave it empty'); return; }
    const fee = amount(f.feeText);
    if (fee === undefined) { this.formError.set('Enter the fee as an amount, or leave it empty'); return; }
    if (f.guaranteeUntil && t(f.guaranteeUntil) < t(f.joinDate)) { this.formError.set('The replacement guarantee cannot end before the joining date'); return; }

    this.formError.set('');
    this.saving.set(true);
    const { ctcText, feeText, ...rest } = f;
    this.api.savePlacement({
      ...rest,
      candidateName: t(f.candidateName), jobTitle: t(f.jobTitle), notes: t(f.notes),
      annualCtc: ctc, feeAmount: fee, guaranteeUntil: t(f.guaranteeUntil) || null,
      clientId: f.clientId || null, postingId: f.postingId || null,
    }).subscribe({
      next: res => {
        this.saving.set(false);
        if (!res.success) { this.formError.set(res.message || 'Could not save. Please try again'); return; }
        this.form.set(null);
        this.notify(res.message, true);
        // a placement that came from another page is done: the address forgets it
        if (this.route.snapshot.queryParamMap.keys.length) this.router.navigate([], { relativeTo: this.route, queryParams: {} });
        this.load();
      },
      error: () => { this.saving.set(false); this.formError.set('Could not save. Please try again'); this.load(); },
    });
  }

  setFee(p: Placement, status: FeeStatus): void {
    if (p.feeStatus === status) return;
    this.api.savePlacement({ ...p, feeStatus: status }).subscribe({
      next: res => { this.notify(res.success ? `Fee marked ${status.toLowerCase()}` : res.message, res.success); if (res.success) this.load(); },
      error: () => this.notify('Could not change it. Please try again', false),
    });
  }

  remove(p: Placement): void {
    if (!window.confirm(`Remove the placement of ${p.candidateName}?`)) return;
    this.api.deletePlacement(p.placementId).subscribe({
      next: res => { this.notify(res.message, res.success); if (res.success) this.load(); },
      error: () => this.notify('Could not remove it. Please try again', false),
    });
  }

  // ── what the template shows ───────────────────────────────────────────────

  money(n: number | null | undefined): string {
    return n == null ? '' : `₹${Number(n).toLocaleString('en-IN')}`;
  }

  dayLabel(value: string | null | undefined): string {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value ?? '')) return '';
    const [y, m, d] = (value as string).slice(0, 10).split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }

  /** The guarantee runs until that day: still running, or over. */
  guaranteeRunning(p: Placement): boolean {
    return !!p.guaranteeUntil && p.guaranteeUntil.slice(0, 10) >= this.today();
  }

  feeClass(status: string): string {
    return `jb-status ${status === 'Paid' ? 'hired' : status === 'Invoiced' ? 'applied' : 'shortlisted'}`;
  }

  private today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Done' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
