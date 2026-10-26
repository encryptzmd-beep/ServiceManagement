import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './Encryptz/Auth/auth-interceptor';
import { AppTitleStrategy } from './Encryptz/Services/app-title-strategy';
import { provideClientHydration } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // the public job pages come rendered from the server (app.routes.server.ts); no event
    // replay: it needs an inline script, which the Content Security Policy of index.html refuses
    provideClientHydration(),
  ],
};
