import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { CrmDashboardComponent } from './crm-dashboard-component';

describe('CrmDashboardComponent', () => {
  let crm: any;
  const board = {
    newLeads: 4, followUpPending: 9, todayFollowUps: 2, overdue: 1, qualified: 3, quotationPending: 5,
    convertedThisMonth: 6, lostThisMonth: 7,
    dueFollowUps: [{ leadId: 12, leadNo: 'LD-0012', contactName: 'Ravi', mobile: '9876543210', status: 'Contacted',
      priority: 'High', nextFollowUpAt: '2026-11-17T10:00:00', nextAction: 'Call back', ownerUserId: 1, ownerName: 'A', isOverdue: true }],
  };

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmDashboardComponent],
      providers: [provideRouter([]), { provide: CrmService, useValue: crm }],
    });
    const fixture = TestBed.createComponent(CrmDashboardComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const tile = (el: HTMLElement, key: string) => el.querySelector(`.crm-tile[data-key="${key}"]`) as HTMLAnchorElement;

  beforeEach(() => { crm = { getDashboard: () => of({ success: true, message: '', data: board }) }; });

  it('opens the list filtered by the tile', () => {
    const el = create();
    expect(tile(el, 'new').getAttribute('href')).toBe('/crm/leads?status=New');
    expect(tile(el, 'new').textContent).toContain('4');
    expect(tile(el, 'pending').getAttribute('href')).toBe('/crm/leads?due=Pending');
    expect(tile(el, 'today').getAttribute('href')).toBe('/crm/leads?due=Today');
    expect(tile(el, 'overdue').getAttribute('href')).toBe('/crm/leads?due=Overdue');
    expect(tile(el, 'qualified').getAttribute('href')).toBe('/crm/leads?status=Qualified');
    expect(tile(el, 'quotation').getAttribute('href')).toBe('/crm/leads?status=Quotation,Negotiation');
    expect(tile(el, 'converted').getAttribute('href')).toMatch(/^\/crm\/leads\?status=Converted&closedFrom=\d{4}-\d{2}-01&closedTo=\d{4}-\d{2}-\d{2}$/);
    expect(tile(el, 'lost').getAttribute('href')).toMatch(/^\/crm\/leads\?status=Lost&closedFrom=/);
  });

  it('lists the due follow-ups, each opening its lead', () => {
    const el = create();
    const row = el.querySelector('.crm-due a') as HTMLAnchorElement;
    expect(row.getAttribute('href')).toBe('/crm/leads/12');
    expect(row.textContent).toContain('Ravi');
    expect(row.textContent).toContain('Overdue');
  });

  it('sends the person to the module list when the token is not for CRM', () => {
    crm.getDashboard = () => throwError(() => ({ status: 403 }));
    const el = create();
    expect(el.textContent).toContain('Open CRM from the module list');
    expect(el.querySelector('.crm-refused a')!.getAttribute('href')).toBe('/select-module');
    expect(el.querySelector('.crm-tile')).toBeNull();
  });
});
