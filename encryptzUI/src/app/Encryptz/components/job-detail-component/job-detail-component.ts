import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { JobApplication, JobPostingView, JobsService } from '../../Services/jobs-service';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { MessagesService } from '../../Services/messages-service';
import { PublicJobsService, jobPath } from '../../Services/public-jobs-service';
import { dayLabel, experienceLabel, initial, salaryLabel, skillList } from '../../Services/job-labels';
import { jobsMenu } from '../personal-shell-component/jobs-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';
import { shareLink } from '../../Services/share-link';
import { EscapeClose } from '../shared/escape-close';

/**
 * Job Portal, one job on a page of its own (/apps/jobs/job/:id): the job board opens it in a
 * new tab. The full description, Save, Apply and the state of the person's application, and
 * the jobs most like it. `?apply=1` opens the application at once (the public job page sends
 * people here to apply after they signed in).
 */
@Component({
  selector: 'app-job-detail',
  standalone: true,
  imports: [FormsModule, RouterModule, PersonalShellComponent, VerifiedBadgeComponent, EscapeClose],
  templateUrl: './job-detail-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-board-component/job-board-component.scss',
    '../public-job-component/public-job-component.scss',
    './job-detail-component.scss',
  ],
})
export class JobDetailComponent {
  private api = inject(JobsService);
  private publicJobs = inject(PublicJobsService);
  private alerts = inject(JobAlertsService);
  private messages = inject(MessagesService);
  private router = inject(Router);
  readonly menu = computed(() => jobsMenu(this.alerts.unread()));

  loading = signal(true);
  job = signal<JobPostingView | null>(null);
  /** Why the job cannot be shown ('' when it can). */
  problem = signal('');
  related = signal<JobPostingView[]>([]);
  saving = signal(false);
  /** The person's application to this job (when they applied and since when it stands), if any. */
  application = signal<JobApplication | null>(null);

  /** The application being written. */
  applyOpen = signal(false);
  applyNote = '';
  applyError = signal('');
  applying = signal(false);

  toast = signal<{ text: string; ok: boolean } | null>(null);

  readonly dayLabel = dayLabel;
  readonly experienceLabel = experienceLabel;
  readonly salaryLabel = salaryLabel;
  readonly skillList = skillList;
  readonly initial = initial;

  constructor() {
    const route = inject(ActivatedRoute);
    route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(params => {
      const id = Number(params.get('id'));
      const applyNow = route.snapshot.queryParamMap.get('apply') === '1';
      if (Number.isInteger(id) && id > 0) this.load(id, applyNow);
      else { this.loading.set(false); this.problem.set('This job is no longer available'); }
    });
    this.alerts.refresh();
  }

  load(id: number, applyNow = false): void {
    this.loading.set(true);
    this.problem.set('');
    this.applyOpen.set(false);
    this.related.set([]);
    this.application.set(null);

    this.api.getPosting(id).subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success || !res.data) {
          this.job.set(null);
          this.problem.set(res.message === 'Not found' ? 'This job is no longer available' : res.message || 'This job could not be opened');
          return;
        }
        this.job.set(res.data);
        if (res.data.myStatus && res.data.myStatus !== 'Withdrawn') this.loadApplication(id);
        if (applyNow && this.canApply(res.data)) this.startApply();
        this.publicJobs.related(id).subscribe({
          next: r => this.related.set(r.success ? (r.data ?? []).filter(p => p.postingId !== id) : []),
          error: () => this.related.set([]),
        });
      },
      error: () => { this.loading.set(false); this.problem.set('This job could not be opened. Please try again'); },
    });
  }

  /** The dates of the application come with the person's applications, not with the job. */
  private loadApplication(postingId: number): void {
    this.api.getApplications().subscribe({
      next: res => {
        const mine = res.success ? (res.data ?? []).filter(a => a.postingId === postingId && a.status !== 'Withdrawn') : [];
        this.application.set(mine[0] ?? null);
      },
      error: () => this.application.set(null),
    });
  }

  // ── save ──────────────────────────────────────────────────────────────────

  toggleSave(p: JobPostingView): void {
    if (this.saving()) return;
    const saved = !p.isSaved;
    this.saving.set(true);
    this.api.setSaved(p.postingId, saved).subscribe({
      next: res => {
        this.saving.set(false);
        if (!res.success) { this.notify(res.message === 'Not found' ? 'This job is no longer available' : res.message, false); return; }
        this.job.update(j => (j ? { ...j, isSaved: saved } : j));
        this.notify(res.message, true);
      },
      error: () => { this.saving.set(false); this.notify('Could not save the job. Please try again', false); },
    });
  }

  // ── apply ─────────────────────────────────────────────────────────────────

  canApply(p: JobPostingView): boolean {
    return p.isOpen && (!p.myStatus || p.myStatus === 'Withdrawn');
  }

  startApply(): void {
    this.applyNote = '';
    this.applyError.set('');
    this.applying.set(false);
    this.applyOpen.set(true);
  }

  cancelApply(): void {
    if (this.applying()) return;
    this.applyOpen.set(false);
    this.applyError.set('');
  }

  /** The profile lacks what an application needs: the dialog then offers the way to it. */
  get applyNeedsProfile(): boolean {
    return this.applyError().startsWith('Add your name');
  }

  sendApply(): void {
    const p = this.job();
    if (!p || this.applying()) return;

    const note = this.applyNote.trim();
    if (note.length > 1000) { this.applyError.set('The note can have at most 1000 characters'); return; }

    this.applyError.set('');
    this.applying.set(true);
    this.api.apply(p.postingId, note).subscribe({
      next: res => {
        this.applying.set(false);
        if (!res.success) {
          this.applyError.set(res.message || 'Could not send the application. Please try again');
          if (res.message === 'You have already applied') this.job.update(j => (j ? { ...j, myStatus: 'Applied' } : j));
          return;
        }
        this.job.update(j => (j ? { ...j, myStatus: 'Applied' } : j));
        this.applyOpen.set(false);
        this.loadApplication(p.postingId);
        this.notify(res.message, true);
      },
      error: () => {
        this.applying.set(false);
        this.applyError.set('Could not send the application. Please try again');
        // the answer was lost, the application may have been sent: show what is stored now
        this.load(p.postingId);
      },
    });
  }

  // ── write to the company, share the job ───────────────────────────────

  messaging = signal(false);

  /** The conversation with the company of this job (made when there is none), in Messages. */
  messageCompany(p: JobPostingView): void {
    if (this.messaging()) return;
    this.messaging.set(true);
    this.messages.startAsPerson(p.postingId).subscribe({
      next: res => {
        this.messaging.set(false);
        if (res.success && res.data) this.router.navigate(['/apps/jobs/messages'], { queryParams: { c: res.data } });
        else this.notify(res.message, false);
      },
      error: () => { this.messaging.set(false); this.notify('Could not open the conversation. Please try again', false); },
    });
  }

  /** The public address of the job: anybody can open it, no login. */
  shareJob(p: JobPostingView): void {
    shareLink(`${location.origin}${jobPath(p)}`, p.title, ok => this.notify(ok ? 'Link copied. Paste it anywhere to share the job' : 'The link could not be copied', ok));
  }

  statusClass(status: string): string {
    return `jb-status ${status.toLowerCase()}`;
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Done' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
