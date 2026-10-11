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
    api = {
      isUnlocked: () => of({ success: true, unlocked: true }),
      getCompanies: () => of({ success: true, message: '', data: [company] }),
      getProjects: () => of({ success: true, message: '', data: [] }),
      getCompanyModules: (companyId: number) => { calls.push(['getCompanyModules', companyId]); return of({ success: true, message: '', data: [serviceModule, salesModule] }); },
      setCompanyModule: (companyId: number, key: string, on: boolean) => { calls.push(['setCompanyModule', companyId, key, on]); return of({ success: true, message: 'Sales switched on', data: true }); },
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
    const fixture = create();
    fixture.componentInstance.onAccessModulePicked('SALES');
    expect(calls).toContainEqual(['getModuleAccess', 2, 'SALES']);
  });

  it('gives a member access to the picked module', () => {
    const fixture = create();
    fixture.componentInstance.toggleAccess(member(8, 'Tech T', 'Technician', false) as any);
    fixture.detectChanges();

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
  });
});
