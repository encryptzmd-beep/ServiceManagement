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
    expect(navigated).toEqual([[['/technicians/work-orders']]]);
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
    expect(navigated).toEqual([[['/select-module']]]);
  });
});
