import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { JobsService } from '../../Services/jobs-service';
import { PublicJobsService } from '../../Services/public-jobs-service';
import { JobDetailComponent } from './job-detail-component';

describe('JobDetailComponent', () => {
  const posting = (over: any = {}) => ({
    postingId: 7, title: 'Site supervisor', companyName: 'Encryptz ERP', city: 'Chalakudy', employmentType: 'Full-time', workMode: 'On-site',
    experienceMinYears: 3, experienceMaxYears: 5, salaryMin: 25000, salaryMax: 35000, skills: 'AutoCAD, BOQ Preparation',
    description: 'Oversee daily construction activities.', publishedAt: '2026-10-20', closesOn: null,
    isSaved: false, myStatus: '', isOpen: true, isVerified: true, ...over,
  });
  const ok = (data: any = true, message = 'Done') => of({ success: true, message, data });

  let calls: any[][];
  let api: any;

  const create = (query: Record<string, string> = {}) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [JobDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })), snapshot: { queryParamMap: convertToParamMap(query) } } },
        { provide: JobsService, useValue: api },
        { provide: PublicJobsService, useValue: { related: (id: number) => { calls.push(['related', id]); return ok([posting(), posting({ postingId: 9, title: 'Site engineer', isVerified: false })]); } } },
        { provide: JobAlertsService, useValue: { unread: signal(0), refresh: () => {} } },
        { provide: AuthService, useValue: { userName: () => 'Leema Leo', currentUser: () => ({ userId: 11, individualId: 'EZ-1' }) } },
      ],
    });
    const fixture = TestBed.createComponent(JobDetailComponent);
    fixture.detectChanges();
    return fixture;
  };
  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

  beforeEach(() => {
    calls = [];
    api = {
      getPosting: (id: number) => { calls.push(['getPosting', id]); return ok(posting()); },
      setSaved: (id: number, saved: boolean) => { calls.push(['setSaved', id, saved]); return ok(true, saved ? 'Job saved' : 'Removed'); },
      apply: (id: number, note: string) => { calls.push(['apply', id, note]); return ok(1, 'Application sent'); },
      getApplications: () => { calls.push(['getApplications']); return ok([
        { applicationId: 3, postingId: 9, status: 'Applied', appliedAt: '2026-10-01T09:00:00', statusAt: '2026-10-01T09:00:00' },
        { applicationId: 4, postingId: 7, status: 'Shortlisted', appliedAt: '2026-10-21T09:00:00', statusAt: '2026-10-24T11:00:00' },
      ]); },
    };
  });

  it('shows the whole job on a page, not in a popup', () => {
    const fixture = create();

    expect(calls).toContainEqual(['getPosting', 7]);
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Site supervisor');
    expect(text(fixture)).toContain('Oversee daily construction activities.');
    expect(fixture.nativeElement.querySelector('app-verified-badge')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.jp-overlay')).toBeNull();
  });

  it('shows similar jobs, never the job itself, each linking to its own page', () => {
    const fixture = create();
    const links = [...fixture.nativeElement.querySelectorAll('.pd-rel')] as HTMLAnchorElement[];

    expect(calls).toContainEqual(['related', 7]);
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/apps/jobs/job/9']);
  });

  it('opens the application at once when it came to apply, and sends it', () => {
    const fixture = create({ apply: '1' });
    const c = fixture.componentInstance;

    expect(c.applyOpen()).toBe(true);
    c.applyNote = ' I can start on Monday ';
    c.sendApply();

    expect(calls).toContainEqual(['apply', 7, 'I can start on Monday']);
    expect(c.job()!.myStatus).toBe('Applied');
    expect(c.applyOpen()).toBe(false);
  });

  it('shows when the person applied, and since when the application stands', () => {
    api.getPosting = () => ok(posting({ myStatus: 'Shortlisted' }));
    const fixture = create();

    expect(calls).toContainEqual(['getApplications']);
    const rows = [...fixture.nativeElement.querySelectorAll('.jd-dates > div')].map((r: any) =>
      [r.querySelector('dt').textContent.includes('Applied on') ? 'Applied on' : r.querySelector('dt').textContent.includes('Shortlisted since') ? 'Shortlisted since' : '?',
       r.querySelector('dd').textContent.trim()]);
    expect(rows).toEqual([['Applied on', '21 Oct 2026'], ['Shortlisted since', '24 Oct 2026']]);
  });

  it('saves the job', () => {
    const fixture = create();
    fixture.componentInstance.toggleSave(fixture.componentInstance.job()!);

    expect(calls).toContainEqual(['setSaved', 7, true]);
    expect(fixture.componentInstance.job()!.isSaved).toBe(true);
  });
});
