import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { CrmService } from '../../Services/crm-service';

/** The frame of the CRM pages: top navigation, the company and branch, the way back to the workspace. */
@Component({
  selector: 'app-crm-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './crm-shell-component.html',
  styleUrl: './crm-shell-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmShellComponent {
  private auth = inject(AuthService);
  private crm = inject(CrmService);
  private router = inject(Router);

  /** Settings is for managers only; the API says who is one. */
  isManager = signal(false);

  companyName = computed(() => {
    const id = this.auth.selectedCompanyId();
    return this.auth.companies().find(c => c.companyId === id)?.companyName ?? '';
  });
  branchName = this.auth.selectedLocationName;

  constructor() {
    this.crm.me().subscribe({
      next: res => this.isManager.set(!!(res.success && res.data?.isManager)),
      error: () => this.isManager.set(false),
    });
  }

  backToWorkspace(): void {
    this.router.navigate(['/select-company']);
  }
}
