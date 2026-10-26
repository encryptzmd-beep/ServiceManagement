import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/**
 * The public address of the site (https://www.example.com, no slash at the end), for canonical
 * links and the addresses in JSON-LD. In the browser it is where the page is; the page server
 * takes SITE_URL, else the address the request came to (app.config.server.ts).
 */
export const SITE_URL = new InjectionToken<string>('SITE_URL', {
  providedIn: 'root',
  factory: () => inject(DOCUMENT).location?.origin ?? '',
});

export const SITE_NAME = 'Encryptz Jobs';

export interface SeoPage {
  title: string;
  description: string;
  /** The address of the page relative to the site ("/jobs/12/accountant-kochi"). */
  path: string;
  /** false: search engines must not index the page (a job that is gone). */
  index?: boolean;
  /** schema.org data for the page, written as JSON-LD. */
  jsonLd?: object | object[];
}

/**
 * Title, description, canonical address, Open Graph / Twitter cards and JSON-LD of a public
 * page. The page server writes them into the HTML, so search engines and link previews
 * (WhatsApp, LinkedIn) see them without running the app.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);
  private site = inject(SITE_URL).replace(/\/+$/, '');

  url(path: string): string {
    return `${this.site}${path.startsWith('/') ? path : '/' + path}`;
  }

  set(page: SeoPage): void {
    const url = this.url(page.path);
    const description = page.description.replace(/\s+/g, ' ').trim().slice(0, 300);

    this.title.setTitle(page.title);
    this.tag('name', 'description', description);
    this.tag('name', 'robots', page.index === false ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1');

    this.tag('property', 'og:type', 'website');
    this.tag('property', 'og:site_name', SITE_NAME);
    this.tag('property', 'og:title', page.title);
    this.tag('property', 'og:description', description);
    this.tag('property', 'og:url', url);
    this.tag('property', 'og:image', this.url('/logo.png'));
    this.tag('name', 'twitter:card', 'summary');
    this.tag('name', 'twitter:title', page.title);
    this.tag('name', 'twitter:description', description);

    this.canonical(url);
    this.jsonLd(page.jsonLd);
  }

  /** Leaving a public page: nothing of it stays for the next page of the app. */
  clear(): void {
    for (const selector of ['name="description"', 'name="robots"', 'property="og:type"', 'property="og:site_name"', 'property="og:title"',
      'property="og:description"', 'property="og:url"', 'property="og:image"', 'name="twitter:card"', 'name="twitter:title"',
      'name="twitter:description"']) {
      this.meta.removeTag(selector);
    }
    this.doc.head.querySelector('link[rel="canonical"]')?.remove();
    this.doc.head.querySelector('script[data-seo="ld"]')?.remove();
  }

  private tag(attr: 'name' | 'property', key: string, content: string): void {
    this.meta.updateTag({ [attr]: key, content }, `${attr}="${key}"`);
  }

  private canonical(url: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /** A data block (not a script that runs): the Content Security Policy does not stop it. */
  private jsonLd(data: object | object[] | undefined): void {
    let script = this.doc.head.querySelector<HTMLScriptElement>('script[data-seo="ld"]');
    if (!data) { script?.remove(); return; }
    if (!script) {
      script = this.doc.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('data-seo', 'ld');
      this.doc.head.appendChild(script);
    }
    // "</" would end the block early: a job description is typed by a company
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  }
}
