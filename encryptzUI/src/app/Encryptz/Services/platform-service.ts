import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { ApiResponse } from '../Models/ApiModels';

// ── Platform administration (main database): companies, projects, access, menus ──

export interface PlatformCompany {
  companyId: number;
  companyName: string;
  companyCode: string;
  address: string;
  city: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt?: string;
  projectCount?: number;
  userCount?: number;
}

export interface PlatformProject {
  projectId: number;
  companyId: number;
  companyName?: string;
  projectName: string;
  projectKey: string;
  isActive: boolean;
  serverName: string;
  databaseName: string;
  dbUser: string;
  extraOptions: string;
  hasPassword?: boolean;
  connectionActive?: boolean;
  userCount?: number;
  /** Only sent when saving/testing; never returned by the API. */
  dbPassword?: string;
}

export interface ConnectionTestResult {
  connected: boolean;
  schemaReady: boolean;
  locationCount: number;
  message: string;
}

export interface PlatformLocation {
  locationId: number;
  locationName: string;
  locationCode: string;
  address: string;
  city: string;
  isActive: boolean;
  createdAt?: string;
}

export interface ProjectAccess {
  userId: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  roleInCompany: string;
  hasAccess: boolean;
  grantedAt?: string;
  grantedByName?: string;
}

export interface PlatformMenu {
  menuId: number;
  menuName: string;
  menuPath: string;
  icon: string;
  parentMenuId: number | null;
  parentMenuName?: string;
  sortOrder: number;
  isActive: boolean;
  module: string;
  roleCount?: number;
}

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/api/platform`;

  // ── access code: the screen is locked until the e-mailed code was entered ──
  private static readonly UNLOCK_KEY = 'platform_unlock';

  /** Kept for the browser tab only; the API decides whether it is still valid. */
  private get unlockToken(): string {
    return sessionStorage.getItem(PlatformService.UNLOCK_KEY) ?? '';
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'X-Platform-Token': this.unlockToken });
  }

  setUnlockToken(token: string): void {
    sessionStorage.setItem(PlatformService.UNLOCK_KEY, token);
  }

  lock(): void {
    sessionStorage.removeItem(PlatformService.UNLOCK_KEY);
  }

  isUnlocked(): Observable<{ success: boolean; unlocked: boolean }> {
    return this.http.get<{ success: boolean; unlocked: boolean }>(`${this.api}/otp/status`, { headers: this.headers });
  }

  sendOtp(): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.api}/otp/send`, {});
  }

  verifyOtp(code: string): Observable<ApiResponse<{ unlockToken: string; validMinutes: number }>> {
    return this.http.post<ApiResponse<{ unlockToken: string; validMinutes: number }>>(`${this.api}/otp/verify`, { code });
  }

  getCompanies(): Observable<ApiResponse<PlatformCompany[]>> {
    return this.http.get<ApiResponse<PlatformCompany[]>>(`${this.api}/companies`, { headers: this.headers });
  }

  saveCompany(company: PlatformCompany): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/companies/save`, company, { headers: this.headers });
  }

  getProjects(companyId = 0): Observable<ApiResponse<PlatformProject[]>> {
    return this.http.get<ApiResponse<PlatformProject[]>>(`${this.api}/projects`, { params: { companyId }, headers: this.headers });
  }

  saveProject(project: PlatformProject): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/projects/save`, project, { headers: this.headers });
  }

  testConnection(project: PlatformProject): Observable<ApiResponse<ConnectionTestResult>> {
    return this.http.post<ApiResponse<ConnectionTestResult>>(`${this.api}/projects/test-connection`, project, { headers: this.headers });
  }

  getLocations(projectId: number): Observable<ApiResponse<PlatformLocation[]>> {
    return this.http.get<ApiResponse<PlatformLocation[]>>(`${this.api}/projects/${projectId}/locations`, { headers: this.headers });
  }

  saveLocation(projectId: number, location: PlatformLocation): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/projects/${projectId}/locations/save`, location, { headers: this.headers });
  }

  getProjectAccess(projectId: number): Observable<ApiResponse<ProjectAccess[]>> {
    return this.http.get<ApiResponse<ProjectAccess[]>>(`${this.api}/projects/${projectId}/access`, { headers: this.headers });
  }

  setProjectAccess(projectId: number, userId: number, hasAccess: boolean): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/projects/${projectId}/access`, { userId, hasAccess }, { headers: this.headers });
  }

  getMenus(): Observable<ApiResponse<PlatformMenu[]>> {
    return this.http.get<ApiResponse<PlatformMenu[]>>(`${this.api}/menus`, { headers: this.headers });
  }

  saveMenu(menu: PlatformMenu): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/menus/save`, menu, { headers: this.headers });
  }
}
