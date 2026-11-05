import {
  type CollectionItem,
  type ItemKey,
  matchKey,
  type ReleaseInfo,
  type Supporter,
} from '../../bandcamp';
import { ownershipFromCollection, ownershipFromSupporter } from '../mappers';
import type { CraterDb, OwnershipRecord } from '../schema';
import { getItemFields } from './items';
import { refreshFanMatches } from './matchIndex';
import {
  editFans,
  fanRows,
  fanRowsFor,
  matchRows,
  ownershipTables,
  type RowEdit,
} from './ownershipStore';

type Source = OwnershipRecord['source'];

/** Edits fans' rows and refreshes the match index for the ones that changed, in one transaction. */
function writeOwnership(db: CraterDb, fanIds: Iterable<number>, edit: RowEdit): Promise<void> {
  return db.transaction('rw', [...ownershipTables(db), db.fanMatches, db.matchOwners], async () => {
    await refreshFanMatches(db, await editFans(db, fanIds, edit));
  });
}

export async function putOwnership(
  db: CraterDb,
  fanId: number,
  items: CollectionItem[],
  source: Source,
): Promise<void> {
  await writeOwnership(db, [fanId], (rows) => {
    for (const item of items) {
      rows.set(item.itemKey, ownershipFromCollection(fanId, item, source));
    }
  });
}

/**
 * Records a wishlist add made on a Bandcamp page, before the next sync sees it (decisions §21).
 * An item you own stays owned, and one already wishlisted keeps its date.
 */
export async function markWishlisted(
  db: CraterDb,
  fanId: number,
  release: Pick<ReleaseInfo, 'itemKey' | 'albumKey'>,
  addedAt: number,
): Promise<void> {
  await writeOwnership(db, [fanId], (rows) => {
    if (rows.has(release.itemKey)) return;
    rows.set(release.itemKey, {
      fanId,
      itemKey: release.itemKey,
      matchKey: matchKey(release),
      source: 'wishlist',
      addedAt,
    });
  });
}

/**
 * Records a wishlist removal made on a Bandcamp page. Its tags stay, so a quick re-add loses
 * nothing; the next full sync drops them (decisions §14).
 */
export async function markUnwishlisted(
  db: CraterDb,
  fanId: number,
  itemKey: ItemKey,
): Promise<void> {
  await writeOwnership(db, [fanId], (rows) => {
    if (rows.get(itemKey)?.source === 'wishlist') rows.delete(itemKey);
  });
}

/**
 * Fans with the release in their collection, by its matchKey, so a track page finds album
 * buyers and an album page finds track buyers.
 */
export async function collectorsOf(db: CraterDb, releaseKey: ItemKey): Promise<Set<number>> {
  return db.transaction('r', [db.items, ...ownershipTables(db)], async () => {
    const [release] = await getItemFields(db, [releaseKey]);
    const rows = await matchRows(db, release?.albumKey ?? releaseKey);
    return new Set(rows.map((row) => row.fanId));
  });
}

/** How many fans have each single track of a release in their collection. */
export async function trackBuyerCounts(
  db: CraterDb,
  releaseKey: ItemKey,
): Promise<Map<ItemKey, number>> {
  const counts = new Map<ItemKey, number>();
  for (const row of await matchRows(db, releaseKey)) {
    if (!row.itemKey.startsWith('t')) continue;
    counts.set(row.itemKey, (counts.get(row.itemKey) ?? 0) + 1);
  }
  return counts;
}

/** Item keys a fan has in their collection or wishlist. */
export async function ownedItemKeys(
  db: CraterDb,
  fanId: number,
  source: Source,
): Promise<Set<ItemKey>> {
  const rows = await fanRows(db, fanId);
  return new Set(rows.filter((row) => row.source === source).map((row) => row.itemKey));
}

/** A fan's collection rows (not the wishlist). */
export async function collectionRows(db: CraterDb, fanId: number): Promise<OwnershipRecord[]> {
  const rows = await fanRows(db, fanId);
  return rows.filter((row) => row.source === 'collection');
}

export async function countOwnership(db: CraterDb, fanId: number, source: Source) {
  return (await fanRows(db, fanId)).filter((row) => row.source === source).length;
}

/** Deletes a fan's rows for `source` that aren't in `keep`, e.g. items removed from a wishlist. */
export async function removeOwnershipExcept(
  db: CraterDb,
  fanId: number,
  source: Source,
  keep: ReadonlySet<ItemKey>,
): Promise<void> {
  await writeOwnership(db, [fanId], (rows) => {
    for (const row of [...rows.values()]) {
      if (row.source === source && !keep.has(row.itemKey)) rows.delete(row.itemKey);
    }
  });
}

/**
 * Records that each supporter owns the release. Rows that already exist are left alone: a
 * collection scan or your own sync wrote them, with the real purchase date.
 */
export async function addSupporterOwnership(
  db: CraterDb,
  release: Pick<ReleaseInfo, 'itemKey' | 'albumKey'>,
  supporters: Supporter[],
): Promise<void> {
  const bySupporter = new Map(supporters.map((s) => [s.fanId, s]));
  await writeOwnership(db, bySupporter.keys(), (rows, fanId) => {
    const supporter = bySupporter.get(fanId);
    if (supporter && !rows.has(release.itemKey)) {
      rows.set(release.itemKey, ownershipFromSupporter(release, supporter));
    }
  });
}

/** When a fan bought an item, from their ownership row. Null when unknown or not owned. */
export async function purchasedAt(
  db: CraterDb,
  fanId: number,
  itemKey: ItemKey,
): Promise<number | null> {
  return (await fanRowsFor(db, fanId, [itemKey]))[0]?.addedAt ?? null;
}

/** Which of these items a fan already has a row for, in either list. */
export async function knownItemKeys(
  db: CraterDb,
  fanId: number,
  itemKeys: readonly ItemKey[],
): Promise<Set<ItemKey>> {
  const rows = await fanRowsFor(db, fanId, itemKeys);
  return new Set(rows.flatMap((row) => (row ? [row.itemKey] : [])));
}
