import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { JobCardService } from './job-card-service';

/** "Share job card" and "Download" for one assignment, on the assign screen and the technician's work orders. */
@Component({
  selector: 'app-job-card-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jc-actions" (click)="$event.stopPropagation()">
      <button type="button" class="jc-btn primary" [disabled]="busy()" (click)="share()"
        [attr.aria-label]="'Share the job card' + (label() ? ' of ' + label() : '')">
        <span class="material-icons" aria-hidden="true">share</span>{{ busy() === 'share' ? 'Preparing…' : 'Share Job Card' }}
      </button>
      <button type="button" class="jc-btn" [disabled]="busy()" (click)="download()"
        [attr.aria-label]="'Download the job card PDF' + (label() ? ' of ' + label() : '')" title="Download the PDF to keep it on this device">
        <span class="material-icons" aria-hidden="true">download</span>{{ busy() === 'download' ? 'Preparing…' : 'PDF' }}
      </button>
    </div>
    @if (note()) { <p class="jc-note" [class.err]="isError()" role="status">{{ note() }}</p> }
  `,
  styles: [`
    :host { display: block; }
    .jc-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .jc-btn {
      display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 0 12px;
      border: 1px solid #c9d3df; border-radius: 8px; background: #fff; color: #1B4A7A;
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .jc-btn .material-icons { font-size: 17px; }
    .jc-btn.primary { background: #1B4A7A; border-color: #1B4A7A; color: #fff; }
    .jc-btn:disabled { opacity: .6; cursor: default; }
    .jc-btn:focus-visible { outline: 2px solid #1B4A7A; outline-offset: 2px; }
    .jc-note { margin: 6px 0 0; font-size: 12px; color: #5a6a7e; }
    .jc-note.err { color: #D42B2B; }
  `],
})
export class JobCardActionsComponent {
  private jobCards = inject(JobCardService);

  assignmentId = input.required<number>();
  /** The job number, for the screen reader labels. */
  label = input('');

  busy = signal<'' | 'share' | 'download'>('');
  note = signal('');
  isError = signal(false);

  async share(): Promise<void> {
    await this.run('share', async () => {
      const how = await this.jobCards.share(this.assignmentId());
      if (how === 'downloaded') this.say('The PDF is downloaded. Attach it in the WhatsApp chat that opened.');
      if (how === 'shared') this.say('Job card shared.');
    });
  }

  async download(): Promise<void> {
    await this.run('download', async () => {
      await this.jobCards.download(this.assignmentId());
      this.say('Job card downloaded. It opens without network.');
    });
  }

  private async run(kind: 'share' | 'download', work: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(kind);
    this.note.set('');
    try {
      await work();
    } catch (e: any) {
      this.isError.set(true);
      this.note.set(e?.error?.message || e?.message || 'The job card could not be made');
    } finally {
      this.busy.set('');
    }
  }

  private say(text: string): void { this.isError.set(false); this.note.set(text); }
}
