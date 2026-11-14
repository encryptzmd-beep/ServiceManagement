import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { HeaderComponent } from './header-component';

describe('HeaderComponent', () => {
  let branch = '';

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
