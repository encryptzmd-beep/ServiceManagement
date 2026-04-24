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
   get companyName(): string {

    const companyId = this.auth.selectedCompanyId();
    const companies = this.auth.companies();

    const selected = companies.find(c => c.companyId === companyId);

    if (!selected?.companyName) {
      return 'Felix';
    }

    const words = selected.companyName.split(' ');

    return words[0];
  }

  get companySuffix(): string {

    const companyId = this.auth.selectedCompanyId();
    const companies = this.auth.companies();

    const selected = companies.find(c => c.companyId === companyId);

    if (!selected?.companyName) {
      return 'Service';
    }

    const words = selected.companyName.split(' ');

    return words.slice(1).join(' ') || 'Service';
  }
}
