
// Encryptz/Services/company.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';

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

  // Invite user to company (Admin only)
  inviteUser(email: string, roleInCompany: string, remarks?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/invite-user`, { email, roleInCompany, remarks });
  }

  // Get all users in current company
  getCompanyUsers(): Observable<CompanyUser[]> {
    return this.http.get<CompanyUser[]>(`${this.apiUrl}/company-users`);
  }

  // Get available roles for company
  getAvailableRoles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/available-roles`);
  }

  // Create company (DISABLED - returns error message)
  createCompany(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/create-company`, data);
  }
}
