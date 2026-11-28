import type { jsPDF } from 'jspdf';
import { PrintCompany } from '../document-print/document-print';
import { documentFileName } from '../document-print/document-pdf';

/** GET api/technician/job-card/{assignmentId} (dbo.sp_JobCard_Get, 32_Job_Card.sql). */
export interface JobCard {
  assignmentId: number;
  complaintId: number;
  complaintNumber: string;
  subject?: string | null;
  description?: string | null;
  natureOfJob?: string | null;
  complaintCategory?: string | null;
  priority?: string | null;
  slaDeadline?: string | null;
  complaintDate?: string | null;
  preferredDate?: string | null;
  preferredTimeSlot?: string | null;
  isWarranty?: boolean | null;
  statusName?: string | null;
  assignmentRole?: string | null;
  assignmentStatus?: string | null;
  assignedAt?: string | null;
  scheduledDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  timeSlot?: string | null;
  estimatedDuration?: number | null;
  notes?: string | null;
  technicianName?: string | null;
  technicianMobile?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  customerAlternatePhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  productName?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  productCategory?: string | null;
  purchaseDate?: string | null;
  warrantyExpiryDate?: string | null;
  team?: JobCardTechnician[];
}

export interface JobCardTechnician {
  assignmentId: number;
  technicianName?: string | null;
  technicianMobile?: string | null;
  assignmentRole?: string | null;
  scheduledDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

export interface JobCardRow { label: string; value: string; }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SLOTS: Record<string, string> = { morning: 'Morning (9 AM - 12 PM)', afternoon: 'Afternoon (12 PM - 4 PM)', evening: 'Evening (4 PM - 7 PM)' };

const clean = (v: unknown): string => (v === null || v === undefined ? '' : String(v)).replace(/\s+/g, ' ').trim();

/** "27 Nov 2026" from an ISO date or date-time, read as written (no time-zone shift). */
export function cardDate(value: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}

/** "27 Nov 2026, 02:30 PM" from an ISO date-time, read as written. */
export function cardDateTime(value: string | null | undefined): string {
  const t = /T(\d{2}):(\d{2})/.exec(value ?? '');
  const day = cardDate(value);
  return day && t ? `${day}, ${cardTime(`${t[1]}:${t[2]}`)}` : day;
}

/** "02:30 PM" from "14:30" or "14:30:00". */
export function cardTime(value: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(clean(value));
  if (!m) return clean(value);
  const h = Number(m[1]);
  return `${String(h % 12 || 12).padStart(2, '0')}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** When the technician is expected: date, then the time window or the slot. */
export function visitWhen(c: Pick<JobCard, 'scheduledDate' | 'startTime' | 'endTime' | 'timeSlot'>): string {
  const time = c.startTime ? [cardTime(c.startTime), cardTime(c.endTime)].filter(Boolean).join(' - ')
    : SLOTS[clean(c.timeSlot).toLowerCase()] ?? clean(c.timeSlot);
  return [cardDate(c.scheduledDate), time].filter(Boolean).join(', ');
}

/** In or out of warranty on the visit day (or today without one). */
export function warrantyText(c: Pick<JobCard, 'warrantyExpiryDate' | 'scheduledDate' | 'isWarranty'>, today = new Date()): string {
  const end = (c.warrantyExpiryDate ?? '').slice(0, 10);
  if (!end) return c.isWarranty ? 'Under warranty' : '';
  const on = (c.scheduledDate ?? '').slice(0, 10) || today.toISOString().slice(0, 10);
  return `${end >= on ? 'In warranty' : 'Out of warranty'} (till ${cardDate(end)})`;
}

/**
 * The address once: a complaint's location address often holds the city, state and PIN already, and a landmark is
 * often typed as "Near ...". A part already in the address is not added again.
 */
export function customerAddress(c: JobCard): string {
  const address = clean(c.customerAddress);
  const has = (part: string) => address.toLowerCase().includes(part.toLowerCase());
  const landmark = clean(c.landmark);
  const near = landmark && !has(landmark) ? (/^near\b/i.test(landmark) ? landmark : `Near ${landmark}`) : '';
  return [address, near, ...[c.city, c.state, c.pinCode].map(clean).filter(p => p && !has(p))]
    .filter(Boolean).join(', ');
}

export function mapUrl(c: Pick<JobCard, 'latitude' | 'longitude'>): string {
  return c.latitude && c.longitude ? `https://www.google.com/maps?q=${c.latitude},${c.longitude}` : '';
}

/** The sections of facts on the card; blank facts are left out. */
export function jobCardSections(c: JobCard, today = new Date()): { title: string; rows: JobCardRow[] }[] {
  const keep = (rows: JobCardRow[]) => rows.map(r => ({ ...r, value: clean(r.value) })).filter(r => r.value);
  const team = (c.team?.length ? c.team : [{ assignmentId: c.assignmentId, technicianName: c.technicianName, technicianMobile: c.technicianMobile, assignmentRole: c.assignmentRole }])
    .map(t => ({ label: clean(t.assignmentRole) || 'Technician', value: [t.technicianName, t.technicianMobile].map(clean).filter(Boolean).join(' · ') }));
  return [
    { title: 'Visit', rows: keep([
      { label: 'Visit on', value: visitWhen(c) },
      { label: 'Nature of job', value: c.natureOfJob ?? '' },
      { label: 'Priority', value: c.priority ?? '' },
      { label: 'Complete by (SLA)', value: cardDateTime(c.slaDeadline) },
      { label: 'Estimated time', value: c.estimatedDuration ? `${c.estimatedDuration} min` : '' },
      { label: 'Complaint date', value: cardDate(c.complaintDate) },
      { label: 'Customer prefers', value: [cardDate(c.preferredDate), c.preferredTimeSlot].map(clean).filter(Boolean).join(', ') },
    ]) },
    { title: 'Technicians', rows: keep(team) },
    { title: 'Customer', rows: keep([
      { label: 'Name', value: c.customerName ?? '' },
      { label: 'Mobile', value: [c.customerMobile, c.customerAlternatePhone].map(clean).filter(Boolean).join(' / ') },
      { label: 'Email', value: c.customerEmail ?? '' },
      { label: 'Address', value: customerAddress(c) },
      { label: 'Location', value: c.latitude && c.longitude ? `${c.latitude}, ${c.longitude}` : '' },
    ]) },
    { title: 'Product', rows: keep([
      { label: 'Product', value: c.productName ?? '' },
      { label: 'Brand / model', value: [c.brand, c.model].map(clean).filter(Boolean).join(' / ') },
      { label: 'Serial number', value: c.serialNumber ?? '' },
      { label: 'Category', value: c.productCategory || c.complaintCategory || '' },
      { label: 'Purchased on', value: cardDate(c.purchaseDate) },
      { label: 'Warranty', value: warrantyText(c, today) },
    ]) },
    { title: 'Complaint', rows: keep([
      { label: 'Subject', value: c.subject ?? '' },
      { label: 'Description', value: c.description ?? '' },
      { label: 'Instructions', value: c.notes ?? '' },
    ]) },
  ].filter(s => s.rows.length > 0);
}

/** "JobCard-CMP-0012-ANIL KUMAR.pdf" */
export const jobCardFileName = (c: JobCard): string => documentFileName('JobCard', c.complaintNumber, c.customerName);

/** The message sent with the PDF (or alone, when the browser cannot share a file). */
export function jobCardMessage(c: JobCard): string {
  return [
    `Job card ${c.complaintNumber}${c.technicianName ? ` for ${clean(c.technicianName)}` : ''}`,
    visitWhen(c) && `Visit: ${visitWhen(c)}`,
    [c.customerName, c.customerMobile].map(clean).filter(Boolean).join(', ') && `Customer: ${[c.customerName, c.customerMobile].map(clean).filter(Boolean).join(', ')}`,
    customerAddress(c) && `Address: ${customerAddress(c)}`,
    mapUrl(c) && `Map: ${mapUrl(c)}`,
    [c.productName, c.brand, c.model].map(clean).filter(Boolean).join(' ') && `Product: ${[c.productName, c.brand, c.model].map(clean).filter(Boolean).join(' ')}`,
    clean(c.subject) && `Complaint: ${clean(c.subject)}`,
  ].filter(Boolean).join('\n');
}

/** The standard PDF fonts hold Latin-1 only: the rupee sign and other characters become plain text. */
export const pdfText = (v: string): string => v.replace(/₹/g, 'Rs.').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '?');

// ── drawing ──────────────────────────────────────────────────────────────────
const PAGE_W = 210, PAGE_H = 297, M = 12, W = PAGE_W - 2 * M;
const INK = 26, MUTED = 100, LINE = 190, FILL = 242;

/** Draws the job card into a new A4 PDF: the facts, then boxes the technician fills in on site. */
export async function buildJobCardPdf(c: JobCard, company: PrintCompany, printedAt = new Date(), compress = true): Promise<jsPDF> {
  const { jsPDF: Pdf } = await import('jspdf');
  const pdf = new Pdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress });
  let y = M;

  const ensure = (h: number) => { if (y + h > PAGE_H - M - 8) { pdf.addPage('a4', 'portrait'); y = M; } };
  const font = (size: number, style: 'normal' | 'bold' = 'normal', gray = INK) => {
    pdf.setFont('helvetica', style); pdf.setFontSize(size); pdf.setTextColor(gray);
  };
  const title = (text: string) => {
    ensure(12);
    pdf.setFillColor(FILL, FILL, FILL); pdf.rect(M, y, W, 6.5, 'F');
    font(9.5, 'bold'); pdf.text(pdfText(text.toUpperCase()), M + 2, y + 4.5);
    y += 8.5;
  };

  // header: company, title, job number
  font(14, 'bold'); pdf.text(pdfText(clean(company.name) || 'Job Card'), M, y + 5);
  font(8.5, 'normal', MUTED);
  const companyLines = [clean(company.address), clean(company.phone) && `Phone ${clean(company.phone)}`].filter(Boolean);
  companyLines.forEach((l, i) => pdf.text(pdfText(l), M, y + 10 + i * 4));
  font(16, 'bold'); pdf.text('JOB CARD', PAGE_W - M, y + 5, { align: 'right' });
  font(10, 'bold'); pdf.text(pdfText(c.complaintNumber), PAGE_W - M, y + 11, { align: 'right' });
  font(8, 'normal', MUTED);
  pdf.text(pdfText(`Printed ${cardDateTime(localIso(printedAt))}`), PAGE_W - M, y + 15.5, { align: 'right' });
  y += Math.max(18, 12 + companyLines.length * 4);
  pdf.setDrawColor(LINE); pdf.line(M, y, PAGE_W - M, y);
  y += 4;

  // the facts, label on the left, value wrapped on the right
  const labelW = 38;
  for (const s of jobCardSections(c)) {
    title(s.title);
    for (const r of s.rows) {
      font(9.5);
      const lines = pdf.splitTextToSize(pdfText(r.value), W - labelW - 2) as string[];
      ensure(lines.length * 4.6 + 1.5);
      font(8.5, 'normal', MUTED); pdf.text(pdfText(r.label), M + 2, y + 3.4);
      font(9.5); pdf.text(lines, M + labelW, y + 3.4);
      y += lines.length * 4.6 + 1.2;
    }
    if (s.title === 'Customer' && mapUrl(c)) {
      ensure(6);
      font(9, 'normal', 30); pdf.setTextColor(27, 74, 122);
      pdf.textWithLink('Open the location in Google Maps', M + labelW, y + 3.4, { url: mapUrl(c) });
      y += 6;
    }
    y += 2;
  }

  // what the technician writes on site
  title('To be filled on site');
  const field = (label: string, x: number, w: number, h = 9) => {
    pdf.setDrawColor(LINE); pdf.rect(x, y, w, h);
    font(7.5, 'normal', MUTED); pdf.text(pdfText(label), x + 1.5, y + 3.2);
  };
  const row = (labels: string[], h = 9) => {
    ensure(h + 2);
    const gap = 3, w = (W - gap * (labels.length - 1)) / labels.length;
    labels.forEach((l, i) => field(l, M + i * (w + gap), w, h));
    y += h + 2.5;
  };
  row(['Arrival date & time', 'Work started', 'Work finished']);
  row(['Problem found'], 20);
  row(['Work done'], 26);

  // parts used: a small table
  ensure(8 + 5 * 7);
  font(8.5, 'bold'); pdf.text('Parts used / replaced', M, y + 3.5);
  y += 5;
  const cols = [{ t: 'Part', w: 0.46 }, { t: 'Serial / part no.', w: 0.3 }, { t: 'Qty', w: 0.1 }, { t: 'Charge', w: 0.14 }];
  let x = M;
  pdf.setFillColor(FILL, FILL, FILL); pdf.rect(M, y, W, 6, 'F');
  cols.forEach(col => { font(7.5, 'bold', MUTED); pdf.text(col.t, x + 1.5, y + 4); x += col.w * W; });
  y += 6;
  for (let i = 0; i < 5; i++) {
    x = M;
    cols.forEach(col => { pdf.setDrawColor(LINE); pdf.rect(x, y, col.w * W, 7); x += col.w * W; });
    y += 7;
  }
  y += 3;

  row(['Readings / tests (voltage, pressure, error codes ...)'], 14);
  row(['Amount collected (Rs.)', 'Payment mode', 'Receipt no.']);
  ensure(12);
  font(8.5, 'bold'); pdf.text('Job status', M, y + 3.5);
  font(9); ['Completed', 'Pending - parts', 'Pending - revisit', 'Not attended'].forEach((s, i) => {
    const bx = M + 26 + i * 40;
    pdf.setDrawColor(90); pdf.rect(bx, y + 0.6, 3.6, 3.6); pdf.text(s, bx + 5.5, y + 3.6);
  });
  y += 7;
  ensure(12);
  font(8.5, 'bold'); pdf.text('Customer', M, y + 3.5);
  font(9); ['Satisfied', 'Not satisfied'].forEach((s, i) => {
    const bx = M + 26 + i * 40;
    pdf.setDrawColor(90); pdf.rect(bx, y + 0.6, 3.6, 3.6); pdf.text(s, bx + 5.5, y + 3.6);
  });
  y += 8;
  row(['Customer remarks'], 14);
  row(['Customer name & signature', 'Technician signature'], 20);

  // footer on every page
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    font(7.5, 'normal', MUTED);
    pdf.text(pdfText(`${c.complaintNumber} · Enter what was done in the app once you are back in network coverage.`), M, PAGE_H - 7);
    pdf.text(`Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 7, { align: 'right' });
  }
  pdf.setProperties({ title: `Job Card ${c.complaintNumber}`, subject: clean(c.subject) });
  return pdf;
}

/** The local date-time as "YYYY-MM-DDTHH:mm", so cardDateTime shows the clock of this device. */
function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
