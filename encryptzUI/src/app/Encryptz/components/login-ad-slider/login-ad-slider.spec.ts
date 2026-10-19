import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LoginAd, LoginAdService, loginAdImageUrl } from '../../Services/login-ad-service';
import { LoginAdSliderComponent } from './login-ad-slider';

describe('LoginAdSliderComponent', () => {
  const ad = (id: number, extra: Partial<LoginAd> = {}): LoginAd => ({
    loginAdId: id, tag: 'New', title: 'Title ' + id, body: 'Body ' + id, buttonText: 'Go', linkUrl: 'https://encryptz.com', imageVersion: 1, ...extra,
  });

  let calls: number;
  let narrow: boolean;
  let originalMatchMedia: typeof window.matchMedia;

  const create = (response: any) => {
    TestBed.resetTestingModule();
    calls = 0;
    TestBed.configureTestingModule({
      imports: [LoginAdSliderComponent],
      providers: [{
        provide: LoginAdService,
        useValue: { list: () => { calls++; return response; }, imageUrl: loginAdImageUrl },
      }],
    });
    const fixture = TestBed.createComponent(LoginAdSliderComponent);
    fixture.detectChanges();
    return fixture;
  };
  const el = (f: any): HTMLElement => f.nativeElement;

  beforeEach(() => {
    narrow = false;
    originalMatchMedia = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes('max-width') ? narrow : false, media: q, addEventListener() {}, removeEventListener() {} })) as any;
  });
  afterEach(() => { window.matchMedia = originalMatchMedia; });

  it('shows the fallback slide when there are no ads', () => {
    const f = create(of({ success: true, message: '', data: [] }));
    expect(el(f).textContent).toContain('Enterprise Resource Planning Platform');
    expect(el(f).querySelector('img.ad-img')).toBeNull();
  });

  it('shows the fallback slide when the request fails', () => {
    const f = create(throwError(() => new Error('down')));
    expect(el(f).textContent).toContain('Enterprise Resource Planning Platform');
  });

  it('has no dots, arrows or counter with one ad', () => {
    const f = create(of({ success: true, message: '', data: [ad(1)] }));
    expect(el(f).querySelector('img.ad-img')).not.toBeNull();
    expect(el(f).querySelector('.slide-dots')).toBeNull();
    expect(el(f).querySelector('[aria-label="Next slide"]')).toBeNull();
    expect(el(f).querySelector('.slide-count')).toBeNull();
  });

  it('wraps next from the last to the first and prev from the first to the last', () => {
    const f = create(of({ success: true, message: '', data: [ad(1), ad(2), ad(3)] }));
    const c = f.componentInstance;
    expect(el(f).querySelector('.slide-count')!.textContent).toContain('1 / 3');
    c.prev();
    expect(c.current()!.loginAdId).toBe(3);
    c.next();
    expect(c.current()!.loginAdId).toBe(1);
    (el(f).querySelector('[aria-label="Next slide"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el(f).querySelector('.slide-title')!.textContent).toContain('Title 2');
  });

  it('hides tag, title, body and button when they are empty', () => {
    const f = create(of({ success: true, message: '', data: [ad(1, { tag: '', title: '', body: '', buttonText: '', linkUrl: '' })] }));
    for (const sel of ['.slide-tag', '.slide-title', '.slide-body', 'a.slide-cta', '.slide-shade']) {
      expect(el(f).querySelector(sel)).toBeNull();
    }
  });

  it('does not render a javascript: link', () => {
    const f = create(of({ success: true, message: '', data: [ad(1, { buttonText: 'Go', linkUrl: 'javascript:alert(1)' })] }));
    expect(el(f).querySelector('a.slide-cta')).toBeNull();
  });

  it('opens a safe link in a new tab without an opener', () => {
    const f = create(of({ success: true, message: '', data: [ad(1)] }));
    const a = el(f).querySelector('a.slide-cta') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('https://encryptz.com');
    expect(a.target).toBe('_blank');
    expect(a.rel).toContain('noopener');
  });

  it('does not fetch on a narrow screen', () => {
    narrow = true;
    create(of({ success: true, message: '', data: [ad(1)] }));
    expect(calls).toBe(0);
  });

  it('builds the image url with the version', () => {
    const f = create(of({ success: true, message: '', data: [ad(7, { imageVersion: 3 })] }));
    expect((el(f).querySelector('img.ad-img') as HTMLImageElement).getAttribute('src')).toMatch(/\/api\/loginads\/7\/image\?v=3$/);
  });
});
