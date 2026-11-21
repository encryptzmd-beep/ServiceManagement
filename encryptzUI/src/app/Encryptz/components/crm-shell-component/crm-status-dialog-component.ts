import { AppRightDirective } from '../shared/app-right/app-right';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CrmMasterDto } from '../../Models/CrmModels';

/**
 * Confirms a status change made by dragging a lead on the board: an optional note, and for a lost lead the reason
 * (required). It only asks; the page calls the server and the server decides.
 */
@Component({
  selector: 'app-crm-status-dialog',
  imports: [AppRightDirective],
  standalone: true,
  templateUrl: './crm-status-dialog-component.html',
  styleUrls: ['./crm-pages.scss', './crm-status-dialog-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmStatusDialogComponent {
  mode = input<'status' | 'lost'>('status');
  leadNo = input('');
  toStatus = input('');
  lostReasons = input<CrmMasterDto[]>([]);
  busy = input(false);

  confirmed = output<{ note: string; lostReasonId: number | null }>();
  cancelled = output<void>();

  note = signal('');
  lostReasonId = signal<number | null>(null);

  readonly activeReasons = computed(() => this.lostReasons().filter(r => r.isActive));
  readonly canConfirm = computed(() => !this.busy() && (this.mode() !== 'lost' || !!this.lostReasonId()));

  setReason(value: string): void {
    this.lostReasonId.set(value ? Number(value) : null);
  }

  confirm(): void {
    if (!this.canConfirm()) return;
    this.confirmed.emit({ note: this.note().trim(), lostReasonId: this.mode() === 'lost' ? this.lostReasonId() : null });
  }

  cancel(): void {
    if (!this.busy()) this.cancelled.emit();
  }
}
