import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import {
  CANDIDATE_SOURCES,
  ConsultancyService,
  OwnCandidate,
  OwnCandidateDuplicate,
  TALENT_STAGES,
  TalentStage,
} from '../../Services/consultancy-service';
import { CONSULTANCY_MENU } from '../personal-shell-component/consultancy-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';
import { ScrollIntoViewOn } from '../shared/scroll-into-view';
import { EscapeClose } from '../shared/escape-close';

const REFUSED = "You don't have access to Job Consultancy. Ask your administrator";

/** The form of a candidate: what is typed (experience as text, so that an empty box is "not known"). */
interface CandidateForm extends Omit<OwnCandidate, 'experienceYears'> {
  experience: string;
}

/**
 * Job Consultancy, the candidates the company adds itself (/consultancy/our-candidates): people
 * met outside Job Portal (walk-ins, referrals, CVs by e-mail). They are kept in the company's
 * own database; nobody else sees them and they are never public. No two share an e-mail or a
 * phone: the form says so as soon as one is typed, the server refuses it on saving.
 */
@Component({
  selector: 'app-own-candidates',
  standalone: true,
  imports: [FormsModule, RouterModule, PersonalShellComponent, ScrollIntoViewOn, EscapeClose],
  templateUrl: './own-candidates-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-board-component/job-board-component.scss',
    './own-candidates-component.scss',
  ],
})
export class OwnCandidatesComponent implements OnInit {
  private api = inject(ConsultancyService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly menu = CONSULTANCY_MENU;
  readonly stages = TALENT_STAGES;
  readonly sources = CANDIDATE_SOURCES;

  loading = signal(true);
  unavailable = signal('');
  items = signal<OwnCandidate[]>([]);
  total = signal(0);
  pageSize = signal(20);
  page = 1;
  query = '';

  form = signal<CandidateForm | null>(null);
  saving = signal(false);
  formError = signal('');
  /** Candidates of the company with the e-mail or phone being typed. */
  duplicates = signal<OwnCandidateDuplicate[]>([]);
  /** A resume chosen in the form: sent once the candidate is saved. */
  resumeFile: File | null = null;

  toast = signal<{ text: string; ok: boolean } | null>(null);

  ngOnInit(): void {
    if (!this.auth.scopeState().companyId) { this.router.navigate(['/select-company']); return; }
    const params = this.route.snapshot.queryParamMap;
    this.query = (params.get('q') ?? '').slice(0, 100);
    this.load();
    // "Add candidate" on the Candidates page: the form opens at once
    if (params.get('add') === '1') this.openNew();
    // a candidate of the company opened from the candidate search
    const edit = Number(params.get('edit'));
    if (Number.isInteger(edit) && edit > 0) {
      this.api.getOwnCandidate(edit).subscribe({
        next: res => (res.success && res.data ? this.openEdit(res.data) : this.notify(res.message === 'Not found' ? 'This candidate is no longer there' : res.message, false)),
        error: () => this.notify('The candidate could not be opened', false),
      });
    }
  }

  load(): void {
    this.api.getOwnCandidates(this.query, this.page).subscribe({
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
        this.unavailable.set(err?.status === 403 ? (err.error?.message || REFUSED) : 'The candidates could not be loaded. Please try again.');
      },
    });
  }

  search(): void {
    this.page = 1;
    this.load();
  }

  get lastPage(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize()));
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage || page === this.page) return;
    this.page = page;
    this.load();
  }

  // ── the form ──────────────────────────────────────────────────────────────

  openNew(): void {
    this.openForm({
      candidateId: 0, fullName: '', headline: '', email: '', phone: '', city: '', experience: '', skills: '',
      preferredJobs: '', source: '', stage: 'New', notes: '',
    });
  }

  openEdit(c: OwnCandidate): void {
    this.openForm({ ...c, experience: c.experienceYears == null ? '' : String(c.experienceYears) });
  }

  private openForm(f: CandidateForm): void {
    this.formError.set('');
    this.duplicates.set([]);
    this.resumeFile = null;
    this.form.set(f);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.form.set(null);
  }

  /** As soon as an e-mail or phone is typed: is it one of the company's candidates already? */
  checkDuplicates(): void {
    const f = this.form();
    if (!f || (!f.email.trim() && !f.phone.trim())) { this.duplicates.set([]); return; }
    this.api.findOwnDuplicates(f.candidateId, f.email, f.phone).subscribe({
      next: res => this.duplicates.set(res.success ? res.data ?? [] : []),
      error: () => this.duplicates.set([]),
    });
  }

  /** The duplicate in the list: the form closes and the list shows that candidate. */
  showDuplicate(d: OwnCandidateDuplicate): void {
    this.form.set(null);
    this.query = d.phone || d.email || d.fullName;
    this.search();
  }

  onResumePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.resumeFile = input.files?.[0] ?? null;
  }

  save(): void {
    const f = this.form();
    if (!f || this.saving()) return;

    const problem = this.formProblem(f);
    if (problem) { this.formError.set(problem); return; }
    if (this.duplicates().length) { this.formError.set(this.duplicateText(this.duplicates()[0])); return; }

    const experience = f.experience.trim() === '' ? null : Number(f.experience);
    const { experience: _typed, ...rest } = f;
    this.saving.set(true);
    this.formError.set('');
    this.api.saveOwnCandidate({ ...rest, experienceYears: experience }).subscribe({
      next: res => {
        if (!res.success || !res.data) { this.saving.set(false); this.formError.set(res.message || 'Could not save'); return; }
        const id = res.data;
        if (this.resumeFile) {
          this.api.saveOwnCandidateResume(id, this.resumeFile).subscribe({
            next: r => this.saved(r.success ? res.message : `Candidate saved. The resume was not: ${r.message}`, r.success),
            error: () => this.saved('Candidate saved. The resume could not be sent', false),
          });
        } else this.saved(res.message, true);
      },
      error: () => { this.saving.set(false); this.formError.set('Could not save. Please try again'); this.load(); },
    });
  }

  private saved(message: string | undefined, ok: boolean): void {
    this.saving.set(false);
    this.form.set(null);
    this.notify(message, ok);
    this.load();
  }

  /** What the server would refuse, said before it is sent. */
  formProblem(f: CandidateForm): string | null {
    if (!f.fullName.trim()) return 'Enter the name of the candidate';
    if (!f.email.trim() && !f.phone.trim()) return 'Enter an e-mail or a phone number';
    if (f.email.trim() && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"'.]{2,}$/.test(f.email.trim())) return 'Enter a valid e-mail address';
    if (f.phone.trim() && (!/^[0-9 +()-]{6,30}$/.test(f.phone.trim()) || f.phone.replace(/\D/g, '').length < 6)) return 'Enter a valid phone number';
    if (f.experience.trim() !== '') {
      const years = Number(f.experience);
      if (!Number.isFinite(years) || years < 0 || years > 60) return 'Experience is from 0 to 60 years';
    }
    return null;
  }

  duplicateText(d: OwnCandidateDuplicate): string {
    return `You already have this candidate: ${d.fullName} has the same ${d.sameAs === 'Email' ? 'e-mail' : 'phone number'}`;
  }

  // ── the list ──────────────────────────────────────────────────────────────

  remove(c: OwnCandidate): void {
    if (!window.confirm(`Remove ${c.fullName} from your candidates? Their resume is removed too.`)) return;
    this.api.deleteOwnCandidate(c.candidateId).subscribe({
      next: res => { this.notify(res.message, res.success); if (res.success) this.load(); },
      error: () => this.notify('Could not remove. Please try again', false),
    });
  }

  downloadResume(c: OwnCandidate): void {
    this.api.downloadOwnCandidateResume(c.candidateId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = c.resumeName || 'resume';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.notify('The resume could not be opened', false),
    });
  }

  stageLabel(stage: string): string {
    return stage === 'NotSuitable' ? 'Not suitable' : stage;
  }

  stageClass(stage: string): string {
    const map: Record<string, string> = { New: 'applied', Contacted: 'applied', Interview: 'shortlisted', Placed: 'hired', NotSuitable: 'rejected' };
    return `jb-status ${map[stage] ?? ''}`;
  }

  skillList(text: string): string[] {
    return (text || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
  }

  initials(name: string): string {
    return (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => Array.from(w)[0].toUpperCase()).join('');
  }

  experienceLabel(years: number | null): string {
    if (years == null) return 'Experience not added';
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Done' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
