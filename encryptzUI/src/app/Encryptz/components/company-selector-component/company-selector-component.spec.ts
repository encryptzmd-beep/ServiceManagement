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
});
