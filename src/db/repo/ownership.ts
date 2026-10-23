import {
  type CollectionItem,
  type ItemKey,
  matchKey,
  type ReleaseInfo,
  type Supporter,
} from '../../bandcamp';
import { ownershipFromCollection, ownershipFromSupporter } from '../mappers';
import type { DigheadDb, OwnershipRecord } from '../schema';
import { readOwnership, storeOwnership } from '../storage';
import { getItemFields } from './items';
import { byFan, fanRows } from './fanRows';
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
    await db.ownership.bulkPut(
      items.map((item) => storeOwnership(ownershipFromCollection(fanId, item, source))),
    );
    await refreshFanMatches(db, [fanId]);
  });
}

/**
 * Records a wishlist add made on the release page, before the next sync sees it (decisions §21).
 * An item you own stays owned, and one already wishlisted keeps its date.
 */
export async function markWishlisted(
  db: DigheadDb,
  fanId: number,
  release: Pick<ReleaseInfo, 'itemKey' | 'albumKey'>,
  addedAt: number,
): Promise<void> {
  await writeOwnership(db, async () => {
    if (await db.ownership.get([fanId, release.itemKey])) return;
    await db.ownership.put(
      storeOwnership({
        fanId,
        itemKey: release.itemKey,
        matchKey: matchKey(release),
        source: 'wishlist',
        addedAt,
      }),
    );
    await refreshFanMatches(db, [fanId]);
  });
}

/**
 * Records a wishlist removal made on the release page. Its tags stay, so a quick re-add loses
 * nothing; the next full sync drops them (decisions §14).
 */
export async function markUnwishlisted(
  db: DigheadDb,
  fanId: number,
  itemKey: ItemKey,
): Promise<void> {
  await writeOwnership(db, async () => {
    const row = await db.ownership.get([fanId, itemKey]);
    if (!row || readOwnership(row).source !== 'wishlist') return;
    await db.ownership.delete([fanId, itemKey]);
    await refreshFanMatches(db, [fanId]);
  });
}

/**
 * Fans with the release in their collection, by its matchKey, so a track page finds album
 * buyers and an album page finds track buyers.
 */
export async function collectorsOf(db: DigheadDb, releaseKey: ItemKey): Promise<Set<number>> {
  return db.transaction('r', [db.items, db.ownership], async () => {
    const [release] = await getItemFields(db, [releaseKey]);
    const rows = await db.ownership
      .where('matchKey')
      .equals(release?.albumKey ?? releaseKey)
      .toArray();
    return new Set(
      rows.map(readOwnership).flatMap((row) => (row.source === 'collection' ? [row.fanId] : [])),
    );
  });
}

/** Item keys a fan has in their collection or wishlist. */
export async function ownedItemKeys(
  db: DigheadDb,
  fanId: number,
  source: Source,
): Promise<Set<ItemKey>> {
  const rows = await fanRows(db, fanId);
  return new Set(rows.filter((row) => row.source === source).map((row) => row.itemKey));
}

/** A fan's collection rows (not the wishlist). */
export async function collectionRows(db: DigheadDb, fanId: number): Promise<OwnershipRecord[]> {
  const rows = await fanRows(db, fanId);
  return rows.filter((row) => row.source === 'collection');
}

export async function countOwnership(db: DigheadDb, fanId: number, source: Source) {
  return byFan(db, fanId)
    .filter((row) => readOwnership(row).source === source)
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
    const stale = await byFan(db, fanId)
      .filter((row) => readOwnership(row).source === source && !keep.has(row.itemKey))
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
    await db.ownership.bulkPut(
      missing.map((s) => storeOwnership(ownershipFromSupporter(release, s))),
    );
    await refreshFanMatches(
      db,
      missing.map((s) => s.fanId),
    );
  });
}

/** When a fan bought an item, from their ownership row. Null when unknown or not owned. */
export async function purchasedAt(
  db: DigheadDb,
  fanId: number,
  itemKey: ItemKey,
): Promise<number | null> {
  return (await db.ownership.get([fanId, itemKey]))?.addedAt ?? null;
}

/** Which of these items a fan already has a row for, in either list. */
export async function knownItemKeys(
  db: DigheadDb,
  fanId: number,
  itemKeys: readonly ItemKey[],
): Promise<Set<ItemKey>> {
  const rows = await db.ownership.bulkGet(itemKeys.map((key): [number, ItemKey] => [fanId, key]));
  return new Set(rows.flatMap((row) => (row ? [row.itemKey] : [])));
}
