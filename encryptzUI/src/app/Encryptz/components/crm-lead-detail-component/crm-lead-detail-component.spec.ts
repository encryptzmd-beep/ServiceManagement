import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { CrmLeadDetailComponent } from './crm-lead-detail-component';

describe('CrmLeadDetailComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  const quote = (over: any = {}) => ({
    quotationId: 30, leadId: 5, quotationNo: 'QT-0003', revisionNo: 1, quoteDate: '2026-11-10', isInterState: false,
    taxableTotal: 1000, grandTotal: 1180, status: 'Sent', createdAt: '', updatedAt: '', isLatest: true, ...over,
  });
  const lead = (over: any = {}) => ({
    leadId: 5, leadNo: 'LD-0005', leadDate: '2026-11-01', contactName: 'Meera', mobile: '9876543210', email: '', address: '',
    city: 'Kochi', state: 'Kerala', pinCode: '', landmark: '', sourceName: 'Walk-in', productCategory: 'Inverter',
    modelRequirement: '', ownerUserId: 1, ownerName: 'Anu', priority: 'Medium', status: 'Quotation', lostReasonName: '',
    lostNote: '', remarks: '', createdAt: '', followUps: [], history: [], quotations: [quote()], ...over,
  });
  const preview = (matches: any[]) => ({
    matches,
    quotation: { quotationId: 30, quotationNo: 'QT-0003', revisionNo: 1, taxableTotal: 1000, cgst: 90, sgst: 90, igst: 0, grandTotal: 1180, items: [] },
  });
  const customer = (id: number) => ({ customerId: id, customerName: `C${id}`, mobileNumber: '9876543210', totalProducts: 0 });

  let crm: any;
  let current: any;
  let isManager: boolean;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmLeadDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
        { provide: CrmService, useValue: crm },
      ],
    });
    const fixture = TestBed.createComponent(CrmLeadDetailComponent);
    fixture.detectChanges();
    return fixture;
  };
  const el = (f: any) => f.nativeElement as HTMLElement;

  beforeEach(() => {
    current = lead();
    isManager = false;
    crm = {
      getLead: () => ok(current),
      me: () => ok({ userId: 1, fullName: 'Anu', isManager }),
      getMasters: () => ok([]),
      getMembers: () => ok({ members: [], available: [] }),
      previewConvert: () => ok(preview([])),
      convert: vi.fn(() => ok({ salesOrderId: 9, orderNo: 'SO-0009', customerId: 3 })),
    };
  });

  it('offers Convert for a lead in Quotation or Negotiation with a current quotation', () => {
    expect(el(create()).querySelector('.crm-convert')).not.toBeNull();
    current = lead({ status: 'Negotiation' });
    expect(el(create()).querySelector('.crm-convert')).not.toBeNull();
  });

  it('hides Convert in another status, or when every quotation is superseded', () => {
    current = lead({ status: 'Qualified' });
    expect(el(create()).querySelector('.crm-convert')).toBeNull();
    current = lead({ quotations: [quote({ status: 'Superseded', isLatest: false })] });
    expect(el(create()).querySelector('.crm-convert')).toBeNull();
    current = lead({ quotations: [] });
    expect(el(create()).querySelector('.crm-convert')).toBeNull();
  });

  it('keeps Confirm disabled until one of several customers is chosen', () => {
    crm.previewConvert = () => ok(preview([customer(3), customer(4)]));
    const f = create();
    f.componentInstance.openConvert();
    f.detectChanges();
    const confirm = () => el(f).querySelector('.crm-confirm-convert') as HTMLButtonElement;
    expect(confirm().disabled).toBe(true);

    f.componentInstance.chooseCustomer(4);
    f.detectChanges();
    expect(confirm().disabled).toBe(false);
    confirm().click();
    expect(crm.convert).toHaveBeenCalledWith(5, expect.objectContaining({ quotationId: 30, customerId: 4 }));
  });

  it('lets one match or none go ahead', () => {
    crm.previewConvert = () => ok(preview([customer(3)]));
    const f = create();
    f.componentInstance.openConvert();
    f.detectChanges();
    expect((el(f).querySelector('.crm-confirm-convert') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows a failed convert as the server said it', () => {
    const said = 'The sale may have been made but the lead could not be updated. A manager can check the sales orders and link it from the lead';
    crm.convert = () => throwError(() => ({ status: 400, error: { success: false, message: said } }));
    const f = create();
    f.componentInstance.openConvert();
    f.detectChanges();
    (el(f).querySelector('.crm-confirm-convert') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el(f).textContent).toContain(said);
  });

  it('offers Link existing order to a manager only', () => {
    current = lead({ convertNeedsCheck: true });
    expect(el(create()).querySelector('.crm-link-order')).toBeNull();
    isManager = true;
    expect(el(create()).querySelector('.crm-link-order')).not.toBeNull();
  });

  it('offers Link existing order and Cancel convert only when the lead needs a check', () => {
    isManager = true;
    let f = create();
    expect(el(f).querySelector('.crm-link-order')).toBeNull();
    expect(el(f).querySelector('.crm-cancel-convert')).toBeNull();
    expect(el(f).querySelector('.crm-needs-check')).toBeNull();

    current = lead({ convertNeedsCheck: true });
    f = create();
    expect(el(f).querySelector('.crm-link-order')).not.toBeNull();
    expect(el(f).querySelector('.crm-cancel-convert')).not.toBeNull();
    expect(el(f).querySelector('.crm-needs-check')!.textContent).toContain('A manager must check the sales orders for this lead first');
    // the convert is not offered again while the check is pending
    expect(el(f).querySelector('.crm-convert')).toBeNull();
  });

  it('shows the needs-check notice but no link or cancel to a sales user', () => {
    current = lead({ convertNeedsCheck: true });
    const f = create();
    expect(el(f).querySelector('.crm-needs-check')).not.toBeNull();
    expect(el(f).querySelector('.crm-link-order')).toBeNull();
    expect(el(f).querySelector('.crm-cancel-convert')).toBeNull();
  });

  it('lets a manager cancel the convert of a lead that needs a check', () => {
    isManager = true;
    current = lead({ convertNeedsCheck: true });
    crm.cancelConvert = vi.fn(() => ok(5));
    const f = create();
    (el(f).querySelector('.crm-cancel-convert') as HTMLButtonElement).click();
    f.detectChanges();
    current = lead();
    (el(f).querySelector('.crm-confirm-cancel-convert') as HTMLButtonElement).click();
    f.detectChanges();
    expect(crm.cancelConvert).toHaveBeenCalledWith(5);
    expect(el(f).textContent).toContain('Convert cancelled');
    expect(el(f).querySelector('.crm-cancel-convert')).toBeNull();
  });

  it('sends the person to the module list when the convert is refused with 403', () => {
    crm.convert = () => throwError(() => ({ status: 403 }));
    const f = create();
    f.componentInstance.openConvert();
    f.detectChanges();
    (el(f).querySelector('.crm-confirm-convert') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el(f).textContent).toContain('Open CRM from the module list');
    expect(el(f).querySelector('.crm-refused a')!.getAttribute('href')).toBe('/select-module');
    expect(el(f).textContent).not.toContain('You may not convert this lead');
  });

  it('links an order to the latest non-superseded quotation', () => {
    isManager = true;
    current = lead({ quotations: [quote({ quotationId: 29, status: 'Superseded', isLatest: false }), quote({ quotationId: 30 })] });
    crm.linkOrder = vi.fn(() => ok(1));
    const f = create();
    f.componentInstance.open('link');
    f.componentInstance.orderNo.set(' SO-0009 ');
    f.componentInstance.saveLink();
    expect(crm.linkOrder).toHaveBeenCalledWith(5, { orderNo: 'SO-0009', quotationId: 30 });
  });

  it('links an order without a quotation when the lead has none', () => {
    isManager = true;
    current = lead({ quotations: [] });
    crm.linkOrder = vi.fn(() => ok(1));
    const f = create();
    f.componentInstance.open('link');
    f.componentInstance.orderNo.set('SO-0009');
    f.componentInstance.saveLink();
    expect(crm.linkOrder).toHaveBeenCalledWith(5, { orderNo: 'SO-0009', quotationId: null });
  });

  it('keeps a converted lead read-only and shows its order', () => {
    current = lead({ status: 'Converted', salesOrderId: 9, orderNo: 'SO-0009' });
    const text = el(create()).textContent!;
    expect(text).toContain('SO-0009');
    expect(el(create()).querySelector('.crm-add-follow-up')).toBeNull();
  });
});
