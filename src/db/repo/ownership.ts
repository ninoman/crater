import type { CollectionItem, ItemKey } from '../../bandcamp';
import { ownershipFromCollection } from '../mappers';
import type { DigheadDb, OwnershipRecord } from '../schema';

type Source = OwnershipRecord['source'];

export async function putOwnership(
  db: DigheadDb,
  fanId: number,
  items: CollectionItem[],
  source: Source,
): Promise<void> {
  await db.ownership.bulkPut(items.map((item) => ownershipFromCollection(fanId, item, source)));
}

/** Item keys a fan has in their collection or wishlist. */
export async function ownedItemKeys(
  db: DigheadDb,
  fanId: number,
  source: Source,
): Promise<Set<ItemKey>> {
  const rows = await db.ownership.where('fanId').equals(fanId).toArray();
  return new Set(rows.filter((row) => row.source === source).map((row) => row.itemKey));
}

export async function countOwnership(db: DigheadDb, fanId: number, source: Source) {
  return db.ownership
    .where('fanId')
    .equals(fanId)
    .filter((row) => row.source === source)
    .count();
}

/** Deletes a fan's rows for `source` that aren't in `keep`, e.g. items removed from a wishlist. */
export async function removeOwnershipExcept(
  db: DigheadDb,
  fanId: number,
  source: Source,
  keep: ReadonlySet<ItemKey>,
): Promise<void> {
  const stale = await db.ownership
    .where('fanId')
    .equals(fanId)
    .filter((row) => row.source === source && !keep.has(row.itemKey))
    .primaryKeys();
  await db.ownership.bulkDelete(stale);
}
