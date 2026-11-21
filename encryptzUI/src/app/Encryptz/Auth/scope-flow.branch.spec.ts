import { branchToEnter } from './scope-flow';

describe('branchToEnter', () => {
  const main = { locationId: 1 };
  const north = { locationId: 2 };

  it('enters the only branch', () => {
    expect(branchToEnter([main], null)).toBe(main);
  });

  it('enters the first branch, without asking, when several are allowed', () => {
    expect(branchToEnter([main, north], null)).toBe(main);
  });

  it('enters the branch chosen before', () => {
    expect(branchToEnter([main, north], 2)).toBe(north);
  });

  it('enters the first branch when the one chosen before is no longer allowed', () => {
    expect(branchToEnter([main, north], 9)).toBe(main);
  });

  it('has nothing to enter without a branch', () => {
    expect(branchToEnter([], 2)).toBeNull();
  });
});
