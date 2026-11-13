import { describe, expect, it } from 'vitest';
import type { ListedItem } from './itemList';
import { applyOrder } from './itemOrder';

const item = (itemKey: ListedItem['itemKey']): ListedItem => ({
  itemKey,
  title: itemKey,
  artist: 'Artist',
  label: null,
  url: `https://artist.bandcamp.com/album/${itemKey}`,
  coverUrl: null,
  addedAt: null,
  tagIds: [],
  crateMateOwners: 0,
});

describe('applyOrder', () => {
  it('sorts by the new order, with items it doesn’t name first', () => {
    const items = [item('a1'), item('a2'), item('a3'), item('a9')];

    expect(applyOrder(items, ['a3', 'a1', 'a2']).map((i) => i.itemKey)).toEqual([
      'a9',
      'a3',
      'a1',
      'a2',
    ]);
  });
});
