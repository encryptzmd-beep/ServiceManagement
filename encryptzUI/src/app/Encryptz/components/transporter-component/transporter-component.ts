import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TransporterDto, TransporterSave } from '../../Models/SalesModels';
import { ApiService } from '../../Services/API/api-service';
import { RightsService } from '../../Services/rights-service';
import { ToastService } from '../../Services/toast-service';
import { AutocompleteComponent, AutocompleteOption } from '../autocomplete-component/autocomplete-component';

const MENU = '/sales/despatch';
const blank = (name = ''): TransporterSave => ({ transporterId: 0, transporterName: name, contactPerson: '', mobile: '', gstin: '', address: '', isActive: true });

const FORM_STYLES = `
  .tr-overlay { position: fixed; inset: 0; z-index: 2500; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15, 45, 74, 0.45); }
  .tr-box { width: min(520px, 100%); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; background: #fff; }
  .tr-box.wide { width: min(760px, 100%); }
  .tr-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid #e2e8f0;
    h2 { margin: 0; font-size: 16px; font-weight: 600; color: #1a2332; } }
  .tr-close { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 6px; background: none; color: #64748b; cursor: pointer; &:hover { background: #f1f5f9; } }
  .tr-body { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; padding: 16px 18px; overflow-y: auto;
    label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 500; color: #5a6a7e; }
    input { width: 100%; height: 38px; box-sizing: border-box; padding: 0 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; color: #1a2332; font: inherit; font-size: 13.5px; }
    .full { grid-column: 1 / -1; }
    .tr-active { flex-direction: row; align-items: center; gap: 8px; font-size: 13.5px; color: #1a2332; input { width: 16px; height: 16px; accent-color: #1B4A7A; } } }
  .tr-error { grid-column: 1 / -1; margin: 0; padding: 9px 12px; border-radius: 8px; background: #f9e8e8; color: #b42318; font-size: 13px; }
  .tr-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px; border-top: 1px solid #e2e8f0; }
  .tr-btn { min-height: 36px; padding: 0 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; color: #334155; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer;
    &:hover:not(:disabled) { background: #f5f7fa; } &:disabled { opacity: .6; cursor: not-allowed; }
    &.primary { border-color: #1B4A7A; background: #1B4A7A; color: #fff; &:hover:not(:disabled) { background: #163a60; } } }
  @media (max-width: 520px) { .tr-body { grid-template-columns: minmax(0, 1fr); } }
`;

/** Add or change one transporter. */
@Component({
  selector: 'app-transporter-form',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tr-overlay" (click)="$event.stopPropagation()">
      <div class="tr-box" role="dialog" aria-modal="true" aria-labelledby="tr-form-title" (keydown.escape)="$event.stopPropagation(); closed.emit(null)">
        <div class="tr-head">
          <h2 id="tr-form-title">{{ form.transporterId ? 'Edit Transporter' : 'New Transporter' }}</h2>
          <button type="button" class="tr-close" aria-label="Close" (click)="closed.emit(null)"><span class="material-icons" aria-hidden="true">close</span></button>
        </div>
        <div class="tr-body">
          <label class="full">Transporter Name *<input maxlength="150" [(ngModel)]="form.transporterName" name="trName" autocomplete="off" /></label>
          <label>Contact Person<input maxlength="150" [(ngModel)]="form.contactPerson" name="trContact" autocomplete="off" /></label>
          <label>Mobile<input type="tel" maxlength="20" [(ngModel)]="form.mobile" name="trMobile" autocomplete="off" /></label>
          <label class="full">GSTIN<input maxlength="15" [(ngModel)]="form.gstin" name="trGstin" autocomplete="off" style="text-transform:uppercase" /></label>
          <label class="full">Address<input maxlength="400" [(ngModel)]="form.address" name="trAddress" autocomplete="off" /></label>
          @if (form.transporterId) { <label class="tr-active full"><input type="checkbox" [(ngModel)]="form.isActive" name="trActive" />Active</label> }
          @if (error()) { <p class="tr-error" role="alert">{{ error() }}</p> }
        </div>
        <div class="tr-foot">
          <button type="button" class="tr-btn" [disabled]="saving()" (click)="closed.emit(null)">Cancel</button>
          <button type="button" class="tr-btn primary" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [FORM_STYLES],
})
export class TransporterFormComponent implements OnInit {
  private api = inject(ApiService);
  private toasts = inject(ToastService);

  transporter = input<TransporterDto | null>(null);
  initialName = input('');
  closed = output<TransporterDto | null>();

  form: TransporterSave = blank();
  error = signal('');
  saving = signal(false);

  ngOnInit(): void {
    const t = this.transporter();
    this.form = t ? { ...t } : blank(this.initialName());
  }

  save(): void {
    const f = this.form;
    if (!f.transporterName?.trim()) { this.error.set('Enter the transporter name'); return; }
    const mobile = (f.mobile ?? '').replace(/\D/g, '');
    if (mobile && mobile.length < 10) { this.error.set('Enter a valid 10-digit mobile number'); return; }
    const gstin = (f.gstin ?? '').trim().toUpperCase();
    if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) { this.error.set('GSTIN must be 15 characters'); return; }
    this.error.set('');
    this.saving.set(true);
    const dto = { ...f, transporterName: f.transporterName.trim(), gstin };
    this.api.saveTransporter(dto).subscribe({
      next: r => {
        this.saving.set(false);
        if (!r?.success || !r.data) { this.error.set(r?.message || 'The transporter could not be saved'); return; }
        this.toasts.flash(r.message || 'Transporter saved');
        this.closed.emit({ ...dto, transporterId: r.data });
      },
      error: e => { this.saving.set(false); this.error.set(e?.error?.message || 'The transporter could not be saved'); },
    });
  }
}

/** Chooses a registered transporter; a name from an older despatch stays until it is changed. */
@Component({
  selector: 'app-transporter-picker',
  standalone: true,
  imports: [FormsModule, AutocompleteComponent, TransporterFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-autocomplete [ngModel]="value() || null" (ngModelChange)="valueChange.emit($event ?? '')" [options]="options()"
      placeholder="Search transporter" emptyText="No transporter matches" [ariaLabel]="label()"
      [createLabel]="canAdd() ? 'Add new transporter' : ''" (create)="newName.set($event); adding.set(true)" />
    @if (adding()) { <app-transporter-form [initialName]="newName()" (closed)="added($event)" /> }
  `,
})
export class TransporterPickerComponent {
  private api = inject(ApiService);
  private rights = inject(RightsService);

  value = input('');
  label = input('Transporter');
  valueChange = output<string>();

  list = signal<TransporterDto[]>([]);
  adding = signal(false);
  newName = signal('');

  readonly canAdd = computed(() => this.rights.can('create', MENU));
  readonly options = computed<AutocompleteOption<string>[]>(() => {
    const rows = this.list().map(t => ({ value: t.transporterName, label: t.transporterName, sub: [t.contactPerson, t.mobile].filter(Boolean).join(' · ') }));
    const own = (this.value() ?? '').trim();
    return own && !rows.some(r => r.value === own) ? [{ value: own, label: own, sub: '' }, ...rows] : rows;
  });

  constructor() {
    this.api.getTransporters(false).subscribe({
      next: r => this.list.set(r?.success ? r.data ?? [] : []),
      error: () => this.list.set([]),
    });
  }

  added(t: TransporterDto | null): void {
    this.adding.set(false);
    if (!t) return;
    this.list.update(l => [...l.filter(x => x.transporterId !== t.transporterId), t].sort((a, b) => a.transporterName.localeCompare(b.transporterName)));
    this.valueChange.emit(t.transporterName);
  }
}

/** The Transporter Master: the list, add, edit and switch off. */
@Component({
  selector: 'app-transporter-master',
  standalone: true,
  imports: [TransporterFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tr-overlay">
      <div class="tr-box wide" role="dialog" aria-modal="true" aria-labelledby="tr-master-title" (keydown.escape)="closed.emit()">
        <div class="tr-head">
          <h2 id="tr-master-title">Transporter Master</h2>
          <button type="button" class="tr-close" aria-label="Close" (click)="closed.emit()"><span class="material-icons" aria-hidden="true">close</span></button>
        </div>
        <div class="tr-list">
          @if (error()) { <p class="tr-error" role="alert">{{ error() }}</p> }
          @for (t of list(); track t.transporterId) {
            <div class="tr-row" [class.off]="!t.isActive">
              <div class="tr-row-main">
                <strong>{{ t.transporterName }}</strong>
                <small>{{ details(t) }}</small>
              </div>
              @if (!t.isActive) { <span class="tr-off">Inactive</span> }
              <button type="button" class="tr-btn" [disabled]="!canEdit()" (click)="editing.set(t); formOpen.set(true)">Edit</button>
            </div>
          } @empty {
            @if (!loading()) { <p class="tr-none">No transporters yet.</p> }
          }
        </div>
        <div class="tr-foot">
          <button type="button" class="tr-btn" (click)="closed.emit()">Close</button>
          <button type="button" class="tr-btn primary" [disabled]="!canAdd()" (click)="editing.set(null); formOpen.set(true)">New Transporter</button>
        </div>
      </div>
    </div>
    @if (formOpen()) { <app-transporter-form [transporter]="editing()" (closed)="formClosed($event)" /> }
  `,
  styles: [FORM_STYLES, `
    .tr-list { flex: 1; min-height: 120px; overflow-y: auto; padding: 4px 18px; }
    .tr-list .tr-error { margin: 10px 0; }
    .tr-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #edf1f6; &:last-child { border-bottom: none; } &.off strong { color: #8a9ab0; } }
    .tr-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;
      strong { font-size: 13.5px; font-weight: 600; color: #1a2332; overflow-wrap: anywhere; }
      small { min-height: 15px; font-size: 12px; color: #64748b; overflow-wrap: anywhere; } }
    .tr-off { flex: 0 0 auto; padding: 2px 8px; border-radius: 12px; background: #f1f5f9; color: #64748b; font-size: 11px; font-weight: 600; }
    .tr-none { margin: 22px 0; color: #64748b; font-size: 13px; text-align: center; }
  `],
})
export class TransporterMasterComponent {
  private api = inject(ApiService);
  private rights = inject(RightsService);

  closed = output<void>();
  list = signal<TransporterDto[]>([]);
  loading = signal(true);
  error = signal('');
  formOpen = signal(false);
  editing = signal<TransporterDto | null>(null);

  readonly canAdd = computed(() => this.rights.can('create', MENU));
  readonly canEdit = computed(() => this.rights.can('edit', MENU));

  constructor() {
    this.load();
  }

  private load(): void {
    this.api.getTransporters(true).subscribe({
      next: r => {
        this.loading.set(false);
        if (r?.success) this.list.set(r.data ?? []);
        else this.error.set(r?.message || 'The transporters could not be read');
      },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message || 'The transporters could not be read'); },
    });
  }

  details(t: TransporterDto): string {
    return [t.contactPerson, t.mobile, t.gstin, t.address].filter(Boolean).join(' · ');
  }

  formClosed(saved: TransporterDto | null): void {
    this.formOpen.set(false);
    if (saved) this.load();
  }
}
