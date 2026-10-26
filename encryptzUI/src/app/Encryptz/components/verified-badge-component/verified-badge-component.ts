import { Component, input } from '@angular/core';

/**
 * The Verified tick: Encryptz (the platform administrator) checked this job or this person.
 * `compact` shows the tick alone, next to a name; otherwise a small pill with the word.
 */
@Component({
  selector: 'app-verified-badge',
  standalone: true,
  templateUrl: './verified-badge-component.html',
  styleUrl: './verified-badge-component.scss',
})
export class VerifiedBadgeComponent {
  /** Who checked what, for the tooltip and for screen readers. */
  readonly hint = input('Verified by Encryptz');
  readonly label = input('Verified');
  readonly compact = input(false);
}
