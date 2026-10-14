import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { ApiResponse } from '../Models/ApiModels';
import { JobProfilePage } from './jobs-service';

// ── Job Portal, the company's side: the jobs a company offers and who applied ──
// Nothing here carries a company or a user: the API takes both from the login.

export type CompanyPostingStatus = 'Draft' | 'InReview' | 'Open' | 'Closed';
export type ApplicantStatus = 'Applied' | 'Shortlisted' | 'Rejected' | 'Hired';

/** A job as it is written. */
export interface CompanyPostingFields {
  postingId: number;
  title: string;
  city: string;
  employmentType: string;
  workMode: string;
  experienceMinYears: number | null;
  experienceMaxYears: number | null;
  /** Per month, in rupees. */
  salaryMin: number | null;
  salaryMax: number | null;
  skills: string;
  description: string;
  /** yyyy-MM-dd, or null. */
  closesOn: string | null;
}

export interface CompanyPosting extends CompanyPostingFields {
  status: CompanyPostingStatus;
  /** Why Encryptz returned the job ('' when it was not returned). */
  reviewNote?: string;
  publishedAt?: string | null;
  createdAt: string;
  applied: number;
  shortlisted: number;
  rejected: number;
  hired: number;
}

export interface JobApplicant {
  applicationId: number;
  fullName: string;
  headline: string;
  city: string;
  status: ApplicantStatus;
  note: string;
  appliedAt: string;
  statusAt: string;
  hasResume: boolean;
}

/** One applicant opened: the application and the person's profile as it is now. */
export interface JobApplicantPage {
  applicationId: number;
  postingTitle: string;
  status: ApplicantStatus;
  note: string;
  appliedAt: string;
  profile: JobProfilePage;
}

@Injectable({ providedIn: 'root' })
export class CompanyJobsService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/api/company-jobs`;

  getPostings(): Observable<ApiResponse<CompanyPosting[]>> {
    return this.http.get<ApiResponse<CompanyPosting[]>>(`${this.api}/postings`);
  }

  getPosting(postingId: number): Observable<ApiResponse<CompanyPosting>> {
    return this.http.get<ApiResponse<CompanyPosting>>(`${this.api}/postings/${postingId}`);
  }

  savePosting(posting: CompanyPostingFields): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/postings`, posting);
  }

  setPostingStatus(postingId: number, status: 'Open' | 'Closed'): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/postings/${postingId}/status`, { status });
  }

  deletePosting(postingId: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.api}/postings/${postingId}`);
  }

  getApplicants(postingId: number): Observable<ApiResponse<JobApplicant[]>> {
    return this.http.get<ApiResponse<JobApplicant[]>>(`${this.api}/postings/${postingId}/applicants`);
  }

  getApplicant(postingId: number, applicationId: number): Observable<ApiResponse<JobApplicantPage>> {
    return this.http.get<ApiResponse<JobApplicantPage>>(`${this.api}/postings/${postingId}/applicants/${applicationId}`);
  }

  setApplicantStatus(postingId: number, applicationId: number, status: ApplicantStatus): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/postings/${postingId}/applicants/${applicationId}/status`, { status });
  }

  /** The resume of an applicant, as bytes (the request carries the login, so a plain link would not work). */
  downloadResume(postingId: number, applicationId: number): Observable<Blob> {
    return this.http.get(`${this.api}/postings/${postingId}/applicants/${applicationId}/resume`, { responseType: 'blob' });
  }
}
