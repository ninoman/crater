import { describe, expect, it } from 'vitest';
import { MONTH_MS, moment, TREND_LOOKBACK_MS } from './lately';
import {
  compareLately,
  compareCrateMates,
  intersect,
  isLatelyCrateMate,
  isLabelCluster,
  LABEL_CLUSTER_FACTOR,
  scoreCrateMate,
  sharedPositions,
  sharedReleases,
  type Candidate,
  type MyCollection,
  type CrateMate,
  type CrateMateInput,
} from './crateMates';

const ids = (...values: number[]) => Float64Array.from(values).sort();
const NONE = ids();

// You own 1–10. Releases 1–5 are rare (w = 1), 6–10 are hits (w = 0.1).
// Label 100 is releases 1–4 plus 20–22 (a 7-release catalog), label 200 is everything else.
const mine: MyCollection = {
  matchIds: ids(1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
  trackIds: NONE,
  partialIds: NONE,
  // Undated unless a test says otherwise, so lately stays out of the all-time tests.
  matchTimes: new Float64Array(10),
  albumOfTrack: new Map(),
};
const weights = new Map([...mine.matchIds].map((id) => [id, id <= 5 ? 1 : 0.1]));
const labelOf = new Map<number, number>();
for (let id = 1; id <= 40; id++) labelOf.set(id, id <= 4 || (id >= 20 && id <= 22) ? 100 : 200);
const catalogSize = new Map([
  [100, 7],
  [200, 33],
]);
const NOW = 100 * TREND_LOOKBACK_MS;
const HALF_LIFE = 6 * MONTH_MS;
const lately = (mineTimes: Float64Array): CrateMateInput['lately'] => ({
  halfLifeMs: HALF_LIFE,
  minPurchases: 1,
  now: moment(NOW, mineTimes, HALF_LIFE),
  yearAgo: moment(NOW - TREND_LOOKBACK_MS, mineTimes, HALF_LIFE),
});
const input: CrateMateInput = {
  mine,
  lately: lately(mine.matchTimes),
  weights,
  labelOf,
  catalogSize,
  minCollectionSize: 3,
  maxCollectionSize: 1000,
  labelClusterDownweight: true,
  compilations: new Set(),
};
const fan = (fanId: number, ...values: number[]): Candidate => ({
  fanId,
  matchIds: ids(...values),
  trackIds: NONE,
  partialIds: NONE,
  matchTimes: new Float64Array(values.length),
  size: values.length,
});
/** scoreCrateMate for fans the test expects to score. */
const scored = (candidate: Candidate, over: CrateMateInput = input) => {
  const crateMate = scoreCrateMate(candidate, over);
  if (!crateMate) throw new Error(`fan ${candidate.fanId} was filtered out`);
  return crateMate;
};

describe('intersect', () => {
  it('returns the ids both sorted lists hold', () => {
    expect(intersect(ids(1, 3, 5, 7), ids(2, 3, 4, 7, 9))).toEqual([3, 7]);
    expect(intersect(ids(), ids(1))).toEqual([]);
  });

  it('knows where each shared id sits in both lists', () => {
    expect(sharedPositions(ids(1, 3, 5, 7), ids(2, 3, 4, 7, 9))).toEqual([
      { mine: 1, theirs: 1 },
      { mine: 3, theirs: 3 },
    ]);
  });
});

describe('sharedReleases', () => {
  // Albums are positive ids, tracks negative (keyToNumber). Album 1 has tracks -11 and -12.
  // You own album 2 whole, and only track -11 of album 1.
  const you: MyCollection = {
    matchIds: ids(1, 2, 3),
    trackIds: ids(-11),
    partialIds: ids(1),
    matchTimes: new Float64Array(3),
    albumOfTrack: new Map([[-11, 1]]),
  };
  const them = (matchIds: number[], trackIds: number[], partialIds: number[]) => ({
    matchIds: ids(...matchIds),
    trackIds: ids(...trackIds),
    partialIds: ids(...partialIds),
    matchTimes: new Float64Array(matchIds.length),
  });

  it('matches exact items, and an album against one of its tracks', () => {
    expect(sharedReleases(you, them([1, 2], [], []))).toEqual([1, 2]);
    expect(sharedReleases(you, them([1, 2], [-21], [2]))).toEqual([1, 2]);
    expect(sharedReleases(you, them([1], [-11], [1]))).toEqual([1]);
  });

  it('does not match different tracks of the same album', () => {
    expect(sharedReleases(you, them([1, 3], [-12], [1]))).toEqual([3]);
  });

  it('matches when one shared track is among several', () => {
    expect(sharedReleases(you, them([1], [-11, -12], [1]))).toEqual([1]);
  });
});

describe('scoreCrateMate', () => {
  it('scores only the releases sharedReleases keeps', () => {
    const you = {
      ...mine,
      trackIds: ids(-11),
      partialIds: ids(1),
      albumOfTrack: new Map([[-11, 1]]),
    };
    const other = { ...fan(1, 1, 5, 30), trackIds: ids(-12), partialIds: ids(1) };

    expect(scoreCrateMate(other, { ...input, mine: you })).toMatchObject({ overlap: 1 });
  });

  it('computes overlap, Jaccard and the normalised weighted score', () => {
    const crateMate = scoreCrateMate(fan(1, 5, 6, 30, 31), input);

    expect(crateMate).toMatchObject({ fanId: 1, overlap: 2, labelCluster: false });
    expect(crateMate?.jaccard).toBeCloseTo(2 / 12);
    expect(crateMate?.score).toBeCloseTo(1.1 / Math.sqrt(10 * 4));
  });

  it('ranks rare shared releases above shared hits', () => {
    const rare = scored(fan(1, 5, 30, 31, 32));
    const hits = scored(fan(2, 6, 7, 8, 30));

    expect(rare.score).toBeGreaterThan(hits.score);
    expect(hits.overlap).toBeGreaterThan(rare.overlap);
  });

  it('penalises big collections through the √|F| term', () => {
    const small = scored(fan(1, 5, 6, 30));
    const big = scored(fan(2, 5, 6, 30, 31, 32, 33, 34, 35, 36, 37));

    expect(small.score).toBeGreaterThan(big.score);
  });

  it('drops fans outside the collection-size range, and fans sharing nothing', () => {
    expect(scoreCrateMate(fan(1, 5, 6), input)).toBeNull();
    expect(scoreCrateMate({ ...fan(1, 5, 6, 30), size: 1001 }, input)).toBeNull();
    expect(scoreCrateMate(fan(1, 30, 31, 32), input)).toBeNull();
  });

  it('flags and down-weights a fan who collects one label wholesale', () => {
    const subscriber = fan(1, 1, 2, 3, 20, 21, 30);
    const crateMate = scored(subscriber);
    const unweighted = scored(subscriber, { ...input, labelClusterDownweight: false });

    expect(crateMate.labelCluster).toBe(true);
    expect(unweighted.labelCluster).toBe(true);
    expect(crateMate.score).toBeCloseTo(unweighted.score * LABEL_CLUSTER_FACTOR);
  });

  describe('with compilations ignored', () => {
    // Releases 1 and 2 of yours are rare compilations.
    const ignoring: CrateMateInput = { ...input, compilations: new Set([1, 2]) };

    it('drops a fan whose only overlap is compilations', () => {
      const compBuyer = fan(1, 1, 2, 30);

      expect(scored(compBuyer).overlap).toBe(2);
      expect(scoreCrateMate(compBuyer, ignoring)).toBeNull();
    });

    it('counts only the other shared releases, so a real match ranks first', () => {
      const compBuyer = fan(1, 1, 2, 3, 30);
      const realMatch = fan(2, 3, 4, 30, 31);

      expect(compareCrateMates(scored(compBuyer), scored(realMatch))).toBeLessThan(0);
      const comp = scored(compBuyer, ignoring);
      const real = scored(realMatch, ignoring);
      expect(comp).toMatchObject({ overlap: 1, jaccard: 1 / 13 });
      expect(comp.score).toBeCloseTo(1 / Math.sqrt(10 * 4));
      expect(compareCrateMates(real, comp)).toBeLessThan(0);
    });

    it('leaves the label-cluster test to the other shared releases', () => {
      // 1–3 are label 100's: with 1 and 2 ignored, too few are left to flag a cluster.
      const subscriber = fan(1, 1, 2, 3, 20, 21, 30);

      expect(scored(subscriber).labelCluster).toBe(true);
      expect(scored(subscriber, ignoring).labelCluster).toBe(false);
    });
  });
});

describe('isLabelCluster', () => {
  it('needs both most of the overlap from one label and most of its catalog', () => {
    // 3 of 4 shared from label 100, owns 5 of its 7: flagged.
    expect(isLabelCluster([1, 2, 3, 6], ids(1, 2, 3, 6, 20, 21), labelOf, catalogSize)).toBe(true);
    // Same overlap, but owns only 3 of 7 (43%): a real overlap, not a subscriber.
    expect(isLabelCluster([1, 2, 3, 6], ids(1, 2, 3, 6), labelOf, catalogSize)).toBe(false);
    // Owns all of label 100, but it's only half the overlap.
    expect(
      isLabelCluster([1, 2, 6, 7], ids(1, 2, 3, 4, 6, 7, 20, 21, 22), labelOf, catalogSize),
    ).toBe(false);
  });

  it('needs a few shared releases from the label, however small its catalog', () => {
    const tiny = new Map([[100, 2]]);
    expect(isLabelCluster([1, 2], ids(1, 2), labelOf, tiny)).toBe(false);
    expect(isLabelCluster([1, 2, 3], ids(1, 2, 3), labelOf, new Map([[100, 3]]))).toBe(true);
  });

  it('ignores labels it knows nothing about', () => {
    expect(isLabelCluster([1, 2], ids(1, 2), new Map(), catalogSize)).toBe(false);
    expect(isLabelCluster([1, 2], ids(1, 2), labelOf, new Map())).toBe(false);
  });
});

describe('compareCrateMates', () => {
  it('orders a synthetic crowd by score, then overlap, then fanId', () => {
    const crowd = [
      fan(1, 6, 7, 8, 9, 30), // four hits
      fan(2, 1, 2, 3, 4, 20, 21, 22), // label 100 subscriber
      fan(3, 1, 5, 9, 31), // two rare and a hit
      fan(4, 5, 31, 32), // one rare
      fan(5, 5, 33, 34), // the same, tie on score and overlap
    ];
    const ranked = crowd
      .map((candidate) => scoreCrateMate(candidate, input))
      .filter((crateMate) => crateMate !== null)
      .sort(compareCrateMates);

    expect(ranked.map((crateMate) => crateMate.fanId)).toEqual([3, 4, 5, 2, 1]);
  });
});

describe('lately in scoreCrateMate', () => {
  const MONTH = MONTH_MS;
  // You bought 1–5 this past month and 6–10 four years ago.
  const matchTimes = Float64Array.from(
    [...mine.matchIds].map((id) => NOW - (id <= 5 ? 1 : 48) * MONTH),
  );
  const dated: CrateMateInput = {
    ...input,
    mine: { ...mine, matchTimes },
    lately: lately(matchTimes),
  };
  /** A fan who bought each [id, months ago]. */
  const datedFan = (fanId: number, ...bought: [id: number, monthsAgo: number][]): Candidate => {
    const sorted = [...bought].sort((a, b) => a[0] - b[0]);
    return {
      fanId,
      matchIds: Float64Array.from(sorted.map(([id]) => id)),
      trackIds: NONE,
      partialIds: NONE,
      matchTimes: Float64Array.from(sorted.map(([, ago]) => NOW - ago * MONTH)),
      size: sorted.length,
    };
  };
  const scoredDated = (candidate: Candidate) => {
    const crateMate = scoreCrateMate(candidate, dated);
    if (!crateMate) throw new Error(`fan ${candidate.fanId} was filtered out`);
    return crateMate;
  };

  it('ranks a fan in step with you now above an old crate mate with more in common', () => {
    // Old crate mate: all ten releases in common, all bought four years ago.
    const old = scoredDated(
      datedFan(1, ...[...mine.matchIds].map((id): [number, number] => [id, 48])),
    );
    // Now: two of your new rare releases, bought this month too, among other recent buys.
    const now = scoredDated(datedFan(2, [1, 1], [2, 1], [30, 1], [31, 2], [32, 3]));

    expect(old.score).toBeGreaterThan(now.score);
    // Four years of fading leave the old crate mate too little to score at all.
    expect(old.lately).toBeNull();
    expect(now.lately).toBeGreaterThan(0);
    expect(now.latelyOverlap).toBe(2);
    expect(old.latelyOverlap).toBe(0);
  });

  it('takes the year-ago score from purchases made by then', () => {
    // Shared 1 and 2 this month; 30–34 bought 13 months ago keep the fan active back then.
    const crateMate = scoredDated(
      datedFan(1, [1, 0], [2, 0], [30, 13], [31, 13], [32, 13], [33, 13], [34, 13]),
    );

    expect(crateMate.lately).toBeGreaterThan(0);
    expect(crateMate.yearAgo).toBe(0);
  });

  it('has no lately score for a fan who bought too little lately', () => {
    const quiet = scoreCrateMate(datedFan(1, [1, 40], [2, 40], [30, 40]), {
      ...dated,
      lately: { ...dated.lately, minPurchases: 2 },
    });

    expect(quiet?.lately).toBeNull();
    expect(quiet && isLatelyCrateMate(quiet)).toBe(false);
  });

  it('applies the label-cluster factor to the lately score too', () => {
    const subscriber = datedFan(1, [1, 1], [2, 1], [3, 1], [20, 1], [21, 1], [30, 1]);
    const crateMate = scoredDated(subscriber);
    const unweighted = scoreCrateMate(subscriber, { ...dated, labelClusterDownweight: false });

    expect(crateMate.labelCluster).toBe(true);
    expect(crateMate.lately).toBeCloseTo((unweighted?.lately ?? 0) * LABEL_CLUSTER_FACTOR);
  });

  it('leaves compilations bought together out of the lately score', () => {
    const together = datedFan(1, [1, 1], [2, 1], [30, 1], [31, 1], [32, 1]);
    const crateMate = scoreCrateMate(together, { ...dated, compilations: new Set([1, 2]) });

    expect(scoredDated(together).latelyOverlap).toBe(2);
    expect(crateMate).toBeNull();
  });
});

describe('compareLately', () => {
  const crateMate = (fanId: number, latelyScore: number | null, score = 0.1): CrateMate => ({
    fanId,
    overlap: 1,
    jaccard: 0.1,
    score,
    labelCluster: false,
    lately: latelyScore,
    yearAgo: null,
    latelyOverlap: 0,
  });

  it('orders by lately score, then the all-time order, missing scores last', () => {
    const ranked = [
      crateMate(1, null, 0.9),
      crateMate(2, 0.2),
      crateMate(3, 0.5),
      crateMate(4, 0.2, 0.3),
    ].sort(compareLately);

    expect(ranked.map((t) => t.fanId)).toEqual([3, 4, 2, 1]);
  });

  it('keeps active fans sharing a release bought this year on the lately board', () => {
    expect(isLatelyCrateMate({ ...crateMate(1, 0.1), latelyOverlap: 1 })).toBe(true);
    expect(isLatelyCrateMate(crateMate(1, 0.1))).toBe(false);
    expect(isLatelyCrateMate({ ...crateMate(1, null), latelyOverlap: 1 })).toBe(false);
  });
});
