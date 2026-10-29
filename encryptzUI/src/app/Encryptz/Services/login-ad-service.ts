import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { ApiResponse } from '../Models/ApiModels';

// ── The advertisement slides of the sign-in and register pages ──
// Anonymous: these pages show them before anyone signs in. The platform
// administrator manages them in Platform Admin › Login Ads.

export interface LoginAd {
  loginAdId: number;
  tag: string;
  title: string;
  body: string;
  buttonText: string;
  linkUrl: string;
  imageVersion: number;
}

/** The address of a slide's image; the version changes with the image, so the browser may keep it. */
export function loginAdImageUrl(ad: LoginAd): string {
  return `${environment.apiUrl}/api/loginads/${ad.loginAdId}/image?v=${ad.imageVersion}`;
}

@Injectable({ providedIn: 'root' })
export class LoginAdService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/api/loginads`;

  private cached: Observable<ApiResponse<LoginAd[]>> | null = null;
  private cachedAt = 0;

  /**
   * The slides shown today. Login and register each show the slider and the person moves
   * between them: the list is read once and kept for five minutes (QA BUG-009: read 3 times).
   */
  list(): Observable<ApiResponse<LoginAd[]>> {
    if (!this.cached || Date.now() - this.cachedAt > 5 * 60_000) {
      this.cachedAt = Date.now();
      this.cached = this.http.get<ApiResponse<LoginAd[]>>(this.api).pipe(shareReplay({ bufferSize: 1, refCount: false }));
      // a failed read is not kept
      this.cached.subscribe({ error: () => { this.cached = null; } });
    }
    return this.cached;
  }

  imageUrl(ad: LoginAd): string {
    return loginAdImageUrl(ad);
  }
}
