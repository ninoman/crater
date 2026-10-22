import { describe, expect, it } from 'vitest';
import {
  formatBuyers,
  formatChecking,
  formatLatestReason,
  formatLatestSummary,
} from './latestText';

const named = (...names: string[]) => names.map((name) => ({ name }));

describe('latest text', () => {
  it('names up to two buyers and counts the rest', () => {
    expect(formatBuyers(named('Ana'))).toBe('bought by Ana');
    expect(formatBuyers(named('Ana', 'Ben'))).toBe('bought by Ana and Ben');
    expect(formatBuyers(named('Ana', 'Ben', 'Cy', 'Di'))).toBe('bought by Ana, Ben and 2 more');
  });

  it('summarises the feed and the twins still being checked', () => {
    expect(formatLatestSummary(1, 1, 60)).toBe(
      '1 release your top twin bought in the last 60 days',
    );
    expect(formatLatestSummary(12, 40, 60)).toBe(
      '12 releases your 40 top twins bought in the last 60 days',
    );
    expect(formatChecking(1)).toBe('Checking 1 twin for new purchases');
  });

  it('says who bought it and when', () => {
    const now = 10 * 86_400_000;
    expect(formatLatestReason({ buyers: named('Ana'), boughtAt: now - 3 * 86_400_000 }, now)).toBe(
      'bought by Ana · 3 days ago',
    );
  });
});
