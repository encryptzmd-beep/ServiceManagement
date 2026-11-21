import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { DashboardStateService } from '../../Services/dashboard-state-service';
import { MessageAlertsService } from '../../Services/message-alerts-service';
import { FooterComponent } from '../footer-component/footer-component';
import { HeaderComponent } from '../header-component/header-component';
import { CONSULTANCY_MENU } from '../personal-shell-component/consultancy-menu';

/** "Our candidates" is opened from the Candidates page, so Candidates stays marked there. */
const ALSO_ACTIVE: Record<string, string> = { '/consultancy/candidates': '/consultancy/our-candidates' };

/** The frame of the Job Consultancy pages: the header, footer and side menu of the CRM module. */
@Component({
  selector: 'app-consultancy-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, HeaderComponent, FooterComponent],
  templateUrl: './consultancy-shell-component.html',
  styleUrls: ['../crm-shell-component/crm-shell-component.scss', './consultancy-shell-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultancyShellComponent {
  private router = inject(Router);
  private alerts = inject(MessageAlertsService);
  readonly dash = inject(DashboardStateService);

  private url = signal(this.path());

  /** The menu, with the number of unread messages beside Messages. */
  readonly menu = computed(() => CONSULTANCY_MENU.map(item => ({
    ...item,
    badge: item.route === '/consultancy/messages' ? this.alerts.unread.company() : 0,
  })));

  constructor() {
    this.alerts.watch('company');

    // on a phone the menu is a drawer over the page: close it once a page is chosen
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => {
        this.url.set(this.path());
        if (typeof window !== 'undefined' && window.innerWidth <= 768) this.dash.closeSidebar();
      });
  }

  isActive(route: string | undefined): boolean {
    if (!route) return false;
    const url = this.url();
    const under = (base: string) => url === base || url.startsWith(base + '/');
    return under(route) || (!!ALSO_ACTIVE[route] && under(ALSO_ACTIVE[route]));
  }

  private path(): string {
    return this.router.url.split(/[?#]/, 1)[0];
  }
}
