import { AppToastComponent } from '../app-toast-component/app-toast-component';
import { statusText } from '../shared/sales-input-rules';
import { AppRightDirective } from '../shared/app-right/app-right';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';
import { ModuleRefusedComponent, isModuleRefusal } from '../shared/module-refused';
import { SalesOrderFilter, SalesOrderListItem } from '../../Models/ApiModels';
import { DialogService } from '../../Services/dialog-service';

@Component({
  selector: 'app-sales-order-list',
  standalone: true,
  imports: [AppToastComponent, AppRightDirective, CommonModule, FormsModule, RouterModule, ModuleRefusedComponent],
  templateUrl: './sales-order-list-component.html',
  styleUrls: ['./sales-order-list-component.scss'],
})
export class SalesOrderListComponent implements OnInit {
  readonly statusText = statusText;
  private dialog = inject(DialogService);
  private api = inject(ApiService);
  private router = inject(Router);

  orders = signal<SalesOrderListItem[]>([]);
  totalCount = signal(0);
  totalPages = signal(1);
  /** The API refused (403): the session was opened for another module. */
  refused = signal(false);
  loading = signal(false);
  toast = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  filter: SalesOrderFilter = { pageNumber: 1, pageSize: 20, status: '', searchTerm: '' };
  readonly statuses = ['Billed', 'Despatched', 'Cancelled'];

  billedCount = computed(() => this.orders().filter(o => o.status === 'Billed').length);
  despatchedCount = computed(() => this.orders().filter(o => o.status === 'Despatched').length);
  pageTotal = computed(() => this.orders().filter(o => o.status !== 'Cancelled').reduce((s, o) => s + (o.grandTotal || 0), 0));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.getSalesOrders({ ...this.filter, status: this.filter.status || undefined, searchTerm: this.filter.searchTerm?.trim() || undefined }).subscribe({
      next: r => {
        this.loading.set(false);
        const items = r?.items ?? [];
        this.orders.set(items);
        const total = r?.totalCount > 0 ? r.totalCount : (items[0]?.totalCount ?? 0);
        this.totalCount.set(total);
        this.totalPages.set(Math.max(1, Math.ceil(total / this.filter.pageSize)));
      },
      error: e => { this.loading.set(false); this.refused.set(isModuleRefusal(e)); this.orders.set([]); this.totalCount.set(0); this.totalPages.set(1); },
    });
  }

  search(): void { this.filter.pageNumber = 1; this.load(); }
  resetFilters(): void { this.filter = { pageNumber: 1, pageSize: 20, status: '', searchTerm: '' }; this.load(); }
  prevPage(): void { if (this.filter.pageNumber > 1) { this.filter.pageNumber--; this.load(); } }
  nextPage(): void { if (this.filter.pageNumber < this.totalPages()) { this.filter.pageNumber++; this.load(); } }

  newOrder(): void { this.router.navigate(['/sales/orders/new']); }
  open(o: SalesOrderListItem): void { this.router.navigate(['/sales/orders', o.salesOrderId]); }
  despatch(o: SalesOrderListItem): void { this.router.navigate(['/sales/despatch', o.salesOrderId]); }
  viewDespatch(o: SalesOrderListItem): void { if (o.despatchId) this.router.navigate(['/sales/despatch/view', o.despatchId]); }

  async cancel(o: SalesOrderListItem, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (!(await this.dialog.confirm(`Cancel bill ${o.orderNo}? This cannot be undone.`))) return;
    this.api.cancelSalesOrder(o.salesOrderId).subscribe({
      next: r => { this.showToast(r?.success ? 'success' : 'error', r?.message || 'Done'); this.load(); },
      error: e => this.showToast('error', e?.error?.message || 'Could not cancel the bill'),
    });
  }

  showToast(type: 'success' | 'error', text: string): void {
    this.toast.set({ type, text });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
