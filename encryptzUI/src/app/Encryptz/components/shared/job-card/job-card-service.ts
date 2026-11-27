import { Injectable, Injector, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../Auth/auth-service';
import { printCompanyOf } from '../document-print/document-print';
import { JobCard, buildJobCardPdf, jobCardFileName, jobCardMessage } from './job-card';

/** How a share ended: through the device's share sheet, or downloaded with a WhatsApp chat opened beside it. */
export type JobCardShareResult = 'shared' | 'downloaded' | 'cancelled';

/** "919876543210" for WhatsApp from an Indian mobile as typed; '' when it is not one. */
export function whatsAppNumber(mobile: string | null | undefined): string {
  const digits = (mobile ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return '';
}

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
    const card = await this.load(assignmentId);
    const file = await this.file(card);
    const text = jobCardMessage(card);
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: `Job Card ${card.complaintNumber}`, text });
        return 'shared';
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
        // a share the browser refused falls back to the download below
      }
    }
    saveFile(file);
    const to = whatsAppNumber(card.technicianMobile);
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
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
