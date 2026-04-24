import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  signal,
  DestroyRef,
  ElementRef,
  HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../Services/API/api-service';
import { Attendance, ComplaintLookup } from '../../Models/ApiModels';
import { GpsTracking } from '../../Services/gps-tracking';

@Component({
  selector: 'app-check-in-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './check-in-component.html',
  styleUrl: './check-in-component.scss',
})
export class CheckInComponent {
  private api = inject(ApiService);
  private _destroyRef = inject(DestroyRef);
  private _elRef = inject(ElementRef);
  private techSearchSubject = new Subject<string>();

  // ── Technician autocomplete ───────────────────────────
  techSearch = '';
  techResults = signal<any[]>([]);
  showTechDropdown = false;
  selectedTech = signal<any>(null);
  techSearchLoading = signal(false);

  // ── Attendance state ──────────────────────────────────
  attendance = signal<Attendance[]>([]);
  isCheckedIn = signal(false);
  activeAttendanceId = signal<number | null>(null);
  busy = signal(false);
  msg = signal('');
  isErr = signal(false);
  currentCoords = signal('');
  checkInTime = signal<Date | null>(null);
  today = new Date();

  // ── Site arrival complaint autocomplete ────────────────
  siteComplaintId = 0;
  siteSearch = '';
  siteResults = signal<ComplaintLookup[]>([]);
  showSiteDropdown = false;
  selectedSiteC = signal<ComplaintLookup | null>(null);
  siteSearchLoading = signal(false);
  private siteSubject = new Subject<string>();
  readonly gpsService = inject(GpsTracking);

  // ── Filter ────────────────────────────────────────────
  filterTechId: number | null = null;
  filterFrom = '';
  filterTo = '';

  get techId(): number {
    return this.selectedTech()?.technicianId ?? 0;
  }

  constructor() {
    // ── Technician search debounce ─────────────────────
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
              // getTechnicians returns ApiResponse<PagedResponse<T>>
              // → d.data.items is the list
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

    // ── Complaint search debounce (site arrival) ──────
    this.siteSubject
      .pipe(debounceTime(300), takeUntilDestroyed(this._destroyRef))
      .subscribe((term) => {
        if (!term.trim()) {
          this.siteResults.set([]);
          this.siteSearchLoading.set(false);
          return;
        }
        this.siteSearchLoading.set(true);
        this.api.getComplaintsLookup(term).subscribe({
          next: (d: any) => {
            const raw = d?.data ?? d?.items ?? d;
            this.siteResults.set(Array.isArray(raw) ? raw : []);
            this.siteSearchLoading.set(false);
          },
          error: () => {
            this.siteResults.set([]);
            this.siteSearchLoading.set(false);
          },
        });
      });
  }

  // ── Click outside → close dropdowns ───────────────────
  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const el = this._elRef.nativeElement as HTMLElement;
    if (!el.querySelector('.tech-autocomplete')?.contains(e.target as Node)) {
      this.showTechDropdown = false;
    }
    if (!el.querySelector('.site-autocomplete')?.contains(e.target as Node)) {
      this.showSiteDropdown = false;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Technician autocomplete
  // ═══════════════════════════════════════════════════════
  onTechSearch(): void {
    this.showTechDropdown = true;
    this.techSearchSubject.next(this.techSearch);
  }

  selectTech(t: any): void {
    this.selectedTech.set(t);
    this.techSearch = t.fullName;
    this.showTechDropdown = false;
    this.techResults.set([]);
    this.filterTechId = t.technicianId;

    // Load attendance + detect current check-in status
    this.loadAttendance();
    this.loadCurrentStatus(t.technicianId);
  }

  clearTech(): void {
    this.selectedTech.set(null);
    this.techSearch = '';
    this.techResults.set([]);
    this.showTechDropdown = false;
    this.filterTechId = null;
    this.isCheckedIn.set(false);
    this.activeAttendanceId.set(null);
    this.currentCoords.set('');
    this.checkInTime.set(null);
    this.attendance.set([]);
    this.clearSiteC();
    this.clearMsg();
     this.gpsService.stopTracking();
  }

  getTechAvailClass(status: number): string {
    return status === 1 ? 'av' : status === 2 ? 'busy' : 'leave';
  }

  getTechAvailLabel(status: number): string {
    return status === 1 ? 'Available' : status === 2 ? 'Busy' : 'On Leave';
  }

  // ═══════════════════════════════════════════════════════
  //  Site arrival complaint autocomplete
  // ═══════════════════════════════════════════════════════
  onSiteSearch(): void {
    this.showSiteDropdown = true;
    this.siteSubject.next(this.siteSearch);
  }

  selectSiteC(c: ComplaintLookup): void {
    this.selectedSiteC.set(c);
    this.siteComplaintId = c.complaintId;
    this.siteSearch = `${c.complaintNumber} — ${c.subject}`;
    this.showSiteDropdown = false;
    this.siteResults.set([]);
  }

  clearSiteC(): void {
    this.selectedSiteC.set(null);
    this.siteComplaintId = 0;
    this.siteSearch = '';
    this.siteResults.set([]);
    this.showSiteDropdown = false;
  }

  // ═══════════════════════════════════════════════════════
  //  Check In
  //  → POST api/tracking/{technicianId}/checkin
  //  Body: { latitude, longitude, address? }
  //  Returns: ApiResponse<int> { success, message, data }
  // ═══════════════════════════════════════════════════════
  checkIn(): void {
    if (!this.techId) return;
    this.clearMsg();
    this.busy.set(true);

    this.getGeo()
      .then((pos) => {
        const dto = {
          latitude: pos.latitude,
          longitude: pos.longitude,
          address: pos.address ?? null,
        };

        this.api.checkIn(this.techId, dto).subscribe({
          next: (res: any) => {
            this.busy.set(false);
            if (res.success) {
              this.isCheckedIn.set(true);
              this.activeAttendanceId.set(res.data ?? null);
              this.checkInTime.set(new Date());
              this.currentCoords.set(
                `${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`
              );
              this.showMsg(res.message || 'Checked in successfully!', false);
              this.autoLoad();
                  this.gpsService.startTracking(this.techId);
            } else {
              this.showMsg(res.message || 'Check-in failed', true);
            }
          },
          error: (err) => {
            this.busy.set(false);
            this.showMsg(
              err?.error?.message || 'Check-in failed. Try again.',
              true
            );
          },
        });
      })
      .catch(() => {
        this.busy.set(false);
        this.showMsg(
          'Unable to get GPS location. Please enable location services.',
          true
        );
      });
  }

  // ═══════════════════════════════════════════════════════
  //  Check Out
  //  → POST api/tracking/{technicianId}/checkout
  //  Body: { latitude, longitude, address? }
  //  Returns: ApiResponse { success, message }
  // ═══════════════════════════════════════════════════════
  checkOut(): void {
    if (!this.techId) return;
    this.clearMsg();
    this.busy.set(true);

    this.getGeo()
      .then((pos) => {
        const dto = {
          latitude: pos.latitude,
          longitude: pos.longitude,
          address: pos.address ?? null,
        };

        this.api.checkOut(this.techId, dto).subscribe({
          next: (res: any) => {
            this.busy.set(false);
            if (res.success) {
              this.isCheckedIn.set(false);
              this.activeAttendanceId.set(null);
              this.checkInTime.set(null);
              this.currentCoords.set('');
              this.showMsg(res.message || 'Checked out successfully!', false);
              this.autoLoad();
                 this.gpsService.stopTracking();
            } else {
              this.showMsg(res.message || 'Check-out failed', true);
            }
          },
          error: (err) => {
            this.busy.set(false);
            this.showMsg(err?.error?.message || 'Check-out failed.', true);
          },
        });
      })
      .catch(() => {
        this.busy.set(false);
        this.showMsg('Unable to get GPS location.', true);
      });
  }

  // ═══════════════════════════════════════════════════════
  //  Site Arrival
  //  → POST api/tracking/{technicianId}/site-arrival
  //  Body: { complaintId, latitude, longitude, address? }
  //  Returns: ApiResponse { success, message }
  // ═══════════════════════════════════════════════════════
  recordSiteArrival(): void {
    if (!this.techId || !this.siteComplaintId) return;
    this.clearMsg();
    this.busy.set(true);

    this.getGeo()
      .then((pos) => {
        const dto = {
          complaintId: this.siteComplaintId,
          latitude: pos.latitude,
          longitude: pos.longitude,
          address: pos.address ?? null,
        };

        this.api.recordSiteArrival(this.techId, dto).subscribe({
          next: (res: any) => {
            this.busy.set(false);
            if (res.success) {
              const cNo =
                this.selectedSiteC()?.complaintNumber ||
                `#${this.siteComplaintId}`;
              this.showMsg(
                res.message || `Site arrival recorded for ${cNo}`,
                false
              );
              this.clearSiteC(); // reset complaint after success
            } else {
              this.showMsg(res.message || 'Site arrival failed', true);
            }
          },
          error: (err) => {
            this.busy.set(false);
            this.showMsg(err?.error?.message || 'Site arrival failed.', true);
          },
        });
      })
      .catch(() => {
        this.busy.set(false);
        this.showMsg('Unable to get GPS location.', true);
      });
  }

  // ═══════════════════════════════════════════════════════
  //  Load Attendance
  //  → GET api/tracking/attendance?technicianId=&fromDate=&toDate=
  //  Returns: ApiResponse<List<AttendanceDto>>
  //           → { success, data: [...] }
  // ═══════════════════════════════════════════════════════
  loadAttendance(): void {
    this.api
      .getAttendance(
        this.filterTechId || undefined,
        this.filterFrom || undefined,
        this.filterTo || undefined
      )
      .subscribe({
        next: (res: any) => {
          // Backend wraps in ApiResponse → unwrap .data
          const list = res?.data ?? res?.items ?? res;
          this.attendance.set(Array.isArray(list) ? list : []);
        },
        error: () => this.attendance.set([]),
      });
  }

  // ═══════════════════════════════════════════════════════
  //  Load current check-in status for selected technician
  //  Fetches today's attendance, finds active record
  //  (has checkInTime but no checkOutTime).
  // ═══════════════════════════════════════════════════════
  private loadCurrentStatus(technicianId: number): void {
    const todayStr = this.formatDate(new Date());

    this.api.getAttendance(technicianId, todayStr, todayStr).subscribe({
      next: (res: any) => {
        const raw = res?.data ?? res?.items ?? res ?? [];
        const records: any[] = Array.isArray(raw) ? raw : [];

        // Find active record: checked in but NOT yet checked out
        const active = records.find(
          (a: any) => a.checkInTime && !a.checkOutTime
        );

        if (active) {
          this.isCheckedIn.set(true);
          this.activeAttendanceId.set(active.attendanceId ?? null);
          this.checkInTime.set(
            active.checkInTime ? new Date(active.checkInTime) : null
          );
          this.currentCoords.set(active.checkInAddress || '');
              if (!this.gpsService.isTracking()) {
      this.gpsService.startTracking(technicianId);
    }
        } else {

          this.isCheckedIn.set(false);
          this.activeAttendanceId.set(null);
          this.checkInTime.set(null);
          this.currentCoords.set('');
           this.gpsService.stopTracking();
        }

      },
      error: () => {
        this.isCheckedIn.set(false);
        this.activeAttendanceId.set(null);
      },
    });
  }

  // ═══════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════
  private autoLoad(): void {
    if (this.techId) {
      this.filterTechId = this.techId;
      this.loadAttendance();
    }
  }

  private getGeo(): Promise<{
    latitude: number;
    longitude: number;
    address?: string;
  }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation not supported');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) =>
          resolve({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          }),
        (e) => reject(e),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private showMsg(m: string, err: boolean): void {
    this.msg.set(m);
    this.isErr.set(err);
  }

  private clearMsg(): void {
    this.msg.set('');
    this.isErr.set(false);
  }
}
