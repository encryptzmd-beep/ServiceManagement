import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AppNotification, NotificationService } from '../../Services/notification-service';
import { NotificationBellComponent } from './notification-bell-component';

describe('NotificationBellComponent', () => {
  const note = (over: Partial<AppNotification> = {}): AppNotification => ({
    notificationId: 1, app: 'JOBCONSULTANCY', kind: 'NewApplicant', title: 'Leo Joseph applied for Accountant', body: 'Accountant',
    link: '/consultancy/postings', companyId: 3, createdAt: '2020-01-15T10:00:00', isRead: false, ...over,
  });

  let notices: any;
  let calls: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [provideRouter([]), { provide: NotificationService, useValue: notices }],
    });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    return fixture;
  };

  const el = (fixture: any, selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

  beforeEach(() => {
    calls = [];
    notices = {
      unread: signal(2),
      incoming: signal<AppNotification | null>(null),
      arrived: signal(0),
      start: () => calls.push(['start']),
      list: () => { calls.push(['list']); return of({ success: true, message: '', data: {
        items: [note(), note({ notificationId: 2, app: 'JOBPORTAL', title: 'Your certificate is verified', link: 'https://evil.example', isRead: true })],
        unread: 2,
      } }); },
      markRead: (id: number | null) => { calls.push(['markRead', id]); return of({ success: true, message: '', data: 0 }); },
    };
  });

  it('listens when it is shown and shows the number of unread', () => {
    const fixture = create();

    expect(calls).toContainEqual(['start']);
    expect(el(fixture, '.nb-badge')?.textContent?.trim()).toBe('2');

    notices.unread.set(12);
    fixture.detectChanges();
    expect(el(fixture, '.nb-badge')?.textContent?.trim()).toBe('9+');

    notices.unread.set(0);
    fixture.detectChanges();
    expect(el(fixture, '.nb-badge')).toBeNull();
  });

  it('lists the newest when opened, with the application they come from', () => {
    const fixture = create();

    el(fixture, '.nb-button')!.click();
    fixture.detectChanges();

    expect(calls).toContainEqual(['list']);
    expect(text(fixture)).toContain('Leo Joseph applied for Accountant');
    expect(text(fixture)).toContain('Job Consultancy');
    expect(text(fixture)).toContain('Job Portal');
    const items = Array.from(fixture.nativeElement.querySelectorAll('.nb-item')) as HTMLElement[];
    expect(items[0].classList.contains('new')).toBe(true);
    expect(items[1].classList.contains('new')).toBe(false);
  });

  it('opens a page of this site and marks the notification as read', () => {
    const fixture = create();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    el(fixture, '.nb-button')!.click();
    fixture.detectChanges();
    const c = fixture.componentInstance;

    c.open(c.items()[1]);
    expect(navigate).not.toHaveBeenCalled();

    c.open(c.items()[0]);
    expect(calls).toContainEqual(['markRead', 1]);
    expect(navigate).toHaveBeenCalledWith('/consultancy/postings');
    expect(c.items()[0].isRead).toBe(true);
    expect(c.panelOpen()).toBe(false);
  });

  it('marks everything as read', () => {
    const fixture = create();
    el(fixture, '.nb-button')!.click();
    fixture.detectChanges();

    (el(fixture, '.nb-mark-all') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(calls).toContainEqual(['markRead', null]);
    expect(fixture.componentInstance.items().every(i => i.isRead)).toBe(true);
  });

  it('shows a notice of one that arrives, and lets it go', () => {
    const fixture = create();

    notices.incoming.set(note({ title: 'You are shortlisted for Clerk', app: 'JOBPORTAL' }));
    fixture.detectChanges();
    expect(el(fixture, '.nb-toast')?.textContent).toContain('You are shortlisted for Clerk');

    (el(fixture, '.nb-toast-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(notices.incoming()).toBeNull();
    expect(el(fixture, '.nb-toast')).toBeNull();
  });

  it('reloads an open list when one arrives', () => {
    const fixture = create();
    el(fixture, '.nb-button')!.click();
    fixture.detectChanges();
    const before = calls.filter(x => x[0] === 'list').length;

    notices.arrived.set(1);
    fixture.detectChanges();

    expect(calls.filter(x => x[0] === 'list').length).toBe(before + 1);
  });
});
