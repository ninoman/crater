import { describe, expect, it } from 'vitest';
import type { ItemKey } from '../../bandcamp';
import type { ListedItem } from '../../shared/itemList';
import { NO_FILTER } from '../shared/tagFilter';
import { commonItemTagIds, visibleItemKeys } from './itemListFilter';

function wish(
  itemKey: ItemKey,
  artist: string,
  title: string,
  tagIds: number[] = [],
  extra: Partial<ListedItem> = {},
): ListedItem {
  return {
    itemKey,
    title,
    artist,
    url: `https://x.bandcamp.com/album/${itemKey}`,
    coverUrl: null,
    label: null,
    addedAt: null,
    tagIds,
    note: null,
    price: null,
    crateMateOwners: 0,
    crateMateScore: 0,
    heard: false,
    ...extra,
  };
}

const ITEMS = [
  wish('a1', 'Björk', 'Vespertine', [1, 2]),
  wish('a2', 'Burial', 'Untrue', [1]),
  wish('t3', 'Pearson Sound', 'Blue Cloud', [2]),
  wish('a4', 'Nobody', 'Untagged', [], {
    label: 'Hessle Audio',
    note: { text: 'ask Sam', rating: 3 },
  }),
];
const keys = (set: Set<ItemKey>) => [...set].sort();

describe('visibleItemKeys', () => {
  it('filters by tags in all and any mode', () => {
    expect(keys(visibleItemKeys(ITEMS, NO_FILTER))).toEqual(['a1', 'a2', 'a4', 't3']);
    expect(keys(visibleItemKeys(ITEMS, { ...NO_FILTER, tagIds: [1, 2] }))).toEqual(['a1']);
    expect(keys(visibleItemKeys(ITEMS, { tagIds: [1, 2], mode: 'any', query: '' }))).toEqual([
      'a1',
      'a2',
      't3',
    ]);
  });

  it('searches artists and titles without case or accents', () => {
    expect(keys(visibleItemKeys(ITEMS, { ...NO_FILTER, query: 'bjork' }))).toEqual(['a1']);
    expect(keys(visibleItemKeys(ITEMS, { ...NO_FILTER, query: 'UNTRUE' }))).toEqual(['a2']);
    expect(keys(visibleItemKeys(ITEMS, { tagIds: [2], mode: 'all', query: 'cloud' }))).toEqual([
      't3',
    ]);
  });
});

describe('visibleItemKeys search', () => {
  it('also finds a release by its label or by your note on it', () => {
    expect(keys(visibleItemKeys(ITEMS, { ...NO_FILTER, query: 'hessle' }))).toEqual(['a4']);
    expect(keys(visibleItemKeys(ITEMS, { ...NO_FILTER, query: 'ask sam' }))).toEqual(['a4']);
  });
});

describe('commonItemTagIds', () => {
  it('finds the tags every selected item has', () => {
    expect(commonItemTagIds(ITEMS, ['a1', 'a2'])).toEqual([1]);
    expect(commonItemTagIds(ITEMS, ['a1', 'a4'])).toEqual([]);
    expect(commonItemTagIds(ITEMS, [])).toEqual([]);
  });
});
