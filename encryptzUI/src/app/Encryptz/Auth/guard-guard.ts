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
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) { router.navigate(['/login']); return false; }
    if (allowedRoles.includes(auth.userRole())) return true;
    router.navigate(['/unauthorized']);
    return true;
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
