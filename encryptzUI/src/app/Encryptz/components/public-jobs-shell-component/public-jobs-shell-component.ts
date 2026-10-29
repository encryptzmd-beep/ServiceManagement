import { Component, Injector, afterNextRender, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';

/**
 * The frame of the public job pages: the site header (jobs, sign in, create account) and
 * footer. Nobody needs to be logged in; nothing of the app's own frame is used. A person who
 * is signed in sees the way to Job Portal instead of Sign in (known only in the browser, so the
 * page the server renders is the same for everybody).
 */
@Component({
  selector: 'app-public-jobs-shell',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './public-jobs-shell-component.html',
  styleUrl: './public-jobs-shell-component.scss',
})
export class PublicJobsShellComponent {
  readonly year = new Date().getFullYear();
  readonly signedIn = signal(false);

  constructor() {
    const injector = inject(Injector);
    afterNextRender(() => {
      try { this.signedIn.set(!!injector.get(AuthService).isLoggedIn()); } catch { /* stays signed out */ }
    });
  }
}
