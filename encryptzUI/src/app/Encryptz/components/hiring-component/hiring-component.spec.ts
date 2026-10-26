import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { CompanyJobsService } from '../../Services/company-jobs-service';
import { ConsultancyService } from '../../Services/consultancy-service';
import { HiringComponent } from './hiring-component';

describe('HiringComponent', () => {
  const job = (over: any = {}) => ({
    postingId: 7, title: 'Accountant', city: 'Kochi', employmentType: 'Full-time', workMode: 'Hybrid',
    experienceMinYears: 1, experienceMaxYears: 3, salaryMin: 20000, salaryMax: 30000, skills: 'Tally', description: '',
    closesOn: '2026-11-30T00:00:00', status: 'Open', publishedAt: '2026-10-10T09:00:00', createdAt: '2026-10-09T09:00:00',
    applied: 2, shortlisted: 1, rejected: 0, hired: 0, ...over,
  });
  const applicantRow = (over: any = {}) => ({
    applicationId: 31, fullName: 'Leo Joseph', headline: 'Accountant, 5 years', city: 'Kochi', status: 'Applied',
    note: 'I can start in November', appliedAt: '2026-10-11T10:00:00', statusAt: '2026-10-11T10:00:00', hasResume: true, ...over,
  });
  const applicantPage = () => ({
    applicationId: 31, postingTitle: 'Accountant', status: 'Applied', note: 'I can start in November', appliedAt: '2026-10-11T10:00:00',
    profile: {
      profile: { fullName: 'Leo Joseph', headline: 'Accountant, 5 years', summary: 'About me', city: 'Kochi', contactEmail: 'leo@example.com', contactPhone: '', dateOfBirth: null, isVisible: false },
      experience: [{ experienceId: 1, organisation: 'Acme', title: 'Clerk', startMonth: '2019-04-01T00:00:00', endMonth: null, description: 'd' }],
      education: [{ educationId: 2, institution: 'MG University', course: 'B.Com', fieldOfStudy: 'Finance', startYear: 2012, endYear: 2015 }],
      skills: [{ skillId: 3, skillName: 'Tally', rating: 5, level: 'Expert', subSkills: [{ name: 'GST', rating: 4 }], evidenceUrl: 'javascript:alert(1)' }],
      certificates: [{ certificateId: 5, title: 'Tally Prime', issuer: 'Institute', issuedOn: '2020-01-15T00:00:00', status: 'Uploaded', fileId: 0, fileName: '', sizeBytes: 0 }],
      resume: { fileId: 8, fileName: 'cv.pdf', sizeBytes: 1048576, uploadedAt: '2026-10-13T10:00:00' },
      completeness: 90,
    },
  });

  let api: any;
  let consultancy: any;
  let calls: any[][];
  let companyId: number | null;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HiringComponent],
      providers: [
        provideRouter([]),
        { provide: CompanyJobsService, useValue: api },
        { provide: ConsultancyService, useValue: consultancy },
        { provide: AuthService, useValue: {
          userName: () => 'Admin Person', currentUser: () => ({ userId: 5 }), scopeState: () => ({ loggedIn: true, companyId, moduleKey: null, locationId: null }),
        } },
      ],
    });
    const fixture = TestBed.createComponent(HiringComponent);
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const ok = (data: any = true, message = 'Done') => of({ success: true, message, data });
  const refused = (message: string) => of({ success: false, message, data: null });
  const labels = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).map(b => b.textContent!.replace(/\s+/g, ' ').trim());

  beforeEach(() => {
    calls = [];
    consultancy = {
      getClients: () => ok([]),
      getPostingClients: () => ok([]),
      setPostingClient: (postingId: number, clientId: number | null) => { calls.push(['setPostingClient', postingId, clientId]); return ok(true); },
      getPostingMatchCounts: () => ok([]),
      getPostingMatches: (id: number) => { calls.push(['getPostingMatches', id]); return ok([]); },
      invite: (key: string, postingId: number, message: string) => { calls.push(['invite', key, postingId, message]); return ok(true, 'Invitation sent'); },
    };
    companyId = 2;
    api = {
      getPostings: () => { calls.push(['getPostings']); return ok([job(), job({ postingId: 8, title: 'Helper', status: 'Draft', applied: 0, shortlisted: 0 }), job({ postingId: 9, title: 'Old', status: 'Closed', applied: 0, shortlisted: 0 })]); },
      getPosting: (id: number) => { calls.push(['getPosting', id]); return ok(job({ postingId: id, description: 'Books of three branches.' })); },
      savePosting: (p: any) => { calls.push(['savePosting', p]); return ok(7, 'Job saved as a draft'); },
      setPostingStatus: (id: number, status: string) => { calls.push(['setPostingStatus', id, status]); return ok(true, 'The job is published'); },
      deletePosting: (id: number) => { calls.push(['deletePosting', id]); return ok(true, 'Job removed'); },
      getApplicants: (id: number) => { calls.push(['getApplicants', id]); return ok([applicantRow(), applicantRow({ applicationId: 32, fullName: 'Anu Thomas', status: 'Shortlisted', note: '', hasResume: false })]); },
      getApplicant: (id: number, applicationId: number) => { calls.push(['getApplicant', id, applicationId]); return ok(applicantPage()); },
      setApplicantStatus: (id: number, applicationId: number, status: string) => { calls.push(['setApplicantStatus', id, applicationId, status]); return ok(true, 'Marked as shortlisted'); },
      downloadResume: (id: number, applicationId: number) => { calls.push(['downloadResume', id, applicationId]); return of(new Blob(['x'])); },
    };
  });

  it('goes back to the companies when no company is chosen, and asks the API nothing', () => {
    companyId = null;
    const fixture = create();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.ngOnInit();

    expect(navigate).toHaveBeenCalledWith(['/select-company']);
    expect(calls.length).toBe(0);
  });

  it('is a page of Job Consultancy: its menu opens every page of it', () => {
    const fixture = create();
    const items = Array.from(fixture.nativeElement.querySelectorAll('.ps-nav-item')) as HTMLElement[];

    expect(text(fixture)).toContain('Job Consultancy');
    expect(items.map(e => e.querySelector('.ps-nav-label')!.textContent!.trim())).toEqual(['Job postings', 'Candidates', 'Messages', 'Clients', 'Placements']);
    expect(items.map(e => e.getAttribute('href'))).toEqual(['/consultancy/postings', '/consultancy/candidates', '/consultancy/messages', '/consultancy/clients', '/consultancy/placements']);
    expect(fixture.nativeElement.querySelector('.ps-back').getAttribute('href')).toBe('/select-module');
  });

  it('shows the client of a job, and saves a changed client apart from the job', () => {
    consultancy.getClients = () => ok([{ clientId: 4, name: 'Acme Retail', isActive: true }]);
    consultancy.getPostingClients = () => ok([{ postingId: 7, clientId: 4, clientName: 'Acme Retail' }]);
    const fixture = create();
    const c = fixture.componentInstance;

    expect(text(fixture)).toContain('For Acme Retail');

    c.openEdit(c.postings()[0]);
    expect(c.form()!.clientId).toBe(4);
    c.form()!.clientId = null;
    c.save();

    expect(calls).toContainEqual(['setPostingClient', 7, null]);
  });

  it('offers to record a placement for an applicant who was hired', () => {
    api.getApplicant = () => ok({ ...applicantPage(), status: 'Hired' });
    const fixture = create();
    const c = fixture.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    c.showApplicants(c.postings()[0]);
    c.openApplicant(c.applicants()[0]);
    fixture.detectChanges();
    c.recordPlacement(c.applicant()!);

    expect(navigate).toHaveBeenCalledWith(['/consultancy/placements'], {
      queryParams: { application: 31, posting: 7, name: 'Leo Joseph', title: 'Accountant' },
    });
  });

  it('lists the jobs with state and applicant counts, and the actions each state allows', () => {
    const fixture = create();
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.jb-card')) as HTMLElement[];

    expect(cards.length).toBe(3);
    expect(cards[0].textContent).toContain('3 applicants');
    expect(cards[0].textContent).toContain('2 new');
    expect(labels(cards[0])).toEqual(expect.arrayContaining(['Close', 'Edit']));
    expect(labels(cards[0])).not.toContain('Remove');          // it has applicants
    expect(labels(cards[1])).toEqual(expect.arrayContaining(['Send for review', 'Edit', 'Remove']));
    expect(cards[1].textContent).toContain('Not published yet');
    expect(labels(cards[2])).toEqual(expect.arrayContaining(['Reopen', 'Edit', 'Remove']));
  });

  it('shows a job in review and a job returned by Encryptz with its reason', () => {
    api.getPostings = () => ok([
      job({ status: 'InReview', applied: 0, shortlisted: 0 }),
      job({ postingId: 8, title: 'Helper', status: 'Draft', reviewNote: 'Add the salary', applied: 0, shortlisted: 0 }),
    ]);
    const fixture = create();
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.jb-card')) as HTMLElement[];

    expect(cards[0].querySelector('.jb-status')!.textContent).toContain('In review');
    expect(cards[0].textContent).toContain('Waiting for review by Encryptz');
    expect(labels(cards[0])).toEqual(expect.arrayContaining(['Close', 'Edit']));
    expect(cards[1].textContent).toContain('Returned by Encryptz: Add the salary');
    expect(labels(cards[1])).toContain('Send for review');
  });

  it('says why when the person may not manage the jobs of the company', () => {
    api.getPostings = () => throwError(() => ({ status: 403, error: { message: 'Job Consultancy is not available yet' } }));
    const fixture = create();

    expect(text(fixture)).toContain('Job Consultancy is not available yet');
    expect(fixture.nativeElement.querySelector('.jb-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('a.jp-link').getAttribute('href')).toBe('/select-module');
  });

  it('saves a new job as a draft with numbers as numbers and nothing for what is left empty', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openNew();
    Object.assign(c.form()!, { title: ' Site Engineer ', city: 'Thrissur', description: 'Supervise the site.', experienceMin: '2', experienceMax: '', salaryLow: '', salaryHigh: 45000, skills: ' AutoCAD ', closesOn: '2026-12-01' });
    c.save();

    expect(calls.find(x => x[0] === 'savePosting')![1]).toEqual({
      postingId: 0, title: 'Site Engineer', city: 'Thrissur', employmentType: 'Full-time', workMode: 'On-site',
      experienceMinYears: 2, experienceMaxYears: null, salaryMin: null, salaryMax: 45000,
      skills: 'AutoCAD', description: 'Supervise the site.', closesOn: '2026-12-01',
    });
    expect(c.form()).toBeNull();
    expect(calls.filter(x => x[0] === 'getPostings').length).toBe(2);
  });

  it('does not send a job with missing fields or a range the wrong way round', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openNew();
    c.save();
    expect(c.formError()).toBe('Enter the title, the city and the description of the job');

    Object.assign(c.form()!, { title: 'T', city: 'C', description: 'D', experienceMin: 5, experienceMax: 2 });
    c.save();
    expect(c.formError()).toBe('The least experience cannot be more than the most');

    Object.assign(c.form()!, { experienceMin: '', experienceMax: '', salaryLow: 40000, salaryHigh: 30000 });
    c.save();
    expect(c.formError()).toBe('The lowest salary cannot be more than the highest');

    Object.assign(c.form()!, { salaryLow: '-5', salaryHigh: '' });
    c.save();
    expect(c.formError()).toBe('Enter the salary per month as an amount, or leave it empty');

    expect(calls.some(x => x[0] === 'savePosting')).toBe(false);
  });

  it('reads a job again before editing it, with its description and closing date', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openEdit(c.postings()[0]);

    expect(calls).toContainEqual(['getPosting', 7]);
    expect(c.form()!.description).toBe('Books of three branches.');
    expect(c.form()!.closesOn).toBe('2026-11-30');
    expect(c.form()!.salaryLow).toBe(20000);
  });

  it('keeps the dialog open with the message when a save is refused, and while one is on the way', () => {
    api.savePosting = () => refused('The company has 100 jobs that are not closed. Close one first');
    const fixture = create();
    const c = fixture.componentInstance;

    c.openNew();
    Object.assign(c.form()!, { title: 'T', city: 'C', description: 'D' });
    c.save();
    expect(c.form()).not.toBeNull();
    expect(c.formError()).toBe('The company has 100 jobs that are not closed. Close one first');

    const pending = new Subject<any>();
    api.savePosting = () => pending;
    c.save();
    c.closeForm();
    expect(c.form()).not.toBeNull();
  });

  it('publishes at once, closes and removes only after a confirmation', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    c.publish(c.postings()[1]);
    expect(calls).toContainEqual(['setPostingStatus', 8, 'Open']);

    c.close(c.postings()[0]);
    c.remove(c.postings()[1]);
    expect(calls.some(x => x[0] === 'deletePosting' || (x[0] === 'setPostingStatus' && x[2] === 'Closed'))).toBe(false);

    confirmSpy.mockReturnValue(true);
    c.close(c.postings()[0]);
    c.remove(c.postings()[1]);
    expect(calls).toContainEqual(['setPostingStatus', 7, 'Closed']);
    expect(calls).toContainEqual(['deletePosting', 8]);
    confirmSpy.mockRestore();
  });

  it('shows the applicants of a job with note, state and resume mark', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.showApplicants(c.postings()[0]);
    fixture.detectChanges();
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.jb-card')) as HTMLElement[];

    expect(calls).toContainEqual(['getApplicants', 7]);
    // the count of applicants is on the Applicants tab of the job
    expect(fixture.nativeElement.querySelector('.hr-tabs button.on').textContent.replace(/\s+/g, ' ')).toContain('Applicants 2');
    expect(cards[0].textContent).toContain('Leo Joseph');
    expect(cards[0].textContent).toContain('I can start in November');
    expect(cards[0].textContent).toContain('Resume attached');
    expect(cards[1].textContent).toContain('No resume');
    expect(cards[1].querySelector('.jb-status')!.textContent).toContain('Shortlisted');
  });

  it('opens an applicant with the profile, and never turns a link that is not https into a link', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.showApplicants(c.postings()[0]);
    c.openApplicant(c.applicants()[0]);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('.hr-profile') as HTMLElement;

    expect(calls).toContainEqual(['getApplicant', 7, 31]);
    expect(dialog.textContent).toContain('Accountant, 5 years');
    expect(dialog.textContent).toContain('leo@example.com');
    expect(dialog.textContent).toContain('Clerk');
    expect(dialog.textContent).toContain('MG University');
    expect(dialog.textContent).toContain('Tally Prime');
    expect(dialog.textContent).toContain('cv.pdf');
    expect(dialog.querySelector('a')).toBeNull();
    expect(fixture.nativeElement.innerHTML).not.toContain('javascript:');
  });

  it('changes the state of an applicant through the API and shows it', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.showApplicants(c.postings()[0]);
    c.openApplicant(c.applicants()[0]);
    c.setApplicantStatus(31, 'Shortlisted');

    expect(calls).toContainEqual(['setApplicantStatus', 7, 31, 'Shortlisted']);
    expect(c.applicant()!.status).toBe('Shortlisted');
    expect(calls.filter(x => x[0] === 'getApplicants').length).toBe(2);
  });

  it('closes the applicant and reads the list again when the person withdrew in the meantime', () => {
    api.setApplicantStatus = () => refused('Not found');
    const fixture = create();
    const c = fixture.componentInstance;

    c.showApplicants(c.postings()[0]);
    c.openApplicant(c.applicants()[0]);
    c.setApplicantStatus(31, 'Hired');

    expect(c.applicant()).toBeNull();
    expect(c.toast()!.text).toBe('This application was withdrawn');
    expect(calls.filter(x => x[0] === 'getApplicants').length).toBe(2);
  });

  it('goes back to the jobs and reads them again: the counts may have changed', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.showApplicants(c.postings()[0]);
    c.backToJobs();

    expect(c.selected()).toBeNull();
    expect(calls.filter(x => x[0] === 'getPostings').length).toBe(2);
  });

  // ── the people who fit a job ──────────────────────────────────────────────

  const match = (over: any = {}) => ({
    candidateKey: '11111111-2222-3333-4444-555555555555', fullName: 'Sruthi Das', headline: 'Accountant, 5 years', city: 'Kochi',
    experienceYears: 5, experienceSource: 'Headline', isVerified: true, hasResume: false, matchedSkills: 'Tally, GST', skillHits: 2,
    skillsWanted: 3, titleHits: 1, cityMatch: true, modeMatch: false, experienceFit: 1, alreadyInvited: false, matchScore: 17, ...over,
  });

  it('shows how many suitable candidates each open job has, and opens them', () => {
    consultancy.getPostingMatchCounts = () => ok([{ postingId: 7, suitable: 4 }]);
    consultancy.getPostingMatches = (id: number) => { calls.push(['getPostingMatches', id]); return ok([match()]); };
    const fixture = create();
    const button = fixture.nativeElement.querySelector('.hr-suitable') as HTMLButtonElement;

    expect(button.textContent).toContain('4 suitable candidates');
    button.click();
    fixture.detectChanges();

    expect(calls).toContainEqual(['getPostingMatches', 7]);
    expect(fixture.componentInstance.view()).toBe('matches');
    const card = fixture.nativeElement.querySelector('.hr-match');
    expect(card.textContent).toContain('Sruthi Das');
    expect(card.textContent).toContain('2 of 3 skills');
    expect(card.textContent).toContain('5 years (from headline)');
    // 2 of 3 skills, with the city and the experience of the job
    expect(card.querySelector('.hr-fit').textContent.trim()).toBe('Strong fit');
  });

  it('invites a suitable candidate in one click and marks them invited', () => {
    consultancy.getPostingMatches = () => ok([match()]);
    const fixture = create();
    const c = fixture.componentInstance;
    c.showMatches(c.postings()[0]);
    fixture.detectChanges();

    c.inviteMatch(c.matches()[0]);
    fixture.detectChanges();

    expect(calls).toContainEqual(['invite', '11111111-2222-3333-4444-555555555555', 7, '']);
    expect(c.matches()[0].alreadyInvited).toBe(true);
    expect(fixture.nativeElement.querySelector('.hr-invited').textContent).toContain('Invited');
  });

  it('opens the whole profile of a suitable candidate in Candidates', () => {
    consultancy.getPostingMatches = () => ok([match()]);
    const fixture = create();
    const c = fixture.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.showMatches(c.postings()[0]);

    c.viewMatch(c.matches()[0]);
    expect(navigate).toHaveBeenCalledWith(['/consultancy/candidates'], { queryParams: { candidate: '11111111-2222-3333-4444-555555555555' } });
  });
});
