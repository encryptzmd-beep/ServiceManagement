import { TechnicianAssignmentComponent } from './Encryptz/components/technician-assignment-component/technician-assignment-component';
import { LoginComponent } from './Encryptz/components/login-component/login-component';
import { RegisterComponent } from './Encryptz/components/register-component/register-component';
import { Routes } from '@angular/router';
import { MainLayoutComponent } from './Encryptz/components/main-layout-component/main-layout-component';
import { authGuard, dashboardRedirectGuard, roleGuard } from './Encryptz/Auth/guard-guard';
import { CompanySelectorComponent } from './Encryptz/components/company-selector-component/company-selector-component';
import { NoCompanyComponent } from './Encryptz/components/no-company-component/no-company-component';
import { AddUserComponent } from './Encryptz/components/add-user-component/add-user-component';
import { CUSTOMER_ROUTES } from './Encryptz/Routes/customer.routes';

export const routes: Routes = [
  // Public routes (no layout)
  {
    path: 'login',
    loadComponent: () =>
      import('../app/Encryptz/components/login-component/login-component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('../app/Encryptz/components/register-component/register-component').then(
        (m) => m.RegisterComponent,
      ),
  },
     {
    path: 'customer',
    children: CUSTOMER_ROUTES
  },
  { path: 'select-company', component: CompanySelectorComponent, canActivate: [authGuard] },
  { path: 'no-company', component: NoCompanyComponent, canActivate: [authGuard] },
  // Protected routes (with layout)
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'complaints/dashboard', pathMatch: 'full' },

      // 2.2 Dashboard (Admin, ServiceManager)
      // {
      //   path: 'complaints/dashboard',
      //   loadComponent: () =>
      //     import('../app/Encryptz/components/dashboard-component/dashboard-component').then(
      //       (m) => m.DashboardComponent,
      //     ),
      //      canActivate: [dashboardRedirectGuard],
      // },
      {
        path: 'admin/add-user',
        component: AddUserComponent,
        canActivate: [roleGuard(['Admin', 'CompanyAdmin'])],
      },

      // 2.1 Customer Portal

      // {
      //   path: 'customer/complaints',
      //   loadComponent: () =>
      //     import('../app/Encryptz/components/complaint-tracking-component/complaint-tracking-component').then(
      //       (m) => m.ComplaintTrackingComponent,
      //     ),
      // },

      // 2.2 Back Office - Complaints & Assignment
      // {
      //   path: 'complaints/dashboard',
      //   loadComponent: () =>
      //     import('../app/Encryptz/components/dashboard-component/dashboard-component').then(
      //       (m) => m.DashboardComponent,
      //     ),
      //   canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      // },
      {
        path: 'complaints/list',
        loadComponent: () =>
          import('../app/Encryptz/components/complaint-list-component/complaint-list-component').then(
            (m) => m.ComplaintListComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },
      {
        path: 'complaints/assign',
        loadComponent: () =>
          import('../app/Encryptz/components/technician-assignment-component/technician-assignment-component').then(
            (m) => m.TechnicianAssignmentComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },

      // 2.3 Technician Portal
      {
        path: 'technicians/work-orders',
        loadComponent: () =>
          import('../app/Encryptz/components/work-orders-component/work-orders-component').then(
            (m) => m.WorkOrdersComponent,
          ),
        //canActivate: [roleGuard(['Admin', 'ServiceManager', 'Technician'])],
      },

      // 2.4 Tracking & Attendance
      {
        path: 'tracking/attendance',
        loadComponent: () =>
          import('../app/Encryptz/components/check-in-component/check-in-component').then(
            (m) => m.CheckInComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager', 'Technician'])],
      },
      {
        path: 'tracking/geo',
        loadComponent: () =>
          import('../app/Encryptz/components/geo-map-component/geo-map-component').then(
            (m) => m.GeoMapComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },

      // 2.5 Schedule
      {
        path: 'schedule/daily',
        loadComponent: () =>
          import('../app/Encryptz/components/daily-schedule-component/daily-schedule-component').then(
            (m) => m.DailyScheduleComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager', 'Technician'])],
      },

      // 2.6 Reports
      {
        path: 'reports/sla',
        loadComponent: () =>
          import('../app/Encryptz/components/sla-report-component/sla-report-component').then(
            (m) => m.SlaReportComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },
      {
        path: 'reports/productivity',
        loadComponent: () =>
          import('../app/Encryptz/components/productivity-report-component/productivity-report-component').then(
            (m) => m.ProductivityReportComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },
      {
        path: 'reports/attendance',
        loadComponent: () =>
          import('../app/Encryptz/components/attendance-report-component/attendance-report-component').then(
            (m) => m.AttendanceReportComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },
      {
        path: 'technicians/spare-requests',
        loadComponent: () =>
          import('../app/Encryptz/components/spare-request-component/spare-request-component').then(
            (m) => m.SpareRequestComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager', 'Technician'])],
      },
      {
        path: 'tracking/travel',
        loadComponent: () =>
          import('../app/Encryptz/components/travel-report-component/travel-report-component').then(
            (m) => m.TravelReportComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },
      {
        path: 'reports/complaints',
        loadComponent: () =>
          import('../app/Encryptz/components/complaint-report-component/complaint-report-component').then(
            (m) => m.ComplaintReportComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },
      {
        path: 'schedule/conflicts',
        loadComponent: () =>
          import('../app/Encryptz/components/schedule-conflicts-component/schedule-conflicts-component').then(
            (m) => m.ScheduleConflictsComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },
      {
        path: 'complaints/warranty',
        loadComponent: () =>
          import('../app/Encryptz/components/warranty-returns-component/warranty-returns-component').then(
            (m) => m.WarrantyReturnsComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },
      {
        path: 'technicians/list',
        loadComponent: () =>
          import('../app/Encryptz/components/technician-list-component/technician-list-component').then(
            (m) => m.TechnicianListComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },
      {
        path: 'complaints/dashboard',
        loadComponent: () =>
          import('../app/Encryptz/components/complaint-dashboard-component/complaint-dashboard-component').then(
            (m) => m.ComplaintDashboardComponent,
          ),
        canActivate: [roleGuard(['Admin', 'ServiceManager'])],
      },

      // 2. Customer Portal
      // {
      //   path: 'customer',
      //   loadComponent: () =>
      //     import('../app/Encryptz/components/customer-portal-component/customer-portal-component').then(
      //       (m) => m.CustomerPortalComponent,
      //     ),
      //   data: { title: 'Customer Portal', icon: '👤', menu: 'customer-portal' },
      // },

      // 3. Technicians (LIST + ADD/EDIT/DELETE all inside this component)
      {
        path: 'technicians/list',
        loadComponent: () =>
          import('../app/Encryptz/components/technician-list-component/technician-list-component').then(
            (m) => m.TechnicianListComponent,
          ),
        data: { title: 'Technicians', icon: '👷', menu: 'technicians' },
      },

      // 4. Tracking
      {
        path: 'tracking',
        loadComponent: () =>
          import('../app/Encryptz/components/tracking-component/tracking-component').then(
            (m) => m.TrackingComponent,
          ),
        data: { title: 'Live Tracking', icon: '📍', menu: 'tracking' },
      },

      // 5. Schedule (sub-routes)
      {
        path: 'schedule',
        children: [
          { path: '', redirectTo: 'daily', pathMatch: 'full' },
          {
            path: 'daily',
            loadComponent: () =>
              import('../app/Encryptz/components/daily-schedule-component/daily-schedule-component').then(
                (m) => m.DailyScheduleComponent,
              ),
            data: { title: 'Daily Schedule', icon: '📅', menu: 'schedule' },
          },
          {
            path: 'conflicts',
            loadComponent: () =>
              import('../app/Encryptz/components/schedule-conflicts-component/schedule-conflicts-component').then(
                (m) => m.ScheduleConflictsComponent,
              ),
            data: { title: 'Schedule Conflicts', icon: '⚡', menu: 'schedule' },
          },
        ],
      },

      // 6. Warranty Returns (under Complaints menu or standalone)
      {
        path: 'complaints/warranty',
        loadComponent: () =>
          import('../app/Encryptz/components/warranty-returns-component/warranty-returns-component').then(
            (m) => m.WarrantyReturnsComponent,
          ),
        data: { title: 'Warranty Returns', icon: '🛡️', menu: 'complaints' },
      },

      // 7. Reports
      {
        path: 'reports',
        loadComponent: () =>
          import('../app/Encryptz/components/reports-component/reports-component').then(
            (m) => m.ReportsComponent,
          ),
        data: { title: 'Reports', icon: '📈', menu: 'reports' },
      },

      // 8. Settings
      {
        path: 'settings',
        loadComponent: () =>
          import('../app/Encryptz/components/settings-component/settings-component').then(
            (m) => m.SettingsComponent,
          ),
        data: { title: 'Settings', icon: '⚙️', menu: 'settings' },
      },
      {
  path: 'settings/access-management',
  loadComponent: () => import('./Encryptz/components/auth-management-component/auth-management-component')
    .then(m => m.AuthManagementComponent)
},
   {
  path: 'settings/roles',
  loadComponent: () => import('./Encryptz/components/user-roles/user-roles')
    .then(m => m.UserRoles)
},
  {
  path: 'products',
  loadComponent: () => import('./Encryptz/components/product-list-component/product-list-component')
    .then(m => m.ProductListComponent)
},

 {
  path: 'spare-parts',
  loadComponent: () => import('./Encryptz/components/spare-part-master-component/spare-part-master-component')
    .then(m => m.SparePartMasterComponent)
},







      // Fallback
      { path: '**', redirectTo: 'dashboard' },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
