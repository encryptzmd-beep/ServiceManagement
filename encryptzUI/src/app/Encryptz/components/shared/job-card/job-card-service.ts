import { Injectable, Injector, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../Auth/auth-service';
import { printCompanyOf } from '../document-print/document-print';
import { JobCard, buildJobCardPdf, jobCardFileName, jobCardMessage } from './job-card';
import { openPendingTab, whatsAppUrl } from '../whatsapp';

/** How a share ended: through the device's share sheet, or downloaded with a WhatsApp chat opened beside it. */
export type JobCardShareResult = 'shared' | 'downloaded' | 'cancelled';

export { whatsAppNumber } from '../whatsapp';

/**
 * The job card of an assignment as a PDF, made in the browser: downloaded (to keep it on the phone for places
 * without network) or shared with the technician through the device's share sheet (WhatsApp, e-mail, ...).
 */
@Injectable({ providedIn: 'root' })
export class JobCardService {
  private http = inject(HttpClient);
  private injector = inject(Injector);

  async load(assignmentId: number): Promise<JobCard> {
    const res = await firstValueFrom(this.http.get<{ success: boolean; data?: JobCard; message?: string }>(
      `${environment.apiUrl}/api/technician/job-card/${assignmentId}`));
    if (!res?.success || !res.data) throw new Error(res?.message || 'The job card could not be read');
    return res.data;
  }

  async file(card: JobCard): Promise<File> {
    const pdf = await buildJobCardPdf(card, printCompanyOf(this.injector.get(AuthService, null)));
    return new File([pdf.output('blob')], jobCardFileName(card), { type: 'application/pdf' });
  }

  async download(assignmentId: number): Promise<void> {
    const card = await this.load(assignmentId);
    saveFile(await this.file(card));
  }

  /**
   * Shares the PDF where the browser can share files (phones, Chrome / Edge on Windows). Elsewhere the PDF is
   * downloaded and a WhatsApp chat with the technician opens with the job summary, to attach the file to.
   */
  async share(assignmentId: number): Promise<JobCardShareResult> {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    const canShareFiles = !!nav.share && !!nav.canShare?.({ files: [new File([''], 'job-card.pdf', { type: 'application/pdf' })] });
    // without a share sheet the WhatsApp tab is opened now, during the click, or it is blocked as a popup
    const tab = canShareFiles ? null : openPendingTab();
    let card: JobCard, file: File;
    try {
      card = await this.load(assignmentId);
      file = await this.file(card);
    } catch (e) {
      tab?.close();
      throw e;
    }
    const text = jobCardMessage(card);
    if (canShareFiles) {
      try {
        await nav.share({ files: [file], title: `Job Card ${card.complaintNumber}`, text });
        return 'shared';
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
        // a share the browser refused falls back to the download below
      }
    }
    saveFile(file);
    const url = whatsAppUrl(card.technicianMobile, text);
    if (tab) tab.go(url); else window.open(url, '_blank', 'noopener');
    return 'downloaded';
  }
}

function saveFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
