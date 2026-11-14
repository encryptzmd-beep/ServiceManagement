import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { PlatformService } from '../../Services/platform-service';
import { PLATFORM_SECTIONS } from '../../Services/platform-nav-service';
import { PlatformAdminComponent } from './platform-admin-component';

describe('PlatformAdminComponent applications', () => {
  const service = { moduleId: 1, moduleKey: 'SERVICE', moduleName: 'Service Management', description: 'd', icon: 'build', family: 'Business', appType: 'Commercial', routePath: '', sortOrder: 1, isReleased: true, isActive: true, companyCount: 2 };
  const payroll = { moduleId: 5, moduleKey: 'PAYROLL', moduleName: 'Payroll', description: 'd', icon: 'payments', family: 'HR', appType: 'Commercial', routePath: '', sortOrder: 5, isReleased: false, isActive: true, companyCount: 0 };
  const jobs = { moduleId: 8, moduleKey: 'JOBPORTAL', moduleName: 'Job Portal', description: 'd', icon: 'badge', family: '', appType: 'Personal', routePath: '', sortOrder: 1, isReleased: false, isActive: true, companyCount: 0 };

  let api: any;
  let saved: any[];
  let saveAnswer: any;

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

  const open = (fixture: any) => {
    fixture.componentInstance.setTab('applications');
    fixture.detectChanges();
  };

  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

  beforeEach(() => {
    saved = [];
    saveAnswer = { success: true, message: 'Application saved', data: 5 };
    api = {
      isUnlocked: () => of({ success: true, unlocked: true }),
      getCompanies: () => of({ success: true, message: '', data: [] }),
      getProjects: () => of({ success: true, message: '', data: [] }),
      getApplications: () => of({ success: true, message: '', data: [service, payroll, jobs] }),
      saveApplication: (app: any) => { saved.push({ ...app }); return of(saveAnswer); },
      lock: () => {},
    };
  });

  it('lists Applications in the sidebar sections right after Companies', () => {
    const tabs = PLATFORM_SECTIONS.map(s => s.tab);
    expect(tabs.indexOf('applications')).toBe(tabs.indexOf('companies') + 1);
  });

  it('shows the Applications tab to a platform administrator only', () => {
    const labels = (f: any) => (Array.from(f.nativeElement.querySelectorAll('.pa-tabs button')) as HTMLElement[]).map(b => b.textContent?.trim());

    expect(labels(create(true))).toContain('Applications');
    expect(labels(create(false))).not.toContain('Applications');
  });

  it('does not open the section for a company administrator', () => {
    const fixture = create(false);
    open(fixture);
    expect(fixture.componentInstance.tab()).toBe('companies');
  });

  it('lists every application with its family and type', () => {
    const fixture = create(true);
    open(fixture);

    const rows = fixture.nativeElement.querySelectorAll('.pa-app-row');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('Service Management');
    expect(rows[0].textContent).toContain('Business');
    expect(rows[0].textContent).toContain('Commercial');
    expect(rows[2].textContent).toContain('Personal');
  });

  it('highlights an application that is not released with the Coming soon badge', () => {
    const fixture = create(true);
    open(fixture);

    const rows = fixture.nativeElement.querySelectorAll('.pa-app-row');
    expect(rows[0].querySelector('.soon-badge')).toBeNull();
    expect(rows[0].querySelector('.released-badge')?.textContent?.trim()).toBe('Released');
    expect(rows[1].querySelector('.soon-badge')?.textContent?.trim()).toBe('Coming soon');
    expect(rows[2].querySelector('.soon-badge')?.textContent?.trim()).toBe('Coming soon');
  });

  it('suggests the families already in use, each once and sorted', () => {
    const fixture = create(true);
    open(fixture);
    expect(fixture.componentInstance.families()).toEqual(['Business', 'HR']);
  });

  it('starts a new application as commercial, coming soon and active', () => {
    const fixture = create(true);
    open(fixture);
    fixture.componentInstance.newApplication();

    expect(fixture.componentInstance.applicationForm).toEqual({
      moduleId: 0, moduleKey: '', moduleName: '', description: '', icon: '', family: '',
      appType: 'Commercial', routePath: '', sortOrder: 0, isReleased: false, isActive: true, companyCount: 0,
    });
  });

  it('does not send an application without key or name', () => {
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;
    c.newApplication();
    c.applicationForm!.moduleName = 'Hotel';
    c.saveApplication();

    expect(saved.length).toBe(0);
    expect(c.formError()).toBe('Key and name are required');
  });

  it('does not send a released personal application without a route', () => {
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;
    c.editApplication(jobs as any);
    c.applicationForm!.isReleased = true;
    c.saveApplication();

    expect(saved.length).toBe(0);
    expect(c.formError()).toBe('A personal application needs a route before it is released');
  });

  it('saves, closes the dialog and reads the list again', () => {
    let reads = 0;
    api.getApplications = () => { reads++; return of({ success: true, message: '', data: [service, payroll, jobs] }); };
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.editApplication(payroll as any);
    c.applicationForm!.family = 'People';
    c.saveApplication();

    expect(saved[0].moduleKey).toBe('PAYROLL');
    expect(saved[0].family).toBe('People');
    expect(c.applicationForm).toBeNull();
    expect(reads).toBe(2);
  });

  it('keeps the dialog open and shows the message when the save is refused', () => {
    saveAnswer = { success: false, message: 'The key is already used', data: 0 };
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.newApplication();
    c.applicationForm!.moduleKey = 'PAYROLL';
    c.applicationForm!.moduleName = 'Payroll 2';
    c.saveApplication();

    expect(c.applicationForm).not.toBeNull();
    expect(c.formError()).toBe('The key is already used');
  });

  it('makes the key read-only when an application is edited', () => {
    const fixture = create(true);
    open(fixture);
    // through the button: the dialog field is not a signal, the click is what tells Angular
    (fixture.nativeElement.querySelectorAll('.pa-app-row')[1].querySelector('.fx-action-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    const key = fixture.nativeElement.querySelector('input[name="applicationKey"]') as HTMLInputElement;
    expect(key.readOnly).toBe(true);
    expect(text(fixture)).toContain('Edit Application');
  });

  it('reads the applications again when the screen is unlocked on the Applications section', () => {
    let reads = 0;
    api.getApplications = () => { reads++; return of({ success: true, message: '', data: [service, payroll, jobs] }); };
    api.verifyOtp = () => of({ success: true, message: '', data: { unlockToken: 't', validMinutes: 30 } });
    api.setUnlockToken = () => {};
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.lockNow();
    expect(c.applications()).toEqual([]);

    c.otpCode = '1234';
    c.verifyOtp();

    expect(reads).toBe(2);
    expect(c.applications().length).toBe(3);
  });

  it('asks before an application that companies use is set to Coming soon or inactive', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.editApplication(service as any);
    c.applicationForm!.isReleased = false;
    c.saveApplication();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(saved.length).toBe(0);

    c.applicationForm!.isReleased = true;
    c.applicationForm!.isActive = false;
    c.saveApplication();
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(saved.length).toBe(0);

    confirmSpy.mockReturnValue(true);
    c.saveApplication();
    expect(saved.length).toBe(1);

    confirmSpy.mockRestore();
  });

  it('does not ask when no company uses the application or nothing is switched off', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.editApplication(payroll as any);      // no company, already coming soon
    c.applicationForm!.isActive = false;
    c.saveApplication();

    c.editApplication(service as any);      // 2 companies, only the family changes
    c.applicationForm!.family = 'Field service';
    c.saveApplication();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(saved.length).toBe(2);

    confirmSpy.mockRestore();
  });
});
