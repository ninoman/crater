import { describe, expect, it } from 'vitest';
import type { TwinRow } from '../../../shared/twins';
import { filterTwins, formatMatch, formatScore, sortTwins } from './twinsView';

function row(rank: number, overrides: Partial<TwinRow> = {}): TwinRow {
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
    lately: null,
    latelyOverlap: 0,
    trend: 'quiet',
    ...overrides,
  };
}

// Leaderboard order: by score. Overlap and Jaccard rank them differently.
const ROWS = [
  row(1, { overlap: 5, jaccard: 0.05 }),
  row(2, { overlap: 12, jaccard: 0.05 }),
  row(3, { overlap: 5, jaccard: 0.2 }),
];
const ranks = (rows: TwinRow[]) => rows.map((r) => r.rank);

describe('sortTwins', () => {
  it('sorts by score, overlap or Jaccard, highest first', () => {
    expect(ranks(sortTwins(ROWS, 'score'))).toEqual([1, 2, 3]);
    expect(ranks(sortTwins(ROWS, 'overlap'))).toEqual([2, 1, 3]);
    expect(ranks(sortTwins(ROWS, 'jaccard'))).toEqual([3, 1, 2]);
  });

  it('sorts by lately score with missing scores last', () => {
    const rows = [
      row(1, { lately: null }),
      row(2, { lately: 0.1, latelyOverlap: 4 }),
      row(3, { lately: 0.3, latelyOverlap: 1 }),
    ];
    expect(ranks(sortTwins(rows, 'lately'))).toEqual([3, 2, 1]);
    expect(ranks(sortTwins(rows, 'latelyOverlap'))).toEqual([2, 3, 1]);
  });

  it('keeps leaderboard order for ties and leaves the input alone', () => {
    const input = [...ROWS].reverse();
    expect(ranks(sortTwins(input, 'jaccard'))).toEqual([3, 1, 2]);
    expect(ranks(input)).toEqual([3, 2, 1]);
  });
});

describe('filterTwins', () => {
  const rows = [
    row(1, { name: 'Björk Fan', username: 'gudmunds' }),
    row(2, { name: 'Dub Digger', username: 'dubdigger' }),
  ];

  it('matches name or username, ignoring case and accents', () => {
    expect(ranks(filterTwins(rows, 'bjork'))).toEqual([1]);
    expect(ranks(filterTwins(rows, 'GUDM'))).toEqual([1]);
    expect(ranks(filterTwins(rows, ' digger '))).toEqual([2]);
  });

  it('keeps everyone for a blank query and no one for a miss', () => {
    expect(ranks(filterTwins(rows, '  '))).toEqual([1, 2]);
    expect(filterTwins(rows, 'zzz')).toEqual([]);
  });
});

describe('formats', () => {
  it('shows Jaccard as a percentage with two significant digits', () => {
    expect(formatMatch(1 / 3)).toBe('33%');
    expect(formatMatch(0.015)).toBe('1.5%');
    expect(formatMatch(1)).toBe('100%');
  });

  it('shows scores with two significant digits', () => {
    expect(formatScore(0.08345)).toBe('0.083');
    expect(formatScore(0)).toBe('0');
  });
});
