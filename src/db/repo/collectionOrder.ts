// Your collection's order as Bandcamp keeps it (decisions §29).

import type { CollectionOrderEntry } from '../../bandcamp';
import type { CraterDb } from '../schema';

/** Null before a sync has read the whole collection once. */
export async function getCollectionOrder(
  db: CraterDb,
  fanId: number,
): Promise<CollectionOrderEntry[] | null> {
  return (await db.collectionOrder.get(fanId))?.entries ?? null;
}

export async function putCollectionOrder(
  db: CraterDb,
  fanId: number,
  entries: CollectionOrderEntry[],
): Promise<void> {
  await db.collectionOrder.put({ fanId, entries });
}
