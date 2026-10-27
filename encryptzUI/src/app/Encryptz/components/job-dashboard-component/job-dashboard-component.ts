import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { JobApplication, JobPostingView, JobProfilePage, JobProfileView, JobsService } from '../../Services/jobs-service';
import { MessageAlertsService } from '../../Services/message-alerts-service';
import { ConversationSummary, MessagesService } from '../../Services/messages-service';
import { dayLabel, initial, interviewLabel, interviewParts, interviewTime, isWebLink, salaryLabel } from '../../Services/job-labels';
import { jobsMenu } from '../personal-shell-component/jobs-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';

/** Something the profile still lacks, and where to add it. */
interface ProfileTip { text: string; icon: string; }

/** One small card of the applications: how many are in this state. */
interface StatusCard { key: string; label: string; icon: string; count: number; hint: string; }

/**
 * Job Portal, the first page after signing in (/apps/jobs): how the person stands at a glance.
 * The strength of the profile and what it still lacks, the applications, saved jobs, unread
 * messages and profile views, jobs that match the person, the latest applications, messages
 * and who looked at the profile. Every part is read on its own: one that cannot be read
 * stays empty and the rest of the page shows.
 */
@Component({
  selector: 'app-job-dashboard',
  standalone: true,
  imports: [RouterModule, PersonalShellComponent, VerifiedBadgeComponent],
  templateUrl: './job-dashboard-component.html',
  styleUrls: ['../job-profile-component/job-profile-component.scss', './job-dashboard-component.scss'],
})
export class JobDashboardComponent implements OnInit, OnDestroy {
  private jobs = inject(JobsService);
  private messages = inject(MessagesService);
  private alerts = inject(JobAlertsService);
  private messageAlerts = inject(MessageAlertsService);

  readonly menu = computed(() => jobsMenu(this.alerts.unread()));

  page = signal<JobProfilePage | null>(null);
  pageFailed = signal('');
  photoUrl = signal<string | null>(null);
  applications = signal<JobApplication[] | null>(null);
  saved = signal<JobPostingView[] | null>(null);
  views = signal<JobProfileView[] | null>(null);
  matches = signal<JobPostingView[] | null>(null);
  conversations = signal<ConversationSummary[] | null>(null);

  readonly unreadMessages = this.messageAlerts.unread.person;
  readonly dayLabel = dayLabel;
  readonly initial = initial;
  readonly salaryLabel = salaryLabel;
  readonly interviewLabel = interviewLabel;
  readonly interviewParts = interviewParts;
  readonly isWebLink = isWebLink;

  /** "Good morning, Leema": the first word of the name, by the time of day here. */
  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const first = (this.page()?.profile.fullName ?? '').trim().split(/\s+/)[0];
    return first ? `${part}, ${first}` : part;
  });

  /** What the profile still lacks, most useful first (at most four). */
  readonly tips = computed<ProfileTip[]>(() => {
    const p = this.page();
    if (!p) return [];
    const tips: ProfileTip[] = [];
    if (!p.profile.fullName || !p.profile.headline) tips.push({ text: 'Add your name and a headline', icon: 'badge' });
    if (!p.resume) tips.push({ text: 'Upload your resume', icon: 'description' });
    if (!p.skills.length) tips.push({ text: 'Add your skills', icon: 'psychology' });
    if (!p.experience.length) tips.push({ text: 'Add your work experience', icon: 'work_history' });
    if (!p.profile.dateOfBirth) tips.push({ text: 'Add your date of birth (needed to apply)', icon: 'cake' });
    if (!p.education.length) tips.push({ text: 'Add your education', icon: 'school' });
    if (!p.profile.isVisible) tips.push({ text: 'Let employers find you', icon: 'visibility' });
    return tips.slice(0, 4);
  });

  readonly stats = computed(() => {
    const views = this.views() ?? [];
    return {
      saved: (this.saved() ?? []).filter(s => s.isOpen).length,
      views: views.reduce((n, v) => n + v.profileViews + v.resumeViews, 0),
      companies: views.length,
    };
  });

  /** The interviews still to come (an open application only), soonest first. */
  readonly interviews = computed(() =>
    (this.applications() ?? [])
      .filter(a => this.hasInterview(a))
      .sort((a, b) => interviewTime(a.interviewAt) - interviewTime(b.interviewAt)));

  /** The applications by state, as small cards. */
  readonly statusCards = computed<StatusCard[]>(() => {
    const apps = (this.applications() ?? []).filter(a => a.status !== 'Withdrawn');
    const count = (status: string) => apps.filter(a => a.status === status).length;
    return [
      { key: 'applied', label: 'Applied', icon: 'send', count: count('Applied'), hint: 'Waiting for the company' },
      { key: 'shortlisted', label: 'Shortlisted', icon: 'star_outline', count: count('Shortlisted'), hint: 'The company liked your profile' },
      { key: 'interview', label: 'Interviews', icon: 'event_available', count: this.interviews().length, hint: 'Scheduled and still to come' },
      { key: 'hired', label: 'Hired', icon: 'emoji_events', count: count('Hired'), hint: 'Congratulations' },
      { key: 'rejected', label: 'Not selected', icon: 'do_not_disturb_on', count: count('Rejected'), hint: 'Read why, and keep going' },
    ];
  });

  hasInterview(a: JobApplication): boolean {
    return (a.status === 'Applied' || a.status === 'Shortlisted') && interviewTime(a.interviewAt) > Date.now() - 2 * 3_600_000;
  }

  readonly recentApplications = computed(() =>
    [...(this.applications() ?? [])].sort((a, b) => (b.statusAt || b.appliedAt).localeCompare(a.statusAt || a.appliedAt)).slice(0, 5));

  ngOnInit(): void {
    this.jobs.getPage().subscribe({
      next: res => (res.success && res.data ? this.page.set(res.data) : this.pageFailed.set(res.message || 'Job Portal is not available right now')),
      error: () => this.pageFailed.set('Job Portal could not be loaded. Please try again.'),
    });
    // no photo comes back as an empty answer, not always as nothing: only a real image is shown
    this.jobs.getPhoto().subscribe({ next: blob => this.showPhoto(blob && blob.size > 0 && blob.type.startsWith('image/') ? URL.createObjectURL(blob) : null), error: () => {} });
    this.jobs.getApplications().subscribe({ next: r => this.applications.set(r.success ? r.data ?? [] : []), error: () => this.applications.set([]) });
    this.jobs.getSaved().subscribe({ next: r => this.saved.set(r.success ? r.data ?? [] : []), error: () => this.saved.set([]) });
    this.jobs.getProfileViews().subscribe({ next: r => this.views.set(r.success ? r.data ?? [] : []), error: () => this.views.set([]) });
    this.jobs.searchPostings({ q: '', city: '', type: '', mode: '', page: 1, sort: 'match' }).subscribe({
      // the jobs that match the person's preferences first; ones already applied to are left out
      next: r => this.matches.set(r.success ? (r.data?.items ?? []).filter(p => !p.myStatus || p.myStatus === 'Withdrawn').slice(0, 6) : []),
      error: () => this.matches.set([]),
    });
    this.messages.list('person').subscribe({ next: r => this.conversations.set(r.success ? (r.data ?? []).slice(0, 4) : []), error: () => this.conversations.set([]) });
    this.messageAlerts.watch('person');
    this.alerts.refresh();
  }

  ngOnDestroy(): void {
    this.showPhoto(null);
  }

  /** The photo could not be drawn: the initial shows instead. */
  photoFailed(): void {
    this.showPhoto(null);
  }

  private showPhoto(url: string | null): void {
    const old = this.photoUrl();
    if (old) URL.revokeObjectURL(old);
    this.photoUrl.set(url);
  }

  statusClass(status: string): string {
    return `db-status ${status.toLowerCase()}`;
  }

  /** "today", "yesterday", "3 days ago", else the date. */
  ago(value: string | null | undefined): string {
    const at = Date.parse(value ?? '');
    if (Number.isNaN(at)) return '';
    const days = Math.floor((Date.now() - at) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return dayLabel(value);
  }
}
