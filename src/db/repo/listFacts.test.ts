import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem } from '../../bandcamp';
import { DigheadDb } from '../schema';
import { upsertCollectionItems } from './items';
import { type BandFactsCache, getShownWithFacts } from './listFacts';

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

function row(itemKey: CollectionItem['itemKey'], patch: Partial<CollectionItem> = {}) {
  return {
    itemKey,
    albumKey: null,
    title: itemKey,
    artist: 'Artist',
    bandId: 4,
    url: `https://artist.bandcamp.com/album/${itemKey}`,
    artId: null,
    purchaseKind: 'album',
    label: null,
    labelId: null,
    otherOwners: null,
    addedAt: null,
    compilation: false,
    ...patch,
  } satisfies CollectionItem;
}

describe('getShownWithFacts', () => {
  it("joins an item's facts with its band's genre and location", async () => {
    await upsertCollectionItems(db, [
      row('a1', {
        facts: { year: 2020, nameYourPrice: true, physical: false },
        band: { genre: 10, location: 'Leipzig, Germany' },
      }),
    ]);

    const shown = (await getShownWithFacts(db, ['a1'], { bands: new Map() })).get('a1');
    expect(shown?.facts).toEqual({
      genre: 10,
      location: 'Leipzig, Germany',
      nameYourPrice: true,
      physical: false,
      year: 2020,
    });
    expect(shown?.item).toMatchObject({ itemKey: 'a1', bandId: 4 });
  });

  it('leaves the band facts null when asked not to read bands', async () => {
    await upsertCollectionItems(db, [
      row('a1', {
        facts: { year: null, nameYourPrice: true, physical: null },
        band: { genre: 10, location: 'Leipzig, Germany' },
      }),
    ]);

    const { facts } = (await getShownWithFacts(db, ['a1'], { bands: null })).get('a1') ?? {};
    expect(facts).toMatchObject({ genre: null, location: null, nameYourPrice: true });
  });

  it('reads each band once, and keeps it in the cache it is given', async () => {
    await upsertCollectionItems(db, [
      row('a1', { band: { genre: 10, location: null } }),
      row('a2', { band: { genre: 10, location: null } }),
    ]);
    const cache: BandFactsCache = new Map();

    await getShownWithFacts(db, ['a1'], { bands: cache });
    // Even if the band changes, a request keeps what it read.
    await db.bands.update(4, { genre: 3 });
    const shown = await getShownWithFacts(db, ['a1', 'a2'], { bands: cache });

    expect([...cache.keys()]).toEqual([4]);
    expect(shown.get('a2')?.facts.genre).toBe(10);
  });

  it('gives nulls for what is not known, and nothing for a release with no record', async () => {
    await upsertCollectionItems(db, [row('a1')]);

    const facts = await getShownWithFacts(db, ['a1', 'a2'], { bands: new Map() });
    expect(facts.get('a1')?.facts).toEqual({
      genre: null,
      location: null,
      nameYourPrice: null,
      physical: null,
      year: null,
    });
    expect(facts.has('a2')).toBe(false);
  });

  it("reads a track's facts when only a track of the album has turned up", async () => {
    await upsertCollectionItems(db, [
      row('t7', {
        albumKey: 'a5',
        purchaseKind: 'track',
        facts: { year: null, nameYourPrice: false, physical: null },
      }),
    ]);

    const shown = await getShownWithFacts(db, ['a5'], { bands: new Map() });
    expect(shown.get('a5')?.facts.nameYourPrice).toBe(false);
  });
});
