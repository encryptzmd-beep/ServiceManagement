import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { CompanyJobsService } from '../../Services/company-jobs-service';
import { ConsultancyService } from '../../Services/consultancy-service';
import { ConsultancyPlacementsComponent } from './consultancy-placements-component';

describe('ConsultancyPlacementsComponent', () => {
  const placement = (over: any = {}) => ({
    placementId: 1, clientId: 4, clientName: 'Acme Retail', postingId: 7, candidateName: 'Leo Joseph', jobTitle: 'Accountant',
    joinDate: '2026-11-01T00:00:00', annualCtc: 450000, feeAmount: 40000, feeStatus: 'Pending', guaranteeUntil: '2099-02-01T00:00:00',
    notes: '', onJobPortal: true, ...over,
  });

  let api: any;
  let calls: any[][];
  let query: Record<string, string>;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConsultancyPlacementsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query), data: {} } } },
        { provide: ConsultancyService, useValue: api },
        { provide: CompanyJobsService, useValue: { getPostings: () => of({ success: true, message: '', data: [{ postingId: 7, title: 'Accountant', city: 'Kochi', status: 'Open' }] }) } },
        { provide: AuthService, useValue: { userName: () => 'Admin', currentUser: () => ({ userId: 5 }), scopeState: () => ({ companyId: 2 }) } },
      ],
    });
    const fixture = TestBed.createComponent(ConsultancyPlacementsComponent);
    fixture.detectChanges();
    return fixture;
  };
  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const ok = (data: any = true, message = 'Done') => of({ success: true, message, data });

  beforeEach(() => {
    calls = [];
    query = {};
    api = {
      getPlacements: () => { calls.push(['getPlacements']); return ok({ items: [placement(), placement({ placementId: 2, candidateName: 'Walk-in', feeStatus: 'Paid', onJobPortal: false })], thisMonth: 1, total: 2, feeOutstanding: 40000, feePaidThisYear: 30000 }); },
      getClients: () => ok([{ clientId: 4, name: 'Acme Retail', isActive: true }]),
      savePlacement: (p: any) => { calls.push(['savePlacement', p]); return ok(3, 'Placement saved'); },
      deletePlacement: (id: number) => { calls.push(['deletePlacement', id]); return ok(true, 'Placement removed'); },
    };
  });

  it('shows the figures and each placement with client, CTC, fee and guarantee', () => {
    const t = text(create());

    expect(t).toContain('₹40,000');
    expect(t).toContain('₹30,000');
    expect(t).toContain('Leo Joseph');
    expect(t).toContain('Accountant · Acme Retail');
    expect(t).toContain('CTC ₹4,50,000 a year');
    expect(t).toContain('Guarantee until 1 Feb 2099');
    expect(t).toContain('Fee pending');
  });

  it('filters by the state of the fee', () => {
    const fixture = create();
    fixture.componentInstance.feeFilter.set('Paid');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.jb-card').length).toBe(1);
    expect(text(fixture)).toContain('Walk-in');
  });

  it('saves a placement with numbers as numbers, and refuses one without candidate or with a guarantee before joining', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openNew();
    c.form()!.jobTitle = 'Helper';
    c.save();
    expect(c.formError()).toBe('Enter the candidate, the job and the joining date');

    Object.assign(c.form()!, { candidateName: ' Ravi ', joinDate: '2026-11-01', guaranteeUntil: '2026-10-01' });
    c.save();
    expect(c.formError()).toBe('The replacement guarantee cannot end before the joining date');

    Object.assign(c.form()!, { guaranteeUntil: '', ctcText: '300000', feeText: ' 25000 ', clientId: 4 });
    c.save();
    const sent = calls.find(x => x[0] === 'savePlacement')![1];
    expect(sent).toEqual(expect.objectContaining({ candidateName: 'Ravi', jobTitle: 'Helper', annualCtc: 300000, feeAmount: 25000, clientId: 4, guaranteeUntil: null }));
    expect(sent.ctcText).toBeUndefined();
  });

  it('opens filled in for an applicant who was hired', () => {
    query = { application: '31', posting: '7', name: 'Leo Joseph', title: 'Accountant' };
    const c = create().componentInstance;

    expect(c.form()).toEqual(expect.objectContaining({ applicationId: 31, postingId: 7, candidateName: 'Leo Joseph', jobTitle: 'Accountant' }));
  });

  it('opens filled in for a candidate of the pool', () => {
    query = { candidate: 'k-1', name: 'Anu Thomas' };
    const c = create().componentInstance;

    expect(c.form()).toEqual(expect.objectContaining({ candidateKey: 'k-1', candidateName: 'Anu Thomas' }));
  });

  it('marks a fee paid, and removes a placement only after the person confirmed', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.setFee(c.data().items[0], 'Paid');
    expect(calls.find(x => x[0] === 'savePlacement')![1].feeStatus).toBe('Paid');

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    c.remove(c.data().items[0]);
    expect(calls.some(x => x[0] === 'deletePlacement')).toBe(false);
    confirmSpy.mockReturnValue(true);
    c.remove(c.data().items[0]);
    expect(calls).toContainEqual(['deletePlacement', 1]);
    confirmSpy.mockRestore();
  });
});
