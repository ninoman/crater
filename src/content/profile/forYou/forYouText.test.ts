import { describe, expect, it } from 'vitest';
import { formatDeepCutReason, formatForYouSummary, formatPickReason } from './forYouText';

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

  it('explains a deep cut by its owners and how many are your twins', () => {
    const reason = (twins: number, supporters: number, bestTwinRank: number | null) =>
      formatDeepCutReason({ twins, supporters, bestTwinRank });
    expect(reason(3, 4, 1)).toBe('Only 4 owners on Bandcamp · 3 are your twins');
    expect(reason(3, 3, 1)).toBe('Only 3 owners on Bandcamp, all your twins');
    expect(reason(1, 12, 3)).toBe('Only 12 owners on Bandcamp · one is your #3 twin');
    expect(reason(1, 12, null)).toBe('Only 12 owners on Bandcamp · one is your twin');
    expect(reason(1, 1, 7)).toBe('Only 1 owner on Bandcamp, your #7 twin');
  });

  it('sums up deep cuts', () => {
    expect(formatForYouSummary(8, 100, 'deep')).toBe(
      '8 deep cuts from what your 100 closest twins own',
    );
    expect(formatForYouSummary(1, 1, 'deep')).toBe('1 deep cut from what your closest twin owns');
  });
});
