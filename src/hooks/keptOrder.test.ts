import { describe, expect, it } from 'vitest';
import type { ItemKey } from '../bandcamp';
import { inRankOrder, isOutOfOrder, keepOrder } from './keptOrder';

const rows = (...keys: ItemKey[]) => keys.map((matchKey) => ({ matchKey }));
const keys = (list: { matchKey: ItemKey }[]) => list.map((row) => row.matchKey);

describe('keepOrder', () => {
  it('takes the ranking as it is when nothing is shown yet', () => {
    expect(keys(keepOrder([], rows('a1', 'a2')))).toEqual(['a1', 'a2']);
  });

  it('keeps shown rows in place, drops gone ones and puts new ones after them', () => {
    const next = keepOrder(rows('a1', 'a2', 'a3'), rows('a4', 'a3', 'a1'));
    expect(keys(next)).toEqual(['a1', 'a3', 'a4']);
  });

  it('takes the new versions of kept rows', () => {
    const fresh = { matchKey: 'a1' as const, heard: true };
    expect(keepOrder([{ matchKey: 'a1', heard: false }], [fresh])[0]).toBe(fresh);
  });
});

describe('inRankOrder and isOutOfOrder', () => {
  it('sorts by the ranking, with unranked rows last', () => {
    expect(keys(inRankOrder(rows('a9', 'a1', 'a2'), ['a2', 'a1']))).toEqual(['a2', 'a1', 'a9']);
  });

  it('tells when the rows differ from the ranking', () => {
    expect(isOutOfOrder(rows('a1', 'a2'), ['a1', 'a2'])).toBe(false);
    expect(isOutOfOrder(rows('a1', 'a2'), ['a2', 'a1'])).toBe(true);
    expect(isOutOfOrder([], [])).toBe(false);
  });
});
