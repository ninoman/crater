import type { CollectionItem, ItemKey, ReleaseInfo, Supporter } from '../../bandcamp';
import { ownershipFromCollection, ownershipFromSupporter } from '../mappers';
import type { DigheadDb, OwnershipRecord } from '../schema';
import { refreshFanMatches } from './matchIndex';

type Source = OwnershipRecord['source'];

/** Runs an ownership write together with the match-index refresh it calls for. */
function writeOwnership(db: DigheadDb, write: () => Promise<void>): Promise<void> {
  return db.transaction('rw', [db.ownership, db.fanMatches, db.matchOwners], write);
}

export async function putOwnership(
  db: DigheadDb,
  fanId: number,
  items: CollectionItem[],
  source: Source,
): Promise<void> {
  await writeOwnership(db, async () => {
    await db.ownership.bulkPut(items.map((item) => ownershipFromCollection(fanId, item, source)));
    await refreshFanMatches(db, [fanId]);
  });
}

/**
 * Fans with the release in their collection, by its matchKey, so a track page finds album
 * buyers and an album page finds track buyers.
 */
export async function collectorsOf(db: DigheadDb, releaseKey: ItemKey): Promise<Set<number>> {
  return db.transaction('r', [db.items, db.ownership], async () => {
    const release = await db.items.get(releaseKey);
    const rows = await db.ownership
      .where('matchKey')
      .equals(release?.albumKey ?? releaseKey)
      .toArray();
    return new Set(rows.filter((row) => row.source === 'collection').map((row) => row.fanId));
  });
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
  await writeOwnership(db, async () => {
    const stale = await db.ownership
      .where('fanId')
      .equals(fanId)
      .filter((row) => row.source === source && !keep.has(row.itemKey))
      .primaryKeys();
    await db.ownership.bulkDelete(stale);
    await refreshFanMatches(db, [fanId]);
  });
}

/**
 * Records that each supporter owns the release. Rows that already exist are left alone: a
 * collection scan or your own sync wrote them, with the real purchase date.
 */
export async function addSupporterOwnership(
  db: DigheadDb,
  release: Pick<ReleaseInfo, 'itemKey' | 'albumKey'>,
  supporters: Supporter[],
): Promise<void> {
  await writeOwnership(db, async () => {
    const keys = supporters.map((s): [number, ItemKey] => [s.fanId, release.itemKey]);
    const existing = await db.ownership.bulkGet(keys);
    const missing = supporters.filter((_, i) => existing[i] === undefined);
    await db.ownership.bulkPut(missing.map((s) => ownershipFromSupporter(release, s)));
    await refreshFanMatches(
      db,
      missing.map((s) => s.fanId),
    );
  });
}
