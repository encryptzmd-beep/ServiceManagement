import { Component, DestroyRef, Injector, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { applyUrl } from '../../Auth/return-url';
import { shareLink } from '../../Services/share-link';
import { JOB_EMPLOYMENT_TYPES, JOB_WORK_MODES, JobPostingView } from '../../Services/jobs-service';
import { PublicJobFilter, PublicJobsService, jobPath } from '../../Services/public-jobs-service';
import { SITE_NAME, SeoService } from '../../Services/seo-service';
import { dayLabel, experienceLabel, initial, salaryLabel, skillList } from '../../Services/job-labels';
import { PublicJobsShellComponent } from '../public-jobs-shell-component/public-jobs-shell-component';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';

/**
 * The public job list (/jobs): anybody can search and filter the open jobs, no login. The
 * filters live in the address (?q=&city=&type=&mode=&page=), so every search is a page of
 * its own that can be shared and that search engines can index; the server renders it.
 * Plain /jobs (nothing searched) shows only the search bar; the jobs come after Find jobs
 * (an empty search is ?q=, all open jobs). On a wide screen the list sits beside the job
 * picked from it; on a phone a job opens its own page.
 */
@Component({
  selector: 'app-public-jobs',
  standalone: true,
  imports: [FormsModule, RouterModule, PublicJobsShellComponent, VerifiedBadgeComponent],
  templateUrl: './public-jobs-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-board-component/job-board-component.scss',
    './public-jobs-component.scss',
  ],
})
export class PublicJobsComponent implements OnDestroy {
  private api = inject(PublicJobsService);
  private seo = inject(SeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private injector = inject(Injector);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly employmentTypes = JOB_EMPLOYMENT_TYPES;
  readonly workModes = JOB_WORK_MODES;

  loading = signal(true);
  error = signal('');
  items = signal<JobPostingView[]>([]);
  total = signal(0);
  pageSize = signal(20);

  /** What the address says now. */
  filter: PublicJobFilter = { q: '', city: '', type: '', mode: '', page: 1 };
  /** What is typed in the search bar, sent with Find jobs. */
  typedQ = '';
  typedCity = '';

  /** A search was made (the address has a filter, even an empty one); else only the search bar. */
  searched = signal(false);
  /** The job shown beside the list, with its description once loaded. */
  selected = signal<JobPostingView | null>(null);
  detailLoading = signal(false);
  copied = signal('');
  private details = new Map<number, JobPostingView>();

  readonly path = jobPath;
  readonly dayLabel = dayLabel;
  readonly experienceLabel = experienceLabel;
  readonly salaryLabel = salaryLabel;
  readonly skillList = skillList;
  readonly initial = initial;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(params => this.read(params));
  }

  ngOnDestroy(): void {
    this.seo.clear();
  }

  get lastPage(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize()));
  }

  get hasFilter(): boolean {
    return !!(this.filter.q || this.filter.city || this.filter.type || this.filter.mode);
  }

  /** "Accountant jobs in Kochi": the heading and the title say what was searched. */
  get heading(): string {
    const what = this.filter.q ? `${this.cap(this.filter.q)} jobs` : this.filter.type ? `${this.filter.type} jobs` : 'Jobs';
    const where = this.filter.city ? ` in ${this.cap(this.filter.city)}` : '';
    const mode = this.filter.mode === 'Remote' ? ' (remote)' : '';
    return `${what}${where}${mode}`;
  }

  // ── the address is the search ─────────────────────────────────────────────

  private read(params: ParamMap): void {
    const text = (key: string, max = 100) => (params.get(key) ?? '').trim().slice(0, max);
    const page = Number(params.get('page'));
    this.searched.set(['q', 'city', 'type', 'mode', 'page'].some(k => params.has(k)));
    this.filter = {
      q: text('q'),
      city: text('city'),
      type: (JOB_EMPLOYMENT_TYPES as string[]).includes(text('type')) ? text('type') : '',
      mode: (JOB_WORK_MODES as string[]).includes(text('mode')) ? text('mode') : '',
      page: Number.isInteger(page) && page > 1 ? page : 1,
    };
    this.typedQ = this.filter.q;
    this.typedCity = this.filter.city;
    if (this.searched()) { this.load(); return; }

    // nothing searched yet: only the search bar
    this.items.set([]);
    this.total.set(0);
    this.selected.set(null);
    this.loading.set(false);
    this.error.set('');
    this.describe();
  }

  private go(changes: Partial<PublicJobFilter>): void {
    const next = { ...this.filter, page: 1, ...changes };
    const any = next.q || next.city || next.type || next.mode;
    this.router.navigate(['/jobs'], {
      queryParams: {
        // an empty search still is a search: ?q= lists every open job
        q: next.q || (any ? null : ''),
        city: next.city || null, type: next.type || null, mode: next.mode || null,
        page: next.page > 1 ? next.page : null,
      },
    });
  }

  search(): void {
    this.go({ q: this.typedQ.trim(), city: this.typedCity.trim() });
  }

  setType(type: string): void {
    this.go({ type: type || '' });
  }

  setMode(mode: string): void {
    this.go({ mode: mode || '' });
  }

  clear(): void {
    this.typedQ = '';
    this.typedCity = '';
    this.go({ q: '', city: '', type: '', mode: '' });
  }

  /** The query of a page link (the filters as they are, another page). */
  pageQuery(page: number): Record<string, string | number | null> {
    const any = this.filter.q || this.filter.city || this.filter.type || this.filter.mode;
    return {
      q: this.filter.q || (any || page > 1 ? null : ''),
      city: this.filter.city || null, type: this.filter.type || null, mode: this.filter.mode || null,
      page: page > 1 ? page : null,
    };
  }

  // ── reading ───────────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    this.describe();

    this.api.search(this.filter).subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success || !res.data) { this.error.set(res.message || 'Jobs could not be loaded'); this.items.set([]); this.total.set(0); return; }
        this.error.set('');
        this.items.set(res.data.items ?? []);
        this.total.set(res.data.total ?? 0);
        this.pageSize.set(res.data.pageSize || 20);
        this.describe();
        const first = this.items()[0];
        this.selected.set(null);
        if (first && this.wide()) this.select(first);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Jobs could not be loaded. Please try again.');
        this.items.set([]);
        this.total.set(0);
      },
    });
  }

  // ── the job beside the list ───────────────────────────────────────────────

  /** Room for the list and the job side by side (the same width as the stylesheet). */
  private wide(): boolean {
    return this.browser && typeof window !== 'undefined' && window.matchMedia('(min-width: 860px)').matches;
  }

  /** A click on a job: on a wide screen it opens beside the list; on a phone (or a new tab) the job page. */
  pick(event: MouseEvent, job: JobPostingView): void {
    if (!this.wide() || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    this.select(job);
  }

  private select(job: JobPostingView): void {
    const known = this.details.get(job.postingId);
    this.selected.set(known ?? job);
    this.copied.set('');
    if (known) { this.detailLoading.set(false); return; }

    this.detailLoading.set(true);
    this.api.get(job.postingId).subscribe({
      next: res => {
        if (res.success && res.data) this.details.set(job.postingId, res.data);
        if (this.selected()?.postingId !== job.postingId) return;
        this.detailLoading.set(false);
        if (res.success && res.data) this.selected.set(res.data);
      },
      error: () => { if (this.selected()?.postingId === job.postingId) this.detailLoading.set(false); },
    });
  }

  /** Signed in: straight to the job in Job Portal (it opens with Apply). Else sign-in first. */
  apply(job: JobPostingView): void {
    const target = applyUrl(job.postingId);
    if (this.browser && this.injector.get(AuthService).isLoggedIn()) {
      this.router.navigateByUrl(target);
      return;
    }
    this.router.navigate(['/login'], { queryParams: { next: target } });
  }

  share(job: JobPostingView): void {
    shareLink(this.seo.url(jobPath(job)), job.title, ok => { this.copied.set(ok ? 'Link copied' : 'Copy the address of the page'); setTimeout(() => this.copied.set(''), 3000); });
  }

  /** Title, description, canonical address and the list as schema.org data. */
  private describe(): void {
    const query = new URLSearchParams();
    if (this.filter.q) query.set('q', this.filter.q);
    if (this.filter.city) query.set('city', this.filter.city);
    if (this.filter.type) query.set('type', this.filter.type);
    if (this.filter.mode) query.set('mode', this.filter.mode);
    if (this.filter.page > 1) query.set('page', String(this.filter.page));
    const path = `/jobs${query.toString() ? '?' + query.toString() : ''}`;

    const count = this.total();
    const page = this.filter.page > 1 ? ` - page ${this.filter.page}` : '';
    const description = count > 0
      ? `${count} open ${count === 1 ? 'job' : 'jobs'}${this.filter.city ? ' in ' + this.cap(this.filter.city) : ''}${this.filter.q ? ' for ' + this.filter.q : ''}. `
        + 'See salary, experience and the full job description, and apply with one free profile on Encryptz Jobs.'
      : 'Search open jobs by skill, title and city. See salary, experience and the full job description, and apply with one free profile.';

    this.seo.set({
      title: `${this.searched() ? this.heading + page : 'Find a job'} | ${SITE_NAME}`,
      description,
      path,
      // an empty search is not worth a place in a search engine
      index: !this.searched() || this.loading() || count > 0,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: this.seo.url('/jobs'),
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${this.seo.url('/jobs')}?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        },
        ...(this.searched() ? [{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: this.heading,
          numberOfItems: this.items().length,
          itemListElement: this.items().map((p, i) => ({
            '@type': 'ListItem',
            position: (this.filter.page - 1) * this.pageSize() + i + 1,
            url: this.seo.url(jobPath(p)),
            name: p.title,
          })),
        }] : []),
      ],
    });
  }

  private cap(text: string): string {
    return text.replace(/\b\p{L}/gu, c => c.toUpperCase());
  }
}
