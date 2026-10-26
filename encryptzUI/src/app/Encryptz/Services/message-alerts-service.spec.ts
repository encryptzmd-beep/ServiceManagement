import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../Auth/auth-service';
import { PersonalShellComponent } from '../components/personal-shell-component/personal-shell-component';
import { MessageAlertsService } from './message-alerts-service';
import { MessagesService } from './messages-service';
import { NotificationService } from './notification-service';

describe('MessageAlertsService and the Messages line of the menu', () => {
  let unread: Record<string, number>;
  let asked: string[];
  let notices: { arrived: ReturnType<typeof signal<number>>; incoming: ReturnType<typeof signal<any>>; unread: ReturnType<typeof signal<number>>; start: () => void };

  beforeEach(() => {
    unread = { person: 3, company: 0 };
    asked = [];
    notices = { arrived: signal(0), incoming: signal(null), unread: signal(0), start: () => {} };
    TestBed.configureTestingModule({
      imports: [PersonalShellComponent],
      providers: [
        provideRouter([]),
        { provide: MessagesService, useValue: { unread: (side: string) => { asked.push(side); return of({ success: true, message: '', data: unread[side] }); } } },
        { provide: NotificationService, useValue: notices },
        { provide: AuthService, useValue: { userName: () => 'Leema Leo', currentUser: () => ({ individualId: 'EZ-1' }) } },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  const shell = (menu: any[]) => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.componentRef.setInput('appName', 'Job Portal');
    fixture.componentRef.setInput('menu', menu);
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();
    return fixture;
  };

  it('shows the unread messages beside Messages, and nothing for 0', () => {
    const fixture = shell([{ label: 'Search jobs', icon: 'search', route: '/apps/jobs/search' }, { label: 'Messages', icon: 'chat', route: '/apps/jobs/messages' }]);
    const badges = [...fixture.nativeElement.querySelectorAll('.ps-nav-item')].map((a: any) => a.querySelector('.ps-nav-badge')?.textContent.trim() ?? '');

    expect(asked).toEqual(['person']);
    expect(badges).toEqual(['', '3']);
  });

  it('reads the number again when a message notification arrives, not for other notifications', () => {
    const fixture = shell([{ label: 'Messages', icon: 'chat', route: '/consultancy/messages' }]);
    const alerts = TestBed.inject(MessageAlertsService);
    expect(asked).toEqual(['company']);

    notices.incoming.set({ kind: 'Shortlisted' });
    notices.arrived.set(1);
    TestBed.flushEffects();
    expect(asked).toEqual(['company']);

    unread['company'] = 2;
    notices.incoming.set({ kind: 'Message' });
    notices.arrived.set(2);
    TestBed.flushEffects();
    fixture.detectChanges();
    expect(asked).toEqual(['company', 'company']);
    expect(alerts.unread.company()).toBe(2);
    expect(fixture.nativeElement.querySelector('.ps-nav-badge').textContent.trim()).toBe('2');
  });
});
