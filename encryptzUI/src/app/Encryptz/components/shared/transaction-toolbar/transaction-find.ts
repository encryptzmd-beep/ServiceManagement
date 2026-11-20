import { ChangeDetectionStrategy, Component, HostListener, OnInit, input, output, signal } from '@angular/core';

/** One document in the Find list. */
export interface FindRow {
  id: number;
  number: string;
  date: string;
  party: string;
  amount: number;
  status: string;
}

export interface FindQuery { term: string; from: string; to: string; }

/**
 * Find an earlier document (Sales Order, Quotation): text (number or customer) and a date range;
 * a row loads that document. The screen runs the search and fills `rows`.
 */
@Component({
  selector: 'app-transaction-find',
  standalone: true,
  templateUrl: './transaction-find.html',
  styleUrl: './transaction-find.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionFindComponent implements OnInit {
  title = input('Find');
  placeholder = input('Number or customer');
  rows = input<FindRow[]>([]);
  loading = input(false);

  search = output<FindQuery>();
  pick = output<number>();
  close = output<void>();

  term = signal('');
  from = signal('');
  to = signal('');

  ngOnInit(): void { this.run(); }

  run(event?: Event): void {
    event?.preventDefault();
    this.search.emit({ term: this.term().trim(), from: this.from(), to: this.to() });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.close.emit(); }

  amount(v: number): string {
    return '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  date(v: string): string {
    const d = v ? new Date(v) : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  }
}
