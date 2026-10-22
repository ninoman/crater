import { describe, expect, it } from 'vitest';
import type { CrateMateRow } from '../../../shared/crateMates';
import {
  filterCrateMates,
  formatMatch,
  formatRelativeScore,
  sortCrateMates,
  topScore,
} from './crateMatesView';

function row(rank: number, overrides: Partial<CrateMateRow> = {}): CrateMateRow {
  return {
    fanId: rank * 10,
    rank,
    username: `fan${rank}`,
    name: `Fan ${rank}`,
    avatarUrl: null,
    url: `https://bandcamp.com/fan${rank}`,
    overlap: 1,
    jaccard: 0.1,
    score: 1 / rank,
    labelCluster: false,
    followed: false,
    lately: null,
    latelyOverlap: 0,
    trend: 'quiet',
    recentBuys: [],
    ...overrides,
  };
}

// Leaderboard order: by score. Overlap and Jaccard rank them differently.
const ROWS = [
  row(1, { overlap: 5, jaccard: 0.05 }),
  row(2, { overlap: 12, jaccard: 0.05 }),
  row(3, { overlap: 5, jaccard: 0.2 }),
];
const ranks = (rows: CrateMateRow[]) => rows.map((r) => r.rank);

describe('sortCrateMates', () => {
  it('sorts by score, overlap or Jaccard, highest first', () => {
    expect(ranks(sortCrateMates(ROWS, 'score'))).toEqual([1, 2, 3]);
    expect(ranks(sortCrateMates(ROWS, 'overlap'))).toEqual([2, 1, 3]);
    expect(ranks(sortCrateMates(ROWS, 'jaccard'))).toEqual([3, 1, 2]);
  });

  it('sorts by lately score with missing scores last', () => {
    const rows = [
      row(1, { lately: null }),
      row(2, { lately: 0.1, latelyOverlap: 4 }),
      row(3, { lately: 0.3, latelyOverlap: 1 }),
    ];
    expect(ranks(sortCrateMates(rows, 'lately'))).toEqual([3, 2, 1]);
    expect(ranks(sortCrateMates(rows, 'latelyOverlap'))).toEqual([2, 3, 1]);
  });

  it('keeps leaderboard order for ties and leaves the input alone', () => {
    const input = [...ROWS].reverse();
    expect(ranks(sortCrateMates(input, 'jaccard'))).toEqual([3, 1, 2]);
    expect(ranks(input)).toEqual([3, 2, 1]);
  });
});

describe('filterCrateMates', () => {
  const rows = [
    row(1, { name: 'Björk Fan', username: 'gudmunds' }),
    row(2, { name: 'Dub Digger', username: 'dubdigger' }),
  ];

  it('matches name or username, ignoring case and accents', () => {
    expect(ranks(filterCrateMates(rows, 'bjork'))).toEqual([1]);
    expect(ranks(filterCrateMates(rows, 'GUDM'))).toEqual([1]);
    expect(ranks(filterCrateMates(rows, ' digger '))).toEqual([2]);
  });

  it('keeps everyone for a blank query and no one for a miss', () => {
    expect(ranks(filterCrateMates(rows, '  '))).toEqual([1, 2]);
    expect(filterCrateMates(rows, 'zzz')).toEqual([]);
  });
});

describe('formats', () => {
  it('shows Jaccard as a percentage with two significant digits', () => {
    expect(formatMatch(1 / 3)).toBe('33%');
    expect(formatMatch(0.015)).toBe('1.5%');
    expect(formatMatch(1)).toBe('100%');
  });

  it('shows scores out of 100 for the top crate mate', () => {
    expect(formatRelativeScore(0.021, 0.021)).toBe('100');
    expect(formatRelativeScore(0.019, 0.021)).toBe('90');
    expect(formatRelativeScore(0.0001, 0.021)).toBe('<1');
    expect(formatRelativeScore(0, 0.021)).toBe('0');
    expect(formatRelativeScore(0, 0)).toBe('0');
  });

  it('takes the top score per board, a missing lately score as 0', () => {
    const rows = [row(1, { score: 0.02, lately: null }), row(2, { score: 0.03, lately: 0.01 })];
    expect(topScore(rows, 'score')).toBe(0.03);
    expect(topScore(rows, 'lately')).toBe(0.01);
    expect(topScore([], 'score')).toBe(0);
  });
});
