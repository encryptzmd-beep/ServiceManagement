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

export interface JobSkill {
  skillId: number;
  skillName: string;
  level: JobSkillLevel;
  /** https:// only ('' when none). */
  evidenceUrl?: string | null;
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

export interface JobProfilePage {
  profile: JobProfile;
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

  /** One file of the person, as bytes (the request carries the login, so a plain link would not work). */
  downloadFile(fileId: number): Observable<Blob> {
    return this.http.get(`${this.api}/files/${fileId}`, { responseType: 'blob' });
  }
}
