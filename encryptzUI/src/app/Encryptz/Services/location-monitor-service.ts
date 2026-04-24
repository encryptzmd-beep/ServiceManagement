import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class LocationMonitorService {
  private router = inject(Router);
  private watchId: number | null = null;
  private checkInterval: any = null;
  private _role = '';
  private _logoutFn: (() => void) | null = null;

  currentLat = signal<number | null>(null);
  currentLng = signal<number | null>(null);
  isTracking = signal(false);

  /** Call from MainLayout — pass role + logout callback to avoid circular DI */
  startMonitoring(role: string, logoutFn: () => void): void {
    if (role !== 'Technician') return;
    if (this.watchId !== null) return;

    this._role = role;
    this._logoutFn = logoutFn;

    if (!navigator.geolocation) {
      this.handleLocationLost('Geolocation not supported');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.currentLat.set(pos.coords.latitude);
        this.currentLng.set(pos.coords.longitude);
        this.isTracking.set(true);
        localStorage.setItem('felix_last_lat', pos.coords.latitude.toString());
        localStorage.setItem('felix_last_lng', pos.coords.longitude.toString());
      },
      (err) => {
        console.warn('Location watch error:', err.message);
        this.handleLocationLost(err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    this.checkInterval = setInterval(() => this.checkPermission(), 10000);
  }

  stopMonitoring(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isTracking.set(false);
    this._logoutFn = null;
  }

  private async checkPermission(): Promise<void> {
    if (this._role !== 'Technician') return;

    try {
      if (navigator.permissions) {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (status.state === 'denied') {
          this.handleLocationLost('Location permission revoked');
        }
      }
    } catch {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => this.handleLocationLost('Location unavailable'),
        { timeout: 5000 }
      );
    }
  }

  private handleLocationLost(reason: string): void {
    console.warn('Location lost:', reason);
    this.stopMonitoring();

    sessionStorage.setItem('felix_location_logout', 'Location access was turned off. Please enable location to continue.');

    if (this._logoutFn) {
      this._logoutFn();
    } else {
      this.router.navigate(['/login']);
    }
  }
}
