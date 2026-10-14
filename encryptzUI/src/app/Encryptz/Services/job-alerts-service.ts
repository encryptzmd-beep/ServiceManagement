import { Injectable, inject } from '@angular/core';
import { NotificationService } from './notification-service';

/**
 * How many notifications the person has not read: the number next to "Notifications" in
 * the side menu of Job Portal. They are the common notifications of every application
 * (NotificationService); every page of Job Portal starts listening when it opens. A failure
 * leaves the number as it was (it never hides a page).
 */
@Injectable({ providedIn: 'root' })
export class JobAlertsService {
  private notices = inject(NotificationService);

  readonly unread = this.notices.unread;

  refresh(): void {
    this.notices.start();
  }
}
