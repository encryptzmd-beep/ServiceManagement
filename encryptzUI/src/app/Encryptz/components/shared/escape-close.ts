import { Directive, HostListener, OnDestroy, OnInit, inject, output } from '@angular/core';
import { DialogService } from '../../Services/dialog-service';

/** The overlays open now, the newest last: Escape closes only the one on top. */
const open: EscapeClose[] = [];

/**
 * Escape closes the dialog: put it on the overlay and say what closing means.
 *
 *   <div class="jp-overlay" (escapeClose)="closeForm()">
 *
 * Dialogs opened over another one (Reject over the applicant) close one at a time.
 */
@Directive({
  selector: '[escapeClose]',
  standalone: true,
})
export class EscapeClose implements OnInit, OnDestroy {
  readonly escapeClose = output<void>();
  private messages = inject(DialogService);

  ngOnInit(): void {
    open.push(this);
  }

  ngOnDestroy(): void {
    const i = open.indexOf(this);
    if (i >= 0) open.splice(i, 1);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    // a message box over the dialog closes first (it listens to Escape itself)
    if (open[open.length - 1] !== this || event.defaultPrevented || this.messages.state()) return;
    event.preventDefault();
    this.escapeClose.emit();
  }
}
