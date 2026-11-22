import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { CrmService } from '../../Services/crm-service';
import { CrmQuotationPrintComponent } from './crm-quotation-print-component';

describe('CrmQuotationPrintComponent', () => {
  const create = (over: Record<string, unknown> = {}) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmQuotationPrintComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '30' }) } } },
        { provide: AuthService, useValue: {
          selectedCompanyId: () => 2,
          companies: () => [{ companyId: 2, companyName: 'Hamster A/C', address: '12 MG Road', city: 'Kochi', phoneNumber: '0484 1234' }],
        } },
        { provide: CrmService, useValue: {
          getPrintSettings: () => of({ success: true, message: '', data: {
            'Print.CompanyMSME': 'UDYAM-KL-00-0000000', 'Print.BankAccountNo': '000111222333', 'Print.Warranty': 'One year on the machine',
            'Print.OptionalItems': 'Outdoor Stand | 1200 | 2 Nos',
          } }),
          getQuotation: () => of({ success: true, message: '', data: {
          quotationId: 30, quotationNo: 'QT-0003', revisionNo: 2, quoteDate: '2026-11-10', isInterState: false, subTotal: 1000,
          discountTotal: 0, taxableTotal: 1000, cgst: 90, sgst: 90, igst: 0, grandTotal: 1180, terms: 'Valid 15 days', status: 'Sent',
          referenceNo: 'REF-77', customerGstin: '32ABCDE1234F1Z5',
          contactName: 'Meera', mobile: '9876543210', address: 'Palarivattom', city: 'Kochi', state: 'Kerala', pinCode: '682025',
          items: [{ productName: 'Inverter 1kVA', hsnSac: '8504', qty: 1, rate: 1000, discountAmount: 0, gstPercent: 18,
            warrantyMonths: 12, taxableAmount: 1000, gstAmount: 180, lineTotal: 1180, sortOrder: 1, mrp: 1500 }],
          ...over,
        } }) } },
      ],
    });
    const fixture = TestBed.createComponent(CrmQuotationPrintComponent);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  };

  it('prints the company, the customer, the lines and the totals', () => {
    const text = create();
    expect(text).toContain('Hamster A/C');
    expect(text).toContain('12 MG Road');
    expect(text).toContain('QT-0003 / R2');
    expect(text).toContain('Meera');
    expect(text).toContain('Inverter 1kVA');
    expect(text).toContain('1,180.00');
    expect(text).toContain('Valid 15 days');
  });

  it('shows GST as included when the prices include it', () => {
    const text = create({ pricesIncludeGst: true, subTotal: 1180, taxableTotal: 1000, grandTotal: 1180 });
    expect(text).toContain('Sub Total (Incl. GST)');
    expect(text).toContain('Taxable Value');
    expect(text).toContain('CGST (included)');
    expect(text).toContain('One Thousand One Hundred Eighty Rupees Only');
  });

  it('shows the terms and no If Required table', () => {
    const text = create({ terms: 'Payment against billing' });
    expect(text).toContain('Terms & Conditions');
    expect(text).toContain('Payment against billing');
    expect(text).not.toContain('IF REQUIRED');
    expect(text).not.toContain('Outdoor Stand');
  });

  it('keeps the Terms & Conditions heading when a quotation has no terms', () => {
    expect(create({ terms: '' })).toContain('Terms & Conditions');
  });

  it('prints the fields of the company quotation format', () => {
    const text = create();
    for (const field of ['REF-77', '32ABCDE1234F1Z5', 'UDYAM-KL-00-0000000', '000111222333', 'One year on the machine',
      'Terms & Conditions', '[MRP : 1,500/-]', 'One Thousand One Hundred Eighty Rupees Only']) {
      expect(text).toContain(field);
    }
  });
});
