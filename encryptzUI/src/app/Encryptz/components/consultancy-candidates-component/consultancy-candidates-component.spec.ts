import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { CompanyJobsService } from '../../Services/company-jobs-service';
import { ConsultancyService } from '../../Services/consultancy-service';
import { ConsultancyCandidatesComponent } from './consultancy-candidates-component';

describe('ConsultancyCandidatesComponent', () => {
  const key = '6f9619ff-8b86-d011-b42d-00cf4fc964ff';
  const candidate = (over: any = {}) => ({
    candidateKey: key, fullName: 'Leo Joseph', headline: 'Accountant, 5 years', city: 'Kochi', experienceYears: 5,
    skills: 'Tally, GST', preferredJobs: 'Accountant', workModes: 'Remote', hasResume: true, inPool: false, stage: '', ...over,
  });
  const page = () => ({
    candidateKey: key, inPool: false, stage: '', note: '', preferredJobs: ['Accountant'], preferredLocations: ['Thrissur'], workModes: ['Remote'],
    profile: {
      profile: { fullName: 'Leo Joseph', headline: 'Accountant, 5 years', summary: 'About me', city: 'Kochi', contactEmail: 'leo@example.com', contactPhone: '', dateOfBirth: null, isVisible: true },
      experience: [], education: [], skills: [{ skillId: 3, skillName: 'Tally', level: 'Expert', evidenceUrl: 'javascript:alert(1)' }],
      certificates: [{ certificateId: 5, title: 'Tally Prime', issuer: '', issuedOn: null, status: 'Verified', fileId: 0, fileName: '', sizeBytes: 0 }],
      resume: { fileId: 8, fileName: 'cv.pdf', sizeBytes: 100, uploadedAt: '2026-10-13T10:00:00' }, completeness: 80,
    },
  });

  let api: any;
  let calls: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConsultancyCandidatesComponent],
      providers: [
        provideRouter([]),
        { provide: ConsultancyService, useValue: api },
        { provide: CompanyJobsService, useValue: { getPostings: () => of({ success: true, message: '', data: [
          { postingId: 7, title: 'Accountant', city: 'Kochi', status: 'Open' }, { postingId: 8, title: 'Draft job', city: 'Kochi', status: 'Draft' },
        ] }) } },
        { provide: AuthService, useValue: { userName: () => 'Admin', currentUser: () => ({ userId: 5 }), scopeState: () => ({ companyId: 2 }) } },
      ],
    });
    const fixture = TestBed.createComponent(ConsultancyCandidatesComponent);
    fixture.detectChanges();
    return fixture;
  };
  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const ok = (data: any = true, message = 'Done') => of({ success: true, message, data });

  beforeEach(() => {
    calls = [];
    api = {
      searchCandidates: (s: any) => { calls.push(['searchCandidates', { ...s }]); return ok({ items: [candidate(), candidate({ candidateKey: 'k2', fullName: 'Anu Thomas', inPool: true, stage: 'Interview' })], total: 2, page: 1, pageSize: 20 }); },
      getCandidate: (k: string) => { calls.push(['getCandidate', k]); return ok(page()); },
      saveTalent: (k: string, stage: string, note: string) => { calls.push(['saveTalent', k, stage, note]); return ok(true, 'Added to your candidates'); },
      removeTalent: (k: string) => { calls.push(['removeTalent', k]); return ok(true, 'Removed from your candidates'); },
      invite: (k: string, postingId: number, message: string) => { calls.push(['invite', k, postingId, message]); return ok(true, 'Invitation sent'); },
      downloadCandidateResume: (k: string) => { calls.push(['downloadCandidateResume', k]); return of(new Blob(['x'])); },
    };
    (URL as any).createObjectURL = () => 'blob:test';
    (URL as any).revokeObjectURL = () => {};
  });

  it('lists candidates with experience, skills and the stage of the pool', () => {
    const fixture = create();
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.jb-card')) as HTMLElement[];

    expect(cards[0].textContent).toContain('Leo Joseph');
    expect(cards[0].textContent).toContain('5 years');
    expect(cards[0].textContent).toContain('Tally');
    expect(cards[1].querySelector('.jb-status')!.textContent).toContain('Interview');
  });

  it('searches with the filters and shows the pool when asked, from the first page', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    Object.assign(c.filter, { q: 'tally', city: 'Kochi', years: 3, mode: 'Remote', page: 3 });
    c.search();
    expect(calls.at(-1)).toEqual(['searchCandidates', { q: 'tally', city: 'Kochi', years: 3, mode: 'Remote', pool: false, page: 1 }]);

    c.setPool(true);
    expect(calls.at(-1)![1].pool).toBe(true);
  });

  it('opens a candidate with what they look for, and never turns a link that is not https into a link', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openCandidate(c.items()[0]);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('.cd-dialog') as HTMLElement;

    expect(calls).toContainEqual(['getCandidate', key]);
    expect(dialog.textContent).toContain('Thrissur');
    expect(dialog.textContent).toContain('Verified');
    expect(dialog.textContent).toContain('cv.pdf');
    expect(fixture.nativeElement.innerHTML).not.toContain('javascript:');
  });

  it('saves a candidate to the pool with stage and note, and marks the card', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openCandidate(c.items()[0]);
    c.poolStage = 'Contacted';
    c.poolNote = ' Called on Monday ';
    c.saveToPool();

    expect(calls).toContainEqual(['saveTalent', key, 'Contacted', 'Called on Monday']);
    expect(c.open()!.inPool).toBe(true);
    expect(c.items()[0].stage).toBe('Contacted');
  });

  it('invites to one of the open jobs only, and needs a job', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    expect(c.openJobs().map(j => j.postingId)).toEqual([7]);
    c.openCandidate(c.items()[0]);
    expect(c.invitePostingId).toBe(7);

    c.inviteMessage = ' Fits you ';
    c.invite();
    expect(calls).toContainEqual(['invite', key, 7, 'Fits you']);

    c.invitePostingId = null;
    c.invite();
    expect(c.panelError()).toBe('Choose one of your open jobs');
  });

  it('goes to Placements with the candidate to record a placement', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    c.openCandidate(c.items()[0]);
    c.recordPlacement();

    expect(navigate).toHaveBeenCalledWith(['/consultancy/placements'], { queryParams: { candidate: key, name: 'Leo Joseph' } });
  });

  it('says so when a candidate can no longer be found', () => {
    api.getCandidate = () => of({ success: false, message: 'Not found', data: null });
    const fixture = create();
    const c = fixture.componentInstance;

    c.openCandidate(c.items()[0]);

    expect(c.open()).toBeNull();
    expect(c.toast()!.text).toBe('This candidate can no longer be found');
  });
});
