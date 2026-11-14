import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Brings the element into view whenever the given value changes to something.
 * Put it on the error line of a dialog: the line sits at the end of a scrollable body,
 * so without it a refused Save looks as if nothing happened.
 *
 *   @if (formError()) { <div class="jp-error" [scrollIntoViewOn]="formError()">{{ formError() }}</div> }
 */
@Directive({
  selector: '[scrollIntoViewOn]',
  standalone: true,
  host: { role: 'alert' },
})
export class ScrollIntoViewOn {
  readonly scrollIntoViewOn = input<unknown>();
  private readonly el = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      if (!this.scrollIntoViewOn()) return;
      // after the line is laid out
      requestAnimationFrame(() => this.el.nativeElement.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
    });
  }
}
