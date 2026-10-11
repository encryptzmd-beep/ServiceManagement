import { DestroyRef, Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap, timeout } from 'rxjs';
import { ApiResponse, CompanyInfoDto, CompanyUserDetailDto, InvitationDetailDto, JoinRequestDto, LoginResponse, LocationDto, MenuItem, ModuleDto, RegisterRequest } from '../Models/ApiModels';
import {environment} from '../../../../src/environments/environment.development'
import { MenuAccessDto, RoleDto, UserDto } from '../components/auth-management-component/auth-management-component';
import { LocationMonitorService } from '../Services/location-monitor-service';
import { legacyModuleKey, ScopeState } from './scope-flow';

export interface Company {
  companyId: number;
  companyName: string;
  companyCode: string;
  address?: string;
  city?: string;
  phoneNumber?: string;
  roleInCompany: string;
  isLinked: boolean;
  /** State of the company's database: None | Provisioning | Ready | Failed. */
  provisionStatus?: string;
}

export interface MyProfile {
  userId: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  aadhaarNumber: string;
  globalRole: string;
  roleInCompany: string;
  companyId: number;
  companyName: string;
  companyCode: string;
  createdAt: string;
  memberSince?: string;
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

  // Module -> Branch scoping (within the selected company)
  private _selectedModuleKey = signal<string | null>(null);
  private _selectedLocationId = signal<number | null>(null);
  private _selectedLocationName = signal<string>('');
  /** Tenant scope id of the token. Still read by the invitation and platform screens. */
  private _selectedProjectId = signal<number | null>(null);

  selectedModuleKey = this._selectedModuleKey.asReadonly();
  selectedLocationId = this._selectedLocationId.asReadonly();
  selectedLocationName = this._selectedLocationName.asReadonly();
  selectedProjectId = this._selectedProjectId.asReadonly();

  /** Where this session is on the way into the application (see scope-flow.ts). */
  scopeState(): ScopeState {
    return {
      loggedIn: this.isLoggedIn(),
      companyId: this._selectedCompanyId() || null,
      moduleKey: this._selectedModuleKey() || null,
      locationId: this._selectedLocationId() || null,
    };
  }

  constructor(private http: HttpClient, private router: Router) {
    this.migrateStorageKeys();
    this.loadFromStorage();

    // another tab changed the session this tab is really using (the token is shared): reload to show it
    const onStorage = (event: StorageEvent) => {
      // a tab without a session (the login page) has nothing to mislabel; a customer page uses other keys
      if (!this.isLoggedIn() || this.currentPath().startsWith('/customer')) return;
      const watched = ['encryptz_token', 'selected_company_id', 'selected_module_key', 'selected_location_id'];
      if (event.key === null || (watched.includes(event.key) && event.oldValue !== event.newValue)) {
        this.reloadPage();
      }
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  protected currentPath(): string {
    return window.location.pathname;
  }

  protected reloadPage(): void {
    window.location.reload();
  }

  /**
   * Storage keys used to carry a client name. Browsers that still hold the old keys
   * keep their session: the values are moved to the new names once.
   */
  private migrateStorageKeys(): void {
    const legacyPrefix = ['fe', 'lix_'].join('');

    for (const storage of [localStorage, sessionStorage]) {
      const legacyKeys = Object.keys(storage).filter(k => k.startsWith(legacyPrefix));

      for (const oldKey of legacyKeys) {
        const newKey = 'encryptz_' + oldKey.substring(legacyPrefix.length);
        const value = storage.getItem(oldKey);
        if (value !== null && storage.getItem(newKey) === null) storage.setItem(newKey, value);
        storage.removeItem(oldKey);
      }
    }
  }

  /** Keeps the stored session in step after the user edited the own profile. */
  updateCurrentUser(changes: Partial<LoginResponse>): void {
    const current = this._currentUser();
    if (!current) return;

    const updated = { ...current, ...changes };
    localStorage.setItem('encryptz_user', JSON.stringify(updated));
    this._currentUser.set(updated);
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
  deleteRole(roleId: number): Observable<any> { return this.http.delete(`${this.apiUrl}/roles/${roleId}`); }
  getMenuAccess(roleId: number): Observable<MenuAccessDto[]> {
    return this.http.get<MenuAccessDto[]>(`${this.apiUrl}/menu-access/${roleId}`);
  }
  saveMenuAccessBulk(roleId: number, items: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/menu-access/save-bulk`, { roleId, items });
  }
 logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /** Clear auth state without triggering navigation. Safe to call from /login. */
  clearSession(): void {
    localStorage.removeItem('encryptz_token');
    localStorage.removeItem('encryptz_user');
    localStorage.removeItem('selected_company_id');
    localStorage.removeItem('selected_company_role');
    localStorage.removeItem('selected_project_key');
    localStorage.removeItem('selected_project_id');
    localStorage.removeItem('selected_location_id');
    localStorage.removeItem('selected_module_key');
    localStorage.removeItem('selected_location_name');
    localStorage.removeItem('encryptz_menus');
    localStorage.removeItem('temp_login');
    this._currentUser.set(null);
    this._menus.set([]);
    this._companies.set([]);
    this._selectedCompanyId.set(null);
    this._selectedCompanyRole.set(null);
    this._selectedModuleKey.set(null);
    this._selectedProjectId.set(null);
    this._selectedLocationId.set(null);
    this._selectedLocationName.set('');
  }

  getToken(): string | null {
    const token = localStorage.getItem('encryptz_token');
    if (token) return token;

    // Between login and company selection only the login token exists; the
    // select-company / invitation calls are authenticated with it.
    const temp = localStorage.getItem('temp_login');
    if (temp) {
      try { return JSON.parse(temp).token || null; } catch { return null; }
    }
    return null;
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
  localStorage.setItem('encryptz_token', data.token);
  localStorage.setItem('encryptz_user', JSON.stringify(data));
  localStorage.setItem('encryptz_menus', JSON.stringify(data.menus || []));

  this._currentUser.set(data);
  this._menus.set(data.menus || []);
}

  // private loadFromStorage(): void {
  //   const stored = localStorage.getItem('encryptz_user');
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

          localStorage.setItem('encryptz_token', data.token);
          localStorage.setItem('encryptz_user', JSON.stringify(data));
          localStorage.setItem('encryptz_menus', JSON.stringify(data.menus || []));
          localStorage.setItem('selected_company_id', companyId.toString());
          localStorage.setItem('selected_company_role', data.role);

          // a company token has no module or branch yet: forget those of the previous company
          this.clearScope();

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

// ============================================
// MODULE -> BRANCH SCOPING
// ============================================

/** Every module of the catalogue, with whether this user can open it in the selected company. */
getModules(): Observable<ApiResponse<ModuleDto[]>> {
  return this.http.get<ApiResponse<ModuleDto[]>>(`${this.apiUrl}/modules`);
}

/** Branches of the selected company for a module. */
getBranches(moduleKey: string): Observable<ApiResponse<LocationDto[]>> {
  return this.http.get<ApiResponse<LocationDto[]>>(`${this.apiUrl}/locations`, { params: { moduleKey } });
}

/**
 * Enter a module at a branch. The API checks the company's subscription and this user's
 * access and re-issues the token; every later call is routed and filtered by it.
 */
setScope(moduleKey: string, locationId: number, locationName = ''): Observable<ApiResponse<LoginResponse>> {
  const companyId = this._selectedCompanyId() ?? this._currentUser()?.companyId ?? 0;
  return this.http
    .post<ApiResponse<LoginResponse>>(`${this.apiUrl}/set-scope`, { companyId, moduleKey, locationId })
    .pipe(timeout({ first: 45_000 }), tap(res => {
      if (res.success && res.data) {
        const data = res.data;
        localStorage.setItem('encryptz_token', data.token);
        localStorage.setItem('encryptz_user', JSON.stringify(data));
        localStorage.setItem('encryptz_menus', JSON.stringify(data.menus || []));
        this._currentUser.set(data);
        this._menus.set(data.menus || []);
        this.persistScope(data.moduleKey || moduleKey, data.locationId || locationId, locationName, data.projectId);
      }
    }));
}

/** Store the module and branch of the session in localStorage + signals. */
private persistScope(moduleKey: string, locationId: number, locationName: string, scopeId?: number): void {
  localStorage.setItem('selected_module_key', moduleKey);
  localStorage.setItem('selected_location_id', locationId.toString());
  localStorage.setItem('selected_location_name', locationName);
  this._selectedModuleKey.set(moduleKey || null);
  this._selectedLocationId.set(locationId || null);
  this._selectedLocationName.set(locationName);

  if (scopeId != null) {
    localStorage.setItem('selected_project_id', scopeId.toString());
    this._selectedProjectId.set(scopeId || null);
  }
}

/** Forget the module and branch (another company was selected). */
private clearScope(): void {
  localStorage.removeItem('selected_module_key');
  localStorage.removeItem('selected_project_key');
  localStorage.removeItem('selected_project_id');
  localStorage.removeItem('selected_location_id');
  localStorage.removeItem('selected_location_name');
  this._selectedModuleKey.set(null);
  this._selectedProjectId.set(null);
  this._selectedLocationId.set(null);
  this._selectedLocationName.set('');
}

private loadFromStorage(): void {
  const storedUser = localStorage.getItem('encryptz_user');
  const storedMenus = localStorage.getItem('encryptz_menus');
  const storedCompanyId = localStorage.getItem('selected_company_id');
  const storedCompanyRole = localStorage.getItem('selected_company_role');
  const storedProjectId = localStorage.getItem('selected_project_id');
  const storedLocationId = localStorage.getItem('selected_location_id');
  const tempLogin = localStorage.getItem('temp_login');

  if (storedProjectId) this._selectedProjectId.set(+storedProjectId);
  if (storedLocationId) this._selectedLocationId.set(+storedLocationId);
  this._selectedLocationName.set(localStorage.getItem('selected_location_name') || '');

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
      // a reload on the company list: keep the user logged in (as setTempSession does)
      if (!storedUser) this._currentUser.set({ ...temp, menus: [] });
    } catch {}
  }

  // A session scoped by the previous UI has no module stored: it was the Service module.
  const storedModuleKey = localStorage.getItem('selected_module_key');
  this._selectedModuleKey.set(storedModuleKey || legacyModuleKey(this._currentUser()));
}
private setSessionWithCompanies(data: ExtendedLoginResponse): void {

  localStorage.setItem('encryptz_token', data.token);
  localStorage.setItem('encryptz_user', JSON.stringify(data));
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
  //         localStorage.setItem('encryptz_token', res.data.token);
  //         this._selectedCompanyId.set(companyId);
  //         this._selectedCompanyRole.set(res.data.role);

  //         // Update current user's role to company-specific role
  //         const currentUser = this._currentUser();
  //         if (currentUser) {
  //           const updatedUser = { ...currentUser, role: res.data.role };
  //           localStorage.setItem('encryptz_user', JSON.stringify(updatedUser));
  //           this._currentUser.set(updatedUser);
  //         }
  //       }
  //     }));
  // }

  // NEW: Get User's Companies
  getUserCompanies(): Observable<Company[]> {
    return this.http.get<any>(`${this.apiUrl}/user-companies`).pipe(
      // the API answers with { success, data }; callers work with the list
      map(res => (Array.isArray(res) ? res : (res?.data ?? [])) as Company[]),
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
    return this.http.get<any>(`${this.apiUrl}/check-user`, { params: { email } })
      .pipe(map(res => res?.data ?? res));
  }

  // NEW: Get Pending Invitations
  getPendingInvitations(email: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/pending-invitations`);
  }

  // NEW: Accept Invitation
  acceptInvitation(token: string, projectId: number): Observable<ApiResponse<{ companyId: number; role: string }>> {
  const currentUser = this._currentUser();

  return this.http.post<ApiResponse<{ companyId: number; role: string }>>(
    `${this.apiUrl}/accept-invitation`,
    { token, userId: currentUser?.userId, projectId }   // ✅ correct
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
    this.clearScope();
  }

  // NEW: Helper to check if user has access to current company
  hasCompanyAccess(): boolean {
    return !!this._selectedCompanyId();
  }
//  private setSessionWithCompanies(data: ExtendedLoginResponse): void {
//     localStorage.setItem('encryptz_token', data.token);
//     localStorage.setItem('encryptz_user', JSON.stringify(data));
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
inviteUser(email: string, roleInCompany: string, remarks?: string, projectID?: number): Observable<any> {
  // invitations are for the project the admin is working in
  projectID = projectID ?? this._selectedProjectId() ?? 0;
  return this.http.post(`${this.companyUrl}/company/invite`, {
    email,
    roleInCompany,
    remarks,
    projectID
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
  return this.http.put(`${this.companyUrl}/company/requests/${requestId}/reject`, { reason });
}

getAllCompanies(): Observable<any> {
  return this.http.get(`${this.companyUrl}/company/all`);
}
getMyJoinRequests(): Observable<any[]> {
  return this.http.get<any>(`${this.companyUrl}/company/my-requests`)
    .pipe(map(res => (Array.isArray(res) ? res : (res?.data ?? [])) as any[]));
}

// Cancel user's own join request
cancelJoinRequest(requestId: number): Observable<any> {
  return this.http.delete(`${this.companyUrl}/company/requests/${requestId}`);
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

// ============================================
// PASSWORD MANAGEMENT
// ============================================

forgotPassword(email: string): Observable<ApiResponse<string>> {
  return this.http.post<ApiResponse<string>>(`${this.apiUrl}/forgot-password`, { email });
}

resetPassword(data: { email: string; otpCode: string; newPassword: string }): Observable<ApiResponse<string>> {
  return this.http.post<ApiResponse<string>>(`${this.apiUrl}/reset-password`, data);
}

// ============================================
// MY PROFILE (the logged-in user, main database)
// ============================================

getMyProfile(): Observable<ApiResponse<MyProfile>> {
  return this.http.get<ApiResponse<MyProfile>>(`${this.apiUrl}/me`);
}

updateMyProfile(data: { fullName: string; mobileNumber: string }): Observable<ApiResponse<MyProfile>> {
  return this.http.put<ApiResponse<MyProfile>>(`${this.apiUrl}/me`, data).pipe(
    tap(res => {
      if (res.success && res.data) {
        this.updateCurrentUser({ fullName: res.data.fullName, mobileNumber: res.data.mobileNumber });
      }
    })
  );
}

changeMyPassword(oldPassword: string, newPassword: string): Observable<ApiResponse<string>> {
  return this.http.post<ApiResponse<string>>(`${this.apiUrl}/me/change-password`, { oldPassword, newPassword });
}

changePassword(data: { oldPassword: string; newPassword: string ; userId : number, Username: string }): Observable<ApiResponse<string>> {
  return this.http.post<ApiResponse<string>>(`${this.apiUrl}/change-password`, data);
}
}
