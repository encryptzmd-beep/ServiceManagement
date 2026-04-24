import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CustomerAuthService } from '../Services/customer-auth-service';


@Injectable({ providedIn: 'root' })
export class CustomerAuthGuard {
  private authService = inject(CustomerAuthService);
  private router = inject(Router);

  canActivate(): boolean {
    if (this.authService.isLoggedIn()) {
      return true;
    }

    this.router.navigate(['/customer/login']);
    return false;
  }
}
