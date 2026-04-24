import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../Auth/auth-service';

export const dashboardRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // First check if company is selected
  const companyId = auth.getStoredCompanyId();
  if (!companyId) {
    router.navigate(['/select-company']);
    return false;
  }

  if (auth.userRole() === 'Technician') {
    router.navigate(['/technicians/work-orders']);
    return false;
  }
  return true;
};
