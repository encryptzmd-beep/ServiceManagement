import { branchToEnter } from './scope-flow';

describe('branchToEnter', () => {
  const main = { locationId: 1 };
  const north = { locationId: 2 };

  it('enters the only branch', () => {
    expect(branchToEnter([main], null)).toBe(main);
  });

  it('asks the first time when there are several', () => {
    expect(branchToEnter([main, north], null)).toBeNull();
  });

  it('enters the branch chosen before', () => {
    expect(branchToEnter([main, north], 2)).toBe(north);
  });

  it('asks again when the branch chosen before is no longer allowed', () => {
    expect(branchToEnter([main, north], 9)).toBeNull();
  });
});
