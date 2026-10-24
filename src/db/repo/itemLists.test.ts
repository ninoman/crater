import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey } from '../../bandcamp';
import { DigheadDb } from '../schema';
import { upsertCollectionItems } from './items';
import { markUnwishlisted, markWishlisted, putOwnership } from './ownership';
import { createTag, deleteTag, exportTags, importTags } from './tags';
import { assignItemTag, getItemTags, listedKeys, listOwnedItems, pruneItemData } from './itemLists';
import { saveItemNote } from './itemNotes';
import { putItemPrices } from './itemPrices';

const ME = 7;

function item(itemKey: ItemKey, addedAt: number | null): CollectionItem {
  return {
    itemKey,
    albumKey: null,
    title: `Title ${itemKey}`,
    artist: `Artist ${itemKey}`,
    bandId: 1,
    url: `https://artist.bandcamp.com/album/${itemKey}`,
    artId: 7,
    purchaseKind: 'album',
    label: null,
    labelId: null,
    otherOwners: null,
    addedAt,
    compilation: false,
  };
}

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
  const wished = [item('a1', 100), item('a2', 300), item('t3', null)];
  const owned = [item('a4', 200)];
  await upsertCollectionItems(db, [...wished, ...owned]);
  await putOwnership(db, ME, wished, 'wishlist');
  await putOwnership(db, ME, owned, 'collection');
});

afterEach(async () => {
  await db.delete();
});

async function tagId(name: string): Promise<number> {
  const result = await createTag(db, name);
  if (!result.ok) throw new Error(result.reason);
  return result.tag.id;
}

describe('listOwnedItems', () => {
  it('lists only wishlisted items, newest first, with their tags', async () => {
    const dub = await tagId('dub');
    await assignItemTag(db, dub, ['a1'], 'add');

    const rows = await listOwnedItems(db, ME, 'wishlist');

    expect(rows.map((row) => row.item.itemKey)).toEqual(['a2', 'a1', 't3']);
    expect(rows.map((row) => row.tagIds)).toEqual([[], [dub], []]);
    expect(rows[0]?.addedAt).toBe(300);
  });

  it('lists the collection on its own, with purchase dates', async () => {
    const rows = await listOwnedItems(db, ME, 'collection');

    expect(rows.map((row) => row.item.itemKey)).toEqual(['a4']);
    expect(rows[0]?.addedAt).toBe(200);
  });

  it('is empty for someone else', async () => {
    expect(await listOwnedItems(db, 99, 'wishlist')).toEqual([]);
  });

  it('carries your note and, on the wishlist, the price', async () => {
    await saveItemNote(db, 'a1', { text: 'for the label night', rating: 4 }, 1);
    await putItemPrices(db, [
      { ...item('a1', 100), price: { amount: 9, currency: 'EUR', purchasable: true } },
    ]);
    await saveItemNote(db, 'a4', { text: '', rating: 5 }, 1);

    const [, wished] = await listOwnedItems(db, ME, 'wishlist');
    const [owned] = await listOwnedItems(db, ME, 'collection');

    expect(wished).toMatchObject({
      note: { text: 'for the label night', rating: 4 },
      price: { amount: 9, currency: 'EUR', purchasable: true },
      matchKey: 'a1',
    });
    expect(owned).toMatchObject({ note: { text: '', rating: 5 }, price: null });
  });
});

describe('markWishlisted / markUnwishlisted', () => {
  it('puts an item hearted on its page in the wishlist', async () => {
    await upsertCollectionItems(db, [item('a5', null)]);

    await markWishlisted(db, ME, { itemKey: 'a5', albumKey: null }, 500);

    expect((await listOwnedItems(db, ME, 'wishlist'))[0]).toMatchObject({
      item: { itemKey: 'a5' },
      addedAt: 500,
    });
    expect(await getItemTags(db, ME, 'a5')).toEqual([]);
  });

  it('leaves an owned item owned and a wishlisted one its date', async () => {
    await markWishlisted(db, ME, { itemKey: 'a4', albumKey: null }, 500);
    await markWishlisted(db, ME, { itemKey: 'a1', albumKey: null }, 500);

    expect(await getItemTags(db, ME, 'a4')).toBeNull();
    expect(
      (await listOwnedItems(db, ME, 'wishlist')).find((row) => row.item.itemKey === 'a1')?.addedAt,
    ).toBe(100);
  });

  it('keeps the tags of a removed item for a quick re-add', async () => {
    const dub = await tagId('dub');
    await assignItemTag(db, dub, ['a1'], 'add');

    await markUnwishlisted(db, ME, 'a1');
    expect(await getItemTags(db, ME, 'a1')).toBeNull();

    await markWishlisted(db, ME, { itemKey: 'a1', albumKey: null }, 500);
    expect(await getItemTags(db, ME, 'a1')).toEqual([dub]);
  });

  it('never removes an owned item', async () => {
    await markUnwishlisted(db, ME, 'a4');

    expect(await db.ownership.get([ME, 'a4'])).toBeDefined();
  });
});

describe('getItemTags', () => {
  it('answers tags for a wishlisted item and null for anything else', async () => {
    const dub = await tagId('dub');
    await assignItemTag(db, dub, ['a1'], 'add');

    expect(await getItemTags(db, ME, 'a1')).toEqual([dub]);
    expect(await getItemTags(db, ME, 'a2')).toEqual([]);
    expect(await getItemTags(db, ME, 'a4')).toBeNull();
    expect(await getItemTags(db, ME, 'a99')).toBeNull();
  });
});

describe('assignItemTag', () => {
  it('adds and removes a tag on many items in one call, counting the changes', async () => {
    const dub = await tagId('dub');

    expect(await assignItemTag(db, dub, ['a1', 'a2'], 'add')).toBe(2);
    expect(await assignItemTag(db, dub, ['a1', 'a2'], 'add')).toBe(0);
    expect(await assignItemTag(db, dub, ['a1', 't3'], 'remove')).toBe(1);
    expect(await getItemTags(db, ME, 'a1')).toEqual([]);
    expect(await getItemTags(db, ME, 'a2')).toEqual([dub]);
  });

  it('adds nothing for a tag that does not exist', async () => {
    expect(await assignItemTag(db, 999, ['a1'], 'add')).toBe(0);
  });
});

describe('item tags and the rest', () => {
  it('survive the item being saved again by a sync', async () => {
    const dub = await tagId('dub');
    await assignItemTag(db, dub, ['a1'], 'add');
    await upsertCollectionItems(db, [item('a1', 100)]);
    await putOwnership(db, ME, [item('a1', 100)], 'wishlist');

    expect(await getItemTags(db, ME, 'a1')).toEqual([dub]);
  });

  it('are taken off by deleting the tag', async () => {
    const dub = await tagId('dub');
    const techno = await tagId('techno');
    await assignItemTag(db, dub, ['a1', 'a2'], 'add');
    await assignItemTag(db, techno, ['a1'], 'add');

    await deleteTag(db, dub);

    expect(await getItemTags(db, ME, 'a1')).toEqual([techno]);
    expect(await getItemTags(db, ME, 'a2')).toEqual([]);
  });

  it('finds which keys are in either list', async () => {
    expect(await listedKeys(db, ME, ['a1', 'a4', 'a99'])).toEqual(new Set(['a1', 'a4']));
  });
});

describe('pruneItemData', () => {
  it('drops tags and notes of items in neither list, and prices of items off the wishlist', async () => {
    const dub = await tagId('dub');
    await assignItemTag(db, dub, ['a1', 'a2', 'a4', 'a99'], 'add');
    for (const key of ['a1', 'a4', 'a99'] as const) {
      await saveItemNote(db, key, { text: key, rating: null }, 1);
    }
    await putItemPrices(db, [item('a1', 1), item('a4', 1), item('a99', 1)]);
    await db.ownership.delete([ME, 'a2']);

    await pruneItemData(db, ME);

    expect((await db.itemTags.toCollection().primaryKeys()).sort()).toEqual(['a1', 'a4']);
    expect((await db.itemNotes.toCollection().primaryKeys()).sort()).toEqual(['a1', 'a4']);
    expect(await db.itemPrices.toCollection().primaryKeys()).toEqual(['a1']);
  });
});

describe('prices', () => {
  it('are kept as null when Bandcamp gave none, so the sync does not read them again', async () => {
    await putItemPrices(db, [item('a1', 1)]);

    expect(await db.itemPrices.get('a1')).toEqual({ itemKey: 'a1', price: null });
  });
});

describe('tag backup with items', () => {
  it('exports item assignments and imports them back, skipping items in neither list', async () => {
    const dub = await tagId('dub');
    await assignItemTag(db, dub, ['a1', 'a2'], 'add');
    const backup = await exportTags(db);
    expect(backup.tags).toEqual([{ name: 'dub', assignments: [], items: ['a1', 'a2'] }]);
    expect(backup.notes).toEqual([]);

    await deleteTag(db, dub);
    const entry = { name: 'Dub', assignments: [], items: ['a1', 'a4', 'a99'] as ItemKey[] };
    const summary = await importTags(db, { version: 3, tags: [entry], notes: [] }, ME);

    expect(summary).toEqual({ tagsCreated: 1, assigned: 2, skipped: 1 });
    const [tag] = await db.tags.toArray();
    expect(await getItemTags(db, ME, 'a1')).toEqual([tag?.id]);
  });

  it('round-trips notes, keeps a note you already have, and skips items you no longer have', async () => {
    await saveItemNote(db, 'a1', { text: 'mine', rating: 5 }, 1);
    await saveItemNote(db, 'a2', { text: 'old', rating: null }, 1);
    const backup = await exportTags(db);
    expect(backup.notes).toEqual([
      { itemKey: 'a1', text: 'mine', rating: 5 },
      { itemKey: 'a2', text: 'old', rating: null },
    ]);

    await db.itemNotes.delete('a2');
    await saveItemNote(db, 'a1', { text: 'newer', rating: 2 }, 2);
    const notes = [...backup.notes, { itemKey: 'a99' as ItemKey, text: 'gone', rating: null }];
    const summary = await importTags(db, { version: 3, tags: [], notes }, ME);

    expect(summary).toEqual({ tagsCreated: 0, assigned: 1, skipped: 1 });
    expect(await db.itemNotes.get('a1')).toMatchObject({ text: 'newer', rating: 2 });
    expect(await db.itemNotes.get('a2')).toMatchObject({ text: 'old', rating: null });
  });

  it('skips every item when nobody is logged in', async () => {
    const entry = { name: 'dub', assignments: [], items: ['a1'] as ItemKey[] };
    expect(await importTags(db, { version: 2, tags: [entry], notes: [] }, null)).toEqual({
      tagsCreated: 1,
      assigned: 0,
      skipped: 1,
    });
  });
});
