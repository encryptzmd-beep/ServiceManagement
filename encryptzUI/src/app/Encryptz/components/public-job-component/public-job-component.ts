import { Component, DestroyRef, Injector, OnDestroy, PLATFORM_ID, RESPONSE_INIT, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { applyUrl } from '../../Auth/return-url';
import { JobPostingView, JobsService } from '../../Services/jobs-service';
import { PublicJobsService, jobPath } from '../../Services/public-jobs-service';
import { SITE_NAME, SeoService } from '../../Services/seo-service';
import { dayLabel, experienceLabel, initial, salaryLabel, skillList } from '../../Services/job-labels';
import { PublicJobsShellComponent } from '../public-jobs-shell-component/public-jobs-shell-component';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';
import { shareLink } from '../../Services/share-link';

/** schema.org names of the employment types (Google for Jobs). */
const EMPLOYMENT_TYPE: Record<string, string> = {
  'Full-time': 'FULL_TIME', 'Part-time': 'PART_TIME', Contract: 'CONTRACTOR', Internship: 'INTERN',
};

/**
 * One public job (/jobs/:id/:slug): the full job description for anybody, no login. The
 * server renders it with JobPosting data, so it can appear in Google for Jobs. Applying needs
 * an account and a profile: Apply leads to sign-in (or registration) and back to the job.
 * A job that is closed or gone answers 404 and is not indexed.
 */
@Component({
  selector: 'app-public-job',
  standalone: true,
  imports: [RouterModule, PublicJobsShellComponent, VerifiedBadgeComponent],
  templateUrl: './public-job-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-board-component/job-board-component.scss',
    './public-job-component.scss',
  ],
})
export class PublicJobComponent implements OnDestroy {
  private api = inject(PublicJobsService);
  private seo = inject(SeoService);
  private router = inject(Router);
  private injector = inject(Injector);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));
  private response = inject(RESPONSE_INIT, { optional: true });

  loading = signal(true);
  job = signal<JobPostingView | null>(null);
  missing = signal(false);
  error = signal('');
  /** "Similar jobs": links to the jobs most like this one (for people, and for search engines to follow). */
  related = signal<JobPostingView[]>([]);
  /** Signed in (known in the browser only) and whether the person applied to this job already. */
  signedIn = signal(false);
  applied = signal(false);
  readonly path = jobPath;

  readonly dayLabel = dayLabel;
  readonly experienceLabel = experienceLabel;
  readonly salaryLabel = salaryLabel;
  readonly skillList = skillList;
  readonly initial = initial;

  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(params => {
      const id = Number(params.get('id'));
      if (Number.isInteger(id) && id > 0) this.load(id);
      else this.notFound();
    });
  }

  ngOnDestroy(): void {
    this.seo.clear();
  }

  load(id: number): void {
    this.loading.set(true);
    this.missing.set(false);
    this.error.set('');

    this.api.get(id).subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success || !res.data) { this.notFound(); return; }
        this.job.set(res.data);
        this.describe(res.data);
        this.loadRelated(id);
        this.loadMine(id);
      },
      error: err => {
        this.loading.set(false);
        if (err?.status === 404) { this.notFound(); return; }
        this.error.set('This job could not be loaded. Please try again.');
      },
    });
  }

  /** A page without similar jobs is still a whole page: a failure only leaves the list empty. */
  private loadRelated(id: number): void {
    this.related.set([]);
    this.api.related(id).subscribe({
      next: res => this.related.set(res.success ? (res.data ?? []).filter(p => p.postingId !== id) : []),
      error: () => this.related.set([]),
    });
  }

  /** In the browser, signed in: has the person applied already? The button then says so. */
  private loadMine(id: number): void {
    this.applied.set(false);
    if (!this.browser) return;
    try { if (!this.injector.get(AuthService).isLoggedIn()) return; } catch { return; }
    this.signedIn.set(true);
    this.injector.get(JobsService).getApplications().subscribe({
      next: res => this.applied.set(res.success && (res.data ?? []).some(a => a.postingId === id && a.status !== 'Withdrawn')),
      error: () => this.applied.set(false),
    });
  }

  /** A closed or unknown job: a real 404, so search engines drop the page. */
  private notFound(): void {
    this.loading.set(false);
    this.job.set(null);
    this.related.set([]);
    this.missing.set(true);
    if (this.response) this.response.status = 404;
    this.seo.set({
      title: `Job not found | ${SITE_NAME}`,
      description: 'This job is closed or no longer published. Search the open jobs on Encryptz Jobs.',
      path: '/jobs',
      index: false,
    });
  }

  // ── applying needs an account ─────────────────────────────────────────────

  /** Signed in: straight to the job in Job Portal (it opens with Apply). Else sign-in first. */
  apply(job: JobPostingView): void {
    // applied already: the job in Job Portal shows the application, not a second form
    const target = this.applied() ? `/apps/jobs/job/${job.postingId}` : applyUrl(job.postingId);
    if (this.browser && this.injector.get(AuthService).isLoggedIn()) {
      this.router.navigateByUrl(target);
      return;
    }
    this.router.navigate(['/login'], { queryParams: { next: target } });
  }

  /** The address of this page: the phone's share sheet, else copied. */
  share(job: JobPostingView): void {
    shareLink(this.seo.url(jobPath(job)), job.title, ok => { this.copied.set(ok ? 'Link copied' : 'Copy the address of the page'); setTimeout(() => this.copied.set(''), 3000); });
  }

  copied = signal('');

  registerQuery(job: JobPostingView): Record<string, string> {
    return { next: applyUrl(job.postingId) };
  }

  // ── what search engines read ──────────────────────────────────────────────

  private describe(p: JobPostingView): void {
    const where = p.city ? ` in ${p.city}` : '';
    const pay = salaryLabel(p);
    const summary = (p.description || '').replace(/\s+/g, ' ').trim();
    const description = `${p.title} job at ${p.companyName}${where}. ${p.employmentType}, ${p.workMode}`
      + `${experienceLabel(p) ? ', ' + experienceLabel(p) : ''}${pay ? ', ' + pay : ''}. ${summary}`;

    const url = this.seo.url(jobPath(p));
    const posting: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: p.title,
      // the description as plain paragraphs: line breaks of the company kept
      description: this.htmlParagraphs(p.description || p.title),
      identifier: { '@type': 'PropertyValue', name: SITE_NAME, value: String(p.postingId) },
      datePosted: (p.publishedAt || '').slice(0, 10) || undefined,
      validThrough: p.closesOn ? `${p.closesOn.slice(0, 10)}T23:59:59` : undefined,
      employmentType: EMPLOYMENT_TYPE[p.employmentType] ?? undefined,
      hiringOrganization: { '@type': 'Organization', name: p.companyName },
      jobLocation: {
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressLocality: p.city || undefined, addressCountry: 'IN' },
      },
      skills: skillList(p.skills, 30).join(', ') || undefined,
      url,
    };

    if (p.workMode === 'Remote') {
      posting['jobLocationType'] = 'TELECOMMUTE';
      posting['applicantLocationRequirements'] = { '@type': 'Country', name: 'India' };
    }
    if (p.salaryMin != null || p.salaryMax != null) {
      posting['baseSalary'] = {
        '@type': 'MonetaryAmount',
        currency: 'INR',
        value: {
          '@type': 'QuantitativeValue',
          minValue: p.salaryMin ?? undefined,
          maxValue: p.salaryMax ?? undefined,
          value: p.salaryMin == null || p.salaryMax == null ? (p.salaryMin ?? p.salaryMax) : undefined,
          unitText: 'MONTH',
        },
      };
    }
    if (p.experienceMinYears != null && p.experienceMinYears > 0) {
      posting['experienceRequirements'] = { '@type': 'OccupationalExperienceRequirements', monthsOfExperience: p.experienceMinYears * 12 };
    } else if (p.experienceMinYears === 0) {
      posting['experienceRequirements'] = 'no requirements';
    }

    this.seo.set({
      title: `${p.title}${where} - ${p.companyName} | ${SITE_NAME}`,
      description,
      path: jobPath(p),
      jsonLd: [
        posting,
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Jobs', item: this.seo.url('/jobs') },
            ...(p.city ? [{ '@type': 'ListItem', position: 2, name: `Jobs in ${p.city}`, item: this.seo.url(`/jobs?city=${encodeURIComponent(p.city)}`) }] : []),
            { '@type': 'ListItem', position: p.city ? 3 : 2, name: p.title, item: url },
          ],
        },
      ],
    });
  }

  /** Plain text as HTML paragraphs, escaped (the text is typed by a company). */
  private htmlParagraphs(text: string): string {
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return text.split(/\n{2,}/).map(block => `<p>${escape(block.trim()).replace(/\n/g, '<br>')}</p>`).join('');
  }
}
