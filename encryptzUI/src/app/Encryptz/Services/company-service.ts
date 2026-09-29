
// Encryptz/Services/company.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { AuthService } from '../Auth/auth-service';

export interface CompanyUser {
  userId: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  roleInCompany: string;
  assignedAt: string;
  assignedByName: string;
}

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private apiUrl = `${environment.apiUrl}/api/auth`;

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  // Invite user to company (Admin only) — for the project the admin is working in
  inviteUser(email: string, roleInCompany: string, remarks?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/invite-user`, {
      email,
      roleInCompany,
      remarks,
      projectID: this.auth.selectedProjectId() ?? 0
    });
  }

  // Get all users in current company
  getCompanyUsers(): Observable<CompanyUser[]> {
    return this.http.get<any>(`${this.apiUrl}/company-users`)
      .pipe(map(res => (Array.isArray(res) ? res : (res?.data ?? [])) as CompanyUser[]));
  }

  // Get available roles for company
  getAvailableRoles(): Observable<string[]> {
    return this.http.get<any>(`${this.apiUrl}/available-roles`)
      .pipe(map(res => (Array.isArray(res) ? res : (res?.data ?? [])) as string[]));
  }

  // Create company (DISABLED - returns error message)
  createCompany(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/create-company`, data);
  }
}
