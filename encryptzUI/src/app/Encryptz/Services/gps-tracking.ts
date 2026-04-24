import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { ApiService } from './API/api-service';
import { TrackingLogDto } from '../Models/ApiModels';


@Injectable({
  providedIn: 'root',
})
export class GpsTracking {
   private api = inject(ApiService);

  // ── Config ────────────────────────────────────────────
  private readonly INTERVAL_MS = 60_000;    // Log position every 60 seconds
  private readonly MIN_DISTANCE_M = 10;     // Skip if moved less than 10m (noise filter)
  private readonly MAX_ACCURACY_M = 100;    // Skip readings with accuracy > 100m

  // ── State ─────────────────────────────────────────────
  isTracking = signal(false);
  lastPosition = signal<{ lat: number; lng: number; time: Date } | null>(null);
  errorMsg = signal('');
  logCount = signal(0);

  private technicianId: number | null = null;
 sessionId: string | undefined = undefined;
  private watchId: number | null = null;
  private intervalId: any = null;
  private pendingPosition: GeolocationPosition | null = null;
  private lastLoggedLat: number | null = null;
  private lastLoggedLng: number | null = null;

  // ═══════════════════════════════════════════════════════
  //  Start Tracking — call after successful check-in
  // ═══════════════════════════════════════════════════════
  startTracking(technicianId: number): void {
    if (this.isTracking()) {
      console.warn('[GpsTracking] Already tracking');
      return;
    }
    if (!navigator.geolocation) {
      this.errorMsg.set('Geolocation not supported');
      return;
    }

    this.technicianId = technicianId;
    this.sessionId = this.generateSessionId();
    this.logCount.set(0);
    this.errorMsg.set('');
    this.lastLoggedLat = null;
    this.lastLoggedLng = null;

    // Start watching GPS position continuously
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onPositionUpdate(pos),
      (err) => this.onPositionError(err),
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,       // Accept cached position up to 30s old
        timeout: 15_000,
      }
    );

    // Set interval to flush latest position to API
    this.intervalId = setInterval(() => this.flushPosition(), this.INTERVAL_MS);

    this.isTracking.set(true);
    console.log(`[GpsTracking] Started for tech ${technicianId}, session ${this.sessionId}`);
  }

  // ═══════════════════════════════════════════════════════
  //  Stop Tracking — call after check-out
  // ═══════════════════════════════════════════════════════
  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Flush final position before stopping
    if (this.pendingPosition) {
      this.flushPosition();
    }

    this.isTracking.set(false);
    this.technicianId = null;
    this.pendingPosition = null;
    console.log(`[GpsTracking] Stopped. Total logs: ${this.logCount()}`);
  }

  // ═══════════════════════════════════════════════════════
  //  GPS Callbacks
  // ═══════════════════════════════════════════════════════

  private onPositionUpdate(pos: GeolocationPosition): void {
    // Filter out low-accuracy readings
    if (pos.coords.accuracy > this.MAX_ACCURACY_M) {
      return;
    }

    this.pendingPosition = pos;
    this.lastPosition.set({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      time: new Date(),
    });
  }

  private onPositionError(err: GeolocationPositionError): void {
    const msg =
      err.code === 1
        ? 'Location permission denied'
        : err.code === 2
          ? 'Location unavailable'
          : 'Location timeout';
    this.errorMsg.set(msg);
    console.warn(`[GpsTracking] Error: ${msg}`);
  }

  // ═══════════════════════════════════════════════════════
  //  Flush — sends buffered position to API
  // ═══════════════════════════════════════════════════════

  private flushPosition(): void {
    const pos = this.pendingPosition;
    if (!pos || !this.technicianId) return;

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Skip if haven't moved enough (noise filter)
    if (this.lastLoggedLat !== null && this.lastLoggedLng !== null) {
      const dist = this.haversineDistance(
        this.lastLoggedLat,
        this.lastLoggedLng,
        lat,
        lng
      );
      if (dist < this.MIN_DISTANCE_M) {
        return; // Haven't moved significantly — skip this log
      }
    }

    // POST api/tracking/log
    const dto  = {
      technicianId: this.technicianId,
      latitude: lat,
      longitude: lng,
      accuracy: pos.coords.accuracy ?? undefined,
      speed: pos.coords.speed ?? undefined,
      batteryLevel: this.getBatteryLevel(),
      sessionId: this.sessionId,
    };

    this.api.logPosition(dto).subscribe({
      next: () => {
        this.lastLoggedLat = lat;
        this.lastLoggedLng = lng;
        this.logCount.update((n) => n + 1);
        this.errorMsg.set('');
      },
      error: (err) => {
        console.warn('[GpsTracking] Log failed:', err);
        // Don't clear pendingPosition — will retry on next interval
      },
    });

    this.pendingPosition = null;
  }

  // ═══════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════

  /** Haversine distance in meters between two GPS points */
  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private generateSessionId(): string {
    // Simple UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      }
    );
  }

  private getBatteryLevel(): number | undefined {
    // Battery API (if available)
    try {
      const nav = navigator as any;
      if (nav.getBattery) {
        nav.getBattery().then((b: any) => b.level * 100);
      }
    } catch {
      // Not available
    }
    return undefined;
  }

  ngOnDestroy(): void {
    this.stopTracking();
  }
}
