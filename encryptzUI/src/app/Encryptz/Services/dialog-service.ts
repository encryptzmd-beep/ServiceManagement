import { Injectable, signal } from '@angular/core';

export type DialogKind = 'info' | 'success' | 'warning' | 'danger';

export interface DialogOptions {
  /** heading; defaults by kind */
  title?: string;
  message: string;
  kind?: DialogKind;
  /** label of the primary button */
  okText?: string;
  /** label of the secondary button; only used by confirm() */
  cancelText?: string;
}

interface DialogState extends DialogOptions {
  mode: 'alert' | 'confirm';
  resolve: (value: boolean) => void;
}

/**
 * In-app replacement for the browser's alert() / confirm() boxes.
 *   await this.dialog.confirm({ message: 'Delete this bill?', kind: 'danger', okText: 'Delete' })
 *   this.dialog.alert('Saved');                          // fire-and-forget
 *   this.dialog.alert({ message: 'Failed', kind: 'danger' })
 * The box itself is <app-dialog>, placed once in the root template.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly state = signal<DialogState | null>(null);
  private queue: DialogState[] = [];

  confirm(options: DialogOptions | string): Promise<boolean> {
    const o = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>(resolve => this.push({ kind: 'warning', okText: 'Yes', cancelText: 'No', ...o, mode: 'confirm', resolve }));
  }

  alert(options: DialogOptions | string): Promise<void> {
    const o = typeof options === 'string' ? { message: options } : options;
    return new Promise<void>(resolve => this.push({ kind: 'info', okText: 'OK', ...o, mode: 'alert', resolve: () => resolve() }));
  }

  /** called by the component */
  close(result: boolean): void {
    const current = this.state();
    if (!current) return;
    this.state.set(null);
    current.resolve(result);
    const next = this.queue.shift();
    if (next) this.state.set(next);
  }

  private push(s: DialogState): void {
    if (this.state()) this.queue.push(s);
    else this.state.set(s);
  }
}
