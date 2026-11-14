import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { CompanyJobsService } from '../../Services/company-jobs-service';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { JobsService } from '../../Services/jobs-service';
import { MessagesService } from '../../Services/messages-service';
import { NotificationService } from '../../Services/notification-service';
import { MessagesComponent } from './messages-component';

describe('MessagesComponent', () => {
  const ok = (data: any = true, message = 'Done') => of({ success: true, message, data });
  const summary = (over: any = {}) => ({
    conversationId: 5, companyName: 'ACCOUNTZ ENCRYPTZ', candidateKey: null, fullName: '', headline: '', isVerified: false,
    postingTitle: 'Accountant', lastMessageAt: '2026-10-25T10:00:00', lastBody: 'Can you come on Monday?', lastFromSide: 'Company',
    lastIsJob: false, unread: 2, blockedByPerson: false, ...over,
  });
  const conversation = (over: any = {}) => ({
    conversationId: 5, companyName: 'ACCOUNTZ ENCRYPTZ', candidateKey: null, fullName: 'Leema Leo', headline: 'Accountant', city: 'Kochi',
    isVerified: false, postingId: 7, postingTitle: 'Accountant', blockedByPerson: false, otherReadAt: '2026-10-25T10:05:00',
    messages: [
      { messageId: 1, fromSide: 'Company', senderName: 'Anu (HR)', body: 'Can you come on Monday?', createdAt: '2026-10-25T09:00:00', sharedPosting: null },
      { messageId: 2, fromSide: 'Person', senderName: 'Leema Leo', body: 'Yes, at 10.', createdAt: '2026-10-25T10:00:00',
        sharedPosting: { postingId: 9, title: 'Site engineer', companyName: 'Encryptz', city: 'Kochi', isOpen: true } },
    ],
    ...over,
  });

  let calls: any[][];
  let api: any;

  const create = (side: 'person' | 'company', query: Record<string, string> = {}) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MessagesComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { side } }, queryParamMap: of(convertToParamMap(query)) } },
        { provide: MessagesService, useValue: api },
        { provide: JobsService, useValue: { getSaved: () => ok([{ postingId: 9, title: 'Site engineer', city: 'Kochi', isOpen: true }, { postingId: 3, title: 'Old', city: 'X', isOpen: false }]) } },
        { provide: CompanyJobsService, useValue: { getPostings: () => ok([{ postingId: 7, title: 'Accountant', city: 'Kochi', status: 'Open' }, { postingId: 8, title: 'Draft', city: 'Kochi', status: 'Draft' }]) } },
        { provide: NotificationService, useValue: { arrived: signal(0), incoming: signal(null), unread: signal(0), start: () => {} } },
        { provide: JobAlertsService, useValue: { unread: signal(0), refresh: () => {} } },
        { provide: AuthService, useValue: { userName: () => 'Leema Leo', currentUser: () => ({ userId: 11, individualId: 'EZ-1' }) } },
      ],
    });
    const fixture = TestBed.createComponent(MessagesComponent);
    fixture.detectChanges();
    return fixture;
  };
  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

  beforeEach(() => {
    calls = [];
    api = {
      list: (side: string) => { calls.push(['list', side]); return ok([summary()]); },
      get: (side: string, id: number) => { calls.push(['get', side, id]); return ok(conversation()); },
      send: (side: string, id: number, m: any) => { calls.push(['send', side, id, m]); return ok(3, 'Sent'); },
      block: (id: number, blocked: boolean) => { calls.push(['block', id, blocked]); return ok(true, 'Blocked'); },
    };
  });

  afterEach(() => TestBed.resetTestingModule());

  it('lists the conversations with the other side, the job, the last message and the unread count', () => {
    const fixture = create('person');

    expect(calls).toContainEqual(['list', 'person']);
    const item = fixture.nativeElement.querySelector('.ms-item');
    expect(item.textContent).toContain('ACCOUNTZ ENCRYPTZ');
    expect(item.textContent).toContain('Accountant');
    expect(item.textContent).toContain('Can you come on Monday?');
    expect(item.querySelector('.ms-badge').textContent.trim()).toBe('2');
  });

  it('opens the conversation of ?c=, mine on the right, the shared job as a card, and Seen', () => {
    const fixture = create('person', { c: '5' });
    fixture.detectChanges();

    expect(calls).toContainEqual(['get', 'person', 5]);
    const bubbles = [...fixture.nativeElement.querySelectorAll('.ms-msg')] as HTMLElement[];
    expect(bubbles.map(b => b.classList.contains('mine'))).toEqual([false, true]);
    expect(fixture.nativeElement.querySelector('.ms-job').getAttribute('href')).toBe('/apps/jobs/job/9');
    expect(text(fixture)).toContain('Seen');
    // it is read now
    expect(fixture.componentInstance.conversations()[0].unread).toBe(0);
  });

  it('sends with Enter, not with Shift+Enter, and with a shared job', () => {
    const fixture = create('person', { c: '5' });
    const c = fixture.componentInstance;

    c.draft = 'Thank you';
    c.onKey(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(calls.some(x => x[0] === 'send')).toBe(false);

    c.attach({ postingId: 9, title: 'Site engineer', city: 'Kochi' });
    c.onKey(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(calls).toContainEqual(['send', 'person', 5, { body: 'Thank you', sharePostingId: 9 }]);
    expect(c.draft).toBe('');
    expect(c.attached()).toBeNull();
  });

  it('offers the person their open saved jobs and the company its open jobs to share', () => {
    const person = create('person', { c: '5' }).componentInstance;
    person.togglePicker();
    expect(person.shareable()!.map(j => j.postingId)).toEqual([9]);

    const company = create('company', { c: '5' }).componentInstance;
    company.togglePicker();
    expect(company.shareable()!.map(j => j.postingId)).toEqual([7]);
  });

  it('shows the company that the person blocked it, and lets it not write', () => {
    api.get = () => ok(conversation({ blockedByPerson: true }));
    const fixture = create('company', { c: '5' });
    fixture.detectChanges();

    expect(text(fixture)).toContain('does not take messages from your company');
    expect(fixture.nativeElement.querySelector('.ms-compose')).toBeNull();
    fixture.componentInstance.draft = 'Hello';
    fixture.componentInstance.send();
    expect(calls.some(x => x[0] === 'send')).toBe(false);
  });
});
