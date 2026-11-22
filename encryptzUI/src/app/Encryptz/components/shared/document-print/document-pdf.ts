import { ApplicationRef, EnvironmentInjector, Injectable, Injector, createComponent, inject } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { AuthService } from '../../../Auth/auth-service';
import { DocumentPrintComponent, PrintDocument, printCompanyOf } from './document-print';

/** A4 with the same 10 mm margin as the printed page. */
const MARGIN_MM = 10;
const CONTENT_WIDTH_MM = 190;
const CONTENT_HEIGHT_MM = 277;
const RENDER_SCALE = 2.5;
/** Blocks a page may end after, so a page never cuts through a row or the seal. */
const PAGE_STOPS = '.dp-head, .dp-title, .dp-party, tr, .dp-lower, .dp-closing, .dp-regards, .dp-banner, .dp-footer-text';

/** Where each page ends: at the last stop that fits, or at the page height when nothing does. */
export function pageEnds(total: number, pageHeight: number, stops: number[]): number[] {
  const sorted = [...new Set(stops)].filter(s => s > 0 && s < total).sort((a, b) => a - b);
  const ends: number[] = [];
  let start = 0;
  while (total - start > pageHeight) {
    const limit = start + pageHeight;
    const end = sorted.filter(s => s > start && s <= limit).pop() ?? limit;
    ends.push(end);
    start = end;
  }
  ends.push(total);
  return ends;
}

/** "Quotation-QT-0008-R1-MEERA NAIR.pdf", without characters a file name cannot hold. */
export function documentFileName(kind: string, number: string, party?: string | null): string {
  const name = [kind, number, party].filter(p => !!p?.trim()).join('-')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim();
  return `${name}.pdf`;
}

/** Draws the same layout as the print into an A4 PDF, in the browser, and downloads it. */
@Injectable({ providedIn: 'root' })
export class DocumentPdfService {
  private appRef = inject(ApplicationRef);
  private environment = inject(EnvironmentInjector);
  private injector = inject(Injector);

  async download(doc: PrintDocument, settings: Record<string, string>, fileName: string): Promise<void> {
    const pdf = await this.build(doc, settings);
    pdf.setProperties({ title: fileName.replace(/\.pdf$/i, '') });
    pdf.save(fileName);
  }

  async build(doc: PrintDocument, settings: Record<string, string>): Promise<jsPDF> {
    // the libraries are large: they load only when a PDF is asked for
    const [{ default: html2canvas }, { jsPDF: Pdf }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);

    const holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = `position:fixed;left:-300mm;top:0;width:${CONTENT_WIDTH_MM}mm;background:#fff;pointer-events:none;`;
    const ref = createComponent(DocumentPrintComponent, { environmentInjector: this.environment });
    ref.setInput('doc', doc);
    ref.setInput('settings', settings);
    ref.setInput('company', printCompanyOf(this.injector.get(AuthService, null)));
    holder.appendChild(ref.location.nativeElement);
    document.body.appendChild(holder);
    this.appRef.attachView(ref.hostView);

    try {
      ref.changeDetectorRef.detectChanges();
      const sheet = holder.querySelector<HTMLElement>('.dp-sheet')!;
      await document.fonts?.ready;
      await Promise.all(Array.from(sheet.querySelectorAll('img')).map(i => i.decode().catch(() => undefined)));

      const canvas = await html2canvas(sheet, { scale: RENDER_SCALE, backgroundColor: '#ffffff', logging: false });
      const box = sheet.getBoundingClientRect();
      const toCanvas = canvas.height / box.height;
      const stops = Array.from(sheet.querySelectorAll(PAGE_STOPS))
        .map(el => Math.round((el.getBoundingClientRect().bottom - box.top) * toCanvas));
      const pxPerMm = canvas.width / CONTENT_WIDTH_MM;
      const ends = pageEnds(canvas.height, Math.floor(CONTENT_HEIGHT_MM * pxPerMm), stops);

      const pdf = new Pdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      let start = 0;
      ends.forEach((end, page) => {
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = end - start;
        const ctx = slice.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, start, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        if (page > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(slice.toDataURL('image/jpeg', 0.88), 'JPEG', MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, slice.height / pxPerMm, undefined, 'FAST');
        start = end;
      });
      return pdf;
    } finally {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
      holder.remove();
    }
  }
}
