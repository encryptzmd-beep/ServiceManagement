import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth-service';


export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Do not apply admin auth logic to customer portal routes
  if (state.url.startsWith('/customer')) {
    return true;
  }

  if (auth.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};


export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return (_, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);

    const routePath = state.url.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
    if (auth.hasAccess(routePath)) return true;

    if (allowedRoles.includes(auth.userRole())) return true;
    return router.createUrlTree(['/select-company']);
  };
};
// guard-guard.ts — update authGuard

// Add a new dashboardRedirectGuard for the '' → dashboard redirect
export const dashboardRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.userRole() === 'Technician') {
    router.navigate(['/technicians/work-orders']);
    return false;
  }
  return true; // let dashboard load for Admin/ServiceManager
};
