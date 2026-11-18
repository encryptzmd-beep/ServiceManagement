import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { CrmLeadFormComponent } from './crm-lead-form-component';

describe('CrmLeadFormComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  let crm: any;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmLeadFormComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) } } },
        { provide: CrmService, useValue: crm },
      ],
    });
    const fixture = TestBed.createComponent(CrmLeadFormComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    crm = {
      me: () => ok({ userId: 1, fullName: 'A', isManager: false }),
      getMasters: () => ok([]),
      getMembers: () => ok({ members: [], available: [] }),
      saveLead: vi.fn(() => ok(44)),
    };
  });

  it('asks for the name and a mobile before it saves', () => {
    const f = create();
    f.componentInstance.save();
    f.detectChanges();
    expect(crm.saveLead).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('Enter the contact name');
  });

  it('saves a new lead and opens it', () => {
    const f = create();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    f.componentInstance.form.update((x: any) => ({ ...x, contactName: 'Ravi', mobile: '98765 43210' }));
    f.componentInstance.save();
    expect(crm.saveLead).toHaveBeenCalledWith(expect.objectContaining({ leadId: 0, contactName: 'Ravi', mobile: '98765 43210' }));
    expect(navigate).toHaveBeenCalledWith(['/crm/leads', 44]);
  });
});
