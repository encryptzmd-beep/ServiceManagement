import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../Auth/auth-service';
import { AppNotification, NotificationService, appLabel, safeLink } from './notification-service';

/** A hub that records what is done with it; `emit` plays a message of the API. */
const fakeHub = (fails = false) => {
  const handlers: Record<string, (n: any) => void> = {};
  return {
    handlers,
    started: 0,
    stopped: 0,
    on(name: string, fn: (n: any) => void) { handlers[name] = fn; },
    start() { this.started++; return fails ? Promise.reject(new Error('no')) : Promise.resolve(); },
    stop() { this.stopped++; return Promise.resolve(); },
    emit(name: string, n: any) { handlers[name]?.(n); },
  };
};

@Injectable()
class TestNotifications extends NotificationService {
  hubs: ReturnType<typeof fakeHub>[] = [];
  failing = false;
  protected override async connect(): Promise<any> {
    const hub = fakeHub(this.failing);
    this.hubs.push(hub);
    return hub;
  }
}

/** Lets the promises of a connection settle. */
const settle = () => new Promise(resolve => setTimeout(resolve));

describe('NotificationService', () => {
  let http: HttpTestingController;
  let token: string | null;
  let loggedIn: ReturnType<typeof signal<boolean>>;

  const note = (over: Partial<AppNotification> = {}): AppNotification => ({
    notificationId: 7, app: 'JOBPORTAL', kind: 'Shortlisted', title: 'You are shortlisted for Clerk', body: 'Felix · Clerk',
    link: '/apps/jobs/applications', companyId: null, createdAt: '2026-10-14T10:00:00', isRead: false, ...over,
  });

  const create = (): TestNotifications => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthService, useValue: { isLoggedIn: () => loggedIn(), getToken: () => token } },
        { provide: NotificationService, useClass: TestNotifications },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(NotificationService) as TestNotifications;
  };

  beforeEach(() => {
    token = 'jwt';
    loggedIn = signal(true);
  });

  it('opens only a page of this site', () => {
    expect(safeLink('/apps/jobs/search?posting=4')).toBe('/apps/jobs/search?posting=4');
    expect(safeLink('//evil.example/x')).toBe('');
    expect(safeLink('/\\evil.example')).toBe('');
    expect(safeLink('https://evil.example')).toBe('');
    expect(safeLink('javascript:alert(1)')).toBe('');
    expect(safeLink(null)).toBe('');
  });

  it('names the application', () => {
    expect(appLabel('JOBPORTAL')).toBe('Job Portal');
    expect(appLabel('JOBCONSULTANCY')).toBe('Job Consultancy');
    expect(appLabel('PLATFORM')).toBe('Platform');
    expect(appLabel('SERVICE')).toBe('Service');
  });

  it('listens once, and reads the number of unread on every start', async () => {
    const s = create();

    s.start();
    s.start();
    await settle();

    expect(s.hubs.length).toBe(1);
    expect(s.hubs[0].started).toBe(1);
    const reads = http.match(r => r.url.endsWith('/api/notifications'));
    expect(reads.length).toBe(2);
    reads[1].flush({ success: true, message: '', data: { items: [], unread: 4 } });
    expect(s.unread()).toBe(4);
  });

  it('does nothing without a login', () => {
    token = null;
    const s = create();

    s.start();

    expect(s.hubs.length).toBe(0);
    http.expectNone(() => true);
  });

  it('counts what arrives and shows it, with a link of this site only', async () => {
    const s = create();
    s.start();
    await settle();
    http.match(() => true).forEach(r => r.flush({ success: true, message: '', data: { items: [], unread: 1 } }));

    s.hubs[0].emit('notification', note({ link: '//evil.example' }));

    expect(s.unread()).toBe(2);
    expect(s.incoming()?.title).toBe('You are shortlisted for Clerk');
    expect(s.incoming()?.link).toBe('');
    expect(s.arrived()).toBe(1);
  });

  it('takes the number of unread from marking as read', () => {
    const s = create();
    s.unread.set(3);

    s.markRead(7).subscribe();
    const req = http.expectOne(r => r.url.endsWith('/api/notifications/read'));
    expect(req.request.body).toEqual({ notificationId: 7 });
    req.flush({ success: true, message: '', data: 2 });

    expect(s.unread()).toBe(2);
  });

  it('stops listening on logout', async () => {
    const s = create();
    s.start();
    await settle();
    TestBed.tick();

    loggedIn.set(false);
    TestBed.tick();

    expect(s.hubs[0].stopped).toBe(1);
    expect(s.unread()).toBe(0);
  });

  it('tries again on the next page when the connection could not be made', async () => {
    const s = create();
    s.failing = true;
    s.start();
    await settle();

    s.failing = false;
    s.start();
    await settle();

    expect(s.hubs.length).toBe(2);
  });
});
