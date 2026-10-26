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
      experience: [], education: [], skills: [{ skillId: 3, skillName: 'Tally', rating: 5, level: 'Expert', subSkills: [{ name: 'GST', rating: 4 }], evidenceUrl: 'javascript:alert(1)' }],
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

    Object.assign(c.filter, { q: 'tally gst', page: 3 });
    c.search();
    expect(calls.at(-1)![1]).toEqual(expect.objectContaining({ q: 'tally gst', matchAll: true, page: 1, pool: false }));

    c.setPool(true);
    expect(calls.at(-1)![1].pool).toBe(true);
  });

  it('ticks more than one value of a filter, searches at once, and unticks it again', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.toggle('cities', 'Kochi');
    c.toggle('cities', 'Thrissur');
    c.toggle('bands', '3-5');
    c.toggle('modes', 'Remote');
    expect(calls.at(-1)![1]).toEqual(expect.objectContaining({ cities: ['Kochi', 'Thrissur'], bands: ['3-5'], modes: ['Remote'], page: 1 }));
    expect(c.activeFilters).toBe(4);

    c.toggle('cities', 'kochi');
    expect(calls.at(-1)![1].cities).toEqual(['Thrissur']);

    c.clearFilters();
    expect(calls.at(-1)![1]).toEqual(expect.objectContaining({ cities: [], bands: [], modes: [], skills: [] }));
  });

  it('any or all words, and any or all skills', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const before = calls.length;

    // without words "any word" changes nothing: no search
    c.setFlag('matchAll', false);
    expect(calls.length).toBe(before);

    c.filter.q = 'site supervisor';
    c.setFlag('matchAll', true);
    expect(calls.at(-1)![1]).toEqual(expect.objectContaining({ q: 'site supervisor', matchAll: true }));

    c.toggle('skills', 'AutoCAD');
    c.toggle('skills', 'BOQ Preparation');
    c.setFlag('skillsAll', true);
    expect(calls.at(-1)![1]).toEqual(expect.objectContaining({ skills: ['AutoCAD', 'BOQ Preparation'], skillsAll: true }));
  });

  it('shows where the years come from, and says when experience was not added', () => {
    api.searchCandidates = () => ok({ items: [
      candidate({ candidateKey: 'a', experienceYears: 3, experienceSource: 'Entries' }),
      candidate({ candidateKey: 'b', experienceYears: 6, experienceSource: 'Headline' }),
      candidate({ candidateKey: 'c', experienceYears: 0, experienceSource: 'None' }),
    ], total: 3, page: 1, pageSize: 20, facets: [{ kind: 'Band', value: 'none', people: 1 }] });
    const fixture = create();
    const cards = [...fixture.nativeElement.querySelectorAll('.cd-card .jb-meta')].map((m: any) => m.textContent.replace(/\s+/g, ' '));

    expect(cards[0]).toContain('3 years');
    expect(cards[0]).not.toContain('from headline');
    expect(cards[1]).toContain('6 years (from headline)');
    expect(cards[2]).toContain('Experience not added');
    expect(fixture.componentInstance.bands.map(b => b.value)).toContain('none');
    expect(fixture.componentInstance.countOf('Band', 'none')).toBe(1);
  });

  it('says so when the server is older than the filters, instead of showing an unfiltered list as filtered', () => {
    // the answer of a server from before the filters: no choices at all
    const fixture = create();
    fixture.componentInstance.toggle('bands', '0-1');
    fixture.detectChanges();

    expect(fixture.componentInstance.serverFilters()).toBe(false);
    expect(fixture.nativeElement.querySelector('.cd-outdated')).not.toBeNull();

    api.searchCandidates = () => ok({ items: [], total: 0, page: 1, pageSize: 20, facets: [] });
    fixture.componentInstance.search();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cd-outdated')).toBeNull();
  });

  it('shows the choices with how many people have each, and keeps a ticked value that is not among them', () => {
    api.searchCandidates = (s: any) => { calls.push(['searchCandidates', { ...s }]); return ok({ items: [candidate()], total: 1, page: 1, pageSize: 20,
      facets: [{ kind: 'City', value: 'Kochi', people: 12 }, { kind: 'Skill', value: 'Tally', people: 7 }, { kind: 'Band', value: '1-3', people: 4 }] }); };
    const fixture = create();
    const c = fixture.componentInstance;
    c.addSkill = ' Payroll ';
    c.addTyped('skills');
    fixture.detectChanges();

    expect(c.choices('City', c.filter.cities)).toEqual([{ value: 'Kochi', people: 12 }]);
    expect(c.choices('Skill', c.filter.skills)).toEqual([{ value: 'Payroll', people: null }, { value: 'Tally', people: 7 }]);
    expect(c.countOf('Band', '1-3')).toBe(4);
    const labels = [...fixture.nativeElement.querySelectorAll('.cd-check')].map((l: any) =>
      [l.querySelector('span').textContent.trim(), l.querySelector('em')?.textContent.trim() ?? '']);
    expect(labels).toContainEqual(['Kochi', '12']);
    expect(labels).toContainEqual(['Payroll', '']);
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
