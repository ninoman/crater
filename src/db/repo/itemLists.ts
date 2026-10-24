// Your wishlist and collection as lists, with your tags on their items (decisions §14, §24).
// Tags live apart from `items` and `ownership`, keyed by item, so a scan rewriting `items` or a
// sync rewriting `ownership` keeps them.

import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, ItemRecord, ItemTagsRecord, OwnershipRecord } from '../schema';
import { fanRows } from './fanRows';
import { getItemList } from './items';

type Source = OwnershipRecord['source'];

/** An item in one of your lists with what we know of the release and what you added to it. */
export interface OwnedRow {
  item: ItemRecord;
  /** albumKey ?? itemKey, what crate mates' collections are matched on. */
  matchKey: ItemKey;
  /** When you wishlisted or bought it; null when Bandcamp didn't say. */
  addedAt: number | null;
  tagIds: number[];
}

/** Your wishlist or collection, newest first. Items whose metadata we lack are left out. */
export async function listOwnedItems(
  db: DigheadDb,
  fanId: number,
  source: Source,
): Promise<OwnedRow[]> {
  return db.transaction('r', [db.ownership, db.items, db.bands, db.itemTags], async () => {
    const owned = (await fanRows(db, fanId)).filter((row) => row.source === source);
    const keys = owned.map((row) => row.itemKey);
    const [items, tags] = await Promise.all([getItemList(db, keys), db.itemTags.bulkGet(keys)]);
    const rows = owned.flatMap((row, i): OwnedRow[] => {
      const item = items[i];
      if (!item) return [];
      return [
        { item, matchKey: row.matchKey, addedAt: row.addedAt, tagIds: tags[i]?.tagIds ?? [] },
      ];
    });
    return rows.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
  });
}

/** The tag ids on an item in your wishlist, or null when it isn't in your wishlist. */
export async function getItemTags(
  db: DigheadDb,
  fanId: number,
  itemKey: ItemKey,
): Promise<number[] | null> {
  return db.transaction('r', [db.ownership, db.itemTags], async () => {
    const row = await db.ownership.get([fanId, itemKey]);
    if (row?.source !== 'wishlist') return null;
    return (await db.itemTags.get(itemKey))?.tagIds ?? [];
  });
}

/** Adds a tag to, or removes it from, many items in one transaction. Returns how many changed. */
export async function assignItemTag(
  db: DigheadDb,
  tagId: number,
  itemKeys: ItemKey[],
  action: 'add' | 'remove',
): Promise<number> {
  return db.transaction('rw', [db.tags, db.itemTags], async () => {
    if (action === 'add' && !(await db.tags.get(tagId))) return 0;
    const rows = await db.itemTags.bulkGet(itemKeys);
    const changed = itemKeys.flatMap((itemKey, i): ItemTagsRecord[] => {
      const tagIds = rows[i]?.tagIds ?? [];
      if (tagIds.includes(tagId) === (action === 'add')) return [];
      return [
        {
          itemKey,
          tagIds: action === 'add' ? [...tagIds, tagId] : tagIds.filter((id) => id !== tagId),
        },
      ];
    });
    await db.itemTags.bulkPut(changed);
    return changed.length;
  });
}

/**
 * After a full sync: drops tags of items that are in neither list any more. A bought item keeps
 * its tags (decisions §24).
 */
export async function pruneItemData(db: DigheadDb, fanId: number): Promise<void> {
  await db.transaction('rw', [db.ownership, db.itemTags], async () => {
    const listed = new Set((await fanRows(db, fanId)).map((row) => row.itemKey));
    await db.itemTags.filter((row) => !listed.has(row.itemKey)).delete();
  });
}

/** Which of `itemKeys` are in your wishlist or collection. */
export async function listedKeys(
  db: DigheadDb,
  fanId: number,
  itemKeys: ItemKey[],
): Promise<Set<ItemKey>> {
  const rows = await db.ownership.bulkGet(itemKeys.map((key): [number, ItemKey] => [fanId, key]));
  return new Set(rows.flatMap((row) => (row ? [row.itemKey] : [])));
}
