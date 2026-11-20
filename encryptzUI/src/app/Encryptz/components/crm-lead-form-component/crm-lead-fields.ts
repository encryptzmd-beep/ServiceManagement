import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CrmMasterDto, CrmMemberDto, LeadSaveDto } from '../../Models/CrmModels';
import { CrmProductPickerComponent } from '../crm-shell-component/crm-product-picker-component';
import { showDate } from '../crm-shell-component/crm-ui';

/** One change of a lead field: the key and the new value. */
export interface LeadFieldChange { key: keyof LeadSaveDto; value: any; }

/**
 * The two cards of a lead, Contact and Requirement, for the new lead page and the lead page:
 * inputs while the lead is being made or edited, the values as text when it is only shown.
 */
@Component({
  selector: 'app-crm-lead-fields',
  standalone: true,
  imports: [FormsModule, CrmProductPickerComponent],
  templateUrl: './crm-lead-fields.html',
  styleUrl: './crm-lead-fields.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmLeadFieldsComponent {
  form = input.required<LeadSaveDto>();
  /** Text instead of inputs. */
  readonly = input(false);
  sources = input<CrmMasterDto[]>([]);
  owners = input<CrmMemberDto[]>([]);
  isManager = input(false);
  /** The product of the lead as it was saved (the picker shows it until another is chosen). */
  productName = input('');
  /** Shown read-only: the lead number and owner of a saved lead. */
  leadNo = input('');
  ownerName = input('');
  sourceName = input('');

  changed = output<LeadFieldChange>();
  productPicked = output<void>();

  readonly priorities = ['Low', 'Medium', 'High'];
  readonly showDate = showDate;

  set<K extends keyof LeadSaveDto>(key: K, value: LeadSaveDto[K]): void {
    this.changed.emit({ key, value });
  }

  /** The owner select: the owner when listed, else "Me" (the signed-in manager owns it, and is not in the list). */
  ownerValue(): number | '' {
    const id = this.form().ownerUserId;
    return id && this.owners().some(m => m.userId === Number(id)) ? Number(id) : '';
  }

  /** Address, landmark, city, state and pin code on one line. */
  addressLine(): string {
    const f = this.form();
    return [f.address, f.landmark, f.city, f.state, f.pinCode].filter(x => !!(x ?? '').toString().trim()).join(', ');
  }
}
