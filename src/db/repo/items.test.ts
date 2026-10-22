import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import { keyToNumber, parseReleasePage, type CollectionItem } from '../../bandcamp';
import { DigheadDb } from '../schema';
import { getCompilations, upsertCollectionItems, upsertReleasePageItem } from './items';

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

describe('compilation flag on items', () => {
  it('keeps a release page verdict when a collection page sees only the name', async () => {
    await upsertReleasePageItem(db, comp, 0);
    await upsertCollectionItems(db, [seenInCollection(false)], 1);

    expect(await db.items.get(comp.itemKey)).toMatchObject({
      compilation: true,
      supporterCount: 78,
    });
  });

  it('lets a release page clear what a collection page set', async () => {
    await upsertCollectionItems(db, [seenInCollection(true)], 0);
    await upsertReleasePageItem(db, { ...comp, compilation: false }, 1);

    expect((await db.items.get(comp.itemKey))?.compilation).toBe(false);
  });

  it('answers which match ids are compilations', async () => {
    await upsertReleasePageItem(db, comp, 0);
    await upsertCollectionItems(db, [{ ...seenInCollection(false), itemKey: 'a2' }], 0);

    const id = keyToNumber(comp.itemKey);
    expect(await getCompilations(db, [id, 2, 5])).toEqual(new Set([id]));
  });
});
