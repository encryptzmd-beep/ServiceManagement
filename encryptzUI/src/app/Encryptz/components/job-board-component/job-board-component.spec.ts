import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { JobsService } from '../../Services/jobs-service';
import { JobBoardComponent, JobBoardMode } from './job-board-component';

describe('JobBoardComponent', () => {
  const posting = (over: any = {}) => ({
    postingId: 7, title: 'Accountant', companyName: 'Hamster A/C', city: 'Kochi', employmentType: 'Full-time', workMode: 'Hybrid',
    experienceMinYears: 1, experienceMaxYears: 3, salaryMin: 20000, salaryMax: 30000, skills: 'Tally, GST', description: '',
    publishedAt: '2026-10-10T09:00:00', closesOn: '2026-11-30T00:00:00', isSaved: false, myStatus: '', isOpen: true, ...over,
  });
  const application = (over: any = {}) => ({
    applicationId: 31, postingId: 7, title: 'Accountant', companyName: 'Hamster A/C', city: 'Kochi', employmentType: 'Full-time',
    workMode: 'Hybrid', status: 'Shortlisted', note: '', appliedAt: '2026-10-11T10:00:00', statusAt: '2026-10-12T10:00:00', isOpen: true, ...over,
  });

  let api: any;
  let alerts: { unread: ReturnType<typeof signal<number>>; refresh: () => void; refreshed: number };
  let calls: any[][];

  const create = (mode: JobBoardMode) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [JobBoardComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { mode } } } },
        { provide: JobsService, useValue: api },
        { provide: JobAlertsService, useValue: alerts },
        { provide: AuthService, useValue: { userName: () => 'Leo Joseph', currentUser: () => ({ userId: 11, individualId: 'EZ-7K4M-2P9Q-XD3Q' }) } },
      ],
    });
    const fixture = TestBed.createComponent(JobBoardComponent);
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const ok = (data: any = true, message = 'Done') => of({ success: true, message, data });
  const refused = (message: string) => of({ success: false, message, data: null });

  beforeEach(() => {
    alerts = { unread: signal(0), refreshed: 0, refresh: () => { alerts.refreshed++; } };
    calls = [];
    api = {
      searchPostings: (f: any) => { calls.push(['searchPostings', { ...f }]); return ok({ items: [posting(), posting({ postingId: 8, title: 'Site Engineer', myStatus: 'Applied', isSaved: true })], total: 45, page: f.page, pageSize: 20 }); },
      getPosting: (id: number) => { calls.push(['getPosting', id]); return ok(posting({ postingId: id, description: 'Books of three branches.' })); },
      apply: (id: number, note: string) => { calls.push(['apply', id, note]); return ok(31, 'Application sent'); },
      setSaved: (id: number, saved: boolean) => { calls.push(['setSaved', id, saved]); return ok(true, saved ? 'Job saved' : 'Removed from saved jobs'); },
      getApplications: () => { calls.push(['getApplications']); return ok([application(), application({ applicationId: 32, title: 'Clerk', status: 'Withdrawn' })]); },
      withdraw: (id: number) => { calls.push(['withdraw', id]); return ok(true, 'Application withdrawn'); },
      getSaved: () => { calls.push(['getSaved']); return ok([posting({ isSaved: true }), posting({ postingId: 9, title: 'Old job', isSaved: true, isOpen: false })]); },
    };
  });

  // ── search ────────────────────────────────────────────────────────────────

  it('lists the jobs with company, place, experience, salary and skills', () => {
    const t = text(create('search'));

    expect(t).toContain('Search jobs');
    expect(t).toContain('Accountant');
    expect(t).toContain('Hamster A/C');
    expect(t).toContain('Kochi');
    expect(t).toContain('1 – 3 years');
    expect(t).toContain('₹20,000 – ₹30,000 per month');
    expect(t).toContain('Tally');
    expect(t).toContain('Apply by 30 Nov 2026');
    expect(t).toContain('45');
  });

  it('marks a job the person applied to and does not offer Apply for it again', () => {
    const fixture = create('search');
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.jb-card')) as HTMLElement[];
    const buttons = (card: HTMLElement) => Array.from(card.querySelectorAll('button')).map(b => b.textContent!.replace(/\s+/g, ' ').trim());

    expect(buttons(cards[0])).toContain('Apply');
    expect(buttons(cards[1])).not.toContain('Apply');
    expect(cards[1].querySelector('.jb-status')!.textContent).toContain('Applied');
    expect(buttons(cards[1]).some(b => b.endsWith('Saved'))).toBe(true);
  });

  it('searches with what is typed, from the first page', () => {
    const fixture = create('search');
    const c = fixture.componentInstance;

    c.filter.page = 3;
    Object.assign(c.filter, { q: ' tally ', city: 'Kochi', type: 'Full-time', mode: 'Remote' });
    c.search();

    expect(calls.at(-1)).toEqual(['searchPostings', { q: ' tally ', city: 'Kochi', type: 'Full-time', mode: 'Remote', page: 1, sort: 'match' }]);
  });

  it('puts the best match first by default, and the newest when asked, from the first page', () => {
    const fixture = create('search');
    const c = fixture.componentInstance;

    expect(calls[0][1].sort).toBe('match');
    c.filter.page = 2;
    c.setSort('newest');
    expect(calls.at(-1)![1]).toEqual(expect.objectContaining({ sort: 'newest', page: 1 }));

    const before = calls.length;
    c.setSort('newest');
    expect(calls.length).toBe(before);
  });

  it('marks a job that matches the preferences, and otherwise says how to get matches', () => {
    api.searchPostings = () => ok({ items: [posting({ matchScore: 5 }), posting({ postingId: 8, title: 'Site Engineer', matchScore: 0 })], total: 2, page: 1, pageSize: 20 });
    let fixture = create('search');
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.jb-card')) as HTMLElement[];

    expect(cards[0].textContent).toContain('Matches your preferences');
    expect(cards[1].textContent).not.toContain('Matches your preferences');
    expect(fixture.nativeElement.querySelector('.jb-hint')).toBeNull();

    api.searchPostings = () => ok({ items: [posting()], total: 1, page: 1, pageSize: 20 });
    fixture = create('search');
    expect(fixture.nativeElement.querySelector('.jb-hint a').getAttribute('href')).toBe('/apps/jobs');
  });

  it('moves between the pages and not beyond them', () => {
    const fixture = create('search');
    const c = fixture.componentInstance;

    expect(c.lastPage).toBe(3);
    c.goToPage(2);
    expect(calls.at(-1)![1].page).toBe(2);

    const before = calls.length;
    c.goToPage(4);
    c.goToPage(0);
    expect(calls.length).toBe(before);
  });

  it('says so when nothing matches, and offers to show all jobs', () => {
    const fixture = create('search');
    api.searchPostings = () => ok({ items: [], total: 0, page: 1, pageSize: 20 });
    fixture.componentInstance.filter.q = 'zzz';
    fixture.componentInstance.search();
    fixture.detectChanges();

    expect(text(fixture)).toContain('No job matches this search');
  });

  // ── one job, save, apply ──────────────────────────────────────────────────

  it('opens a job on its own page in a new tab, not in a popup', () => {
    const fixture = create('search');
    const link = fixture.nativeElement.querySelector('.jb-card h2 a.jb-title') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/apps/jobs/job/7');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(fixture.nativeElement.querySelector('.jb-detail')).toBeNull();
  });

  it('saves and unsaves a job through the API and shows it', () => {
    const fixture = create('search');
    const c = fixture.componentInstance;

    c.toggleSave(c.postings()[0]);
    expect(calls).toContainEqual(['setSaved', 7, true]);
    expect(c.postings()[0].isSaved).toBe(true);

    c.toggleSave(c.postings()[0]);
    expect(calls).toContainEqual(['setSaved', 7, false]);
    expect(c.postings()[0].isSaved).toBe(false);
  });

  it('tells before applying what the company will see, and sends the note', () => {
    const fixture = create('search');
    const c = fixture.componentInstance;

    c.startApply(c.postings()[0]);
    fixture.detectChanges();
    const t = text(fixture);
    expect(t).toContain('Hamster A/C can see your profile');
    expect(t).toContain('It ends when you withdraw the application');

    c.applyNote = '  I can start in November ';
    c.sendApply();
    fixture.detectChanges();

    expect(calls).toContainEqual(['apply', 7, 'I can start in November']);
    expect(c.applyFor()).toBeNull();
    expect(c.postings()[0].myStatus).toBe('Applied');
  });

  it('keeps the dialog open with the reason and the way to the profile when the profile is not ready', () => {
    api.apply = () => refused('Add your name and a headline to your profile before you apply');
    const fixture = create('search');
    const c = fixture.componentInstance;

    c.startApply(c.postings()[0]);
    c.sendApply();
    fixture.detectChanges();

    expect(c.applyFor()).not.toBeNull();
    expect(text(fixture)).toContain('Add your name and a headline to your profile before you apply');
    expect(fixture.nativeElement.querySelector('a.jb-link').getAttribute('href')).toBe('/apps/jobs');
    expect(c.postings()[0].myStatus).toBe('');
  });

  it('does not start an application for a closed job or one already applied to', () => {
    const fixture = create('search');
    const c = fixture.componentInstance;

    c.startApply(c.postings()[1]);                       // already applied
    c.startApply(posting({ isOpen: false }) as any);     // closed
    expect(c.applyFor()).toBeNull();

    c.startApply(posting({ myStatus: 'Withdrawn' }) as any);   // may apply again
    expect(c.applyFor()).not.toBeNull();
  });

  it('sends an application once while the answer is on the way, and keeps the dialog', () => {
    const pending = new Subject<any>();
    let sent = 0;
    api.apply = () => { sent++; return pending; };
    const fixture = create('search');
    const c = fixture.componentInstance;

    c.startApply(c.postings()[0]);
    c.sendApply();
    c.sendApply();
    c.cancelApply();

    expect(sent).toBe(1);
    expect(c.applyFor()).not.toBeNull();
  });

  it('reads the list again when the answer to an application is lost', () => {
    api.apply = () => throwError(() => ({ status: 0 }));
    const fixture = create('search');
    const c = fixture.componentInstance;

    c.startApply(c.postings()[0]);
    c.sendApply();

    expect(c.applyError()).toBe('Could not send the application. Please try again');
    expect(calls.filter(x => x[0] === 'searchPostings').length).toBe(2);
  });

  // ── my applications ───────────────────────────────────────────────────────

  it('lists the applications with their state, and offers Withdraw unless withdrawn', () => {
    const fixture = create('applications');
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.jb-card')) as HTMLElement[];

    expect(text(fixture)).toContain('My applications');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Shortlisted');
    expect(cards[0].textContent).toContain('Applied 11 Oct 2026');
    expect(cards[0].textContent).toContain('Withdraw');
    expect(cards[1].querySelector('.jp-btn')).toBeNull();
    expect(fixture.nativeElement.querySelector('.jb-search')).toBeNull();
  });

  it('withdraws only after the person confirmed, naming the company', () => {
    const fixture = create('applications');
    const c = fixture.componentInstance;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    c.withdraw(c.applications()[0]);
    expect(calls.some(x => x[0] === 'withdraw')).toBe(false);
    expect(confirmSpy.mock.calls[0][0]).toContain('Hamster A/C will no longer see your profile');

    confirmSpy.mockReturnValue(true);
    c.withdraw(c.applications()[0]);
    expect(calls).toContainEqual(['withdraw', 31]);
    expect(calls.filter(x => x[0] === 'getApplications').length).toBe(2);
    confirmSpy.mockRestore();
  });

  it('points to the search when there are no applications', () => {
    api.getApplications = () => ok([]);
    const fixture = create('applications');

    expect(text(fixture)).toContain('You have not applied to a job yet');
    expect(fixture.nativeElement.querySelector('.jb-empty a').getAttribute('href')).toBe('/apps/jobs/search');
  });

  // ── saved jobs ────────────────────────────────────────────────────────────

  it('lists the saved jobs, says which no longer take applications, and drops one that is unsaved', () => {
    const fixture = create('saved');
    const c = fixture.componentInstance;

    expect(text(fixture)).toContain('Saved jobs');
    expect(text(fixture)).toContain('No longer takes applications');
    expect(c.postings().length).toBe(2);

    c.toggleSave(c.postings()[1]);
    expect(calls).toContainEqual(['setSaved', 9, false]);
    expect(c.postings().map(p => p.postingId)).toEqual([7]);
  });

  // ── not available ─────────────────────────────────────────────────────────

  it('says so when the application is not available, and when the API cannot be reached', () => {
    api.searchPostings = () => refused('This application is not available right now');
    expect(text(create('search'))).toContain('This application is not available right now');

    api.getApplications = () => throwError(() => ({ status: 0 }));
    expect(text(create('applications'))).toContain('Job Portal could not be loaded. Please try again.');
  });

  it('labels experience and salary whatever part of the range is given', () => {
    const c = create('search').componentInstance;

    expect(c.experienceLabel({ experienceMinYears: 0, experienceMaxYears: null })).toBe('Freshers welcome');
    expect(c.experienceLabel({ experienceMinYears: 2, experienceMaxYears: null })).toBe('2+ years');
    expect(c.experienceLabel({ experienceMinYears: null, experienceMaxYears: 5 })).toBe('Up to 5 years');
    expect(c.experienceLabel({ experienceMinYears: 1, experienceMaxYears: 1 })).toBe('1 year');
    expect(c.experienceLabel({})).toBe('');
    expect(c.salaryLabel({ salaryMin: 150000, salaryMax: null })).toBe('From ₹1,50,000 per month');
    expect(c.salaryLabel({ salaryMin: null, salaryMax: 30000 })).toBe('Up to ₹30,000 per month');
    expect(c.salaryLabel({})).toBe('');
  });
});
