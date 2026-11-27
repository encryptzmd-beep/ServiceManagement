import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError, map } from 'rxjs';
import { CustomerMatch } from '../../../Models/ApiModels';
import { ApiService } from '../../../Services/API/api-service';

/** Enough of a mobile (10 digits) or a GSTIN (15 characters) to look for the same party. */
export function worthChecking(mobile: string | null | undefined, gstin: string | null | undefined): boolean {
  const digits = (mobile ?? '').replace(/\D/g, '');
  return digits.length >= 10 || (gstin ?? '').replace(/\s/g, '').length === 15;
}

/**
 * Shown while a new customer is typed: the customers that are already the same party (same mobile or same GSTIN),
 * each with "Use this customer", so no second record is made for one party.
 */
@Component({
  selector: 'app-customer-match-warning',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (matches().length) {
      <div class="cm-warn" role="alert">
        <p class="cm-title"><span class="material-icons" aria-hidden="true">warning_amber</span>
          {{ matches().length === 1 ? 'This customer already exists' : 'These customers already exist' }}. Use the existing record instead of making a new one.</p>
        <ul>
          @for (m of matches(); track m.customerId) {
            <li>
              <span><strong>{{ m.customerName }}</strong> · {{ m.mobileNumber }}@if (m.gstin) { · GSTIN {{ m.gstin }} }@if (m.city) { · {{ m.city }} }
                <em>same {{ m.matchedOn === 'GSTIN' ? 'GSTIN' : 'mobile' }}</em></span>
              <button type="button" class="cm-use" (click)="use.emit(m)">Use this customer</button>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .cm-warn { margin: 10px 0; padding: 10px 12px; border: 1px solid #f0c36d; border-radius: 10px; background: #fff8e6; color: #6b4a00; font-size: 13px; }
    .cm-title { margin: 0 0 6px; display: flex; align-items: center; gap: 6px; font-weight: 600; }
    .cm-title .material-icons { font-size: 18px; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    li { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    em { font-style: normal; font-size: 11.5px; color: #8a6a1f; margin-left: 4px; }
    .cm-use { min-height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid #1B4A7A; background: #1B4A7A; color: #fff; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
    .cm-use:focus-visible { outline: 2px solid #1B4A7A; outline-offset: 2px; }
  `],
})
export class CustomerMatchWarningComponent {
  private api = inject(ApiService);

  mobile = input<string | null | undefined>('');
  gstin = input<string | null | undefined>('');
  /** The customer being edited, left out of its own matches. */
  excludeId = input<number | null | undefined>(null);
  use = output<CustomerMatch>();

  matches = signal<CustomerMatch[]>([]);
  private ask$ = new Subject<string>();

  constructor() {
    this.ask$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(key => {
        const [mobile, gstin, exclude] = JSON.parse(key) as [string, string, number | null];
        if (!worthChecking(mobile, gstin)) return of([] as CustomerMatch[]);
        return this.api.customerMatches(mobile, gstin, exclude).pipe(map(r => r?.data ?? []), catchError(() => of([] as CustomerMatch[])));
      }),
      takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe(list => this.matches.set(list));

    effect(() => {
      const key = JSON.stringify([this.mobile() ?? '', this.gstin() ?? '', this.excludeId() ?? null]);
      untracked(() => this.ask$.next(key));
    });
  }
}
