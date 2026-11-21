/** Host the failed request went to, so the message says which server did not answer. */
function serverName(err: any): string {
  try {
    return new URL(err?.url || window.location.href, window.location.href).host;
  } catch {
    return 'the server';
  }
}

/**
 * What to tell the user about a failed API call: the server's own message when it sent one,
 * otherwise what actually went wrong (no connection, gateway down, server error).
 */
export function apiErrorMessage(err: any, fallback: string): string {
  const host = serverName(err);

  if (err?.status === 0) {
    return `Cannot reach the server (${host}). Check that the API is running and your internet connection is working.`;
  }
  if (err?.name === 'TimeoutError') {
    return `The server (${host}) took too long to answer. Please try again.`;
  }
  if (err?.status === 429) return 'Too many attempts. Please try again later.';

  const message = err?.error?.message;
  if (typeof message === 'string' && message.trim()) return message;

  if (err?.status === 502 || err?.status === 503 || err?.status === 504) {
    return `The API at ${host} is not available right now (error ${err.status}). Please try again shortly.`;
  }
  if (err?.status === 404) return `The server (${host}) does not have this service (error 404).`;
  if (err?.status >= 500) return `The server (${host}) had a problem (error ${err.status}). Please try again.`;
  return err?.status ? `${fallback} (error ${err.status})` : fallback;
}
