import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { JobsService } from '../../Services/jobs-service';
import { MessageAlertsService } from '../../Services/message-alerts-service';
import { MessagesService } from '../../Services/messages-service';
import { JobDashboardComponent } from './job-dashboard-component';

describe('JobDashboardComponent', () => {
  const page = (over: any = {}) => ({
    profile: { fullName: 'Leo Joseph', headline: 'Accountant, 5 years', summary: '', city: 'Kochi', contactEmail: '', contactPhone: '', dateOfBirth: '1995-01-01', isVisible: true, isVerified: true },
    experience: [{ experienceId: 1 }], education: [{ educationId: 2 }], skills: [{ skillId: 3 }], certificates: [],
    resume: { fileId: 8, fileName: 'cv.pdf', sizeBytes: 1, uploadedAt: '2026-10-13T10:00:00' },
    completeness: 90,
    ...over,
  });
  const posting = (id: number, over: any = {}) => ({ postingId: id, title: `Job ${id}`, companyName: 'Acme', city: 'Kochi', myStatus: '', isOpen: true, isVerified: false, matchScore: 0, ...over });
  const ok = (data: any) => of({ success: true, message: '', data });

  let api: any;
  let messages: any;
  let watched: string[];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [JobDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: JobsService, useValue: api },
        { provide: MessagesService, useValue: messages },
        { provide: JobAlertsService, useValue: { unread: signal(0), refresh: () => {} } },
        { provide: MessageAlertsService, useValue: { unread: { person: signal(3), company: signal(0) }, watch: (s: string) => watched.push(s) } },
        { provide: AuthService, useValue: { userName: () => 'Leo Joseph', currentUser: () => ({ userId: 11, individualId: 'EZ-7K4M-2P9Q-XD3Q' }) } },
      ],
    });
    const fixture = TestBed.createComponent(JobDashboardComponent);
    fixture.detectChanges();
    return fixture;
  };
  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

  beforeEach(() => {
    watched = [];
    api = {
      getPage: () => ok(page()),
      getPhoto: () => of(null),
      getApplications: () => ok([
        { applicationId: 1, postingId: 5, title: 'Clerk', companyName: 'Beta', status: 'Shortlisted', appliedAt: '2026-10-01T10:00:00', statusAt: '2026-10-20T10:00:00', isOpen: true },
        { applicationId: 2, postingId: 6, title: 'Cashier', companyName: 'Gamma', status: 'Withdrawn', appliedAt: '2026-10-02T10:00:00', statusAt: '2026-10-03T10:00:00', isOpen: true },
      ]),
      getSaved: () => ok([posting(9), posting(10, { isOpen: false })]),
      getProfileViews: () => ok([{ companyName: 'Delta', postingTitle: '', profileViews: 2, resumeViews: 1, lastViewedAt: '2026-10-20T10:00:00' }]),
      searchPostings: () => ok({ items: [posting(1, { matchScore: 4, isVerified: true }), posting(5, { myStatus: 'Applied' }), posting(3)], total: 3 }),
    };
    messages = { list: () => ok([{ conversationId: 4, companyName: 'Beta', lastBody: 'Can you come on Monday?', lastIsJob: false, unread: 2 }]) };
  });

  it('greets the person and shows how strong the profile is', () => {
    const fixture = create();
    expect(fixture.nativeElement.querySelector('h1').textContent).toMatch(/Good (morning|afternoon|evening), Leo/);
    expect(text(fixture)).toContain('Profile strength');
    expect(text(fixture)).toContain('90%');
    expect(fixture.nativeElement.querySelector('.db-banner')).toBeNull(); // visible: nothing to warn about
    expect(fixture.nativeElement.querySelector('.db-sub app-verified-badge')).not.toBeNull();
  });

  it('lists what the profile still lacks, linking to the profile', () => {
    api.getPage = () => ok(page({ resume: null, skills: [], profile: { ...page().profile, isVisible: false } }));
    const fixture = create();
    const tips = Array.from(fixture.nativeElement.querySelectorAll('.db-checklist a')) as HTMLElement[];
    expect(tips.map(t => t.textContent!.trim())).toEqual(['radio_button_uncheckedUpload your resume', 'radio_button_uncheckedAdd your skills', 'radio_button_uncheckedLet employers find you']);
    expect(tips[0].getAttribute('href')).toBe('/apps/jobs/profile');
    expect(text(fixture)).toContain('Employers cannot find you');
  });

  it('counts open saved jobs, unread messages and views', () => {
    const fixture = create();
    const tiles = (Array.from(fixture.nativeElement.querySelectorAll('.db-stat strong')) as HTMLElement[]).map(e => e.textContent!.trim());
    expect(tiles).toEqual(['1', '3', '3']);
    expect(text(fixture)).toContain('by 1 company');
    expect(watched).toContain('person');
  });

  it('shows the applications by state as small cards (not withdrawn ones), interviews to come counted apart', () => {
    const soon = new Date(Date.now() + 2 * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const at = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T10:30:00`;
    api.getApplications = () => ok([
      { applicationId: 1, postingId: 5, title: 'Clerk', companyName: 'Beta', status: 'Shortlisted', appliedAt: '2026-10-01T10:00:00', statusAt: '2026-10-20T10:00:00', isOpen: true,
        interviewAt: at, interviewMode: 'Video', interviewPlace: 'https://meet.example.com/abc', interviewNote: 'Keep your certificates ready' },
      { applicationId: 2, postingId: 6, title: 'Cashier', companyName: 'Gamma', status: 'Rejected', appliedAt: '2026-10-02T10:00:00', statusAt: '2026-10-03T10:00:00', isOpen: true,
        rejectReason: 'The job needs three years of GST filing' },
      { applicationId: 3, postingId: 7, title: 'Typist', companyName: 'Delta', status: 'Applied', appliedAt: '2026-10-04T10:00:00', statusAt: '2026-10-04T10:00:00', isOpen: true },
      { applicationId: 4, postingId: 8, title: 'Driver', companyName: 'Eps', status: 'Withdrawn', appliedAt: '2026-10-05T10:00:00', statusAt: '2026-10-05T10:00:00', isOpen: true },
    ]);
    const fixture = create();

    const cards = (Array.from(fixture.nativeElement.querySelectorAll('.db-kpi')) as HTMLElement[])
      .map(c => `${c.querySelector('span:last-child')!.textContent!.trim()} ${c.querySelector('strong')!.textContent!.trim()}`);
    expect(cards).toEqual(['Applied 1', 'Shortlisted 1', 'Interviews 1', 'Hired 0', 'Not selected 1']);
    expect(fixture.nativeElement.querySelector('.db-kpi').getAttribute('href')).toBe('/apps/jobs/applications');

    const interview = fixture.nativeElement.querySelector('.db-interview');
    expect(interview.textContent).toContain('10:30 AM');
    expect(interview.textContent).toContain('Clerk');
    expect(interview.textContent).toContain('Keep your certificates ready');
    expect(interview.querySelector('a.db-join').getAttribute('href')).toBe('https://meet.example.com/abc');

    expect(fixture.nativeElement.querySelector('.db-reason').textContent).toContain('three years of GST filing');
  });

  it('shows no interview card when the interview is past or the application is closed', () => {
    api.getApplications = () => ok([
      { applicationId: 1, postingId: 5, title: 'Clerk', companyName: 'Beta', status: 'Shortlisted', appliedAt: '2026-01-01T10:00:00', statusAt: '2026-01-02T10:00:00', isOpen: true,
        interviewAt: '2026-01-05T10:00:00', interviewMode: 'In person', interviewPlace: 'MG Road' },
      { applicationId: 2, postingId: 6, title: 'Cashier', companyName: 'Gamma', status: 'Hired', appliedAt: '2026-01-01T10:00:00', statusAt: '2026-01-09T10:00:00', isOpen: true,
        interviewAt: '2099-01-05T10:00:00', interviewMode: 'In person', interviewPlace: 'MG Road' },
    ]);
    const fixture = create();
    expect(fixture.nativeElement.querySelector('.db-interview')).toBeNull();
  });

  it('suggests jobs not applied to yet, and shows the latest applications, messages and views', () => {
    const fixture = create();
    const jobs = Array.from(fixture.nativeElement.querySelectorAll('.db-job')) as HTMLElement[];
    expect(jobs.map(j => j.getAttribute('href'))).toEqual(['/apps/jobs/job/1', '/apps/jobs/job/3']);
    expect(jobs[0].textContent).toContain('Matches your preferences');
    expect(text(fixture)).toContain('Clerk');
    expect(text(fixture)).toContain('Shortlisted');
    expect(text(fixture)).toContain('Can you come on Monday?');
    expect(fixture.nativeElement.querySelector('.db-message.unread').getAttribute('href')).toBe('/apps/jobs/messages?c=4');
    expect(text(fixture)).toContain('Delta');
  });

  it('still shows the page when a part cannot be read', () => {
    api.getApplications = () => throwError(() => new Error('down'));
    messages.list = () => throwError(() => new Error('down'));
    const fixture = create();
    expect(text(fixture)).toContain('You have not applied yet');
    expect(text(fixture)).toContain('No messages yet');
    expect(text(fixture)).toContain('Profile strength');
  });

  it('says so when Job Portal cannot be loaded', () => {
    api.getPage = () => of({ success: false, message: 'Job Portal is switched off', data: null });
    const fixture = create();
    expect(text(fixture)).toContain('Job Portal is switched off');
    expect(fixture.nativeElement.querySelector('.db-head')).toBeNull();
  });
});
