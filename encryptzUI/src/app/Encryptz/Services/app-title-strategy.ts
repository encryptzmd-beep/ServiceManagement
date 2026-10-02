import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const APP_NAME = 'Encryptz ERP';

/**
 * Browser tab title per page: "<page> - <company>".
 * The page part is the `title` of the route; in the customer portal the company
 * is the tenant the portal was opened for, elsewhere the application name.
 * Routes without a title keep the plain application name.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    if (!page) {
      this.title.setTitle(APP_NAME);
      return;
    }

    const tenant = snapshot.url.startsWith('/customer')
      ? localStorage.getItem('customer_company_name')
      : null;
    this.title.setTitle(`${page} - ${tenant || APP_NAME}`);
  }
}
