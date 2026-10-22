import { describe, expect, it } from 'vitest';
import { COMPILATION_FACTOR, discountCompilations, withoutCompilations } from './compilations';

describe('withoutCompilations', () => {
  const mine = Float64Array.from([1, 2, 3]);
  const shared = [
    { mine: 0, theirs: 4 },
    { mine: 1, theirs: 5 },
    { mine: 2, theirs: 6 },
  ];

  it('drops shared releases that are compilations of yours', () => {
    expect(withoutCompilations(shared, mine, new Set([2]))).toEqual([
      { mine: 0, theirs: 4 },
      { mine: 2, theirs: 6 },
    ]);
  });

  it('keeps everything with nothing flagged', () => {
    expect(withoutCompilations(shared, mine, new Set())).toEqual(shared);
  });
});

describe('discountCompilations', () => {
  it('scales compilations down and leaves the rest as they were', () => {
    const scored = [
      { id: 1, score: 4, co: 3 },
      { id: 2, score: 4, co: 3 },
    ];

    expect(discountCompilations(scored, new Set([2]))).toEqual([
      { id: 1, score: 4, co: 3 },
      { id: 2, score: 4 * COMPILATION_FACTOR, co: 3 },
    ]);
  });
});
