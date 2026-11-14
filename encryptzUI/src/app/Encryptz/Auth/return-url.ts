/**
 * Where to go after signing in or registering, from `?next=` of the login and register links.
 * Only a page of Job Portal is taken (the public job pages send people there to apply):
 * any other value - another site, `//host`, a script - is dropped, so the link cannot
 * be used to send someone elsewhere after they signed in.
 */
export function safeNextUrl(value: string | null | undefined): string | null {
  const next = (value ?? '').trim();
  if (!next.startsWith('/apps/jobs')) return null;
  if (next.startsWith('//') || next.includes('\\') || /[\u0000-\u001f]/.test(next)) return null;
  return next;
}

/** The Job Portal page of one job, with the application open, after signing in. */
export function applyUrl(postingId: number): string {
  return `/apps/jobs/job/${postingId}?apply=1`;
}
