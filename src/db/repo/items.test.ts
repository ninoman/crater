import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import { keyToNumber, parseReleasePage, type CollectionItem } from '../../bandcamp';
import { DigheadDb } from '../schema';
import { getCompilations, getItem, upsertCollectionItems, upsertReleasePageItem } from './items';

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

const comp = parseReleasePage(fixtureText('album-page-compilation.html')).item;

/** The comp as a collection page shows it, under an artist line that doesn't give it away. */
function seenInCollection(compilation: boolean): CollectionItem {
  return {
    ...comp,
    artist: 'Jazzman',
    purchaseKind: 'album',
    label: null,
    labelId: null,
    otherOwners: 77,
    addedAt: null,
    compilation,
  };
}

function sighting(patch: Partial<CollectionItem> = {}): CollectionItem {
  return {
    itemKey: 'a9',
    albumKey: null,
    title: 'Nine',
    artist: 'Artist',
    bandId: 4,
    url: 'https://artist.bandcamp.com/album/nine',
    artId: null,
    purchaseKind: 'album',
    label: null,
    labelId: null,
    otherOwners: 3,
    addedAt: null,
    compilation: false,
    facts: { year: null, nameYourPrice: true, physical: false },
    band: { genre: 10, location: null },
    ...patch,
  };
}

describe('filter facts', () => {
  it("saves a collection row's facts on the item and its band facts on the band", async () => {
    await upsertCollectionItems(db, [
      sighting({ band: { genre: 10, location: 'Leipzig, Germany' } }),
    ]);

    expect((await getItem(db, 'a9'))?.facts).toEqual({
      year: null,
      nameYourPrice: true,
      physical: false,
    });
    expect(await db.bands.get(4)).toEqual({
      bandId: 4,
      hosts: ['artist'],
      genre: 10,
      location: 'Leipzig, Germany',
    });
  });

  it('keeps the year a release page found when a collection row, with no date, comes after', async () => {
    const page = parseReleasePage(fixtureText('album-page.html')).item;
    await upsertReleasePageItem(db, page);
    await upsertCollectionItems(db, [
      sighting({
        itemKey: page.itemKey,
        bandId: page.bandId,
        url: page.url,
        facts: { year: null, nameYourPrice: false, physical: true },
        band: { genre: null, location: null },
      }),
    ]);

    // The row's own answers replace the page's, and the page's year and band facts stay.
    expect((await getItem(db, page.itemKey))?.facts).toEqual({
      year: 2021,
      nameYourPrice: false,
      physical: true,
    });
    expect(await db.bands.get(page.bandId)).toMatchObject({ genre: 10, location: 'UK' });
  });

  it('leaves an item with no facts as it was', async () => {
    const { facts: _, band: __, ...bare } = sighting();
    await upsertCollectionItems(db, [bare]);

    expect((await getItem(db, 'a9'))?.facts).toBeUndefined();
    expect(await db.bands.get(4)).toEqual({ bandId: 4, hosts: ['artist'] });
  });
});

describe('compilation flag on items', () => {
  it('keeps a release page verdict when a collection page sees only the name', async () => {
    await upsertReleasePageItem(db, comp);
    await upsertCollectionItems(db, [seenInCollection(false)]);

    expect(await db.items.get(comp.itemKey)).toMatchObject({
      compilation: true,
      supporterCount: 78,
    });
  });

  it('lets a release page clear what a collection page set', async () => {
    await upsertCollectionItems(db, [seenInCollection(true)]);
    await upsertReleasePageItem(db, { ...comp, compilation: false });

    expect((await getItem(db, comp.itemKey))?.compilation).toBe(false);
  });

  it('answers which match ids are compilations', async () => {
    await upsertReleasePageItem(db, comp);
    await upsertCollectionItems(db, [{ ...seenInCollection(false), itemKey: 'a2' }]);

    const id = keyToNumber(comp.itemKey);
    expect(await getCompilations(db, [id, 2, 5])).toEqual(new Set([id]));
  });
});
