import { describe, expect, it } from 'vitest';
import { keyFromNumber, keyToNumber } from '../bandcamp';
import { exclusions, type MyRow } from './exclusions';

describe('exclusions', () => {
  const mine: MyRow[] = [
    { itemKey: 'a1', matchKey: 'a1', source: 'collection' },
    { itemKey: 't21', matchKey: 'a2', source: 'collection' },
    { itemKey: 't22', matchKey: 'a2', source: 'collection' },
    { itemKey: 'a3', matchKey: 'a3', source: 'wishlist' },
    { itemKey: 't41', matchKey: 'a4', source: 'wishlist' },
    { itemKey: 't51', matchKey: 'a5', source: 'collection' },
    { itemKey: 'a5', matchKey: 'a5', source: 'collection' },
  ];

  it('leaves out the release, hidden ones, and whole releases you own or wishlisted', () => {
    const { excluded } = exclusions(mine, new Set(['a9']), 'a8');

    expect([...excluded].map(keyFromNumber).sort()).toEqual(['a1', 'a3', 'a5', 'a8', 'a9']);
  });

  it('needs no release, for recommenders that start from you', () => {
    const { excluded } = exclusions(mine, new Set(['a9']));

    expect([...excluded].map(keyFromNumber).sort()).toEqual(['a1', 'a3', 'a5', 'a9']);
  });

  it('keeps albums you own some tracks of, with the count', () => {
    const { ownedTracks } = exclusions(mine, new Set(), 'a8');

    expect(ownedTracks).toEqual(new Map([[keyToNumber('a2'), 2]]));
  });
});
