import { Routes } from '@angular/router';
import { CustomerDashboardComponent } from '../components/customer-dashboard-component/customer-dashboard-component';
import { CustomerHomeComponent } from '../components/customer-home-component/customer-home-component';
import { CustomerLoginComponent } from '../components/customer-login-component/customer-login-component';
import { CustomerRegisterComponent } from '../components/customer-register-component/customer-register-component';
import { CustomerAuthGuard } from '../Guard/customer-guard';


export const CUSTOMER_ROUTES: Routes = [
  // `title` = browser tab title (AppTitleStrategy) and the heading of the portal top bar
  { path: 'login/:companyCode', component: CustomerLoginComponent, title: 'Customer Login' },
  { path: 'login', component: CustomerLoginComponent, title: 'Customer Login' },
  { path: 'register/:companyCode', component: CustomerRegisterComponent, title: 'Customer Registration' },
  { path: 'register', component: CustomerRegisterComponent, title: 'Customer Registration' },
  {
    path: 'public-complaint',
    title: 'Quick Complaint',
    loadComponent: () =>
      import('../components/public-quick-complaint-component/public-quick-complaint-component')
        .then(m => m.PublicQuickComplaintComponent)
  },

  {
    path: '',
    component: CustomerDashboardComponent,
    canActivate: [CustomerAuthGuard],
    children: [
      { path: '', redirectTo: 'complaints', pathMatch: 'full' },

      {
        path: 'complaints',
        title: 'My Complaints',
        loadComponent: () =>
          import('../components/complaint-tracking-component/complaint-tracking-component')
            .then(m => m.ComplaintTrackingComponent)
      },

      {
        path: 'complaints/new',
        title: 'Register a Complaint',
        loadComponent: () =>
          import('../components/complaint-registration-component/complaint-registration-component')
            .then(m => m.ComplaintRegistrationComponent)
      },


      {
        path: 'products',
        title: 'My Products',
        loadComponent: () =>
          import('../components/product-registration-component/product-registration-component')
            .then(m => m.ProductRegistrationComponent)
      },

      {
        path: 'profile',
        title: 'My Profile',
        loadComponent: () =>
          import('../components/profile-component/profile-component')
            .then(m => m.ProfileComponent)
      }
    ]
  }
];
