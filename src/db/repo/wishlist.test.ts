import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey } from '../../bandcamp';
import { DigheadDb } from '../schema';
import { upsertCollectionItems } from './items';
import { putOwnership } from './ownership';
import { createTag, deleteTag, exportTags, importTags } from './tags';
import {
  assignItemTag,
  getItemTags,
  listWishlist,
  removeItemTagsExcept,
  wishlistedKeys,
} from './wishlist';

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
  await upsertCollectionItems(db, [...wished, ...owned], 0);
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

describe('listWishlist', () => {
  it('lists only wishlisted items, newest first, with their tags', async () => {
    const dub = await tagId('dub');
    await assignItemTag(db, dub, ['a1'], 'add');

    const rows = await listWishlist(db, ME);

    expect(rows.map((row) => row.item.itemKey)).toEqual(['a2', 'a1', 't3']);
    expect(rows.map((row) => row.tagIds)).toEqual([[], [dub], []]);
    expect(rows[0]?.addedAt).toBe(300);
  });

  it('is empty for someone else', async () => {
    expect(await listWishlist(db, 99)).toEqual([]);
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
    await upsertCollectionItems(db, [item('a1', 100)], 1);
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

  it('go with items that left the wishlist', async () => {
    const dub = await tagId('dub');
    await assignItemTag(db, dub, ['a1', 'a2'], 'add');

    await removeItemTagsExcept(db, new Set(['a2']));

    expect(await db.itemTags.toCollection().primaryKeys()).toEqual(['a2']);
  });

  it('finds which keys are wishlisted', async () => {
    expect(await wishlistedKeys(db, ME, ['a1', 'a4', 'a99'])).toEqual(new Set(['a1']));
  });
});

describe('tag backup with items', () => {
  it('exports item assignments and imports them back, skipping items not wishlisted', async () => {
    const dub = await tagId('dub');
    await assignItemTag(db, dub, ['a1', 'a2'], 'add');
    const backup = await exportTags(db);
    expect(backup.tags).toEqual([{ name: 'dub', assignments: [], items: ['a1', 'a2'] }]);

    await deleteTag(db, dub);
    const entry = { name: 'Dub', assignments: [], items: ['a1', 'a4', 'a99'] as ItemKey[] };
    const summary = await importTags(db, { version: 2, tags: [entry] }, ME);

    expect(summary).toEqual({ tagsCreated: 1, assigned: 1, skipped: 2 });
    const [tag] = await db.tags.toArray();
    expect(await getItemTags(db, ME, 'a1')).toEqual([tag?.id]);
  });

  it('skips every item when nobody is logged in', async () => {
    const entry = { name: 'dub', assignments: [], items: ['a1'] as ItemKey[] };
    expect(await importTags(db, { version: 2, tags: [entry] }, null)).toEqual({
      tagsCreated: 1,
      assigned: 0,
      skipped: 1,
    });
  });
});
