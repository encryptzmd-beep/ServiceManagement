import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { CrmLeadsComponent } from './crm-leads-component';

describe('CrmLeadsComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  let crm: any;
  let asked: any[];
  let isManager: boolean;
  let rowStatus: string;
  let rowNext: string | null;

  const create = (query: Record<string, string>) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmLeadsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap(query)), snapshot: { queryParamMap: convertToParamMap(query) } } },
        { provide: CrmService, useValue: crm },
      ],
    });
    const fixture = TestBed.createComponent(CrmLeadsComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    asked = [];
    isManager = false;
    rowStatus = 'New';
    rowNext = null;
    crm = {
      me: () => ok({ userId: 1, fullName: 'A', isManager }),
      getMasters: () => ok([{ id: 2, name: 'Walk-in', sortOrder: 1, isActive: true }]),
      getMembers: () => ok({ members: [{ userId: 1, fullName: 'Anu', isManager: true, isActive: true }], available: [] }),
      getLeadStatusCounts: () => ok([{ status: rowStatus, count: 1 }]),
      getLeads: (f: any) => {
        asked.push(f);
        return ok({ items: [{ leadId: 12, leadNo: 'LD-0012', leadDate: '2026-11-01', contactName: 'Ravi', mobile: '9876543210', email: '',
          city: 'Kochi', sourceName: 'Walk-in', productCategory: 'Inverter', ownerUserId: 1, ownerName: 'Anu', priority: 'High',
          status: rowStatus, nextFollowUpAt: rowNext, orderNo: null, totalCount: 1 }], totalCount: 1, pageNumber: 1, pageSize: 20, totalPages: 1 });
      },
    };
  });

  it('reads the filter of the address, as the dashboard sends it', () => {
    const el = create({ status: 'Converted', closedFrom: '2026-11-01', closedTo: '2026-11-30' });
    expect(asked[0]).toEqual(expect.objectContaining({ status: 'Converted', closedFrom: '2026-11-01', closedTo: '2026-11-30', page: 1 }));
    const row = el.querySelector('.crm-lead-row a') as HTMLAnchorElement;
    expect(row.getAttribute('href')).toBe('/crm/leads/12');
    expect(el.textContent).toContain('Ravi');
  });

  it('shows the owner filter to managers only', () => {
    expect(create({}).querySelector('.crm-owner-filter')).toBeNull();
    isManager = true;
    expect(create({}).querySelector('.crm-owner-filter')).not.toBeNull();
  });

  it('shows the status tabs with their counts, the status of the address marked', () => {
    crm.getLeadStatusCounts = () => ok([{ status: 'New', count: 3 }, { status: 'Lost', count: 2 }]);
    const el = create({ status: 'Lost' });
    const tabs = Array.from(el.querySelectorAll('.crm-stab')).map(t => t.textContent!.replace(/\s+/g, ' ').trim());
    expect(tabs).toEqual(expect.arrayContaining(['All5', 'New3', 'Lost2', 'Contacted0']));
    expect(el.querySelector('.crm-stab.on')!.textContent).toContain('Lost');
  });

  it('hides next follow-up of closed leads', () => {
    rowStatus = 'Lost';
    rowNext = '2026-12-05T10:00:00';
    const lost = create({}).querySelector('td[data-label="Next follow-up"]') as HTMLElement;
    expect(lost.textContent!.trim()).toBe('');
    rowStatus = 'New';
    const open = create({}).querySelector('td[data-label="Next follow-up"]') as HTMLElement;
    expect(open.textContent!.trim()).not.toBe('');
  });
});
