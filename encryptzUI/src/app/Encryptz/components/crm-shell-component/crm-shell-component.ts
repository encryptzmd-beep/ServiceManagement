import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { CRM_REPORTS } from '../crm-reports-component/crm-reports';
import { CrmService } from '../../Services/crm-service';
import { DashboardStateService } from '../../Services/dashboard-state-service';
import { FooterComponent } from '../footer-component/footer-component';
import { HeaderComponent } from '../header-component/header-component';

/** One entry of the CRM side menu (CRM has no menus in the database: they are fixed here). */
interface CrmMenuItem { path: string; label: string; icon: string; }

/** The frame of the CRM pages: the Service Management header and footer, and a CRM side menu that looks like theirs. */
@Component({
  selector: 'app-crm-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HeaderComponent, FooterComponent],
  templateUrl: './crm-shell-component.html',
  styleUrl: './crm-shell-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmShellComponent {
  private crm = inject(CrmService);
  private router = inject(Router);
  readonly dash = inject(DashboardStateService);

  /** Settings (after the Reports group) is for managers only; the API says who is one. */
  isManager = signal(false);

  readonly menu: CrmMenuItem[] = [
    { path: '/crm/dashboard', label: 'Dashboard', icon: 'view_kanban' },
    { path: '/crm/leads', label: 'Leads', icon: 'contacts' },
    { path: '/crm/quotations', label: 'Quotations', icon: 'request_quote' },
  ];

  /** The Reports group: one sub-link per report, from the list the Reports page shares. */
  readonly reports = CRM_REPORTS;
  reportsOpen = signal(this.router.url.startsWith('/crm/reports'));
  reportsActive = signal(this.router.url.startsWith('/crm/reports'));

  constructor() {
    this.crm.me().subscribe({
      next: res => this.isManager.set(!!(res.success && res.data?.isManager)),
      error: () => this.isManager.set(false),
    });

    // on a phone the menu is a drawer over the page: close it once a page is chosen
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => {
        const under = this.router.url.startsWith('/crm/reports');
        this.reportsActive.set(under);
        if (under) this.reportsOpen.set(true);
        if (this.isPhone()) this.dash.closeSidebar();
      });
  }

  /** Header of the group; on the collapsed (icons only) menu it opens the menu and the group. */
  toggleReports(): void {
    if (!this.dash.sidebarOpen()) {
      this.dash.openSidebar();
      this.reportsOpen.set(true);
      return;
    }
    this.reportsOpen.update(v => !v);
  }

  private isPhone(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  backToWorkspace(): void {
    this.router.navigate(['/select-company']);
  }
}
