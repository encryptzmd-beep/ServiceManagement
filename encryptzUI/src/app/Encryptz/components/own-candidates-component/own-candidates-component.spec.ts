import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { ConsultancyService } from '../../Services/consultancy-service';
import { OwnCandidatesComponent } from './own-candidates-component';

describe('OwnCandidatesComponent', () => {
  const ok = (data: any = true, message = 'Done') => of({ success: true, message, data });
  const candidate = (over: any = {}) => ({
    candidateId: 4, fullName: 'Anu Thomas', headline: 'Accountant', email: 'anu@example.com', phone: '98470 12345', city: 'Kochi',
    experienceYears: 3, skills: 'Tally, GST', preferredJobs: 'Accountant', source: 'Walk-in', stage: 'New', notes: '',
    hasResume: true, resumeName: 'anu.pdf', ...over,
  });

  let calls: any[][];
  let api: any;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [OwnCandidatesComponent],
      providers: [
        provideRouter([]),
        { provide: ConsultancyService, useValue: api },
        { provide: AuthService, useValue: { userName: () => 'Admin', currentUser: () => ({ userId: 5 }), scopeState: () => ({ companyId: 2 }) } },
      ],
    });
    const fixture = TestBed.createComponent(OwnCandidatesComponent);
    fixture.detectChanges();
    return fixture;
  };
  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

  beforeEach(() => {
    calls = [];
    api = {
      getOwnCandidates: (q: string, page: number) => { calls.push(['list', q, page]); return ok({ items: [candidate()], total: 1, page, pageSize: 20 }); },
      findOwnDuplicates: (id: number, email: string, phone: string) => { calls.push(['duplicates', id, email, phone]); return ok([]); },
      saveOwnCandidate: (c: any) => { calls.push(['save', c]); return ok(9, 'Candidate added'); },
      saveOwnCandidateResume: (id: number, f: File) => { calls.push(['resume', id, f.name]); return ok(id, 'Resume saved'); },
      deleteOwnCandidate: (id: number) => { calls.push(['delete', id]); return ok(true, 'Candidate removed'); },
    };
  });

  it('lists the company\'s own candidates with contact, experience, skills and stage', () => {
    const fixture = create();

    expect(calls[0]).toEqual(['list', '', 1]);
    const card = fixture.nativeElement.querySelector('.oc-card');
    expect(card.textContent).toContain('Anu Thomas');
    expect(card.textContent).toContain('98470 12345');
    expect(card.textContent).toContain('3 years');
    expect(card.textContent).toContain('Tally');
    expect(text(fixture)).toContain('Only your company sees them');
  });

  it('needs a name and an e-mail or a phone, before anything is sent', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.openNew();
    c.save();
    expect(c.formError()).toBe('Enter the name of the candidate');

    c.form()!.fullName = 'Ravi';
    c.save();
    expect(c.formError()).toBe('Enter an e-mail or a phone number');

    c.form()!.phone = '123';
    c.save();
    expect(c.formError()).toBe('Enter a valid phone number');
    expect(calls.some(x => x[0] === 'save')).toBe(false);
  });

  it('warns at once when the phone or e-mail belongs to a candidate already, and does not save a duplicate', () => {
    api.findOwnDuplicates = (id: number, email: string, phone: string) => {
      calls.push(['duplicates', id, email, phone]);
      return ok([{ candidateId: 4, fullName: 'Anu Thomas', email: 'anu@example.com', phone: '98470 12345', sameAs: 'Phone' }]);
    };
    const fixture = create();
    const c = fixture.componentInstance;
    c.openNew();
    Object.assign(c.form()!, { fullName: 'Anu T', phone: '+91 98470 12345' });
    c.checkDuplicates();
    fixture.detectChanges();

    expect(calls).toContainEqual(['duplicates', 0, '', '+91 98470 12345']);
    expect(fixture.nativeElement.querySelector('.oc-duplicate').textContent).toContain('Anu Thomas has the same phone number');

    c.save();
    expect(c.formError()).toBe('You already have this candidate: Anu Thomas has the same phone number');
    expect(calls.some(x => x[0] === 'save')).toBe(false);
  });

  it('saves a new candidate with the experience as a number, then the resume', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.openNew();
    Object.assign(c.form()!, { fullName: 'Ravi Kumar', phone: '9846011111', experience: '2.5' });
    c.resumeFile = new File(['%PDF'], 'ravi.pdf', { type: 'application/pdf' });
    c.save();

    const saved = calls.find(x => x[0] === 'save')![1];
    expect(saved.experienceYears).toBe(2.5);
    expect('experience' in saved).toBe(false);
    expect(calls).toContainEqual(['resume', 9, 'ravi.pdf']);
    expect(c.form()).toBeNull();
  });
});
