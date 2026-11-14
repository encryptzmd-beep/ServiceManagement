/**
 * Shares an address: the phone's share sheet (WhatsApp, LinkedIn, mail…) where there is one,
 * else the address is copied. `done(true)` when it was copied, `done(false)` when it could not
 * be; nothing is said when the share sheet opened (the person sees it).
 */
export function shareLink(url: string, title: string, done: (copied: boolean) => void): void {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  if (nav?.share && window.matchMedia?.('(pointer: coarse)').matches) {
    nav.share({ title, url }).catch(() => { /* closed without sharing */ });
    return;
  }
  if (nav?.clipboard) {
    nav.clipboard.writeText(url).then(() => done(true), () => done(false));
    return;
  }
  done(false);
}
