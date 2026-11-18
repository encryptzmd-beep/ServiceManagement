import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
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

  it('keeps a sent quotation read-only and offers Revise', () => {
    current = quotation({ status: 'Sent' });
    const f = create();
    expect(f.nativeElement.querySelector('.q-qty')).toBeNull();
    const revise = f.nativeElement.querySelector('.q-revise') as HTMLButtonElement;
    expect(revise).not.toBeNull();
    revise.click();
    expect(crm.reviseQuotation).toHaveBeenCalledWith(30);
  });
});
