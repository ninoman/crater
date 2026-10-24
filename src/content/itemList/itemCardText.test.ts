import { describe, expect, it } from 'vitest';
import type { ListedItem } from '../../shared/itemList';
import { addedText, cardMeta, crateMatesText, priceText } from './itemCardText';

const base: ListedItem = {
  itemKey: 'a1',
  title: 'Untrue',
  artist: 'Burial',
  label: null,
  url: 'u',
  coverUrl: null,
  addedAt: Date.UTC(2026, 9, 3, 12),
  tagIds: [],
  note: null,
  price: { amount: 15, currency: 'USD', purchasable: true },
  crateMateOwners: 0,
  crateMateScore: 0,
};

describe('addedText', () => {
  it('says added for the wishlist and bought for the collection', () => {
    expect(addedText(base.addedAt, 'wishlist')).toBe('added 3 Oct 2026');
    expect(addedText(base.addedAt, 'collection')).toBe('bought 3 Oct 2026');
  });

  it('is null when Bandcamp gave no date', () => {
    expect(addedText(null, 'wishlist')).toBeNull();
  });
});

describe('priceText', () => {
  it('shows the price, the running total and a warning', () => {
    expect(priceText(base, undefined)).toBe('$15.00');
    expect(priceText(base, 45)).toBe('$15.00 · running $45.00');
    const gone = { ...base, price: { amount: 15, currency: 'USD', purchasable: false } };
    expect(priceText(gone, undefined)).toBe('$15.00 · not for sale');
    expect(priceText({ ...base, price: null }, 45)).toBeNull();
  });
});

describe('crateMatesText', () => {
  it('counts crate mates, and says nothing for none', () => {
    expect(crateMatesText(0)).toBeNull();
    expect(crateMatesText(1)).toBe('owned by a crate mate');
    expect(crateMatesText(4)).toBe('owned by 4 of your crate mates');
  });
});

describe('cardMeta', () => {
  it('lists artist, date, price and crate mates, leaving out what is missing', () => {
    expect(
      cardMeta({ ...base, crateMateOwners: 2, label: 'Hyperdub' }, 'wishlist', undefined),
    ).toEqual([
      'Burial · Hyperdub',
      'added 3 Oct 2026',
      '$15.00',
      'owned by 2 of your crate mates',
    ]);
    expect(cardMeta({ ...base, price: null, addedAt: null }, 'collection', undefined)).toEqual([
      'Burial',
    ]);
  });
});
