import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, output } from '@angular/core';
import { ToastItem, ToastKind, ToastService } from '../../Services/toast-service';

/** Declares a toast from a page. It draws nothing here: <app-toast-host> shows it. */
@Component({
  selector: 'app-toast',
  template: '',
  styles: [':host { display: none; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppToastComponent implements OnDestroy {
  private readonly toasts = inject(ToastService);
  private readonly id = this.toasts.newId();

  readonly text = input<string | null | undefined>('');
  readonly kind = input<ToastKind | string>('success');
  readonly title = input<string | undefined>(undefined);
  readonly meta = input<string | undefined>(undefined);
  readonly icon = input<string | undefined>(undefined);
  readonly clickable = input(false);
  readonly closed = output<void>();
  readonly opened = output<void>();

  constructor() {
    effect(() => {
      const text = this.text() ?? '';
      const title = this.title();
      if (!text && !title) {
        this.toasts.remove(this.id);
        return;
      }
      const kind = this.kind();
      this.toasts.put({
        id: this.id,
        kind: kind === 'error' || kind === 'warning' || kind === 'info' ? kind : 'success',
        text,
        title,
        meta: this.meta(),
        icon: this.icon(),
        onClose: () => this.closed.emit(),
        onOpen: this.clickable() ? () => this.opened.emit() : undefined,
      });
    });
  }

  ngOnDestroy(): void {
    this.toasts.remove(this.id);
  }
}

/** The one place toasts appear. Placed once in the root template. */
@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toast-host" role="status" aria-live="polite">
      @for (t of toasts.items(); track t.id) {
        <div class="toast-card" [class]="'is-' + t.kind">
          <span class="material-icons toast-icon" aria-hidden="true">{{ iconOf(t) }}</span>
          @if (t.onOpen) {
            <button type="button" class="toast-copy toast-link" (click)="toasts.open(t.id)">
              @if (t.meta) { <span class="toast-meta">{{ t.meta }}</span> }
              @if (t.title) { <strong>{{ t.title }}</strong> }
              @if (t.text) { <span>{{ t.text }}</span> }
            </button>
          } @else {
            <div class="toast-copy">
              @if (t.meta) { <span class="toast-meta">{{ t.meta }}</span> }
              @if (t.title) { <strong>{{ t.title }}</strong> }
              @if (t.text) { <span>{{ t.text }}</span> }
            </div>
          }
          <button type="button" class="toast-close" aria-label="Close message" (click)="toasts.close(t.id)">
            <span class="material-icons" aria-hidden="true">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-host {
      position: fixed; top: 64px; right: 20px; z-index: 4000;
      display: flex; flex-direction: column; gap: 8px;
      width: 360px; max-width: calc(100vw - 24px); pointer-events: none;
    }
    .toast-card {
      display: flex; align-items: flex-start; gap: 10px; padding: 11px 8px 11px 13px;
      background: #fff; color: #1a2332; border: 1px solid #e2e8f0; border-radius: 8px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.14); pointer-events: auto;
      animation: toastIn 0.16s ease-out;
    }
    .toast-icon { flex: 0 0 20px; font-size: 20px; line-height: 20px; }
    .is-success .toast-icon { color: #2d7a38; }
    .is-error .toast-icon { color: #D42B2B; }
    .is-warning .toast-icon { color: #b7791f; }
    .is-info .toast-icon { color: #1B4A7A; }
    .toast-copy {
      flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;
      font-size: 13.5px; line-height: 20px; overflow-wrap: anywhere;
    }
    .toast-copy strong { font-weight: 600; }
    .toast-meta { font-size: 11px; line-height: 15px; font-weight: 500; color: #64748b; }
    .toast-link { padding: 0; border: none; background: none; color: inherit; font-family: inherit; text-align: left; cursor: pointer; }
    .toast-close {
      flex: 0 0 24px; width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
      border: none; border-radius: 6px; background: none; color: #64748b; cursor: pointer;
      .material-icons { font-size: 16px; }
      &:hover { background: #f1f5f9; }
    }
    @keyframes toastIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    @media (max-width: 640px) { .toast-host { top: 60px; left: 12px; right: 12px; width: auto; max-width: none; } }
    @media print { .toast-host { display: none; } }
  `],
})
export class AppToastHostComponent {
  readonly toasts = inject(ToastService);

  iconOf(t: ToastItem): string {
    if (t.icon) return t.icon;
    return t.kind === 'error' ? 'error' : t.kind === 'warning' ? 'warning' : t.kind === 'info' ? 'info' : 'check_circle';
  }
}
