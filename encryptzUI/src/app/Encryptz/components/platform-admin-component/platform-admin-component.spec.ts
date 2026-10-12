import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { PlatformService } from '../../Services/platform-service';
import { PlatformAdminComponent } from './platform-admin-component';

describe('PlatformAdminComponent modules', () => {
  const company = { companyId: 2, companyName: 'Hamster A/C', companyCode: 'C002', address: '', city: '', phoneNumber: '', isActive: true, projectCount: 1, userCount: 3 };
  const serviceModule = { moduleId: 1, moduleKey: 'SERVICE', moduleName: 'Service Management', description: 'd', icon: 'build', sortOrder: 1, isEnabled: true, userCount: 3 };
  const salesModule = { moduleId: 2, moduleKey: 'SALES', moduleName: 'Sales', description: 'd', icon: 'sell', sortOrder: 2, isEnabled: false, userCount: 0 };

  let api: any;
  let calls: any[][];
  let switched: Record<string, boolean>;

  const create = (isPlatformAdmin: boolean) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PlatformAdminComponent],
      providers: [
        { provide: PlatformService, useValue: api },
        { provide: AuthService, useValue: {
          currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin }),
          selectedCompanyId: () => 2,
        } },
      ],
    });
    const fixture = TestBed.createComponent(PlatformAdminComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    calls = [];
    switched = {};
    api = {
      isUnlocked: () => of({ success: true, unlocked: true }),
      getCompanies: () => of({ success: true, message: '', data: [company] }),
      getProjects: () => of({ success: true, message: '', data: [] }),
      getCompanyModules: (companyId: number) => {
        calls.push(['getCompanyModules', companyId]);
        return of({ success: true, message: '', data: [serviceModule, salesModule].map(m => ({ ...m, isEnabled: switched[m.moduleKey] ?? m.isEnabled })) });
      },
      setCompanyModule: (companyId: number, key: string, on: boolean) => { calls.push(['setCompanyModule', companyId, key, on]); switched[key] = on; return of({ success: true, message: 'Sales switched on', data: true }); },
      lock: () => {},
    };
  });

  const openDialog = (fixture: any) => {
    fixture.componentInstance.openModules(company);
    fixture.detectChanges();
  };

  it('offers Modules on each company row', () => {
    const fixture = create(true);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.some(b => b.textContent?.trim() === 'Modules')).toBe(true);
  });

  it('lists every module of the catalogue for the company', () => {
    const fixture = create(true);
    openDialog(fixture);

    expect(calls).toContainEqual(['getCompanyModules', 2]);
    const rows = fixture.nativeElement.querySelectorAll('.pa-module-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Service Management');
    expect(rows[1].textContent).toContain('Sales');
  });

  it('lets a platform administrator switch a module', () => {
    const fixture = create(true);
    openDialog(fixture);

    const boxes = fixture.nativeElement.querySelectorAll('.pa-module-row input[type=checkbox]') as NodeListOf<HTMLInputElement>;
    expect(boxes[1].disabled).toBe(false);
    boxes[1].click();
    fixture.detectChanges();

    expect(calls).toContainEqual(['setCompanyModule', 2, 'SALES', true]);
    expect(fixture.componentInstance.companyModules()[1].isEnabled).toBe(true);
  });

  it('shows the modules read-only to a company administrator', () => {
    const fixture = create(false);
    openDialog(fixture);

    const boxes = fixture.nativeElement.querySelectorAll('.pa-module-row input[type=checkbox]') as NodeListOf<HTMLInputElement>;
    expect(boxes.length).toBe(2);
    expect(boxes[0].disabled).toBe(true);
    expect(boxes[1].disabled).toBe(true);

    fixture.componentInstance.toggleCompanyModule(salesModule as any);
    expect(calls.some(c => c[0] === 'setCompanyModule')).toBe(false);
  });

  it('keeps the switch as it was when the server refuses', () => {
    api.setCompanyModule = (companyId: number, key: string, on: boolean) => {
      calls.push(['setCompanyModule', companyId, key, on]);
      return of({ success: false, message: 'Only a platform administrator can switch modules', data: false });
    };
    const fixture = create(true);
    openDialog(fixture);

    fixture.componentInstance.toggleCompanyModule(salesModule as any);
    fixture.detectChanges();

    expect(fixture.componentInstance.companyModules()[1].isEnabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Only a platform administrator can switch modules');
  });

  it('puts the checkbox back when the server refuses', () => {
    api.setCompanyModule = () => of({ success: false, message: 'No', data: false });
    const fixture = create(true);
    openDialog(fixture);

    const boxes = fixture.nativeElement.querySelectorAll('.pa-module-row input[type=checkbox]') as NodeListOf<HTMLInputElement>;
    boxes[1].click();
    fixture.detectChanges();

    expect(boxes[1].checked).toBe(false);
  });

  it('asks before switching the Service module off', () => {
    const fixture = create(true);
    openDialog(fixture);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    fixture.componentInstance.toggleCompanyModule(serviceModule as any);

    expect(confirmSpy).toHaveBeenCalled();
    expect(calls.some(c => c[0] === 'setCompanyModule')).toBe(false);
    confirmSpy.mockRestore();
  });

  const boxesOf = (fixture: any) => fixture.nativeElement.querySelectorAll('.pa-module-row input[type=checkbox]') as NodeListOf<HTMLInputElement>;
  const okList = { success: true, message: '', data: [serviceModule, salesModule] };

  it('shows the error and restores the checkbox when switching fails', () => {
    api.setCompanyModule = () => throwError(() => ({ status: 500, error: {} }));
    const fixture = create(true);
    openDialog(fixture);

    boxesOf(fixture)[1].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Could not switch the module');
    expect(boxesOf(fixture)[1].checked).toBe(false);
  });

  it('keeps the Service checkbox checked when the confirm is cancelled', () => {
    const fixture = create(true);
    openDialog(fixture);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    boxesOf(fixture)[0].click();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalled();
    expect(boxesOf(fixture)[0].checked).toBe(true);
    confirmSpy.mockRestore();
  });

  it('leaves the checkbox checked after a successful switch', () => {
    const fixture = create(true);
    openDialog(fixture);

    boxesOf(fixture)[1].click();
    fixture.detectChanges();

    expect(boxesOf(fixture)[1].checked).toBe(true);
    expect(calls).toContainEqual(['setCompanyModule', 2, 'SALES', true]);
    expect(fixture.componentInstance.companyModules()[1].isEnabled).toBe(true);
  });

  it('ignores the late list of a dialog that was closed', () => {
    const late = new Subject<any>();
    const companyB = { ...company, companyId: 3, companyName: 'B' };
    const listB = { success: true, message: '', data: [salesModule] };
    api.getCompanyModules = (id: number) => id === 2 ? late : of(listB);
    const fixture = create(true);

    fixture.componentInstance.openModules(company);
    fixture.componentInstance.closeModules();
    fixture.componentInstance.openModules(companyB);
    late.next(okList);
    fixture.detectChanges();

    expect(fixture.componentInstance.companyModules()).toEqual([salesModule]);
  });

  it('ignores the late answer of a switch after the dialog was closed', () => {
    const late = new Subject<any>();
    api.setCompanyModule = () => late;
    const fixture = create(true);
    openDialog(fixture);

    boxesOf(fixture)[1].click();
    fixture.componentInstance.closeModules();
    late.next({ success: true, message: 'Sales switched on', data: true });
    fixture.detectChanges();

    expect(fixture.componentInstance.toast()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Sales switched on');
    expect(fixture.componentInstance.companyModules()).toEqual([]);
  });

  it('disables the checkbox and sends no second request while a switch is in flight', () => {
    const late = new Subject<any>();
    api.setCompanyModule = (companyId: number, key: string, on: boolean) => { calls.push(['setCompanyModule', companyId, key, on]); return late; };
    const fixture = create(true);
    openDialog(fixture);

    boxesOf(fixture)[1].click();
    fixture.detectChanges();
    expect(boxesOf(fixture)[1].disabled).toBe(true);

    fixture.componentInstance.toggleCompanyModule(salesModule as any);
    expect(calls.filter(c => c[0] === 'setCompanyModule').length).toBe(1);

    late.next({ success: true, message: 'ok', data: true });
    late.complete();
    fixture.detectChanges();
    expect(boxesOf(fixture)[1].disabled).toBe(false);
  });

  it('shows the real member count after a module is switched on', () => {
    let loads = 0;
    api.getCompanyModules = () => {
      loads++;
      const sales = loads === 1 ? salesModule : { ...salesModule, isEnabled: true, userCount: 4 };
      return of({ success: true, message: '', data: [serviceModule, sales] });
    };
    const fixture = create(true);
    openDialog(fixture);
    expect(fixture.nativeElement.textContent).not.toContain('On · 4 users');

    boxesOf(fixture)[1].click();
    fixture.detectChanges();

    expect(loads).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('On · 4 users');
  });

  it('closes the Modules dialog with the other forms', () => {
    const fixture = create(true);
    openDialog(fixture);

    fixture.componentInstance.closeForms();

    expect(fixture.componentInstance.modulesCompany()).toBeNull();
  });
});

describe('PlatformAdminComponent module access', () => {
  const project = { projectId: 2, companyId: 2, companyName: 'Hamster A/C', projectName: 'Service Management', projectKey: 'C002-P001', isActive: true, serverName: '', databaseName: '', dbUser: '', extraOptions: '' };
  const serviceModule = { moduleId: 1, moduleKey: 'SERVICE', moduleName: 'Service Management', description: 'd', icon: 'build', sortOrder: 1, isEnabled: true, userCount: 2 };
  const salesModule = { moduleId: 2, moduleKey: 'SALES', moduleName: 'Sales', description: 'd', icon: 'sell', sortOrder: 2, isEnabled: true, userCount: 1 };
  const offModule = { moduleId: 3, moduleKey: 'HR', moduleName: 'HR', description: 'd', icon: 'groups', sortOrder: 3, isEnabled: false, userCount: 0 };
  const member = (userId: number, name: string, role: string, hasAccess: boolean) =>
    ({ userId, fullName: name, email: name + '@x.test', mobileNumber: '', roleInCompany: role, hasAccess });

  let api: any;
  let calls: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PlatformAdminComponent],
      providers: [
        { provide: PlatformService, useValue: api },
        { provide: AuthService, useValue: {
          currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin: true }),
          selectedCompanyId: () => 2,
        } },
      ],
    });
    const fixture = TestBed.createComponent(PlatformAdminComponent);
    fixture.detectChanges();
    fixture.componentInstance.setTab('access');
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    calls = [];
    api = {
      isUnlocked: () => of({ success: true, unlocked: true }),
      getCompanies: () => of({ success: true, message: '', data: [] }),
      getProjects: () => of({ success: true, message: '', data: [project] }),
      getCompanyModules: (companyId: number) => { calls.push(['getCompanyModules', companyId]); return of({ success: true, message: '', data: [serviceModule, salesModule, offModule] }); },
      getModuleAccess: (companyId: number, key: string) => { calls.push(['getModuleAccess', companyId, key]); return of({ success: true, message: '', data: [member(5, 'Admin A', 'Admin', true), member(8, 'Tech T', 'Technician', false)] }); },
      setModuleAccess: (companyId: number, key: string, userId: number, on: boolean) => { calls.push(['setModuleAccess', companyId, key, userId, on]); return of({ success: true, message: 'Access granted', data: true }); },
      lock: () => {},
    };
  });

  it('loads the access of the Service module of the company being worked in', () => {
    create();
    expect(calls).toContainEqual(['getCompanyModules', 2]);
    expect(calls).toContainEqual(['getModuleAccess', 2, 'SERVICE']);
  });

  it('offers only the modules the company has', () => {
    const fixture = create();
    const options = Array.from(fixture.nativeElement.querySelectorAll('.pa-module-picker option')) as HTMLOptionElement[];
    expect(options.map(o => o.textContent?.trim())).toEqual(['Service Management', 'Sales']);
  });

  it('reloads the list when another module is picked', () => {
    const salesList = { success: true, message: '', data: [member(9, 'Sales S', 'Technician', true)] };
    const baseStub = api.getModuleAccess;
    api.getModuleAccess = (companyId: number, key: string) =>
      key === 'SALES' ? (calls.push(['getModuleAccess', companyId, key]), of(salesList)) : baseStub(companyId, key);
    const fixture = create();
    fixture.componentInstance.onAccessModulePicked('SALES');
    fixture.detectChanges();

    expect(calls).toContainEqual(['getModuleAccess', 2, 'SALES']);
    expect(fixture.componentInstance.access().map(a => a.userId)).toEqual([9]);
    expect(fixture.nativeElement.textContent).toContain('Sales S');
    expect(fixture.nativeElement.textContent).not.toContain('Tech T');
  });

  it('gives a member access to the picked module', () => {
    const fixture = create();
    expect(fixture.componentInstance.usersWithAccess()).toBe(1);
    fixture.componentInstance.toggleAccess(member(8, 'Tech T', 'Technician', false) as any);
    fixture.detectChanges();

    expect(fixture.componentInstance.usersWithAccess()).toBe(2);

    expect(calls).toContainEqual(['setModuleAccess', 2, 'SERVICE', 8, true]);
    expect(fixture.componentInstance.access().find(a => a.userId === 8)?.hasAccess).toBe(true);
  });

  it('leaves the switch on when removing an administrator is refused', () => {
    api.setModuleAccess = (companyId: number, key: string, userId: number, on: boolean) => {
      calls.push(['setModuleAccess', companyId, key, userId, on]);
      return of({ success: false, message: 'Company administrators always have access. Change the role instead.', data: false });
    };
    const fixture = create();
    fixture.componentInstance.toggleAccess(member(5, 'Admin A', 'Admin', true) as any);
    fixture.detectChanges();

    expect(fixture.componentInstance.access().find(a => a.userId === 5)?.hasAccess).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Company administrators always have access');
  });

  it('says Branch and Module access, never Project or Location', () => {
    const fixture = create();
    const visible = (fixture.nativeElement.textContent as string);
    expect(visible).toContain('Module Access');
    expect(visible).toContain('Branches');
    expect(visible).not.toMatch(/Project/i);
    expect(visible).not.toMatch(/Location/i);
  });

  it('ignores the late list of a module that is no longer picked', () => {
    const late = new Subject<any>();
    const salesList = { success: true, message: '', data: [member(9, 'Sales S', 'Technician', true)] };
    api.getModuleAccess = (companyId: number, key: string) => {
      calls.push(['getModuleAccess', companyId, key]);
      return key === 'SERVICE' ? late : of(salesList);
    };
    const fixture = create();

    fixture.componentInstance.onAccessModulePicked('SALES');
    late.next({ success: true, message: '', data: [member(5, 'Admin A', 'Admin', true)] });
    fixture.detectChanges();

    expect(fixture.componentInstance.access().map(a => a.userId)).toEqual([9]);
  });

  it('sends no second request for a member while the first one is in flight', () => {
    const late = new Subject<any>();
    api.setModuleAccess = (companyId: number, key: string, userId: number, on: boolean) => { calls.push(['setModuleAccess', companyId, key, userId, on]); return late; };
    const fixture = create();
    const tech = member(8, 'Tech T', 'Technician', false) as any;

    fixture.componentInstance.toggleAccess(tech);
    fixture.componentInstance.toggleAccess(tech);

    expect(calls.filter(c => c[0] === 'setModuleAccess').length).toBe(1);

    late.next({ success: true, message: 'Access granted', data: true });
    late.complete();
    fixture.componentInstance.toggleAccess(tech);

    expect(calls.filter(c => c[0] === 'setModuleAccess').length).toBe(2);
  });

  const switchBoxes = (fixture: any) => fixture.nativeElement.querySelectorAll('.pa-switch input[type=checkbox]') as NodeListOf<HTMLInputElement>;

  it('asks nothing and says so when the company has no module switched on', () => {
    api.getCompanyModules = (companyId: number) => { calls.push(['getCompanyModules', companyId]); return of({ success: true, message: '', data: [offModule] }); };
    const fixture = create();
    fixture.detectChanges();

    expect(calls.some(c => c[0] === 'getModuleAccess')).toBe(false);
    expect(fixture.componentInstance.accessModuleKey()).toBe('');
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('This company has no modules switched on.');
    expect(fixture.nativeElement.querySelector('.pa-module-picker')).toBeNull();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();

    fixture.componentInstance.onAccessModulePicked('SALES');
    fixture.componentInstance.toggleAccess(member(8, 'Tech T', 'Technician', false) as any);
    expect(calls.some(c => c[0] === 'getModuleAccess' || c[0] === 'setModuleAccess')).toBe(false);
  });

  it('shows the server message and asks for no access list when the modules cannot be listed', () => {
    api.getCompanyModules = (companyId: number) => { calls.push(['getCompanyModules', companyId]); return of({ success: false, message: 'Modules are unavailable', data: null }); };
    const fixture = create();
    fixture.detectChanges();

    expect(calls.some(c => c[0] === 'getModuleAccess')).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Modules are unavailable');
    expect(fixture.componentInstance.accessModuleKey()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Could not load the modules.');
    expect(fixture.nativeElement.textContent).not.toContain('no modules switched on');
    expect(fixture.nativeElement.textContent).not.toContain('no members yet');
  });

  it('shows the same hint and asks for no access list when loading the modules fails', () => {
    api.getCompanyModules = (companyId: number) => { calls.push(['getCompanyModules', companyId]); return throwError(() => ({ status: 500, error: {} })); };
    const fixture = create();
    fixture.detectChanges();

    expect(calls.some(c => c[0] === 'getModuleAccess')).toBe(false);
    expect(fixture.componentInstance.accessModuleKey()).toBe('');
    expect(fixture.componentInstance.modulesFailed()).toBe(true);
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Could not load the modules.');
    expect(fixture.nativeElement.textContent).not.toContain('no modules switched on');
    expect(fixture.nativeElement.textContent).not.toContain('no members yet');
  });

  it('ignores a late branch list after another company was picked', () => {
    const late = new Subject<any>();
    const branch = (id: number, name: string) => ({ locationId: id, locationName: name, locationCode: '', address: '', city: '', isActive: true });
    api.getProjects = () => of({ success: true, message: '', data: [project, { ...project, projectId: 3, companyId: 3, companyName: 'Other Co' }] });
    api.getLocations = (id: number) => id === 2 ? late : of({ success: true, message: '', data: [branch(30, 'Other branch')] });
    const fixture = create();

    fixture.componentInstance.setTab('locations');
    fixture.componentInstance.onProjectPicked(3);
    late.next({ success: true, message: '', data: [branch(20, 'Old branch')] });
    fixture.detectChanges();

    expect(fixture.componentInstance.locations().map(l => l.locationId)).toEqual([30]);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('goes back to the code screen when the lock ends during a tab load', () => {
    api.getCompanyModules = () => throwError(() => ({ status: 403, error: { code: 'PLATFORM_LOCKED' } }));
    const fixture = create();
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.unlocked()).toBe(false);
  });

  it('puts the checkbox back and says so when changing access fails', () => {
    api.setModuleAccess = () => throwError(() => ({ status: 500, error: {} }));
    const fixture = create();

    const box = switchBoxes(fixture)[1];
    expect(box.checked).toBe(false);
    box.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Could not change access');
    expect(switchBoxes(fixture)[1].checked).toBe(false);
  });

  describe('with two companies', () => {
    const project3 = { ...project, projectId: 3, companyId: 3, companyName: 'Other Co' };
    const setup = (modulesOf3: any) => {
      api.getProjects = () => of({ success: true, message: '', data: [project, project3] });
      api.getCompanyModules = (companyId: number) => {
        calls.push(['getCompanyModules', companyId]);
        return companyId === 3 ? modulesOf3 : of({ success: true, message: '', data: [serviceModule, salesModule, offModule] });
      };
      return create();
    };

    it('keeps the picked module when the other company has it too', () => {
      const fixture = setup(of({ success: true, message: '', data: [serviceModule, salesModule] }));
      fixture.componentInstance.onAccessModulePicked('SALES');

      fixture.componentInstance.onProjectPicked(3);

      expect(fixture.componentInstance.accessModuleKey()).toBe('SALES');
      expect(calls).toContainEqual(['getModuleAccess', 3, 'SALES']);
    });

    it('falls back to the first module when the other company lacks the picked one', () => {
      const hr = { ...offModule, isEnabled: true };
      const fixture = setup(of({ success: true, message: '', data: [hr, serviceModule] }));
      fixture.componentInstance.onAccessModulePicked('SALES');

      fixture.componentInstance.onProjectPicked(3);

      expect(fixture.componentInstance.accessModuleKey()).toBe('HR');
      expect(calls).toContainEqual(['getModuleAccess', 3, 'HR']);
      expect(calls).not.toContainEqual(['getModuleAccess', 3, 'SALES']);
    });

    it('shows no module of the previous company while the next company loads', () => {
      const fixture = setup(new Subject<any>());

      fixture.componentInstance.onProjectPicked(3);
      fixture.detectChanges();

      expect(fixture.componentInstance.accessModules()).toEqual([]);
      expect(fixture.nativeElement.querySelectorAll('.pa-module-picker option').length).toBe(0);
      expect(calls.filter(c => c[0] === 'getModuleAccess' && c[1] === 3).length).toBe(0);
    });
  });
});

describe('PlatformAdminComponent servers, settings and database state', () => {
  const server = (id: number, over: any = {}) => ({ dbServerId: id, serverName: 'sql-' + id, adminUser: 'creator', extraOptions: '', isDefault: id === 1, isActive: true, hasPassword: true, companyCount: 2, ...over });
  const companyRow = (id: number, over: any = {}) => ({ companyId: id, companyName: 'Co ' + id, companyCode: 'C' + id, address: '', city: '', phoneNumber: '', isActive: true, projectCount: 1, userCount: 1, provisionStatus: 'Ready', provisionError: '', databaseName: '', ...over });

  let api: any;
  let auth: any;
  let calls: any[][];

  const create = (isPlatformAdmin = true) => {
    TestBed.resetTestingModule();
    auth = {
      currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin }),
      selectedCompanyId: () => 2,
      retryProvision: (id: number) => { calls.push(['retryProvision', id]); return of({ success: true, message: 'The database is being set up.', data: true }); },
      ...auth,
    };
    TestBed.configureTestingModule({
      imports: [PlatformAdminComponent],
      providers: [{ provide: PlatformService, useValue: api }, { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(PlatformAdminComponent);
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: any) => fixture.nativeElement.textContent as string;
  const tabs = (fixture: any) => (Array.from(fixture.nativeElement.querySelectorAll('.pa-tabs button')) as HTMLButtonElement[]).map(b => b.textContent?.trim());

  beforeEach(() => {
    calls = [];
    auth = {};
    api = {
      isUnlocked: () => of({ success: true, unlocked: true }),
      getCompanies: () => { calls.push(['getCompanies']); return of({ success: true, message: '', data: [companyRow(2)] }); },
      getProjects: () => of({ success: true, message: '', data: [] }),
      getDbServers: () => { calls.push(['getDbServers']); return of({ success: true, message: '', data: [server(1), server(2, { hasPassword: false, isActive: false })] }); },
      saveDbServer: (form: any) => { calls.push(['saveDbServer', { ...form }]); return of({ success: true, message: 'Server saved', data: 3 }); },
      testDbServer: (form: any) => { calls.push(['testDbServer', { ...form }]); return of({ success: true, message: 'Connected. This login can create databases', data: { connected: true, schemaReady: true, locationCount: 0, message: 'Connected. This login can create databases' } }); },
      getSettings: () => { calls.push(['getSettings']); return of({ success: true, message: '', data: [
        { settingKey: 'MaxCompaniesPerUser', settingValue: '1', updatedByName: '' },
        { settingKey: 'TenantLookupSourceDb', settingValue: '', updatedByName: '' },
      ] }); },
      saveSetting: (key: string, value: string) => { calls.push(['saveSetting', key, value]); return of({ success: true, message: 'Setting saved', data: true }); },
      lock: () => {},
    };
  });

  it('shows the two tabs to a platform administrator only', () => {
    expect(tabs(create(true))).toEqual(expect.arrayContaining(['Database Servers', 'Settings']));

    // create() keeps what the previous call put into `auth`: start the second user from scratch
    auth = {};
    const other = create(false);
    expect(tabs(other)).not.toContain('Database Servers');
    expect(tabs(other)).not.toContain('Settings');
    other.componentInstance.setTab('servers' as any);
    expect(calls.some(c => c[0] === 'getDbServers')).toBe(false);
  });

  it('lists the servers without any password', () => {
    const fixture = create();
    fixture.componentInstance.setTab('servers' as any);
    fixture.detectChanges();

    expect(calls).toContainEqual(['getDbServers']);
    expect(text(fixture)).toContain('sql-1');
    expect(text(fixture)).toContain('Stored');
    expect(text(fixture)).toContain('Missing');
    expect(fixture.nativeElement.querySelectorAll('input[type=password]').length).toBe(0);
  });

  it('opens an edit with an empty password every time', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('servers' as any);

    c.editServer(server(1) as any);
    c.serverForm!.adminPassword = 'typed-secret';
    c.closeForms();
    expect(c.serverForm).toBeNull();

    c.editServer(server(1) as any);
    expect(c.serverForm!.adminPassword).toBe('');
    fixture.detectChanges();
    const box = fixture.nativeElement.querySelector('input[type=password]') as HTMLInputElement;
    expect(box.value).toBe('');
    expect(box.placeholder).toContain('leave empty to keep');
  });

  it('saves an edit without a password when none was typed, then forgets the form', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('servers' as any);
    c.editServer(server(1) as any);
    c.serverForm!.extraOptions = 'Encrypt=True';
    c.saveServer();

    const sent = calls.find(x => x[0] === 'saveDbServer')![1];
    expect(sent.adminPassword).toBe('');
    expect(sent.extraOptions).toBe('Encrypt=True');
    expect(c.serverForm).toBeNull();
    expect(calls.filter(x => x[0] === 'getDbServers').length).toBe(2);
  });

  it('needs server, login and, for a new server, the password', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('servers' as any);
    c.newServer();
    c.serverForm!.serverName = 'sql-9';
    c.serverForm!.adminUser = 'creator';
    c.saveServer();

    expect(c.formError()).toBe('Enter the password');
    expect(calls.some(x => x[0] === 'saveDbServer')).toBe(false);
  });

  it('shows why the server refused a save and keeps the dialog', () => {
    api.saveDbServer = () => of({ success: false, message: 'The options must not set the server, database, login or password', data: 0 });
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('servers' as any);
    c.editServer(server(1) as any);
    c.saveServer();
    fixture.detectChanges();

    expect(c.serverForm).not.toBeNull();
    expect(text(fixture)).toContain('The options must not set the server');
  });

  it('tests the connection with what is typed and shows the answer', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('servers' as any);
    c.newServer();
    c.serverForm!.serverName = 'sql-9';
    c.serverForm!.adminUser = 'creator';
    c.serverForm!.adminPassword = 'pw';
    c.testServer();
    fixture.detectChanges();

    expect(calls.find(x => x[0] === 'testDbServer')![1].serverName).toBe('sql-9');
    expect(text(fixture)).toContain('This login can create databases');
  });

  it('lists the settings with their help and saves one', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('settings' as any);
    fixture.detectChanges();

    expect(text(fixture)).toContain('Companies a user may create');
    expect(text(fixture)).toContain('Never name a live company');

    c.settingDraft['MaxCompaniesPerUser'] = '3';
    c.saveSetting('MaxCompaniesPerUser');
    expect(calls).toContainEqual(['saveSetting', 'MaxCompaniesPerUser', '3']);
  });

  it('shows a refused setting next to its row and keeps what was typed', () => {
    api.saveSetting = () => of({ success: false, message: 'Enter a number from 0 to 100', data: false });
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('settings' as any);
    c.settingDraft['MaxCompaniesPerUser'] = 'many';
    c.saveSetting('MaxCompaniesPerUser');
    fixture.detectChanges();

    expect(text(fixture)).toContain('Enter a number from 0 to 100');
    expect(c.settingDraft['MaxCompaniesPerUser']).toBe('many');
  });

  it('shows the database state of each company, with the reason for a platform administrator', () => {
    api.getCompanies = () => of({ success: true, message: '', data: [
      companyRow(2, { databaseName: 'EncryptzTenant_000002' }),
      companyRow(3, { provisionStatus: 'Provisioning' }),
      companyRow(4, { provisionStatus: 'Failed', provisionError: 'Tenant script batch 12 of 1468 failed' }),
      companyRow(5, { provisionStatus: 'None' }),
    ] });
    const fixture = create();

    expect(text(fixture)).toContain('EncryptzTenant_000002');
    expect(text(fixture)).toContain('Setting up…');
    expect(text(fixture)).toContain('Setup failed');
    expect(text(fixture)).toContain('Tenant script batch 12 of 1468 failed');
    expect(text(fixture)).toContain('No database');
  });

  it('retries a failed set-up once and reloads the companies', () => {
    const pending = new Subject<any>();
    auth = { retryProvision: (id: number) => { calls.push(['retryProvision', id]); return pending; } };
    api.getCompanies = () => { calls.push(['getCompanies']); return of({ success: true, message: '', data: [companyRow(4, { provisionStatus: 'Failed' })] }); };
    const fixture = create();
    const c = fixture.componentInstance;
    const row = c.companies()[0];

    c.retryCompany(row);
    c.retryCompany(row);
    expect(calls.filter(x => x[0] === 'retryProvision')).toEqual([['retryProvision', 4]]);

    const before = calls.filter(x => x[0] === 'getCompanies').length;
    pending.next({ success: true, message: 'The database is being set up.', data: true });
    pending.complete();
    expect(calls.filter(x => x[0] === 'getCompanies').length).toBe(before + 1);
  });

  it('explains a rate limit on retry', () => {
    auth = { retryProvision: () => throwError(() => ({ status: 429 })) };
    api.getCompanies = () => of({ success: true, message: '', data: [companyRow(4, { provisionStatus: 'Failed' })] });
    const fixture = create();
    fixture.componentInstance.retryCompany(fixture.componentInstance.companies()[0]);
    fixture.detectChanges();

    expect(text(fixture)).toContain('Too many attempts. Please try again later.');
  });

  it('offers no Retry for a failed company that has a database', () => {
    api.getCompanies = () => of({ success: true, message: '', data: [companyRow(4, { provisionStatus: 'Failed', databaseName: 'HandAttachedDb' })] });
    const fixture = create();
    const buttons = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).map(b => b.textContent?.trim());

    expect(buttons).not.toContain('Retry');
  });
});
