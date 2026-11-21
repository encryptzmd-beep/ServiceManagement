import { TechnicianAssignmentComponent } from './Encryptz/components/technician-assignment-component/technician-assignment-component';
import { LoginComponent } from './Encryptz/components/login-component/login-component';
import { RegisterComponent } from './Encryptz/components/register-component/register-component';
import { Routes } from '@angular/router';
import { MainLayoutComponent } from './Encryptz/components/main-layout-component/main-layout-component';
import { authGuard, companySelectedGuard, companyUsersRolesGuard, dashboardRedirectGuard, roleGuard, scopeGuard } from './Encryptz/Auth/guard-guard';
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
  // The public job pages: no login, rendered on the server for search engines (app.routes.server.ts)
  {
    path: 'jobs',
    loadComponent: () => import('./Encryptz/components/public-jobs-component/public-jobs-component')
      .then(m => m.PublicJobsComponent),
  },
  // a profile a person shared with a link: no login, never indexed
  {
    path: 'p/:code',
    loadComponent: () => import('./Encryptz/components/public-profile-component/public-profile-component')
      .then(m => m.PublicProfileComponent),
  },
  ...['jobs/:id', 'jobs/:id/:slug'].map(path => ({
    path,
    loadComponent: () => import('./Encryptz/components/public-job-component/public-job-component')
      .then(m => m.PublicJobComponent),
  })),
     {
    path: 'customer',
    children: CUSTOMER_ROUTES
  },
  { path: 'select-company', loadComponent: () => import('./Encryptz/components/company-selector-component/company-selector-component').then(m => m.CompanySelectorComponent), canActivate: [authGuard], data: { stage: 'company' } },
  // the app list on select-company replaced the separate module page; old links and bookmarks land there
  { path: 'select-module', redirectTo: 'select-company', pathMatch: 'full' },
  { path: 'select-branch', loadComponent: () => import('./Encryptz/components/company-selector-component/company-selector-component').then(m => m.CompanySelectorComponent), canActivate: [authGuard], data: { stage: 'branch' } },
  { path: 'no-company', loadComponent: () => import('./Encryptz/components/no-company-component/no-company-component').then(m => m.NoCompanyComponent), canActivate: [authGuard] },
  // Users & Roles belong to the company, not to a module
  {
    path: 'company/users-roles',
    loadComponent: () => import('./Encryptz/components/company-access-component/company-access-component')
      .then(m => m.CompanyAccessComponent),
    canActivate: [authGuard, companySelectedGuard],
    data: { title: 'Users & Roles' },
  },
  // Personal applications: a login is enough, no company, no layout of a company
  {
    path: 'apps/jobs',
    loadComponent: () => import('./Encryptz/components/job-dashboard-component/job-dashboard-component')
      .then(m => m.JobDashboardComponent),
    canActivate: [authGuard],
    data: { title: 'Job Portal' },
  },
  {
    path: 'apps/wallet',
    loadComponent: () => import('./Encryptz/components/wallet-component/wallet-component')
      .then(m => m.WalletComponent),
    canActivate: [authGuard],
    data: { title: 'Wallet' },
  },
  {
    path: 'apps/jobs/profile',
    loadComponent: () => import('./Encryptz/components/job-profile-component/job-profile-component')
      .then(m => m.JobProfileComponent),
    canActivate: [authGuard],
    data: { title: 'Job Portal' },
  },
  {
    path: 'apps/jobs/notifications',
    loadComponent: () => import('./Encryptz/components/job-notifications-component/job-notifications-component')
      .then(m => m.JobNotificationsComponent),
    canActivate: [authGuard],
    data: { title: 'Job Portal' },
  },
  {
    path: 'apps/jobs/messages',
    loadComponent: () => import('./Encryptz/components/messages-component/messages-component')
      .then(m => m.MessagesComponent),
    canActivate: [authGuard],
    data: { title: 'Job Portal', side: 'person' },
  },
  {
    path: 'apps/jobs/job/:id',
    loadComponent: () => import('./Encryptz/components/job-detail-component/job-detail-component')
      .then(m => m.JobDetailComponent),
    canActivate: [authGuard],
    data: { title: 'Job Portal' },
  },
  ...(['search', 'applications', 'saved'] as const).map(mode => ({
    path: `apps/jobs/${mode}`,
    loadComponent: () => import('./Encryptz/components/job-board-component/job-board-component')
      .then(m => m.JobBoardComponent),
    canActivate: [authGuard],
    data: { title: 'Job Portal', mode },
  })),
  // Job Consultancy (commercial application). Its pages work on the shared Personal DB with
  // the company that was chosen, so they need no branch and no layout of a company database;
  // the API checks on every call that the company has the application and the person may use it
  { path: 'consultancy', redirectTo: 'consultancy/dashboard', pathMatch: 'full' },
  {
    path: 'consultancy',
    canActivate: [authGuard],
    loadComponent: () => import('./Encryptz/components/consultancy-shell-component/consultancy-shell-component')
      .then(m => m.ConsultancyShellComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./Encryptz/components/consultancy-dashboard-component/consultancy-dashboard-component').then(m => m.ConsultancyDashboardComponent), canActivate: [authGuard], data: { title: 'Job Consultancy' } },
      { path: 'postings', loadComponent: () => import('./Encryptz/components/hiring-component/hiring-component').then(m => m.HiringComponent), canActivate: [authGuard], data: { title: 'Job Consultancy' } },
      { path: 'candidates', loadComponent: () => import('./Encryptz/components/consultancy-candidates-component/consultancy-candidates-component').then(m => m.ConsultancyCandidatesComponent), canActivate: [authGuard], data: { title: 'Job Consultancy' } },
      { path: 'candidates/:key', loadComponent: () => import('./Encryptz/components/consultancy-candidates-component/consultancy-candidates-component').then(m => m.ConsultancyCandidatesComponent), canActivate: [authGuard], data: { title: 'Job Consultancy', page: true } },
      { path: 'our-candidates', loadComponent: () => import('./Encryptz/components/own-candidates-component/own-candidates-component').then(m => m.OwnCandidatesComponent), canActivate: [authGuard], data: { title: 'Job Consultancy' } },
      { path: 'messages', loadComponent: () => import('./Encryptz/components/messages-component/messages-component').then(m => m.MessagesComponent), canActivate: [authGuard], data: { title: 'Job Consultancy', side: 'company' } },
      { path: 'clients', loadComponent: () => import('./Encryptz/components/consultancy-clients-component/consultancy-clients-component').then(m => m.ConsultancyClientsComponent), canActivate: [authGuard], data: { title: 'Job Consultancy' } },
      { path: 'placements', loadComponent: () => import('./Encryptz/components/consultancy-placements-component/consultancy-placements-component').then(m => m.ConsultancyPlacementsComponent), canActivate: [authGuard], data: { title: 'Job Consultancy' } },
      { path: 'reports', redirectTo: 'reports/jobs', pathMatch: 'full' },
      { path: 'reports/:report', loadComponent: () => import('./Encryptz/components/consultancy-reports-component/consultancy-reports-component').then(m => m.ConsultancyReportsComponent), canActivate: [authGuard], data: { title: 'Job Consultancy Reports' } },
    ],
  },
  // CRM Lead Management. Works on the company database after select-branch + set-scope, like
  // Service, but has its own shell (top navigation) instead of the main layout. Pages are filled in
  // by the CRM screens; until then each is a one-line placeholder component.
  { path: 'crm', redirectTo: 'crm/dashboard', pathMatch: 'full' },
  { path: 'crm/quotations/:id/print', loadComponent: () => import('./Encryptz/components/crm-quotation-print-component/crm-quotation-print-component').then(m => m.CrmQuotationPrintComponent), canActivate: [authGuard], data: { title: 'Quotation' } },
  {
    path: 'crm',
    canActivate: [authGuard],
    loadComponent: () => import('./Encryptz/components/crm-shell-component/crm-shell-component')
      .then(m => m.CrmShellComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./Encryptz/components/crm-dashboard-component/crm-dashboard-component').then(m => m.CrmDashboardComponent), canActivate: [authGuard], data: { title: 'CRM Dashboard' } },
      { path: 'leads', loadComponent: () => import('./Encryptz/components/crm-leads-component/crm-leads-component').then(m => m.CrmLeadsComponent), canActivate: [authGuard], data: { title: 'Leads' } },
      { path: 'leads/new', loadComponent: () => import('./Encryptz/components/crm-lead-form-component/crm-lead-form-component').then(m => m.CrmLeadFormComponent), canActivate: [authGuard], data: { title: 'New lead' } },
      { path: 'leads/:id', loadComponent: () => import('./Encryptz/components/crm-lead-detail-component/crm-lead-detail-component').then(m => m.CrmLeadDetailComponent), canActivate: [authGuard], data: { title: 'Lead' } },
      { path: 'quotations', loadComponent: () => import('./Encryptz/components/crm-quotations-component/crm-quotations-component').then(m => m.CrmQuotationsComponent), canActivate: [authGuard], data: { title: 'Quotations' } },
      { path: 'quotations/:id', loadComponent: () => import('./Encryptz/components/crm-quotation-component/crm-quotation-component').then(m => m.CrmQuotationComponent), canActivate: [authGuard], data: { title: 'Quotation' } },
      { path: 'reports', redirectTo: 'reports/followups', pathMatch: 'full' },
      { path: 'reports/:report', loadComponent: () => import('./Encryptz/components/crm-reports-component/crm-reports-component').then(m => m.CrmReportsComponent), canActivate: [authGuard], data: { title: 'CRM Reports' } },
      { path: 'settings', loadComponent: () => import('./Encryptz/components/crm-settings-component/crm-settings-component').then(m => m.CrmSettingsComponent), canActivate: [authGuard], data: { title: 'CRM Settings' } },
    ],
  },
  // Protected routes (with layout)
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [scopeGuard],
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
        loadComponent: () => import('./Encryptz/components/add-user-component/add-user-component').then(m => m.AddUserComponent),
        canActivate: [companyUsersRolesGuard, roleGuard(['Admin', 'CompanyAdmin'])],
        data: { scope: 'company' },
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
        canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager'])],
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
        canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Technician'])],
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
        canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager'])],
      },
      {
        path: 'technicians/spare-requests',
        loadComponent: () =>
          import('../app/Encryptz/components/spare-request-component/spare-request-component').then(
            (m) => m.SpareRequestComponent,
          ),
        canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Technician'])],
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
        canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Manager'])],
      },
      {
        // office staff register a complaint for a customer (quick access on the dashboard)
        path: 'complaints/register',
        loadComponent: () =>
          import('../app/Encryptz/components/staff-complaint-register-component/staff-complaint-register-component').then(
            (m) => m.StaffComplaintRegisterComponent,
          ),
        canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Manager'])],
        data: { title: 'Register Complaint' },
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
        path: 'settings/general',
        loadComponent: () =>
          import('../app/Encryptz/components/settings-component/settings-component').then(
            (m) => m.SettingsComponent,
          ),
        data: { title: 'Settings', icon: '⚙️', menu: 'settings' },
      },
      {
  path: 'settings/access-management',
  loadComponent: () => import('./Encryptz/components/auth-management-component/auth-management-component')
    .then(m => m.AuthManagementComponent),
  data: { scope: 'company' }
},
   {
  path: 'profile',
  loadComponent: () => import('./Encryptz/components/my-profile-component/my-profile-component')
    .then(m => m.MyProfileComponent),
  data: { title: 'My Profile', icon: 'person', scope: 'company' }
},
   {
  path: 'settings/platform',
  loadComponent: () => import('./Encryptz/components/platform-admin-component/platform-admin-component')
    .then(m => m.PlatformAdminComponent),
  canActivate: [roleGuard(['Admin', 'CompanyAdmin'], { platformAdmin: true })],
  data: { title: 'Platform Admin', icon: 'admin_panel_settings', menu: 'settings', scope: 'company', platformAdmin: true }
},
   {
  path: 'settings/roles',
  loadComponent: () => import('./Encryptz/components/user-roles/user-roles')
    .then(m => m.UserRoles),
  canActivate: [companyUsersRolesGuard],
  data: { scope: 'company' }
},
  {
  path: 'products',
  loadComponent: () => import('./Encryptz/components/product-list-component/product-list-component')
    .then(m => m.ProductListComponent)
},
  {
  // the category / sub category master (Products › Manage categories)
  path: 'products/categories',
  loadComponent: () => import('./Encryptz/components/product-categories-component/product-categories-component')
    .then(m => m.ProductCategoriesComponent),
  canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Manager'])],
  data: { title: 'Product Categories' }
},

 {
  path: 'spare-parts',
  loadComponent: () => import('./Encryptz/components/spare-part-master-component/spare-part-master-component')
    .then(m => m.SparePartMasterComponent)
},

{
  path: 'technicians/repair-parts',
  loadComponent: () => import('./Encryptz/components/repair-parts-management-component/repair-parts-management-component')
    .then(m => m.RepairPartsManagementComponent),
  canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager'])],
  data: { title: 'Repair Parts', icon: 'construction', menu: 'technicians' }
},


{
  path: 'settings/payments',
  loadComponent: () =>
    import('../app/Encryptz/components/payment-report-component/payment-report-component')
      .then(m => m.PaymentReportComponent),
  canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'Manager'])],
  data: { title: 'Payments Report', icon: 'account_balance_wallet', menu: 'admin' }
},

// 9. Sales: Sales Order (bill) -> Despatch -> Installation complaint -> Warranty
//    (sidebar entries: MainDB/12_Sales_Menus.sql)
{
  path: 'sales/orders',
  loadComponent: () => import('./Encryptz/components/sales-order-list-component/sales-order-list-component')
    .then(m => m.SalesOrderListComponent),
  canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Manager'])],
  data: { title: 'Sales Orders', icon: 'receipt_long', menu: 'sales' }
},
{
  path: 'sales/orders/new',
  loadComponent: () => import('./Encryptz/components/sales-order-entry-component/sales-order-entry-component')
    .then(m => m.SalesOrderEntryComponent),
  canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Manager'])],
  data: { title: 'Sales Order', icon: 'receipt_long', menu: 'sales' }
},
{
  path: 'sales/orders/:id',
  loadComponent: () => import('./Encryptz/components/sales-order-entry-component/sales-order-entry-component')
    .then(m => m.SalesOrderEntryComponent),
  canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Manager'])],
  data: { title: 'Sales Order', icon: 'receipt_long', menu: 'sales' }
},
{ path: 'sales/reports', redirectTo: 'sales/reports/register', pathMatch: 'full' },
{
  path: 'sales/reports/:report',
  loadComponent: () => import('./Encryptz/components/sales-reports-component/sales-reports-component')
    .then(m => m.SalesReportsComponent),
  canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Manager'])],
  data: { title: 'Sales Reports', icon: 'bar_chart', menu: 'sales' }
},
{
  path: 'sales/despatch',
  loadComponent: () => import('./Encryptz/components/despatch-list-component/despatch-list-component')
    .then(m => m.DespatchListComponent),
  // a Storekeeper sees the Spare Parts and Repair Parts tabs only
  canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Manager', 'Storekeeper'])],
  data: { title: 'Despatch', icon: 'local_shipping', menu: 'sales' }
},
{
  path: 'sales/despatch/view/:id',
  loadComponent: () => import('./Encryptz/components/despatch-entry-component/despatch-entry-component')
    .then(m => m.DespatchEntryComponent),
  canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Manager'])],
  data: { title: 'Despatch Details', icon: 'local_shipping', menu: 'sales', mode: 'view' }
},
{
  path: 'sales/despatch/:orderId',
  loadComponent: () => import('./Encryptz/components/despatch-entry-component/despatch-entry-component')
    .then(m => m.DespatchEntryComponent),
  canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Manager'])],
  data: { title: 'Despatch Bill', icon: 'local_shipping', menu: 'sales', mode: 'create' }
},
{
  path: 'sales/warranty',
  loadComponent: () => import('./Encryptz/components/warranty-lookup-component/warranty-lookup-component')
    .then(m => m.WarrantyLookupComponent),
  canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'ServiceManager', 'Manager', 'Technician'])],
  data: { title: 'Warranty Lookup', icon: 'verified_user', menu: 'sales' }
},
// {
//   path: 'settings/payments',
//   loadComponent: () =>
//     import('../app/Encryptz/components/payment-settings-component/payment-settings-component')
//       .then(m => m.PaymentSettingsComponent),
//   canActivate: [roleGuard(['Admin', 'CompanyAdmin', 'Manager'])],
//   data: { title: 'Payment Settings', icon: 'settings', menu: 'settings' }
// },





      // Fallback
      { path: '**', redirectTo: 'complaints/dashboard' },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
