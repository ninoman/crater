import { describe, expect, it } from 'vitest';
import { keyToNumber, type ItemKey } from '../bandcamp';
import {
  blendPicks,
  coOwnerVotes,
  coOwnership,
  CONFIDENT_LIFT,
  couldEnter,
  fallbackPicks,
  isConfident,
  isSmallRelease,
  LIFT_CAP,
  lift,
  maxTwinShare,
  rankScored,
  scoreCeiling,
  scoreCoOwned,
  TWIN_BOOST_MAX,
  twinBoosts,
  voteWeight,
  warmup,
  WARMUP_ROWS,
  WARMUP_SUPPORTERS,
  wilsonLower,
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

describe('wilsonLower', () => {
  it('shrinks a share seen among few supporters a lot, among many only a little', () => {
    // The same 0.375 either way.
    expect(wilsonLower(3, 8)).toBeLessThan(0.375 / 2);
    expect(wilsonLower(30, 80)).toBeGreaterThan(0.375 * 0.75);
    expect(wilsonLower(300, 800)).toBeGreaterThan(0.375 * 0.9);
  });

  it('grows with evidence at the same share, and stays in [0, share]', () => {
    const bounds = [2, 4, 8, 16, 32].map((n) => wilsonLower(n / 2, n));
    expect(bounds).toEqual([...bounds].sort((a, b) => a - b));
    for (const bound of bounds) expect(bound).toBeGreaterThan(0);
    for (const bound of bounds) expect(bound).toBeLessThan(0.5);
  });

  it('is 0 with nothing seen', () => {
    expect(wilsonLower(0, 0)).toBe(0);
    expect(wilsonLower(0, 10)).toBe(0);
  });

  it('takes fractional (weighted) hits', () => {
    expect(wilsonLower(2.5, 10)).toBeGreaterThan(wilsonLower(2, 10));
    expect(wilsonLower(2.5, 10)).toBeLessThan(wilsonLower(3, 10));
  });
});

describe('omnivore votes', () => {
  const supporter = (size: number, ...ids: number[]) => ({
    matchIds: Float64Array.from(ids).sort(),
    size,
  });

  it('gives collections up to 250 items a full vote, bigger ones √(250 / size)', () => {
    expect(voteWeight(40)).toBe(1);
    expect(voteWeight(250)).toBe(1);
    expect(voteWeight(1000)).toBeCloseTo(0.5);
    expect(voteWeight(4000)).toBeCloseTo(0.25);
  });

  it('sums the weights of the supporters owning each release', () => {
    const supporters = [
      supporter(100, 1, 2, 5),
      supporter(1000, 1, 3, 5),
      supporter(4000, -2, 1, 3),
    ];

    expect(coOwnerVotes([1, 3, 5, 9], supporters)).toEqual(
      new Map([
        [1, expect.closeTo(1.75) as number],
        [3, expect.closeTo(0.75) as number],
        [5, expect.closeTo(1.5) as number],
        [9, 0],
      ]),
    );
  });

  it('ranks a release small collectors share above one only omnivores share', () => {
    const basis = { supporters: 20, population: 1000 };
    const supporters = [
      supporter(80, 1),
      supporter(120, 1),
      supporter(150, 1),
      supporter(2000, 2),
      supporter(2000, 2),
      supporter(2000, 2),
    ];
    const votes = coOwnerVotes([1, 2], supporters);
    const scored = [1, 2].map((id) =>
      scoreCoOwned({ id, co: 3, votes: votes.get(id) ?? 0 }, 10, basis),
    );

    expect(rankScored(scored, 10).map((s) => s.id)).toEqual([1, 2]);
    expect(scored[1]?.votes).toBeCloseTo(3 * Math.sqrt(250 / 2000));
  });
});

describe('warm-up', () => {
  const scored = (lift: number) => ({
    id: 1,
    co: 3,
    votes: 3,
    owners: 3,
    lift,
    twins: 0,
    score: 1,
  });

  it('counts a row as confident when its cautious lift reaches the bar', () => {
    expect(isConfident(scored(CONFIDENT_LIFT))).toBe(true);
    expect(isConfident(scored(CONFIDENT_LIFT - 0.01))).toBe(false);
  });

  it('waits for enough supporters and enough confident rows', () => {
    const listed = 300;
    expect(warmup({ read: 8, allScanned: false, listed }, 9)).toEqual({
      read: 8,
      readTarget: WARMUP_SUPPORTERS,
      confident: WARMUP_ROWS,
      confidentTarget: WARMUP_ROWS,
    });
    expect(warmup({ read: 25, allScanned: false, listed }, 4)).toEqual({
      read: WARMUP_SUPPORTERS,
      readTarget: WARMUP_SUPPORTERS,
      confident: 4,
      confidentTarget: WARMUP_ROWS,
    });
    expect(warmup({ read: 20, allScanned: false, listed }, 5)).toBeNull();
  });

  it('needs only the listed supporters when there are fewer than 20', () => {
    expect(warmup({ read: 6, allScanned: false, listed: 7 }, 5)).toMatchObject({ readTarget: 7 });
    expect(warmup({ read: 7, allScanned: false, listed: 7 }, 5)).toBeNull();
  });

  it('ends once every supporter is scanned, however little turned up', () => {
    expect(warmup({ read: 3, allScanned: true, listed: 9 }, 0)).toBeNull();
    expect(warmup({ read: 0, allScanned: true, listed: 0 }, 0)).toBeNull();
  });

  it('waits for the supporter list before it knows how many to expect', () => {
    expect(warmup({ read: 2, allScanned: false, listed: null }, 0)).toMatchObject({
      read: 2,
      readTarget: WARMUP_SUPPORTERS,
    });
  });
});

describe('lift and score', () => {
  const basis = { supporters: 10, population: 100 };

  it('compares the cautious share among supporters with the share among everyone', () => {
    // 5 of 10 supporters (0.5, cautiously 0.27), 20 of 100 fans: 1.35 times as common as usual.
    expect(lift(5, 20, basis)).toBeCloseTo(wilsonLower(5, 10) / 0.2);
    expect(lift(5, 20, basis)).toBeCloseTo(1.35, 2);
  });

  it('caps lift for releases almost nobody else owns', () => {
    expect(lift(2, 2, { supporters: 10, population: 10_000 })).toBe(LIFT_CAP);
  });

  it('never counts fewer owners than co-owners', () => {
    expect(lift(4, 0, basis)).toBe(lift(4, 4, basis));
  });

  it('scores votes × ln(1 + lift)', () => {
    const value = wilsonLower(4, 10) / 0.2;
    expect(scoreCoOwned({ id: 1, co: 5, votes: 4 }, 20, basis)).toEqual({
      id: 1,
      co: 5,
      votes: 4,
      owners: 20,
      lift: expect.closeTo(value) as number,
      twins: 0,
      score: expect.closeTo(4 * Math.log1p(value)) as number,
    });
  });

  it('lets a rarer release outrank a more co-owned staple', () => {
    const staple = scoreCoOwned({ id: 1, co: 8, votes: 8 }, 90, basis);
    const niche = scoreCoOwned({ id: 2, co: 5, votes: 5 }, 6, basis);

    expect(rankScored([staple, niche], 10).map((s) => s.id)).toEqual([2, 1]);
  });

  it('breaks ties on co, then id', () => {
    const scored = [
      { id: 3, co: 2, votes: 2, owners: 2, lift: 1, twins: 0, score: 1 },
      { id: 2, co: 2, votes: 2, owners: 2, lift: 1, twins: 0, score: 1 },
      { id: 1, co: 1, votes: 1, owners: 1, lift: 1, twins: 0, score: 1 },
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
    const plain = scoreCoOwned({ id: 1, co: 5, votes: 5 }, 20, basis);
    const full = scoreCoOwned({ id: 1, co: 5, votes: 5 }, 20, basis, { share: 1, twins: 2 });
    const half = scoreCoOwned({ id: 1, co: 5, votes: 5 }, 20, basis, { share: 0.5, twins: 1 });

    expect(full.score).toBeCloseTo(plain.score * (1 + TWIN_BOOST_MAX));
    expect(half.score).toBeCloseTo(plain.score * (1 + TWIN_BOOST_MAX / 2));
    expect(full.twins).toBe(2);
  });

  it('lets a release your closest twin owns pass one with an extra co-owner', () => {
    // Same lift for all three: 5 × 1.5 = 7.5 co-owners' worth beats 6, but not 8.
    const twinOwned = scoreCoOwned({ id: 1, co: 5, votes: 5 }, 10, basis, { share: 1, twins: 1 });
    const more = scoreCoOwned({ id: 2, co: 6, votes: 6 }, 12, basis);
    const most = scoreCoOwned({ id: 3, co: 8, votes: 8 }, 16, basis);

    expect(rankScored([more, twinOwned, most], 10).map((s) => s.id)).toEqual([3, 1, 2]);
  });
});

describe('couldEnter', () => {
  const top = [scoreCoOwned({ id: 1, co: 10, votes: 10 }, 10, { supporters: 10, population: 10 })];

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
    const scored = [scoreCoOwned({ id: 2, co: 2, votes: 2 }, 2, { supporters: 3, population: 9 })];
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
