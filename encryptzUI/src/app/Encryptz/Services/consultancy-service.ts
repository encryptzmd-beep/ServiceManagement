import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  /** Where the years come from: the experience entered, the headline, or nowhere. '' from a server before script 23. */
  experienceSource?: 'Entries' | 'Headline' | 'None' | '';
  skills: string;
  preferredJobs: string;
  workModes: string;
  hasResume: boolean;
  /** Encryptz verified the person. */
  isVerified?: boolean;
  inPool: boolean;
  stage: TalentStage | '';
}

/** A person who fits one job of the company, and why (best first). */
export interface CandidateMatch {
  candidateKey: string;
  fullName: string;
  headline: string;
  city: string;
  experienceYears: number;
  experienceSource: 'Entries' | 'Headline' | 'None' | '';
  isVerified: boolean;
  hasResume: boolean;
  /** The skills of the job the person has (comma separated), and how many the job names. */
  matchedSkills: string;
  skillHits: number;
  skillsWanted: number;
  /** Words of the title found in the headline, a past job title or a job the person looks for. */
  titleHits: number;
  cityMatch: boolean;
  modeMatch: boolean;
  /** 1 in the range of the job, 0 out of it, -1 not known. */
  experienceFit: number;
  alreadyInvited: boolean;
  matchScore: number;
}

export interface PostingMatchCount {
  postingId: number;
  suitable: number;
}

/** Years of experience a candidate can be filtered by. */
export const EXPERIENCE_BANDS: { value: string; label: string }[] = [
  { value: '0-1', label: 'Under 1 year' },
  { value: '1-3', label: '1 – 3 years' },
  { value: '3-5', label: '3 – 5 years' },
  { value: '5-10', label: '5 – 10 years' },
  { value: '10+', label: '10+ years' },
  { value: 'none', label: 'Experience not added' },
];

/**
 * What candidates are searched by. The words are looked for in the name, headline, skills,
 * experience, education and preferences; every list takes any of its values (none = no filter).
 */
export interface CandidateSearch {
  q: string;
  /** true: every word must be found; false: any word. */
  matchAll: boolean;
  cities: string[];
  bands: string[];
  modes: string[];
  skills: string[];
  /** true: every skill ticked; false: any of them. */
  skillsAll: boolean;
  verifiedOnly: boolean;
  withResume: boolean;
  pool: boolean;
  page: number;
}

/** A choice of a filter and how many of the people the words found have it. */
export interface CandidateFacet {
  kind: 'City' | 'Skill' | 'Mode' | 'Band';
  value: string;
  people: number;
}

export interface CandidateSearchResult {
  items: Candidate[];
  facets?: CandidateFacet[];
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
    let params = new HttpParams().set('page', s.page).set('pool', s.pool);
    if (s.q.trim()) params = params.set('q', s.q.trim()).set('matchAll', s.matchAll);
    // a list goes as the same name once per value: ?cities=Kochi&cities=Thrissur
    for (const v of s.cities) params = params.append('cities', v);
    for (const v of s.bands) params = params.append('bands', v);
    for (const v of s.modes) params = params.append('modes', v);
    for (const v of s.skills) params = params.append('skills', v);
    if (s.skills.length) params = params.set('skillsAll', s.skillsAll);
    if (s.verifiedOnly) params = params.set('verifiedOnly', true);
    if (s.withResume) params = params.set('withResume', true);
    return this.http.get<ApiResponse<CandidateSearchResult>>(`${this.api}/candidates`, { params });
  }

  /** The people who fit one job of the company, best first. */
  getPostingMatches(postingId: number): Observable<ApiResponse<CandidateMatch[]>> {
    return this.http.get<ApiResponse<CandidateMatch[]>>(`${this.api}/postings/${postingId}/matches`);
  }

  /** How many suitable people each open job of the company has. */
  getPostingMatchCounts(): Observable<ApiResponse<PostingMatchCount[]>> {
    return this.http.get<ApiResponse<PostingMatchCount[]>>(`${this.api}/postings/match-counts`);
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
