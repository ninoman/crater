import { describe, expect, it } from 'vitest';
import { keyFromNumber, keyToNumber, type ItemKey } from '../bandcamp';
import {
  blendPicks,
  coOwnership,
  couldEnter,
  exclusions,
  fallbackPicks,
  isSmallRelease,
  LIFT_CAP,
  lift,
  rankScored,
  scoreCeiling,
  scoreCoOwned,
  type MyRow,
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

describe('exclusions', () => {
  const mine: MyRow[] = [
    { itemKey: 'a1', matchKey: 'a1', source: 'collection' },
    { itemKey: 't21', matchKey: 'a2', source: 'collection' },
    { itemKey: 't22', matchKey: 'a2', source: 'collection' },
    { itemKey: 'a3', matchKey: 'a3', source: 'wishlist' },
    { itemKey: 't41', matchKey: 'a4', source: 'wishlist' },
    { itemKey: 't51', matchKey: 'a5', source: 'collection' },
    { itemKey: 'a5', matchKey: 'a5', source: 'collection' },
  ];

  it('leaves out the release, hidden ones, and whole releases you own or wishlisted', () => {
    const { excluded } = exclusions(mine, new Set(['a9']), 'a8');

    expect([...excluded].map(keyFromNumber).sort()).toEqual(['a1', 'a3', 'a5', 'a8', 'a9']);
  });

  it('keeps albums you own some tracks of, with the count', () => {
    const { ownedTracks } = exclusions(mine, new Set(), 'a8');

    expect(ownedTracks).toEqual(new Map([[keyToNumber('a2'), 2]]));
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
      { id: 3, co: 2, owners: 2, lift: 1, score: 1 },
      { id: 2, co: 2, owners: 2, lift: 1, score: 1 },
      { id: 1, co: 1, owners: 1, lift: 1, score: 1 },
    ];

    expect(rankScored(scored, 2).map((s) => s.id)).toEqual([2, 3]);
  });
});

describe('couldEnter', () => {
  const top = [scoreCoOwned({ id: 1, co: 10 }, 10, { supporters: 10, population: 10 })];

  it('admits anything while the list has room', () => {
    expect(couldEnter(top, 2, 1)).toBe(true);
  });

  it('stops once the best possible score is below the last place', () => {
    // The leader scores 10 × ln 2 ≈ 6.9; 2 co-owners reach at most 2 × ln 11 ≈ 4.8.
    expect(couldEnter(top, 1, 2)).toBe(false);
    expect(couldEnter(top, 1, 3)).toBe(scoreCeiling(3) >= (top[0]?.score ?? 0));
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
      { matchKey: 'a2', kind: 'co-owned', co: 2 },
      { matchKey: 'a1', kind: 'same-artist' },
    ]);
  });
});
