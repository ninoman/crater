import { describe, expect, it } from 'vitest';
import { crateMateOwnerCounts } from './wishlistCrateMates';

const list = (...ids: number[]) => Float64Array.from(ids).sort();

describe('crateMateOwnerCounts', () => {
  const crateMates = [list(1, 2, 3, 40), list(2, 3), list(3, 99)];

  it('counts the crate mates holding each release, in the order asked', () => {
    expect(crateMateOwnerCounts([3, 2, 1, 99], crateMates)).toEqual([3, 2, 1, 1]);
  });

  it('gives zero for a release nobody owns, or when there are no crate mates', () => {
    expect(crateMateOwnerCounts([7], crateMates)).toEqual([0]);
    expect(crateMateOwnerCounts([2], [])).toEqual([0]);
    expect(crateMateOwnerCounts([], crateMates)).toEqual([]);
  });

  it('finds ids at both ends of a list', () => {
    expect(crateMateOwnerCounts([1, 40], crateMates)).toEqual([1, 1]);
  });
});
