import { describe, expect, it } from 'vitest';
import { datedShare, randomFolds, temporalHoldout } from './splits';

const purchases = (ats: (number | null)[]) => ats.map((at, i) => ({ id: i + 1, at }));

describe('temporalHoldout', () => {
  it('holds out the newest fraction, undated last', () => {
    const held = temporalHoldout(purchases([10, 50, null, 30, 20]), 0.4);
    expect(held).toEqual([2, 4]);
  });

  it('breaks date ties on id so reruns agree', () => {
    expect(temporalHoldout(purchases([5, 5, 5, 5]), 0.5)).toEqual([1, 2]);
  });
});

describe('datedShare', () => {
  it('is the share of purchases with a date', () => {
    expect(datedShare(purchases([1, null, 3, null]))).toBe(0.5);
    expect(datedShare([])).toBe(0);
  });
});

describe('randomFolds', () => {
  const ids = Array.from({ length: 23 }, (_, i) => i + 1);

  it('puts every id in exactly one near-equal fold', () => {
    const folds = randomFolds(ids, 5, 1);
    expect(folds.flat().sort((a, b) => a - b)).toEqual(ids);
    expect(
      Math.max(...folds.map((f) => f.length)) - Math.min(...folds.map((f) => f.length)),
    ).toBeLessThanOrEqual(1);
  });

  it('is deterministic per seed and differs across seeds', () => {
    expect(randomFolds(ids, 5, 1)).toEqual(randomFolds(ids, 5, 1));
    expect(randomFolds(ids, 5, 1)).not.toEqual(randomFolds(ids, 5, 2));
  });
});
