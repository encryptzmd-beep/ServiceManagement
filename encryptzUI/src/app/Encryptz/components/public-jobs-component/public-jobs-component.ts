import { Component, DestroyRef, OnDestroy, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
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

  readonly employmentTypes = JOB_EMPLOYMENT_TYPES;
  readonly workModes = JOB_WORK_MODES;

  loading = signal(true);
  error = signal('');
  items = signal<JobPostingView[]>([]);
  total = signal(0);
  pageSize = signal(20);

  /** What the address says now. */
  filter: PublicJobFilter = { q: '', city: '', type: '', mode: '', page: 1 };
  /** What is typed in the search bar, sent with Search. */
  typedQ = '';
  typedCity = '';
  filtersOpen = signal(false);

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
    this.filter = {
      q: text('q'),
      city: text('city'),
      type: (JOB_EMPLOYMENT_TYPES as string[]).includes(text('type')) ? text('type') : '',
      mode: (JOB_WORK_MODES as string[]).includes(text('mode')) ? text('mode') : '',
      page: Number.isInteger(page) && page > 1 ? page : 1,
    };
    this.typedQ = this.filter.q;
    this.typedCity = this.filter.city;
    this.load();
  }

  private go(changes: Partial<PublicJobFilter>): void {
    const next = { ...this.filter, page: 1, ...changes };
    this.router.navigate(['/jobs'], {
      queryParams: {
        q: next.q || null, city: next.city || null, type: next.type || null, mode: next.mode || null,
        page: next.page > 1 ? next.page : null,
      },
    });
  }

  search(): void {
    this.go({ q: this.typedQ.trim(), city: this.typedCity.trim() });
  }

  setType(type: string): void {
    this.go({ type: this.filter.type === type ? '' : type });
  }

  setMode(mode: string): void {
    this.go({ mode: this.filter.mode === mode ? '' : mode });
  }

  clear(): void {
    this.typedQ = '';
    this.typedCity = '';
    this.go({ q: '', city: '', type: '', mode: '' });
  }

  /** The query of a page link (the filters as they are, another page). */
  pageQuery(page: number): Record<string, string | number | null> {
    return {
      q: this.filter.q || null, city: this.filter.city || null, type: this.filter.type || null, mode: this.filter.mode || null,
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
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Jobs could not be loaded. Please try again.');
        this.items.set([]);
        this.total.set(0);
      },
    });
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
      title: `${this.heading}${page} | ${SITE_NAME}`,
      description,
      path,
      // an empty search is not worth a place in a search engine
      index: this.loading() || count > 0,
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
        {
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
        },
      ],
    });
  }

  private cap(text: string): string {
    return text.replace(/\b\p{L}/gu, c => c.toUpperCase());
  }
}
