import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { JobNotification, JobsService } from '../../Services/jobs-service';
import { jobsMenu } from '../personal-shell-component/jobs-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';

/**
 * Job Portal: what happened to the person's applications (a company shortlisted, rejected
 * or hired them, or closed a job they applied to). Opening the page marks everything as
 * read; what was new when the page opened stays marked as new until the person leaves.
 */
@Component({
  selector: 'app-job-notifications-component',
  standalone: true,
  imports: [CommonModule, RouterModule, PersonalShellComponent],
  templateUrl: './job-notifications-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-board-component/job-board-component.scss',
    './job-notifications-component.scss',
  ],
})
export class JobNotificationsComponent implements OnInit {
  private api = inject(JobsService);
  private alerts = inject(JobAlertsService);
  private router = inject(Router);

  readonly menu = computed(() => jobsMenu(this.alerts.unread()));

  loading = signal(true);
  unavailable = signal('');
  items = signal<JobNotification[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getNotifications().subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success || !res.data) {
          this.unavailable.set(res.message || 'This application is not available right now');
          return;
        }
        this.unavailable.set('');
        this.items.set(res.data.items ?? []);
        this.alerts.unread.set(res.data.unread);
        if (res.data.unread > 0) this.markAllRead();
      },
      error: () => {
        this.loading.set(false);
        this.unavailable.set('Job Portal could not be loaded. Please try again.');
      },
    });
  }

  /** The number in the menu goes at once; the list keeps showing what was new. */
  private markAllRead(): void {
    this.api.markNotificationsRead(null).subscribe({
      next: res => { if (res.success) this.alerts.unread.set(0); },
      error: () => {},
    });
  }

  /** Only a page of Job Portal is ever opened from a notification. */
  canOpen(n: JobNotification): boolean {
    return (n.link ?? '').startsWith('/apps/jobs');
  }

  openLink(n: JobNotification): void {
    if (this.canOpen(n)) this.router.navigateByUrl(n.link);
  }

  icon(n: JobNotification): string {
    if (n.kind === 'JobClosed') return 'event_busy';
    if (n.title.startsWith('You are shortlisted')) return 'star_outline';
    if (n.title.includes('marked you as hired')) return 'celebration';
    return 'mail_outline';
  }

  /** "today", "yesterday", "5 days ago", or the date. */
  agoLabel(value: string | null | undefined): string {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value ?? '')) return '';
    const [y, m, d] = (value as string).slice(0, 10).split('-').map(Number);
    const now = new Date();
    const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y, m - 1, d)) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
  }
}
