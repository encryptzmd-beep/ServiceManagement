import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CrmDashboardDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { FORBIDDEN, pill, refusalOf, showDateTime, thisMonth } from '../crm-shell-component/crm-ui';

interface Tile { key: string; label: string; hint: string; value: number; query: Record<string, string>; tone?: string; }

/** /crm/dashboard: the counts of the leads, each opening the list filtered the same way, and the follow-ups due. */
@Component({
  selector: 'app-crm-dashboard',
  standalone: true,
  imports: [RouterLink, CrmRefusedComponent],
  templateUrl: './crm-dashboard-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmDashboardComponent {
  private crm = inject(CrmService);

  readonly forbidden = FORBIDDEN;
  readonly pill = pill;
  readonly showDateTime = showDateTime;

  board = signal<CrmDashboardDto | null>(null);
  error = signal('');

  readonly tiles = computed<Tile[]>(() => {
    const b = this.board();
    if (!b) return [];
    const month = thisMonth();
    const tiles: Tile[] = [
      { key: 'new', label: 'New', hint: 'Not contacted yet', value: b.newLeads, query: { status: 'New' } },
      { key: 'pending', label: 'Follow-up pending', hint: 'Open leads with a next follow-up', value: b.followUpPending, query: { due: 'Pending' } },
      { key: 'today', label: "Today's follow-ups", hint: 'Due today', value: b.todayFollowUps, query: { due: 'Today' }, tone: 'warn' },
      { key: 'overdue', label: 'Overdue', hint: 'Follow-up date passed', value: b.overdue, query: { due: 'Overdue' }, tone: 'bad' },
      { key: 'qualified', label: 'Qualified', hint: 'Ready for a quotation', value: b.qualified, query: { status: 'Qualified' } },
      { key: 'quotation', label: 'Quotation pending', hint: 'Quotation and negotiation', value: b.quotationPending, query: { status: 'Quotation,Negotiation' } },
      { key: 'converted', label: 'Converted', hint: 'This month', value: b.convertedThisMonth, tone: 'good',
        query: { status: 'Converted', closedFrom: month.from, closedTo: month.to } },
      { key: 'lost', label: 'Lost', hint: 'This month', value: b.lostThisMonth,
        query: { status: 'Lost', closedFrom: month.from, closedTo: month.to } },
    ];
    return tiles;
  });

  constructor() {
    this.crm.getDashboard().subscribe({
      next: res => {
        if (res.success && res.data) this.board.set(res.data);
        else this.error.set(res.message || 'The dashboard could not be read');
      },
      error: err => this.error.set(refusalOf(err)),
    });
  }
}
