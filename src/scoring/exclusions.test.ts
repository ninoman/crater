import { describe, expect, it } from 'vitest';
import { keyFromNumber, keyToNumber, type ItemKey } from '../bandcamp';
import { exclusions, type HiddenTargets, type MyRow } from './exclusions';

const hiding = (
  releases: ItemKey[] = [],
  bands: number[] = [],
  labels: number[] = [],
): HiddenTargets => ({
  releases: new Set(releases),
  bands: new Set(bands),
  labels: new Set(labels),
});

const sorted = (ids: Set<number>) => [...ids].map(keyFromNumber).sort();

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

  it('leaves out the release, hidden ones, whole releases you own or wishlisted, and albums you own a track of', () => {
    const { ids } = exclusions(mine, hiding(['a9']), { release: 'a8' });

    expect(sorted(ids)).toEqual(['a1', 'a2', 'a3', 'a5', 'a8', 'a9']);
  });

  it('needs no release, for recommenders that start from you', () => {
    expect(sorted(exclusions(mine, hiding(['a9'])).ids)).toEqual(['a1', 'a2', 'a3', 'a5', 'a9']);
  });

  it('keeps an album you only wishlisted a track of', () => {
    expect(exclusions(mine, hiding()).ids.has(keyToNumber('a4'))).toBe(false);
  });

  describe('hidden artists and labels', () => {
    // Artist 10 sells its own releases, one of them on label 30. Label 20 sells from its own account.
    const own = { bandId: 10, labelId: null };
    const onLabel = { bandId: 10, labelId: 30 };
    const labelSold = { bandId: 20, labelId: null };
    const other = { bandId: 11, labelId: null };

    it('leaves out every release of a hidden artist, including ones not seen when hiding', () => {
      const { allows, checksSellers } = exclusions([], hiding([], [10]));

      expect(checksSellers).toBe(true);
      expect([own, onLabel, labelSold, other].map(allows)).toEqual([false, false, true, true]);
    });

    it('leaves out a hidden label, whether it sells from its own account or the artist’s', () => {
      const viaArtist = exclusions([], hiding([], [], [30]));
      const ownAccount = exclusions([], hiding([], [], [20]));

      expect([own, onLabel, labelSold].map(viaArtist.allows)).toEqual([true, false, true]);
      expect([own, onLabel, labelSold].map(ownAccount.allows)).toEqual([true, true, false]);
    });

    it('has nothing to check per item when only releases are hidden', () => {
      const { allows, checksSellers } = exclusions(mine, hiding(['a9']));

      expect(checksSellers).toBe(false);
      expect(allows(own)).toBe(true);
    });
  });

  describe('heard', () => {
    const heard = new Set<ItemKey>(['a6', 'a9']);

    it('stays in unless the list asks to hide heard releases', () => {
      expect(exclusions(mine, hiding()).ids.has(keyToNumber('a6'))).toBe(false);
      expect(sorted(exclusions([], hiding(), { heard }).ids)).toEqual(['a6', 'a9']);
    });

    it('never brings back a hidden release: hide wins', () => {
      // a9 is hidden and heard; hiding heard ones or not, it stays out.
      expect(exclusions([], hiding(['a9'])).ids.has(keyToNumber('a9'))).toBe(true);
      expect(exclusions([], hiding(['a9']), { heard }).ids.has(keyToNumber('a9'))).toBe(true);
    });
  });
});
