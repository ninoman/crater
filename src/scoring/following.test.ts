import { describe, expect, it } from 'vitest';
import { scoreCeiling, scoreCoOwned } from './alsoBought';
import {
  boostFollowed,
  FOLLOW_BOOST,
  followedFirst,
  followedReleases,
  followFactor,
  maxFollowFactor,
} from './following';
import { rankForYou, scoreForYou } from './forYou';

const WARP = 100;
const LABEL = 200;
const bands = new Map([
  [WARP, 'Warp'],
  [LABEL, 'Some Label'],
]);

describe('followedReleases', () => {
  it('names the followed seller, else the followed label, and leaves the rest out', () => {
    const followed = followedReleases(
      [
        { id: 1, bandId: WARP, labelId: null },
        { id: 2, bandId: 7, labelId: LABEL },
        { id: 3, bandId: WARP, labelId: LABEL },
        { id: 4, bandId: 7, labelId: 8 },
        { id: 5, bandId: 7, labelId: null },
      ],
      bands,
    );

    expect(followed).toEqual(
      new Map([
        [1, 'Warp'],
        [2, 'Some Label'],
        [3, 'Warp'],
      ]),
    );
  });

  it('counts a release when any of its records is followed', () => {
    const followed = followedReleases(
      [
        { id: 1, bandId: 7, labelId: null },
        { id: 1, bandId: WARP, labelId: null },
      ],
      bands,
    );

    expect(followed.get(1)).toBe('Warp');
  });

  it('is empty when you follow nobody', () => {
    expect(followedReleases([{ id: 1, bandId: WARP, labelId: null }], new Map()).size).toBe(0);
  });
});

describe('followFactor', () => {
  it('nudges rather than dominates: below the ×1.5 twin boost', () => {
    expect(followFactor(true)).toBe(1 + FOLLOW_BOOST);
    expect(followFactor(true)).toBeLessThan(1.5);
    expect(followFactor(false)).toBe(1);
  });

  it('only raises ceilings when something is followed', () => {
    expect(maxFollowFactor(new Map())).toBe(1);
    expect(maxFollowFactor(new Map([[1, 'Warp']]))).toBe(1 + FOLLOW_BOOST);
  });
});

describe('boostFollowed', () => {
  it('lifts a followed release past a close call in For you', () => {
    const followed = new Map([[2, 'Warp']]);
    const scored = [
      scoreForYou({ id: 1, twinScore: 1.1, twins: 3 }, 10),
      scoreForYou({ id: 2, twinScore: 1.0, twins: 3 }, 10),
    ];

    expect(rankForYou(scored, 10).map((s) => s.id)).toEqual([1, 2]);
    expect(rankForYou(boostFollowed(scored, followed), 10).map((s) => s.id)).toEqual([2, 1]);
  });

  it('does not lift it past clearly stronger evidence', () => {
    const followed = new Map([[2, 'Warp']]);
    const scored = [
      scoreForYou({ id: 1, twinScore: 2, twins: 6 }, 10),
      scoreForYou({ id: 2, twinScore: 1, twins: 3 }, 10),
    ];

    expect(rankForYou(boostFollowed(scored, followed), 10).map((s) => s.id)).toEqual([1, 2]);
  });

  it('leaves unfollowed rows as they are', () => {
    const row = { id: 1, score: 3 };
    expect(boostFollowed([row], new Map([[2, 'Warp']]))[0]).toBe(row);
  });

  it('stays under the scaled ceiling, so pruning never skips a boosted release', () => {
    const followed = new Map([[2, 'Warp']]);
    const basis = { supporters: 20, population: 2000 };
    const [boosted] = boostFollowed([scoreCoOwned({ id: 2, co: 5, votes: 5 }, 5, basis)], followed);

    expect(boosted?.score).toBeGreaterThan(scoreCeiling(5, 0));
    expect(boosted?.score).toBeLessThanOrEqual(scoreCeiling(5 * maxFollowFactor(followed), 0));
  });
});

describe('followedFirst', () => {
  it('moves followed supporters to the front, keeping each group in order', () => {
    expect(followedFirst([5, 6, 7, 8, 9], new Set([8, 6]))).toEqual([6, 8, 5, 7, 9]);
  });

  it('keeps the order when you follow none of them', () => {
    expect(followedFirst([3, 1, 2], new Set([9]))).toEqual([3, 1, 2]);
  });
});
