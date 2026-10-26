import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from '../Models/ApiModels';
import { JobEducation, JobExperience, JobSkill, JobSocialLink } from './jobs-service';
import { PUBLIC_API_URL } from './public-jobs-service';

/** A certificate on a shared profile: the title and whether Encryptz checked it, never the file. */
export interface PublicCertificate {
  title: string;
  issuer: string;
  issuedOn?: string | null;
  status: 'Uploaded' | 'Verified' | 'Rejected' | string;
}

/** A profile a person shared (/p/code). Never the email, phone, date of birth or resume. */
export interface PublicProfile {
  fullName: string;
  headline: string;
  summary: string;
  city: string;
  isVerified: boolean;
  hasPhoto: boolean;
  experience: JobExperience[];
  education: JobEducation[];
  skills: JobSkill[];
  certificates: PublicCertificate[];
  socialLinks: JobSocialLink[];
}

/** The profiles people shared with a link: for anybody, no login, no token. */
@Injectable({ providedIn: 'root' })
export class PublicProfileService {
  private http = inject(HttpClient);
  private api = `${inject(PUBLIC_API_URL)}/api/public/profiles`;

  get(code: string): Observable<ApiResponse<PublicProfile>> {
    return this.http.get<ApiResponse<PublicProfile>>(`${this.api}/${encodeURIComponent(code)}`);
  }

  photo(code: string): Observable<Blob> {
    return this.http.get(`${this.api}/${encodeURIComponent(code)}/photo`, { responseType: 'blob' });
  }
}
