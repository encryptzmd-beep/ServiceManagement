import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../Auth/auth-service';

export const companyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const companyId = auth.getStoredCompanyId();
  if (companyId) {
    return true;
  }
  router.navigate(['/select-company']);
  return false;
};
