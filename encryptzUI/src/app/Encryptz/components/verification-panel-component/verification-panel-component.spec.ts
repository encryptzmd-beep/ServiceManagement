import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { PlatformService } from '../../Services/platform-service';
import { VerificationPanelComponent } from './verification-panel-component';

describe('VerificationPanelComponent', () => {
  const certificate = (over: any = {}) => ({
    certificateId: 5, title: 'Tally Prime', issuer: 'Institute', issuedOn: '2020-01-15T00:00:00', fileName: 'c.pdf',
    submittedAt: '2026-10-10T09:00:00', personName: 'Leo Joseph', personHeadline: 'Accountant', ...over,
  });
  const posting = (over: any = {}) => ({
    postingId: 7, companyName: 'Hamster A/C', title: 'Accountant', city: 'Kochi', employmentType: 'Full-time', workMode: 'Hybrid',
    experienceMinYears: 1, experienceMaxYears: 3, salaryMin: 20000, salaryMax: 30000, skills: 'Tally', description: 'Books of three branches.',
    closesOn: null, submittedAt: '2026-10-09T09:00:00', wasPublished: false, ...over,
  });

  let api: any;
  let calls: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [VerificationPanelComponent], providers: [{ provide: PlatformService, useValue: api }] });
    const fixture = TestBed.createComponent(VerificationPanelComponent);
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const cards = (fixture: any) => Array.from(fixture.nativeElement.querySelectorAll('.vp-card')) as HTMLElement[];

  beforeEach(() => {
    calls = [];
    api = {
      getVerificationQueue: () => { calls.push(['getVerificationQueue']); return of({ success: true, message: '', data: { certificates: [certificate()], postings: [posting()] } }); },
      decideCertificate: (id: number, approve: boolean, note: string) => { calls.push(['decideCertificate', id, approve, note]); return of({ success: true, message: approve ? 'Certificate verified' : 'Certificate not verified', data: true }); },
      decidePosting: (id: number, approve: boolean, note: string) => { calls.push(['decidePosting', id, approve, note]); return of({ success: true, message: approve ? 'Job approved' : 'Job returned to the company', data: true }); },
      getCertificateFileForReview: (id: number) => { calls.push(['getCertificateFileForReview', id]); return of(new Blob(['x'])); },
    };
    (URL as any).createObjectURL = () => 'blob:test';
    (URL as any).revokeObjectURL = () => {};
  });

  it('lists certificates and jobs together, the one that waits longest first', () => {
    const fixture = create();
    const list = cards(fixture);

    expect(list.length).toBe(2);
    expect(list[0].textContent).toContain('Job posting');
    expect(list[0].textContent).toContain('Hamster A/C');
    expect(list[0].textContent).toContain('Books of three branches.');
    expect(list[1].textContent).toContain('Certificate');
    expect(list[1].textContent).toContain('Leo Joseph');
    expect(list[1].textContent).toContain('c.pdf');
    expect(text(fixture)).toContain('All 2');
  });

  it('shows only certificates or only jobs when asked', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.filter.set('certificates');
    fixture.detectChanges();
    expect(cards(fixture).map(x => x.querySelector('h3')!.textContent)).toEqual(['Tally Prime']);

    c.filter.set('postings');
    fixture.detectChanges();
    expect(cards(fixture).map(x => x.querySelector('h3')!.textContent)).toEqual(['Accountant']);
  });

  it('approves with one click and takes the item off the list', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.approve(c.items()[0]);
    fixture.detectChanges();

    expect(calls).toContainEqual(['decidePosting', 7, true, '']);
    expect(cards(fixture).length).toBe(1);
    expect(c.toast()!.text).toBe('Job approved');
  });

  it('refuses only with a reason, which is sent', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const cert = c.items()[1];

    c.startRefusal(cert);
    c.refuse(cert);
    expect(c.itemError()!.text).toBe('Say why the certificate is not verified');
    expect(calls.some(x => x[0] === 'decideCertificate')).toBe(false);

    c.reason = '  The name on the file is another person ';
    c.refuse(cert);
    expect(calls).toContainEqual(['decideCertificate', 5, false, 'The name on the file is another person']);
    expect(c.refusing()).toBeNull();
  });

  it('reads the list again when the item was decided elsewhere meanwhile', () => {
    api.decidePosting = () => of({ success: false, message: 'This job no longer waits for review', data: false });
    const fixture = create();
    const c = fixture.componentInstance;

    c.approve(c.items()[0]);
    fixture.detectChanges();

    expect(text(fixture)).toContain('This job no longer waits for review');
    expect(calls.filter(x => x[0] === 'getVerificationQueue').length).toBe(2);
  });

  it('makes one decision at a time', () => {
    const pending = new Subject<any>();
    let sent = 0;
    api.decidePosting = () => { sent++; return pending; };
    const fixture = create();
    const c = fixture.componentInstance;

    c.approve(c.items()[0]);
    c.approve(c.items()[0]);
    c.approve(c.items()[1]);

    expect(sent).toBe(1);
    expect(calls.some(x => x[0] === 'decideCertificate')).toBe(false);
  });

  it('opens the file of a certificate', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.viewFile(c.certificates()[0]);

    expect(calls).toContainEqual(['getCertificateFileForReview', 5]);
  });

  it('says when nothing waits, and when the list cannot be read', () => {
    api.getVerificationQueue = () => of({ success: true, message: '', data: { certificates: [], postings: [] } });
    expect(text(create())).toContain('Nothing waits for verification');

    api.getVerificationQueue = () => throwError(() => ({ status: 403 }));
    expect(text(create())).toContain('The list could not be loaded');
  });

  it('lists the rejections with the skills the job asked for and the reason, and searches them', () => {
    api.getRejections = (q: string, page: number) => {
      calls.push(['getRejections', q, page]);
      return of({ success: true, message: '', data: { total: 1, page: 1, pageSize: 20, items: [{
        rejectionId: 4, rejectedAt: '2026-10-20T10:00:00', companyName: 'Acme Placements', jobTitle: 'Accountant', skills: 'Tally, GST; Excel',
        reason: 'The job needs three years of GST filing', candidateName: 'Leo Joseph', candidateHeadline: 'Clerk' }] } });
    };
    const fixture = create();
    fixture.componentInstance.showFilter('rejections');
    fixture.detectChanges();

    expect(calls).toContainEqual(['getRejections', '', 1]);
    const card = fixture.nativeElement.querySelector('.vp-rejection') as HTMLElement;
    expect(card.querySelector('h3')!.textContent).toContain('Accountant');
    expect(card.textContent).toContain('Acme Placements');
    expect(card.textContent).toContain('Leo Joseph');
    expect((Array.from(card.querySelectorAll('.vp-skill')) as HTMLElement[]).map(e => e.textContent!.trim())).toEqual(['Tally', 'GST', 'Excel']);
    expect(card.querySelector('.vp-reason')!.textContent).toContain('three years of GST filing');
    expect(text(fixture)).toContain('1 rejection');

    fixture.componentInstance.rejectionsQuery = ' GST ';
    fixture.componentInstance.loadRejections(1);
    expect(calls).toContainEqual(['getRejections', 'GST', 1]);
  });
});
