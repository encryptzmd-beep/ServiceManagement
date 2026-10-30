import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { ApiResponse } from '../Models/ApiModels';
import { AuthService } from '../Auth/auth-service';

// ── The wallet of a person: credits, their ledger and the friends they invited ──
// Nothing here carries a user id: the API takes the user from the login.

export interface WalletEntry {
  entryId: number;
  amount: number;
  kind: string;
  note: string;
  createdAt: string;
  totalCount: number;
}

export interface WalletLedger {
  balance: number;
  totalCount: number;
  entries: WalletEntry[];
}

export type ReferralStatus = 'Sent' | 'Joined' | 'Credited';

export interface Referral {
  referralId: number;
  email: string;
  status: ReferralStatus;
  sentAt: string;
  joinedAt: string | null;
  creditedAt: string | null;
  friendName: string;
}

export interface InviteResult {
  result: 'Created' | 'Resent';
  mailSent: boolean;
}

export interface WalletOffer {
  referralCredits: number;
}

/** The person's own link to share; the key is random, not the user id. */
export interface InviteLink {
  key: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class WalletService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api = `${environment.apiUrl}/api/wallet`;

  /** The credits of the person; null until read. */
  readonly balance = signal<number | null>(null);

  constructor() {
    // another person (or nobody) is logged in: the old number is never shown; a new one is read
    effect(() => {
      const id = this.auth.currentUser()?.userId;
      untracked(() => {
        this.balance.set(null);
        if (id) this.refreshBalance();
      });
    });
  }

  /** Reads the balance; on an error the number shown stays as it was. */
  refreshBalance(): void {
    // an answer for a person who is no longer logged in is dropped
    const asked = this.auth.currentUser()?.userId;
    this.http.get<ApiResponse<{ balance: number }>>(`${this.api}/balance`).subscribe({
      next: res => {
        if (this.auth.currentUser()?.userId !== asked) return;
        if (res.success && res.data && typeof res.data.balance === 'number') this.balance.set(res.data.balance);
      },
      error: () => {},
    });
  }

  ledger(page: number): Observable<ApiResponse<WalletLedger>> {
    return this.http.get<ApiResponse<WalletLedger>>(`${this.api}/ledger`, { params: new HttpParams().set('page', page) });
  }

  referrals(): Observable<ApiResponse<Referral[]>> {
    return this.http.get<ApiResponse<Referral[]>>(`${this.api}/referrals`);
  }

  invite(email: string): Observable<ApiResponse<InviteResult>> {
    return this.http.post<ApiResponse<InviteResult>>(`${this.api}/referrals`, { email }).pipe(
      tap(res => { if (res.success) this.refreshBalance(); }));
  }

  offer(): Observable<ApiResponse<WalletOffer>> {
    return this.http.get<ApiResponse<WalletOffer>>(`${this.api}/offer`);
  }

  inviteLink(): Observable<ApiResponse<InviteLink>> {
    return this.http.get<ApiResponse<InviteLink>>(`${this.api}/link`);
  }
}
