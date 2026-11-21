import { apiErrorMessage } from './api-error';

describe('apiErrorMessage', () => {
  const url = 'http://localhost:5092/api/auth/login-v2';

  it('names the server when it cannot be reached', () => {
    const text = apiErrorMessage({ status: 0, url }, 'Login failed.');
    expect(text).toContain('Cannot reach the server (localhost:5092)');
  });

  it('says when the server took too long', () => {
    expect(apiErrorMessage({ name: 'TimeoutError' }, 'Login failed.')).toContain('took too long');
  });

  it('prefers the message sent by the server', () => {
    expect(apiErrorMessage({ status: 400, url, error: { message: 'Account is locked' } }, 'Login failed.')).toBe('Account is locked');
  });

  it('explains a gateway failure, a missing service and a server error', () => {
    expect(apiErrorMessage({ status: 502, url }, 'x')).toContain('not available right now (error 502)');
    expect(apiErrorMessage({ status: 404, url }, 'x')).toContain('error 404');
    expect(apiErrorMessage({ status: 500, url }, 'x')).toContain('had a problem (error 500)');
  });

  it('explains too many attempts', () => {
    expect(apiErrorMessage({ status: 429, url }, 'x')).toBe('Too many attempts. Please try again later.');
  });

  it('keeps the fallback, with the status, for anything else', () => {
    expect(apiErrorMessage({ status: 403, url }, 'Login failed.')).toBe('Login failed. (error 403)');
    expect(apiErrorMessage({}, 'Login failed.')).toBe('Login failed.');
  });
});
