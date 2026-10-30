import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { NotificationBellComponent } from '../notification-bell-component/notification-bell-component';
import { WalletChipComponent } from '../wallet-chip-component/wallet-chip-component';
import { MessageAlertsService } from '../../Services/message-alerts-service';
import { MessageSide } from '../../Services/messages-service';

/** The Messages page of each side: its menu line gets the number of unread messages. */
const MESSAGE_PAGES: Record<string, MessageSide> = { '/apps/jobs/messages': 'person', '/consultancy/messages': 'company' };

/** One line of the side menu of a personal application. */
export interface PersonalMenuItem {
  label: string;
  icon: string;
  /** Where it opens. Left out for a page that is not built yet: it is shown as "Soon". */
  route?: string;
  /** Marked as the current page only on exactly this address (for the first page of an application). */
  exact?: boolean;
  /** A number beside it, for example unread notifications (nothing is shown for 0). */
  badge?: number;
}

/**
 * The frame of a personal application: it works without a company, so the header has
 * no company and the side menu holds the pages of this application only. It shows
 * which application this is, who is logged in (with the Individual ID) and the way
 * back to the companies.
 */
@Component({
  selector: 'app-personal-shell',
  standalone: true,
  imports: [RouterModule, NotificationBellComponent, WalletChipComponent],
  template: `
    <header class="ps-bar">
      <div class="ps-bar-in">
        <a class="ps-back" [routerLink]="backRoute()" [attr.aria-label]="backLabel()">
          <span class="material-icons" aria-hidden="true">chevron_left</span><span class="ps-back-label">{{ backLabel() }}</span>
        </a>
        <div class="ps-app">
          <span class="ps-app-icon" aria-hidden="true"><span class="material-icons">{{ icon() }}</span></span>
          <span class="ps-app-text">
            <span class="ps-app-name">{{ appName() }}</span>
            <span class="ps-app-sub" [title]="companyName() ? 'You are working in ' + companyName() : ''">{{ shownSubtitle() }}</span>
          </span>
        </div>
        <app-wallet-chip />
        <app-notification-bell />
        <div class="ps-user">
          <span class="ps-user-text">
            <span class="ps-user-name">{{ auth.userName() }}</span>
            @if (auth.currentUser()?.individualId; as id) {
              <span class="ps-user-id" title="Your lifelong ID on this platform. Give it to a company that wants to add you.">{{ id }}</span>
            }
          </span>
          @if (initials(); as letters) { <span class="ps-user-pic" aria-hidden="true">{{ letters }}</span> }
        </div>
      </div>
    </header>
    <div class="ps-body" [class.with-nav]="menu().length">
      @if (menu().length) {
        <nav class="ps-nav" [attr.aria-label]="appName() + ' menu'">
          @for (item of shownMenu(); track item.label) {
            @if (item.route) {
              <a class="ps-nav-item" [routerLink]="item.route" routerLinkActive="active"
                 [routerLinkActiveOptions]="{ exact: !!item.exact }">
                <span class="material-icons" aria-hidden="true">{{ item.icon }}</span>
                <span class="ps-nav-label">{{ item.label }}</span>
                @if (item.badge) {
                  <span class="ps-nav-badge" [attr.aria-label]="item.badge + ' unread'">{{ item.badge > 99 ? '99+' : item.badge }}</span>
                }
              </a>
            } @else {
              <span class="ps-nav-item soon" aria-disabled="true" title="Not available yet">
                <span class="material-icons" aria-hidden="true">{{ item.icon }}</span>
                <span class="ps-nav-label">{{ item.label }}</span>
                <span class="ps-nav-soon">Soon</span>
              </span>
            }
          }
        </nav>
      }
      <main class="ps-content">
        <ng-content />
      </main>
    </div>
  `,
  styleUrl: './personal-shell-component.scss',
})
export class PersonalShellComponent {
  readonly auth = inject(AuthService);

  appName = input.required<string>();
  icon = input<string>('apps');
  menu = input<PersonalMenuItem[]>([]);
  subtitle = input<string>('Personal application');
  backLabel = input<string>('Back to companies');
  backRoute = input<string>('/select-company');

  private messageAlerts = inject(MessageAlertsService);

  /**
   * The company a commercial application works in (QA BUG-019: nothing in the header said which
   * company the data is saved to). Empty in a personal application or without a company.
   */
  readonly companyName = computed(() => {
    if (this.backRoute() !== '/select-module' && this.subtitle() !== 'Commercial application') return '';
    const id = this.auth.selectedCompanyId?.();
    return (id && this.auth.companies?.().find(c => c.companyId === id)?.companyName?.trim()) || '';
  });

  readonly shownSubtitle = computed(() => this.companyName() || this.subtitle());

  /** The menu as given, with the number of unread messages beside "Messages". */
  readonly shownMenu = computed(() => this.menu().map(item => {
    const side = item.route ? MESSAGE_PAGES[item.route] : undefined;
    return side && !item.badge ? { ...item, badge: this.messageAlerts.unread[side]() } : item;
  }));

  constructor() {
    // a menu with Messages: its number is read when the page opens
    effect(() => {
      const sides = new Set(this.menu().map(i => (i.route ? MESSAGE_PAGES[i.route] : undefined)).filter((s): s is MessageSide => !!s));
      untracked(() => sides.forEach(side => this.messageAlerts.watch(side)));
    });
  }

  /** The first letters of the first two words of the name, for the picture place. */
  initials(): string {
    return (this.auth.userName() ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(word => Array.from(word)[0].toUpperCase()).join('');
  }
}
