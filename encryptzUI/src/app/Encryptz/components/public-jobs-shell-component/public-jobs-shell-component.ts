import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

/**
 * The frame of the public job pages: the site header (jobs, sign in, create account) and
 * footer. Nobody needs to be logged in; nothing of the app's own frame is used.
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
}
