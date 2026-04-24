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
import {
  GeoTrack,
  Attendance,
  TravelReport,
  TechnicianLivePosition,
} from '../../Models/ApiModels';
import { GeocodeService } from '../../Services/API/geocode-service';

@Component({
  selector: 'app-geo-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './geo-map-component.html',
  styleUrls: ['./geo-map-component.scss'],
})
export class GeoMapComponent {
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
  private geocode = inject(GeocodeService);

// Add resolved address map
resolvedAddresses = signal<Map<number, string>>(new Map());
liveLocationName = signal('');

  // ── Date / Filters ────────────────────────────────────
  selectedDate = '';

  // ── Data ──────────────────────────────────────────────
  trail = signal<GeoTrack[]>([]);
  dayAttendance = signal<Attendance | null>(null);
  travelData = signal<TravelReport | null>(null);
  livePosition = signal<TechnicianLivePosition | null>(null);

  // ── UI State ──────────────────────────────────────────
  loading = signal(false);
  loaded = signal(false);
  activeTab = signal<'timeline' | 'positions'>('timeline');

  get techId(): number {
    return this.selectedTech()?.technicianId ?? 0;
  }

  get isToday(): boolean {
    return this.selectedDate === this.formatDate(new Date());
  }

  // ── Summary stats computed from trail data ────────────
  summary = computed(() => {
    const events = this.trail();
    const att = this.dayAttendance();
    const travel = this.travelData();

    const checkIn = events.find((e) => e.eventType === 'CheckIn');
    const checkOut = events.find((e) => e.eventType === 'CheckOut');
    const siteArrivals = events.filter(
      (e) => e.eventType === 'SiteArrival'
    ).length;
    const totalEvents = events.length;

    // Use attendance data for times if available, else from trail
    const checkInTime = att?.checkInTime
      ? new Date(att.checkInTime)
      : checkIn
        ? new Date(checkIn.recordedAt)
        : null;
    const checkOutTime = att?.checkOutTime
      ? new Date(att.checkOutTime)
      : checkOut
        ? new Date(checkOut.recordedAt)
        : null;

    let activeHours = att?.totalWorkHours ?? null;
    if (!activeHours && checkInTime && checkOutTime) {
      activeHours =
        (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    }

    return {
      totalEvents,
      siteArrivals,
      checkInTime,
      checkOutTime,
      activeHours,
      distanceKm: travel?.totalDistanceKm ?? null,
      serviceVisits: travel?.serviceVisits ?? null,
      checkInAddress: att?.checkInAddress || checkIn?.address || null,
      checkOutAddress: att?.checkOutAddress || checkOut?.address || null,
      isActive: !!checkInTime && !checkOutTime,
    };
  });

  constructor() {
    // Set default date to today
    this.selectedDate = this.formatDate(new Date());

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

  // ── Click outside → close dropdown ────────────────────
  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const el = this._elRef.nativeElement as HTMLElement;
    if (!el.querySelector('.tech-autocomplete')?.contains(e.target as Node)) {
      this.showTechDropdown = false;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  Technician Autocomplete
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

    // Auto-load if date is already set
    if (this.selectedDate) {
      this.loadAll();
    }
  }

  clearTech(): void {
    this.selectedTech.set(null);
    this.techSearch = '';
    this.techResults.set([]);
    this.showTechDropdown = false;
    this.trail.set([]);
    this.dayAttendance.set(null);
    this.travelData.set(null);
    this.livePosition.set(null);
    this.loaded.set(false);
  }

  getTechAvailClass(status: number): string {
    return status === 1 ? 'av' : status === 2 ? 'busy' : 'leave';
  }

  getTechAvailLabel(status: number): string {
    return status === 1 ? 'Available' : status === 2 ? 'Busy' : 'On Leave';
  }

  // ═══════════════════════════════════════════════════════
  //  Date Shortcuts
  // ═══════════════════════════════════════════════════════
  setToday(): void {
    this.selectedDate = this.formatDate(new Date());
    if (this.techId) this.loadAll();
  }

  setYesterday(): void {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    this.selectedDate = this.formatDate(d);
    if (this.techId) this.loadAll();
  }

  // ═══════════════════════════════════════════════════════
  //  Load All Data
  // ═══════════════════════════════════════════════════════
  loadAll(): void {
    if (!this.techId || !this.selectedDate) return;

    this.loading.set(true);
    this.loaded.set(false);
    this.trail.set([]);
    this.dayAttendance.set(null);
    this.travelData.set(null);
    this.livePosition.set(null);

    let pending = this.isToday ? 4 : 3; // 4 calls if today (includes live), else 3
    const done = () => {
      pending--;
      if (pending <= 0) {
        this.loading.set(false);
        this.loaded.set(true);
      }
    };

    // 1. Load geo trail
    this.api.getGeoTrail(this.techId, this.selectedDate).subscribe({
  next: (res: any) => {
    const raw = res?.data ?? res?.items ?? res;
    const events: GeoTrack[] = Array.isArray(raw) ? raw : [];
    this.trail.set(events);
    // Resolve addresses for events that don't have one
    this.resolveTrailAddresses(events);
    done();
  },
  error: () => { this.trail.set([]); done(); },
});

    // 2. Load attendance for the same day
    this.api
      .getAttendance(this.techId, this.selectedDate, this.selectedDate)
      .subscribe({
        next: (res: any) => {
          const list = res?.data ?? res?.items ?? res ?? [];
          const records: any[] = Array.isArray(list) ? list : [];
          this.dayAttendance.set(records.length > 0 ? records[0] : null);
          done();
        },
        error: () => { this.dayAttendance.set(null); done(); },
      });

    // 3. Load travel report for the date + technician
    this.api
      .getTravelReport(this.selectedDate, this.selectedDate, this.techId)
      .subscribe({
        next: (res: any) => {
          const list = res?.data ?? res?.items ?? res ?? [];
          const records: any[] = Array.isArray(list) ? list : [];
          this.travelData.set(records.length > 0 ? records[0] : null);
          done();
        },
        error: () => { this.travelData.set(null); done(); },
      });

    // 4. Load live position (only if viewing today)
    if (this.isToday) {
  this.api.getLivePositions().subscribe({
    next: (res: any) => {
      const list = res?.data ?? res?.items ?? res ?? [];
      const positions: any[] = Array.isArray(list) ? list : [];
      const match = positions.find((p: any) => p.technicianId === this.techId);
      this.livePosition.set(match ?? null);
      // Resolve live position address
      if (match) {
        this.geocode.reverseGeocode(match.currentLatitude, match.currentLongitude)
          .subscribe(name => this.liveLocationName.set(name));
      }
      done();
    },
    error: () => { this.livePosition.set(null); done(); },
  });
}
  }

  // ═══════════════════════════════════════════════════════
  //  Event Helpers
  // ═══════════════════════════════════════════════════════
  getIcon(type: string): string {
    const m: Record<string, string> = {
      CheckIn: 'login',
      CheckOut: 'logout',
      SiteArrival: 'place',
      WorkStart: 'play_arrow',
      WorkComplete: 'check_circle',
      Transit: 'directions_car',
      LocationUpdate: 'my_location',
      BreakStart: 'free_breakfast',
      BreakEnd: 'restart_alt',
    };
    return m[type] || 'location_on';
  }

  getEventLabel(type: string): string {
    const m: Record<string, string> = {
      CheckIn: 'Checked In',
      CheckOut: 'Checked Out',
      SiteArrival: 'Arrived at Site',
      WorkStart: 'Work Started',
      WorkComplete: 'Work Completed',
      Transit: 'In Transit',
      LocationUpdate: 'Location Update',
      BreakStart: 'Break Started',
      BreakEnd: 'Break Ended',
    };
    return m[type] || type;
  }

  getEventColorClass(type: string): string {
    const m: Record<string, string> = {
      CheckIn: 'ev-green',
      CheckOut: 'ev-red',
      SiteArrival: 'ev-blue',
      WorkStart: 'ev-amber',
      WorkComplete: 'ev-purple',
      Transit: 'ev-slate',
      LocationUpdate: 'ev-teal',
      BreakStart: 'ev-orange',
      BreakEnd: 'ev-orange',
    };
    return m[type] || 'ev-slate';
  }

  getTimeBetween(idx: number): string | null {
    const events = this.trail();
    if (idx <= 0 || idx >= events.length) return null;
    const prev = new Date(events[idx - 1].recordedAt).getTime();
    const curr = new Date(events[idx].recordedAt).getTime();
    const diffMin = Math.round((curr - prev) / 60000);
    if (diffMin < 1) return null;
    if (diffMin < 60) return `${diffMin}m`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  openInMaps(lat: number, lng: number): void {
    window.open(
      `https://www.google.com/maps?q=${lat},${lng}`,
      '_blank'
    );
  }

  // ═══════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════
  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  private resolveTrailAddresses(events: GeoTrack[]): void {
  const map = new Map<number, string>();
  let pending = 0;

  events.forEach((e, idx) => {
    if (e.address) {
      // Already has address from backend
      map.set(e.trackingId, e.address);
    } else {
      pending++;
      // Stagger requests to respect Nominatim 1req/sec limit
      setTimeout(() => {
        this.geocode.reverseGeocode(e.latitude, e.longitude).subscribe(name => {
          map.set(e.trackingId, name);
          this.resolvedAddresses.set(new Map(map));
        });
      }, idx * 1100); // 1.1s gap between requests
    }
  });

  if (pending === 0) {
    this.resolvedAddresses.set(map);
  }
}

// Helper to get resolved address for a trail event
getResolvedAddress(t: GeoTrack): string {
  return t.address || this.resolvedAddresses().get(t.trackingId) || '';
}
}
