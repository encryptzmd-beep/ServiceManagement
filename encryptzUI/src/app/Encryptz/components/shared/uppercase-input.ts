import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/** Keeps what is typed in capitals, before the form reads it. The API converts these names again on save. */
@Directive({ selector: 'input[appUppercase]', standalone: true })
export class UppercaseInputDirective {
  constructor() {
    const el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
    const toUpper = (event: Event) => {
      if ((event as InputEvent).isComposing) return;
      const upper = el.value.toUpperCase();
      if (upper === el.value) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = upper;
      if (start !== null && end !== null) el.setSelectionRange(start, end);
    };
    // the capture phase runs before the listener of ngModel on the same input
    el.addEventListener('input', toUpper, true);
    inject(DestroyRef).onDestroy(() => el.removeEventListener('input', toUpper, true));
  }
}
