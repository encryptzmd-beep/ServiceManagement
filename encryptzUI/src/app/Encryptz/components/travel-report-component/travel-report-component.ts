import {
  Component,
  inject,
  signal,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../Services/API/api-service';
import { TravelReport } from '../../Models/ApiModels';

@Component({
  selector: 'app-travel-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './travel-report-component.html',
  styleUrls: ['./travel-report-component.scss'],
})
export class TravelReportComponent {
  private api = inject(ApiService);
  private _destroyRef = inject(DestroyRef);
  private _elRef = inject(ElementRef);

  // ── Data ──────────────────────────────────────────────
  data = signal<TravelReport[]>([]);
  loading = signal(false);
  loaded = signal(false);

  // ── Filters ───────────────────────────────────────────
  fromDate = '';
  toDate = '';

  // ── Tech autocomplete ─────────────────────────────────
  techSearch = '';
  techResults = signal<any[]>([]);
  showTechDropdown = false;
  selectedTech = signal<any>(null);
  techSearchLoading = signal(false);
  private techSearchSubject = new Subject<string>();

  get techId(): number {
    return this.selectedTech()?.technicianId ?? 0;
  }

  // ── Summary computed ──────────────────────────────────
  summary = computed(() => {
    const d = this.data();
    if (!d.length) return null;
    return {
      totalDistance: d.reduce((s, r) => s + (r.totalDistanceKm || 0), 0),
      totalVisits: d.reduce((s, r) => s + (r.serviceVisits || 0), 0),
      avgDistance:
        d.reduce((s, r) => s + (r.totalDistanceKm || 0), 0) / d.length,
      daysCount: d.length,
    };
  });

  constructor() {
    // Default dates: last 7 days
    const today = new Date();
    this.toDate = this.formatDate(today);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    this.fromDate = this.formatDate(weekAgo);

    // Tech search debounce
    this.techSearchSubject
      .pipe(debounceTime(300), takeUntilDestroyed(this._destroyRef))
      .subscribe((term) => {
        if (!term.trim()) {
          this.techResults.set([]);
          this.techSearchLoading.set(false);
          return;
        }
        this.techSearchLoading.set(true);
        this.api
          .getTechnicians({
            searchTerm: term,
            pageNumber: 1,
            pageSize: 10,
          } as any)
          .subscribe({
            next: (d: any) => {
              const raw = d?.data?.items ?? d?.data ?? d?.items ?? d;
              this.techResults.set(Array.isArray(raw) ? raw : []);
              this.techSearchLoading.set(false);
            },
            error: () => {
              this.techResults.set([]);
              this.techSearchLoading.set(false);
            },
          });
      });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const el = this._elRef.nativeElement as HTMLElement;
    if (!el.querySelector('.tech-autocomplete')?.contains(e.target as Node)) {
      this.showTechDropdown = false;
    }
  }

  // ── Tech autocomplete ─────────────────────────────────
  onTechSearch(): void {
    this.showTechDropdown = true;
    this.techSearchSubject.next(this.techSearch);
  }

  selectTech(t: any): void {
    this.selectedTech.set(t);
    this.techSearch = t.fullName;
    this.showTechDropdown = false;
    this.techResults.set([]);
  }

  clearTech(): void {
    this.selectedTech.set(null);
    this.techSearch = '';
    this.techResults.set([]);
    this.showTechDropdown = false;
  }

  // ── Load ──────────────────────────────────────────────
  // GET api/tracking/travel-report?fromDate=&toDate=&technicianId=
  // Returns: ApiResponse<List<TravelReportDto>>
  load(): void {
    if (!this.fromDate || !this.toDate) return;
    this.loading.set(true);
    this.loaded.set(false);
    this.data.set([]);

    this.api
      .getTravelReport(
        this.fromDate,
        this.toDate,
        this.techId || undefined
      )
      .subscribe({
        next: (res: any) => {
          const raw = res?.data ?? res?.items ?? res;
          this.data.set(Array.isArray(raw) ? raw : []);
          this.loading.set(false);
          this.loaded.set(true);
        },
        error: () => {
          this.data.set([]);
          this.loading.set(false);
          this.loaded.set(true);
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────
  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  getTechAvailClass(status: number): string {
    return status === 1 ? 'av' : status === 2 ? 'busy' : 'leave';
  }

  getTechAvailLabel(status: number): string {
    return status === 1 ? 'Available' : status === 2 ? 'Busy' : 'On Leave';
  }

  getDistanceClass(km: number): string {
    if (km > 100) return 'dist-high';
    if (km > 50) return 'dist-med';
    return 'dist-low';
  }
}
