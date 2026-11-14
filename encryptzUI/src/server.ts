import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { environment } from './environments/environment.development';
import { jobPath } from './app/Encryptz/Services/public-jobs-service';

/**
 * The page server. It renders the public job pages (/jobs) for search engines and link
 * previews, serves /sitemap.xml and /robots.txt for them, and hands every other page of the
 * app to the browser as before (app.routes.server.ts).
 *
 * Settings (environment variables):
 *   PORT              the port to listen on (4000)
 *   SITE_URL          the public address of the site, e.g. https://jobs.encryptz.in - the
 *                     addresses in the sitemap and the canonical links. Set it in production.
 *   API_URL           the API, if the server reaches it on another address than the browser
 *   NG_ALLOWED_HOSTS  the host names the site answers to (comma separated); see angular.json
 */
const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const setting = (name: string) => (process.env[name] ?? '').trim();
const apiUrl = () => (setting('API_URL') || environment.apiUrl).replace(/\/+$/, '');

/** The public address of the site: SITE_URL, else the address of the request. */
function siteUrl(req: express.Request): string {
  return (setting('SITE_URL') || `${req.protocol}://${req.get('host') ?? 'localhost'}`).replace(/\/+$/, '');
}

const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Search engines may read the public job pages; the app behind a login is none of theirs. */
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send([
    'User-agent: *',
    'Allow: /jobs',
    'Disallow: /apps/',
    'Disallow: /consultancy/',
    'Disallow: /settings/',
    'Disallow: /customer/',
    'Disallow: /login',
    'Disallow: /register',
    '',
    `Sitemap: ${siteUrl(req)}/sitemap.xml`,
    '',
  ].join('\n'));
});

/** Every open job, from the API (it keeps the list for ten minutes). */
app.get('/sitemap.xml', async (req, res) => {
  const site = siteUrl(req);
  const urls = [`  <url><loc>${xml(site)}/jobs</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`];

  try {
    const answer = await fetch(`${apiUrl()}/api/public/jobs/sitemap`, { signal: AbortSignal.timeout(10_000) });
    const body = answer.ok ? await answer.json() as { success: boolean; data?: { postingId: number; title: string; city: string; updatedAt: string }[] } : null;
    for (const job of body?.success ? body.data ?? [] : []) {
      const updated = /^\d{4}-\d{2}-\d{2}/.test(job.updatedAt ?? '') ? `<lastmod>${job.updatedAt.slice(0, 10)}</lastmod>` : '';
      urls.push(`  <url><loc>${xml(site + jobPath(job))}</loc>${updated}<changefreq>daily</changefreq><priority>0.8</priority></url>`);
    }
  } catch (error) {
    // the API did not answer: the sitemap still names the job list
    console.error('sitemap: the job list could not be read', error);
  }

  res.type('application/xml').set('Cache-Control', 'public, max-age=600').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
});

/** The files of the app (scripts, styles, images): kept by browsers for a year, their names change with every build. */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/** Every page: the public job pages rendered here, the rest handed to the browser. */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Encryptz page server listening on http://localhost:${port}`);
  });
}

/** The request handler for the Angular CLI (dev server, build) and for hosting functions. */
export const reqHandler = createNodeRequestHandler(app);
