import { Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { CrmService } from '../../Services/crm-service';
import { thisMonth } from '../crm-shell-component/crm-ui';
import { CrmReportExporter, CrmReportsComponent } from './crm-reports-component';

describe('CrmReportsComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  let crm: any;
  let exporter: { excel: ReturnType<typeof vi.fn>; print: ReturnType<typeof vi.fn> };
  let fixture: any;
  let el: HTMLElement;

  const flush = async () => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };
  const text = () => el.textContent!.replace(/\s+/g, ' ');
  let param: BehaviorSubject<any>;
  const open = async (key: string) => { param.next(convertToParamMap({ report: key })); await flush(); };

  const create = async (key = 'followups') => {
    param = new BehaviorSubject(convertToParamMap({ report: key }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmReportsComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: param.asObservable() } },
        { provide: CrmService, useValue: crm },
        { provide: CrmReportExporter, useValue: exporter },
        { provide: AuthService, useValue: { companies: () => [{ companyId: 7, companyName: 'Felix Traders' }], selectedCompanyId: () => 7 } },
      ],
    });
    fixture = TestBed.createComponent(CrmReportsComponent);
    el = fixture.nativeElement;
    await flush();
  };

  beforeEach(async () => {
    exporter = { excel: vi.fn(() => Promise.resolve()), print: vi.fn() };
    crm = {
      me: () => ok({ userId: 1, fullName: 'A', isManager: true }),
      getMembers: () => ok({ members: [{ userId: 3, fullName: 'Anu', isManager: false, isActive: true }], available: [] }),
      followUpReport: vi.fn(() => ok([])),
      conversionReport: vi.fn(() => ok([{ sourceName: 'Walk-in', leads: 10, converted: 4, conversionPct: 40, convertedValue: 125000 }])),
      pipelineReport: vi.fn(() => ok([{ status: 'Qualified', leads: 3, quotationValue: 59000, avgDaysInStage: 4.5 }])),
      sourcesReport: vi.fn(() => ok([{ sourceName: 'Walk-in', leads: 10, converted: 4, lost: 2, openLeads: 4, conversionPct: 40, convertedValue: 125000 }])),
      teamReport: vi.fn(() => ok([{ ownerUserId: 3, ownerName: 'Anu', leads: 6, followUpsDone: 9, overdueNow: 1, converted: 2, lost: 1, convertedValue: 80000 }])),
      lostReasonsReport: vi.fn(() => ok([{ reasonName: 'Price', leads: 2, pctOfLost: 66.7, valueLost: 40000 }])),
      getQuotations: vi.fn(() => ok({ items: [{ quotationId: 1, quotationNo: 'QT-0001', revisionNo: 1, quoteDate: '2026-11-02', leadId: 5, leadNo: 'LD-0005',
        contactName: 'Ravi', ownerName: 'Anu', status: 'Sent', grandTotal: 11800, sentAt: null, ageDays: 2, totalCount: 1 }], totalCount: 1, pageNumber: 1, pageSize: 200, totalPages: 1 })),
    };
    await create();
  });

  it('has no tabs row', () => {
    expect(el.querySelector('[role=tablist]')).toBeNull();
    expect(el.querySelector('[role=tab]')).toBeNull();
    expect(el.querySelector('[data-key]')).toBeNull();
    expect(el.querySelector('.crm-report-tabs')).toBeNull();
  });

  it('shows the report named in the url', async () => {
    await create('pipeline');
    expect(el.querySelector('.crm-page-head h1')!.textContent!.trim()).toBe('Pipeline');
    expect(el.querySelector('input[name="from"]')).toBeNull();
    expect(crm.pipelineReport).toHaveBeenCalled();
  });

  it('switches report when the url changes', async () => {
    expect(el.querySelector('.crm-page-head h1')!.textContent!.trim()).toBe('Leads & follow-ups');
    param.next(convertToParamMap({ report: 'team' }));
    await flush();
    expect(crm.teamReport).toHaveBeenCalled();
    expect(el.querySelector('.crm-page-head h1')!.textContent!.trim()).toBe('Team performance');
  });

  it('redirects an unknown report to follow-ups', async () => {
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await open('nonsense');
    expect(nav).toHaveBeenCalledWith(['/crm/reports', 'followups'], { replaceUrl: true });
  });

  it('opens on follow-ups for this month', () => {
    const m = thisMonth();
    expect(crm.followUpReport).toHaveBeenCalledWith(expect.objectContaining({ from: m.from, to: m.to }));
    expect((el.querySelector('input[name="from"]') as HTMLInputElement).value).toBe(m.from);
  });

  it('pipeline hides the date range', async () => {
    expect(el.querySelector('input[name="from"]')).not.toBeNull();
    await open('pipeline');
    expect(el.querySelector('input[name="from"]')).toBeNull();
    expect(el.querySelector('input[name="to"]')).toBeNull();
    expect(el.querySelector('select[name="owner"]')).not.toBeNull();
    expect(crm.pipelineReport).toHaveBeenCalled();
    expect(text()).toContain('Qualified');
    expect(text()).toContain('59,000');
  });

  it('owner filter only on followups, pipeline, team and lost', async () => {
    const withOwner: string[] = [];
    for (const k of ['followups', 'conversion', 'pipeline', 'sources', 'team', 'lost', 'quotations']) {
      await open(k);
      if (el.querySelector('select[name="owner"]')) withOwner.push(k);
    }
    expect(withOwner).toEqual(['followups', 'pipeline', 'team', 'lost']);
  });

  it('sends the chosen owner to the team report', async () => {
    await open('team');
    const sel = el.querySelector('select[name="owner"]') as HTMLSelectElement;
    sel.value = '3';
    sel.dispatchEvent(new Event('change'));   // a filter applies at once: there is no Show button
    await flush();
    expect(crm.teamReport).toHaveBeenLastCalledWith(expect.objectContaining({ ownerUserId: 3 }));
    expect(text()).toContain('Anu');
  });

  it('reads the conversion by source first, then by what is chosen', async () => {
    await open('conversion');
    expect(crm.conversionReport).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: 'source' }));
    expect(text()).toContain('Walk-in');
    expect(text()).toContain('40%');
    expect(text()).toContain('1,25,000');
    const by = el.querySelector('select[name="groupBy"]') as HTMLSelectElement;
    by.value = 'month';
    by.dispatchEvent(new Event('change'));
    await flush();
    expect(crm.conversionReport).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: 'month' }));
  });

  it('quotation register reads 200 rows of the date range', async () => {
    await open('quotations');
    const m = thisMonth();
    expect(crm.getQuotations).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 200, from: m.from, to: m.to }));
    expect(text()).toContain('QT-0001');
    expect(text()).toContain('2 Nov 2026');
  });

  it('shows the breakdown as one stacked bar of shares', async () => {
    await open('lost');
    const segs = Array.from(el.querySelectorAll('.rp-seg')) as HTMLElement[];
    expect(segs.length).toBeGreaterThan(0);
    const total = segs.reduce((s, b) => s + parseFloat(b.style.width), 0);
    expect(Math.round(total)).toBe(100);
    expect(el.querySelectorAll('.crm-stat').length).toBeGreaterThan(0);
  });

  it('the search box narrows the rows on screen', async () => {
    await open('lost');
    const before = el.querySelectorAll('tbody tr').length;
    const q = el.querySelector('input[name="q"]') as HTMLInputElement;
    q.value = 'zzz-nothing';
    q.dispatchEvent(new Event('input'));
    await flush();
    expect(before).toBeGreaterThan(0);
    expect(el.querySelector('tbody')!.textContent).toContain('Nothing matches');
  });

  it('excel exports the visible report', async () => {
    await open('sources');
    (el.querySelector('.crm-excel') as HTMLButtonElement).click();
    await flush();
    expect(exporter.excel).toHaveBeenCalledTimes(1);
    const r = exporter.excel.mock.calls[0][0];
    const m = thisMonth();
    expect(r.key).toBe('sources');
    expect(r.title).toBe('Source performance');
    expect(r.companyName).toBe('Felix Traders');
    expect(r.fileName).toBe(`CRM-sources-${m.from}-${m.to}.xlsx`);
    expect(r.rows[0]).toEqual(expect.objectContaining({ sourceName: 'Walk-in', leads: 10, convertedValue: 125000 }));
    expect(r.columns.find((c: any) => c.key === 'convertedValue').kind).toBe('money');
  });

  it('excel passes dates already formatted as text', async () => {
    await open('quotations');
    (el.querySelector('.crm-excel') as HTMLButtonElement).click();
    const r = exporter.excel.mock.calls[0][0];
    const date = r.columns.find((c: any) => c.title === 'Date');
    expect(date.kind).toBe('text');
    expect(r.rows[0][date.key]).toBe('2 Nov 2026');
  });

  it('pdf opens the print page', async () => {
    await open('pipeline');
    (el.querySelector('.crm-pdf') as HTMLButtonElement).click();
    expect(exporter.print).toHaveBeenCalledTimes(1);
    const html: string = exporter.print.mock.calls[0][0];
    expect(html).toContain('Felix Traders');
    expect(html).toContain('Pipeline');
    expect(html).toContain('Qualified');
    expect(html).toContain('Printed on');
  });

  it('does not offer CSV', async () => {
    for (const k of ['followups', 'conversion', 'pipeline', 'sources', 'team', 'lost', 'quotations']) {
      await open(k);
      expect(el.textContent!.toUpperCase()).not.toContain('CSV');
    }
  });

  it('from after to shows the server message', async () => {
    crm.teamReport = vi.fn(() => of({ success: false, message: 'The From date is after the To date', data: null }));
    await open('team');
    expect(text()).toContain('The From date is after the To date');
  });

  it('an error shows no empty text and disables export', async () => {
    crm.teamReport = vi.fn(() => of({ success: false, message: 'The report could not be read', data: null }));
    await open('team');
    expect(text()).toContain('The report could not be read');
    expect(el.querySelector('.crm-empty')).toBeNull();
    expect((el.querySelector('.crm-excel') as HTMLButtonElement).disabled).toBe(true);
    expect((el.querySelector('.crm-pdf') as HTMLButtonElement).disabled).toBe(true);
    crm.lostReasonsReport = vi.fn(() => throwError(() => ({ status: 500 })));
    await open('lost');
    expect(text()).not.toContain('No lead lost in this period');
    expect((el.querySelector('.crm-excel') as HTMLButtonElement).disabled).toBe(true);
  });

  it('the register labels the figures "Value of shown" when not all rows are loaded', async () => {
    crm.getQuotations = vi.fn(() => ok({ items: [{ quotationId: 1, quotationNo: 'QT-0001', revisionNo: 1, quoteDate: '2026-11-02', leadId: 5, leadNo: 'LD-0005',
      contactName: 'Ravi', ownerName: 'Anu', status: 'Accepted', grandTotal: 11800, sentAt: null, ageDays: 2, totalCount: 250 }], totalCount: 250, pageNumber: 1, pageSize: 200, totalPages: 2 }));
    await open('quotations');
    expect(text()).toContain('Value of shown');
    expect(text()).toContain('Accepted value of shown');
    expect(text()).toContain('Showing the first 1 of 250');
  });

  it('the register keeps "Total value" when all rows are loaded', async () => {
    await open('quotations');
    expect(text()).toContain('Total value');
    expect(text()).not.toContain('of shown');
  });

  it('each report sets its own tab title', async () => {
    const title = TestBed.inject(Title);
    expect(title.getTitle()).toBe('CRM · Leads & follow-ups');
    await open('pipeline');
    expect(title.getTitle()).toBe('CRM · Pipeline');
  });

  it('a 403 shows the refusal', async () => {
    crm.lostReasonsReport = vi.fn(() => throwError(() => ({ status: 403 })));
    await open('lost');
    expect(el.querySelector('app-crm-refused')).not.toBeNull();
  });
});
