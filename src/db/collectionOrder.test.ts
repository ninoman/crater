import { describe, expect, it } from 'vitest';
import type { CollectionOrderEntry, ItemKey } from '../bandcamp';
import { mergeTopOfOrder, orderRanks, reorderEntries } from './collectionOrder';

const e = (itemId: number, itemKey: ItemKey | null = `a${itemId}`): CollectionOrderEntry => ({
  itemId,
  itemKey,
});
const keys = (entries: CollectionOrderEntry[]) => entries.map((entry) => entry.itemId);

describe('mergeTopOfOrder', () => {
  it('puts the fetched top first and keeps the rest in their stored order', () => {
    expect(keys(mergeTopOfOrder([e(1), e(2), e(3), e(4)], [e(9), e(3), e(1)]))).toEqual([
      9, 3, 1, 2, 4,
    ]);
  });
});

describe('reorderEntries', () => {
  it('puts releases in the new order', () => {
    expect(keys(reorderEntries([e(1), e(2), e(3)], ['a3', 'a1', 'a2']))).toEqual([3, 1, 2]);
  });

  it('keeps a subscription in its place', () => {
    const sub = e(50, null);
    expect(keys(reorderEntries([e(1), sub, e(2), e(3)], ['a3', 'a2', 'a1']))).toEqual([
      3, 50, 2, 1,
    ]);
  });

  it('keeps two entries of one release together', () => {
    const pkg = e(77, 'a1');
    expect(keys(reorderEntries([e(1), pkg, e(2)], ['a2', 'a1']))).toEqual([2, 1, 77]);
  });

  it('keeps releases the new order leaves out, after it, and ignores unknown ones', () => {
    expect(keys(reorderEntries([e(1), e(2), e(3)], ['a3', 'a9']))).toEqual([3, 1, 2]);
  });
});

describe('orderRanks', () => {
  it('ranks each release by its first entry, skipping subscriptions', () => {
    expect(orderRanks([e(5, null), e(2), e(1), e(77, 'a2')])).toEqual(
      new Map([
        ['a2', 1],
        ['a1', 2],
      ]),
    );
  });
});
