import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { HeaderComponent } from './header-component';

describe('HeaderComponent', () => {
  let branch = '';
  let branches: any[] = [];
  let setScope: any;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {
          userName: () => 'Ann Lee',
          userRole: () => 'Admin',
          currentUser: () => ({ userId: 5, fullName: 'Ann Lee', role: 'Admin', companyName: 'Hamster Cooling' }),
          selectedCompanyId: () => 2,
          companies: () => [],
          selectedLocationName: () => branch,
          selectedModuleKey: () => 'SERVICE',
          getBranches: () => of({ success: true, message: '', data: branches }),
          setScope: (...a: any[]) => setScope(...a),
          getModules: () => of({ success: true, message: '', data: [
            { moduleId: 1, moduleKey: 'SERVICE', moduleName: 'Service Management', description: '', icon: 'build', sortOrder: 1, state: 'Available' },
            { moduleId: 2, moduleKey: 'CRM', moduleName: 'CRM', description: '', icon: 'handshake', sortOrder: 2, state: 'Available' },
            { moduleId: 3, moduleKey: 'ACCOUNTS', moduleName: 'Accounts', description: '', icon: 'account_balance', sortOrder: 3, state: 'NotSubscribed' },
          ] }),
          logout: () => {},
        } },
      ],
    });
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('shows the branch after the company name', () => {
    branch = 'Elankulam';
    const fixture = create();
    expect(fixture.nativeElement.querySelector('.brand-branch').textContent).toContain('· Elankulam');
  });

  it('shows nothing after the company when no branch is set', () => {
    branch = '';
    const fixture = create();
    expect(fixture.nativeElement.querySelector('.brand-branch')).toBeNull();
  });

  it('shows the current module and switches to another one', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.mod-btn-name')!.textContent).toContain('Service Management');

    (el.querySelector('.mod-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = Array.from(el.querySelectorAll('button.mod-item')) as HTMLButtonElement[];
    expect(items.map(i => i.querySelector('.mod-item-name')!.textContent!.trim())).toEqual(['Service Management', 'CRM', 'Accounts']);
    expect(items[0].classList).toContain('on');
    expect(items[2].disabled).toBe(true);
    expect(items[2].textContent).toContain('Not subscribed');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    items[2].click();   // not subscribed: nothing happens
    expect(navigate).not.toHaveBeenCalled();
  });

  it('enters a module with one branch at once, without showing the branch step', () => {
    branches = [{ locationId: 7, locationName: 'Head Office' }];
    setScope = vi.fn(() => of({ success: true, message: '', data: { role: 'Admin' } }));
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (el.querySelector('.mod-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    (Array.from(el.querySelectorAll('button.mod-item')) as HTMLButtonElement[])[1].click();   // CRM
    expect(setScope).toHaveBeenCalledWith('CRM', 7, 'Head Office');
    expect(navigate).toHaveBeenCalledWith(['/crm/dashboard']);
    expect(navigate).not.toHaveBeenCalledWith(['/select-branch'], expect.anything());
  });

  it('goes to the branch step only when there are several branches to choose from', () => {
    branches = [{ locationId: 7, locationName: 'Head Office' }, { locationId: 8, locationName: 'Kochi' }];
    setScope = vi.fn();
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (el.querySelector('.mod-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    (Array.from(el.querySelectorAll('button.mod-item')) as HTMLButtonElement[])[1].click();
    expect(setScope).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/select-branch'], { queryParams: { module: 'CRM' } });
  });

  it('offers the branch, module and company switches', () => {
    branch = 'Elankulam';
    const fixture = create();
    (fixture.nativeElement.querySelector(".user-menu") as HTMLElement).click();
    fixture.detectChanges();
    const hrefs = (Array.from(fixture.nativeElement.querySelectorAll('.dropdown a')) as HTMLAnchorElement[])
      .map(a => a.getAttribute('href') || '');
    expect(hrefs.some(h => h.startsWith('/select-branch') && h.includes('module=SERVICE'))).toBe(true);
    expect(hrefs.some(h => h.endsWith('/select-module'))).toBe(true);
    expect(hrefs.some(h => h.endsWith('/select-company'))).toBe(true);
  });
});
