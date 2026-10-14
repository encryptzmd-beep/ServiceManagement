import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { CompanyJobsService, CompanyPosting } from '../../Services/company-jobs-service';
import {
  Candidate,
  CandidatePage,
  CandidateSearch,
  ConsultancyService,
  TALENT_STAGES,
  TalentStage,
} from '../../Services/consultancy-service';
import { JOB_WORK_MODES, JobEducation } from '../../Services/jobs-service';
import { CONSULTANCY_MENU } from '../personal-shell-component/consultancy-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Job Consultancy, Candidates: people who chose "Employers can find me" on Job Portal.
 * The consultancy searches them, keeps the ones it works with in its pool (stage and
 * note), opens a profile (the person sees which company looked) and invites a candidate
 * to apply for one of its open jobs.
 */
@Component({
  selector: 'app-consultancy-candidates-component',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PersonalShellComponent],
  templateUrl: './consultancy-candidates-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-board-component/job-board-component.scss',
    './consultancy-candidates-component.scss',
  ],
})
export class ConsultancyCandidatesComponent implements OnInit {
  private api = inject(ConsultancyService);
  private jobs = inject(CompanyJobsService);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly menu = CONSULTANCY_MENU;
  readonly stages = TALENT_STAGES;
  readonly workModes = JOB_WORK_MODES;
  readonly yearOptions = [1, 2, 3, 5, 8, 10];

  loading = signal(true);
  unavailable = signal('');
  items = signal<Candidate[]>([]);
  total = signal(0);
  pageSize = signal(20);

  filter: CandidateSearch = { q: '', city: '', years: null, mode: '', pool: false, page: 1 };

  /** The candidate who is open, and what is typed for the pool. */
  open = signal<CandidatePage | null>(null);
  poolStage: TalentStage = 'New';
  poolNote = '';
  poolBusy = signal(false);

  /** The open jobs of the company, for an invitation. */
  openJobs = signal<CompanyPosting[]>([]);
  invitePostingId: number | null = null;
  inviteMessage = '';
  inviting = signal(false);

  panelError = signal('');
  toast = signal<{ text: string; ok: boolean } | null>(null);

  ngOnInit(): void {
    if (!this.auth.scopeState().companyId) { this.router.navigate(['/select-company']); return; }
    this.load();
    this.jobs.getPostings().subscribe({
      next: res => this.openJobs.set(res.success ? (res.data ?? []).filter(p => p.status === 'Open') : []),
      error: () => this.openJobs.set([]),
    });
  }

  load(): void {
    this.api.searchCandidates(this.filter).subscribe({
      next: res => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.unavailable.set('');
          this.items.set(res.data.items ?? []);
          this.total.set(res.data.total);
          this.pageSize.set(res.data.pageSize || 20);
        } else this.unavailable.set(res.message || 'This application is not available right now');
      },
      error: err => {
        this.loading.set(false);
        this.unavailable.set(err?.status === 403 ? (err.error?.message || "You don't have access to Job Consultancy. Ask your administrator") : 'The candidates could not be loaded. Please try again.');
      },
    });
  }

  search(): void {
    this.filter.page = 1;
    this.load();
  }

  setPool(pool: boolean): void {
    if (this.filter.pool === pool) return;
    this.filter.pool = pool;
    this.search();
  }

  get lastPage(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize()));
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage || page === this.filter.page) return;
    this.filter.page = page;
    this.load();
  }

  // ── one candidate ─────────────────────────────────────────────────────────

  openCandidate(c: Candidate): void {
    this.api.getCandidate(c.candidateKey).subscribe({
      next: res => {
        if (!res.success || !res.data) {
          this.notify(res.message === 'Not found' ? 'This candidate can no longer be found' : res.message, false);
          if (res.message === 'Not found') this.load();
          return;
        }
        this.panelError.set('');
        this.poolStage = (res.data.stage || 'New') as TalentStage;
        this.poolNote = res.data.note || '';
        this.invitePostingId = this.openJobs()[0]?.postingId ?? null;
        this.inviteMessage = '';
        this.open.set(res.data);
      },
      error: () => this.notify('The candidate could not be opened. Please try again', false),
    });
  }

  close(): void {
    if (this.poolBusy() || this.inviting()) return;
    this.open.set(null);
  }

  saveToPool(): void {
    const c = this.open();
    if (!c || this.poolBusy()) return;
    if (this.poolNote.trim().length > 1000) { this.panelError.set('The note can have at most 1000 characters'); return; }

    this.poolBusy.set(true);
    this.panelError.set('');
    this.api.saveTalent(c.candidateKey, this.poolStage, this.poolNote.trim()).subscribe({
      next: res => {
        this.poolBusy.set(false);
        if (!res.success) { this.panelError.set(res.message || 'Could not save'); return; }
        this.open.update(p => (p ? { ...p, inPool: true, stage: this.poolStage, note: this.poolNote.trim() } : p));
        this.items.update(list => list.map(x => (x.candidateKey === c.candidateKey ? { ...x, inPool: true, stage: this.poolStage } : x)));
        this.notify(res.message, true);
      },
      error: () => { this.poolBusy.set(false); this.panelError.set('Could not save. Please try again'); },
    });
  }

  removeFromPool(): void {
    const c = this.open();
    if (!c || this.poolBusy()) return;
    if (!window.confirm('Remove this candidate from your pool? Your note goes too.')) return;

    this.poolBusy.set(true);
    this.api.removeTalent(c.candidateKey).subscribe({
      next: res => {
        this.poolBusy.set(false);
        if (!res.success) { this.panelError.set(res.message || 'Could not remove'); return; }
        this.open.update(p => (p ? { ...p, inPool: false, stage: '', note: '' } : p));
        this.poolNote = '';
        this.items.update(list => (this.filter.pool
          ? list.filter(x => x.candidateKey !== c.candidateKey)
          : list.map(x => (x.candidateKey === c.candidateKey ? { ...x, inPool: false, stage: '' } : x))));
        this.notify(res.message, true);
      },
      error: () => { this.poolBusy.set(false); this.panelError.set('Could not remove. Please try again'); },
    });
  }

  invite(): void {
    const c = this.open();
    if (!c || this.inviting()) return;
    if (!this.invitePostingId) { this.panelError.set('Choose one of your open jobs'); return; }
    if (this.inviteMessage.trim().length > 500) { this.panelError.set('The message can have at most 500 characters'); return; }

    this.inviting.set(true);
    this.panelError.set('');
    this.api.invite(c.candidateKey, this.invitePostingId, this.inviteMessage.trim()).subscribe({
      next: res => {
        this.inviting.set(false);
        if (!res.success) { this.panelError.set(res.message || 'Could not send the invitation'); return; }
        this.inviteMessage = '';
        this.notify(res.message, true);
      },
      error: () => { this.inviting.set(false); this.panelError.set('Could not send the invitation. Please try again'); },
    });
  }

  downloadResume(): void {
    const c = this.open();
    if (!c) return;
    this.api.downloadCandidateResume(c.candidateKey).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = c.profile.resume?.fileName || 'resume';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.notify('The resume could not be downloaded', false),
    });
  }

  /** A placement for this candidate, on the Placements page. */
  recordPlacement(): void {
    const c = this.open();
    if (!c) return;
    this.router.navigate(['/consultancy/placements'], {
      queryParams: { candidate: c.candidateKey, name: c.profile.profile.fullName },
    });
  }

  // ── what the template shows ───────────────────────────────────────────────

  stageLabel(stage: string): string {
    return stage === 'NotSuitable' ? 'Not suitable' : stage;
  }

  stageClass(stage: string): string {
    const map: Record<string, string> = { New: 'applied', Contacted: 'applied', Interview: 'shortlisted', Placed: 'hired', NotSuitable: 'rejected' };
    return `jb-status ${map[stage] ?? ''}`;
  }

  initials(name: string | null | undefined): string {
    return (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => Array.from(w)[0].toUpperCase()).join('');
  }

  list(text: string): string[] {
    return (text || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  monthLabel(value: string | null | undefined): string {
    if (!/^\d{4}-\d{2}/.test(value ?? '')) return '';
    const [year, m] = (value as string).slice(0, 7).split('-').map(Number);
    return `${MONTHS[m - 1]} ${year}`;
  }

  dayLabel(value: string | null | undefined): string {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value ?? '')) return '';
    const [y, m, d] = (value as string).slice(0, 10).split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }

  years(row: JobEducation): string {
    if (row.startYear && row.endYear) return `${row.startYear} – ${row.endYear}`;
    return String(row.endYear || row.startYear || '');
  }

  certificateLabel(status: string): string {
    return status === 'Verified' ? 'Verified' : status === 'Rejected' ? 'Not verified' : 'Not checked';
  }

  safeLink(url: string | null | undefined): string {
    const text = (url ?? '').trim();
    return /^https:\/\/[^\s"<>]+$/i.test(text) ? text : '';
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Done' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
