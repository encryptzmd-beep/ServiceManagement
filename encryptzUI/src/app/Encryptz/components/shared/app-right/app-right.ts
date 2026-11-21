import { DestroyRef, Directive, ElementRef, booleanAttribute, computed, effect, inject, input } from '@angular/core';
import { RightKind, RightsService } from '../../../Services/rights-service';

const NO_RIGHT = 'You do not have permission for this. Ask your administrator.';

/**
 * Disables a button or link the signed-in person has no right for:
 *   <button appRight="delete" appRightMenu="/products">
 * It stops the click itself, so it works beside any [disabled] of the page. The API checks again.
 */
@Directive({ selector: '[appRight]', standalone: true })
export class AppRightDirective {
  private rights = inject(RightsService);
  private el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  appRight = input.required<RightKind>();
  appRightMenu = input.required<string>();
  /** A technician's own field work. */
  appRightTech = input(false, { transform: booleanAttribute });
  /** The check does not apply here (a screen shared with Job Portal). */
  appRightOff = input(false);

  readonly allowed = computed(() => this.appRightOff() || this.rights.can(this.appRight(), this.appRightMenu(), this.appRightTech()));

  private title: string | null = null;

  private readonly stop = (event: Event) => {
    if (this.allowed()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  constructor() {
    this.el.addEventListener('click', this.stop, true);
    inject(DestroyRef).onDestroy(() => this.el.removeEventListener('click', this.stop, true));

    effect(() => {
      const ok = this.allowed();
      this.el.classList.toggle('no-right', !ok);
      if (ok) {
        this.el.removeAttribute('aria-disabled');
        if (this.title !== null) { this.el.setAttribute('title', this.title); this.title = null; }
        else if (this.el.getAttribute('title') === NO_RIGHT) this.el.removeAttribute('title');
      } else {
        this.el.setAttribute('aria-disabled', 'true');
        if (this.el.getAttribute('title') !== NO_RIGHT) { this.title = this.el.getAttribute('title'); this.el.setAttribute('title', NO_RIGHT); }
      }
    });
  }
}
