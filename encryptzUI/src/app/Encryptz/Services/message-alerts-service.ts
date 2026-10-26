import { Injectable, Injector, effect, inject, signal, untracked } from '@angular/core';
import { MessageSide, MessagesService } from './messages-service';
import { NotificationService } from './notification-service';

/**
 * How many messages wait unread: the number next to "Messages" in the side menu of Job
 * Portal (the person) and of Job Consultancy (the company). A side is read when a page with
 * its menu opens, again when a message notification arrives, and when a conversation is read.
 * A failure leaves the number as it was (it never hides a page).
 */
@Injectable({ providedIn: 'root' })
export class MessageAlertsService {
  private injector = inject(Injector);
  private notices = inject(NotificationService);

  readonly unread = { person: signal(0), company: signal(0) };
  private watched = new Set<MessageSide>();

  constructor() {
    // a new message: the sides that are shown are read again
    let seen = untracked(() => this.notices.arrived());
    effect(() => {
      const now = this.notices.arrived();
      if (now === seen) return;
      seen = now;
      if (untracked(() => this.notices.incoming())?.kind === 'Message') untracked(() => this.watched.forEach(side => this.refresh(side)));
    });
  }

  /** A page shows this side's menu: its number is read now and kept up to date. */
  watch(side: MessageSide): void {
    this.watched.add(side);
    this.refresh(side);
  }

  refresh(side: MessageSide): void {
    try {
      this.injector.get(MessagesService).unread(side).subscribe({
        next: res => { if (res?.success) this.unread[side].set(res.data ?? 0); },
        error: () => { /* the number stays as it was */ },
      });
    } catch {
      // no API here (a page tested on its own): the number stays as it was
    }
  }
}
