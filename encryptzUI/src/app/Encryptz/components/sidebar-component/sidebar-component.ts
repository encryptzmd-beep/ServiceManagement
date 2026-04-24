import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { DashboardStateService } from '../../Services/dashboard-state-service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar-component.html',
  styleUrls: ['./sidebar-component.scss']
})
export class SidebarComponent {
  auth = inject(AuthService);
  router = inject(Router);
  readonly dashState = inject(DashboardStateService);

  closeSidebar = output<void>();

  quickPanelOpen = false;
  expandedMenus = new Set<number>();

  buildMenuTree() {
    const menus = [...this.auth.menus()];
    const menuMap = new Map<number, any>();
    const roots: any[] = [];

    // Create menu objects
    menus.forEach(menu => {
      menuMap.set(menu.menuId, {
        ...menu,
        children: []
      });
    });

    // Attach child menus to parents
    menus.forEach((menu:any) => {
      const current = menuMap.get(menu.menuId);

      if (menu.parentMenuId && menuMap.has(menu.parentMenuId)) {
        menuMap.get(menu.parentMenuId).children.push(current);
      } else {
        roots.push(current);
      }
    });

    // Sort roots and children
    roots.sort((a, b) => a.sortOrder - b.sortOrder);

    roots.forEach(root => {
      if (root.children?.length) {
        root.children.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
      }
    });

    return roots;
  }

  toggleMenu(menuId: number): void {
    if (this.expandedMenus.has(menuId)) {
      this.expandedMenus.delete(menuId);
    } else {
      this.expandedMenus.add(menuId);
    }
  }

  isExpanded(menuId: number): boolean {
    return this.expandedMenus.has(menuId);
  }

  onParentClick(menu: any): void {
    if (!this.dashState.sidebarOpen()) {
      this.dashState.openSidebar();
      return;
    }

    if (menu.children?.length) {
      this.toggleMenu(menu.menuId);
    }

    // navigate to parent route also if available
    if (menu.menuPath) {
      this.router.navigate([menu.menuPath]);
    }
  }

  onNavClick(): void {
    if (window.innerWidth <= 768) {
      this.dashState.closeSidebar();
      this.closeSidebar.emit();
    }
  }
}
