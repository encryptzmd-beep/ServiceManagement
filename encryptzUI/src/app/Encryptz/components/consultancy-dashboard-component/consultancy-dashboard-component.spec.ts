import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { CompanyJobsService } from '../../Services/company-jobs-service';
import { ConsultancyService } from '../../Services/consultancy-service';
import { MessageAlertsService } from '../../Services/message-alerts-service';
import { ConsultancyDashboardComponent } from './consultancy-dashboard-component';

describe('ConsultancyDashboardComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  const posting = (id: number, over: any = {}) => ({
    postingId: id, title: `Job ${id}`, city: 'Kochi', status: 'Open', applied: 0, shortlisted: 0, rejected: 0, hired: 0, isVerified: false, ...over,
  });

  let jobs: any;
  let consultancy: any;
  let companyId: number | null;
  let watched: string[];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConsultancyDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: CompanyJobsService, useValue: jobs },
        { provide: ConsultancyService, useValue: consultancy },
        { provide: MessageAlertsService, useValue: { unread: { person: signal(0), company: signal(4) }, watch: (s: string) => watched.push(s) } },
        { provide: AuthService, useValue: {
          userName: () => 'Anu Mathew',
          scopeState: () => ({ loggedIn: true, companyId, moduleKey: 'JOBCONSULTANCY', locationId: null }),
          currentUser: () => ({ userId: 3 }),
        } },
      ],
    });
    const fixture = TestBed.createComponent(ConsultancyDashboardComponent);
    fixture.detectChanges();
    return fixture;
  };
  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const card = (fixture: any, key: string) => fixture.nativeElement.querySelector(`.db-kpi[data-state="${key}"]`) as HTMLElement;

  beforeEach(() => {
    companyId = 2;
    watched = [];
    jobs = {
      getPostings: () => ok([
        posting(1, { applied: 2, shortlisted: 1 }),
        posting(2, { applied: 7, shortlisted: 3, hired: 1, isVerified: true }),
        posting(3, { status: 'InReview' }),
        posting(4, { status: 'Draft' }),
      ]),
      getDashboard: () => ok({
        interviews: [{ applicationId: 11, postingId: 2, postingTitle: 'Job 2', fullName: 'Leo Joseph', interviewAt: '2026-11-02T10:30:00', interviewMode: 'Video', interviewPlace: '' }],
        latest: [{ applicationId: 12, postingId: 1, postingTitle: 'Job 1', fullName: 'Mira Das', headline: 'Clerk', status: 'Applied', appliedAt: '2026-10-26T09:00:00', isVerified: true }],
        newThisWeek: 5, interviewsThisWeek: 1, hiredThisMonth: 2, rejectedThisMonth: 3,
      }),
    };
    consultancy = {
      getPlacements: () => ok({ items: [], thisMonth: 1, total: 9, feeOutstanding: 125000, feePaidThisYear: 400000 }),
      getClients: () => ok([{ clientId: 1, isActive: true }, { clientId: 2, isActive: false }, { clientId: 3, isActive: true }]),
      getOwnCandidates: () => ok({ items: [], total: 42, page: 1, pageSize: 20 }),
      getPostingMatchCounts: () => ok([{ postingId: 2, suitable: 6 }]),
    };
  });

  it('greets the person and offers the main actions', () => {
    const fixture = create();
    expect(fixture.nativeElement.querySelector('h1').textContent).toMatch(/Good (morning|afternoon|evening), Anu/);
    const hrefs = (Array.from(fixture.nativeElement.querySelectorAll('.cd-actions a')) as HTMLElement[]).map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['/consultancy/candidates', '/consultancy/our-candidates?add=1', '/consultancy/postings?new=1']);
  });

  it('shows small cards: jobs, applicants, interviews, hires, placements, fees and messages', () => {
    const fixture = create();
    expect(card(fixture, 'jobs').querySelector('strong')!.textContent!.trim()).toBe('2');
    expect(card(fixture, 'jobs').textContent).toContain('1 in review · 1 drafts');
    expect(card(fixture, 'new').querySelector('strong')!.textContent!.trim()).toBe('5');
    expect(card(fixture, 'shortlisted').querySelector('strong')!.textContent!.trim()).toBe('4');
    expect(card(fixture, 'interview').querySelector('strong')!.textContent!.trim()).toBe('1');
    expect(card(fixture, 'hired').querySelector('strong')!.textContent!.trim()).toBe('2');
    expect(card(fixture, 'placements').querySelector('strong')!.textContent!.trim()).toBe('1');
    expect(card(fixture, 'fees').querySelector('strong')!.textContent!.trim()).toBe('₹1,25,000');
    expect(card(fixture, 'messages').querySelector('strong')!.textContent!.trim()).toBe('4');
    expect(card(fixture, 'messages').getAttribute('href')).toBe('/consultancy/messages');
    expect(watched).toContain('company');
  });

  it('lists coming interviews, latest applicants and the busiest open jobs, each opening the job', () => {
    const fixture = create();
    expect(text(fixture)).toContain('Leo Joseph');
    expect(text(fixture)).toContain('10:30 AM · Video');
    expect(text(fixture)).toContain('Mira Das');

    const jobLinks = (Array.from(fixture.nativeElement.querySelectorAll('.cd-job')) as HTMLElement[]).map(a => a.getAttribute('href'));
    expect(jobLinks).toEqual(['/consultancy/postings?job=2', '/consultancy/postings?job=1']);
    expect(fixture.nativeElement.querySelector('.cd-job').textContent).toContain('6 suitable candidates');
    const business = (Array.from(fixture.nativeElement.querySelectorAll('.db-stat')) as HTMLElement[])
      .map(e => e.querySelector('.db-stat-label')!.firstChild!.textContent!.trim() + ' ' + e.querySelector('strong')!.textContent!.trim());
    expect(business).toEqual(['Active clients 2', 'Your own candidates 42', 'Placements 9']);
    expect(text(fixture)).toContain('3 applications were rejected this month');
  });

  it('still shows the page when a part cannot be read', () => {
    jobs.getDashboard = () => throwError(() => new Error('down'));
    consultancy.getPlacements = () => throwError(() => new Error('down'));
    const fixture = create();
    expect(text(fixture)).toContain('No interview in the next 30 days');
    expect(card(fixture, 'fees').querySelector('strong')!.textContent!.trim()).toBe('–');
    expect(card(fixture, 'jobs').querySelector('strong')!.textContent!.trim()).toBe('2');
  });

  it('says so when the company may not use Job Consultancy', () => {
    jobs.getPostings = () => throwError(() => ({ status: 403, error: { message: 'Job Consultancy is not part of your plan' } }));
    const fixture = create();
    expect(text(fixture)).toContain('Job Consultancy is not part of your plan');
    expect(fixture.nativeElement.querySelector('.db-kpis')).toBeNull();
  });

  it('goes back to the companies when no company is chosen, and asks the API nothing', () => {
    companyId = null;
    let asked = 0;
    jobs.getPostings = () => { asked++; return ok([]); };
    const fixture = create();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.ngOnInit();

    expect(navigate).toHaveBeenCalledWith(['/select-company']);
    expect(asked).toBe(0);
  });
});
