import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { CrmConvertDialogComponent } from './crm-convert-dialog-component';
import { FORBIDDEN, isoDate } from './crm-ui';

describe('CrmConvertDialogComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  const quote = (over: any = {}) => ({
    quotationId: 30, leadId: 5, quotationNo: 'QT-0003', revisionNo: 1, quoteDate: '2026-11-10', isInterState: false,
    taxableTotal: 1000, grandTotal: 1180, status: 'Sent', createdAt: '', updatedAt: '2026-11-10T10:00:00', isLatest: true, ...over,
  });
  const preview = (matches: any[], quotationId = 30) => ({
    matches,
    quotation: { quotationId, quotationNo: 'QT-0003', revisionNo: 1, taxableTotal: 1000, cgst: 90, sgst: 90, igst: 0, grandTotal: 1180, isInterState: false, items: [] },
  });
  const customer = (id: number) => ({ customerId: id, customerName: `C${id}`, mobileNumber: '9876543210', totalProducts: 0 });

  let crm: any;

  const create = (inputs: { quotationId?: number | null; quotations?: any[]; mobile?: string } = {}) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmConvertDialogComponent],
      providers: [{ provide: CrmService, useValue: crm }],
    });
    const f = TestBed.createComponent(CrmConvertDialogComponent);
    f.componentRef.setInput('leadId', 5);
    if (inputs.quotationId !== undefined) f.componentRef.setInput('quotationId', inputs.quotationId);
    f.componentRef.setInput('quotations', inputs.quotations ?? [quote()]);
    f.componentRef.setInput('mobile', inputs.mobile ?? '9876543210');
    const converted = vi.fn();
    const cancelled = vi.fn();
    const forbidden = vi.fn();
    f.componentInstance.converted.subscribe(converted);
    f.componentInstance.cancelled.subscribe(cancelled);
    f.componentInstance.forbidden.subscribe(forbidden);
    f.detectChanges();
    return { f, converted, cancelled, forbidden, el: f.nativeElement as HTMLElement };
  };
  const confirm = (el: HTMLElement) => el.querySelector('.crm-confirm-convert') as HTMLButtonElement;

  beforeEach(() => {
    crm = {
      previewConvert: vi.fn(() => ok(preview([]))),
      convert: vi.fn(() => ok({ salesOrderId: 9, orderNo: 'SO-0009', customerId: 3 })),
    };
  });

  it('reads the preview of the preselected quotation', () => {
    const { el } = create({ quotationId: 30 });
    expect(crm.previewConvert).toHaveBeenCalledWith(5, 30);
    expect(el.textContent).toContain('No customer has the mobile 9876543210. A new customer is made from the lead.');
  });

  it('without a preselected quotation, previews the most recently changed one, and the picker previews another', () => {
    const list = [quote({ quotationId: 30, updatedAt: '2026-11-10T10:00:00' }), quote({ quotationId: 31, quotationNo: 'QT-0004', updatedAt: '2026-11-12T10:00:00' })];
    const { f, el } = create({ quotations: list });
    expect(crm.previewConvert).toHaveBeenCalledWith(5, 31);
    const select = el.querySelector('select.cv-quotation') as HTMLSelectElement;
    expect(select).not.toBeNull();
    select.value = select.options[0].value;
    select.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(crm.previewConvert).toHaveBeenLastCalledWith(5, 30);
  });

  it('hides the picker with one quotation', () => {
    const { el } = create({ quotationId: 30 });
    expect(el.querySelector('select.cv-quotation')).toBeNull();
  });

  it('says there is nothing to convert and asks nothing when there is no quotation', () => {
    const { el } = create({ quotations: [] });
    expect(crm.previewConvert).not.toHaveBeenCalled();
    expect(el.textContent).toContain('There is no quotation to convert');
    expect(confirm(el).disabled).toBe(true);
  });

  it('shows a refused preview as the server said it', () => {
    crm.previewConvert = vi.fn(() => of({ success: false, message: 'Only a lead in Quotation or Negotiation can be converted', data: null }));
    const { el } = create({ quotationId: 30 });
    expect(el.textContent).toContain('Only a lead in Quotation or Negotiation can be converted');
    expect(confirm(el).disabled).toBe(true);
  });

  it('keeps Confirm disabled until one of several customers is chosen, then sends that customer', () => {
    crm.previewConvert = vi.fn(() => ok(preview([customer(3), customer(4)])));
    const { f, el } = create({ quotationId: 30 });
    expect(confirm(el).disabled).toBe(true);
    const radios = el.querySelectorAll('input[name="convert-customer"]');
    expect(radios.length).toBe(2);
    (radios[1] as HTMLInputElement).dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(confirm(el).disabled).toBe(false);
    confirm(el).click();
    expect(crm.convert).toHaveBeenCalledWith(5, { quotationId: 30, customerId: 4, orderDate: isoDate(new Date()), paymentMode: 'Cash' });
  });

  it('uses the one match, and no customer when there is none', () => {
    crm.previewConvert = vi.fn(() => ok(preview([customer(3)])));
    let d = create({ quotationId: 30 });
    expect(d.el.textContent).toContain('The customer C3');
    confirm(d.el).click();
    expect(crm.convert).toHaveBeenLastCalledWith(5, expect.objectContaining({ quotationId: 30, customerId: 3 }));

    crm.previewConvert = vi.fn(() => ok(preview([])));
    d = create({ quotationId: 30 });
    confirm(d.el).click();
    expect(crm.convert).toHaveBeenLastCalledWith(5, expect.objectContaining({ quotationId: 30, customerId: null }));
  });

  it('sends the order date and the payment mode as chosen', () => {
    const { f, el } = create({ quotationId: 30 });
    f.componentInstance.orderDate.set('2026-11-15');
    f.componentInstance.paymentMode.set('UPI');
    f.detectChanges();
    confirm(el).click();
    expect(crm.convert).toHaveBeenCalledWith(5, { quotationId: 30, customerId: null, orderDate: '2026-11-15', paymentMode: 'UPI' });
  });

  it('tells the page the order that was made', () => {
    const { el, converted } = create({ quotationId: 30 });
    confirm(el).click();
    expect(converted).toHaveBeenCalledWith({ salesOrderId: 9, orderNo: 'SO-0009', customerId: 3 });
  });

  it('shows a failed convert as the server said it and tells the page nothing', () => {
    const said = 'The sale may have been made but the lead could not be updated. A manager can check the sales orders and link it from the lead';
    crm.convert = vi.fn(() => throwError(() => ({ status: 400, error: { success: false, message: said } })));
    const { f, el, converted, forbidden } = create({ quotationId: 30 });
    confirm(el).click();
    f.detectChanges();
    expect(el.textContent).toContain(said);
    expect(converted).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('shows a convert answered with success false as the server said it', () => {
    crm.convert = vi.fn(() => of({ success: false, message: 'A manager must check the sales orders for this lead first', data: null }));
    const { f, el, converted } = create({ quotationId: 30 });
    confirm(el).click();
    f.detectChanges();
    expect(el.textContent).toContain('A manager must check the sales orders for this lead first');
    expect(converted).not.toHaveBeenCalled();
  });

  it('hands a 403 to the page', () => {
    crm.convert = vi.fn(() => throwError(() => ({ status: 403 })));
    const { el, forbidden } = create({ quotationId: 30 });
    confirm(el).click();
    expect(forbidden).toHaveBeenCalled();
    expect(el.textContent).not.toContain(FORBIDDEN);
  });

  it('Cancel closes without a request', () => {
    const { el, cancelled } = create({ quotationId: 30 });
    (el.querySelector('.cv-cancel') as HTMLButtonElement).click();
    expect(cancelled).toHaveBeenCalled();
    expect(crm.convert).not.toHaveBeenCalled();
  });
});
