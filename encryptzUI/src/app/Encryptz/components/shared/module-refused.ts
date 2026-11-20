import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** True when the API refused the call because the session was opened for another module. */
export function isModuleRefusal(err: any): boolean {
  return err?.status === 403;
}

/**
 * Shown instead of an empty list when the API refuses with 403: the page belongs to
 * another module than the one the session was opened for (for example Sales pages
 * opened while working in CRM).
 */
@Component({
  selector: 'app-module-refused',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="module-refused" role="alert">
      <span class="material-icons" aria-hidden="true">lock_outline</span>
      <p>This page belongs to <strong>{{ moduleName() }}</strong>. Switch to it from the module menu at the top, then open the page again.</p>
      <a routerLink="/select-module">Open the module list</a>
    </div>`,
  styles: [`
    .module-refused { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px 16px; text-align: center; color: #64748b; }
    .module-refused .material-icons { font-size: 36px; color: #94a3b8; }
    .module-refused p { margin: 0; max-width: 420px; }
    .module-refused a { color: #2563eb; font-weight: 600; text-decoration: none; }
    .module-refused a:hover { text-decoration: underline; }
  `],
})
export class ModuleRefusedComponent {
  moduleName = input('Service Management');
}
