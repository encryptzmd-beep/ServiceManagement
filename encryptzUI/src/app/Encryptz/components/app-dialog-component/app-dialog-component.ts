import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../Services/dialog-service';

/** The in-app alert / confirm box driven by DialogService. Placed once in app.html. */
@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (dialog.state(); as d) {
      <div class="dlg-overlay" (click)="onOverlay(d.mode)">
        <div class="dlg" [class]="'dlg kind-' + (d.kind || 'info')" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="dlg-icon">
            <span class="material-icons">{{ icon(d.kind) }}</span>
          </div>
          <div class="dlg-body">
            <div class="dlg-title">{{ d.title || defaultTitle(d.kind, d.mode) }}</div>
            <div class="dlg-message">{{ d.message }}</div>
          </div>
          <div class="dlg-actions">
            @if (d.mode === 'confirm') {
              <button type="button" class="dlg-btn secondary" (click)="dialog.close(false)">{{ d.cancelText || 'No' }}</button>
            }
            <button type="button" class="dlg-btn primary" #okBtn (click)="dialog.close(true)" autofocus>{{ d.okText || 'OK' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dlg-overlay { position: fixed; inset: 0; z-index: 3000; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; padding: 16px; animation: dlgFade 0.12s ease; }
    .dlg { width: 100%; max-width: 440px; background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28); padding: 22px 22px 16px; display: grid; grid-template-columns: 44px 1fr; gap: 6px 14px; animation: dlgPop 0.15s ease; }
    .dlg-icon { grid-row: 1 / span 1; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #e8eef5; color: #1B4A7A; }
    .dlg-icon .material-icons { font-size: 26px; }
    .kind-success .dlg-icon { background: #edf7ee; color: #2d7a38; }
    .kind-warning .dlg-icon { background: #fff4e0; color: #b26a00; }
    .kind-danger  .dlg-icon { background: #f9e8e8; color: #D42B2B; }
    .dlg-body { min-width: 0; }
    .dlg-title { font-size: 16px; font-weight: 600; color: #1a2332; margin-bottom: 4px; }
    .dlg-message { font-size: 13.5px; color: #5a6a7e; line-height: 1.5; white-space: pre-line; word-break: break-word; }
    .dlg-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
    .dlg-btn { border-radius: 10px; padding: 9px 18px; font-size: 13.5px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: background 0.15s; font-family: inherit; }
    .dlg-btn.secondary { background: #fff; color: #334155; border-color: #e2e8f0; }
    .dlg-btn.secondary:hover { background: #f5f7fa; }
    .dlg-btn.primary { background: #1B4A7A; color: #fff; }
    .dlg-btn.primary:hover { background: #163a60; }
    .kind-danger .dlg-btn.primary { background: #D42B2B; }
    .kind-danger .dlg-btn.primary:hover { background: #b82424; }
    @keyframes dlgFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dlgPop { from { transform: translateY(8px) scale(0.98); opacity: 0; } to { transform: none; opacity: 1; } }
  `],
})
export class AppDialogComponent {
  readonly dialog = inject(DialogService);

  icon(kind?: string): string {
    switch (kind) {
      case 'success': return 'check_circle';
      case 'warning': return 'help_outline';
      case 'danger': return 'warning_amber';
      default: return 'info';
    }
  }

  defaultTitle(kind: string | undefined, mode: 'alert' | 'confirm'): string {
    if (mode === 'confirm') return kind === 'danger' ? 'Please confirm' : 'Are you sure?';
    switch (kind) {
      case 'success': return 'Done';
      case 'warning': return 'Attention';
      case 'danger': return 'Something went wrong';
      default: return 'Information';
    }
  }

  /** clicking outside: an alert closes, a confirm counts as "No" */
  onOverlay(mode: 'alert' | 'confirm'): void { this.dialog.close(mode === 'alert'); }

  @HostListener('document:keydown.escape')
  onEscape(): void { const d = this.dialog.state(); if (d) this.dialog.close(d.mode === 'alert'); }

  @HostListener('document:keydown.enter')
  onEnter(): void { if (this.dialog.state()) this.dialog.close(true); }
}
