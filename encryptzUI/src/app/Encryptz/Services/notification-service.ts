import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import { AuthService } from '../Auth/auth-service';
import { ApiResponse } from '../Models/ApiModels';

// ── Notifications of every application (Job Portal, Job Consultancy, the platform, ...) ──
// They are kept in the main database; a new one arrives at once over SignalR.
// Nothing here carries a user id: the API takes the user from the login.

export interface AppNotification {
  notificationId: number;
  /** JOBPORTAL, JOBCONSULTANCY, PLATFORM, ... */
  app: string;
  kind: string;
  title: string;
  body: string;
  /** A page of this site ('' when none). */
  link: string;
  companyId: number | null;
  createdAt: string;
  isRead: boolean;
}

export interface AppNotifications {
  items: AppNotification[];
  unread: number;
}

/** Only a page of this site is opened from a notification: "/x", never "//host" or "/\host". */
export function safeLink(link: string | null | undefined): string {
  const text = (link ?? '').trim();
  return /^\/(?![/\\])/.test(text) ? text : '';
}

/** The name of the application a notification comes from, for its label. */
export function appLabel(app: string | null | undefined): string {
  switch (app) {
    case 'JOBPORTAL': return 'Job Portal';
    case 'JOBCONSULTANCY': return 'Job Consultancy';
    case 'PLATFORM': return 'Platform';
    default: return app ? app.charAt(0) + app.slice(1).toLowerCase() : '';
  }
}

/** What this service uses of a SignalR connection. */
export interface HubLink {
  on(name: string, handler: (n: AppNotification) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api = `${environment.apiUrl}/api/notifications`;
  private hub: HubLink | null = null;
  private connecting = false;

  /** How many the person has not read: the number on the bell. */
  readonly unread = signal(0);
  /** The newest one that arrived while a page is open (a short notice); null once dismissed. */
  readonly incoming = signal<AppNotification | null>(null);
  /** Counts up with every notification that arrives, so that an open list reloads. */
  readonly arrived = signal(0);

  constructor() {
    // logged out: nothing listens any more
    let wasLoggedIn = this.loggedIn();
    effect(() => {
      const now = this.loggedIn();
      if (wasLoggedIn && !now) this.stop();
      wasLoggedIn = now;
    });
  }

  /** Called by every page with a bell: listens (once) and reads the number of unread. */
  start(): void {
    if (!this.token()) return;
    this.refresh();
    if (this.hub || this.connecting) return;

    this.connecting = true;
    this.connect().then(hub => {
      this.connecting = false;
      if (!hub) return;
      if (!this.token()) { hub.stop().catch(() => {}); return; }   // logged out meanwhile
      this.hub = hub;
      hub.on('notification', (n: AppNotification) => this.receive(n));
      hub.start().catch(() => {
        // no live connection (the API is older, a proxy blocks WebSockets): the bell still
        // shows the number read on each page, only nothing arrives by itself
        if (this.hub === hub) this.hub = null;
      });
    }, () => { this.connecting = false; });
  }

  stop(): void {
    const hub = this.hub;
    this.hub = null;
    this.unread.set(0);
    this.incoming.set(null);
    hub?.stop().catch(() => {});
  }

  /** The connection to the hub. SignalR is loaded only now, not with the first page. A test replaces it. */
  protected async connect(): Promise<HubLink | null> {
    const { HubConnectionBuilder, LogLevel } = await import('@microsoft/signalr');
    return new HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/notifications`, { accessTokenFactory: () => this.token() ?? '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.None)
      .build();
  }

  /** A page without a session (or a test without one) has nothing to listen to. */
  private token(): string | null {
    try { return this.auth.getToken?.() ?? null; } catch { return null; }
  }

  private loggedIn(): boolean {
    try { return !!this.auth.isLoggedIn?.(); } catch { return false; }
  }

  receive(n: AppNotification): void {
    if (!n || !n.title) return;
    const item = { ...n, link: safeLink(n.link), isRead: false };
    this.unread.update(u => u + 1);
    this.incoming.set(item);
    this.arrived.update(a => a + 1);
  }

  refresh(): void {
    this.list().subscribe({ error: () => {} });
  }

  list(): Observable<ApiResponse<AppNotifications>> {
    return this.http.get<ApiResponse<AppNotifications>>(this.api).pipe(
      tap(res => { if (res.success && res.data) this.unread.set(res.data.unread); }));
  }

  /** One notification as read, or all of them (null). */
  markRead(notificationId: number | null): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/read`, { notificationId }).pipe(
      tap(res => { if (res.success && typeof res.data === 'number') this.unread.set(res.data); }));
  }
}
