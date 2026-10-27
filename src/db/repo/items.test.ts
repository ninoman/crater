import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import { keyToNumber, parseReleasePage, type CollectionItem } from '../../bandcamp';
import { CraterDb } from '../schema';
import { getCompilations, getItem, upsertCollectionItems, upsertReleasePageItem } from './items';

let db: CraterDb;

beforeEach(async () => {
  db = new CraterDb(`test-${crypto.randomUUID()}`);
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
