import { JobCard, buildJobCardPdf, cardDate, cardTime, customerAddress, jobCardFileName, jobCardMessage, jobCardSections, pdfText, visitWhen, warrantyText } from './job-card';
import { whatsAppNumber } from './job-card-service';

const card = (over: Partial<JobCard> = {}): JobCard => ({
  assignmentId: 41, complaintId: 12, complaintNumber: 'CMP-0012',
  subject: 'Treadmill belt slipping', description: 'Belt slips above 8 km/h', natureOfJob: 'Repair', priority: 'High',
  slaDeadline: '2026-11-29T18:00:00', complaintDate: '2026-11-26T10:15:00',
  scheduledDate: '2026-11-28T00:00:00', startTime: '14:30:00', endTime: '16:00:00', estimatedDuration: 90,
  notes: 'Carry a spare belt', assignmentRole: 'Primary',
  technicianName: 'Arjun Menon', technicianMobile: '98470 12345',
  customerName: 'Anil Kumar', customerMobile: '9846012345', customerAddress: 'TC 12/345, MG Road', landmark: 'St. Mary School',
  city: 'Kochi', state: 'Kerala', pinCode: '682016', latitude: 9.9312, longitude: 76.2673,
  productName: 'Treadmill T-10C', brand: 'Felix', model: 'T-10C', serialNumber: 'TM10C-0042',
  purchaseDate: '2026-03-10T00:00:00', warrantyExpiryDate: '2027-03-10T00:00:00',
  team: [
    { assignmentId: 41, technicianName: 'Arjun Menon', technicianMobile: '98470 12345', assignmentRole: 'Primary' },
    { assignmentId: 42, technicianName: 'Rahul Das', technicianMobile: '98460 54321', assignmentRole: 'Supporting' },
  ],
  ...over,
});

describe('job card', () => {
  it('shows dates and times as the technician reads them', () => {
    expect(cardDate('2026-11-28T00:00:00')).toBe('28 Nov 2026');
    expect(cardTime('14:30:00')).toBe('02:30 PM');
    expect(cardTime('09:05')).toBe('09:05 AM');
    expect(visitWhen(card())).toBe('28 Nov 2026, 02:30 PM - 04:00 PM');
    expect(visitWhen(card({ startTime: null, timeSlot: 'morning' }))).toBe('28 Nov 2026, Morning (9 AM - 12 PM)');
  });

  it('tells in or out of warranty on the visit day', () => {
    expect(warrantyText(card())).toBe('In warranty (till 10 Mar 2027)');
    expect(warrantyText(card({ warrantyExpiryDate: '2026-11-01T00:00:00' }))).toBe('Out of warranty (till 1 Nov 2026)');
  });

  it('carries the job, the team, the customer and the product, and leaves blanks out', () => {
    const sections = jobCardSections(card({ customerEmail: null }));
    expect(sections.map(s => s.title)).toEqual(['Visit', 'Technicians', 'Customer', 'Product', 'Complaint']);
    const all = sections.flatMap(s => s.rows.map(r => `${r.label}: ${r.value}`));
    expect(all).toContain('Supporting: Rahul Das · 98460 54321');
    expect(all).toContain('Address: TC 12/345, MG Road, Near St. Mary School, Kochi, Kerala, 682016');
    expect(all).toContain('Serial number: TM10C-0042');
    expect(all).toContain('Instructions: Carry a spare belt');
    expect(all.some(r => r.startsWith('Email'))).toBe(false);
  });

  it('writes the address once, when the location address holds the city and the landmark says Near', () => {
    expect(customerAddress(card({
      customerAddress: '14 Temple Road, Edappally, Kochi, Kerala, 682024', landmark: 'Near Lulu Mall',
      city: 'Kochi', state: 'Kerala', pinCode: '682024',
    }))).toBe('14 Temple Road, Edappally, Kochi, Kerala, 682024, Near Lulu Mall');
  });

  it('names the file and the message after the job', () => {
    expect(jobCardFileName(card())).toBe('JobCard-CMP-0012-Anil Kumar.pdf');
    const text = jobCardMessage(card());
    expect(text).toContain('Job card CMP-0012 for Arjun Menon');
    expect(text).toContain('Map: https://www.google.com/maps?q=9.9312,76.2673');
  });

  it('keeps to characters the PDF font can print', () => {
    expect(pdfText('₹ 1,200 – paid')).toBe('Rs. 1,200 - paid');
  });

  it('draws an A4 PDF with the job and the boxes to fill in', async () => {
    const pdf = await buildJobCardPdf(card(), { name: 'Felix Fitness', address: 'Kaloor, Kochi', phone: '0484 2345678' },
      new Date(2026, 10, 27, 9, 30), false);
    const raw = pdf.output();
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    for (const t of ['JOB CARD', 'CMP-0012', 'Anil Kumar', 'TM10C-0042', 'Work done', 'Parts used / replaced', 'Technician signature'])
      expect(raw).toContain(t);
  });

  it('dials the technician on WhatsApp with the country code', () => {
    expect(whatsAppNumber('98470 12345')).toBe('919847012345');
    expect(whatsAppNumber('+91 98470 12345')).toBe('919847012345');
    expect(whatsAppNumber('098470 12345')).toBe('919847012345');
    expect(whatsAppNumber('12345')).toBe('');
  });
});
