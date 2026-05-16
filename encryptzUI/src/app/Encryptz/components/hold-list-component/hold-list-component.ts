import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';

@Component({
  selector: 'app-hold-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './hold-list-component.html',
  styleUrls: ['./hold-list-component.scss']
})
export class HoldListComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(true);
  items   = signal<any[]>([]);
  error   = signal('');

  ngOnInit(): void {
    this.api.getHoldList().subscribe({
      next: (res: any) => {
        const rows: any[] = Array.isArray(res) ? res
          : Array.isArray(res?.data) ? res.data
          : [];
        this.items.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load hold list');
        this.loading.set(false);
      }
    });
  }

  holdType(item: any): string {
    const hasRepair = item.repairStatus && item.repairStatus !== 'None';
    const hasSpare  = item.spareStatus  && item.spareStatus  !== 'None';
    if (hasRepair && hasSpare) return 'Both';
    if (hasRepair) return 'Repair Parts';
    if (hasSpare)  return 'Spare Parts';
    return '—';
  }

  repairStatusClass(s: string): string {
    if (!s || s === 'None') return 'hl-none';
    const m: any = { Resolved: 'hl-ok', Pending: 'hl-pending', InProgress: 'hl-progress', Cancelled: 'hl-none' };
    return m[s] ?? 'hl-pending';
  }

  spareStatusClass(s: string): string {
    if (!s || s === 'None') return 'hl-none';
    const m: any = { Used: 'hl-ok', Approved: 'hl-progress', Pending: 'hl-pending', Rejected: 'hl-none' };
    return m[s] ?? 'hl-pending';
  }
}
