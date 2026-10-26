import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { ApiResponse } from '../Models/ApiModels';

// ── Messages between a person (Job Portal) and a company (Job Consultancy) ──
// The API takes the person from the login and the company from the token: nothing here
// carries a user id or a company id. A company names a person by CandidateKey.

/** Which side of a conversation the page is: the person, or the company. */
export type MessageSide = 'person' | 'company';

export interface SharedPosting {
  postingId: number;
  title: string;
  companyName: string;
  city: string;
  isOpen: boolean;
}

export interface ChatMessage {
  messageId: number;
  fromSide: 'Person' | 'Company';
  senderName: string;
  body: string;
  createdAt: string;
  sharedPosting: SharedPosting | null;
}

export interface ConversationSummary {
  conversationId: number;
  /** The person's list: the company. */
  companyName: string;
  /** The company's list: the person. */
  candidateKey: string | null;
  fullName: string;
  headline: string;
  isVerified: boolean;
  postingTitle: string;
  lastMessageAt: string;
  lastBody: string;
  lastFromSide: string;
  lastIsJob: boolean;
  unread: number;
  blockedByPerson: boolean;
}

export interface Conversation {
  conversationId: number;
  companyName: string;
  candidateKey: string | null;
  fullName: string;
  headline: string;
  city: string;
  isVerified: boolean;
  postingId: number;
  postingTitle: string;
  blockedByPerson: boolean;
  /** When the other side last read it ("Seen"). */
  otherReadAt: string | null;
  messages: ChatMessage[];
}

export interface OutgoingMessage {
  body: string;
  sharePostingId?: number | null;
}

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/api/messages`;

  private base(side: MessageSide): string {
    return `${this.api}/${side === 'person' ? 'me' : 'company'}`;
  }

  list(side: MessageSide): Observable<ApiResponse<ConversationSummary[]>> {
    return this.http.get<ApiResponse<ConversationSummary[]>>(this.base(side));
  }

  unread(side: MessageSide): Observable<ApiResponse<number>> {
    return this.http.get<ApiResponse<number>>(`${this.base(side)}/unread`);
  }

  get(side: MessageSide, conversationId: number): Observable<ApiResponse<Conversation>> {
    return this.http.get<ApiResponse<Conversation>>(`${this.base(side)}/${conversationId}`);
  }

  send(side: MessageSide, conversationId: number, message: OutgoingMessage): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base(side)}/${conversationId}`, message);
  }

  /** The person writes to the company of a job: the conversation with it (made when there is none). */
  startAsPerson(postingId: number): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/me/start`, { postingId });
  }

  /** The company writes to a person: by the key, or by an application to one of its jobs. */
  startAsCompany(target: { candidateKey?: string; applicationId?: number; postingId?: number | null }): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/company/start`, target);
  }

  block(conversationId: number, blocked: boolean): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/me/${conversationId}/block`, { blocked });
  }
}
