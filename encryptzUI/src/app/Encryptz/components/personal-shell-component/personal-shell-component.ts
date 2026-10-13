import { Component, inject, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';

/**
 * The frame of a personal application: it works without a company, so there is no
 * sidebar and no company in the header. It shows which application this is, who is
 * logged in (with the Individual ID) and the way back to the companies.
 */
@Component({
  selector: 'app-personal-shell',
  standalone: true,
  imports: [RouterModule],
  template: `
    <header class="ps-bar">
      <a class="ps-back" routerLink="/select-company">
        <span class="material-icons">chevron_left</span> Back to companies
      </a>
      <div class="ps-app">
        <span class="material-icons">{{ icon() }}</span>
        <span class="ps-app-name">{{ appName() }}</span>
      </div>
      <div class="ps-user">
        <span class="ps-user-name">{{ auth.userName() }}</span>
        @if (auth.currentUser()?.individualId; as id) {
          <span class="ps-user-id" title="Your lifelong ID on this platform">{{ id }}</span>
        }
      </div>
    </header>
    <main class="ps-content">
      <ng-content />
    </main>
  `,
  styleUrl: './personal-shell-component.scss',
})
export class PersonalShellComponent {
  readonly auth = inject(AuthService);

  appName = input.required<string>();
  icon = input<string>('apps');
}
