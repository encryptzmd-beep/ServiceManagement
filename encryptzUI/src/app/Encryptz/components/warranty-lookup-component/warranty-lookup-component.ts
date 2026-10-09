import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';
import { WarrantyLookupItem } from '../../Models/ApiModels';

/** Warranty of the installed base: find a unit by serial number, customer, mobile, bill or despatch number. */
@Component({
  selector: 'app-warranty-lookup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './warranty-lookup-component.html',
  styleUrls: ['./warranty-lookup-component.scss'],
})
export class WarrantyLookupComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  readonly pageSizes = [10, 20, 50, 100];

  items = signal<WarrantyLookupItem[]>([]);
  totalCount = signal(0);
  totalPages = signal(1);
  loading = signal(false);
  searched = signal(false);
  search = '';
  scope: 'all' | 'active' | 'expired' = 'all';
  pageNumber = 1;
  pageSize = 20;

  inWarranty = computed(() => this.items().filter(i => i.warrantyStatus === 'In Warranty').length);
  expired = computed(() => this.items().filter(i => i.warrantyStatus === 'Expired').length);
  expiringSoon = computed(() => this.items().filter(i => i.warrantyStatus === 'In Warranty' && (i.warrantyDaysLeft ?? 999) <= 30).length);
  withOpenComplaints = computed(() => this.items().filter(i => i.openComplaints > 0).length);
  rangeFrom = computed(() => this.totalCount() === 0 ? 0 : (this.pageNumber - 1) * this.pageSize + 1);
  rangeTo = computed(() => Math.min(this.pageNumber * this.pageSize, this.totalCount()));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const onlyActive = this.scope === 'all' ? undefined : this.scope === 'active';
    this.api.warrantyLookup({ search: this.search.trim() || undefined, onlyActive, pageNumber: this.pageNumber, pageSize: this.pageSize }).subscribe({
      next: r => {
        this.loading.set(false); this.searched.set(true);
        const items = r?.items ?? [];
        this.items.set(items);
        const total = r?.totalCount > 0 ? r.totalCount : (items[0]?.totalCount ?? 0);
        this.totalCount.set(total);
        this.totalPages.set(Math.max(1, Math.ceil(total / this.pageSize)));
      },
      error: () => { this.loading.set(false); this.searched.set(true); this.items.set([]); this.totalCount.set(0); this.totalPages.set(1); },
    });
  }

  doSearch(): void { this.pageNumber = 1; this.load(); }
  reset(): void { this.search = ''; this.scope = 'all'; this.pageNumber = 1; this.load(); }
  changePageSize(): void { this.pageNumber = 1; this.load(); }
  prevPage(): void { if (this.pageNumber > 1) { this.pageNumber--; this.load(); } }
  nextPage(): void { if (this.pageNumber < this.totalPages()) { this.pageNumber++; this.load(); } }
  goPage(n: number): void { if (n >= 1 && n <= this.totalPages() && n !== this.pageNumber) { this.pageNumber = n; this.load(); } }

  /** page numbers around the current one for the pager */
  pageWindow(): number[] {
    const total = this.totalPages(), cur = this.pageNumber;
    const from = Math.max(1, cur - 2), to = Math.min(total, from + 4);
    const out: number[] = [];
    for (let i = Math.max(1, to - 4); i <= to; i++) out.push(i);
    return out;
  }

  openBill(i: WarrantyLookupItem): void { if (i.salesOrderId) this.router.navigate(['/sales/orders', i.salesOrderId]); }
  openDespatch(i: WarrantyLookupItem): void { if (i.despatchId) this.router.navigate(['/sales/despatch/view', i.despatchId]); }

  daysLabel(i: WarrantyLookupItem): string {
    const d = i.warrantyDaysLeft;
    if (d === null || d === undefined) return '';
    return d >= 0 ? `${d} days left` : `expired ${-d} days ago`;
  }
}
