import { describe, expect, it } from 'vitest';
import { formatForYouSummary, formatTwinOwners } from './forYouText';

describe('For-you text', () => {
  it('says how many top twins own a pick', () => {
    expect(formatTwinOwners(5)).toBe('owned by 5 of your top twins');
  });

  it('sums up the list', () => {
    expect(formatForYouSummary(30, 30)).toBe('30 picks from what your 30 closest twins own');
    expect(formatForYouSummary(1, 1)).toBe('1 pick from what your closest twin owns');
  });
});
