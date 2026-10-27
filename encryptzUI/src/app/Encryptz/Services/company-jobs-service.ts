import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { ApiResponse } from '../Models/ApiModels';
import { InterviewMode, JobProfilePage } from './jobs-service';

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
  /** Encryptz approved it and it is open or closed: the Verified tick. */
  isVerified?: boolean;
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
  /** Encryptz verified the person. */
  isVerified?: boolean;
  /** The interview the company set (null = none): when, how, where, a note. */
  interviewAt?: string | null;
  interviewMode?: InterviewMode | '';
  interviewPlace?: string;
  interviewNote?: string;
  /** Why the company rejected the application ('' unless it is rejected). */
  rejectReason?: string;
}

/** The interview of an applicant; no time (null) calls it off. */
export interface InterviewRequest {
  /** Local date and time, yyyy-MM-ddTHH:mm. */
  at: string | null;
  mode: InterviewMode | '';
  place: string;
  note: string;
}

/** The fewest characters the reason of a rejection may have (the person reads it). */
export const REJECT_REASON_MIN = 20;

/** The company's dashboard: what is coming and what came in. */
export interface CompanyDashboard {
  interviews: { applicationId: number; postingId: number; postingTitle: string; fullName: string; interviewAt: string; interviewMode: string; interviewPlace: string }[];
  latest: { applicationId: number; postingId: number; postingTitle: string; fullName: string; headline: string; status: ApplicantStatus; appliedAt: string; isVerified: boolean }[];
  newThisWeek: number;
  interviewsThisWeek: number;
  hiredThisMonth: number;
  rejectedThisMonth: number;
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

  /** A rejection needs a reason (REJECT_REASON_MIN characters at least): the person reads it. */
  setApplicantStatus(postingId: number, applicationId: number, status: ApplicantStatus, reason = ''): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/postings/${postingId}/applicants/${applicationId}/status`, { status, reason });
  }

  setApplicantInterview(postingId: number, applicationId: number, interview: InterviewRequest): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/postings/${postingId}/applicants/${applicationId}/interview`, interview);
  }

  getDashboard(): Observable<ApiResponse<CompanyDashboard>> {
    return this.http.get<ApiResponse<CompanyDashboard>>(`${this.api}/dashboard`);
  }

  /** The resume of an applicant, as bytes (the request carries the login, so a plain link would not work). */
  downloadResume(postingId: number, applicationId: number): Observable<Blob> {
    return this.http.get(`${this.api}/postings/${postingId}/applicants/${applicationId}/resume`, { responseType: 'blob' });
  }
}
