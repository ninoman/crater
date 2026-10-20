import { describe, expect, it } from 'vitest';
import { timeAgo, timeUntil } from './timeAgo';

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

describe('timeUntil', () => {
  it.each([
    [10_000, 'in under a minute'],
    [60_000, 'in 1 minute'],
    [61_000, 'in 2 minutes'],
    [59 * 60_000, 'in 59 minutes'],
    [3_600_000, 'in 1 hour'],
    [150 * 60_000, 'in 3 hours'],
  ])('formats %i ms ahead as %s', (remaining, expected) => {
    expect(timeUntil(NOW + remaining, NOW)).toBe(expected);
  });
});
