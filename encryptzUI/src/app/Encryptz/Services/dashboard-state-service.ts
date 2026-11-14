import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DashboardStateService {
  // Sidebar open/close state
  // closed on a phone (768px and less): there the sidebar is a drawer over the page (QA BUG-032)
  sidebarOpen = signal<boolean>(typeof window === 'undefined' || window.innerWidth > 768);

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
