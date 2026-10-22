import { describe, expect, it } from 'vitest';
import { formatForYouSummary, formatPickReason } from './forYouText';

const DAY = 86_400_000;

describe('For-you text', () => {
  it('says how many top twins own a pick', () => {
    expect(formatPickReason({ twins: 5, lastBoughtAt: null }, 0)).toBe(
      'owned by 5 of your top twins',
    );
  });

  it('says when a lately twin last bought a Fresh pick', () => {
    expect(formatPickReason({ twins: 2, lastBoughtAt: 10 * DAY }, 13 * DAY)).toBe(
      'bought by 2 of your lately twins · latest 3 days ago',
    );
  });

  it('sums up the list', () => {
    expect(formatForYouSummary(30, 30, 'all')).toBe('30 picks from what your 30 closest twins own');
    expect(formatForYouSummary(1, 1, 'all')).toBe('1 pick from what your closest twin owns');
    expect(formatForYouSummary(12, 30, 'fresh')).toBe(
      '12 picks from what your 30 lately twins bought this year',
    );
  });
});
