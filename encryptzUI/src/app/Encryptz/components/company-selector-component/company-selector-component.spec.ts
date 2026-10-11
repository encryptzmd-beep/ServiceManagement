import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { CompanySelectorComponent } from './company-selector-component';

describe('CompanySelectorComponent', () => {
  const modules = [
    { moduleId: 1, moduleKey: 'SERVICE', moduleName: 'Service Management', description: 'd', icon: 'build', sortOrder: 1, state: 'Available' },
    { moduleId: 2, moduleKey: 'SALES', moduleName: 'Sales', description: 'd', icon: 'sell', sortOrder: 2, state: 'NotSubscribed' },
    { moduleId: 3, moduleKey: 'HR', moduleName: 'HR', description: 'd', icon: 'groups', sortOrder: 3, state: 'NoAccess' },
  ];
  const branch = (id: number, name: string) => ({ locationId: id, locationName: name });

  let auth: any;
  let navigated: any[][];

  const create = (stage: string, queryModule: string | null = null) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CompanySelectorComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: {
          data: { stage },
          queryParamMap: { get: (k: string) => (k === 'module' ? queryModule : null) },
        } } },
      ],
    });
    navigated = [];
    const router = TestBed.inject(Router);
    router.navigate = ((commands: any[], extras?: any) => { navigated.push(extras ? [commands, extras] : [commands]); return Promise.resolve(true); }) as any;
    const fixture = TestBed.createComponent(CompanySelectorComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    localStorage.clear();
    auth = {
      userId: () => 5,
      userRole: () => 'Admin',
      currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin: false }),
      companies: () => [{ companyId: 2, companyName: 'Hamster A/C', companyCode: 'C002', roleInCompany: 'Admin', isLinked: false, provisionStatus: 'Ready' }],
      selectedModuleKey: () => null,
      scopeState: () => ({ loggedIn: true, companyId: 2, moduleKey: null, locationId: null }),
      getUserCompanies: () => of([]),
      selectCompany: () => of({ success: true, message: '', data: { role: 'Admin' } }),
      getModules: () => of({ success: true, message: '', data: modules }),
      getBranches: () => of({ success: true, message: '', data: [branch(1, 'Main'), branch(2, 'North')] }),
      setScope: () => of({ success: true, message: '', data: { role: 'Admin' } }),
      logout: () => {},
    };
  });

  it('shows the company list even when there is only one company', () => {
    const fixture = create('company');
    const items = fixture.nativeElement.querySelectorAll('.company-item');
    expect(items.length).toBe(1);
    expect(navigated.length).toBe(0);
  });

  it('goes to the module step after a company is picked', () => {
    const fixture = create('company');
    fixture.componentInstance.selectCompany(auth.companies()[0]);
    expect(navigated).toEqual([[['/select-module']]]);
  });

  it('lists every module and disables the ones that cannot be opened', () => {
    const fixture = create('module');
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.module-item')) as HTMLElement[];

    expect(cards.length).toBe(3);
    expect(cards[0].classList.contains('disabled')).toBe(false);
    expect(cards[1].classList.contains('disabled')).toBe(true);
    expect(cards[1].textContent).toContain('Not subscribed');
    expect(cards[2].classList.contains('disabled')).toBe(true);
    expect(cards[2].textContent).toContain('Ask your administrator');
  });

  it('opens the branch step for an available module only', () => {
    const fixture = create('module');
    const c = fixture.componentInstance;

    c.openModule(modules[1] as any);
    c.openModule(modules[2] as any);
    expect(navigated.length).toBe(0);

    c.openModule(modules[0] as any);
    expect(navigated).toEqual([[['/select-branch'], { queryParams: { module: 'SERVICE' } }]]);
  });

  it('lists the branches when there are several', () => {
    const fixture = create('branch', 'SERVICE');
    const items = fixture.nativeElement.querySelectorAll('.branch-item');
    expect(items.length).toBe(2);
    expect(navigated.length).toBe(0);
  });

  it('enters the only branch without asking', () => {
    let scoped: any[] = [];
    auth.getBranches = () => of({ success: true, message: '', data: [branch(7, 'Elankulam')] });
    auth.setScope = (...args: any[]) => { scoped = args; return of({ success: true, message: '', data: { role: 'Technician' } }); };

    create('branch', 'SERVICE');

    expect(scoped).toEqual(['SERVICE', 7, 'Elankulam']);
    expect(navigated).toEqual([[['/technicians/work-orders'], { replaceUrl: true }]]);
  });

  it('explains when no branch is assigned', () => {
    auth.getBranches = () => of({ success: true, message: '', data: [] });
    const fixture = create('branch', 'SERVICE');
    expect(fixture.nativeElement.textContent).toContain('No branch assigned');
    expect(navigated.length).toBe(0);
  });

  it('shows the reason when the branches are refused', () => {
    auth.getBranches = () => of({ success: false, message: 'Your company is still being set up. Please try again shortly', data: null });
    const fixture = create('branch', 'SERVICE');
    expect(fixture.nativeElement.textContent).toContain('Your company is still being set up');
  });

  it('shows the reason when entering a branch is refused', () => {
    auth.setScope = () => of({ success: false, message: 'Invalid location for this company', data: null });
    const fixture = create('branch', 'SERVICE');
    fixture.componentInstance.enterBranch(branch(1, 'Main') as any);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Invalid location for this company');
    expect(navigated.length).toBe(0);
  });

  it('shows a plain message when the server cannot be reached', () => {
    auth.getModules = () => throwError(() => new Error('boom'));
    const fixture = create('module');
    expect(fixture.nativeElement.textContent).toContain('Could not load the modules');
    expect(fixture.nativeElement.textContent).not.toContain('boom');
  });

  it('goes back to the module step when the branch step has no module', () => {
    create('branch', null);
    expect(navigated).toEqual([[['/select-module'], { replaceUrl: true }]]);
  });

  it('keeps the history entry when the user clicks one of several branches', () => {
    const fixture = create('branch', 'SERVICE');
    (fixture.nativeElement.querySelectorAll('.branch-item')[1] as HTMLElement).click();
    expect(navigated).toEqual([[['/complaints/dashboard']]]);
  });

  it('opens an available module with the Enter key', () => {
    const fixture = create('module');
    const card = fixture.nativeElement.querySelectorAll('.module-item')[0] as HTMLElement;
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(navigated).toEqual([[['/select-branch'], { queryParams: { module: 'SERVICE' } }]]);
  });

  it('keeps a disabled module out of the tab order and ignores real clicks on it', () => {
    const fixture = create('module');
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.module-item')) as HTMLElement[];
    expect(cards[1].getAttribute('tabindex')).toBe('-1');
    expect(cards[1].getAttribute('aria-disabled')).toBe('true');
    expect(cards[0].getAttribute('tabindex')).toBe('0');
    cards[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navigated.length).toBe(0);
    cards[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navigated.length).toBe(1);
  });

  for (const role of ['Admin', 'CompanyAdmin']) {
    it('offers Administration to ' + role, () => {
      auth.userRole = () => role;
      auth.currentUser = () => ({ userId: 5, fullName: 'A', role, isPlatformAdmin: false });
      const fixture = create('module');
      const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b: any) => b.textContent.includes('Administration')) as HTMLElement;
      expect(btn).toBeTruthy();
      btn.click();
      expect(navigated).toEqual([[['/settings/platform']]]);
    });
  }

  it('does not offer Administration to a technician', () => {
    auth.userRole = () => 'Technician';
    auth.currentUser = () => ({ userId: 5, fullName: 'A', role: 'Technician', isPlatformAdmin: false });
    const fixture = create('module');
    expect(fixture.nativeElement.textContent).not.toContain('Administration');
  });

  it('shows the state of a company database', () => {
    const cases: [string, string | null][] = [
      ['Provisioning', 'Setting up…'], ['Failed', 'Setup failed'], ['None', 'No database yet'], ['Ready', null],
    ];
    for (const [status, text] of cases) {
      auth.companies = () => [{ companyId: 2, companyName: 'X', companyCode: 'C', roleInCompany: 'Admin', isLinked: false, provisionStatus: status }];
      const fixture = create('company');
      const badge = fixture.nativeElement.querySelector('.status-badge');
      if (text === null) expect(badge).toBeNull();
      else expect(badge.textContent).toContain(text);
    }
  });

  it('shows the reason and no spinner when entering the only branch is refused', () => {
    auth.getBranches = () => of({ success: true, message: '', data: [branch(7, 'Elankulam')] });
    auth.setScope = () => of({ success: false, message: 'Invalid location for this company', data: null });
    const fixture = create('branch', 'SERVICE');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-state')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Invalid location for this company');
    expect(navigated.length).toBe(0);
  });

  const company = { companyId: 2, companyName: 'Hamster A/C', companyCode: 'C002', roleInCompany: 'Admin', isLinked: false, provisionStatus: 'Ready' };

  it('asks the API for the companies when nothing is kept in the browser', () => {
    let calls = 0;
    auth.companies = () => [];
    auth.getUserCompanies = () => { calls++; return of([company]); };
    const fixture = create('company');
    fixture.detectChanges();
    expect(calls).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.company-item').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.error-msg')).toBeNull();
  });

  it('shows the empty state and no error when the API returns no companies', () => {
    auth.companies = () => [];
    auth.getUserCompanies = () => of([]);
    const fixture = create('company');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.error-msg')).toBeNull();
  });

  it('shows the error and no empty state when the companies cannot be loaded', () => {
    auth.companies = () => [];
    auth.getUserCompanies = () => throwError(() => new Error('boom'));
    const fixture = create('company');
    fixture.detectChanges();
    const error = fixture.nativeElement.querySelector('.error-msg');
    expect(error.textContent).toContain('Could not load your companies. Please try again.');
    expect(error.textContent).not.toContain('boom');
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
  });

  for (const stage of ['module', 'branch']) {
    it('sends a visitor without a company from the ' + stage + ' step to the company list', () => {
      auth.scopeState = () => ({ loggedIn: true, companyId: null, moduleKey: null, locationId: null });
      create(stage, 'SERVICE');
      expect(navigated).toEqual([[['/select-company'], { replaceUrl: true }]]);
    });
  }

  it('offers Administration on the branch step to an administrator with no branch', () => {
    auth.getBranches = () => of({ success: true, message: '', data: [] });
    const fixture = create('branch', 'SERVICE');
    expect(fixture.nativeElement.textContent).toContain('Add a branch in Administration.');
    const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b: any) => b.textContent.includes('Administration')) as HTMLElement;
    btn.click();
    expect(navigated).toEqual([[['/settings/platform']]]);
  });

  it('tells a technician with no branch to ask the administrator', () => {
    auth.userRole = () => 'Technician';
    auth.currentUser = () => ({ userId: 5, fullName: 'A', role: 'Technician', isPlatformAdmin: false });
    auth.getBranches = () => of({ success: true, message: '', data: [] });
    const fixture = create('branch', 'SERVICE');
    expect(fixture.nativeElement.textContent).toContain('Ask your administrator to give you a branch.');
    expect(fixture.nativeElement.textContent).not.toContain('Administration');
  });
});
