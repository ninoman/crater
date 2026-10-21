import { describe, expect, it } from 'vitest';
import {
  compareTwins,
  intersect,
  isLabelCluster,
  LABEL_CLUSTER_FACTOR,
  scoreTwin,
  sharedReleases,
  type Candidate,
  type MyCollection,
  type TwinInput,
} from './twins';

const ids = (...values: number[]) => Float64Array.from(values).sort();
const NONE = ids();

// You own 1–10. Releases 1–5 are rare (w = 1), 6–10 are hits (w = 0.1).
// Label 100 is releases 1–4 plus 20–22 (a 7-release catalog), label 200 is everything else.
const mine: MyCollection = {
  matchIds: ids(1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
  trackIds: NONE,
  partialIds: NONE,
  albumOfTrack: new Map(),
};
const weights = new Map([...mine.matchIds].map((id) => [id, id <= 5 ? 1 : 0.1]));
const labelOf = new Map<number, number>();
for (let id = 1; id <= 40; id++) labelOf.set(id, id <= 4 || (id >= 20 && id <= 22) ? 100 : 200);
const catalogSize = new Map([
  [100, 7],
  [200, 33],
]);
const input: TwinInput = {
  mine,
  weights,
  labelOf,
  catalogSize,
  minCollectionSize: 3,
  maxCollectionSize: 1000,
  labelClusterDownweight: true,
};
const fan = (fanId: number, ...values: number[]): Candidate => ({
  fanId,
  matchIds: ids(...values),
  trackIds: NONE,
  partialIds: NONE,
  size: values.length,
});
/** scoreTwin for fans the test expects to score. */
const scored = (candidate: Candidate, over: TwinInput = input) => {
  const twin = scoreTwin(candidate, over);
  if (!twin) throw new Error(`fan ${candidate.fanId} was filtered out`);
  return twin;
};

describe('intersect', () => {
  it('returns the ids both sorted lists hold', () => {
    expect(intersect(ids(1, 3, 5, 7), ids(2, 3, 4, 7, 9))).toEqual([3, 7]);
    expect(intersect(ids(), ids(1))).toEqual([]);
  });
});

describe('sharedReleases', () => {
  // Albums are positive ids, tracks negative (keyToNumber). Album 1 has tracks -11 and -12.
  // You own album 2 whole, and only track -11 of album 1.
  const you: MyCollection = {
    matchIds: ids(1, 2, 3),
    trackIds: ids(-11),
    partialIds: ids(1),
    albumOfTrack: new Map([[-11, 1]]),
  };
  const them = (matchIds: number[], trackIds: number[], partialIds: number[]) => ({
    matchIds: ids(...matchIds),
    trackIds: ids(...trackIds),
    partialIds: ids(...partialIds),
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

describe('scoreTwin', () => {
  it('scores only the releases sharedReleases keeps', () => {
    const you = {
      ...mine,
      trackIds: ids(-11),
      partialIds: ids(1),
      albumOfTrack: new Map([[-11, 1]]),
    };
    const other = { ...fan(1, 1, 5, 30), trackIds: ids(-12), partialIds: ids(1) };

    expect(scoreTwin(other, { ...input, mine: you })).toMatchObject({ overlap: 1 });
  });

  it('computes overlap, Jaccard and the normalised weighted score', () => {
    const twin = scoreTwin(fan(1, 5, 6, 30, 31), input);

    expect(twin).toMatchObject({ fanId: 1, overlap: 2, labelCluster: false });
    expect(twin?.jaccard).toBeCloseTo(2 / 12);
    expect(twin?.score).toBeCloseTo(1.1 / Math.sqrt(10 * 4));
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
    expect(scoreTwin(fan(1, 5, 6), input)).toBeNull();
    expect(scoreTwin({ ...fan(1, 5, 6, 30), size: 1001 }, input)).toBeNull();
    expect(scoreTwin(fan(1, 30, 31, 32), input)).toBeNull();
  });

  it('flags and down-weights a fan who collects one label wholesale', () => {
    const subscriber = fan(1, 1, 2, 3, 20, 21, 30);
    const twin = scored(subscriber);
    const unweighted = scored(subscriber, { ...input, labelClusterDownweight: false });

    expect(twin.labelCluster).toBe(true);
    expect(unweighted.labelCluster).toBe(true);
    expect(twin.score).toBeCloseTo(unweighted.score * LABEL_CLUSTER_FACTOR);
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

describe('compareTwins', () => {
  it('orders a synthetic crowd by score, then overlap, then fanId', () => {
    const crowd = [
      fan(1, 6, 7, 8, 9, 30), // four hits
      fan(2, 1, 2, 3, 4, 20, 21, 22), // label 100 subscriber
      fan(3, 1, 5, 9, 31), // two rare and a hit
      fan(4, 5, 31, 32), // one rare
      fan(5, 5, 33, 34), // the same, tie on score and overlap
    ];
    const ranked = crowd
      .map((candidate) => scoreTwin(candidate, input))
      .filter((twin) => twin !== null)
      .sort(compareTwins);

    expect(ranked.map((twin) => twin.fanId)).toEqual([3, 4, 5, 2, 1]);
  });
});
