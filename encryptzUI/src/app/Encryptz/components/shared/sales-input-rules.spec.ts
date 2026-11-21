import { isEmailOrBlank, isPinOrBlank, normalizeMobile, statusText, todayInIndia } from './sales-input-rules';

describe('sales input rules', () => {
  it('accepts a 10-digit mobile, with or without +91', () => {
    expect(normalizeMobile('9000011201')).toBe('9000011201');
    expect(normalizeMobile('+91 90000 11201')).toBe('9000011201');
    expect(normalizeMobile('09000011201')).toBe('9000011201');
  });

  it('refuses any other mobile', () => {
    for (const bad of ['90000112011', '1000011201', '12345', 'abcdefghij', '']) expect(normalizeMobile(bad)).toBeNull();
  });

  it('checks e-mail and PIN only when they are filled', () => {
    expect(isEmailOrBlank('')).toBe(true);
    expect(isEmailOrBlank('priya.menon')).toBe(false);
    expect(isPinOrBlank('682024')).toBe(true);
    expect(isPinOrBlank('ABCDEF')).toBe(false);
  });

  it('gives the date in India', () => {
    expect(todayInIndia(new Date('2026-11-21T19:00:00Z'))).toBe('2026-11-22');
  });

  it('spaces a status', () => {
    expect(statusText('WorkCompleted')).toBe('Work Completed');
    expect(statusText('New')).toBe('New');
  });
});
