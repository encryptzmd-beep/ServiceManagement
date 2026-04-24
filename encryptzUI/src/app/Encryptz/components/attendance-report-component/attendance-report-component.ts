import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  DestroyRef,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../Services/API/api-service';
import { Attendance } from '../../Models/ApiModels';

@Component({
  selector: 'app-attendance-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance-report-component.html',
  styleUrls: ['./attendance-report-component.scss'],
})
export class AttendanceReportComponent implements OnInit {
  private api = inject(ApiService);
  private _destroyRef = inject(DestroyRef);
  private _elRef = inject(ElementRef);

  // ── Data ──────────────────────────────────────────────
  records = signal<Attendance[]>([]);
  loading = signal(false);

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
    const d = this.records();
    if (!d.length) return null;
    const withCheckout = d.filter((r) => r.checkOutTime);
    const totalHours = d.reduce((s, r) => s + (r.totalWorkHours || 0), 0);
    const avgHours = withCheckout.length > 0
      ? totalHours / withCheckout.length
      : 0;
    const active = d.filter((r) => r.checkInTime && !r.checkOutTime).length;
    const overtime = d.filter((r) => (r.totalWorkHours || 0) > 8).length;

    return {
      totalRecords: d.length,
      active,
      totalHours,
      avgHours,
      overtime,
    };
  });

  constructor() {
    // Default: today
    const today = new Date();
    this.toDate = this.formatDate(today);
    this.fromDate = this.formatDate(today);

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

  ngOnInit(): void {
    this.load();
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
    this.load();
  }

  clearTech(): void {
    this.selectedTech.set(null);
    this.techSearch = '';
    this.techResults.set([]);
    this.showTechDropdown = false;
    this.load();
  }

  getTechAvailClass(status: number): string {
    return status === 1 ? 'av' : status === 2 ? 'busy' : 'leave';
  }

  // ── Load ──────────────────────────────────────────────
  // GET api/tracking/attendance?technicianId=&fromDate=&toDate=
  // Returns: ApiResponse<List<AttendanceDto>> → { success, data: [...] }
  load(): void {
    this.loading.set(true);
    this.records.set([]);

    this.api
      .getAttendance(
        this.techId || undefined,
        this.fromDate || undefined,
        this.toDate || undefined
      )
      .subscribe({
        next: (res: any) => {
          // Unwrap ApiResponse
          const raw = res?.data ?? res?.items ?? res;
          this.records.set(Array.isArray(raw) ? raw : []);
          this.loading.set(false);
        },
        error: () => {
          this.records.set([]);
          this.loading.set(false);
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
}
