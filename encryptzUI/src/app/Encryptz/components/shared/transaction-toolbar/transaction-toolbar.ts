import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type TransactionMode = 'new' | 'view' | 'edit';

/**
 * The toolbar of a document screen (Sales Order, Quotation):
 * New · Edit (Discard while editing) · Save · Print · Cancel (void) · Previous · Next · Find.
 * The screen decides what is allowed; the toolbar only shows it and reports what was pressed.
 */
@Component({
  selector: 'app-transaction-toolbar',
  standalone: true,
  templateUrl: './transaction-toolbar.html',
  styleUrl: './transaction-toolbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionToolbarComponent {
  mode = input<TransactionMode>('new');
  /** The document number, e.g. SO-0012. */
  label = input('');
  status = input('');
  canEdit = input(false);
  canSave = input(true);
  canCancel = input(false);
  /** The word of the edit button, e.g. "Revise" for a sent quotation. */
  editLabel = input('Edit');
  previousId = input<number | null>(null);
  nextId = input<number | null>(null);
  busy = input(false);

  newDoc = output<void>();
  edit = output<void>();
  discard = output<void>();
  save = output<void>();
  print = output<void>();
  cancelDoc = output<void>();
  previous = output<void>();
  next = output<void>();
  find = output<void>();

  readonly saveOn = computed(() => !this.busy() && this.mode() !== 'view' && this.canSave());
  readonly editOn = computed(() => !this.busy() && this.canEdit());
  readonly printOn = computed(() => !this.busy() && this.mode() !== 'new');
  readonly cancelOn = computed(() => !this.busy() && this.mode() === 'view' && this.canCancel());
  readonly previousOn = computed(() => !this.busy() && this.previousId() != null);
  readonly nextOn = computed(() => !this.busy() && this.nextId() != null);
}
