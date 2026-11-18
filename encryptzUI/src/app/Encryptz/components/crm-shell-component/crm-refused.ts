import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Shown when the API refuses with 403: the session was not opened for CRM. */
@Component({
  selector: 'app-crm-refused',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="crm-refused" role="alert">
      <span class="material-icons" aria-hidden="true">lock_outline</span>
      <p>This page is not open to your session. Open CRM from the module list.</p>
      <a routerLink="/select-module">Open CRM from the module list</a>
    </div>`,
  styles: [`
    .crm-refused { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px 16px; text-align: center; color: #64748b; }
    .crm-refused .material-icons { font-size: 36px; color: #94a3b8; }
    .crm-refused p { margin: 0; }
    .crm-refused a { color: #2563eb; font-weight: 600; text-decoration: none; }
    .crm-refused a:hover { text-decoration: underline; }
  `],
})
export class CrmRefusedComponent {}
