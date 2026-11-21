import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { LeadDataAccessDto, LeadDataRequestRowDto, LeadImportResultDto, LeadImportRowDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { ToastService } from '../../Services/toast-service';
import { isoDate, refusalOf, showDateTime } from '../crm-shell-component/crm-ui';
import { downloadLeadTemplate, readLeadsExcel, writeLeadsExcel } from './crm-lead-excel';

type DataKind = 'Import' | 'Export';

/** Import and Export of the lead list: a company admin directly, anyone else after asking the admin. */
@Component({
  selector: 'app-crm-lead-data',
  standalone: true,
  templateUrl: './crm-lead-data-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-lead-data-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmLeadDataComponent {
  private crm = inject(CrmService);
  private toasts = inject(ToastService);

  readonly showDateTime = showDateTime;
  imported = output<void>();

  access = signal<LeadDataAccessDto | null>(null);
  busy = signal(false);

  /** Asking the admin. */
  asking = signal<DataKind | null>(null);
  askNote = signal('');
  askError = signal('');

  /** The import window. */
  importOpen = signal(false);
  fileName = signal('');
  fileRows = signal<LeadImportRowDto[]>([]);
  fileProblem = signal('');
  result = signal<LeadImportResultDto | null>(null);

  /** The admin's list of requests. */
  requestsOpen = signal(false);
  requests = signal<LeadDataRequestRowDto[]>([]);
  requestsError = signal('');

  readonly pendingCount = computed(() => this.access()?.pendingCount ?? 0);

  constructor() {
    this.refresh();
  }

  private refresh(): void {
    this.crm.leadDataAccess().subscribe({
      next: res => this.access.set(res.success ? res.data ?? null : null),
      error: () => this.access.set(null),
    });
  }

  label(kind: DataKind): string {
    const a = this.access();
    if (!a || a.isAdmin) return kind;
    const pending = kind === 'Import' ? a.importPending : a.exportPending;
    const allowed = kind === 'Import' ? a.canImport : a.canExport;
    return pending && !allowed ? `${kind}: awaiting approval` : kind;
  }

  waiting(kind: DataKind): boolean {
    const a = this.access();
    if (!a || a.isAdmin) return false;
    return kind === 'Import' ? a.importPending && !a.canImport : a.exportPending && !a.canExport;
  }

  // ── asking ──
  private ask(kind: DataKind): void {
    this.askNote.set('');
    this.askError.set('');
    this.asking.set(kind);
  }

  sendRequest(): void {
    const kind = this.asking();
    if (!kind || this.busy()) return;
    this.busy.set(true);
    this.askError.set('');
    this.crm.requestLeadData({ requestType: kind, note: this.askNote().trim() }).subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success) { this.askError.set(res.message || 'The request could not be sent'); return; }
        this.asking.set(null);
        this.toasts.flash(res.message || 'Request sent to the admin');
        this.refresh();
      },
      error: err => { this.busy.set(false); this.askError.set(this.reason(err)); },
    });
  }

  // ── export ──
  exportLeads(): void {
    const a = this.access();
    if (!a || this.busy() || this.waiting('Export')) return;
    if (!a.canExport) { this.ask('Export'); return; }
    this.busy.set(true);
    this.crm.exportLeads().subscribe({
      next: async res => {
        try {
          if (!res.success) { this.toasts.flash(res.message || 'The leads could not be exported', 'error', 5000); return; }
          await writeLeadsExcel(res.data ?? [], isoDate(new Date()));
          this.toasts.flash(`${(res.data ?? []).length} leads exported`);
        } catch {
          this.toasts.flash('The Excel file could not be made', 'error', 5000);
        } finally {
          this.busy.set(false);
          this.refresh();
        }
      },
      error: err => { this.busy.set(false); this.toasts.flash(this.reason(err), 'error', 5000); this.refresh(); },
    });
  }

  // ── import ──
  openImport(): void {
    const a = this.access();
    if (!a || this.waiting('Import')) return;
    if (!a.canImport) { this.ask('Import'); return; }
    this.fileName.set('');
    this.fileRows.set([]);
    this.fileProblem.set('');
    this.result.set(null);
    this.importOpen.set(true);
  }

  template(): void {
    downloadLeadTemplate().catch(() => this.fileProblem.set('The template could not be made'));
  }

  async chooseFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.result.set(null);
    this.fileName.set(file.name);
    this.fileRows.set([]);
    if (!file.name.toLowerCase().endsWith('.xlsx')) { this.fileProblem.set('Use an .xlsx file'); return; }
    if (file.size > 5 * 1024 * 1024) { this.fileProblem.set('The file is larger than 5 MB'); return; }
    this.fileProblem.set('');
    const read = await readLeadsExcel(file);
    this.fileRows.set(read.rows);
    this.fileProblem.set(read.problem);
  }

  runImport(): void {
    const rows = this.fileRows();
    if (!rows.length || this.busy()) return;
    this.busy.set(true);
    this.fileProblem.set('');
    this.crm.importLeads(rows).subscribe({
      next: res => {
        this.busy.set(false);
        this.refresh();
        if (!res.success || !res.data) { this.fileProblem.set(res.message || 'The leads could not be imported'); return; }
        this.result.set(res.data);
        this.fileRows.set([]);
        if (res.data.created > 0) this.imported.emit();
      },
      error: err => { this.busy.set(false); this.refresh(); this.fileProblem.set(this.reason(err)); },
    });
  }

  // ── the admin's requests ──
  openRequests(): void {
    this.requestsOpen.set(true);
    this.loadRequests();
  }

  private loadRequests(): void {
    this.requestsError.set('');
    this.crm.leadDataRequests().subscribe({
      next: res => {
        if (res.success) this.requests.set(res.data ?? []);
        else this.requestsError.set(res.message || 'The requests could not be read');
      },
      error: err => this.requestsError.set(this.reason(err)),
    });
  }

  decide(r: LeadDataRequestRowDto, approve: boolean): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.crm.decideLeadData(r.requestId, { approve, note: '' }).subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success) this.requestsError.set(res.message || 'The request could not be changed');
        else this.toasts.flash(res.message || 'Done');
        this.loadRequests();
        this.refresh();
      },
      error: err => { this.busy.set(false); this.requestsError.set(this.reason(err)); },
    });
  }

  private reason(err: unknown): string {
    const message = (err as { error?: { message?: string } })?.error?.message;
    return message || refusalOf(err);
  }
}
