import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  JOB_EMPLOYMENT_TYPES,
  JOB_WORK_MODES,
  JobApplication,
  JobPostingView,
  JobSearchFilter,
  JobsService,
} from '../../Services/jobs-service';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { interviewLabel, interviewTime, isWebLink } from '../../Services/job-labels';
import { jobsMenu } from '../personal-shell-component/jobs-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';

export type JobBoardMode = 'search' | 'applications' | 'saved';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Job Portal, phase 2: the jobs companies offer, as a person uses them. One component
 * for three pages (the route says which): search, the person's applications, the saved
 * jobs. Everything is read and written for whoever is logged in; no user id travels.
 */
@Component({
  selector: 'app-job-board-component',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PersonalShellComponent, VerifiedBadgeComponent],
  templateUrl: './job-board-component.html',
  styleUrls: ['../job-profile-component/job-profile-component.scss', './job-board-component.scss'],
})
export class JobBoardComponent implements OnInit {
  private api = inject(JobsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private alerts = inject(JobAlertsService);
  readonly menu = computed(() => jobsMenu(this.alerts.unread()));
  readonly employmentTypes = JOB_EMPLOYMENT_TYPES;
  readonly workModes = JOB_WORK_MODES;
  readonly interviewLabel = interviewLabel;
  readonly isWebLink = isWebLink;

  /** An interview that is set and still to come (an open application only). */
  hasInterview(a: JobApplication): boolean {
    return (a.status === 'Applied' || a.status === 'Shortlisted') && interviewTime(a.interviewAt) > Date.now() - 2 * 3_600_000;
  }

  mode = signal<JobBoardMode>('search');

  loading = signal(true);
  /** Why the page cannot be shown ('' when it can). */
  unavailable = signal('');

  postings = signal<JobPostingView[]>([]);
  total = signal(0);
  pageSize = signal(20);
  applications = signal<JobApplication[]>([]);

  /** What is typed in the search bar; sent when Search is pressed. */
  filter: JobSearchFilter = { q: '', city: '', type: '', mode: '', page: 1, sort: 'match' };


  /** The job the apply dialog is for. */
  applyFor = signal<JobPostingView | null>(null);
  applyNote = '';
  applyError = signal('');
  applying = signal(false);

  toast = signal<{ text: string; ok: boolean } | null>(null);

  ngOnInit(): void {
    // an invitation links to one job (?posting=, notifications written before the job page): its page
    const invited = Number(this.route.snapshot.queryParamMap?.get('posting'));
    if (Number.isInteger(invited) && invited > 0) {
      this.router.navigate(['/apps/jobs/job', invited], { replaceUrl: true });
      return;
    }

    this.mode.set((this.route.snapshot.data['mode'] as JobBoardMode) ?? 'search');
    this.load();
    this.alerts.refresh();
  }

  get subtitle(): string {
    return this.mode() === 'search' ? 'Jobs that companies have published. Apply with your profile.'
      : this.mode() === 'applications' ? 'Every job you applied to, and where it stands.'
      : 'Jobs you kept to look at again.';
  }

  /** The first letter of the company, for the tile where a logo would be. */
  initial(name: string | null | undefined): string {
    const first = Array.from((name ?? '').trim())[0];
    return first ? first.toUpperCase() : '?';
  }

  get title(): string {
    return this.mode() === 'search' ? 'Search jobs' : this.mode() === 'applications' ? 'My applications' : 'Saved jobs';
  }

  // ── reading ───────────────────────────────────────────────────────────────

  load(): void {
    const failed = () => this.fail('Job Portal could not be loaded. Please try again.');

    if (this.mode() === 'applications') {
      this.api.getApplications().subscribe({
        next: res => (res.success ? this.show(() => this.applications.set(res.data ?? [])) : this.fail(res.message)),
        error: failed,
      });
    } else if (this.mode() === 'saved') {
      this.api.getSaved().subscribe({
        next: res => (res.success ? this.show(() => { this.postings.set(res.data ?? []); this.total.set(res.data?.length ?? 0); }) : this.fail(res.message)),
        error: failed,
      });
    } else {
      this.api.searchPostings(this.filter).subscribe({
        next: res => (res.success && res.data
          ? this.show(() => { this.postings.set(res.data!.items ?? []); this.total.set(res.data!.total); this.pageSize.set(res.data!.pageSize || 20); })
          : this.fail(res.message)),
        error: failed,
      });
    }
  }

  private show(set: () => void): void {
    set();
    this.unavailable.set('');
    this.loading.set(false);
  }

  private fail(message: string | undefined): void {
    this.loading.set(false);
    this.postings.set([]);
    this.applications.set([]);
    this.unavailable.set(message || 'This application is not available right now');
  }

  search(): void {
    this.filter.page = 1;
    this.load();
  }

  clearSearch(): void {
    this.filter = { q: '', city: '', type: '', mode: '', page: 1, sort: this.filter.sort };
    this.load();
  }

  get hasFilter(): boolean {
    return !!(this.filter.q.trim() || this.filter.city.trim() || this.filter.type || this.filter.mode);
  }

  get lastPage(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize()));
  }

  setSort(sort: 'match' | 'newest'): void {
    if (this.filter.sort === sort) return;
    this.filter.sort = sort;
    this.filter.page = 1;
    this.load();
  }

  /** Some of the jobs shown fit the person's preferences: the order can be chosen. */
  get anyMatch(): boolean {
    return this.postings().some(p => (p.matchScore ?? 0) > 0);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage || page === this.filter.page) return;
    this.filter.page = page;
    this.load();
  }

  // ── one job ───────────────────────────────────────────────────────────────

  toggleSave(posting: JobPostingView): void {
    const saved = !posting.isSaved;
    this.api.setSaved(posting.postingId, saved).subscribe({
      next: res => {
        if (!res.success) { this.notify(res.message === 'Not found' ? 'This job is no longer available' : res.message, false); return; }
        this.change(posting.postingId, { isSaved: saved });
        // on the page of saved jobs a job that is no longer saved leaves the list
        if (this.mode() === 'saved' && !saved) {
          this.postings.update(list => list.filter(p => p.postingId !== posting.postingId));
          this.total.update(n => Math.max(0, n - 1));
        }
        this.notify(res.message, true);
      },
      error: () => this.notify('Could not save the job. Please try again', false),
    });
  }

  /** Puts a change into the list. */
  private change(postingId: number, patch: Partial<JobPostingView>): void {
    this.postings.update(list => list.map(p => (p.postingId === postingId ? { ...p, ...patch } : p)));
  }

  // ── applying ──────────────────────────────────────────────────────────────

  canApply(posting: JobPostingView): boolean {
    return posting.isOpen && (!posting.myStatus || posting.myStatus === 'Withdrawn');
  }

  startApply(posting: JobPostingView): void {
    if (!this.canApply(posting)) return;
    this.applyNote = '';
    this.applyError.set('');
    this.applying.set(false);
    this.applyFor.set(posting);
  }

  cancelApply(): void {
    if (this.applying()) return;
    this.applyFor.set(null);
    this.applyError.set('');
  }

  /** The profile lacks what an application needs: the dialog then offers the way to it. */
  get applyNeedsProfile(): boolean {
    return this.applyError().startsWith('Add your name');
  }

  sendApply(): void {
    const posting = this.applyFor();
    if (!posting || this.applying()) return;

    const note = this.applyNote.trim();
    if (note.length > 1000) { this.applyError.set('The note can have at most 1000 characters'); return; }

    this.applyError.set('');
    this.applying.set(true);
    this.api.apply(posting.postingId, note).subscribe({
      next: res => {
        this.applying.set(false);
        if (!res.success) {
          this.applyError.set(res.message || 'Could not send the application. Please try again');
          if (res.message === 'You have already applied') this.change(posting.postingId, { myStatus: 'Applied' });
          return;
        }
        this.change(posting.postingId, { myStatus: 'Applied' });
        this.applyFor.set(null);
        this.notify(res.message, true);
      },
      error: () => {
        this.applying.set(false);
        this.applyError.set('Could not send the application. Please try again');
        // the answer was lost, the application may have been sent: show what is stored now
        this.load();
      },
    });
  }

  withdraw(application: JobApplication): void {
    if (!window.confirm(`Withdraw your application for "${application.title}"? ${application.companyName} will no longer see your profile.`)) return;
    this.api.withdraw(application.applicationId).subscribe({
      next: res => { this.notify(res.message, res.success); this.load(); },
      error: () => this.notify('Could not withdraw it. Please try again', false),
    });
  }

  // ── what the template shows ───────────────────────────────────────────────

  experienceLabel(p: { experienceMinYears?: number | null; experienceMaxYears?: number | null }): string {
    const min = p.experienceMinYears, max = p.experienceMaxYears;
    if (min != null && max != null) return min === max ? `${min} ${min === 1 ? 'year' : 'years'}` : `${min} – ${max} years`;
    if (min != null) return min === 0 ? 'Freshers welcome' : `${min}+ years`;
    if (max != null) return `Up to ${max} years`;
    return '';
  }

  salaryLabel(p: { salaryMin?: number | null; salaryMax?: number | null }): string {
    const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
    const min = p.salaryMin, max = p.salaryMax;
    if (min != null && max != null) return min === max ? `${money(min)} per month` : `${money(min)} – ${money(max)} per month`;
    if (min != null) return `From ${money(min)} per month`;
    if (max != null) return `Up to ${money(max)} per month`;
    return '';
  }

  skillList(skills: string): string[] {
    return (skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 12);
  }

  // dates are taken as text: a Date object would shift them by the time zone
  dayLabel(value: string | null | undefined): string {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value ?? '')) return '';
    const [year, m, d] = (value as string).slice(0, 10).split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${year}`;
  }

  statusClass(status: string): string {
    return `jb-status ${status.toLowerCase()}`;
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Done' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
