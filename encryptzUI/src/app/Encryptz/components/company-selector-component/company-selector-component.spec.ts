import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
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
      getUserCompanies: () => of(auth.companies()),
      getCompanyCreation: () => of({ success: true, message: '', data: { canCreate: true, created: 0, limit: 1, message: '' } }),
      createCompany: () => of({ success: true, message: 'ok', data: { companyId: 9, provisionStatus: 'Provisioning' } }),
      retryProvision: () => of({ success: true, message: 'ok', data: true }),
      selectCompany: () => of({ success: true, message: '', data: { role: 'Admin' } }),
      getModules: () => of({ success: true, message: '', data: modules }),
      getPersonalApps: () => of({ success: true, message: '', data: [] }),
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

  describe('personal applications', () => {
    const jobs = { moduleId: 8, moduleKey: 'JOBPORTAL', moduleName: 'Job Portal', description: 'Your profile', icon: 'badge', family: '', routePath: '/apps/jobs', sortOrder: 1, isReleased: true };
    const expense = { moduleId: 9, moduleKey: 'EXPENSE', moduleName: 'Expense Manager', description: 'Your money', icon: 'savings', family: '', routePath: '', sortOrder: 2, isReleased: false };

    const cards = (fixture: any) => Array.from(fixture.nativeElement.querySelectorAll('.personal-app-item')) as HTMLElement[];

    it('lists them under the companies', () => {
      auth.getPersonalApps = () => of({ success: true, message: '', data: [jobs, expense] });
      const fixture = create('company');

      expect(cards(fixture).length).toBe(2);
      expect(fixture.nativeElement.textContent).toContain('Personal applications');
      expect(cards(fixture)[0].textContent).toContain('Job Portal');
    });

    it('lists them also for a user without a company', () => {
      auth.companies = () => [];
      auth.getPersonalApps = () => of({ success: true, message: '', data: [jobs] });
      const fixture = create('company');

      expect(cards(fixture).length).toBe(1);
    });

    it('highlights an application that is not released and disables its card', () => {
      auth.getPersonalApps = () => of({ success: true, message: '', data: [jobs, expense] });
      const fixture = create('company');

      expect(cards(fixture)[0].classList.contains('disabled')).toBe(false);
      expect(cards(fixture)[0].querySelector('.soon-badge')).toBeNull();
      expect(cards(fixture)[1].classList.contains('disabled')).toBe(true);
      expect(cards(fixture)[1].querySelector('.soon-badge')?.textContent?.trim()).toBe('Coming soon');
    });

    it('opens a released application at its route and nothing else', () => {
      auth.getPersonalApps = () => of({ success: true, message: '', data: [jobs, expense] });
      const fixture = create('company');
      const opened: string[] = [];
      TestBed.inject(Router).navigateByUrl = ((url: string) => { opened.push(url); return Promise.resolve(true); }) as any;

      fixture.componentInstance.openPersonalApp(expense as any);
      expect(opened).toEqual([]);

      fixture.componentInstance.openPersonalApp(jobs as any);
      expect(opened).toEqual(['/apps/jobs']);
    });

    it('does not open a released application that has no route, or a route to another site', () => {
      const fixture = create('company');
      const opened: string[] = [];
      TestBed.inject(Router).navigateByUrl = ((url: string) => { opened.push(url); return Promise.resolve(true); }) as any;

      fixture.componentInstance.openPersonalApp({ ...jobs, routePath: '' } as any);
      fixture.componentInstance.openPersonalApp({ ...jobs, routePath: 'https://example.com' } as any);
      fixture.componentInstance.openPersonalApp({ ...jobs, routePath: '//example.com' } as any);

      expect(opened).toEqual([]);
    });

    it('shows no block when there are none', () => {
      const fixture = create('company');

      expect(cards(fixture).length).toBe(0);
      expect(fixture.nativeElement.textContent).not.toContain('Personal applications');
    });

    it('keeps the company list working when the call fails', () => {
      auth.getPersonalApps = () => throwError(() => ({ status: 500 }));
      const fixture = create('company');

      expect(fixture.nativeElement.querySelectorAll('.company-item:not(.personal-app-item)').length).toBe(1);
      expect(cards(fixture).length).toBe(0);
      expect(fixture.componentInstance.error()).toBe('');
    });

    it('keeps the company list working when the answer is a refusal', () => {
      auth.getPersonalApps = () => of({ success: false, message: 'no', data: null });
      const fixture = create('company');

      expect(cards(fixture).length).toBe(0);
      expect(fixture.componentInstance.error()).toBe('');
    });

    it('does not ask for them on the module and branch steps', () => {
      let asked = 0;
      auth.getPersonalApps = () => { asked++; return of({ success: true, message: '', data: [jobs] }); };

      create('module');
      create('branch', 'SERVICE');

      expect(asked).toBe(0);
    });
  });

  it('shows a module that is not released with the Coming soon badge and does not open it', () => {
    auth.getModules = () => of({ success: true, message: '', data: [
      modules[0],
      { moduleId: 5, moduleKey: 'PAYROLL', moduleName: 'Payroll', description: 'd', icon: 'payments', sortOrder: 5, state: 'ComingSoon' },
    ] });
    const fixture = create('module');
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.module-item')) as HTMLElement[];

    expect(cards[0].querySelector('.soon-badge')).toBeNull();
    expect(cards[1].classList.contains('disabled')).toBe(true);
    expect(cards[1].querySelector('.soon-badge')?.textContent?.trim()).toBe('Coming soon');

    fixture.componentInstance.openModule({ moduleKey: 'PAYROLL', state: 'ComingSoon' } as any);
    expect(navigated.length).toBe(0);
  });

  it('opens Job Consultancy at its first page, without a branch, and only when it is available', () => {
    const fixture = create('module');

    fixture.componentInstance.openModule({ moduleKey: 'JOBCONSULTANCY', state: 'NotSubscribed' } as any);
    expect(navigated.length).toBe(0);

    fixture.componentInstance.openModule({ moduleKey: 'JOBCONSULTANCY', state: 'Available' } as any);
    expect(navigated.at(-1)![0]).toEqual(['/consultancy/postings']);
  });

  it('shows the Individual ID of the user on the company step', () => {
    auth.currentUser = () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin: false, individualId: 'EZ-7K4M-2P9Q-XD3Q' });
    const fixture = create('company');

    const line = fixture.nativeElement.querySelector('.individual-id') as HTMLElement;
    expect(line.textContent).toContain('Individual ID');
    expect(line.textContent).toContain('EZ-7K4M-2P9Q-XD3Q');
  });

  describe('finding a company', () => {
    const many = (count: number) => Array.from({ length: count }, (_, i) =>
      ({ companyId: i + 1, companyName: 'Company ' + (i + 1), companyCode: 'C' + (i + 1), roleInCompany: 'Admin', isLinked: false, provisionStatus: 'Ready' }));
    const names = (fixture: any) => (Array.from(fixture.nativeElement.querySelectorAll('.company-item h3')) as HTMLElement[]).map(h => h.textContent);

    it('shows no search box for six companies or fewer', () => {
      auth.companies = () => many(6);
      const fixture = create('company');

      expect(fixture.nativeElement.querySelector('.search')).toBeNull();
      expect(names(fixture).length).toBe(6);
    });

    it('finds a company by its name or its code, whatever the case', () => {
      auth.companies = () => [...many(7), { ...many(1)[0], companyId: 99, companyName: 'Hamster A/C', companyCode: 'HAM' }];
      const fixture = create('company');
      const c = fixture.componentInstance;
      expect(fixture.nativeElement.querySelector('.search')).not.toBeNull();

      c.search.set(' hamster ');
      fixture.detectChanges();
      expect(names(fixture)).toEqual(['Hamster A/C']);

      c.search.set('c7');
      fixture.detectChanges();
      expect(names(fixture)).toEqual(['Company 7']);

      c.search.set('');
      fixture.detectChanges();
      expect(names(fixture).length).toBe(8);
    });

    it('says so when no company matches', () => {
      auth.companies = () => many(7);
      const fixture = create('company');
      fixture.componentInstance.search.set('zzz');
      fixture.detectChanges();

      expect(names(fixture).length).toBe(0);
      expect(fixture.nativeElement.querySelector('.no-match').textContent).toContain('No company matches');
    });
  });

  it('puts the personal applications in Quick Access and the companies in the workspace switcher', () => {
    auth.getPersonalApps = () => of({ success: true, message: '', data: [
      { moduleId: 8, moduleKey: 'JOBPORTAL', moduleName: 'Job Portal', description: 'd', icon: 'badge', family: '', routePath: '/apps/jobs', sortOrder: 1, isReleased: true },
    ] });
    const fixture = create('company');

    expect(fixture.nativeElement.querySelector('#quick-access').querySelectorAll('.personal-app-item').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.ws-menu').querySelectorAll('.company-item').length).toBe(1);
  });

  it('stands a company on its card with up to two letters of its name', () => {
    const c = create('company').componentInstance;

    expect(c.initials('Encryptz ERP Solutions Private Limited')).toBe('EE');
    expect(c.initials('Hamster A/C')).toBe('HA');
    expect(c.initials('denzmart')).toBe('DE');
    expect(c.initials('')).toBe('?');
  });

  it('shows no Individual ID line when the user has none yet', () => {
    const fixture = create('company');

    expect(fixture.nativeElement.querySelector('.individual-id')).toBeNull();
  });
});

describe('CompanySelectorComponent company creation', () => {
  const company = (id: number, status: string, isCreator = false) =>
    ({ companyId: id, companyName: 'Co ' + id, companyCode: 'C' + id, roleInCompany: 'Admin', isLinked: false, provisionStatus: status, isCreator });
  const state = (canCreate: boolean, message = '') => ({ success: true, message: '', data: { canCreate, created: canCreate ? 0 : 1, limit: 1, message } });

  let auth: any;
  let calls: any[][];
  let list: any[];
  let navigated: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CompanySelectorComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { stage: 'company' }, queryParamMap: { get: () => null } } } },
      ],
    });
    navigated = [];
    const router = TestBed.inject(Router);
    router.navigate = ((commands: any[], extras?: any) => { navigated.push(extras ? [commands, extras] : [commands]); return Promise.resolve(true); }) as any;
    const fixture = TestBed.createComponent(CompanySelectorComponent);
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: any) => fixture.nativeElement.textContent as string;
  const button = (fixture: any, label: string) =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(b => b.textContent?.trim().startsWith(label));

  beforeEach(() => {
    localStorage.clear();
    calls = [];
    list = [company(2, 'Ready')];
    auth = {
      userId: () => 5,
      userRole: () => 'Admin',
      currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin: false }),
      companies: () => [],
      selectedModuleKey: () => null,
      scopeState: () => ({ loggedIn: true, companyId: null, moduleKey: null, locationId: null }),
      getUserCompanies: () => { calls.push(['getUserCompanies']); return of(list); },
      getCompanyCreation: () => { calls.push(['getCompanyCreation']); return of(state(true)); },
      getPersonalApps: () => of({ success: true, message: '', data: [] }),
      createCompany: (form: any) => { calls.push(['createCompany', form]); list = [...list, company(9, 'Provisioning', true)]; return of({ success: true, message: 'ok', data: { companyId: 9, provisionStatus: 'Provisioning' } }); },
      retryProvision: (id: number) => { calls.push(['retryProvision', id]); return of({ success: true, message: 'ok', data: true }); },
      selectCompany: (id: number) => { calls.push(['selectCompany', id]); return of({ success: true, message: '', data: { role: 'Admin' } }); },
      logout: () => {},
    };
  });

  it('reads the list and the creation state from the API when the step opens', () => {
    create();
    expect(calls).toContainEqual(['getUserCompanies']);
    expect(calls).toContainEqual(['getCompanyCreation']);
  });

  it('keeps the list from login when the API cannot be reached', () => {
    auth.companies = () => [company(2, 'Ready')];
    auth.getUserCompanies = () => throwError(() => new Error('offline'));
    const fixture = create();

    expect(fixture.nativeElement.querySelectorAll('.company-item').length).toBe(1);
    expect(fixture.componentInstance.error()).toBe('');
  });

  it('offers Create Company and opens the form', () => {
    const fixture = create();
    const btn = button(fixture, 'Create Company')!;
    expect(btn.disabled).toBe(false);

    btn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.showCreate()).toBe(true);
    expect(fixture.nativeElement.querySelector('.create-form')).not.toBeNull();
  });

  it('disables Create Company with the reason when the limit is reached', () => {
    auth.getCompanyCreation = () => of(state(false, 'You can create 1 company. You have reached the limit.'));
    const fixture = create();

    expect(button(fixture, 'Create Company')!.disabled).toBe(true);
    expect(text(fixture)).toContain('You have reached the limit');
  });

  it('shows the empty state with Create Company and the way to invitations', () => {
    list = [];
    const fixture = create();

    expect(text(fixture)).toContain('You are not in a company yet');
    expect(button(fixture, 'Create Company')).toBeDefined();
    button(fixture, 'Invitations and join requests')!.click();
    expect(navigated).toContainEqual([['/no-company']]);
  });

  it('suggests the code from the name until the code is typed by hand', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();

    c.createForm.companyName = 'Hamster A/C';
    c.onNameTyped();
    expect(c.createForm.companyCode).toBe('HAMSTERA');

    c.createForm.companyCode = 'HAM';
    c.onCodeTyped();
    c.createForm.companyName = 'Hamster Cooling';
    c.onNameTyped();
    expect(c.createForm.companyCode).toBe('HAM');
  });

  it('does not send an incomplete form', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.companyName = 'A';
    c.submitCreate();

    expect(c.createError()).toBe('Enter the company name');
    expect(calls.some(x => x[0] === 'createCompany')).toBe(false);
  });

  it('creates the company, closes the form, shows it as setting up and starts polling', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.companyName = 'New Co';
    c.createForm.companyCode = 'NEW1';
    c.submitCreate();
    fixture.detectChanges();

    expect(calls.filter(x => x[0] === 'createCompany').length).toBe(1);
    expect(c.showCreate()).toBe(false);
    expect(text(fixture)).toContain('Setting up…');
    expect(c.polling()).toBe(true);
  });

  it('sends only one request when Create is pressed twice', () => {
    const pending = new Subject<any>();
    auth.createCompany = (form: any) => { calls.push(['createCompany', form]); return pending; };
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.companyName = 'New Co';
    c.createForm.companyCode = 'NEW1';
    c.submitCreate();
    c.submitCreate();
    fixture.detectChanges();

    expect(calls.filter(x => x[0] === 'createCompany').length).toBe(1);
    expect(button(fixture, 'Creating')!.disabled).toBe(true);
  });

  it('shows why the server refused, inside the form', () => {
    auth.createCompany = () => of({ success: false, message: 'This company code is already in use', data: null });
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.companyName = 'New Co';
    c.createForm.companyCode = 'NEW1';
    c.submitCreate();
    fixture.detectChanges();

    expect(c.showCreate()).toBe(true);
    expect(text(fixture)).toContain('This company code is already in use');
  });

  it('explains a rate limit', () => {
    auth.createCompany = () => throwError(() => ({ status: 429 }));
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.companyName = 'New Co';
    c.createForm.companyCode = 'NEW1';
    c.submitCreate();

    expect(c.createError()).toBe('Too many attempts. Please try again later.');
  });

  it('does not let a company that is being set up or failed be entered', () => {
    list = [company(3, 'Provisioning', true), company(4, 'Failed', true)];
    const fixture = create();
    const rows = fixture.nativeElement.querySelectorAll('.company-item') as NodeListOf<HTMLElement>;

    rows[0].click();
    rows[1].click();
    rows[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(calls.some(x => x[0] === 'selectCompany')).toBe(false);
    expect(rows[0].getAttribute('aria-disabled')).toBe('true');
    expect(rows[0].getAttribute('tabindex')).toBe('-1');
  });

  it('still enters a ready company', () => {
    const fixture = create();
    (fixture.nativeElement.querySelector('.company-item') as HTMLElement).click();
    expect(calls).toContainEqual(['selectCompany', 2]);
  });

  it('offers Retry to the creator of a failed company only', () => {
    list = [company(4, 'Failed', true), company(5, 'Failed', false)];
    const fixture = create();
    const rows = fixture.nativeElement.querySelectorAll('.company-item') as NodeListOf<HTMLElement>;

    expect(rows[0].querySelector('.retry-btn')).not.toBeNull();
    expect(rows[1].querySelector('.retry-btn')).toBeNull();
    expect(rows[1].textContent).toContain('Ask the person who created this company to retry');
  });

  it('retries once, then reloads and polls', () => {
    list = [company(4, 'Failed', true)];
    const pending = new Subject<any>();
    auth.retryProvision = (id: number) => { calls.push(['retryProvision', id]); return pending; };
    const fixture = create();
    const c = fixture.componentInstance;

    c.retry(list[0]);
    c.retry(list[0]);
    expect(calls.filter(x => x[0] === 'retryProvision')).toEqual([['retryProvision', 4]]);

    list = [company(4, 'Provisioning', true)];
    const before = calls.filter(x => x[0] === 'getUserCompanies').length;
    pending.next({ success: true, message: 'ok', data: true });
    pending.complete();
    fixture.detectChanges();

    expect(calls.filter(x => x[0] === 'getUserCompanies').length).toBe(before + 1);
    expect(c.retrying()).toBeNull();
    expect(c.polling()).toBe(true);
  });

  it('shows why a retry was refused', () => {
    list = [company(4, 'Failed', true)];
    auth.retryProvision = () => of({ success: false, message: 'The earlier set-up is still being cleaned up. Try again in a few minutes.', data: false });
    const fixture = create();
    fixture.componentInstance.retry(list[0]);
    fixture.detectChanges();

    expect(text(fixture)).toContain('still being cleaned up');
  });

  it('stops polling when nothing is being set up any more', () => {
    list = [company(3, 'Provisioning', true)];
    const fixture = create();
    const c = fixture.componentInstance;
    expect(c.polling()).toBe(true);

    list = [company(3, 'Ready', true)];
    c.pollOnce();
    fixture.detectChanges();

    expect(c.polling()).toBe(false);
    expect(text(fixture)).not.toContain('Setting up…');
  });

  it('asks again on the timer while a company is being set up, and not after the screen is left', () => {
    vi.useFakeTimers();
    try {
      list = [company(3, 'Provisioning', true)];
      const fixture = create();
      const count = () => calls.filter(x => x[0] === 'getUserCompanies').length;
      const first = count();

      vi.advanceTimersByTime(5000);
      expect(count()).toBe(first + 1);

      fixture.destroy();
      vi.advanceTimersByTime(20000);
      expect(count()).toBe(first + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a late answer after the screen was left', () => {
    list = [company(3, 'Provisioning', true)];
    const late = new Subject<any[]>();
    const fixture = create();
    const c = fixture.componentInstance;
    auth.getUserCompanies = () => late;
    c.pollOnce();
    fixture.destroy();

    late.next([company(3, 'Ready', true)]);

    expect(c.companies()[0].provisionStatus).toBe('Provisioning');
  });

  it('gives up polling after the limit and offers Refresh', () => {
    vi.useFakeTimers();
    try {
      list = [company(3, 'Provisioning', true)];
      const fixture = create();
      const c = fixture.componentInstance;

      vi.advanceTimersByTime(25 * 60 * 1000 + 5000);
      fixture.detectChanges();

      expect(c.polling()).toBe(false);
      expect(c.pollStopped()).toBe(true);
      expect(text(fixture)).toContain('Still setting up. Come back in a few minutes.');
      expect(button(fixture, 'Refresh')).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  const count = (name: string) => calls.filter(x => x[0] === name).length;

  it('ignores a poll answer that arrives while a company is being entered', () => {
    vi.useFakeTimers();
    try {
      list = [company(2, 'Ready'), company(3, 'Provisioning', true)];
      const fixture = create();
      const c = fixture.componentInstance;
      expect(c.polling()).toBe(true);

      const late = new Subject<any[]>();
      auth.getUserCompanies = () => { calls.push(['getUserCompanies']); return late; };
      c.pollOnce();
      const sel = new Subject<any>();
      auth.selectCompany = (id: number) => { calls.push(['selectCompany', id]); return sel; };
      (fixture.nativeElement.querySelector('.company-item') as HTMLElement).click();
      expect(c.loading()).toBe(true);
      expect(c.polling()).toBe(false);

      late.next([company(2, 'Ready'), company(3, 'Provisioning', true)]);
      late.complete();
      expect(c.loading()).toBe(true);
      expect(c.polling()).toBe(false);

      const before = count('getUserCompanies');
      vi.advanceTimersByTime(10000);
      expect(count('getUserCompanies')).toBe(before);

      c.selectCompany(company(2, 'Ready'));
      expect(count('selectCompany')).toBe(1);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets the company be entered again, and polls again, when entering is refused', () => {
    list = [company(2, 'Ready'), company(3, 'Provisioning', true)];
    auth.selectCompany = (id: number) => { calls.push(['selectCompany', id]); return of({ success: false, message: 'No access', data: null }); };
    const fixture = create();
    const c = fixture.componentInstance;

    c.selectCompany(list[0]);
    expect(c.polling()).toBe(true);
    c.selectCompany(list[0]);

    expect(count('selectCompany')).toBe(2);
    fixture.destroy();
  });

  it('does not stack requests while an answer is still on its way', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const pending: Subject<any[]>[] = [];
    auth.getUserCompanies = () => { calls.push(['getUserCompanies']); const s = new Subject<any[]>(); pending.push(s); return s; };
    const before = count('getUserCompanies');

    c.pollOnce();
    c.pollOnce();
    c.pollOnce();
    expect(count('getUserCompanies')).toBe(before + 1);

    pending[0].next(list);
    pending[0].complete();
    c.pollOnce();
    expect(count('getUserCompanies')).toBe(before + 2);
  });

  it('ignores an older answer that arrives after a newer one', () => {
    list = [company(3, 'Failed', true)];
    const fixture = create();
    const c = fixture.componentInstance;
    const older = new Subject<any[]>();
    auth.getUserCompanies = () => older;
    c.pollOnce();
    auth.getUserCompanies = () => of([company(3, 'Ready', true)]);
    c.retry(list[0]);
    expect(c.companies()[0].provisionStatus).toBe('Ready');

    older.next([company(3, 'Provisioning', true)]);
    older.complete();

    expect(c.companies()[0].provisionStatus).toBe('Ready');
    expect(c.polling()).toBe(false);
  });

  it('keeps the known creation state when a later read fails', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    expect(c.creation()?.canCreate).toBe(true);

    auth.getCompanyCreation = () => throwError(() => new Error('offline'));
    c.pollOnce();

    expect(c.creation()?.canCreate).toBe(true);
  });

  it('does not let the row take Space or Enter pressed on the Retry button', () => {
    list = [company(4, 'Failed', true)];
    const fixture = create();
    const retryBtn = fixture.nativeElement.querySelector('.retry-btn') as HTMLElement;

    for (const key of [' ', 'Enter']) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      retryBtn.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    }
    expect(count('selectCompany')).toBe(0);
  });

  it('enters a ready company with Enter on the row itself', () => {
    const fixture = create();
    const row = fixture.nativeElement.querySelector('.company-item') as HTMLElement;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(calls).toContainEqual(['selectCompany', 2]);
  });

  it('starts the 25 minute limit again after a successful retry', () => {
    vi.useFakeTimers();
    try {
      list = [company(3, 'Provisioning', true)];
      const fixture = create();
      const c = fixture.componentInstance;

      vi.advanceTimersByTime(20 * 60 * 1000);
      expect(c.polling()).toBe(true);
      c.retry(list[0]);
      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(c.polling()).toBe(true);
      expect(c.pollStopped()).toBe(false);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows no general error beside the create form', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.error.set('Could not retry the set-up');
    c.openCreate();
    expect(c.error()).toBe('');

    c.error.set('Something else');
    fixture.detectChanges();
    const outside = (Array.from(fixture.nativeElement.querySelectorAll('.error-msg')) as HTMLElement[])
      .filter(e => !e.closest('.create-form'));
    expect(outside.length).toBe(0);
  });

  it('reads the list again after a retry was refused', () => {
    list = [company(4, 'Failed', true)];
    auth.retryProvision = () => of({ success: false, message: 'This company is not waiting for a retry', data: false });
    const fixture = create();
    const before = count('getUserCompanies');
    list = [company(4, 'Ready', true)];

    fixture.componentInstance.retry(list[0]);
    fixture.detectChanges();

    expect(count('getUserCompanies')).toBe(before + 1);
    expect(fixture.componentInstance.companies()[0].provisionStatus).toBe('Ready');
    expect(text(fixture)).toContain('This company is not waiting for a retry');
  });

  it('reads the list again when the answer to a create was lost', () => {
    auth.createCompany = () => throwError(() => ({ status: 0 }));
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.companyName = 'New Co';
    c.createForm.companyCode = 'NEW1';
    const before = count('getUserCompanies');
    list = [...list, company(9, 'Provisioning', true)];

    c.submitCreate();

    expect(c.createError()).toBe('Could not create the company');
    expect(count('getUserCompanies')).toBe(before + 1);
    expect(c.companies().length).toBe(2);
  });

  it('polls after a create even when the list cannot be read, and the next tick heals the list', () => {
    vi.useFakeTimers();
    try {
      const fixture = create();
      const c = fixture.componentInstance;
      expect(c.polling()).toBe(false);
      c.openCreate();
      c.createForm.companyName = 'New Co';
      c.createForm.companyCode = 'NEW1';
      auth.createCompany = () => {
        calls.push(['createCompany']);
        list = [...list, company(9, 'Provisioning', true)];
        auth.getUserCompanies = () => throwError(() => new Error('offline'));
        return of({ success: true, message: 'ok', data: { companyId: 9, provisionStatus: 'Provisioning' } });
      };
      c.submitCreate();
      expect(c.polling()).toBe(true);

      auth.getUserCompanies = () => { calls.push(['getUserCompanies']); return of(list); };
      const before = count('getUserCompanies');
      vi.advanceTimersByTime(5000);

      expect(count('getUserCompanies')).toBe(before + 1);
      expect(c.companies().length).toBe(2);
      expect(c.polling()).toBe(true);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('polls after a retry even when the list cannot be read, and shows the row as being set up', () => {
    list = [company(4, 'Failed', true)];
    const fixture = create();
    const c = fixture.componentInstance;
    auth.getUserCompanies = () => throwError(() => new Error('offline'));

    c.retry(list[0]);

    expect(c.companies()[0].provisionStatus).toBe('Provisioning');
    expect(c.polling()).toBe(true);
    fixture.destroy();
  });

  it('polls when the screen opens with a kept company being set up and the API cannot be read', () => {
    auth.companies = () => [company(3, 'Provisioning', true)];
    auth.getUserCompanies = () => throwError(() => new Error('offline'));
    const fixture = create();

    expect(fixture.componentInstance.polling()).toBe(true);
    fixture.destroy();
  });

  it('says so, with Refresh, when the creation state could not be read; not while it is on its way', () => {
    const pending = new Subject<any>();
    auth.getCompanyCreation = () => pending;
    const fixture = create();
    fixture.detectChanges();
    expect(text(fixture)).not.toContain('Could not check whether you can create a company.');
    expect(button(fixture, 'Create Company')!.disabled).toBe(true);

    pending.error(new Error('offline'));
    fixture.detectChanges();
    expect(text(fixture)).toContain('Could not check whether you can create a company.');
    expect(button(fixture, 'Refresh')).toBeDefined();

    auth.getCompanyCreation = () => { calls.push(['getCompanyCreation']); return of(state(true)); };
    button(fixture, 'Refresh')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.creation()?.canCreate).toBe(true);
    expect(text(fixture)).not.toContain('Could not check whether you can create a company.');
  });

  it('says so in the empty state too', () => {
    list = [];
    auth.getCompanyCreation = () => throwError(() => new Error('offline'));
    const fixture = create();
    fixture.detectChanges();

    expect(text(fixture)).toContain('You are not in a company yet');
    expect(text(fixture)).toContain('Could not check whether you can create a company.');
    expect(button(fixture, 'Refresh')).toBeDefined();
  });

  it('labels the general error button Refresh on the company screen', () => {
    const fixture = create();
    fixture.componentInstance.error.set('Something went wrong');
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.error-msg .retry-btn') as HTMLElement;
    expect(btn.textContent?.trim()).toBe('Refresh');
  });

  it('does not navigate when the screen is gone before the company is entered', () => {
    const sel = new Subject<any>();
    auth.selectCompany = () => sel;
    const fixture = create();
    fixture.componentInstance.selectCompany(company(2, 'Ready'));
    fixture.destroy();

    sel.next({ success: true, message: '', data: { role: 'Admin' } });

    expect(navigated.length).toBe(0);
  });

  it('gives up a list read that never answers after 20 seconds and sends a new request on a later tick', () => {
    vi.useFakeTimers();
    try {
      list = [company(3, 'Provisioning', true)];
      const fixture = create();
      const c = fixture.componentInstance;
      auth.getUserCompanies = () => { calls.push(['getUserCompanies']); return new Subject<any[]>(); };
      const before = count('getUserCompanies');

      vi.advanceTimersByTime(5000);
      expect(count('getUserCompanies')).toBe(before + 1);
      vi.advanceTimersByTime(19000);
      expect(count('getUserCompanies')).toBe(before + 1);

      vi.advanceTimersByTime(7000);
      expect(count('getUserCompanies')).toBeGreaterThanOrEqual(before + 2);
      expect(c.polling()).toBe(true);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
