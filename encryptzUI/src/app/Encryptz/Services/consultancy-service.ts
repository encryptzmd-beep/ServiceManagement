import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { ApiResponse } from '../Models/ApiModels';
import { JobProfilePage } from './jobs-service';

// ── Job Consultancy: candidates, clients and placements of the chosen company ──
// Nothing here carries a company or a user: the API takes both from the login.
// A candidate is named by a random key, never by a user id.

export type TalentStage = 'New' | 'Contacted' | 'Interview' | 'Placed' | 'NotSuitable';
export type FeeStatus = 'Pending' | 'Invoiced' | 'Paid';

export const TALENT_STAGES: TalentStage[] = ['New', 'Contacted', 'Interview', 'Placed', 'NotSuitable'];
export const FEE_STATUSES: FeeStatus[] = ['Pending', 'Invoiced', 'Paid'];

export interface ConsultClient {
  clientId: number;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  industry: string;
  notes: string;
  isActive: boolean;
  /** Read only: jobs for this client that are open or in review. */
  openJobs?: number;
  /** Read only: placements at this client. */
  placements?: number;
  createdAt?: string;
}

export interface PostingClient {
  postingId: number;
  clientId: number;
  clientName: string;
}

export interface Candidate {
  candidateKey: string;
  fullName: string;
  headline: string;
  city: string;
  experienceYears: number;
  skills: string;
  preferredJobs: string;
  workModes: string;
  hasResume: boolean;
  inPool: boolean;
  stage: TalentStage | '';
}

export interface CandidateSearch {
  q: string;
  city: string;
  years: number | null;
  mode: string;
  pool: boolean;
  page: number;
}

export interface CandidateSearchResult {
  items: Candidate[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CandidatePage {
  candidateKey: string;
  inPool: boolean;
  stage: TalentStage | '';
  note: string;
  preferredJobs: string[];
  preferredLocations: string[];
  workModes: string[];
  profile: JobProfilePage;
}

export interface Placement {
  placementId: number;
  clientId?: number | null;
  clientName?: string;
  postingId?: number | null;
  candidateName: string;
  jobTitle: string;
  /** yyyy-MM-dd */
  joinDate: string;
  /** Per year, in rupees. */
  annualCtc?: number | null;
  feeAmount?: number | null;
  feeStatus: FeeStatus;
  guaranteeUntil?: string | null;
  notes: string;
  onJobPortal?: boolean;
  createdAt?: string;
}

/** A placement as it is saved: the candidate by key (pool), by application, or by name only. */
export interface PlacementSave extends Placement {
  candidateKey?: string | null;
  applicationId?: number | null;
}

export interface PlacementList {
  items: Placement[];
  thisMonth: number;
  total: number;
  feeOutstanding: number;
  feePaidThisYear: number;
}

@Injectable({ providedIn: 'root' })
export class ConsultancyService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/api/consultancy`;

  // ── clients ──

  getClients(): Observable<ApiResponse<ConsultClient[]>> {
    return this.http.get<ApiResponse<ConsultClient[]>>(`${this.api}/clients`);
  }

  saveClient(client: ConsultClient): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/clients`, client);
  }

  deleteClient(clientId: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.api}/clients/${clientId}`);
  }

  getPostingClients(): Observable<ApiResponse<PostingClient[]>> {
    return this.http.get<ApiResponse<PostingClient[]>>(`${this.api}/posting-clients`);
  }

  setPostingClient(postingId: number, clientId: number | null): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/postings/${postingId}/client`, { clientId });
  }

  // ── candidates ──

  searchCandidates(s: CandidateSearch): Observable<ApiResponse<CandidateSearchResult>> {
    const params: Record<string, string> = { page: String(s.page), pool: String(s.pool) };
    if (s.q.trim()) params['q'] = s.q.trim();
    if (s.city.trim()) params['city'] = s.city.trim();
    if (s.years != null) params['years'] = String(s.years);
    if (s.mode) params['mode'] = s.mode;
    return this.http.get<ApiResponse<CandidateSearchResult>>(`${this.api}/candidates`, { params });
  }

  getCandidate(key: string): Observable<ApiResponse<CandidatePage>> {
    return this.http.get<ApiResponse<CandidatePage>>(`${this.api}/candidates/${key}`);
  }

  downloadCandidateResume(key: string): Observable<Blob> {
    return this.http.get(`${this.api}/candidates/${key}/resume`, { responseType: 'blob' });
  }

  saveTalent(key: string, stage: TalentStage, note: string): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/candidates/${key}/pool`, { stage, note });
  }

  removeTalent(key: string): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.api}/candidates/${key}/pool`);
  }

  invite(key: string, postingId: number, message: string): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/candidates/${key}/invite`, { postingId, message });
  }

  // ── placements ──

  getPlacements(): Observable<ApiResponse<PlacementList>> {
    return this.http.get<ApiResponse<PlacementList>>(`${this.api}/placements`);
  }

  savePlacement(p: PlacementSave): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/placements`, p);
  }

  deletePlacement(placementId: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.api}/placements/${placementId}`);
  }
}
