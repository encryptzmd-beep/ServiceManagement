import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
  title?: string;
  /** small label above the title */
  meta?: string;
  /** material icon; defaults by kind */
  icon?: string;
  /** called when the person clicks the message */
  onOpen?: () => void;
  /** called when the person clicks the close button */
  onClose?: () => void;
}

/**
 * Every toast in the app goes through here and is drawn once by <app-toast-host>,
 * so position and look are the same on every page.
 *   In a template:  <app-toast [text]="message()" kind="success" />
 *   In code:        this.toasts.flash('Location updated');
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<ToastItem[]>([]);
  private nextId = 1;

  newId(): number {
    return this.nextId++;
  }

  /** adds the toast, or updates it when it is already showing */
  put(item: ToastItem): void {
    this.items.update(list =>
      list.some(x => x.id === item.id) ? list.map(x => (x.id === item.id ? item : x)) : [item, ...list].slice(0, 4));
  }

  remove(id: number): void {
    this.items.update(list => list.filter(x => x.id !== id));
  }

  close(id: number): void {
    const item = this.items().find(x => x.id === id);
    this.remove(id);
    item?.onClose?.();
  }

  open(id: number): void {
    const item = this.items().find(x => x.id === id);
    if (!item?.onOpen) return;
    this.remove(id);
    item.onOpen();
  }

  /** a toast from code, which goes by itself */
  flash(text: string, kind: ToastKind = 'success', ms = 3500): void {
    const id = this.newId();
    this.put({ id, kind, text });
    setTimeout(() => this.remove(id), ms);
  }
}
