import { ApplicationConfig, REQUEST, inject, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { PUBLIC_API_URL } from './Encryptz/Services/public-jobs-service';
import { SITE_URL } from './Encryptz/Services/seo-service';
import { environment } from '../environments/environment.development';

/** A setting of the page server's environment ('' when it is not set). */
function setting(name: string): string {
  return (typeof process !== 'undefined' ? process.env[name] : undefined)?.trim() ?? '';
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // the public address of the site: SITE_URL, else the address the request came to (the
    // host is one of allowedHosts, angular.json / NG_ALLOWED_HOSTS, or the page is not rendered)
    {
      provide: SITE_URL,
      useFactory: () => {
        const configured = setting('SITE_URL');
        if (configured) return configured;
        const request = inject(REQUEST, { optional: true });
        return request ? new URL(request.url).origin : '';
      },
    },
    // the page server may reach the API on an inner address
    { provide: PUBLIC_API_URL, useFactory: () => setting('API_URL') || environment.apiUrl },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
