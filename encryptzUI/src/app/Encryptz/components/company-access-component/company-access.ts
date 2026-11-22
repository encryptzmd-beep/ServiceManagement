import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../Models/ApiModels';

export type PermissionKey = 'canView' | 'canCreate' | 'canEdit' | 'canDelete';
export type Permissions = Record<PermissionKey, boolean>;

export interface AccessMenu { menuId: number; menuName: string; groupName: string; }
export interface AccessModule { moduleKey: string; moduleName: string; icon: string; menus: AccessMenu[]; }
export interface RoleMenu extends Permissions { menuId: number; }
export interface CompanyRole {
  companyRoleId: number;
  roleName: string;
  description: string;
  accessLevel: string;
  userCount: number;
  moduleKeys: string[];
  menus: RoleMenu[];
}
export interface AccessUser {
  userId: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  roleInCompany: string;
  isActive: boolean;
  isTenantAdmin: boolean;
  canManage: boolean;
  roleIds: number[];
  moduleKeys: string[];
  allBranches: boolean;
  locationIds: number[];
}
export interface AccessBranch { locationId: number; locationName: string; }
export interface AccessOverview {
  actorUserId: number;
  canGrant: boolean;
  branchNote: string;
  modules: AccessModule[];
  roles: CompanyRole[];
  users: AccessUser[];
  branches: AccessBranch[];
}
export interface SaveRolePayload {
  companyRoleId: number;
  roleName: string;
  description: string;
  accessLevel: string;
  moduleKeys: string[];
  menus: RoleMenu[];
}
export interface SaveUserPayload {
  userId: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  isActive: boolean;
  roleIds: number[];
  locationIds: number[] | null;
  canManage: boolean;
}

export const ACCESS_LEVELS = [
  { value: 'Manager', label: 'Manager' },
  { value: 'ServiceManager', label: 'Service Manager' },
  { value: 'Storekeeper', label: 'Storekeeper' },
  { value: 'Technician', label: 'Technician' },
];

export const PERMISSIONS: { key: PermissionKey; label: string }[] = [
  { key: 'canView', label: 'View' },
  { key: 'canCreate', label: 'Create' },
  { key: 'canEdit', label: 'Edit' },
  { key: 'canDelete', label: 'Delete' },
];

export const noPermissions = (): Permissions => ({ canView: false, canCreate: false, canEdit: false, canDelete: false });

/** Create, Edit and Delete need View; taking View away takes all of them. */
export function withPermission(current: Permissions | undefined, key: PermissionKey, on: boolean): Permissions {
  const next = { ...(current ?? noPermissions()) };
  if (on) {
    next[key] = true;
    next.canView = true;
  } else if (key === 'canView') {
    return noPermissions();
  } else {
    next[key] = false;
  }
  return next;
}

export function hasAnyPermission(p: Permissions | undefined): boolean {
  return !!p && (p.canView || p.canCreate || p.canEdit || p.canDelete);
}

@Injectable({ providedIn: 'root' })
export class CompanyAccessApi {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/company-access`;

  overview(): Observable<ApiResponse<AccessOverview>> {
    return this.http.get<ApiResponse<AccessOverview>>(this.url);
  }
  saveRole(role: SaveRolePayload): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.url}/roles`, role);
  }
  deleteRole(id: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.url}/roles/${id}`);
  }
  saveUser(user: SaveUserPayload): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.url}/users`, user);
  }
  printSettings(): Observable<ApiResponse<Record<string, string>>> {
    return this.http.get<ApiResponse<Record<string, string>>>(`${this.url}/print-settings`);
  }
  savePrintSettings(values: Record<string, string>): Observable<ApiResponse<boolean>> {
    return this.http.put<ApiResponse<boolean>>(`${this.url}/print-settings`, { values });
  }
  setManager(userId: number, enabled: boolean): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.url}/managers`, { userId, enabled });
  }
}
