import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { ApiResponse } from '../Models/ApiModels';
import { JobPostingSearchResult, JobPostingView } from './jobs-service';

/**
 * The address of the API for the public job pages. In the browser it is the API of the app;
 * the page server can call it on an inner address instead (API_URL, app.config.server.ts).
 */
export const PUBLIC_API_URL = new InjectionToken<string>('PUBLIC_API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});

/** What the public job list is filtered by: the query string of /jobs. */
export interface PublicJobFilter {
  q: string;
  city: string;
  type: string;
  mode: string;
  page: number;
}

/**
 * The public job pages (/jobs): the open jobs for anybody, no login, no token. The answers
 * never hold anything about the visitor (nothing saved, nothing applied).
 */
@Injectable({ providedIn: 'root' })
export class PublicJobsService {
  private http = inject(HttpClient);
  private api = `${inject(PUBLIC_API_URL)}/api/public/jobs`;

  search(f: PublicJobFilter): Observable<ApiResponse<JobPostingSearchResult>> {
    let params = new HttpParams();
    if (f.q) params = params.set('q', f.q);
    if (f.city) params = params.set('city', f.city);
    if (f.type) params = params.set('type', f.type);
    if (f.mode) params = params.set('mode', f.mode);
    if (f.page > 1) params = params.set('page', f.page);
    return this.http.get<ApiResponse<JobPostingSearchResult>>(this.api, { params });
  }

  get(postingId: number): Observable<ApiResponse<JobPostingView>> {
    return this.http.get<ApiResponse<JobPostingView>>(`${this.api}/${postingId}`);
  }
}

/** The readable part of a job's address: "accountant-ernakulam". Only for people and search engines; the id finds the job. */
export function jobSlug(title: string | null | undefined, city?: string | null): string {
  return `${title ?? ''} ${city ?? ''}`
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'job';
}

/** The public address of one job, relative to the site. */
export function jobPath(posting: { postingId: number; title: string; city?: string | null }): string {
  return `/jobs/${posting.postingId}/${jobSlug(posting.title, posting.city)}`;
}
