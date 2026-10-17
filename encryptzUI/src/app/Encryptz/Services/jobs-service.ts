import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { ApiResponse } from '../Models/ApiModels';

// ── Job Portal (personal application): the profile of the person who is logged in ──
// Nothing here carries a user id: the API takes the user from the login.

export interface JobProfile {
  fullName: string;
  headline: string;
  summary: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  /** ISO date, or null. */
  dateOfBirth?: string | null;
  /** "Employers can find me". Changed only with setVisible. */
  isVisible: boolean;
}

export interface JobExperience {
  experienceId: number;
  organisation: string;
  title: string;
  /** First day of the month (ISO date). */
  startMonth: string;
  /** null = works there now. */
  endMonth?: string | null;
  description: string;
}

export interface JobEducation {
  educationId: number;
  institution: string;
  course: string;
  fieldOfStudy: string;
  startYear?: number | null;
  endYear?: number | null;
}

export type JobSkillLevel = 'Beginner' | 'Intermediate' | 'Expert';

export interface JobSubSkill {
  name: string;
  /** 1 to 5. */
  rating: number;
}

export interface JobSkill {
  skillId: number;
  skillName: string;
  /** 1 to 5. With sub-skills it is their average, rounded (the API sets it); without them the person rates the skill. */
  rating: number;
  /** What is shown: the average of the sub-skills to one decimal (3.7), or the rating. The API sets it. */
  overall?: number;
  /** Follows the rating (1-2 Beginner, 3-4 Intermediate, 5 Expert); the API sets it. */
  level?: JobSkillLevel;
  /** https:// only ('' when none). */
  evidenceUrl?: string | null;
  /** Up to 20. */
  subSkills: JobSubSkill[];
}

export interface JobCertificate {
  certificateId: number;
  title: string;
  issuer: string;
  issuedOn?: string | null;
  /** 'Uploaded' for now: the person supplied it and nobody checked it. */
  status: string;
  fileId: number;
  fileName: string;
  sizeBytes: number;
}

export interface JobFileInfo {
  fileId: number;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
}

export type JobWorkMode = 'On-site' | 'Remote' | 'Hybrid';

/** What the person is looking for. All of it is optional. */
export interface JobPreferences {
  jobs: string[];
  locations: string[];
  workModes: JobWorkMode[];
  /** Per year, in rupees; null = not said. */
  expectedCtc: number | null;
}

export interface JobProfilePage {
  profile: JobProfile;
  preferences?: JobPreferences | null;
  experience: JobExperience[];
  education: JobEducation[];
  skills: JobSkill[];
  certificates: JobCertificate[];
  resume?: JobFileInfo | null;
  /** 0 to 100. */
  completeness: number;
}

/** The fields of a certificate that are sent (the file travels next to them). */
export interface JobCertificateFields {
  certificateId: number;
  title: string;
  issuer: string;
  /** yyyy-MM-dd, or null. */
  issuedOn: string | null;
}

// ── job postings as a person sees them ──

export type JobEmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
export type JobApplicationStatus = 'Applied' | 'Shortlisted' | 'Rejected' | 'Hired' | 'Withdrawn';

export const JOB_EMPLOYMENT_TYPES: JobEmploymentType[] = ['Full-time', 'Part-time', 'Contract', 'Internship'];
export const JOB_WORK_MODES: JobWorkMode[] = ['On-site', 'Remote', 'Hybrid'];

export interface JobPostingView {
  postingId: number;
  title: string;
  companyName: string;
  city: string;
  employmentType: JobEmploymentType;
  workMode: JobWorkMode;
  experienceMinYears?: number | null;
  experienceMaxYears?: number | null;
  /** Per month, in rupees. */
  salaryMin?: number | null;
  salaryMax?: number | null;
  skills: string;
  /** Filled only when one job is opened. */
  description: string;
  publishedAt?: string | null;
  closesOn?: string | null;
  isSaved: boolean;
  /** The state of this person's application ('' when they did not apply). */
  myStatus: JobApplicationStatus | '';
  /** It still takes applications. */
  isOpen: boolean;
  /** How well it fits the person's preferences (0 = not at all). Only the search fills it. */
  matchScore?: number;
}

/** A company looked at the person's profile or resume for one of its jobs. */
export interface JobProfileView {
  companyName: string;
  postingTitle: string;
  profileViews: number;
  resumeViews: number;
  lastViewedAt: string;
}

export interface JobPostingSearchResult {
  items: JobPostingView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface JobSearchFilter {
  q: string;
  city: string;
  type: string;
  mode: string;
  page: number;
  /** 'match': the best match to the preferences first; 'newest': the newest first. */
  sort: 'match' | 'newest';
}

export interface JobApplication {
  applicationId: number;
  postingId: number;
  title: string;
  companyName: string;
  city: string;
  employmentType: string;
  workMode: string;
  status: JobApplicationStatus;
  note: string;
  appliedAt: string;
  statusAt: string;
  isOpen: boolean;
}

@Injectable({ providedIn: 'root' })
export class JobsService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/api/jobs`;

  getPage(): Observable<ApiResponse<JobProfilePage>> {
    return this.http.get<ApiResponse<JobProfilePage>>(`${this.api}/profile`);
  }

  saveProfile(profile: Omit<JobProfile, 'isVisible'>): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/profile`, profile);
  }

  setVisible(isVisible: boolean): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/profile/visible`, { isVisible });
  }

  /** Replaces everything the person prefers. */
  savePreferences(preferences: JobPreferences): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/preferences`, preferences);
  }

  saveExperience(entry: JobExperience): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/experience`, entry);
  }

  deleteExperience(id: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.api}/experience/${id}`);
  }

  saveEducation(entry: JobEducation): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/education`, entry);
  }

  deleteEducation(id: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.api}/education/${id}`);
  }

  saveSkill(skill: JobSkill): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/skills`, skill);
  }

  deleteSkill(id: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.api}/skills/${id}`);
  }

  suggestSkills(query: string): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(`${this.api}/skills/suggest`, { params: { q: query } });
  }

  /** The sub-skills the catalogue knows for a skill (an empty list when it is not in it). */
  catalogSubSkills(skill: string): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(`${this.api}/skills/subskills`, { params: { skill } });
  }

  /** The file is optional: without one the certificate keeps the file it has. */
  saveCertificate(fields: JobCertificateFields, file?: File | null): Observable<ApiResponse<number>> {
    const form = new FormData();
    form.append('CertificateId', String(fields.certificateId));
    form.append('Title', fields.title);
    form.append('Issuer', fields.issuer);
    if (fields.issuedOn) form.append('IssuedOn', fields.issuedOn);
    if (file) form.append('File', file, file.name);
    return this.http.post<ApiResponse<number>>(`${this.api}/certificates`, form);
  }

  deleteCertificate(id: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.api}/certificates/${id}`);
  }

  saveResume(file: File): Observable<ApiResponse<number>> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ApiResponse<number>>(`${this.api}/resume`, form);
  }

  deleteResume(): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.api}/resume`);
  }

  /** The photo of the person as an image; null when there is none. */
  getPhoto(): Observable<Blob | null> {
    return this.http.get(`${this.api}/photo`, { responseType: 'blob' });
  }

  savePhoto(file: File): Observable<ApiResponse<number>> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ApiResponse<number>>(`${this.api}/photo`, form);
  }

  deletePhoto(): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.api}/photo`);
  }

  // ── job postings ──

  searchPostings(filter: JobSearchFilter): Observable<ApiResponse<JobPostingSearchResult>> {
    const params: Record<string, string> = { page: String(filter.page), sort: filter.sort };
    if (filter.q.trim()) params['q'] = filter.q.trim();
    if (filter.city.trim()) params['city'] = filter.city.trim();
    if (filter.type) params['type'] = filter.type;
    if (filter.mode) params['mode'] = filter.mode;
    return this.http.get<ApiResponse<JobPostingSearchResult>>(`${this.api}/postings`, { params });
  }

  getPosting(postingId: number): Observable<ApiResponse<JobPostingView>> {
    return this.http.get<ApiResponse<JobPostingView>>(`${this.api}/postings/${postingId}`);
  }

  apply(postingId: number, note: string): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/postings/${postingId}/apply`, { note });
  }

  setSaved(postingId: number, saved: boolean): Observable<ApiResponse<boolean>> {
    return saved
      ? this.http.post<ApiResponse<boolean>>(`${this.api}/postings/${postingId}/save`, {})
      : this.http.delete<ApiResponse<boolean>>(`${this.api}/postings/${postingId}/save`);
  }

  getApplications(): Observable<ApiResponse<JobApplication[]>> {
    return this.http.get<ApiResponse<JobApplication[]>>(`${this.api}/applications`);
  }

  withdraw(applicationId: number): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/applications/${applicationId}/withdraw`, {});
  }

  /** Which company looked at the person's profile or resume, for which job. */
  getProfileViews(): Observable<ApiResponse<JobProfileView[]>> {
    return this.http.get<ApiResponse<JobProfileView[]>>(`${this.api}/profile-views`);
  }

  getSaved(): Observable<ApiResponse<JobPostingView[]>> {
    return this.http.get<ApiResponse<JobPostingView[]>>(`${this.api}/saved`);
  }

  /** One file of the person, as bytes (the request carries the login, so a plain link would not work). */
  downloadFile(fileId: number): Observable<Blob> {
    return this.http.get(`${this.api}/files/${fileId}`, { responseType: 'blob' });
  }
}
