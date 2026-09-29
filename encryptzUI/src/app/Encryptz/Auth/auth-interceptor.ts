import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth-service';
import { environment } from '../../../environments/environment.development';

const PROJECT_KEY_STORAGE = 'customer_project_key';

/**
 * Project the customer portal talks to. Customers have no company/project picker:
 * the portal link names the project (?project=KEY, remembered for the browser),
 * otherwise the configured default is used.
 */
function customerProjectKey(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('project');
  if (fromUrl) {
    localStorage.setItem(PROJECT_KEY_STORAGE, fromUrl);
    return fromUrl;
  }
  return localStorage.getItem(PROJECT_KEY_STORAGE) || environment.customerProjectKey || '';
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isCustomerRequest =
    req.url.toLowerCase().includes('/api/customer') ||
    router.url.startsWith('/customer') ||
    window.location.pathname.startsWith('/customer');

  const token = isCustomerRequest
    ? localStorage.getItem('customer_token')
    : auth.getToken();

  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Public customer calls (register, login, public complaint) carry no token yet:
  // the API picks the project database from this header. Ignored once logged in.
  if (isCustomerRequest) {
    const projectKey = customerProjectKey();
    if (projectKey) headers['X-Project-Key'] = projectKey;
  }

  if (Object.keys(headers).length > 0) {
    req = req.clone({ setHeaders: headers });
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
