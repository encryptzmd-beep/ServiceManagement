import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { CrmReportsComponent } from './crm-reports-component';

describe('CrmReportsComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  let crm: any;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmReportsComponent],
      providers: [provideRouter([]), { provide: CrmService, useValue: crm }],
    });
    const fixture = TestBed.createComponent(CrmReportsComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    crm = {
      me: () => ok({ userId: 1, fullName: 'A', isManager: false }),
      getMembers: () => ok({ members: [], available: [] }),
      followUpReport: vi.fn(() => ok([])),
      conversionReport: vi.fn(() => ok([{ sourceName: 'Walk-in', leads: 10, converted: 4, conversionPct: 40, convertedValue: 125000 }])),
    };
  });

  it('reads the conversion by source first, then by what is chosen', () => {
    const f = create();
    f.componentInstance.tab.set('conversion');
    f.componentInstance.loadConversion();
    f.detectChanges();
    expect(crm.conversionReport).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: 'source' }));
    const text = f.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Walk-in');
    expect(text).toContain('40%');
    expect(text).toContain('1,25,000');

    f.componentInstance.groupBy.set('month');
    f.componentInstance.loadConversion();
    expect(crm.conversionReport).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: 'month' }));
  });
});
