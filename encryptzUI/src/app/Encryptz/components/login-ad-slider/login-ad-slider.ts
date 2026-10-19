// Encryptz/components/login-ad-slider/login-ad-slider.ts
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { LoginAd, LoginAdService } from '../../Services/login-ad-service';

/**
 * The advertisement slider on the left of the sign-in and register pages. The slides
 * come from Platform Admin › Login Ads; without any, one plain brand slide shows.
 * It never holds up the form next to it: until the slides arrive, and when they
 * cannot be read, the brand slide shows. On a narrow screen it is hidden by the page,
 * so the slides are not fetched at all.
 */
@Component({
  selector: 'app-login-ad-slider',
  standalone: true,
  templateUrl: './login-ad-slider.html',
  styleUrls: ['./login-ad-slider.scss']
})
export class LoginAdSliderComponent implements OnInit, OnDestroy {
  private service = inject(LoginAdService);

  static readonly IntervalMs = 5000;

  ads = signal<LoginAd[]>([]);
  index = signal(0);
  current = computed(() => this.ads()[this.index()] ?? null);
  many = computed(() => this.ads().length > 1);

  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;

  ngOnInit(): void {
    if (this.matches('(max-width: 820px)')) return;

    this.service.list().subscribe({
      next: res => {
        this.ads.set(res?.success && Array.isArray(res.data) ? res.data : []);
        this.index.set(0);
        this.start();
      },
      error: () => this.ads.set([])
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }

  next(): void { this.go(this.index() + 1); }
  prev(): void { this.go(this.index() - 1); }

  go(i: number): void {
    const n = this.ads().length;
    if (n === 0) return;
    this.index.set(((i % n) + n) % n);
  }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }

  imageUrl(ad: LoginAd): string {
    return this.service.imageUrl(ad);
  }

  /** The link of a slide only when it is an http or https address; anything else is not a link. */
  safeLink(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : null;
    } catch {
      return null;
    }
  }

  hasText(ad: LoginAd): boolean {
    return !!(ad.tag || ad.title || ad.body || this.cta(ad));
  }

  /** The button of a slide: needs both its text and a safe link. */
  cta(ad: LoginAd): string | null {
    return ad.buttonText ? this.safeLink(ad.linkUrl) : null;
  }

  private start(): void {
    this.stop();
    if (!this.many() || this.matches('(prefers-reduced-motion: reduce)')) return;
    this.timer = setInterval(() => { if (!this.paused) this.next(); }, LoginAdSliderComponent.IntervalMs);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private matches(query: string): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  }
}
