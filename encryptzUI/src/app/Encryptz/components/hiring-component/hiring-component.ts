import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import {
  ApplicantStatus,
  CompanyJobsService,
  CompanyPosting,
  CompanyPostingFields,
  JobApplicant,
  JobApplicantPage,
} from '../../Services/company-jobs-service';
import { JOB_EMPLOYMENT_TYPES, JOB_WORK_MODES, JobEducation, JobSkill } from '../../Services/jobs-service';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';
import { CONSULTANCY_MENU } from '../personal-shell-component/consultancy-menu';
import { CandidateMatch, ConsultClient, ConsultancyService, PostingClient } from '../../Services/consultancy-service';
import { MessagesService } from '../../Services/messages-service';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REFUSED = "You don't have access to Job Consultancy. Ask your administrator";

/**
 * Job Consultancy (commercial application), its first page: the jobs the chosen company
 * offers on Job Portal and the people who applied to them. The API takes the company and
 * the person from the login and decides on every call whether the company has the
 * application and this person may use it; this page sends neither.
 */
@Component({
  selector: 'app-hiring-component',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PersonalShellComponent, VerifiedBadgeComponent],
  templateUrl: './hiring-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-board-component/job-board-component.scss',
    './hiring-component.scss',
  ],
})
export class HiringComponent implements OnInit {
  private api = inject(CompanyJobsService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private consultancy = inject(ConsultancyService);
  private messages = inject(MessagesService);

  readonly menu = CONSULTANCY_MENU;

  /** The clients of the consultancy, and which job is for which (known to the company only). */
  clients = signal<ConsultClient[]>([]);
  clientOf = signal<Record<number, PostingClient>>({});

  readonly employmentTypes = JOB_EMPLOYMENT_TYPES;
  readonly workModes = JOB_WORK_MODES;
  readonly applicantStates: ApplicantStatus[] = ['Applied', 'Shortlisted', 'Rejected', 'Hired'];

  loading = signal(true);
  /** Why the page cannot be shown ('' when it can). */
  unavailable = signal('');
  postings = signal<CompanyPosting[]>([]);

  /** The job that is written in the dialog (null = no dialog). */
  form = signal<(CompanyPostingFields & { experienceMin: any; experienceMax: any; salaryLow: any; salaryHigh: any; clientId: number | null }) | null>(null);
  formError = signal('');
  saving = signal(false);

  /** The job whose applicants are shown (null = the list of jobs). */
  selected = signal<CompanyPosting | null>(null);
  applicants = signal<JobApplicant[]>([]);
  applicantsLoading = signal(false);

  /** One job shows its applicants, or the people who fit it. */
  view = signal<'applicants' | 'matches'>('applicants');
  matches = signal<CandidateMatch[]>([]);
  matchesLoading = signal(false);
  /** How many suitable people each open job has (empty until known). */
  matchCount = signal<Record<number, number>>({});
  inviting = signal<string | null>(null);

  /** The applicant who is open with their profile. */
  applicant = signal<JobApplicantPage | null>(null);
  statusBusy = signal(false);

  toast = signal<{ text: string; ok: boolean } | null>(null);

  ngOnInit(): void {
    if (!this.auth.scopeState().companyId) {
      this.router.navigate(['/select-company']);
      return;
    }
    this.load();
    this.loadClients();
    this.loadMatchCounts();
  }

  /** The numbers only add to the page: when they cannot be read, the jobs still show. */
  private loadMatchCounts(): void {
    this.consultancy.getPostingMatchCounts().subscribe({
      next: res => {
        const map: Record<number, number> = {};
        for (const m of res.success ? res.data ?? [] : []) map[m.postingId] = m.suitable;
        this.matchCount.set(map);
      },
      error: () => {},
    });
  }

  /** The clients only add to the page: when they cannot be read, the jobs still show. */
  private loadClients(): void {
    this.consultancy.getClients().subscribe({ next: res => this.clients.set(res.success ? res.data ?? [] : []), error: () => {} });
    this.consultancy.getPostingClients().subscribe({
      next: res => {
        const map: Record<number, PostingClient> = {};
        for (const pc of res.success ? res.data ?? [] : []) map[pc.postingId] = pc;
        this.clientOf.set(map);
      },
      error: () => {},
    });
  }

  // ── jobs ──────────────────────────────────────────────────────────────────

  load(): void {
    this.api.getPostings().subscribe({
      next: res => {
        this.loading.set(false);
        if (res.success) { this.unavailable.set(''); this.postings.set(res.data ?? []); }
        else { this.postings.set([]); this.unavailable.set(res.message || 'This application is not available right now'); }
      },
      error: err => {
        this.loading.set(false);
        this.postings.set([]);
        this.unavailable.set(err?.status === 403 ? (err.error?.message || REFUSED) : 'The jobs could not be loaded. Please try again.');
      },
    });
  }

  openNew(): void {
    this.openForm({
      postingId: 0, title: '', city: '', employmentType: 'Full-time', workMode: 'On-site',
      experienceMinYears: null, experienceMaxYears: null, salaryMin: null, salaryMax: null, skills: '', description: '', closesOn: null,
    });
  }

  /** The list carries no description: the job is read again before it is edited. */
  openEdit(posting: CompanyPosting): void {
    this.api.getPosting(posting.postingId).subscribe({
      next: res => (res.success && res.data ? this.openForm(res.data) : this.notify(res.message, false)),
      error: () => this.notify('The job could not be opened. Please try again', false),
    });
  }

  private openForm(p: CompanyPostingFields): void {
    this.formError.set('');
    this.saving.set(false);
    this.form.set({
      ...p,
      closesOn: this.dayOf(p.closesOn) || null,
      // what is typed in the number boxes; turned into numbers on save
      experienceMin: p.experienceMinYears ?? '', experienceMax: p.experienceMaxYears ?? '',
      salaryLow: p.salaryMin ?? '', salaryHigh: p.salaryMax ?? '',
      clientId: this.clientOf()[p.postingId]?.clientId ?? null,
    });
  }

  closeForm(): void {
    if (this.saving()) return;
    this.form.set(null);
    this.formError.set('');
  }

  save(): void {
    const f = this.form();
    if (!f || this.saving()) return;

    const t = (v: unknown) => String(v ?? '').trim();
    const whole = (v: unknown): number | null | undefined => {
      const text = t(v);
      if (!text) return null;
      return /^\d{1,9}$/.test(text) ? Number(text) : undefined;
    };

    if (!t(f.title) || !t(f.city) || !t(f.description)) { this.formError.set('Enter the title, the city and the description of the job'); return; }

    const expMin = whole(f.experienceMin), expMax = whole(f.experienceMax);
    if (expMin === undefined || expMax === undefined || (expMin ?? 0) > 60 || (expMax ?? 0) > 60) { this.formError.set('Enter the experience in years, from 0 to 60'); return; }
    if (expMin != null && expMax != null && expMin > expMax) { this.formError.set('The least experience cannot be more than the most'); return; }

    const payMin = whole(f.salaryLow), payMax = whole(f.salaryHigh);
    if (payMin === undefined || payMax === undefined || payMin === 0 || payMax === 0) { this.formError.set('Enter the salary per month as an amount, or leave it empty'); return; }
    if (payMin != null && payMax != null && payMin > payMax) { this.formError.set('The lowest salary cannot be more than the highest'); return; }

    this.formError.set('');
    this.saving.set(true);
    this.api.savePosting({
      postingId: f.postingId, title: t(f.title), city: t(f.city), employmentType: f.employmentType, workMode: f.workMode,
      experienceMinYears: expMin, experienceMaxYears: expMax, salaryMin: payMin, salaryMax: payMax,
      skills: t(f.skills), description: t(f.description), closesOn: t(f.closesOn) || null,
    }).subscribe({
      next: res => {
        this.saving.set(false);
        if (!res.success) { this.formError.set(res.message || 'Could not save. Please try again'); return; }
        this.form.set(null);
        this.notify(res.message, true);
        // the client of the job is kept apart: it is never part of what people see
        const postingId = f.postingId || res.data;
        const before = this.clientOf()[f.postingId]?.clientId ?? null;
        if (postingId && (f.clientId ?? null) !== before) {
          this.consultancy.setPostingClient(postingId, f.clientId ?? null).subscribe({
            next: r => { if (!r.success) this.notify(r.message, false); this.loadClients(); },
            error: () => this.notify('The client of the job could not be saved', false),
          });
        }
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Could not save. Please try again');
        // the answer was lost, the save may have happened: show what is stored now
        this.load();
      },
    });
  }

  publish(posting: CompanyPosting): void {
    this.setStatus(posting, 'Open');
  }

  close(posting: CompanyPosting): void {
    if (!window.confirm(`Close "${posting.title}"? It will no longer be found and takes no more applications. The applications stay.`)) return;
    this.setStatus(posting, 'Closed');
  }

  private setStatus(posting: CompanyPosting, status: 'Open' | 'Closed'): void {
    this.api.setPostingStatus(posting.postingId, status).subscribe({
      next: res => { this.notify(res.message, res.success); this.load(); },
      error: () => this.notify('Could not change it. Please try again', false),
    });
  }

  remove(posting: CompanyPosting): void {
    if (!window.confirm(`Remove "${posting.title}"?`)) return;
    this.api.deletePosting(posting.postingId).subscribe({
      next: res => { this.notify(res.message, res.success); this.load(); },
      error: () => this.notify('Could not remove it. Please try again', false),
    });
  }

  applicantCount(p: CompanyPosting): number {
    return p.applied + p.shortlisted + p.rejected + p.hired;
  }

  // ── applicants ────────────────────────────────────────────────────────────

  showApplicants(posting: CompanyPosting): void {
    this.selected.set(posting);
    this.applicants.set([]);
    this.view.set('applicants');
    this.loadApplicants();
  }

  // ── the people who fit a job ──────────────────────────────────────────────

  showMatches(posting: CompanyPosting): void {
    if (this.selected()?.postingId !== posting.postingId) this.showApplicants(posting);
    this.setView('matches');
  }

  setView(view: 'applicants' | 'matches'): void {
    this.view.set(view);
    if (view === 'matches') this.loadMatches();
  }

  private loadMatches(): void {
    const posting = this.selected();
    if (!posting) return;
    this.matchesLoading.set(true);
    this.consultancy.getPostingMatches(posting.postingId).subscribe({
      next: res => {
        this.matchesLoading.set(false);
        this.matches.set(res.success ? res.data ?? [] : []);
        if (!res.success) this.notify(res.message, false);
      },
      error: () => { this.matchesLoading.set(false); this.notify('The candidates could not be found. Please try again', false); },
    });
  }

  /** An invitation to apply for this job, in one click (the person is told). */
  inviteMatch(m: CandidateMatch): void {
    const posting = this.selected();
    if (!posting || this.inviting() || m.alreadyInvited) return;
    this.inviting.set(m.candidateKey);
    this.consultancy.invite(m.candidateKey, posting.postingId, '').subscribe({
      next: res => {
        this.inviting.set(null);
        this.notify(res.success ? `Invitation sent to ${m.fullName}` : res.message, res.success);
        if (res.success || res.message === 'This candidate was already invited to the job') {
          this.matches.update(list => list.map(x => (x.candidateKey === m.candidateKey ? { ...x, alreadyInvited: true } : x)));
        }
      },
      error: () => { this.inviting.set(null); this.notify('Could not send the invitation. Please try again', false); },
    });
  }

  messageMatch(m: CandidateMatch): void {
    const posting = this.selected();
    if (!posting || this.messaging()) return;
    this.messaging.set(true);
    this.messages.startAsCompany({ candidateKey: m.candidateKey, postingId: posting.postingId }).subscribe({
      next: res => {
        this.messaging.set(false);
        if (res.success && res.data) this.router.navigate(['/consultancy/messages'], { queryParams: { c: res.data } });
        else this.notify(res.message || 'Could not open the conversation', false);
      },
      error: () => { this.messaging.set(false); this.notify('Could not open the conversation. Please try again', false); },
    });
  }

  /** The whole profile, in Candidates (the person sees which company opened it). */
  viewMatch(m: CandidateMatch): void {
    this.router.navigate(['/consultancy/candidates'], { queryParams: { candidate: m.candidateKey } });
  }

  matchSkills(m: CandidateMatch): string[] {
    return (m.matchedSkills || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  /** Strong, good or fair: the share of what the job asks that the person has. */
  fitLabel(m: CandidateMatch): { text: string; tone: string } {
    const skills = m.skillsWanted > 0 ? m.skillHits / m.skillsWanted : (m.titleHits > 0 ? 1 : 0);
    const extra = (m.cityMatch ? 1 : 0) + (m.experienceFit === 1 ? 1 : 0) + (m.modeMatch ? 1 : 0);
    if (skills >= 0.6 && extra >= 2) return { text: 'Strong fit', tone: 'strong' };
    if (skills >= 0.3 || (m.titleHits > 0 && extra >= 1)) return { text: 'Good fit', tone: 'good' };
    return { text: 'Fair fit', tone: 'fair' };
  }

  matchExperience(m: CandidateMatch): string {
    if (m.experienceSource === 'None') return 'Experience not added';
    const years = `${m.experienceYears} ${m.experienceYears === 1 ? 'year' : 'years'}`;
    return m.experienceSource === 'Headline' ? `${years} (from headline)` : years;
  }

  private loadApplicants(): void {
    const posting = this.selected();
    if (!posting) return;
    this.applicantsLoading.set(true);
    this.api.getApplicants(posting.postingId).subscribe({
      next: res => {
        this.applicantsLoading.set(false);
        this.applicants.set(res.success ? res.data ?? [] : []);
        if (!res.success) this.notify(res.message, false);
      },
      error: () => { this.applicantsLoading.set(false); this.notify('The applicants could not be loaded. Please try again', false); },
    });
  }

  backToJobs(): void {
    this.selected.set(null);
    this.applicants.set([]);
    this.applicant.set(null);
    this.load();   // the counts may have changed
  }

  openApplicant(a: JobApplicant): void {
    const posting = this.selected();
    if (!posting) return;
    this.api.getApplicant(posting.postingId, a.applicationId).subscribe({
      next: res => {
        if (res.success && res.data) { this.applicant.set(res.data); return; }
        // the person withdrew in the meantime
        this.notify(res.message === 'Not found' ? 'This application was withdrawn' : res.message, false);
        this.loadApplicants();
      },
      error: () => this.notify('The applicant could not be opened. Please try again', false),
    });
  }

  closeApplicant(): void {
    this.applicant.set(null);
  }

  setApplicantStatus(applicationId: number, status: ApplicantStatus): void {
    const posting = this.selected();
    if (!posting || this.statusBusy()) return;

    this.statusBusy.set(true);
    this.api.setApplicantStatus(posting.postingId, applicationId, status).subscribe({
      next: res => {
        this.statusBusy.set(false);
        this.notify(res.message === 'Not found' ? 'This application was withdrawn' : res.message, res.success);
        if (res.success) this.applicant.update(p => (p && p.applicationId === applicationId ? { ...p, status } : p));
        else this.applicant.set(null);
        this.loadApplicants();
      },
      error: () => { this.statusBusy.set(false); this.notify('Could not change it. Please try again', false); },
    });
  }

  messaging = signal(false);

  /** The conversation with this applicant (made when there is none), in Messages. */
  messageApplicant(a: JobApplicantPage): void {
    const posting = this.selected();
    if (!posting || this.messaging()) return;
    this.messaging.set(true);
    this.messages.startAsCompany({ applicationId: a.applicationId, postingId: posting.postingId }).subscribe({
      next: res => {
        this.messaging.set(false);
        if (res.success && res.data) this.router.navigate(['/consultancy/messages'], { queryParams: { c: res.data } });
        else this.notify(res.message || 'Could not open the conversation', false);
      },
      error: () => { this.messaging.set(false); this.notify('Could not open the conversation. Please try again', false); },
    });
  }

  /** A placement for an applicant who was hired, on the Placements page. */
  recordPlacement(a: JobApplicantPage): void {
    const posting = this.selected();
    if (!posting) return;
    this.router.navigate(['/consultancy/placements'], {
      queryParams: { application: a.applicationId, posting: posting.postingId, name: a.profile.profile.fullName, title: posting.title },
    });
  }

  downloadResume(applicationId: number, name: string): void {
    const posting = this.selected();
    if (!posting) return;
    this.api.downloadResume(posting.postingId, applicationId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name || 'resume';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.notify('The resume could not be downloaded', false),
    });
  }

  // ── what the template shows ───────────────────────────────────────────────

  statusClass(status: string): string {
    return `jb-status ${status.toLowerCase()}`;
  }

  /** The states of a job in the colours of the list: open like "hired", draft plain, closed like "rejected". */
  postingLabel(status: string): string {
    return status === 'InReview' ? 'In review' : status;
  }

  certificateLabel(status: string): string {
    return status === 'Verified' ? 'Verified' : status === 'Rejected' ? 'Not verified' : 'Not checked';
  }

  postingClass(status: string): string {
    if (status === 'InReview') return 'jb-status shortlisted';
    return `jb-status ${status === 'Open' ? 'hired' : status === 'Closed' ? 'rejected' : ''}`;
  }

  dayLabel(value: string | null | undefined): string {
    const day = this.dayOf(value);
    if (!day) return '';
    const [year, m, d] = day.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${year}`;
  }

  monthLabel(value: string | null | undefined): string {
    if (!/^\d{4}-\d{2}/.test(value ?? '')) return '';
    const [year, m] = (value as string).slice(0, 7).split('-').map(Number);
    return `${MONTHS[m - 1]} ${year}`;
  }

  years(row: JobEducation): string {
    if (row.startYear && row.endYear) return `${row.startYear} – ${row.endYear}`;
    return String(row.endYear || row.startYear || '');
  }

  initials(name: string | null | undefined): string {
    return (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(word => Array.from(word)[0].toUpperCase()).join('');
  }

  /** The link when it is a plain https address, '' otherwise: nothing else is ever put into an href. */
  safeLink(url: string | null | undefined): string {
    const text = (url ?? '').trim();
    return /^https:\/\/[^\s"<>]+$/i.test(text) ? text : '';
  }

  /** "GST 4/5, Payroll 3/5": the sub-skills of a skill with the rating the person gave them. */
  subSkillsLine(skill: JobSkill): string {
    return (skill.subSkills ?? []).map(u => `${u.name} ${u.rating}/5`).join(', ');
  }

  // dates are taken as text: a Date object would shift them by the time zone
  private dayOf(value: string | null | undefined): string {
    return /^\d{4}-\d{2}-\d{2}/.test(value ?? '') ? (value as string).slice(0, 10) : '';
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Done' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
