import { describe, expect, it } from 'vitest';
import { isNoChargeJob } from './no-charge-job';

describe('no-charge job', () => {
  it('a warranty job closes without a bill', () => {
    expect(isNoChargeJob({ isWarranty: true, natureOfJob: 'Repair' })).toBe(true);
  });

  it('an installation closes without a bill', () => {
    expect(isNoChargeJob({ isWarranty: false, natureOfJob: 'Installation' })).toBe(true);
    expect(isNoChargeJob({ natureOfJob: ' installation ' })).toBe(true);
  });

  it('a paid repair still needs its payment', () => {
    expect(isNoChargeJob({ isWarranty: false, natureOfJob: 'Repair' })).toBe(false);
    expect(isNoChargeJob({})).toBe(false);
  });

  it('no job is not free', () => {
    expect(isNoChargeJob(null)).toBe(false);
    expect(isNoChargeJob(undefined)).toBe(false);
  });
});
