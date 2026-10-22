import { describe, expect, it } from 'vitest';
import { isNiche, listMetrics, median } from './metrics';
import type { Candidate, Popularity } from './types';

const pops = new Map<number, Popularity>([
  [1, { supporters: 3, owners: 3 }],
  [2, { supporters: 40, owners: 9 }],
  [3, { supporters: 2000, owners: 20 }],
  [4, { supporters: null, owners: 7 }],
  [5, { supporters: 10, owners: 5 }],
]);
const lookup = (id: number) => pops.get(id) as Popularity;
const cand = (id: number, twins: number): Candidate => ({
  id,
  twinScore: 1,
  twins,
  ...lookup(id),
});

describe('isNiche', () => {
  it('needs a Bandcamp count at or under the cap', () => {
    expect(isNiche({ supporters: 50, owners: 1 }, 50)).toBe(true);
    expect(isNiche({ supporters: 51, owners: 1 }, 50)).toBe(false);
    expect(isNiche({ supporters: null, owners: 1 }, 50)).toBe(false);
  });
});

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('listMetrics', () => {
  // Held out: 1 (niche), 2 (niche at cap 50), 3 (head), 4 (no count). Ranked: 3, 1, 5, 2.
  const heldOut = new Set([1, 2, 3, 4]);
  const ranked = [cand(3, 4), cand(1, 1), cand(5, 1), cand(2, 2)];

  it('counts hits over the first k only', () => {
    const m = listMetrics(ranked, heldOut, lookup, 50, 2);
    expect(m.recall).toBe(2 / 4);
    expect(m.nicheRecall).toBe(1 / 2);
    expect(m.medianHitN).toBe((3 + 2000) / 2);
    expect(m.singleTwinShare).toBe(1 / 2);
    expect(m.arp).toBeCloseTo((Math.log2(2001) + 2) / 2);
  });

  it('uses the whole list when k is larger', () => {
    const m = listMetrics(ranked, heldOut, lookup, 50, 100);
    expect(m.recall).toBe(3 / 4);
    expect(m.nicheRecall).toBe(2 / 2);
  });

  it('gives no niche recall when nothing niche was held out', () => {
    expect(listMetrics(ranked, new Set([3, 4]), lookup, 50, 30).nicheRecall).toBeNull();
  });

  it('gives null averages for an empty list', () => {
    const m = listMetrics([], heldOut, lookup, 50, 30);
    expect(m).toMatchObject({ recall: 0, arp: null, medianHitN: null, singleTwinShare: null });
  });
});
