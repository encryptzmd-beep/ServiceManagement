import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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
});
