import { Routes } from '@angular/router';
import { CustomerDashboardComponent } from '../components/customer-dashboard-component/customer-dashboard-component';
import { CustomerHomeComponent } from '../components/customer-home-component/customer-home-component';
import { CustomerLoginComponent } from '../components/customer-login-component/customer-login-component';
import { CustomerRegisterComponent } from '../components/customer-register-component/customer-register-component';
import { CustomerAuthGuard } from '../Guard/customer-guard';
import { ComplaintDetailComponent } from '../components/complaint-detail-component/complaint-detail-component';


export const CUSTOMER_ROUTES: Routes = [
  { path: 'login', component: CustomerLoginComponent },
  { path: 'register', component: CustomerRegisterComponent },

  {
    path: '',
    component: CustomerDashboardComponent,
    canActivate: [CustomerAuthGuard],
    children: [
      { path: '', redirectTo: 'complaints', pathMatch: 'full' },

      {
        path: 'complaints',
        loadComponent: () =>
          import('../components/complaint-tracking-component/complaint-tracking-component')
            .then(m => m.ComplaintTrackingComponent)
      },

      {
        path: 'complaints/new',
        loadComponent: () =>
          import('../components/complaint-registration-component/complaint-registration-component')
            .then(m => m.ComplaintRegistrationComponent)
      },

      {
        path: 'complaint/:id',
        loadComponent: () =>
          import('../components/complaint-detail-component/complaint-detail-component')
            .then(m => m.ComplaintDetailComponent)
      },

      {
        path: 'products',
        loadComponent: () =>
          import('../components/product-registration-component/product-registration-component')
            .then(m => m.ProductRegistrationComponent)
      },

      {
        path: 'profile',
        loadComponent: () =>
          import('../components/profile-component/profile-component')
            .then(m => m.ProfileComponent)
      }
    ]
  }
];
