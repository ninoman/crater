import { describe, expect, it } from 'vitest';
import { keyToNumber, type ItemKey } from '../bandcamp';
import {
  blendPicks,
  coOwnership,
  couldEnter,
  fallbackPicks,
  isSmallRelease,
  LIFT_CAP,
  lift,
  maxTwinShare,
  rankScored,
  scoreCeiling,
  scoreCoOwned,
  TWIN_BOOST_MAX,
  twinBoosts,
  type SellerItem,
} from './alsoBought';
import { supporters, weight } from './weights';

describe('weights', () => {
  it('prefers the album count, then the track count, then owners seen', () => {
    expect(supporters([12, 5], 3)).toBe(12);
    expect(supporters([null, 5], 3)).toBe(5);
    expect(supporters([null, undefined], 3)).toBe(3);
  });

  it('weighs rare releases more', () => {
    expect(weight(0)).toBe(1);
    expect(weight(2)).toBe(0.5);
    expect(weight(1022)).toBe(0.1);
  });
});

describe('coOwnership', () => {
  const list = (...keys: ItemKey[]) => Float64Array.from(keys.map(keyToNumber)).sort();

  it('counts owners per release, drops co < 2 and excluded ones, highest first', () => {
    const lists = [list('a1', 'a2', 'a3', 'a9'), list('a1', 'a2', 'a4'), list('a1', 'a3', 'a9')];

    expect(coOwnership(lists, new Set([9]))).toEqual([
      { id: 1, co: 3 },
      { id: 2, co: 2 },
      { id: 3, co: 2 },
    ]);
  });

  it('keeps albums and tracks apart', () => {
    expect(coOwnership([list('a5', 't5'), list('a5', 't5')], new Set())).toEqual([
      { id: -5, co: 2 },
      { id: 5, co: 2 },
    ]);
  });
});

describe('lift and score', () => {
  const basis = { supporters: 10, population: 100 };

  it('compares the share among supporters with the share among everyone', () => {
    // 5 of 10 supporters, 20 of 100 fans: 2.5 times as common as usual.
    expect(lift(5, 20, basis)).toBeCloseTo(2.5);
  });

  it('caps lift for releases almost nobody else owns', () => {
    expect(lift(2, 2, { supporters: 10, population: 10_000 })).toBe(LIFT_CAP);
  });

  it('never counts fewer owners than co-owners', () => {
    expect(lift(4, 0, basis)).toBe(lift(4, 4, basis));
  });

  it('scores co × ln(1 + lift)', () => {
    expect(scoreCoOwned({ id: 1, co: 5 }, 20, basis)).toEqual({
      id: 1,
      co: 5,
      owners: 20,
      lift: expect.closeTo(2.5) as number,
      twins: 0,
      score: expect.closeTo(5 * Math.log(3.5)) as number,
    });
  });

  it('lets a rarer release outrank a more co-owned staple', () => {
    const staple = scoreCoOwned({ id: 1, co: 8 }, 90, basis);
    const niche = scoreCoOwned({ id: 2, co: 5 }, 6, basis);

    expect(rankScored([staple, niche], 10).map((s) => s.id)).toEqual([2, 1]);
  });

  it('breaks ties on co, then id', () => {
    const scored = [
      { id: 3, co: 2, owners: 2, lift: 1, twins: 0, score: 1 },
      { id: 2, co: 2, owners: 2, lift: 1, twins: 0, score: 1 },
      { id: 1, co: 1, owners: 1, lift: 1, twins: 0, score: 1 },
    ];

    expect(rankScored(scored, 2).map((s) => s.id)).toEqual([2, 3]);
  });
});

describe('twin boost', () => {
  const list = (...ids: number[]) => Float64Array.from(ids);
  const basis = { supporters: 10, population: 100 };

  it('scales twin scores by your best twin and caps the share at 1', () => {
    const boosts = twinBoosts(
      [
        { score: 0.2, matchIds: list(1, 2) },
        { score: 0.1, matchIds: list(2, 3) },
        { score: 0.4, matchIds: list(3) },
      ],
      0.4,
    );

    expect(boosts.get(1)).toEqual({ share: 0.5, twins: 1 });
    expect(boosts.get(2)).toEqual({ share: expect.closeTo(0.75) as number, twins: 2 });
    expect(boosts.get(3)).toEqual({ share: 1, twins: 2 });
    expect(boosts.has(4)).toBe(false);
    expect(maxTwinShare(boosts)).toBe(1);
  });

  it('does nothing without twins', () => {
    expect(twinBoosts([{ score: 0.2, matchIds: list(1) }], 0).size).toBe(0);
    expect(maxTwinShare(new Map())).toBe(0);
  });

  it('multiplies the score by at most 1 + TWIN_BOOST_MAX', () => {
    const plain = scoreCoOwned({ id: 1, co: 5 }, 20, basis);
    const full = scoreCoOwned({ id: 1, co: 5 }, 20, basis, { share: 1, twins: 2 });
    const half = scoreCoOwned({ id: 1, co: 5 }, 20, basis, { share: 0.5, twins: 1 });

    expect(full.score).toBeCloseTo(plain.score * (1 + TWIN_BOOST_MAX));
    expect(half.score).toBeCloseTo(plain.score * (1 + TWIN_BOOST_MAX / 2));
    expect(full.twins).toBe(2);
  });

  it('lets a release your closest twin owns pass one with an extra co-owner', () => {
    // Same lift for all three: 5 × 1.5 = 7.5 co-owners' worth beats 6, but not 8.
    const twinOwned = scoreCoOwned({ id: 1, co: 5 }, 10, basis, { share: 1, twins: 1 });
    const more = scoreCoOwned({ id: 2, co: 6 }, 12, basis);
    const most = scoreCoOwned({ id: 3, co: 8 }, 16, basis);

    expect(rankScored([more, twinOwned, most], 10).map((s) => s.id)).toEqual([3, 1, 2]);
  });
});

describe('couldEnter', () => {
  const top = [scoreCoOwned({ id: 1, co: 10 }, 10, { supporters: 10, population: 10 })];

  it('admits anything while the list has room', () => {
    expect(couldEnter(top, 2, 1, 0)).toBe(true);
  });

  it('stops once the best possible score is below the last place', () => {
    // The leader scores 10 × ln 2 ≈ 6.9; 2 co-owners reach at most 2 × ln 11 ≈ 4.8.
    expect(couldEnter(top, 1, 2, 0)).toBe(false);
    expect(couldEnter(top, 1, 3, 0)).toBe(scoreCeiling(3, 0) >= (top[0]?.score ?? 0));
  });

  it('leaves room for the twin boost', () => {
    // With a full twin share, 2 co-owners reach 2 × ln 11 × 1.5 ≈ 7.2, past the leader's 6.9.
    expect(couldEnter(top, 1, 2, 0)).toBe(false);
    expect(couldEnter(top, 1, 2, 1)).toBe(true);
  });
});

describe('small-release fallback', () => {
  const release = { artist: 'Solo', bandId: 5, labelId: 77 };
  const sellerItem = (itemKey: ItemKey, patch: Partial<SellerItem>): SellerItem => ({
    itemKey,
    albumKey: null,
    artist: 'Solo',
    bandId: 5,
    labelId: null,
    supporters: 1,
    ...patch,
  });

  it('counts as small below 8 known owners', () => {
    expect(isSmallRelease(7)).toBe(true);
    expect(isSmallRelease(8)).toBe(false);
  });

  it('puts the same artist first, then the label, each by supporters', () => {
    const items = [
      sellerItem('a1', { supporters: 3 }),
      sellerItem('a2', { supporters: 9 }),
      sellerItem('a3', { artist: 'Labelmate', supporters: 50 }),
      sellerItem('a4', { artist: 'Elsewhere', bandId: 9, labelId: 77, supporters: 4 }),
      sellerItem('a5', { artist: 'Stranger', bandId: 9 }),
      sellerItem('t6', { albumKey: 'a1' }),
      sellerItem('a7', { supporters: 99 }),
    ];

    expect(fallbackPicks(release, items, new Set([7]), 10)).toEqual([
      { matchKey: 'a2', kind: 'same-artist' },
      { matchKey: 'a1', kind: 'same-artist' },
      { matchKey: 'a3', kind: 'same-label' },
      { matchKey: 'a4', kind: 'same-label' },
    ]);
  });

  it('blends fallback picks after co-owned ones, without duplicates', () => {
    const scored = [scoreCoOwned({ id: 2, co: 2 }, 2, { supporters: 3, population: 9 })];
    const fallback = [
      { matchKey: 'a2' as const, kind: 'same-artist' as const },
      { matchKey: 'a1' as const, kind: 'same-artist' as const },
    ];

    expect(blendPicks(scored, fallback, 10)).toEqual([
      { matchKey: 'a2', kind: 'co-owned', co: 2, twins: 0 },
      { matchKey: 'a1', kind: 'same-artist' },
    ]);
  });
});
