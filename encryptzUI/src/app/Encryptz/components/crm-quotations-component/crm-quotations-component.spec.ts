import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { CrmQuotationsComponent } from './crm-quotations-component';

describe('CrmQuotationsComponent', () => {
  const row = (id: number) => ({ quotationId: id, quotationNo: `QT-00${id}`, revisionNo: 1, quoteDate: '2026-11-02', leadId: 5, leadNo: 'LD-0005',
    contactName: 'Ravi', ownerName: 'Anu', status: 'Sent', grandTotal: 11800, sentAt: null, ageDays: 2, totalCount: 45 });
  let asked: any[];
  let items: any[];
  let crm: any;
  let fixture: any;
  let el: HTMLElement;

  const flush = async () => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };

  beforeEach(async () => {
    asked = [];
    items = [row(1)];
    crm = { productCategories: () => of({ success: true, message: '', data: ['Inverter'] }), searchProducts: () => of({ success: true, message: '', data: [] }),
      saveLead: vi.fn(() => of({ success: true, message: '', data: 77 })),
      getQuotationStatusCounts: () => of({ success: true, message: '', data: [{ status: 'Sent', count: 40 }, { status: 'Accepted', count: 5 }] }),
      getQuotations: (f: any) => { asked.push({ ...f }); return of({ success: true, message: '', data: { items, totalCount: items[0]?.totalCount ?? 0, pageNumber: f.page, pageSize: 20, totalPages: 3 } }); } };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [CrmQuotationsComponent], providers: [provideRouter([]), { provide: CrmService, useValue: crm }] });
    fixture = TestBed.createComponent(CrmQuotationsComponent);
    el = fixture.nativeElement;
    await flush();
  });

  it('loads the first page', () => {
    expect(asked[0]).toEqual(expect.objectContaining({ page: 1, pageSize: 20 }));
    expect(el.textContent).toContain('QT-001');
    expect(el.querySelector('.crm-count-pill')!.textContent).toContain('45');
  });

  it('searching sends the term and resets to page 1', async () => {
    fixture.componentInstance.goTo(2);
    await flush();
    expect(asked.at(-1).page).toBe(2);
    const input = el.querySelector('.crm-search input') as HTMLInputElement;
    input.value = 'ravi';
    input.dispatchEvent(new Event('input'));
    (el.querySelector('.crm-filterbar') as HTMLFormElement).dispatchEvent(new Event('submit'));   // Enter in the search box
    await flush();
    expect(asked.at(-1)).toEqual(expect.objectContaining({ search: 'ravi', page: 1 }));
  });

  it('a status tab sends its status and shows the counts', async () => {
    const tabs = Array.from(el.querySelectorAll('.crm-stab')) as HTMLButtonElement[];
    expect(tabs.map(t => t.textContent!.replace(/\s+/g, ' ').trim())).toEqual(
      expect.arrayContaining(['All45', 'Sent40', 'Accepted5', 'Draft0']));
    tabs.find(t => t.textContent!.includes('Accepted'))!.click();
    await flush();
    expect(asked.at(-1)).toEqual(expect.objectContaining({ status: 'Accepted', page: 1 }));
    expect(el.querySelector('.crm-stab.on')!.textContent).toContain('Accepted');
  });

  it('row links to the quotation', () => {
    const a = el.querySelector('tbody a') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('/crm/quotations/1');
  });

  it('shows the empty state', async () => {
    items = [];
    fixture.componentInstance.apply();
    await flush();
    expect(el.querySelector('.crm-empty')).not.toBeNull();
    expect(el.querySelector('.crm-count-pill')!.textContent).toContain('0');
  });

  it('New quotation opens the quotation screen, where the customer is chosen', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (el.querySelector('.crm-page-head .crm-btn.primary') as HTMLButtonElement).click();
    await flush();
    expect(navigate).toHaveBeenCalledWith(['/crm/quotations/new']);
    expect(el.querySelector('.crm-dialog')).toBeNull();
  });
});
