import { quotationWhatsAppFileName, quotationWhatsAppMessage } from './quotation-whatsapp';
import { whatsAppNumber, whatsAppUrl } from '../shared/whatsapp';

describe('send quotation via WhatsApp', () => {
  it('names the PDF after the quotation number and the customer', () => {
    expect(quotationWhatsAppFileName('QTN-001', 1, 'ABC Enterprises')).toBe('QTN-001_ABC-ENTERPRISES.pdf');
    expect(quotationWhatsAppFileName('QT-0008', 1, 'Anil Kumar & Sons, Kochi')).toBe('QT-0008_ANIL-KUMAR-SONS-KOCHI.pdf');
    expect(quotationWhatsAppFileName('QT-0008', 2, 'Meera Nair')).toBe('QT-0008-R2_MEERA-NAIR.pdf');
    expect(quotationWhatsAppFileName('QT-0008', 1, '')).toBe('QT-0008.pdf');
    expect(quotationWhatsAppFileName('QT/0008', 1, 'a:b*c')).toBe('QT-0008_A-B-C.pdf');
  });

  it('opens the chat of the registered mobile with the message', () => {
    expect(whatsAppNumber('98460 12345')).toBe('919846012345');
    expect(whatsAppNumber('+91-98460-12345')).toBe('919846012345');
    expect(whatsAppNumber('12345')).toBe('');
    expect(whatsAppUrl('9846012345', 'Hi there')).toBe('https://wa.me/919846012345?text=Hi%20there');
  });

  it('writes the message from the quotation', () => {
    const text = quotationWhatsAppMessage({
      quotationNo: 'QT-0008', revisionNo: 1, quoteDate: '2026-11-27', validUntil: '2026-12-11T00:00:00', grandTotal: 118000, contactName: 'Anil Kumar',
    }, 'Felix Fitness');
    expect(text).toContain('Dear Anil Kumar,');
    expect(text).toContain('our quotation QT-0008 dated 27 Nov 2026 for Rs. 1,18,000.00, valid until 11 Dec 2026.');
    expect(text.endsWith('Thank you,\nFelix Fitness')).toBe(true);
  });
});
