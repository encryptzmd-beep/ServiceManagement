import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { Customer, CustomerMenu, RegisterResponse, LoginResponse, LoginResponseCustomer } from '../Models/ApiModels';
import { environment } from '../../../environments/environment.development';


@Injectable({ providedIn: 'root' })
export class CustomerAuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
   private apiUrl = `${environment.apiUrl}/api/Customer`;

  // Signals for state management
  currentCustomer = signal<Customer | null>(null);
  isLoggedIn = signal<boolean>(false);
  customerMenus = signal<CustomerMenu[]>([]);

  constructor() {
    this.checkSession();
  }

  register(registrationData: any): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, registrationData);
  }

login(email: string, password: string): Observable<LoginResponseCustomer> {
  return this.http.post<LoginResponseCustomer>(`${this.apiUrl}/login`, { email, password })
    .pipe(
      tap((response: any) => {
        if (response.success && response.data?.customer && response.data?.menus) {
          this.setSession(
            response.data.customer,      // ← fixed
            response.data.menus,
            response.data.token || ''
          );
        }
      })
    );
}
getExistingUserCompanies(userId: number) {
  return this.http.post<any[]>(
    `${this.apiUrl}/get-existing-user-companies`,
    { userId }
  );
}

insertCustomerForExistingUser(payload: any) {
  return this.http.post(
    `${this.apiUrl}/insert-customer-for-existing-user`,
    payload
  );
}
  logout(): void {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_data');
    localStorage.removeItem('customer_menus');
    this.currentCustomer.set(null);
    this.isLoggedIn.set(false);
    this.customerMenus.set([]);
    this.router.navigate(['/customer/login']);
  }

private setSession(customer: Customer, menus: CustomerMenu[] = [], token: string = ''): void {
  if (!customer) {
    console.error('setSession called without customer object');
    return;
  }
  localStorage.setItem('customer_token', token);
  localStorage.setItem('customer_data', JSON.stringify(customer));
  localStorage.setItem('customer_menus', JSON.stringify(menus ?? []));
  this.currentCustomer.set(customer);
  this.customerMenus.set(menus ?? []);
  this.isLoggedIn.set(true);
}
private clearSession(): void {
  localStorage.removeItem('customer_token');
  localStorage.removeItem('customer_data');
  localStorage.removeItem('customer_menus');

  this.currentCustomer.set(null);
  this.customerMenus.set([]);
  this.isLoggedIn.set(false);
}
public checkSession(): void {
  const token = localStorage.getItem('customer_token');
  const customerData = localStorage.getItem('customer_data');
  const menusData = localStorage.getItem('customer_menus');

  if (!token || !customerData || customerData === 'undefined') {
    this.clearSession();   // ← use the existing helper instead of partial reset
    return;
  }

  try {
    this.currentCustomer.set(JSON.parse(customerData));
    this.customerMenus.set(
      menusData && menusData !== 'undefined' ? JSON.parse(menusData) : []
    );
    this.isLoggedIn.set(true);
  } catch {
    this.clearSession();   // ← same here
  }
}

  getToken(): string | null {
    return localStorage.getItem('customer_token');
  }

  hasMenuAccess(menuPath: string, permission: 'view' | 'create' | 'edit' | 'delete' = 'view'): boolean {
    const menu = this.customerMenus().find(m => m.menuPath === menuPath);
    if (!menu) return false;

    switch (permission) {
      case 'view': return menu.canView;
      case 'create': return menu.canCreate;
      case 'edit': return menu.canEdit;
      case 'delete': return menu.canDelete;
      default: return false;
    }
  }
}
