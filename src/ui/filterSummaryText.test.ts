import { describe, expect, it } from 'vitest';
import { formatFilterSummary } from './filterSummaryText';

describe('formatFilterSummary', () => {
  it('says nothing was hidden', () => {
    expect(formatFilterSummary({ hidden: 0, unjudged: 0, limited: false })).toBe(
      'Nothing hidden by filters',
    );
  });

  it('counts what was hidden', () => {
    expect(formatFilterSummary({ hidden: 12, unjudged: 0, limited: false })).toBe(
      '12 hidden by filters',
    );
  });

  it('says how many could not be judged, and that the search stopped early', () => {
    expect(formatFilterSummary({ hidden: 5, unjudged: 1, limited: false })).toBe(
      "5 hidden by filters · 1 of them couldn't be judged: Dighead hasn't seen that detail yet",
    );
    expect(formatFilterSummary({ hidden: 4000, unjudged: 3, limited: true })).toBe(
      "4000 hidden by filters · 3 of them couldn't be judged: Dighead hasn't seen that detail yet · only the best 4,000 candidates were checked",
    );
  });
});
