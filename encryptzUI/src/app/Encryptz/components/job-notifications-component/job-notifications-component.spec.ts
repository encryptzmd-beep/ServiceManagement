import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { NotificationService } from '../../Services/notification-service';
import { JobNotificationsComponent } from './job-notifications-component';

describe('JobNotificationsComponent', () => {
  const note = (over: any = {}) => ({
    notificationId: 1, app: 'JOBPORTAL', companyId: null, kind: 'Shortlisted', title: 'You are shortlisted for Accountant', body: 'Hamster A/C · Accountant',
    link: '/apps/jobs/applications', createdAt: '2020-01-15T10:00:00', isRead: false, ...over,
  });

  let api: any;
  let calls: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [JobNotificationsComponent],
      providers: [
        provideRouter([]),
        { provide: NotificationService, useValue: api },
        { provide: AuthService, useValue: { userName: () => 'Leo Joseph', currentUser: () => ({ userId: 11 }) } },
      ],
    });
    const fixture = TestBed.createComponent(JobNotificationsComponent);
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

  beforeEach(() => {
    calls = [];
    api = {
      unread: signal(0),
      incoming: signal(null),
      arrived: signal(0),
      start: () => calls.push(['start']),
      list: () => { calls.push(['list']); return of({ success: true, message: '', data: {
        items: [note(), note({ notificationId: 2, kind: 'JobClosed', title: 'Felix closed the job Clerk', body: 'Your application stays.', isRead: true, link: 'https://evil.example' })],
        unread: 1,
      } }); },
      markRead: (id: number | null) => { calls.push(['markRead', id]); return of({ success: true, message: 'Done', data: 0 }); },
    };
  });

  it('lists what happened, marks what is new, and then everything as read', () => {
    const fixture = create();
    const items = Array.from(fixture.nativeElement.querySelectorAll('.jn-item')) as HTMLElement[];

    expect(text(fixture)).toContain('You are shortlisted for Accountant');
    expect(text(fixture)).toContain('Hamster A/C · Accountant');
    expect(items[0].classList.contains('new')).toBe(true);
    expect(items[0].textContent).toContain('New');
    expect(items[1].classList.contains('new')).toBe(false);

    expect(calls).toContainEqual(['markRead', null]);
    expect(TestBed.inject(JobAlertsService).unread()).toBe(0);
  });

  it('does not mark anything when nothing is new', () => {
    api.list = () => of({ success: true, message: '', data: { items: [note({ isRead: true })], unread: 0 } });
    create();

    expect(calls.some(x => x[0] === 'markRead')).toBe(false);
  });

  it('opens only a page of this site from a notification', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const items = Array.from(fixture.nativeElement.querySelectorAll('.jn-item')) as HTMLElement[];

    expect(items[0].querySelector('button')).not.toBeNull();
    expect(items[1].querySelector('button')).toBeNull();

    c.openLink(c.items()[1]);
    expect(navigate).not.toHaveBeenCalled();

    c.openLink(c.items()[0]);
    expect(navigate).toHaveBeenCalledWith('/apps/jobs/applications');
  });

  it('shows the number of unread notifications in the menu', () => {
    const fixture = create();
    TestBed.inject(JobAlertsService).unread.set(3);
    fixture.detectChanges();
    const items = Array.from(fixture.nativeElement.querySelectorAll('.ps-nav-item')) as HTMLElement[];
    const last = items.at(-1)!;

    expect(last.textContent).toContain('Notifications');
    expect(last.querySelector('.ps-nav-badge')!.textContent!.trim()).toBe('3');
  });

  it('says there is nothing yet, and when the list cannot be read', () => {
    api.list = () => of({ success: true, message: '', data: { items: [], unread: 0 } });
    expect(text(create())).toContain('No notifications yet');

    api.list = () => throwError(() => ({ status: 0 }));
    expect(text(create())).toContain('Notifications could not be loaded. Please try again.');
  });
});
