import { describe, expect, it } from 'vitest';
import { COMP_BUYER_WEIGHT, releaseBuyers } from './releaseBuyers';

// Fan 1 bought album a1, fan 2 its track t11, fan 3 its track t12.
const rows = [
  { fanId: 1, itemKey: 'a1' as const },
  { fanId: 2, itemKey: 't11' as const },
  { fanId: 3, itemKey: 't12' as const },
];
const weights = (map: Map<number, number>) => Object.fromEntries(map);

describe('releaseBuyers', () => {
  it('takes everyone on an album page, track buyers included', () => {
    const page = { releaseKey: 'a1', matchKey: 'a1', compilation: false } as const;

    expect(weights(releaseBuyers(page, rows, []))).toEqual({ 1: 1, 2: 1, 3: 1 });
  });

  it("takes only the whole comp's buyers on a compilation's page", () => {
    const page = { releaseKey: 'a1', matchKey: 'a1', compilation: true } as const;

    expect(weights(releaseBuyers(page, rows, []))).toEqual({ 1: 1 });
  });

  it("takes the album's buyers and this track's on a track page, not other tracks'", () => {
    const page = { releaseKey: 't11', matchKey: 'a1', compilation: false } as const;

    expect(weights(releaseBuyers(page, rows, [4]))).toEqual({ 1: 1, 2: 1, 4: 1 });
  });

  it("counts a comp's buyers for less on its track pages", () => {
    const page = { releaseKey: 't11', matchKey: 'a1', compilation: true } as const;

    expect(weights(releaseBuyers(page, rows, [4]))).toEqual({
      1: COMP_BUYER_WEIGHT,
      2: 1,
      4: 1,
    });
  });

  it('gives a fan who bought the comp and the track a full vote', () => {
    const page = { releaseKey: 't11', matchKey: 'a1', compilation: true } as const;
    const both = [...rows, { fanId: 1, itemKey: 't11' as const }];

    expect(releaseBuyers(page, both, []).get(1)).toBe(1);
  });
});
