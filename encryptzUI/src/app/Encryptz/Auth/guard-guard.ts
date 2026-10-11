import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth-service';
import { nextScopeStep, routeForStep, ScopeNeed } from './scope-flow';


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

/**
 * Pages inside the application need a company, a module and a branch; pages marked
 * `data: { scope: 'company' }` (administration, profile) need only a company.
 * A session that is not there yet is sent to the step it is missing.
 */
export const scopeGuard: CanActivateChildFn = (childRoute) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const need: ScopeNeed = childRoute.data?.['scope'] === 'company' ? 'company' : 'full';
  const step = nextScopeStep(auth.scopeState(), need);

  return step === 'ready' ? true : router.createUrlTree([routeForStep(step)]);
};
