import { describe, expect, it } from 'vitest';
import type { ListedItem } from '../../shared/itemList';
import { addedText, cardMeta, crateMatesText } from './itemCardText';

const base: ListedItem = {
  itemKey: 'a1',
  title: 'Untrue',
  artist: 'Burial',
  label: null,
  url: 'u',
  coverUrl: null,
  addedAt: Date.UTC(2026, 9, 3, 12),
  tagIds: [],
  crateMateOwners: 0,
  heard: false,
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

describe('crateMatesText', () => {
  it('counts crate mates, and says nothing for none', () => {
    expect(crateMatesText(0)).toBeNull();
    expect(crateMatesText(1)).toBe('owned by a crate mate');
    expect(crateMatesText(4)).toBe('owned by 4 of your crate mates');
  });
});

describe('cardMeta', () => {
  it('lists artist, date and crate mates, leaving out what is missing', () => {
    expect(cardMeta({ ...base, crateMateOwners: 2, label: 'Hyperdub' }, 'wishlist')).toEqual([
      'Burial · Hyperdub',
      'added 3 Oct 2026',
      'owned by 2 of your crate mates',
    ]);
    expect(cardMeta({ ...base, addedAt: null }, 'collection')).toEqual(['Burial']);
  });
});
