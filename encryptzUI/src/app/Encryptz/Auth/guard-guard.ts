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


/**
 * `platformAdmin: true` also lets a platform administrator in, whatever their role
 * in the selected company is (same rule as the Administration link on the module screen).
 */
export const roleGuard = (allowedRoles: string[], options: { platformAdmin?: boolean } = {}): CanActivateFn => {
  return (_, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);

    const routePath = state.url.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
    if (auth.hasAccess(routePath)) return true;

    if (allowedRoles.includes(auth.userRole())) return true;
    if (options.platformAdmin && auth.currentUser()?.isPlatformAdmin) return true;
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
 * `data: { scope: 'company' }` (administration, profile) need only a company, and pages
 * marked `data: { scope: 'none' }` (personal applications) need only a login.
 * A session that is not there yet is sent to the step it is missing.
 * A platform administrator opens pages marked `data: { platformAdmin: true }` without a company.
 */
export const scopeGuard: CanActivateChildFn = (childRoute) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (childRoute.data?.['platformAdmin'] && auth.isLoggedIn() && auth.currentUser()?.isPlatformAdmin) return true;

  const scope = childRoute.data?.['scope'];
  const need: ScopeNeed = scope === 'company' || scope === 'none' ? scope : 'full';
  const step = nextScopeStep(auth.scopeState(), need);

  return step === 'ready' ? true : router.createUrlTree([routeForStep(step)]);
};
