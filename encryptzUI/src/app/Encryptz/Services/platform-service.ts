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
  provisionStatus?: string;
  provisionError?: string;
  databaseName?: string;
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

/** One module of the catalogue as a company has it. */
export interface CompanyModule {
  moduleId: number;
  moduleKey: string;
  moduleName: string;
  description: string;
  icon: string;
  sortOrder: number;
  isEnabled: boolean;
  /** Members who can open it now. */
  userCount: number;
}

/** A SQL Server that holds new company databases. The password is never returned. */
export interface DbServer {
  dbServerId: number;
  serverName: string;
  adminUser: string;
  extraOptions: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: string;
  hasPassword: boolean;
  companyCount: number;
}

/** Sent when saving or testing a server. An empty adminPassword on an edit keeps the stored one. */
export interface DbServerForm {
  dbServerId: number;
  serverName: string;
  adminUser: string;
  adminPassword: string;
  extraOptions: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface PlatformSetting {
  settingKey: string;
  settingValue: string;
  updatedAt?: string;
  updatedByName: string;
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

  getCompanyModules(companyId: number): Observable<ApiResponse<CompanyModule[]>> {
    return this.http.get<ApiResponse<CompanyModule[]>>(`${this.api}/companies/${companyId}/modules`, { headers: this.headers });
  }

  setCompanyModule(companyId: number, moduleKey: string, isEnabled: boolean): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/companies/${companyId}/modules`, { moduleKey, isEnabled }, { headers: this.headers });
  }

  getModuleAccess(companyId: number, moduleKey: string): Observable<ApiResponse<ProjectAccess[]>> {
    return this.http.get<ApiResponse<ProjectAccess[]>>(`${this.api}/companies/${companyId}/modules/${encodeURIComponent(moduleKey)}/access`, { headers: this.headers });
  }

  setModuleAccess(companyId: number, moduleKey: string, userId: number, hasAccess: boolean): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/companies/${companyId}/modules/${encodeURIComponent(moduleKey)}/access`, { userId, hasAccess }, { headers: this.headers });
  }

  // ── database servers + platform settings (platform administrators) ────────

  getDbServers(): Observable<ApiResponse<DbServer[]>> {
    return this.http.get<ApiResponse<DbServer[]>>(`${this.api}/db-servers`, { headers: this.headers });
  }

  /** An empty adminPassword on an edit keeps the stored one. */
  saveDbServer(form: DbServerForm): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/db-servers/save`, form, { headers: this.headers });
  }

  testDbServer(form: DbServerForm): Observable<ApiResponse<ConnectionTestResult>> {
    return this.http.post<ApiResponse<ConnectionTestResult>>(`${this.api}/db-servers/test`, form, { headers: this.headers });
  }

  getSettings(): Observable<ApiResponse<PlatformSetting[]>> {
    return this.http.get<ApiResponse<PlatformSetting[]>>(`${this.api}/settings`, { headers: this.headers });
  }

  saveSetting(settingKey: string, settingValue: string): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/settings/save`, { settingKey, settingValue }, { headers: this.headers });
  }

  getMenus(): Observable<ApiResponse<PlatformMenu[]>> {
    return this.http.get<ApiResponse<PlatformMenu[]>>(`${this.api}/menus`, { headers: this.headers });
  }

  saveMenu(menu: PlatformMenu): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/menus/save`, menu, { headers: this.headers });
  }
}
