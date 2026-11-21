import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { SALES_DOCUMENT_TYPES, SalesDocument } from '../../../Models/ApiModels';
import { ApiService } from '../../../Services/API/api-service';
import { DialogService } from '../../../Services/dialog-service';
import { RightsService } from '../../../Services/rights-service';

const MAX_BYTES = 10 * 1024 * 1024;

/** The PDFs of a bill: the same list on the Sales Order and the Despatch screen. */
@Component({
  selector: 'app-sales-documents',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './sales-documents.html',
  styleUrl: './sales-documents.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesDocumentsComponent {
  private api = inject(ApiService);
  private dialog = inject(DialogService);
  private destroyRef = inject(DestroyRef);
  private rights = inject(RightsService);

  salesOrderId = input.required<number>();
  /** Set on the Despatch screen: what is added here is marked as added from this despatch. */
  despatchId = input<number | null>(null);
  canAdd = input(true);
  canRemove = input(true);

  /** A document belongs to both screens: a right on either of them is enough (as the API checks). */
  readonly addAllowed = computed(() => this.canAdd() && (this.rights.can('edit', '/sales/orders') || this.rights.can('edit', '/sales/despatch')));
  readonly removeAllowed = computed(() => this.canRemove() && (this.rights.can('delete', '/sales/orders') || this.rights.can('delete', '/sales/despatch')));

  readonly types = SALES_DOCUMENT_TYPES;
  documentType = SALES_DOCUMENT_TYPES[0];
  documents = signal<SalesDocument[]>([]);
  loading = signal(true);
  uploading = signal(false);
  error = signal('');

  constructor() {
    effect(() => {
      const id = this.salesOrderId();
      untracked(() => { if (id > 0) this.load(); });
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.getSalesDocuments(this.salesOrderId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        this.loading.set(false);
        this.documents.set(r?.success ? r.data ?? [] : []);
        this.error.set(r?.success ? '' : r?.message || 'The documents could not be read');
      },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message || 'The documents could not be read'); },
    });
  }

  onFile(event: Event): void {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];
    field.value = '';     // the same file can be chosen again
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { this.error.set('Only PDF files can be attached'); return; }
    if (file.size > MAX_BYTES) { this.error.set('The file is larger than 10 MB'); return; }
    if (this.documents().some(d => d.fileName.toLowerCase() === file.name.toLowerCase() && d.fileSize === file.size)) {
      this.error.set(`${file.name} is already attached to this bill`);
      return;
    }

    this.uploading.set(true);
    this.error.set('');
    this.api.addSalesDocument(this.salesOrderId(), file, this.documentType, this.despatchId())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: r => {
          this.uploading.set(false);
          if (r?.success) this.load();
          else this.error.set(r?.message || 'The file could not be added');
        },
        error: e => { this.uploading.set(false); this.error.set(e?.error?.message || 'The file could not be added'); },
      });
  }

  open(doc: SalesDocument): void {
    // opened before the answer comes, or the browser blocks it as a popup
    const tab = window.open('', '_blank');
    this.api.downloadSalesDocument(doc.documentId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        if (tab) tab.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => { tab?.close(); this.error.set('The file could not be opened'); },
    });
  }

  async remove(doc: SalesDocument): Promise<void> {
    if (!(await this.dialog.confirm(`Remove ${doc.fileName} from this bill?`))) return;
    this.api.deleteSalesDocument(doc.documentId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        if (r?.success) this.load();
        else this.error.set(r?.message || 'The document could not be removed');
      },
      error: e => this.error.set(e?.error?.message || 'The document could not be removed'),
    });
  }

  size(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
}
