// Pulls the logged-in fan's own collection and wishlist into the DB. No cap for yourself.

import {
  BandcampApiError,
  collectionPages,
  type CollectionList,
  type FetchJson,
  type ItemKey,
} from '../bandcamp';
import {
  markSynced,
  ownedItemKeys,
  putOwnership,
  removeOwnershipExcept,
  upsertCollectionItems,
  type DigheadDb,
  type MeRecord,
} from '../db';
import type { SyncMode } from '../shared/sync';

export interface SyncDeps {
  db: DigheadDb;
  fetchJson: FetchJson;
  batchSize: number;
  /** Waits between page requests, to stay polite. */
  pause: () => Promise<void>;
  now: () => number;
  onProgress: (itemsFetched: number) => void;
}

// Wishlist first: if an item was bought since, the collection pass overwrites its row.
const LISTS: CollectionList[] = ['wishlist', 'collection'];

export async function syncMe(deps: SyncDeps, me: MeRecord, mode: SyncMode): Promise<void> {
  let fetched = 0;
  for (const list of LISTS) {
    fetched = await syncList(deps, me.fanId, list, mode, fetched);
  }
  await markSynced(deps.db, deps.now());
}

async function syncList(
  deps: SyncDeps,
  fanId: number,
  list: CollectionList,
  mode: SyncMode,
  fetchedSoFar: number,
): Promise<number> {
  const { db } = deps;
  const known = await ownedItemKeys(db, fanId, list);
  const seen = new Set<ItemKey>();
  let fetched = fetchedSoFar;
  let first = true;

  try {
    for await (const page of collectionPages(deps.fetchJson, list, fanId, deps.batchSize)) {
      const keys = page.items.map((item) => item.itemKey);
      if (mode === 'incremental' && keys.length > 0 && keys.every((key) => known.has(key))) {
        return fetched;
      }
      await upsertCollectionItems(db, page.items, deps.now());
      await putOwnership(db, fanId, page.items, list);
      keys.forEach((key) => seen.add(key));
      fetched += page.items.length;
      deps.onProgress(fetched);
      first = false;
      if (page.moreAvailable) await deps.pause();
    }
  } catch (error) {
    // A hidden wishlist answers {"error": true} on the first page (decisions §1). Keep what we have.
    if (list === 'wishlist' && first && error instanceof BandcampApiError) return fetched;
    throw error;
  }

  if (mode === 'full') await removeOwnershipExcept(db, fanId, list, seen);
  return fetched;
}
