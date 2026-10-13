import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../Auth/auth-service';

export type PlatformTab = 'companies' | 'projects' | 'locations' | 'branchAccess' | 'access' | 'menus' | 'servers' | 'settings';

export interface PlatformSection {
  tab: PlatformTab;
  label: string;
  icon: string;
}

/**
 * Sections of Platform Admin a platform administrator works in, in the order they are
 * listed. Branches and branch access belong to a company: its administrator manages
 * them from inside the company (tabs 'locations' and 'branchAccess').
 */
export const PLATFORM_SECTIONS: PlatformSection[] = [
  { tab: 'companies', label: 'Companies', icon: 'apartment' },
  { tab: 'projects', label: 'Company Databases', icon: 'storage' },
  { tab: 'access', label: 'Module Access', icon: 'apps' },
  { tab: 'servers', label: 'Database Servers', icon: 'dns' },
  { tab: 'settings', label: 'Settings', icon: 'tune' },
  { tab: 'menus', label: 'Menus', icon: 'menu_book' },
];

/**
 * The section of Platform Admin that is open. A platform administrator who works
 * without a company has no menus of a company: the sidebar lists the sections instead
 * and the screen hides its own tabs.
 */
@Injectable({ providedIn: 'root' })
export class PlatformNavService {
  private auth = inject(AuthService);

  tab = signal<PlatformTab>('companies');

  inSidebar = computed(() => !!this.auth.currentUser()?.isPlatformAdmin && !this.auth.selectedCompanyId?.());
}
