import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header-component.html',
  styleUrls: ['./header-component.scss'],
})
export class HeaderComponent {
  auth = inject(AuthService);
  toggleSidebar = output<void>();
  showDropdown = false;

  get initials(): string {
    const name = this.auth.userName();
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  /** Name of the selected company, as stored in the main database. */
  private get selectedCompanyName(): string {
    const fromLogin = this.auth.currentUser()?.companyName;
    if (fromLogin) return fromLogin.trim();

    const companyId = this.auth.selectedCompanyId();
    return this.auth.companies().find(c => c.companyId === companyId)?.companyName?.trim() ?? '';
  }

  /** First word of the company name (the rest is shown in the accent colour). */
  get companyName(): string {
    return this.selectedCompanyName.split(' ')[0] || 'Encryptz';
  }

  get companySuffix(): string {
    const name = this.selectedCompanyName;
    if (!name) return 'Service';

    return name.split(' ').slice(1).join(' ');
  }
}
