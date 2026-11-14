import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { ConsultancyService } from '../../Services/consultancy-service';
import { ConsultancyClientsComponent } from './consultancy-clients-component';

describe('ConsultancyClientsComponent', () => {
  const client = (over: any = {}) => ({
    clientId: 4, name: 'Acme Retail', contactPerson: 'Anu', phone: '9847000000', email: 'anu@acme.in', city: 'Kochi',
    industry: 'Retail', notes: 'Fee 8.33%', isActive: true, openJobs: 2, placements: 1, ...over,
  });

  let api: any;
  let calls: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConsultancyClientsComponent],
      providers: [
        provideRouter([]),
        { provide: ConsultancyService, useValue: api },
        { provide: AuthService, useValue: { userName: () => 'Admin', currentUser: () => ({ userId: 5 }), scopeState: () => ({ companyId: 2 }) } },
      ],
    });
    const fixture = TestBed.createComponent(ConsultancyClientsComponent);
    fixture.detectChanges();
    return fixture;
  };
  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const ok = (data: any = true, message = 'Done') => of({ success: true, message, data });

  beforeEach(() => {
    calls = [];
    api = {
      getClients: () => { calls.push(['getClients']); return ok([client(), client({ clientId: 5, name: 'Old Co', isActive: false, placements: 0, openJobs: 0 })]); },
      saveClient: (c: any) => { calls.push(['saveClient', c]); return ok(6, 'Client added'); },
      deleteClient: (id: number) => { calls.push(['deleteClient', id]); return ok(true, 'Client removed'); },
    };
  });

  it('lists the active clients with contact and figures, the inactive ones when asked', () => {
    const fixture = create();
    const t = text(fixture);

    expect(t).toContain('Acme Retail');
    expect(t).toContain('Anu');
    expect(t).toContain('2 open jobs');
    expect(t).not.toContain('Old Co');

    fixture.componentInstance.showInactive.set(true);
    fixture.detectChanges();
    expect(text(fixture)).toContain('Old Co');
  });

  it('finds a client by what is typed', () => {
    const fixture = create();
    fixture.componentInstance.search.set('retail');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.jb-card').length).toBe(1);

    fixture.componentInstance.search.set('nobody');
    fixture.detectChanges();
    expect(text(fixture)).toContain('No client matches');
  });

  it('adds a client, trimmed, and does not send one without a name or with a wrong e-mail', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openNew();
    c.save();
    expect(c.formError()).toBe('Enter the name of the client');

    Object.assign(c.form()!, { name: ' New Co ', email: 'nope' });
    c.save();
    expect(c.formError()).toBe('Enter a valid e-mail address');

    c.form()!.email = ' hr@new.co ';
    c.save();
    expect(calls.find(x => x[0] === 'saveClient')![1]).toEqual(expect.objectContaining({ clientId: 0, name: 'New Co', email: 'hr@new.co', isActive: true }));
    expect(c.form()).toBeNull();
  });

  it('removes a client only after the person confirmed, and offers it only without placements', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.jb-card')) as HTMLElement[];
    expect(cards[0].textContent).not.toContain('Remove');

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    c.remove(client({ clientId: 5, placements: 0 }));
    expect(calls.some(x => x[0] === 'deleteClient')).toBe(false);
    confirmSpy.mockReturnValue(true);
    c.remove(client({ clientId: 5, placements: 0 }));
    expect(calls).toContainEqual(['deleteClient', 5]);
    confirmSpy.mockRestore();
  });

  it('says why when the company may not use Job Consultancy', () => {
    api.getClients = () => throwError(() => ({ status: 403, error: { message: 'Job Consultancy is not available yet' } }));
    expect(text(create())).toContain('Job Consultancy is not available yet');
  });
});
