import { describe, expect, it } from 'vitest';
import { crateMateOwnerCounts } from './wishlistCrateMates';

const list = (...ids: number[]) => Float64Array.from(ids).sort();

describe('crateMateOwnerCounts', () => {
  const crateMates = [
    { score: 10, matches: list(1, 2, 3, 40) },
    { score: 4, matches: list(2, 3) },
    { score: 1, matches: list(3, 99) },
  ];

  it('counts the crate mates holding each release, in the order asked', () => {
    expect(crateMateOwnerCounts([3, 2, 1, 99], crateMates).map((c) => c.owners)).toEqual([
      3, 2, 1, 1,
    ]);
  });

  it('sums their scores, so equal counts can be told apart', () => {
    const [two, other] = crateMateOwnerCounts([2, 99], crateMates);

    expect(two).toEqual({ owners: 2, score: 14 });
    expect(other).toEqual({ owners: 1, score: 1 });
  });

  it('gives zero for a release nobody owns, or when there are no crate mates', () => {
    expect(crateMateOwnerCounts([7], crateMates)).toEqual([{ owners: 0, score: 0 }]);
    expect(crateMateOwnerCounts([2], [])).toEqual([{ owners: 0, score: 0 }]);
    expect(crateMateOwnerCounts([], crateMates)).toEqual([]);
  });

  it('finds ids at both ends of a list', () => {
    const [first, last] = crateMateOwnerCounts([1, 40], crateMates);

    expect(first?.owners).toBe(1);
    expect(last?.owners).toBe(1);
  });
});
