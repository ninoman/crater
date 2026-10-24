import { describe, expect, it } from 'vitest';
import type { ItemKey } from '../bandcamp';
import type { ListedItem } from './itemList';
import { runningTotals, shortlist, totalsByCurrency } from './shortlist';

function item(
  itemKey: ItemKey,
  amount: number | null,
  currency = 'USD',
  over: Partial<ListedItem> = {},
): ListedItem {
  return {
    itemKey,
    title: itemKey,
    artist: 'Artist',
    label: null,
    url: 'u',
    coverUrl: null,
    addedAt: 1,
    tagIds: [],
    note: null,
    price: amount === null ? null : { amount, currency, purchasable: true },
    crateMateOwners: 0,
    crateMateScore: 0,
    ...over,
  };
}

describe('shortlist', () => {
  it('keeps only what you can buy, in buy next order', () => {
    const items = [
      item('a1', 5),
      item('a2', 9, 'USD', { price: { amount: 9, currency: 'USD', purchasable: false } }),
      item('a3', null),
      item('a4', 7, 'EUR', { note: { text: '', rating: 5 } }),
      item('a5', 3, 'USD', { crateMateOwners: 2 }),
    ];

    expect(shortlist(items).map((i) => i.itemKey)).toEqual(['a4', 'a5', 'a1']);
  });

  it('is empty when nothing is purchasable', () => {
    expect(shortlist([item('a1', null)])).toEqual([]);
  });
});

describe('totalsByCurrency', () => {
  it('adds each currency apart, commonest first, without float noise', () => {
    const items = [
      item('a1', 0.1),
      item('a2', 0.2),
      item('a3', 12, 'EUR'),
      item('a4', 5, 'USD'),
      item('a5', null),
    ];

    expect(totalsByCurrency(items)).toEqual([
      { currency: 'USD', amount: 5.3, count: 3 },
      { currency: 'EUR', amount: 12, count: 1 },
    ]);
  });

  it('is empty for no prices', () => {
    expect(totalsByCurrency([item('a1', null)])).toEqual([]);
  });
});

describe('runningTotals', () => {
  it('adds up in list order, per currency', () => {
    const items = [item('a1', 10), item('a2', 4, 'EUR'), item('a3', 5), item('a4', 6, 'EUR')];
    const running = runningTotals(items);

    expect([...running]).toEqual([
      ['a1', 10],
      ['a2', 4],
      ['a3', 15],
      ['a4', 10],
    ]);
  });

  it('skips items with no price', () => {
    expect(runningTotals([item('a1', null)]).size).toBe(0);
  });
});
