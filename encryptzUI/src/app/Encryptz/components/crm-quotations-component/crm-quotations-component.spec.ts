import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
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
      saveLead: vi.fn(() => of({ success: true, message: '', data: 77 })), getQuotations: (f: any) => { asked.push({ ...f }); return of({ success: true, message: '', data: { items, totalCount: items[0]?.totalCount ?? 0, pageNumber: f.page, pageSize: 20, totalPages: 3 } }); } };
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
    (el.querySelector('.crm-btn.navy') as HTMLButtonElement).click();
    await flush();
    expect(asked.at(-1)).toEqual(expect.objectContaining({ search: 'ravi', page: 1 }));
  });

  it('status filter sends status', async () => {
    const select = el.querySelector('select[name="status"]') as HTMLSelectElement;
    select.value = 'Accepted';
    select.dispatchEvent(new Event('change'));
    (el.querySelector('.crm-btn.navy') as HTMLButtonElement).click();
    await flush();
    expect(asked.at(-1)).toEqual(expect.objectContaining({ status: 'Accepted', page: 1 }));
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

  const open = async () => { (el.querySelector('.crm-page-head .crm-btn.primary') as HTMLButtonElement).click(); await flush(); };
  const fill = async (name: string, mobile: string) => {
    for (const [sel, v] of [['input[name="nqName"]', name], ['input[name="nqMobile"]', mobile]]) {
      const i = el.querySelector(sel) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input'));
    }
    await flush();
  };
  const submit = async () => { (el.querySelector('.crm-dialog .crm-btn.primary') as HTMLButtonElement).click(); await flush(); };

  it('New quotation opens the form', async () => {
    expect(el.querySelector('.crm-dialog')).toBeNull();
    await open();
    expect(el.querySelector('.crm-dialog')).not.toBeNull();
    expect(el.querySelector('app-crm-product-picker')).not.toBeNull();
  });

  it('name and mobile are required', async () => {
    await open();
    await submit();
    expect(crm.saveLead).not.toHaveBeenCalled();
    expect(el.querySelector('.crm-dialog .crm-error')!.textContent).toContain('contact name');
    await fill('Ravi', '');
    await submit();
    expect(crm.saveLead).not.toHaveBeenCalled();
    expect(el.querySelector('.crm-dialog .crm-error')!.textContent).toContain('mobile');
  });

  it('saving creates the lead and opens the quotation editor', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await open();
    await fill('Ravi', '9876543210');
    await submit();
    expect(crm.saveLead).toHaveBeenCalledWith(expect.objectContaining({ leadId: 0, contactName: 'Ravi', mobile: '9876543210', priority: 'Medium', remarks: 'Created from a quotation' }));
    expect(navigate).toHaveBeenCalledWith(['/crm/quotations/new'], { queryParams: { leadId: 77 } });
  });

  it('saving twice creates one lead', async () => {
    const pending = new Subject<any>();
    crm.saveLead = vi.fn(() => pending);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await open();
    await fill('Ravi', '9876543210');
    await submit();
    fixture.componentInstance.saveNew();
    await submit();
    expect(crm.saveLead).toHaveBeenCalledTimes(1);
  });

  it('a server refusal shows the message', async () => {
    crm.saveLead = vi.fn(() => of({ success: false, message: 'Mobile already used', data: 0 }));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await open();
    await fill('Ravi', '9876543210');
    await submit();
    expect(el.querySelector('.crm-dialog .crm-error')!.textContent).toContain('Mobile already used');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('rejects mobiles that are not 10 digits, with no request', async () => {
    for (const bad of ['12345', 'abcdefghij', '+91 98765 43']) {
      await open();
      await fill('Ravi', bad);
      await submit();
      expect(crm.saveLead).not.toHaveBeenCalled();
      expect(el.querySelector('.crm-dialog .crm-error')!.textContent).toContain('mobile');
      fixture.componentInstance.newOpen.set(false);
      await flush();
    }
  });

  it('accepts a mobile with spaces and sends it as typed', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await open();
    await fill('Ravi', '98765 43210');
    await submit();
    expect(crm.saveLead).toHaveBeenCalledWith(expect.objectContaining({ mobile: '98765 43210' }));
  });

  it('unlocks the dialog when the navigation is refused', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(false);
    await open();
    await fill('Ravi', '9876543210');
    await submit();
    expect(fixture.componentInstance.nqSaving()).toBe(false);
  });
});
