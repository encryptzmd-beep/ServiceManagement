import { describe, expect, it } from 'vitest';
import { canWorkWithoutCheckIn } from './attendance-rule';

describe('attendance rule', () => {
  it('admin is never blocked', () => {
    expect(canWorkWithoutCheckIn(true, false, true)).toBe(true);
  });

  it('checked-in technician may work', () => {
    expect(canWorkWithoutCheckIn(false, true, true)).toBe(true);
  });

  it('technician without attendance may work', () => {
    expect(canWorkWithoutCheckIn(false, false, false)).toBe(true);
  });

  it('technician with attendance must check in', () => {
    expect(canWorkWithoutCheckIn(false, false, true)).toBe(false);
  });
});
