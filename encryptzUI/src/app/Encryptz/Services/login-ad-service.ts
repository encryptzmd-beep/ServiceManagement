import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  /** The slides shown today. */
  list(): Observable<ApiResponse<LoginAd[]>> {
    return this.http.get<ApiResponse<LoginAd[]>>(this.api);
  }

  imageUrl(ad: LoginAd): string {
    return loginAdImageUrl(ad);
  }
}
