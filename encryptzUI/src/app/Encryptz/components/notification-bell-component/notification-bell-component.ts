import { Component, ElementRef, HostListener, OnDestroy, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotification, NotificationService, appLabel, safeLink } from '../../Services/notification-service';

/**
 * The bell of every header: the number of unread notifications of all applications, the
 * newest of them in a list, and a short notice when one arrives while the page is open.
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  templateUrl: './notification-bell-component.html',
  styleUrl: './notification-bell-component.scss',
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  readonly notices = inject(NotificationService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);

  readonly appLabel = appLabel;

  panelOpen = signal(false);
  loading = signal(false);
  unavailable = signal('');
  items = signal<AppNotification[]>([]);

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // a notification arrived: an open list shows it
    effect(() => {
      if (this.notices.arrived() > 0 && untracked(() => this.panelOpen())) untracked(() => this.load());
    });
    // the notice goes by itself after a while
    effect(() => {
      const shown = this.notices.incoming();
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = shown ? setTimeout(() => this.notices.incoming.set(null), 7000) : null;
    });
  }

  ngOnInit(): void {
    this.notices.start();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  badge(): string {
    const n = this.notices.unread();
    return n > 9 ? '9+' : String(n);
  }

  toggle(): void {
    const open = !this.panelOpen();
    this.panelOpen.set(open);
    if (open) this.load();
  }

  load(): void {
    this.loading.set(this.items().length === 0);
    this.notices.list().subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success || !res.data) {
          this.unavailable.set(res.message || 'Notifications are not available right now');
          return;
        }
        this.unavailable.set('');
        this.items.set((res.data.items ?? []).map(n => ({ ...n, link: safeLink(n.link) })));
      },
      error: () => {
        this.loading.set(false);
        this.unavailable.set('Notifications could not be loaded. Please try again.');
      },
    });
  }

  /** Marks it as read and opens its page, when it has one of this site. */
  open(n: AppNotification): void {
    if (!n.isRead) {
      this.items.update(list => list.map(i => i.notificationId === n.notificationId ? { ...i, isRead: true } : i));
      this.notices.markRead(n.notificationId).subscribe({ error: () => {} });
    }
    const link = safeLink(n.link);
    if (!link) return;
    this.panelOpen.set(false);
    this.router.navigateByUrl(link);
  }

  openIncoming(): void {
    const n = this.notices.incoming();
    this.notices.incoming.set(null);
    if (n) this.open(n);
  }

  markAllRead(): void {
    this.items.update(list => list.map(i => ({ ...i, isRead: true })));
    this.notices.markRead(null).subscribe({ error: () => {} });
  }

  dismiss(): void {
    this.notices.incoming.set(null);
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
      default: return 'notifications_none';
    }
  }

  /** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", or the date. */
  agoLabel(value: string | null | undefined): string {
    const at = Date.parse(value ?? '');
    if (Number.isNaN(at)) return '';
    const minutes = Math.floor((Date.now() - at) / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
    const days = Math.floor(minutes / (24 * 60));
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    const d = new Date(at);
    return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}`;
  }

  /** A list of links closes on a click elsewhere or on Escape (it holds nothing typed). */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.panelOpen() && !this.host.nativeElement.contains(event.target as Node)) this.panelOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.panelOpen.set(false);
  }
}
