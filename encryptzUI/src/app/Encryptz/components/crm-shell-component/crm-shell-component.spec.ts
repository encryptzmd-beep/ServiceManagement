import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { CrmService } from '../../Services/crm-service';
import { CrmShellComponent } from './crm-shell-component';

describe('CrmShellComponent', () => {
  const create = (isManager: boolean) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {
          selectedCompanyId: () => 2, selectedLocationName: () => 'Main',
          companies: () => [{ companyId: 2, companyName: 'Hamster A/C' }] } },
        { provide: CrmService, useValue: { me: () => of({ success: true, message: '', data: { userId: 1, fullName: 'A', isManager } }) } },
      ],
    });
    const fixture = TestBed.createComponent(CrmShellComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows Settings only to a manager', () => {
    expect(create(true).textContent).toContain('Settings');
    expect(create(false).textContent).not.toContain('Settings');
  });

  it('shows the company and the branch', () => {
    const text = create(false).textContent!;
    expect(text).toContain('Hamster A/C');
    expect(text).toContain('Main');
  });
});
