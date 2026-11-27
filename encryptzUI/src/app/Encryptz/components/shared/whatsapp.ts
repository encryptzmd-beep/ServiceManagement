/**
 * WhatsApp without an API: a wa.me link opens the chat with a typed message, and the person attaches the PDF
 * that was just downloaded and presses Send.
 */

/** "919876543210" for WhatsApp from an Indian mobile as typed; '' when it is not one. */
export function whatsAppNumber(mobile: string | null | undefined): string {
  const digits = (mobile ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return '';
}

/** https://wa.me/919876543210?text=... (without a number WhatsApp asks whom to send it to). */
export function whatsAppUrl(mobile: string | null | undefined, text: string): string {
  return `https://wa.me/${whatsAppNumber(mobile)}?text=${encodeURIComponent(text)}`;
}

/**
 * A blank tab opened during the click itself: a tab opened after an await (a PDF being made) is blocked as a
 * popup. Point it at the chat with `go`, or `close` it when the work fails.
 */
export function openPendingTab(): { go: (url: string) => void; close: () => void } {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  return {
    go: url => { if (tab && !tab.closed) tab.location.href = url; else window.open(url, '_blank', 'noopener'); },
    close: () => tab?.close(),
  };
}
