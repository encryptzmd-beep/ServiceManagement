import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth-service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isCustomerRequest =
    req.url.includes('/api/Customer') ||
    router.url.startsWith('/customer');

  const token = isCustomerRequest
    ? localStorage.getItem('customer_token')
    : auth.getToken();

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        if (isCustomerRequest) {
          localStorage.removeItem('customer_token');
          localStorage.removeItem('customer_data');
          localStorage.removeItem('customer_menus');
          router.navigate(['/customer/login']);
        } else {
          auth.logout();
          router.navigate(['/login']);
        }
      }

      return throwError(() => error);
    })
  );
};
