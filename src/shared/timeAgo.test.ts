import { describe, expect, it } from 'vitest';
import { timeAgo } from './timeAgo';

const NOW = 1_800_000_000_000;

describe('timeAgo', () => {
  it.each([
    [0, 'just now'],
    [59_000, 'just now'],
    [5 * 60_000, '5 minutes ago'],
    [3 * 3_600_000, '3 hours ago'],
    [86_400_000, 'yesterday'],
    [4 * 86_400_000, '4 days ago'],
  ])('formats %i ms as %s', (elapsed, expected) => {
    expect(timeAgo(NOW - elapsed, NOW)).toBe(expected);
  });

  it('treats a future time as just now', () => {
    expect(timeAgo(NOW + 10_000, NOW)).toBe('just now');
  });
});
