import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { CrmQuotationComponent } from './crm-quotation-component';

describe('CrmQuotationComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  const item = (over: any = {}) => ({
    quotationItemId: 1, productMasterId: 7, productName: 'Inverter 1kVA', hsnSac: '8504', qty: 1, rate: 1000, discountAmount: 0,
    gstPercent: 18, warrantyMonths: 12, taxableAmount: 1000, gstAmount: 180, lineTotal: 1180, sortOrder: 1, ...over,
  });
  const quotation = (over: any = {}) => ({
    quotationId: 30, leadId: 5, quotationNo: 'QT-0003', revisionNo: 1, quoteDate: '2026-11-10', validUntil: null, isInterState: false,
    subTotal: 1000, discountTotal: 0, taxableTotal: 1000, cgst: 90, sgst: 90, igst: 0, grandTotal: 1180, terms: '', status: 'Draft',
    createdAt: '', updatedAt: '', createdByName: '', isLatest: true, leadNo: 'LD-0005', contactName: 'Meera', mobile: '', email: '',
    address: '', city: '', state: '', pinCode: '', leadStatus: 'Qualified', items: [item()], ...over,
  });

  let crm: any;
  let current: any;
  let params: Record<string, string>;
  let query: Record<string, string>;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmQuotationComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(params), queryParamMap: convertToParamMap(query) } } },
        { provide: CrmService, useValue: crm },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(CrmQuotationComponent);
    fixture.detectChanges();
    return fixture;
  };
  const total = (f: any, key: string) => (f.nativeElement.querySelector(`[data-total="${key}"]`) as HTMLElement).textContent!.trim();
  const type = (f: any, selector: string, value: string) => {
    const input = f.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
  };

  beforeEach(() => {
    current = quotation();
    params = { id: '30' };
    query = {};
    crm = {
      getQuotation: () => ok(current),
      getLead: () => ok({ leadId: 5, leadNo: 'LD-0005', contactName: 'Meera', status: 'Qualified' }),
      searchProducts: () => ok([]),
      saveQuotation: vi.fn(() => ok(30)),
      reviseQuotation: vi.fn(() => ok(31)),
    };
  });

  it('shows 18% on 1000 within the state as CGST 90, SGST 90 and 1180 in all', () => {
    const f = create();
    expect(total(f, 'taxable')).toBe('1,000.00');
    expect(total(f, 'cgst')).toBe('90.00');
    expect(total(f, 'sgst')).toBe('90.00');
    expect(total(f, 'grand')).toBe('1,180.00');
  });

  it('works the totals out again when the quantity or the rate changes', () => {
    const f = create();
    type(f, '.q-qty', '2');
    expect(total(f, 'cgst')).toBe('180.00');
    expect(total(f, 'grand')).toBe('2,360.00');
    type(f, '.q-rate', '500');
    expect(total(f, 'sgst')).toBe('90.00');
    expect(total(f, 'grand')).toBe('1,180.00');
  });

  it('puts the GST on IGST between states', () => {
    current = quotation({ isInterState: true });
    const f = create();
    expect(total(f, 'igst')).toBe('180.00');
    expect(f.nativeElement.querySelector('[data-total="cgst"]')).toBeNull();
  });

  it('starts a new quotation for the lead in the address', () => {
    params = { id: 'new' };
    query = { leadId: '5' };
    const f = create();
    expect(f.nativeElement.querySelector('.q-qty')).not.toBeNull();
    f.componentInstance.lines.update((l: any[]) => l.map(x => ({ ...x, productName: 'Battery', rate: 100 })));
    f.componentInstance.save();
    expect(crm.saveQuotation).toHaveBeenCalledWith(expect.objectContaining({ quotationId: 0, leadId: 5 }));
  });

  it('picking a product fills the empty first line', () => {
    params = { id: 'new' };
    query = { leadId: '5' };
    const f = create();
    const p: any = { productMasterId: 9, productName: 'Treadmill T-10C', productCode: 'T10', mrp: 45000, warrantyMonths: 24 };
    f.componentInstance.pick(p);
    f.detectChanges();
    const lines = f.componentInstance.lines();
    expect(lines.length).toBe(1);
    expect(lines[0].productName).toBe(p.productName);
    expect(f.nativeElement.querySelectorAll('.q-line-card').length).toBe(1);
  });

  it('a new quotation for a lead with a product starts with that product', () => {
    params = { id: 'new' };
    query = { leadId: '5' };
    const p: any = { productMasterId: 9, productName: 'Treadmill T-10C', productCode: 'T10', mrp: 45000, warrantyMonths: 24, hsnSac: '9506' };
    crm.getLead = () => ok({ leadId: 5, leadNo: 'LD-0005', contactName: 'Meera', status: 'Qualified', productMasterId: 9, productName: 'Treadmill T-10C', productCategory: 'Treadmill' });
    crm.searchProducts = vi.fn(() => ok([{ ...p, productMasterId: 3, productName: 'Treadmill T-10C Pro' }, p]));
    const f = create();
    const lines = f.componentInstance.lines();
    expect(lines.length).toBe(1);
    expect(lines[0]).toEqual(expect.objectContaining({ productMasterId: 9, productName: 'Treadmill T-10C', rate: 45000, warrantyMonths: 24, hsnSac: '9506' }));
  });

  it('a lead product that matches no name term is still found, by its category', () => {
    params = { id: 'new' };
    query = { leadId: '5' };
    const p: any = { productMasterId: 9, productName: '50% Off_Combo', productCode: 'C9', mrp: 100, warrantyMonths: 6 };
    crm.getLead = () => ok({ leadId: 5, leadNo: 'LD-0005', contactName: 'Meera', status: 'Qualified', productMasterId: 9, productName: 'renamed', productCategory: 'Combo' });
    crm.searchProducts = vi.fn(() => ok([p]));
    const f = create();
    expect(crm.searchProducts).toHaveBeenCalledWith(undefined, 'Combo', 100);
    expect(f.componentInstance.lines()[0].productMasterId).toBe(9);
  });

  it('tells the person when the lead product is not in the product master', () => {
    params = { id: 'new' };
    query = { leadId: '5' };
    crm.getLead = () => ok({ leadId: 5, leadNo: 'LD-0005', contactName: 'Meera', status: 'Qualified', productMasterId: 9, productName: 'Gone', productCategory: 'Combo' });
    crm.searchProducts = vi.fn(() => ok([]));
    const f = create();
    f.detectChanges();
    expect(f.componentInstance.lines()[0].productName).toBe('');
    expect(f.nativeElement.textContent).toContain("The lead's product was not found in the product master");
    expect(f.nativeElement.querySelector('.crm-warn')).not.toBeNull();
    expect(f.nativeElement.querySelector('.crm-ok')).toBeNull();
  });

  it('keeps a sent quotation read-only and offers Revise', () => {
    current = quotation({ status: 'Sent' });
    const f = create();
    expect(f.nativeElement.querySelector('.q-qty')).toBeNull();
    const revise = f.nativeElement.querySelector('.q-revise') as HTMLButtonElement;
    expect(revise).not.toBeNull();
    revise.click();
    expect(crm.reviseQuotation).toHaveBeenCalledWith(30);
  });

  describe('convert to sales order', () => {
    const convertButton = (f: any) => f.nativeElement.querySelector('.q-convert') as HTMLButtonElement | null;

    beforeEach(() => {
      crm.previewConvert = vi.fn(() => ok({ matches: [], quotation: { ...quotation({ status: 'Sent' }), items: [item()] } }));
      crm.convert = vi.fn(() => ok({ salesOrderId: 9, orderNo: 'SO-0009', customerId: 3 }));
    });

    it('shows Convert to sales order for a draft or sent quotation', () => {
      current = quotation({ status: 'Draft', leadStatus: 'Quotation' });
      let f = create();
      expect(convertButton(f)).not.toBeNull();
      expect(convertButton(f)!.classList).toContain('primary');
      expect(convertButton(f)!.textContent).toContain('Convert to sales order');
      expect(convertButton(f)!.disabled).toBe(false);

      current = quotation({ status: 'Sent', leadStatus: 'Negotiation' });
      f = create();
      expect(convertButton(f)!.disabled).toBe(false);

      for (const status of ['Rejected', 'Accepted', 'Superseded']) {
        current = quotation({ status, leadStatus: 'Quotation' });
        expect(convertButton(create())).toBeNull();
      }
      current = quotation({ status: 'Sent', leadStatus: 'Converted' });
      expect(convertButton(create())).toBeNull();
      current = quotation({ status: 'Sent', leadStatus: 'Lost' });
      expect(convertButton(create())).toBeNull();
    });

    it('convert is disabled until the quotation is sent', () => {
      current = quotation({ status: 'Draft', leadStatus: 'New' });
      const f = create();
      expect(convertButton(f)!.disabled).toBe(true);
      expect(f.nativeElement.textContent).toContain('Mark the quotation as sent first');
      convertButton(f)!.click();
      f.componentInstance.openConvert();
      f.detectChanges();
      expect(f.nativeElement.querySelector('app-crm-convert-dialog')).toBeNull();
      expect(crm.previewConvert).not.toHaveBeenCalled();
      expect(crm.convert).not.toHaveBeenCalled();
    });

    it('convert stays disabled while the lead is still loading, then follows the lead', () => {
      current = quotation({ status: 'Sent', leadStatus: 'Quotation' });
      const lead$ = new Subject<any>();
      crm.getLead = () => lead$;
      const f = create();
      f.detectChanges();
      expect(convertButton(f)!.disabled).toBe(true);
      lead$.next({ success: true, message: '', data: { leadId: 5, leadNo: 'LD-0005', contactName: 'Meera', status: 'Quotation' } });
      f.detectChanges();
      expect(convertButton(f)!.disabled).toBe(false);
    });

    it('convert is enabled when the lead read fails (the server still guards)', () => {
      current = quotation({ status: 'Sent', leadStatus: 'Quotation' });
      crm.getLead = () => throwError(() => ({ status: 500 }));
      const f = create();
      f.detectChanges();
      expect(convertButton(f)!.disabled).toBe(false);
    });

    for (const [name, lead, hint] of [
      ['a convert that needs a check', { convertNeedsCheck: true }, 'A manager must check the sales orders for this lead first'],
      ['a lead already converted to an order', { salesOrderId: 9 }, 'already been converted to a sales order'],
    ] as const) {
      it(`convert is disabled for ${name}: hint, no request`, () => {
        current = quotation({ status: 'Sent', leadStatus: 'Quotation' });
        crm.getLead = () => ok({ leadId: 5, leadNo: 'LD-0005', contactName: 'Meera', status: 'Quotation', ...lead });
        const f = create();
        f.detectChanges();
        expect(convertButton(f)!.disabled).toBe(true);
        expect(f.nativeElement.querySelector('.q-convert-hint')!.textContent).toContain(hint);
        convertButton(f)!.click();
        f.componentInstance.openConvert();
        f.detectChanges();
        expect(f.nativeElement.querySelector('app-crm-convert-dialog')).toBeNull();
        expect(crm.previewConvert).not.toHaveBeenCalled();
        expect(crm.convert).not.toHaveBeenCalled();
      });
    }

    it('confirming converts and shows the order number', () => {
      current = quotation({ status: 'Sent', leadStatus: 'Quotation' });
      crm.getQuotation = vi.fn(() => ok(current));
      const f = create();
      convertButton(f)!.click();
      f.detectChanges();
      expect(crm.previewConvert).toHaveBeenCalledWith(5, 30);
      expect(f.nativeElement.querySelector('select.cv-quotation')).toBeNull();
      const before = crm.getQuotation.mock.calls.length;
      current = quotation({ status: 'Accepted', leadStatus: 'Converted' });
      (f.nativeElement.querySelector('.crm-confirm-convert') as HTMLButtonElement).click();
      f.detectChanges();
      expect(crm.convert).toHaveBeenCalledWith(5, expect.objectContaining({ quotationId: 30, customerId: null }));
      expect(f.nativeElement.querySelector('app-crm-convert-dialog')).toBeNull();
      expect(f.nativeElement.textContent).toContain('Converted to sales order SO-0009');
      expect(f.nativeElement.querySelector('.q-converted a')!.getAttribute('href')).toBe('/crm/leads/5');
      expect(crm.getQuotation.mock.calls.length).toBe(before + 1);
      expect(convertButton(f)).toBeNull();
    });

    it('a draft is saved with what is on the screen before the convert preview is read', () => {
      current = quotation({ status: 'Draft', leadStatus: 'Quotation' });
      const calls: string[] = [];
      crm.saveQuotation = vi.fn(() => { calls.push('save'); return ok(30); });
      crm.previewConvert = vi.fn(() => { calls.push('preview'); return ok({ matches: [], quotation: { ...current, items: [item({ rate: 1500 })] } }); });
      const f = create();
      type(f, '.q-rate', '1500');
      convertButton(f)!.click();
      f.detectChanges();
      expect(calls).toEqual(['save', 'preview']);
      expect(crm.saveQuotation).toHaveBeenCalledWith(expect.objectContaining({
        quotationId: 30, items: [expect.objectContaining({ rate: 1500, taxableAmount: 1500, lineTotal: 1770 })],
      }));
      expect(f.nativeElement.querySelector('app-crm-convert-dialog')).not.toBeNull();
    });

    it('a draft whose save fails opens no dialog and shows why', () => {
      current = quotation({ status: 'Draft', leadStatus: 'Quotation' });
      crm.saveQuotation = vi.fn(() => of({ success: false, message: 'The quotation could not be saved here', data: null }));
      let f = create();
      convertButton(f)!.click();
      f.detectChanges();
      expect(f.nativeElement.querySelector('app-crm-convert-dialog')).toBeNull();
      expect(crm.previewConvert).not.toHaveBeenCalled();
      expect(f.nativeElement.textContent).toContain('The quotation could not be saved here');

      // a line that fails the page's own check is not sent at all
      crm.saveQuotation = vi.fn(() => ok(30));
      f = create();
      type(f, '.q-qty', '0');
      convertButton(f)!.click();
      f.detectChanges();
      expect(crm.saveQuotation).not.toHaveBeenCalled();
      expect(crm.previewConvert).not.toHaveBeenCalled();
      expect(f.nativeElement.querySelector('app-crm-convert-dialog')).toBeNull();
      expect(f.nativeElement.textContent).toContain('The quantity must be at least 1');
    });

    it('a sent quotation opens the dialog without a save, and an old notice is cleared', () => {
      current = quotation({ status: 'Sent', leadStatus: 'Quotation' });
      const f = create();
      f.componentInstance.notice.set('Marked sent');
      f.detectChanges();
      convertButton(f)!.click();
      f.detectChanges();
      expect(crm.saveQuotation).not.toHaveBeenCalled();
      expect(crm.previewConvert).toHaveBeenCalledWith(5, 30);
      expect(f.nativeElement.textContent).not.toContain('Marked sent');
    });

    it('closes the dialog on Cancel without a convert', () => {
      current = quotation({ status: 'Sent', leadStatus: 'Quotation' });
      const f = create();
      convertButton(f)!.click();
      f.detectChanges();
      (f.nativeElement.querySelector('.cv-cancel') as HTMLButtonElement).click();
      f.detectChanges();
      expect(f.nativeElement.querySelector('app-crm-convert-dialog')).toBeNull();
      expect(crm.convert).not.toHaveBeenCalled();
    });

    it('shows the module-list refusal when the convert is refused with 403', () => {
      current = quotation({ status: 'Sent', leadStatus: 'Quotation' });
      crm.convert = vi.fn(() => throwError(() => ({ status: 403 })));
      const f = create();
      convertButton(f)!.click();
      f.detectChanges();
      (f.nativeElement.querySelector('.crm-confirm-convert') as HTMLButtonElement).click();
      f.detectChanges();
      expect(f.nativeElement.querySelector('.crm-refused a')!.getAttribute('href')).toBe('/select-module');
    });
  });
});
