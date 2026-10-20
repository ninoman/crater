import { describe, expect, it } from 'vitest';
import { formatOwnedTracks, formatReason } from './formatReason';

describe('formatReason', () => {
  it.each([
    [{ kind: 'co-owned', owners: 7, of: 48 } as const, '7 of 48 supporters own this'],
    [{ kind: 'same-artist' } as const, 'More from this artist'],
    [{ kind: 'same-label', label: 'Luaka Bop' } as const, 'Also on Luaka Bop'],
    [{ kind: 'same-label', label: null } as const, 'From the same label'],
  ])('formats %o', (reason, expected) => {
    expect(formatReason(reason)).toBe(expected);
  });

  it('counts owned tracks', () => {
    expect(formatOwnedTracks(1)).toBe('you own 1 track');
    expect(formatOwnedTracks(3)).toBe('you own 3 tracks');
  });
});
