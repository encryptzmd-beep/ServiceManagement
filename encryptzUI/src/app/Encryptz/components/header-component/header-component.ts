import { Component, DestroyRef, OnInit, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationBellComponent } from '../notification-bell-component/notification-bell-component';
import { WalletChipComponent } from '../wallet-chip-component/wallet-chip-component';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { ModuleDto } from '../../Models/ApiModels';
import { moduleLanding, moduleRoute } from '../shared/module-route';
import { branchDecision } from '../../Auth/scope-flow';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, NotificationBellComponent, WalletChipComponent],
  templateUrl: './header-component.html',
  styleUrls: ['./header-component.scss'],
})
export class HeaderComponent implements OnInit {
  auth = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  toggleSidebar = output<void>();
  showDropdown = false;

  /** The module switcher: the company's modules (read once), and whether its menu is open. */
  modules = signal<ModuleDto[] | null>(null);
  modulesError = signal('');
  moduleMenuOpen = signal(false);

  /** The module the session works in, by name ('' before the list is read). */
  readonly currentModule = computed(() => {
    const key = (this.auth.selectedModuleKey() || '').toUpperCase();
    return this.modules()?.find(m => m.moduleKey.toUpperCase() === key) ?? null;
  });

  ngOnInit(): void {
    if (this.auth.selectedCompanyId()) this.loadModules();
  }

  private loadModules(): void {
    this.modulesError.set('');
    this.auth.getModules().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        if (res.success) this.modules.set((res.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
        else { this.modules.set([]); this.modulesError.set(res.message || 'Could not load the modules'); }
      },
      error: () => { this.modules.set([]); this.modulesError.set('Could not load the modules'); },
    });
  }

  toggleModuleMenu(event: Event): void {
    event.stopPropagation();
    this.showDropdown = false;
    this.moduleMenuOpen.update(v => !v);
    if (this.moduleMenuOpen() && (this.modules() === null || this.modulesError())) this.loadModules();
  }

  closeModuleMenu(): void { this.moduleMenuOpen.set(false); }

  isCurrent(m: ModuleDto): boolean {
    return m.moduleKey.toUpperCase() === (this.auth.selectedModuleKey() || '').toUpperCase();
  }

  /** The module being opened (its menu item shows "Opening…"), and why it could not be. */
  switching = signal<string | null>(null);
  switchError = signal('');

  /**
   * Opens another module without showing the branch step when there is nothing to choose:
   * a module with no branch opens its first page; one branch is entered here at once; only
   * several branches (or none, which the branch step explains) go to the branch step.
   */
  switchTo(m: ModuleDto): void {
    if (m.state !== 'Available' || this.switching()) return;
    if (this.isCurrent(m)) { this.moduleMenuOpen.set(false); return; }

    const to = moduleRoute(m);
    const toBranchStep = () => {
      this.switching.set(null);
      this.moduleMenuOpen.set(false);
      this.router.navigate(to.commands, to.queryParams ? { queryParams: to.queryParams } : undefined);
    };
    if (!to.queryParams) { toBranchStep(); return; }   // a module without branches

    this.switching.set(m.moduleKey);
    this.switchError.set('');
    this.auth.getBranches(m.moduleKey).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        const list = res.success ? res.data ?? [] : [];
        if (branchDecision(list.length) !== 'auto') { toBranchStep(); return; }
        const b = list[0];
        this.auth.setScope(m.moduleKey, b.locationId, b.locationName).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: s => {
            if (!s.success || !s.data) { this.switching.set(null); this.switchError.set(s.message || 'Could not open ' + m.moduleName); return; }
            this.switching.set(null);
            this.moduleMenuOpen.set(false);
            this.router.navigate([moduleLanding(m.moduleKey, s.data.role)]);
          },
          error: () => { this.switching.set(null); this.switchError.set('Could not open ' + m.moduleName + '. Please try again.'); },
        });
      },
      error: () => toBranchStep(),   // the branch step reads them again and explains a failure
    });
  }

  /** What a module that cannot be opened says instead. */
  stateLabel(m: ModuleDto): string {
    switch (m.state) {
      case 'Available': return '';
      case 'ComingSoon': return 'Coming soon';
      case 'NoAccess': return 'No access';
      default: return 'Not subscribed';
    }
  }

  get initials(): string {
    const name = this.auth.userName();
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  /** Name of the selected company, as stored in the main database. */
  private get selectedCompanyName(): string {
    const fromLogin = this.auth.currentUser()?.companyName;
    if (fromLogin) return fromLogin.trim();

    const companyId = this.auth.selectedCompanyId();
    return this.auth.companies().find(c => c.companyId === companyId)?.companyName?.trim() ?? '';
  }

  /** First word of the company name (the rest is shown in the accent colour). */
  get companyName(): string {
    return this.selectedCompanyName.split(' ')[0] || 'Encryptz';
  }

  get companySuffix(): string {
    const name = this.selectedCompanyName;
    if (!name) return 'ERP';

    return name.split(' ').slice(1).join(' ');
  }

  /** Branch the session works in ('' before one is chosen). */
  get branchName(): string {
    return this.auth.selectedLocationName();
  }
}
