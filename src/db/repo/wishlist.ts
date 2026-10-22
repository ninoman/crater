// Your wishlist and your own tags on its items (decisions §14). Tag ids live in `itemTags`,
// keyed by item, so a scan rewriting `items` or a sync rewriting `ownership` keeps them.

import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, ItemRecord, ItemTagsRecord } from '../schema';
import { fanRows } from './fanRows';
import { getItemList } from './items';

/** A wishlisted item with what we know of the release and your tags on it. */
export interface WishlistRow {
  item: ItemRecord;
  /** When you wishlisted it; null when Bandcamp didn't say. */
  addedAt: number | null;
  tagIds: number[];
}

/** Your wishlist, newest first. Items whose metadata we lack are left out. */
export async function listWishlist(db: DigheadDb, fanId: number): Promise<WishlistRow[]> {
  return db.transaction('r', [db.ownership, db.items, db.bands, db.itemTags], async () => {
    const owned = await fanRows(db, fanId);
    const wished = owned.filter((row) => row.source === 'wishlist');
    const keys = wished.map((row) => row.itemKey);
    const [items, tags] = await Promise.all([getItemList(db, keys), db.itemTags.bulkGet(keys)]);
    const rows = wished.flatMap((row, i): WishlistRow[] => {
      const item = items[i];
      return item ? [{ item, addedAt: row.addedAt, tagIds: tags[i]?.tagIds ?? [] }] : [];
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

/** Deletes the tags of items not in `keep`: after a full wishlist sync, those that left it. */
export async function removeItemTagsExcept(
  db: DigheadDb,
  keep: ReadonlySet<ItemKey>,
): Promise<void> {
  await db.itemTags.filter((row) => !keep.has(row.itemKey)).delete();
}

/** Which of `itemKeys` are in your wishlist. */
export async function wishlistedKeys(
  db: DigheadDb,
  fanId: number,
  itemKeys: ItemKey[],
): Promise<Set<ItemKey>> {
  const rows = await db.ownership.bulkGet(itemKeys.map((key): [number, ItemKey] => [fanId, key]));
  return new Set(rows.flatMap((row) => (row?.source === 'wishlist' ? [row.itemKey] : [])));
}
