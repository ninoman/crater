import { describe, expect, it } from 'vitest';
import { formatDeepCutReason, formatForYouSummary, formatPickReason } from './forYouText';

const DAY = 86_400_000;

describe('For-you text', () => {
  it('says how many top crate mates own a pick', () => {
    expect(formatPickReason({ crateMates: 5, lastBoughtAt: null }, 0)).toBe(
      'owned by 5 of your top crate mates',
    );
  });

  it('says when a lately crate mate last bought a Fresh pick', () => {
    expect(formatPickReason({ crateMates: 2, lastBoughtAt: 10 * DAY }, 13 * DAY)).toBe(
      'bought by 2 of your lately crate mates · latest 3 days ago',
    );
  });

  it('sums up the list', () => {
    expect(formatForYouSummary(30, 30, 'all')).toBe(
      '30 picks from what your 30 closest crate mates own',
    );
    expect(formatForYouSummary(1, 1, 'all')).toBe('1 pick from what your closest crate mate owns');
    expect(formatForYouSummary(12, 30, 'fresh')).toBe(
      '12 picks from what your 30 lately crate mates bought this year',
    );
  });

  it('explains a deep cut by its owners and how many are your crate mates', () => {
    const reason = (crateMates: number, supporters: number, bestCrateMateRank: number | null) =>
      formatDeepCutReason({ crateMates, supporters, bestCrateMateRank });
    expect(reason(3, 4, 1)).toBe('Only 4 owners on Bandcamp · 3 are your crate mates');
    expect(reason(3, 3, 1)).toBe('Only 3 owners on Bandcamp, all your crate mates');
    expect(reason(1, 12, 3)).toBe('Only 12 owners on Bandcamp · one is your #3 crate mate');
    expect(reason(1, 12, null)).toBe('Only 12 owners on Bandcamp · one is your crate mate');
    expect(reason(1, 1, 7)).toBe('Only 1 owner on Bandcamp, your #7 crate mate');
  });

  it('sums up deep cuts', () => {
    expect(formatForYouSummary(8, 100, 'deep')).toBe(
      '8 deep cuts from what your 100 closest crate mates own',
    );
    expect(formatForYouSummary(1, 1, 'deep')).toBe(
      '1 deep cut from what your closest crate mate owns',
    );
  });
});
