import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { CompanyDashboard, CompanyJobsService, CompanyPosting } from '../../Services/company-jobs-service';
import { ConsultancyService, PlacementList } from '../../Services/consultancy-service';
import { MessageAlertsService } from '../../Services/message-alerts-service';
import { initial, interviewLabel, interviewParts, isWebLink } from '../../Services/job-labels';
import { CONSULTANCY_MENU } from '../personal-shell-component/consultancy-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';

const REFUSED = "You don't have access to Job Consultancy. Ask your administrator";

/** One small card of the dashboard. */
interface DashCard { key: string; label: string; icon: string; value: string; link: string; hint: string; }

/**
 * Job Consultancy, the first page (/consultancy/dashboard): how the business stands. The
 * jobs and their applicants, the coming interviews, the latest applicants, the placements
 * and fees, the clients, the company's own candidates and unread messages. Every part is
 * read on its own: one that cannot be read stays empty and the rest of the page shows.
 */
@Component({
  selector: 'app-consultancy-dashboard',
  standalone: true,
  imports: [RouterModule, PersonalShellComponent, VerifiedBadgeComponent],
  templateUrl: './consultancy-dashboard-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-dashboard-component/job-dashboard-component.scss',
    './consultancy-dashboard-component.scss',
  ],
})
export class ConsultancyDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private jobs = inject(CompanyJobsService);
  private consultancy = inject(ConsultancyService);
  private messageAlerts = inject(MessageAlertsService);

  readonly menu = CONSULTANCY_MENU;
  readonly initial = initial;
  readonly interviewLabel = interviewLabel;
  readonly interviewParts = interviewParts;
  readonly isWebLink = isWebLink;

  unavailable = signal('');
  postings = signal<CompanyPosting[] | null>(null);
  board = signal<CompanyDashboard | null>(null);
  placements = signal<PlacementList | null>(null);
  activeClients = signal<number | null>(null);
  ownCandidates = signal<number | null>(null);
  suitable = signal<Record<number, number>>({});
  readonly unreadMessages = this.messageAlerts.unread.company;

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const first = (this.auth.userName() ?? '').trim().split(/\s+/)[0];
    return first ? `${part}, ${first}` : part;
  });

  readonly cards = computed<DashCard[]>(() => {
    const posts = this.postings();
    const b = this.board();
    const pl = this.placements();
    const n = (v: number | null | undefined) => (v === null || v === undefined ? '–' : String(v));
    const open = posts?.filter(p => p.status === 'Open') ?? null;
    return [
      { key: 'jobs', label: 'Open jobs', icon: 'work_outline', value: n(open?.length), link: '/consultancy/postings',
        hint: posts ? `${posts.filter(p => p.status === 'InReview').length} in review · ${posts.filter(p => p.status === 'Draft').length} drafts` : '' },
      { key: 'new', label: 'New applicants', icon: 'person_add_alt', value: n(b?.newThisWeek), link: '/consultancy/postings', hint: 'In the last 7 days' },
      { key: 'shortlisted', label: 'Shortlisted', icon: 'star_outline', value: n(posts ? posts.reduce((s, p) => s + p.shortlisted, 0) : null), link: '/consultancy/postings', hint: 'Across all jobs' },
      { key: 'interview', label: 'Interviews', icon: 'event_available', value: n(b?.interviewsThisWeek), link: '/consultancy/postings', hint: 'In the next 7 days' },
      { key: 'hired', label: 'Hired', icon: 'emoji_events', value: n(b?.hiredThisMonth), link: '/consultancy/postings', hint: 'Applicants marked hired, this month' },
      { key: 'placements', label: 'Placements', icon: 'verified', value: n(pl?.thisMonth), link: '/consultancy/placements', hint: pl ? `${pl.total} in all` : 'This month' },
      { key: 'fees', label: 'Fees due', icon: 'payments', value: pl ? this.money(pl.feeOutstanding) : '–', link: '/consultancy/placements',
        hint: pl ? `${this.money(pl.feePaidThisYear)} paid this year` : '' },
      { key: 'messages', label: 'Unread messages', icon: 'chat_bubble_outline', value: String(this.unreadMessages()), link: '/consultancy/messages', hint: 'From candidates' },
    ];
  });

  /** The open jobs with the most applicants first: where the work is. */
  readonly busyJobs = computed(() =>
    (this.postings() ?? [])
      .filter(p => p.status === 'Open')
      .sort((a, b) => b.applied - a.applied || b.shortlisted - a.shortlisted)
      .slice(0, 6));

  ngOnInit(): void {
    if (!this.auth.scopeState().companyId) {
      this.router.navigate(['/select-company']);
      return;
    }
    this.jobs.getPostings().subscribe({
      next: res => {
        if (res.success) this.postings.set(res.data ?? []);
        else { this.postings.set([]); this.unavailable.set(res.message || 'This application is not available right now'); }
      },
      error: err => {
        this.postings.set([]);
        this.unavailable.set(err?.status === 403 ? (err.error?.message || REFUSED) : '');
      },
    });
    this.jobs.getDashboard().subscribe({ next: res => this.board.set(res.success && res.data ? res.data : this.empty()), error: () => this.board.set(this.empty()) });
    this.consultancy.getPlacements().subscribe({ next: res => this.placements.set(res.success ? res.data ?? null : null), error: () => {} });
    this.consultancy.getClients().subscribe({
      next: res => this.activeClients.set(res.success ? (res.data ?? []).filter(c => c.isActive).length : null),
      error: () => {},
    });
    this.consultancy.getOwnCandidates('', 1).subscribe({ next: res => this.ownCandidates.set(res.success ? res.data?.total ?? 0 : null), error: () => {} });
    this.consultancy.getPostingMatchCounts().subscribe({
      next: res => {
        const map: Record<number, number> = {};
        for (const m of res.success ? res.data ?? [] : []) map[m.postingId] = m.suitable;
        this.suitable.set(map);
      },
      error: () => {},
    });
    this.messageAlerts.watch('company');
  }

  private empty(): CompanyDashboard {
    return { interviews: [], latest: [], newThisWeek: 0, interviewsThisWeek: 0, hiredThisMonth: 0, rejectedThisMonth: 0 };
  }

  money(value: number | null | undefined): string {
    return '₹' + Math.round(value ?? 0).toLocaleString('en-IN');
  }

  statusClass(status: string): string {
    return `db-status ${status.toLowerCase()}`;
  }

  /** "today", "yesterday", "3 days ago", else the date. */
  ago(value: string | null | undefined): string {
    const at = Date.parse(value ?? '');
    if (Number.isNaN(at)) return '';
    const days = Math.floor((Date.now() - at) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
