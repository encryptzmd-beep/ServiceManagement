import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { CrmSettingsComponent } from './crm-settings-component';

describe('CrmSettingsComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  let crm: any;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmSettingsComponent],
      providers: [provideRouter([]), { provide: CrmService, useValue: crm }],
    });
    const fixture = TestBed.createComponent(CrmSettingsComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    crm = {
      getMasters: (kind: string) => ok(kind === 'sources'
        ? [{ id: 1, name: 'Walk-in', sortOrder: 1, isActive: true }]
        : [{ id: 2, name: 'Price', sortOrder: 1, isActive: true }]),
      saveMaster: vi.fn(() => ok(3)),
      getMembers: () => ok({ members: [{ userId: 4, fullName: 'Anu', isManager: true, isActive: true }],
        available: [{ userId: 5, fullName: 'Biju' }] }),
      saveMember: vi.fn(() => ok(5)),
    };
  });

  it('shows the sources, the lost reasons and the team', () => {
    const el = create().nativeElement as HTMLElement;
    // the names are editable in place
    const text = el.textContent + ' ' + Array.from(el.querySelectorAll('input')).map(i => (i as HTMLInputElement).value).join(' ');
    expect(text).toContain('Walk-in');
    expect(text).toContain('Price');
    expect(text).toContain('Anu');
  });

  it('adds a source and a member', () => {
    const f = create();
    f.componentInstance.addMaster('sources', '  Exhibition ');
    expect(crm.saveMaster).toHaveBeenCalledWith('sources', { id: 0, name: 'Exhibition', sortOrder: 2, isActive: true });
    f.componentInstance.addMember(5, false);
    expect(crm.saveMember).toHaveBeenCalledWith({ userId: 5, fullName: 'Biju', isManager: false, isActive: true });
  });
});
