import { Component, DestroyRef, OnDestroy, PLATFORM_ID, RESPONSE_INIT, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { JobExperience } from '../../Services/jobs-service';
import { PublicProfile, PublicProfileService } from '../../Services/public-profile-service';
import { SITE_NAME, SeoService } from '../../Services/seo-service';
import { initial } from '../../Services/job-labels';
import { PublicJobsShellComponent } from '../public-jobs-shell-component/public-jobs-shell-component';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A profile a person shared (/p/:code), for anybody with the link. The server renders it so
 * that a link sent on WhatsApp or LinkedIn shows the name and the headline; search engines
 * are told not to index it. A link that is off answers 404.
 */
@Component({
  selector: 'app-public-profile',
  standalone: true,
  imports: [RouterModule, PublicJobsShellComponent, VerifiedBadgeComponent],
  templateUrl: './public-profile-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-board-component/job-board-component.scss',
    './public-profile-component.scss',
  ],
})
export class PublicProfileComponent implements OnDestroy {
  private api = inject(PublicProfileService);
  private seo = inject(SeoService);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));
  private response = inject(RESPONSE_INIT, { optional: true });

  loading = signal(true);
  profile = signal<PublicProfile | null>(null);
  missing = signal(false);
  photoUrl = signal<string | null>(null);

  readonly initial = initial;

  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(params => this.load(params.get('code') ?? ''));
  }

  ngOnDestroy(): void {
    this.seo.clear();
    this.showPhoto(null);
  }

  private load(code: string): void {
    this.loading.set(true);
    this.api.get(code).subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success || !res.data) { this.notFound(); return; }
        this.profile.set(res.data);
        this.describe(res.data, code);
        // the photo comes as an image of the API: only in the browser, never in the page HTML
        if (res.data.hasPhoto && this.browser) {
          this.api.photo(code).subscribe({ next: blob => this.showPhoto(URL.createObjectURL(blob)), error: () => this.showPhoto(null) });
        }
      },
      error: () => { this.loading.set(false); this.notFound(); },
    });
  }

  private notFound(): void {
    this.profile.set(null);
    this.missing.set(true);
    if (this.response) this.response.status = 404;
    this.seo.set({ title: `Profile not found | ${SITE_NAME}`, description: 'This profile is not shared, or its link was switched off.', path: '/jobs', index: false });
  }

  private describe(p: PublicProfile, code: string): void {
    const where = p.city ? ` · ${p.city}` : '';
    this.seo.set({
      title: `${p.fullName} - ${p.headline} | ${SITE_NAME}`,
      description: `${p.headline}${where}. ${(p.summary || '').replace(/\s+/g, ' ').trim()}`,
      path: `/p/${code}`,
      // shared with a link, never listed by search engines
      index: false,
    });
  }

  private showPhoto(url: string | null): void {
    const old = this.photoUrl();
    if (old) URL.revokeObjectURL(old);
    this.photoUrl.set(url);
  }

  // ── what the template shows ───────────────────────────────────────────────

  monthLabel(value: string | null | undefined): string {
    if (!/^\d{4}-\d{2}/.test(value ?? '')) return '';
    const [y, m] = (value as string).slice(0, 7).split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }

  period(e: JobExperience): string {
    return `${this.monthLabel(e.startMonth)} – ${e.endMonth ? this.monthLabel(e.endMonth) : 'Present'}`;
  }

  years(d: { startYear?: number | null; endYear?: number | null }): string {
    if (d.startYear && d.endYear) return `${d.startYear} – ${d.endYear}`;
    return d.endYear ? `${d.endYear}` : d.startYear ? `from ${d.startYear}` : '';
  }

  subSkills(s: { subSkills: { name: string }[] }): string {
    return (s.subSkills ?? []).map(x => x.name).join(', ');
  }

  stars(rating: number): number[] {
    return [1, 2, 3, 4, 5].map(n => (n <= Math.round(rating) ? 1 : 0));
  }
}
