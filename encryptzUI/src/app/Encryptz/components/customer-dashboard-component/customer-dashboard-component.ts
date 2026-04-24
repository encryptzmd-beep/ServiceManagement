import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CustomerAuthService } from '../../Services/customer-auth-service';


@Component({
  selector: 'app-customer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  template: `
    <div class="customer-portal">
      <!-- Mobile overlay -->
      @if (isMobileMenuOpen()) {
        <div class="mobile-overlay" (click)="closeMobileMenu()"></div>
      }

      <!-- Sidebar -->
      <aside class="sidebar" [class.collapsed]="isSidebarCollapsed()" [class.mobile-open]="isMobileMenuOpen()">
        <div class="sidebar-header">
          <div class="logo">
            <span class="logo-icon">🔧</span>
            @if (!isSidebarCollapsed()) {
              <span class="logo-text">Felix Service</span>
            }
          </div>
          <button class="toggle-btn" (click)="toggleSidebar()">
            {{ isSidebarCollapsed() ? '→' : '←' }}
          </button>
          <button class="close-mobile-btn" (click)="closeMobileMenu()" aria-label="Close menu">✕</button>
        </div>

        <nav class="sidebar-nav">
          @for (menu of customerMenus(); track menu.menuId) {
            <a
              [routerLink]="menu.menuPath"
              class="nav-item"
              [class.active]="isActive(menu.menuPath)"
              (click)="closeMobileMenu()"
            >
              <span class="nav-icon">{{ getIcon(menu.icon) }}</span>
              @if (!isSidebarCollapsed()) {
                <span class="nav-text">{{ menu.menuName }}</span>
              }
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <button class="logout-btn" (click)="logout()">
            <span class="nav-icon">🚪</span>
            @if (!isSidebarCollapsed()) {
              <span class="nav-text">Logout</span>
            }
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <div class="content-header">
          <button class="hamburger-btn" (click)="openMobileMenu()" aria-label="Open menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <h1>{{ currentTitle() }}</h1>
          <div class="user-info">
            <span class="user-name">{{ currentCustomer()?.fullName }}</span>
            <div class="avatar">{{ getInitials() }}</div>
          </div>
        </div>

        <div class="content-body">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host {
      --red: #e8001c;
      --red-deep: #c0001a;
      --red-glow: rgba(232, 0, 28, 0.32);
      --nav-bg: linear-gradient(180deg, #060e28 0%, #071540 55%, #060f2e 100%);
      --content-bg: #f3f5f9;
      --border-soft: rgba(255, 255, 255, 0.08);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .customer-portal {
      display: flex;
      min-height: 100vh;
      background: var(--content-bg);
    }

    .sidebar {
      width: 260px;
      background: var(--nav-bg);
      color: #fff;
      transition: width 0.3s ease, transform 0.3s ease;
      display: flex;
      flex-direction: column;
      position: fixed;
      height: 100vh;
      z-index: 100;
      border-right: 1px solid var(--border-soft);
    }

    .sidebar.collapsed { width: 72px; }

    .sidebar-header {
      padding: 20px 16px;
      border-bottom: 1px solid var(--border-soft);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .logo-icon {
      width: 34px;
      height: 34px;
      background: var(--red);
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      line-height: 1;
      flex-shrink: 0;
      box-shadow: 0 3px 14px var(--red-glow);
    }

    .logo-text {
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: #fff;
      white-space: nowrap;
    }

    .toggle-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #fff;
      cursor: pointer;
      font-size: 14px;
      padding: 4px 10px;
      border-radius: 8px;
      transition: background 0.2s, border-color 0.2s;
    }

    .toggle-btn:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .close-mobile-btn {
      display: none;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #fff;
      cursor: pointer;
      font-size: 14px;
      padding: 4px 10px;
      border-radius: 8px;
      transition: background 0.2s, border-color 0.2s;
    }

    .close-mobile-btn:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .mobile-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(6, 14, 40, 0.55);
      backdrop-filter: blur(2px);
      z-index: 99;
    }

    .hamburger-btn {
      display: none;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      width: 40px;
      height: 40px;
      background: #fff;
      border: 1px solid #e5e9f0;
      border-radius: 10px;
      cursor: pointer;
      padding: 0 10px;
      transition: background 0.2s, border-color 0.2s;
    }

    .hamburger-btn:hover {
      background: #f3f5f9;
      border-color: #cbd5e1;
    }

    .hamburger-btn span {
      display: block;
      height: 2px;
      width: 100%;
      background: #0f172a;
      border-radius: 2px;
    }

    .sidebar-nav {
      flex: 1;
      padding: 14px 10px;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      margin-bottom: 4px;
      color: rgba(220, 232, 255, 0.72);
      text-decoration: none;
      border-radius: 10px;
      transition: background 0.2s, color 0.2s, border-color 0.2s;
      cursor: pointer;
      position: relative;
      border: 1px solid transparent;
    }

    .nav-item:hover {
      background: rgba(255, 255, 255, 0.07);
      color: #fff;
    }

    .nav-item.active {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.18);
      color: #fff;
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08) inset;
    }

    .nav-icon {
      font-size: 18px;
      width: 22px;
      min-width: 22px;
      text-align: center;
      line-height: 1;
    }

    .nav-text {
      font-size: 0.88rem;
      font-weight: 500;
      letter-spacing: 0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sidebar-footer {
      padding: 14px 16px 18px;
      border-top: 1px solid var(--border-soft);
    }

    .logout-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 11px 14px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 10px;
      color: rgba(220, 232, 255, 0.85);
      cursor: pointer;
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      transition: background 0.2s, color 0.2s, border-color 0.2s;
    }

    .logout-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.24);
      color: #fff;
    }

    .main-content {
      flex: 1;
      margin-left: 260px;
      transition: margin-left 0.3s ease;
      min-width: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--content-bg);
    }

    .sidebar.collapsed ~ .main-content { margin-left: 72px; }

    .content-header {
      background: #fff;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
      border-bottom: 1px solid #e5e9f0;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .content-header h1 {
      margin: 0;
      font-weight: 600;
      font-size: 1.15rem;
      color: #0f172a;
      letter-spacing: -0.01em;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-name {
      font-size: 0.86rem;
      color: #475569;
      font-weight: 500;
    }

    .avatar {
      width: 38px;
      height: 38px;
      background: var(--red);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 600;
      font-size: 0.85rem;
      letter-spacing: 0.03em;
      box-shadow: 0 3px 12px var(--red-glow);
    }

    .content-body {
      padding: 24px;
      flex: 1;
    }

    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
        width: 260px;
        box-shadow: 6px 0 30px rgba(0, 0, 0, 0.35);
      }

      .sidebar.collapsed { width: 260px; }

      .sidebar.mobile-open {
        transform: translateX(0);
      }

      .main-content,
      .sidebar.collapsed ~ .main-content {
        margin-left: 0;
      }

      .toggle-btn { display: none; }

      .close-mobile-btn { display: inline-flex; }

      .mobile-overlay { display: block; }

      .hamburger-btn { display: inline-flex; }

      .content-header {
        padding: 12px 16px;
        gap: 12px;
      }

      .content-header h1 {
        flex: 1;
        font-size: 1.05rem;
      }

      .user-name { display: none; }

      .content-body { padding: 16px; }
    }
  `]
})
export class CustomerDashboardComponent implements OnInit {
  private authService = inject(CustomerAuthService);
  private router = inject(Router);
  private http = inject(HttpClient);

  currentCustomer = this.authService.currentCustomer;
  customerMenus = this.authService.customerMenus;
  isSidebarCollapsed = signal(false);
  isMobileMenuOpen = signal(false);
  currentTitle = signal('Dashboard');
  activeMenuPath = signal<string>('');

  ngOnInit() {
    // Set up route listener to update title and active menu
    this.router.events.subscribe(() => {
      const currentPath = this.router.url.split('?')[0];
      const menus = [...this.customerMenus()].sort(
        (a, b) => b.menuPath.length - a.menuPath.length
      );
      const menu = menus.find(
        m => currentPath === m.menuPath || currentPath.startsWith(m.menuPath + '/')
      );
      if (menu) {
        this.currentTitle.set(menu.menuName);
        this.activeMenuPath.set(menu.menuPath);
      } else {
        this.activeMenuPath.set('');
      }
    });
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed.update(v => !v);
  }

  openMobileMenu(): void {
    this.isMobileMenuOpen.set(true);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }

  isActive(menuPath: string): boolean {
    return this.activeMenuPath() === menuPath;
  }

  getIcon(icon: string): string {
    const iconMap: { [key: string]: string } = {
      'dashboard': '📊',
      'assignment': '📋',
      'add_circle': '➕',
      'inventory_2': '📦',
      'track_changes': '📍',
      'person': '👤',
      'support_agent': '💬'
    };
    return iconMap[icon] || '📌';
  }

  getInitials(): string {
    const name = this.currentCustomer()?.fullName || '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }
}
