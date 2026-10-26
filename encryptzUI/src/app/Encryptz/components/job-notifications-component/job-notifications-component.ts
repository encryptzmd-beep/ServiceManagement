import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { AppNotification, NotificationService, appLabel, safeLink } from '../../Services/notification-service';
import { jobsMenu } from '../personal-shell-component/jobs-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';

/**
 * The notifications of the person, of every application (Job Portal, Job Consultancy, the
 * platform): kept in the main database, new ones arrive at once. Opening the page marks
 * everything as read; what was new when the page opened stays marked as new until the person leaves.
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
  private api = inject(NotificationService);
  private alerts = inject(JobAlertsService);
  private router = inject(Router);

  readonly menu = computed(() => jobsMenu(this.alerts.unread()));

  loading = signal(true);
  unavailable = signal('');
  items = signal<AppNotification[]>([]);

  readonly appLabel = appLabel;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.list().subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success || !res.data) {
          this.unavailable.set(res.message || 'Notifications are not available right now');
          return;
        }
        this.unavailable.set('');
        this.items.set(res.data.items ?? []);
        this.alerts.unread.set(res.data.unread);
        if (res.data.unread > 0) this.markAllRead();
      },
      error: () => {
        this.loading.set(false);
        this.unavailable.set('Notifications could not be loaded. Please try again.');
      },
    });
  }

  /** The number in the menu goes at once; the list keeps showing what was new. */
  private markAllRead(): void {
    this.api.markRead(null).subscribe({
      next: res => { if (res.success) this.alerts.unread.set(0); },
      error: () => {},
    });
  }

  /** Only a page of this site is ever opened from a notification. */
  canOpen(n: AppNotification): boolean {
    return safeLink(n.link) !== '';
  }

  openLink(n: AppNotification): void {
    if (this.canOpen(n)) this.router.navigateByUrl(safeLink(n.link));
  }

  icon(n: AppNotification): string {
    switch (n.kind) {
      case 'NewApplicant': return 'person_add_alt';
      case 'Withdrawn': return 'person_remove';
      case 'Shortlisted': return 'star_outline';
      case 'Hired': return 'celebration';
      case 'Rejected': return 'do_not_disturb_on';
      case 'JobClosed': return 'event_busy';
      case 'Invitation': return 'campaign';
      case 'Message': return 'chat';
      case 'JobApproved': return 'task_alt';
      case 'JobReturned': return 'undo';
      case 'ReviewWaiting':
      case 'CertificateWaiting': return 'fact_check';
      case 'CertificateVerified': return 'verified';
      case 'CertificateRejected': return 'gpp_maybe';
      case 'ProfileVerified': return 'verified';
      case 'ProfileUnverified': return 'gpp_maybe';
      default: return 'mail_outline';
    }
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
