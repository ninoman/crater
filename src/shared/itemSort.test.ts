import { describe, expect, it } from 'vitest';
import type { ItemKey } from '../bandcamp';
import type { ListedItem } from './itemList';
import { DEFAULT_SORT, defaultDirection, SORT_KEYS, sortItems, validSort } from './itemSort';

function item(itemKey: ItemKey, over: Partial<ListedItem> = {}): ListedItem {
  return {
    itemKey,
    title: `Title ${itemKey}`,
    artist: 'Artist',
    label: null,
    url: `https://a.bandcamp.com/album/${itemKey}`,
    coverUrl: null,
    addedAt: 100,
    tagIds: [],
    note: null,
    price: null,
    crateMateOwners: 0,
    crateMateScore: 0,
    heard: false,
    ...over,
  };
}

const keys = (items: ListedItem[]) => items.map((i) => i.itemKey);
const price = (amount: number, currency = 'USD') => ({ amount, currency, purchasable: true });

describe('sortItems', () => {
  it('orders by date added, either way, with unknown dates last', () => {
    const items = [
      item('a1', { addedAt: 200 }),
      item('a2', { addedAt: null }),
      item('a3', { addedAt: 300 }),
      item('a4', { addedAt: 100 }),
    ];

    expect(keys(sortItems(items, { key: 'added', direction: 'desc' }))).toEqual([
      'a3',
      'a1',
      'a4',
      'a2',
    ]);
    expect(keys(sortItems(items, { key: 'added', direction: 'asc' }))).toEqual([
      'a4',
      'a1',
      'a3',
      'a2',
    ]);
  });

  it('orders artists and labels without regard to case, with numbers by value', () => {
    const items = [
      item('a1', { artist: 'zed', label: 'Hyperdub' }),
      item('a2', { artist: 'Ábel', label: null }),
      item('a3', { artist: 'Act 10', label: 'hessle' }),
      item('a4', { artist: 'Act 2', label: '' }),
    ];

    expect(keys(sortItems(items, { key: 'artist', direction: 'asc' }))).toEqual([
      'a2',
      'a4',
      'a3',
      'a1',
    ]);
    // Releases without a label go last, whichever way the labels run.
    expect(keys(sortItems(items, { key: 'label', direction: 'asc' }))).toEqual([
      'a3',
      'a1',
      'a2',
      'a4',
    ]);
    expect(keys(sortItems(items, { key: 'label', direction: 'desc' }))).toEqual([
      'a1',
      'a3',
      'a2',
      'a4',
    ]);
  });

  it('orders prices within a currency and keeps each currency together', () => {
    const items = [
      item('a1', { price: price(20) }),
      item('a2', { price: price(5, 'EUR') }),
      item('a3', { price: price(8) }),
      item('a4', { price: null }),
      item('a5', { price: price(30, 'EUR') }),
    ];

    expect(keys(sortItems(items, { key: 'price', direction: 'asc' }))).toEqual([
      'a2',
      'a5',
      'a3',
      'a1',
      'a4',
    ]);
    expect(keys(sortItems(items, { key: 'price', direction: 'desc' }))).toEqual([
      'a1',
      'a3',
      'a5',
      'a2',
      'a4',
    ]);
  });

  it('puts the release most of your crate mates own first, their scores breaking ties', () => {
    const items = [
      item('a1', { crateMateOwners: 1, crateMateScore: 9 }),
      item('a2', { crateMateOwners: 3, crateMateScore: 2 }),
      item('a3', { crateMateOwners: 3, crateMateScore: 5 }),
      item('a4'),
    ];

    expect(keys(sortItems(items, { key: 'crateMates', direction: 'desc' }))).toEqual([
      'a3',
      'a2',
      'a1',
      'a4',
    ]);
  });

  it('buys next what you rated highest, then what crate mates own, then what you added last', () => {
    const items = [
      item('a1', { crateMateOwners: 9 }),
      item('a2', { note: { text: '', rating: 5 } }),
      item('a3', { note: { text: 'x', rating: 1 }, crateMateOwners: 1 }),
      item('a4', { note: { text: 'x', rating: 5 }, crateMateOwners: 2 }),
      item('a5', { crateMateOwners: 9, addedAt: 500 }),
    ];

    expect(keys(sortItems(items, { key: 'buyNext', direction: 'desc' }))).toEqual([
      'a4',
      'a2',
      'a3',
      'a5',
      'a1',
    ]);
  });

  it('keeps the incoming order for ties, and does not change its input', () => {
    const items = [item('a1'), item('a2'), item('a3')];

    expect(keys(sortItems(items, { key: 'artist', direction: 'asc' }))).toEqual(['a1', 'a2', 'a3']);
    expect(keys(items)).toEqual(['a1', 'a2', 'a3']);
  });
});

describe('sort keys', () => {
  it('offers the collection only the keys it has data for', () => {
    expect(SORT_KEYS.collection).toEqual(['added', 'artist', 'label']);
    expect(SORT_KEYS.wishlist).toContain('crateMates');
  });

  it('starts names low to high and counts high to low', () => {
    expect(defaultDirection('artist')).toBe('asc');
    expect(defaultDirection('price')).toBe('asc');
    expect(defaultDirection('added')).toBe('desc');
    expect(defaultDirection('buyNext')).toBe('desc');
  });

  it('falls back to date added for a saved key the list does not have', () => {
    expect(validSort({ key: 'price', direction: 'asc' }, 'collection')).toEqual(DEFAULT_SORT);
    expect(validSort({ key: 'label', direction: 'desc' }, 'collection')).toEqual({
      key: 'label',
      direction: 'desc',
    });
  });
});
