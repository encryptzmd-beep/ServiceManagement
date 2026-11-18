import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { QuotationDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, amount, refusalOf, showDate } from '../crm-shell-component/crm-ui';

/**
 * /crm/quotations/:id/print: the quotation on one A4 page, printed (or saved as PDF) by the browser.
 * The company's name, address and phone are those of the selected company as the login gave them.
 */
@Component({
  selector: 'app-crm-quotation-print',
  standalone: true,
  imports: [RouterLink, CrmRefusedComponent],
  templateUrl: './crm-quotation-print-component.html',
  styleUrl: './crm-quotation-print-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmQuotationPrintComponent {
  private crm = inject(CrmService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  readonly forbidden = FORBIDDEN;
  readonly amount = amount;
  readonly showDate = showDate;
  readonly id = Number(this.route.snapshot.paramMap.get('id') ?? 0);

  q = signal<QuotationDto | null>(null);
  error = signal('');

  readonly company = computed(() => {
    const id = this.auth.selectedCompanyId();
    return this.auth.companies().find(c => c.companyId === id) ?? null;
  });

  constructor() {
    this.crm.getQuotation(this.id).subscribe({
      next: res => (res.success && res.data ? this.q.set(res.data) : this.error.set(res.message || 'Quotation not found')),
      error: err => this.error.set(refusalOf(err)),
    });
  }

  join(...parts: (string | null | undefined)[]): string {
    return parts.filter(p => !!p && p.trim()).join(', ');
  }

  print(): void {
    window.print();
  }
}
