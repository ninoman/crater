import { describe, expect, it } from 'vitest';
import {
  inCommonSimilarity,
  passZeroOrder,
  readsAhead,
  seedFanOrder,
  type PassZeroInput,
} from './supporterRank';

const ids = (...values: number[]) => Float64Array.from(values).sort();

function input(overrides: Partial<PassZeroInput>): PassZeroInput {
  return {
    mine: new Set([1, 2, 3]),
    sellerCatalog: new Set([10, 11]),
    weights: new Map([
      [1, 1],
      [2, 0.5],
      [3, 0.25],
      [10, 1],
      [11, 1],
      [99, 1],
    ]),
    release: 99,
    supporters: [],
    ...overrides,
  };
}

describe('passZeroOrder', () => {
  it('puts the fans who own more of your releases first, weighted by rarity', () => {
    const order = passZeroOrder(
      input({
        supporters: [
          { fanId: 7, matchIds: ids(99, 3) },
          { fanId: 8, matchIds: ids(99, 1) },
          { fanId: 9, matchIds: ids(99, 2, 3) },
        ],
      }),
    );

    expect(order).toEqual([8, 9, 7]);
  });

  it('counts other releases from the seller or label at half weight', () => {
    const order = passZeroOrder(
      input({
        supporters: [
          { fanId: 7, matchIds: ids(99, 3) },
          { fanId: 8, matchIds: ids(99, 10) },
          { fanId: 9, matchIds: ids(99, 2) },
        ],
      }),
    );

    expect(order).toEqual([8, 9, 7]);
  });

  it('ignores the release itself, and keeps page order when nothing is known', () => {
    const order = passZeroOrder(
      input({
        mine: new Set([99]),
        supporters: [
          { fanId: 3, matchIds: ids(99) },
          { fanId: 1, matchIds: ids() },
          { fanId: 2, matchIds: ids(99, 50) },
        ],
      }),
    );

    expect(order).toEqual([3, 1, 2]);
  });
});

describe('inCommonSimilarity', () => {
  it('scales the count by both collection sizes, so volume alone does not win', () => {
    expect(inCommonSimilarity(20, 400, 100)).toBeCloseTo(0.1);
    expect(inCommonSimilarity(40, 400, 1600)).toBeCloseTo(0.05);
    expect(inCommonSimilarity(5, 0, 100)).toBe(0);
    expect(inCommonSimilarity(5, 100, 0)).toBe(0);
  });
});

describe('readsAhead', () => {
  it('reads ahead from half the best similarity so far, never at 0', () => {
    expect(readsAhead(0.05, 0.1)).toBe(true);
    expect(readsAhead(0.049, 0.1)).toBe(false);
    expect(readsAhead(0, 0)).toBe(false);
  });
});

describe('seedFanOrder', () => {
  const mine = new Set([1, 2, 3, 4]);
  // 1 and 2 are rare releases of yours, 3 and 4 hits.
  const weights = new Map([
    [1, 0.4],
    [2, 0.4],
    [3, 0.1],
    [4, 0.1],
  ]);

  it('puts fans on two or more of your releases first, then rarer shared releases', () => {
    const order = seedFanOrder({
      mine,
      weights,
      fans: [
        { fanId: 7, matchIds: ids(1) }, // one rare release
        { fanId: 8, matchIds: ids(3, 4) }, // two hits
        { fanId: 9, matchIds: ids(1, 2) }, // two rare releases
        { fanId: 10, matchIds: ids(1, 50, 60) }, // one of yours, the rest not
      ],
    });
    expect(order).toEqual([9, 8, 7, 10]);
  });

  it('keeps queue order for ties, including nothing in common', () => {
    const order = seedFanOrder({
      mine,
      weights,
      fans: [
        { fanId: 7, matchIds: ids() },
        { fanId: 8, matchIds: ids(3) },
        { fanId: 9, matchIds: ids(50) },
        { fanId: 10, matchIds: ids(4) },
      ],
    });
    expect(order).toEqual([8, 10, 7, 9]);
  });
});
