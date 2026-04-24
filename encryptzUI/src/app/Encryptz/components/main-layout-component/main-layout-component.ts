import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../header-component/header-component';
import { SidebarComponent } from '../sidebar-component/sidebar-component';
import { FooterComponent } from '../footer-component/footer-component';
import { DashboardStateService } from '../../Services/dashboard-state-service';
import { LocationMonitorService } from '../../Services/location-monitor-service';
import { AuthService } from '../../Auth/auth-service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent, SidebarComponent, FooterComponent],
  templateUrl: './main-layout-component.html',
  styleUrls: ['./main-layout-component.scss'],
})
export class MainLayoutComponent {
  readonly dashState = inject(DashboardStateService);
  private locationMonitor = inject(LocationMonitorService);
  private auth = inject(AuthService);  // ← add this

  ngOnInit(): void {
    this.locationMonitor.startMonitoring(
      this.auth.userRole(),
      () => this.auth.logout()
    );
  }

  ngOnDestroy(): void {
    this.locationMonitor.stopMonitoring();
  }
  get isTechnician(): boolean {
  return this.auth.userRole()?.toLowerCase() === 'technician';
}
}
