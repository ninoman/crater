import { describe, expect, it } from 'vitest';
import { keyFromNumber, keyToNumber, type ItemKey } from '../bandcamp';
import { exclusions, type MyRow } from './exclusions';
import {
  couldRank,
  diversify,
  forYouPicks,
  rankForYou,
  scoreForYou,
  topCrateMates,
  crateMateOwnership,
  type ForYouScored,
  type CrateMateMatches,
} from './forYou';

// Lists hold matchKeys, as `fanMatches` does: a crate mate's track of album a2 shows up as a2.
const list = (...keys: ItemKey[]) => Float64Array.from(keys.map(keyToNumber)).sort();

describe('topCrateMates', () => {
  it('keeps the K highest scores, ties on fanId', () => {
    const crateMates = [
      { fanId: 4, score: 0.1 },
      { fanId: 5, score: 0.6 },
      { fanId: 1, score: 0.9 },
      { fanId: 2, score: 0.6 },
      { fanId: 3, score: 0.3 },
    ];

    expect(topCrateMates(crateMates, 3).map((t) => t.fanId)).toEqual([1, 2, 5]);
  });
});

describe('For-you scoring', () => {
  const mine: MyRow[] = [
    { itemKey: 'a10', matchKey: 'a10', source: 'collection' },
    { itemKey: 'a11', matchKey: 'a11', source: 'wishlist' },
    { itemKey: 't41', matchKey: 'a4', source: 'wishlist' },
  ];
  const excluded = exclusions(mine, {
    releases: new Set<ItemKey>(['a20']),
    bands: new Set(),
    labels: new Set(),
  }).ids;
  const crateMates: CrateMateMatches[] = [
    { score: 3, matches: list('a1', 'a2', 'a10', 't7', 'a20') },
    { score: 2, matches: list('a1', 'a3', 'a10', 'a11') },
    { score: 1, matches: list('a1', 'a2', 'a3', 'a4') },
  ];
  const supporterCounts = new Map<ItemKey, number>([
    ['a1', 1022],
    ['a2', 2],
    ['a3', 6],
    ['a4', 0],
    ['t7', 14],
  ]);
  const score = (candidates: ReturnType<typeof crateMateOwnership>) =>
    candidates.map((c) => scoreForYou(c, supporterCounts.get(keyFromNumber(c.id)) ?? 0));

  it('sums crate mate scores per release, leaving out owned, wishlisted and hidden ones', () => {
    const owned = crateMateOwnership(crateMates, excluded);

    expect(owned.map((c) => ({ ...c, id: keyFromNumber(c.id) }))).toEqual([
      { id: 'a1', crateMateScore: 6, crateMates: 3 },
      { id: 'a2', crateMateScore: 4, crateMates: 2 },
      { id: 'a3', crateMateScore: 3, crateMates: 2 },
      { id: 't7', crateMateScore: 3, crateMates: 1 },
      { id: 'a4', crateMateScore: 1, crateMates: 1 },
    ]);
  });

  it('weighs by rarity, so a niche pick beats the staple every crate mate owns', () => {
    const ranked = rankForYou(score(crateMateOwnership(crateMates, excluded)), 10);

    // a2: 4 × 1/log2(4) = 2; a3: 3 × 1/3 = 1; t7: 3 × 1/4; a4: 1 × 1/log2(3); a1: 6 × 1/10.
    expect(ranked.map((s) => [keyFromNumber(s.id), s.score])).toEqual([
      ['a2', expect.closeTo(2)],
      ['a3', expect.closeTo(1)],
      ['t7', expect.closeTo(0.75)],
      ['a4', expect.closeTo(1 / Math.log2(3))],
      ['a1', expect.closeTo(0.6)],
    ]);
  });

  it('never counts fewer supporters than crate mates owning it', () => {
    expect(scoreForYou({ id: 1, crateMateScore: 2, crateMates: 2 }, 0)).toEqual({
      id: 1,
      crateMateScore: 2,
      crateMates: 2,
      supporters: 2,
      score: 1,
    });
  });

  it('breaks ties on crate mates, then id, and stops at the limit', () => {
    const tied = [
      { id: 3, crateMateScore: 1, crateMates: 1, supporters: 0, score: 1 },
      { id: 2, crateMateScore: 1, crateMates: 1, supporters: 0, score: 1 },
      { id: 1, crateMateScore: 1, crateMates: 2, supporters: 0, score: 1 },
    ];

    expect(rankForYou(tied, 2).map((s) => s.id)).toEqual([1, 2]);
  });
});

describe('diversify', () => {
  const ranked = Array.from({ length: 24 }, (_, i) => ({ id: i + 1 }));
  // Ids 1–4 by one artist, spelled loosely; 6 unknown; the rest each by someone else.
  const artists = new Map<number, string>([
    [1, 'Alpha'],
    [2, ' alpha '],
    [3, 'ALPHA'],
    [4, 'Alpha'],
    ...ranked.filter(({ id }) => id > 4 && id !== 6).map(({ id }) => [id, `B${id}`] as const),
  ]);

  it('allows two per artist in the first 20 and moves the rest just below, in rank order', () => {
    const ids = diversify(ranked, artists).map((item) => item.id);

    expect(ids.slice(0, 20)).toEqual([1, 2, ...Array.from({ length: 18 }, (_, i) => i + 5)]);
    expect(ids.slice(20)).toEqual([3, 4, 23, 24]);
  });

  it('fills in with extras when no other artists are left', () => {
    const solo = new Map([1, 2, 3].map((id) => [id, 'Alpha'] as const));

    expect(diversify([{ id: 1 }, { id: 2 }, { id: 3 }], solo).map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('never holds back releases with no known artist', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

    expect(diversify(items, new Map())).toEqual(items);
  });
});

describe('forYouPicks', () => {
  it('diversifies, then keeps the limit as matchKeys with their crate mate counts', () => {
    const scored: ForYouScored[] = [1, 2, 3, 4].map((id) => ({
      id,
      crateMateScore: 5 - id,
      crateMates: id,
      supporters: 0,
      score: 5 - id,
    }));
    const artists = new Map([
      [1, 'Alpha'],
      [2, 'Alpha'],
      [3, 'Alpha'],
      [4, 'Beta'],
    ]);

    expect(forYouPicks(scored, artists, 3)).toEqual([
      { matchKey: 'a1', crateMates: 1 },
      { matchKey: 'a2', crateMates: 2 },
      { matchKey: 'a4', crateMates: 4 },
    ]);
  });
});

describe('couldRank', () => {
  const top: ForYouScored[] = [2, 1].map((score, i) => ({
    id: i + 1,
    crateMateScore: score * 2,
    crateMates: 1,
    supporters: 2,
    score,
  }));

  it('lets anything in while the list is short', () => {
    expect(couldRank(top, 3, 0.1)).toBe(true);
  });

  it('keeps out candidates whose crate mate score is below the last place', () => {
    expect(couldRank(top, 2, 1)).toBe(true);
    expect(couldRank(top, 2, 0.9)).toBe(false);
  });
});
