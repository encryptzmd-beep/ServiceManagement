import { Injectable, inject, signal } from '@angular/core';
import { JobsService } from './jobs-service';

/**
 * How many notifications of Job Portal the person has not read: the number next to
 * "Notifications" in the side menu. Every page of Job Portal asks for it when it opens;
 * a failure leaves the number as it was (it never hides a page).
 */
@Injectable({ providedIn: 'root' })
export class JobAlertsService {
  private api = inject(JobsService);

  readonly unread = signal(0);

  refresh(): void {
    this.api.getNotifications().subscribe({
      next: res => { if (res.success && res.data) this.unread.set(res.data.unread); },
      error: () => {},
    });
  }
}
