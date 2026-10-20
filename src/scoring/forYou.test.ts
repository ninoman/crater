import { describe, expect, it } from 'vitest';
import { keyFromNumber, keyToNumber, type ItemKey } from '../bandcamp';
import { exclusions, type MyRow } from './exclusions';
import {
  couldRank,
  diversify,
  forYouPicks,
  rankForYou,
  scoreForYou,
  topTwins,
  twinOwnership,
  type ForYouScored,
  type TwinMatches,
} from './forYou';

// Lists hold matchKeys, as `fanMatches` does: a twin's track of album a2 shows up as a2.
const list = (...keys: ItemKey[]) => Float64Array.from(keys.map(keyToNumber)).sort();

describe('topTwins', () => {
  it('keeps the K highest scores, ties on fanId', () => {
    const twins = [
      { fanId: 4, score: 0.1 },
      { fanId: 5, score: 0.6 },
      { fanId: 1, score: 0.9 },
      { fanId: 2, score: 0.6 },
      { fanId: 3, score: 0.3 },
    ];

    expect(topTwins(twins, 3).map((t) => t.fanId)).toEqual([1, 2, 5]);
  });
});

describe('For-you scoring', () => {
  const mine: MyRow[] = [
    { itemKey: 'a10', matchKey: 'a10', source: 'collection' },
    { itemKey: 'a11', matchKey: 'a11', source: 'wishlist' },
    { itemKey: 't41', matchKey: 'a4', source: 'collection' },
  ];
  const mineExcluded = exclusions(mine, new Set<ItemKey>(['a20']));
  const twins: TwinMatches[] = [
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
  const score = (candidates: ReturnType<typeof twinOwnership>) =>
    candidates.map((c) => scoreForYou(c, supporterCounts.get(keyFromNumber(c.id)) ?? 0));

  it('sums twin scores per release, leaving out owned, wishlisted and hidden ones', () => {
    const owned = twinOwnership(twins, mineExcluded.excluded);

    expect(owned.map((c) => ({ ...c, id: keyFromNumber(c.id) }))).toEqual([
      { id: 'a1', twinScore: 6, twins: 3 },
      { id: 'a2', twinScore: 4, twins: 2 },
      { id: 'a3', twinScore: 3, twins: 2 },
      { id: 't7', twinScore: 3, twins: 1 },
      { id: 'a4', twinScore: 1, twins: 1 },
    ]);
  });

  it('keeps an album you own a track of', () => {
    expect(mineExcluded.ownedTracks).toEqual(new Map([[keyToNumber('a4'), 1]]));
  });

  it('weighs by rarity, so a niche pick beats the staple every twin owns', () => {
    const ranked = rankForYou(score(twinOwnership(twins, mineExcluded.excluded)), 10);

    // a2: 4 × 1/log2(4) = 2; a3: 3 × 1/3 = 1; t7: 3 × 1/4; a4: 1 × 1/log2(3); a1: 6 × 1/10.
    expect(ranked.map((s) => [keyFromNumber(s.id), s.score])).toEqual([
      ['a2', expect.closeTo(2)],
      ['a3', expect.closeTo(1)],
      ['t7', expect.closeTo(0.75)],
      ['a4', expect.closeTo(1 / Math.log2(3))],
      ['a1', expect.closeTo(0.6)],
    ]);
  });

  it('never counts fewer supporters than twins owning it', () => {
    expect(scoreForYou({ id: 1, twinScore: 2, twins: 2 }, 0)).toEqual({
      id: 1,
      twinScore: 2,
      twins: 2,
      supporters: 2,
      score: 1,
    });
  });

  it('breaks ties on twins, then id, and stops at the limit', () => {
    const tied = [
      { id: 3, twinScore: 1, twins: 1, supporters: 0, score: 1 },
      { id: 2, twinScore: 1, twins: 1, supporters: 0, score: 1 },
      { id: 1, twinScore: 1, twins: 2, supporters: 0, score: 1 },
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
  it('diversifies, then keeps the limit as matchKeys with their twin counts', () => {
    const scored: ForYouScored[] = [1, 2, 3, 4].map((id) => ({
      id,
      twinScore: 5 - id,
      twins: id,
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
      { matchKey: 'a1', twins: 1 },
      { matchKey: 'a2', twins: 2 },
      { matchKey: 'a4', twins: 4 },
    ]);
  });
});

describe('couldRank', () => {
  const top: ForYouScored[] = [2, 1].map((score, i) => ({
    id: i + 1,
    twinScore: score * 2,
    twins: 1,
    supporters: 2,
    score,
  }));

  it('lets anything in while the list is short', () => {
    expect(couldRank(top, 3, 0.1)).toBe(true);
  });

  it('keeps out candidates whose twin score is below the last place', () => {
    expect(couldRank(top, 2, 1)).toBe(true);
    expect(couldRank(top, 2, 0.9)).toBe(false);
  });
});
