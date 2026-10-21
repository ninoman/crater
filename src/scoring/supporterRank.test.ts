import { describe, expect, it } from 'vitest';
import { inCommonSimilarity, passZeroOrder, readsAhead, type PassZeroInput } from './supporterRank';

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
