import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Which pages the server renders. Only the public job pages: search engines and link
 * previews get their full HTML (title, description, JobPosting data). Everything else
 * needs a login and the browser (it reads localStorage), so it stays client-only.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'jobs', renderMode: RenderMode.Server },
  { path: 'jobs/:id', renderMode: RenderMode.Server },
  { path: 'jobs/:id/:slug', renderMode: RenderMode.Server },
  // a shared profile: rendered so that a link preview shows the name (the page says noindex)
  { path: 'p/:code', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Client },
];
