import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiResponse, CompanyInfoDto, CompanyUserDetailDto, InvitationDetailDto, JoinRequestDto, LoginResponse, MenuItem, RegisterRequest } from '../Models/ApiModels';
import {environment} from '../../../../src/environments/environment.development'
import { MenuAccessDto, RoleDto, UserDto } from '../components/auth-management-component/auth-management-component';
import { LocationMonitorService } from '../Services/location-monitor-service';

export interface Company {
  companyId: number;
  companyName: string;
  companyCode: string;
  address?: string;
  city?: string;
  phoneNumber?: string;
  roleInCompany: string;
  isLinked: boolean;
}

export interface ExtendedLoginResponse extends LoginResponse {
  companies: Company[];
}

export interface SelectCompanyResponse {  token: string;
  role: string;
  redirectUrl: string;
}

export interface InvitationResponse {
  invitationId: number;
  companyId: number;
  companyName: string;
  roleInCompany: string;
  token: string;
  expiresAt: string;
  invitedByName: string;
}
@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/auth`;
  private companyUrl = `${environment.apiUrl}/api`;  // ADD THIS




  private _currentUser = signal<LoginResponse | null>(null);
  private _menus = signal<MenuItem[]>([]);
  private locationMonitor = inject(LocationMonitorService);

  currentUser = this._currentUser.asReadonly();
  menus = this._menus.asReadonly();
  isLoggedIn = computed(() => !!this._currentUser());
  userRole = computed(() => this._currentUser()?.role ?? '');
  userName = computed(() => this._currentUser()?.fullName ?? '');
  userId = computed(() => this._currentUser()?.userId ?? 0);
  technicianId = computed(() => this._currentUser()?.technicianId ?? 0);
    private _companies = signal<Company[]>([]);
  private _selectedCompanyId = signal<number | null>(null);
  private _selectedCompanyRole = signal<string | null>(null);

  // NEW PUBLIC READONLY SIGNALS
  companies = this._companies.asReadonly();
  selectedCompanyId = this._selectedCompanyId.asReadonly();
  selectedCompanyRole = this._selectedCompanyRole.asReadonly();
  hasMultipleCompanies = computed(() => this._companies().length > 1);
  hasSingleCompany = computed(() => this._companies().length === 1);
  hasNoCompany = computed(() => this._companies().length === 0);

  constructor(private http: HttpClient, private router: Router) {
    this.loadFromStorage();
  }

  login(email: string, password: string): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(`${this.apiUrl}/login`, { email, password })
      .pipe(tap(res => { if (res.success && res.data) this.setSession(res.data); }));
  }

  sendOtp(mobileNumber: string): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.apiUrl}/send-otp`, { mobileNumber });
  }

  verifyOtp(mobileNumber: string, otpCode: string): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(`${this.apiUrl}/verify-otp`, { mobileNumber, otpCode })
      .pipe(tap(res => { if (res.success && res.data) this.setSession(res.data); }));
  }

  register(data: RegisterRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/register`, data);
  }
 getUsers(): Observable<UserDto[]>         { return this.http.get<UserDto[]>(`${this.apiUrl}/users`); }
  saveUser(payload: any): Observable<any>   { return this.http.post(`${this.apiUrl}/users/save`, payload); }
  getRoles(): Observable<RoleDto[]>         { return this.http.get<RoleDto[]>(`${this.apiUrl}/roles`); }
  saveRole(payload: any): Observable<any>   { return this.http.post(`${this.apiUrl}/roles/save`, payload); }
  getMenuAccess(roleId: number): Observable<MenuAccessDto[]> {
    return this.http.get<MenuAccessDto[]>(`${this.apiUrl}/menu-access/${roleId}`);
  }
  saveMenuAccessBulk(roleId: number, items: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/menu-access/save-bulk`, { roleId, items });
  }
 logout(): void {
    localStorage.removeItem('felix_token');
    localStorage.removeItem('felix_user');
    localStorage.removeItem('selected_company_id');
    localStorage.removeItem('selected_company_role');
    this._currentUser.set(null);
    this._menus.set([]);
    this._companies.set([]);
    this._selectedCompanyId.set(null);
    this._selectedCompanyRole.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('felix_token');
  }

  hasAccess(path: string): boolean {
    const menus = this._menus();
    return this.checkMenuAccess(menus, path);
  }

  private checkMenuAccess(menus: MenuItem[], path: string): boolean {
    for (const m of menus) {
      if (m.menuPath === path && m.canView) return true;
      if (m.children?.length && this.checkMenuAccess(m.children, path)) return true;
    }
    return false;
  }

setSession(data: any): void {
  localStorage.setItem('felix_token', data.token);
  localStorage.setItem('felix_user', JSON.stringify(data));
  localStorage.setItem('felix_menus', JSON.stringify(data.menus || []));

  this._currentUser.set(data);
  this._menus.set(data.menus || []);
}

  // private loadFromStorage(): void {
  //   const stored = localStorage.getItem('felix_user');
  //   if (stored) {
  //     try {
  //       const user: LoginResponse = JSON.parse(stored);
  //       this._currentUser.set(user);
  //       this._menus.set(user.menus);
  //     } catch { /* ignore */ }
  //   }
  // }

  // NEW: Self Registration (no company/role)
  selfRegister(data: {
    fullName: string;
    email: string;
    mobileNumber: string;
    password: string;
    aadhaarNumber: string;
  }): Observable<ApiResponse<{ userId: number }>> {
    return this.http.post<ApiResponse<{ userId: number }>>(`${this.apiUrl}/self-register`, data);
  }

loginWithCompanies(email: string, password: string): Observable<ApiResponse<ExtendedLoginResponse>> {
  return this.http
    .post<ApiResponse<ExtendedLoginResponse>>(`${this.apiUrl}/login-v2`, {
      email,
      password
    })
    .pipe(
      tap(res => {
        if (res.success && res.data) {
          this.setTempSession(res.data);
        }
      })
    );
}
private setTempSession(data: ExtendedLoginResponse): void {
  // Only store temporary login + companies.
  // Do NOT store menus yet because company is not selected.

  localStorage.setItem('temp_login', JSON.stringify(data));

  this._currentUser.set({
    ...data,
    menus: []
  });

  this._menus.set([]);
  this._companies.set(data.companies || []);
}
selectCompany(companyId: number): Observable<ApiResponse<any>> {
    const currentUser = this._currentUser();
  return this.http
    .post<ApiResponse<any>>(`${this.apiUrl}/select-company`, {
      userId: currentUser?.userId,
      companyId
    })
    .pipe(
      tap(res => {
        if (res.success && res.data) {
          const data = res.data;

          localStorage.setItem('felix_token', data.token);
          localStorage.setItem('felix_user', JSON.stringify(data));
          localStorage.setItem('felix_menus', JSON.stringify(data.menus || []));
          localStorage.setItem('selected_company_id', companyId.toString());
          localStorage.setItem('selected_company_role', data.role);

          localStorage.removeItem('temp_login');

          this._selectedCompanyId.set(companyId);
          this._selectedCompanyRole.set(data.role);

          this._currentUser.set(data);
          this._menus.set(data.menus || []);

          const existingCompanies = this._companies();

          this._companies.set(
            existingCompanies.map(c => ({
              ...c,
              isLinked: c.companyId === companyId
            }))
          );
        }
      })
    );
}

private loadFromStorage(): void {
  const storedUser = localStorage.getItem('felix_user');
  const storedMenus = localStorage.getItem('felix_menus');
  const storedCompanyId = localStorage.getItem('selected_company_id');
  const storedCompanyRole = localStorage.getItem('selected_company_role');
  const tempLogin = localStorage.getItem('temp_login');

  if (storedUser) {
    try {
      this._currentUser.set(JSON.parse(storedUser));
    } catch {}
  }

  if (storedMenus) {
    try {
      this._menus.set(JSON.parse(storedMenus));
    } catch {}
  }

  if (storedCompanyId) {
    this._selectedCompanyId.set(+storedCompanyId);
  }

  if (storedCompanyRole) {
    this._selectedCompanyRole.set(storedCompanyRole);
  }

  if (tempLogin) {
    try {
      const temp = JSON.parse(tempLogin);
      this._companies.set(temp.companies || []);
    } catch {}
  }
}
private setSessionWithCompanies(data: ExtendedLoginResponse): void {

  localStorage.setItem('felix_token', data.token);
  localStorage.setItem('felix_user', JSON.stringify(data));
  this._currentUser.set(data);
  this._menus.set(data.menus);
  this._companies.set(data.companies || []);
}

  // NEW: Select Company after login
  // selectCompany(companyId: number): Observable<ApiResponse<SelectCompanyResponse>> {
  //   return this.http.post<ApiResponse<SelectCompanyResponse>>(`${this.apiUrl}/select-company`, { companyId })
  //     .pipe(tap(res => {
  //       if (res.success && res.data) {
  //         // Update token with company context
  //         localStorage.setItem('felix_token', res.data.token);
  //         this._selectedCompanyId.set(companyId);
  //         this._selectedCompanyRole.set(res.data.role);

  //         // Update current user's role to company-specific role
  //         const currentUser = this._currentUser();
  //         if (currentUser) {
  //           const updatedUser = { ...currentUser, role: res.data.role };
  //           localStorage.setItem('felix_user', JSON.stringify(updatedUser));
  //           this._currentUser.set(updatedUser);
  //         }
  //       }
  //     }));
  // }

  // NEW: Get User's Companies
  getUserCompanies(): Observable<Company[]> {
    return this.http.get<Company[]>(`${this.apiUrl}/user-companies`).pipe(
      tap(companies => {
        this._companies.set(companies);
        // Check if user has companies in storage
        const storedCompanyId = localStorage.getItem('selected_company_id');
        if (storedCompanyId && companies.length > 0) {
          const found = companies.find(c => c.companyId.toString() === storedCompanyId);
          if (found) {
            this._selectedCompanyId.set(found.companyId);
            this._selectedCompanyRole.set(found.roleInCompany);
          }
        }
      })
    );
  }

  // NEW: Check if user exists (for admin invite)
  checkUserExists(email: string): Observable<{ exists: boolean; userId?: number; fullName?: string }> {
    return this.http.get<{ exists: boolean; userId?: number; fullName?: string }>(
      `${this.apiUrl}/check-user`, { params: { email } }
    );
  }

  // NEW: Get Pending Invitations
  getPendingInvitations(email: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/pending-invitations`, { params: { email } });
  }

  // NEW: Accept Invitation
 acceptInvitation(token: string): Observable<ApiResponse<{ companyId: number; role: string }>> {
  const currentUser = this._currentUser();

  return this.http.post<ApiResponse<{ companyId: number; role: string }>>(
    `${this.apiUrl}/accept-invitation`,
    { token, userId: currentUser?.userId }   // ✅ correct
  );
}

  // NEW: Get current selected company ID from storage
  getStoredCompanyId(): number | null {
    const id = localStorage.getItem('selected_company_id');
    return id ? parseInt(id) : null;
  }

  // NEW: Clear selected company (on logout)
  clearSelectedCompany(): void {
    localStorage.removeItem('selected_company_id');
    localStorage.removeItem('selected_company_role');
    this._selectedCompanyId.set(null);
    this._selectedCompanyRole.set(null);
    this._companies.set([]);
  }

  // NEW: Helper to check if user has access to current company
  hasCompanyAccess(): boolean {
    return !!this._selectedCompanyId();
  }
//  private setSessionWithCompanies(data: ExtendedLoginResponse): void {
//     localStorage.setItem('felix_token', data.token);
//     localStorage.setItem('felix_user', JSON.stringify(data));
//     this._currentUser.set(data);
//     this._menus.set(data.menus);
//     this._companies.set(data.companies || []);

//     // If only one company, auto-select it
//     if (data.companies && data.companies.length === 1) {
//       const singleCompany = data.companies[0];
//       this._selectedCompanyId.set(singleCompany.companyId);
//       this._selectedCompanyRole.set(singleCompany.roleInCompany);
//       localStorage.setItem('selected_company_id', singleCompany.companyId.toString());
//       localStorage.setItem('selected_company_role', singleCompany.roleInCompany);
//     }
//   }

// Encryptz/Auth/auth-service.ts - ADD THESE METHODS

// ============================================
// COMPANY USERS MANAGEMENT
// ============================================

getCompanyUsers(): Observable<any> {
  return this.http.get(`${this.companyUrl}/company/users`);
}

getPendingInvitationsComp(): Observable<any> {
  return this.http.get(`${this.companyUrl}/company/invitations`);
}

cancelInvitation(invitationId: number): Observable<any> {
  return this.http.delete(`${this.companyUrl}/company/invitations/${invitationId}`);
}

updateUserRole(userId: number, newRole: string): Observable<any> {
  return this.http.put(`${this.companyUrl}/company/users/${userId}/role`, { newRole });
}

removeUserFromCompany(userId: number): Observable<any> {
  return this.http.delete(`${this.companyUrl}/company/users/${userId}`);
}
inviteUser(email: string, roleInCompany: string, remarks?: string): Observable<any> {
  return this.http.post(`${this.companyUrl}/company/invite`, {
    email,
    roleInCompany,
    remarks
  });
}
// ============================================
// JOIN REQUESTS
// ============================================

getPendingJoinRequests(): Observable<any> {
  return this.http.get(`${this.companyUrl}/company/requests`);
}

createJoinRequest(companyId: number, requestedRole: string, remarks?: string): Observable<any> {
  return this.http.post(`${this.companyUrl}/company/requests`, { companyId, requestedRole, remarks });
}

approveJoinRequest(requestId: number): Observable<any> {
  return this.http.put(`${this.companyUrl}/company/requests/${requestId}/approve`, {});
}

rejectJoinRequest(requestId: number, reason: string): Observable<any> {
  return this.http.put(`${this.companyUrl}/company/requests/${requestId}/reject`, reason);
}

getAllCompanies(): Observable<any> {
  return this.http.get(`${this.companyUrl}/company/all`);
}
getMyJoinRequests(): Observable<any[]> {
  return this.http.get<any[]>(`${this.apiUrl}/company/my-requests`);
}

// Cancel user's own join request
cancelJoinRequest(requestId: number): Observable<any> {
  return this.http.delete(`${this.apiUrl}/company/requests/${requestId}`);
}
// auth-service.ts - searchUsers method

searchUsers(searchTerm: string): Observable<any> {
  return this.http.get(`${this.apiUrl}/users/search`, {
    params: { searchTerm }
  });
}
// auth-service.ts - ADD THIS METHOD

// Reject invitation
rejectInvitation(invitationId: number): Observable<any> {
  return this.http.delete(`${this.apiUrl}/invitations/${invitationId}/reject`);
}
}
