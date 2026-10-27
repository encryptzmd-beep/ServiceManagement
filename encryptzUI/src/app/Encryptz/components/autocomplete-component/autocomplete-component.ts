import { Component, ElementRef, HostListener, computed, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** One choice: what is stored, what is shown, and a second line (a city, a count...). */
export interface AutocompleteOption<T = unknown> {
  value: T;
  label: string;
  sub?: string;
}

let nextId = 0;

/**
 * A choice out of a long list (jobs, clients): type to narrow it, then pick with the mouse or
 * the arrow keys and Enter. Used like a select, with [(ngModel)]: the value is the value of an
 * option, or null. Every word typed must be in the label or the second line (any order, any
 * case). At most 50 choices are shown at a time, so a list of thousands stays quick.
 */
@Component({
  selector: 'app-autocomplete',
  standalone: true,
  templateUrl: './autocomplete-component.html',
  styleUrl: './autocomplete-component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AutocompleteComponent), multi: true }],
})
export class AutocompleteComponent<T = unknown> implements ControlValueAccessor {
  private host = inject(ElementRef<HTMLElement>);

  readonly options = input<AutocompleteOption<T>[]>([]);
  readonly placeholder = input('Type to search');
  /** A choice for "nothing" (null), e.g. "No client"; none when empty. */
  readonly noneLabel = input('');
  readonly emptyText = input('Nothing matches');
  /** The text for screen readers, when there is no visible label around it. */
  readonly ariaLabel = input<string | null>(null);

  static readonly SHOWN = 50;

  readonly id = `ac-${++nextId}`;
  value = signal<T | null>(null);
  query = signal('');
  open = signal(false);
  active = signal(0);
  disabled = signal(false);

  private input = viewChild<ElementRef<HTMLInputElement>>('field');
  private onChange: (v: T | null) => void = () => {};
  private onTouched: () => void = () => {};

  /** The option chosen now, if any. */
  readonly chosen = computed(() => this.options().find(o => this.same(o.value, this.value())) ?? null);

  /** What the list shows: the matches of what is typed (all of it when nothing is typed). */
  readonly matches = computed(() => {
    const words = this.query().toLowerCase().split(/\s+/).filter(Boolean);
    const all = this.options();
    const found = words.length
      ? all.filter(o => { const text = `${o.label} ${o.sub ?? ''}`.toLowerCase(); return words.every(w => text.includes(w)); })
      : all;
    return { shown: found.slice(0, AutocompleteComponent.SHOWN), more: Math.max(0, found.length - AutocompleteComponent.SHOWN) };
  });

  /** The rows of the list: "nothing" first (when it is a choice and nothing is typed), then the matches. */
  readonly rows = computed(() => {
    const none = this.noneLabel() && !this.query().trim() ? [{ value: null as T | null, label: this.noneLabel(), sub: '', none: true }] : [];
    return [...none, ...this.matches().shown.map(o => ({ ...o, none: false }))];
  });

  /** In the field: what is being typed, else the label of the choice. */
  readonly shownText = computed(() => (this.open() ? this.query() : this.chosen()?.label ?? ''));

  // ── ControlValueAccessor ──────────────────────────────────────────────────

  writeValue(v: T | null): void { this.value.set(v ?? null); }
  registerOnChange(fn: (v: T | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled.set(disabled); }

  // ── using it ──────────────────────────────────────────────────────────────

  openList(): void {
    if (this.disabled() || this.open()) return;
    this.query.set('');
    this.open.set(true);
    const at = this.rows().findIndex(r => this.same(r.value, this.value()));
    this.active.set(Math.max(0, at));
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.query.set('');
    this.onTouched();
  }

  typed(text: string): void {
    this.query.set(text);
    this.open.set(true);
    this.active.set(0);
  }

  pick(value: T | null): void {
    this.value.set(value);
    this.onChange(value);
    this.close();
  }

  clear(event: Event): void {
    event.stopPropagation();
    this.pick(null);
    this.input()?.nativeElement.focus();
  }

  onKey(event: KeyboardEvent): void {
    const rows = this.rows();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) { this.openList(); return; }
        this.active.set(Math.min(rows.length - 1, this.active() + 1));
        this.scrollToActive();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(Math.max(0, this.active() - 1));
        this.scrollToActive();
        break;
      case 'Enter':
        if (!this.open()) return;
        event.preventDefault();
        if (rows[this.active()]) this.pick(rows[this.active()].value);
        break;
      case 'Escape':
        if (this.open()) { event.preventDefault(); event.stopPropagation(); this.close(); }
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onOutside(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  private scrollToActive(): void {
    setTimeout(() => this.host.nativeElement.querySelector(`#${this.id}-opt-${this.active()}`)?.scrollIntoView({ block: 'nearest' }));
  }

  private same(a: unknown, b: unknown): boolean {
    return a === b || (a == null && b == null);
  }
}
