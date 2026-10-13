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
import { JOB_EMPLOYMENT_TYPES, JOB_WORK_MODES, JobEducation } from '../../Services/jobs-service';
import { PersonalMenuItem, PersonalShellComponent } from '../personal-shell-component/personal-shell-component';

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
  imports: [CommonModule, FormsModule, RouterModule, PersonalShellComponent],
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

  /** The side menu. A page without a route is not built yet and is shown as "Soon". */
  readonly menu: PersonalMenuItem[] = [
    { label: 'Job postings', icon: 'work_outline', route: '/consultancy/postings' },
    { label: 'Clients', icon: 'handshake' },
    { label: 'Candidates', icon: 'groups' },
    { label: 'Placements', icon: 'verified' },
  ];

  readonly employmentTypes = JOB_EMPLOYMENT_TYPES;
  readonly workModes = JOB_WORK_MODES;
  readonly applicantStates: ApplicantStatus[] = ['Applied', 'Shortlisted', 'Rejected', 'Hired'];

  loading = signal(true);
  /** Why the page cannot be shown ('' when it can). */
  unavailable = signal('');
  postings = signal<CompanyPosting[]>([]);

  /** The job that is written in the dialog (null = no dialog). */
  form = signal<(CompanyPostingFields & { experienceMin: any; experienceMax: any; salaryLow: any; salaryHigh: any }) | null>(null);
  formError = signal('');
  saving = signal(false);

  /** The job whose applicants are shown (null = the list of jobs). */
  selected = signal<CompanyPosting | null>(null);
  applicants = signal<JobApplicant[]>([]);
  applicantsLoading = signal(false);

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
    this.loadApplicants();
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
  postingClass(status: string): string {
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

  // dates are taken as text: a Date object would shift them by the time zone
  private dayOf(value: string | null | undefined): string {
    return /^\d{4}-\d{2}-\d{2}/.test(value ?? '') ? (value as string).slice(0, 10) : '';
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Done' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
