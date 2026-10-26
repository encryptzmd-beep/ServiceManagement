import { applyUrl, safeNextUrl } from './return-url';
import { jobPath, jobSlug } from '../Services/public-jobs-service';

describe('the page to come back to after signing in', () => {
  it('takes a page of Job Portal', () => {
    expect(safeNextUrl('/apps/jobs/search?posting=7')).toBe('/apps/jobs/search?posting=7');
    expect(safeNextUrl(applyUrl(42))).toBe('/apps/jobs/search?posting=42');
  });

  it('drops anything that could send someone elsewhere', () => {
    for (const bad of ['https://evil.example/apps/jobs', '//evil.example', '/\\evil.example', '/settings/platform',
      'javascript:alert(1)', '/apps/jobs\u0000', '', null, undefined]) {
      expect(safeNextUrl(bad as string)).toBeNull();
    }
  });
});

describe('the address of a public job', () => {
  it('is the id and a readable slug of the title and the city', () => {
    expect(jobPath({ postingId: 7, title: 'Accountant', city: 'Ernakulam' })).toBe('/jobs/7/accountant-ernakulam');
    expect(jobSlug('Sr. C# / .NET Developer', 'Kochi')).toBe('sr-c-net-developer-kochi');
    expect(jobSlug('Café Manager')).toBe('cafe-manager');
  });

  it('is never empty and never too long', () => {
    expect(jobSlug('***', '')).toBe('job');
    expect(jobSlug('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});
