import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocationMonitorService {
  private watchId: number | null = null;
  private checkInterval: any = null;
  private _role = '';

  currentLat = signal<number | null>(null);
  currentLng = signal<number | null>(null);
  isTracking = signal(false);

  /** Call from MainLayout — pass role + logout callback to avoid circular DI */
  startMonitoring(role: string, _logoutFn?: () => void): void {
    if (role !== 'Technician') return;
    if (this.watchId !== null) return;

    this._role = role;

    if (!navigator.geolocation) return; // No GPS — skip silently, don't logout

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.currentLat.set(pos.coords.latitude);
        this.currentLng.set(pos.coords.longitude);
        this.isTracking.set(true);
        localStorage.setItem('felix_last_lat', pos.coords.latitude.toString());
        localStorage.setItem('felix_last_lng', pos.coords.longitude.toString());
      },
      (err) => {
        // Temporary GPS loss — mark as not tracking but keep session alive
        console.warn('Location watch error:', err.message);
        this.isTracking.set(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    this.checkInterval = setInterval(() => this.checkPermission(), 30000);
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
  }

  private async checkPermission(): Promise<void> {
    if (this._role !== 'Technician') return;

    try {
      if (navigator.permissions) {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (status.state === 'denied') {
          // Permission denied — stop tracking but do NOT logout the user
          console.warn('GPS permission denied, stopping location tracking');
          this.stopMonitoring();
        }
      }
    } catch {
      // Can't query permission — continue silently
    }
  }
}
