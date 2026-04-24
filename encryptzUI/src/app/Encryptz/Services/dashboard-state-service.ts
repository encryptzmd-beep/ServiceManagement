import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DashboardStateService {
  // Sidebar open/close state
  sidebarOpen = signal<boolean>(true);

  // Active tile key — shared between dashboard and any other component
  activeTileKey = signal<string | null>(null);

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  openSidebar(): void {
    this.sidebarOpen.set(true);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  setActiveTile(key: string | null): void {
    this.activeTileKey.set(key);
  }

  clearActiveTile(): void {
    this.activeTileKey.set(null);
  }
}
