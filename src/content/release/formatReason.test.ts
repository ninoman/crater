import { describe, expect, it } from 'vitest';
import { formatOverlap, formatReason } from './formatReason';

describe('formatReason', () => {
  it.each([
    [{ kind: 'co-owned', owners: 7, crateMates: 0 } as const, '7 supporters have this so far'],
    [
      { kind: 'co-owned', owners: 7, crateMates: 1 } as const,
      '7 supporters have this so far, 1 is your crate mate',
    ],
    [
      { kind: 'co-owned', owners: 7, crateMates: 2 } as const,
      '7 supporters have this so far, 2 are your crate mates',
    ],
    [{ kind: 'same-artist' } as const, 'More from this artist'],
    [{ kind: 'same-label', label: 'Luaka Bop' } as const, 'Also on Luaka Bop'],
    [{ kind: 'same-label', label: null } as const, 'From the same label'],
  ])('formats %o', (reason, expected) => {
    expect(formatReason(reason)).toBe(expected);
  });

  it('counts releases in common', () => {
    expect(formatOverlap(1)).toBe('1 release in common with you');
    expect(formatOverlap(37)).toBe('37 releases in common with you');
  });
});
