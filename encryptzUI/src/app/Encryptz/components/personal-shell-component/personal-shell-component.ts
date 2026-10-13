import { Component, inject, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';

/** One line of the side menu of a personal application. */
export interface PersonalMenuItem {
  label: string;
  icon: string;
  /** Where it opens. Left out for a page that is not built yet: it is shown as "Soon". */
  route?: string;
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
  imports: [RouterModule],
  template: `
    <header class="ps-bar">
      <div class="ps-bar-in">
        <a class="ps-back" routerLink="/select-company">
          <span class="material-icons">chevron_left</span> Back to companies
        </a>
        <div class="ps-app">
          <span class="ps-app-icon"><span class="material-icons">{{ icon() }}</span></span>
          <span class="ps-app-text">
            <span class="ps-app-name">{{ appName() }}</span>
            <span class="ps-app-sub">Personal application</span>
          </span>
        </div>
        <div class="ps-user">
          <span class="ps-user-name">{{ auth.userName() }}</span>
          @if (auth.currentUser()?.individualId; as id) {
            <span class="ps-user-id" title="Your lifelong ID on this platform">{{ id }}</span>
          }
        </div>
      </div>
    </header>
    <div class="ps-body" [class.with-nav]="menu().length">
      @if (menu().length) {
        <nav class="ps-nav" [attr.aria-label]="appName() + ' menu'">
          @for (item of menu(); track item.label) {
            @if (item.route) {
              <a class="ps-nav-item" [routerLink]="item.route" routerLinkActive="active">
                <span class="material-icons">{{ item.icon }}</span>
                <span class="ps-nav-label">{{ item.label }}</span>
              </a>
            } @else {
              <span class="ps-nav-item soon" aria-disabled="true" title="Not available yet">
                <span class="material-icons">{{ item.icon }}</span>
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
}
