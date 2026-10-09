import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';
import { DespatchFilter, DespatchListItem, SalesOrderListItem } from '../../Models/ApiModels';

@Component({
  selector: 'app-despatch-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './despatch-list-component.html',
  styleUrls: ['./despatch-list-component.scss'],
})
export class DespatchListComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  tab = signal<'despatched' | 'pending'>('pending');

  // despatched
  despatches = signal<DespatchListItem[]>([]);
  totalCount = signal(0);
  totalPages = signal(1);
  filter: DespatchFilter = { pageNumber: 1, pageSize: 20, searchTerm: '' };

  // bills waiting for despatch
  pending = signal<SalesOrderListItem[]>([]);
  pendingTotal = signal(0);
  pendingPages = signal(1);
  pendingSearch = '';
  pendingPage = 1;
  pendingPageSize = 20;
  readonly pageSizes = [10, 20, 50, 100];

  loading = signal(false);

  inWarranty = computed(() => this.despatches().filter(d => d.warrantyStatus === 'In Warranty').length);
  unassigned = computed(() => this.despatches().filter(d => d.installationComplaintId && !d.assignedTechnicians).length);

  ngOnInit(): void { this.loadPending(); this.load(); }

  setTab(t: 'despatched' | 'pending'): void { this.tab.set(t); }

  load(): void {
    this.loading.set(true);
    this.api.getDespatches({ ...this.filter, searchTerm: this.filter.searchTerm?.trim() || undefined }).subscribe({
      next: r => {
        this.loading.set(false);
        const items = r?.items ?? [];
        this.despatches.set(items);
        const total = r?.totalCount > 0 ? r.totalCount : (items[0]?.totalCount ?? 0);
        this.totalCount.set(total);
        this.totalPages.set(Math.max(1, Math.ceil(total / this.filter.pageSize)));
      },
      error: () => { this.loading.set(false); this.despatches.set([]); },
    });
  }

  loadPending(): void {
    this.api.getSalesOrders({ pageNumber: this.pendingPage, pageSize: this.pendingPageSize, status: 'Billed', searchTerm: this.pendingSearch.trim() || undefined }).subscribe({
      next: r => {
        const items = r?.items ?? [];
        this.pending.set(items);
        const total = r?.totalCount > 0 ? r.totalCount : (items[0]?.totalCount ?? 0);
        this.pendingTotal.set(total);
        this.pendingPages.set(Math.max(1, Math.ceil(total / this.pendingPageSize)));
      },
      error: () => this.pending.set([]),
    });
  }

  search(): void { this.filter.pageNumber = 1; this.load(); }
  prevPage(): void { if (this.filter.pageNumber > 1) { this.filter.pageNumber--; this.load(); } }
  nextPage(): void { if (this.filter.pageNumber < this.totalPages()) { this.filter.pageNumber++; this.load(); } }

  goPage(n: number): void { if (n >= 1 && n <= this.totalPages() && n !== this.filter.pageNumber) { this.filter.pageNumber = n; this.load(); } }

  searchPending(): void { this.pendingPage = 1; this.loadPending(); }
  prevPending(): void { if (this.pendingPage > 1) { this.pendingPage--; this.loadPending(); } }
  nextPending(): void { if (this.pendingPage < this.pendingPages()) { this.pendingPage++; this.loadPending(); } }
  goPending(n: number): void { if (n >= 1 && n <= this.pendingPages() && n !== this.pendingPage) { this.pendingPage = n; this.loadPending(); } }

  /** up to five page numbers around the current one */
  pageWindow(current: number, total: number): number[] {
    const from = Math.max(1, current - 2), to = Math.min(total, from + 4);
    const out: number[] = [];
    for (let i = Math.max(1, to - 4); i <= to; i++) out.push(i);
    return out;
  }

  despatch(o: SalesOrderListItem): void { this.router.navigate(['/sales/despatch', o.salesOrderId]); }
  openBill(id: number): void { this.router.navigate(['/sales/orders', id]); }
  view(d: DespatchListItem): void { this.router.navigate(['/sales/despatch/view', d.despatchId]); }
}
