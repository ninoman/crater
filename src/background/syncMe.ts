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
  removeItemTagsExcept,
  removeOwnershipExcept,
  upsertCollectionItems,
  type DigheadDb,
  type MeRecord,
} from '../db';
import type { SyncMode } from '../shared/sync';
import { syncFollowing } from './syncFollowing';

export interface SyncDeps {
  db: DigheadDb;
  fetchJson: FetchJson;
  batchSize: number;
  /** Waits between page requests, to stay polite. */
  pause: () => Promise<void>;
  now: () => number;
  onProgress: (itemsFetched: number) => void;
  onFollowingProgress: (followingFetched: number) => void;
}

// Wishlist first: if an item was bought since, the collection pass overwrites its row.
const LISTS: CollectionList[] = ['wishlist', 'collection'];

/** Syncs both lists, then your followings. Returns the collection items that weren't in your collection before. */
export async function syncMe(deps: SyncDeps, me: MeRecord, mode: SyncMode): Promise<ItemKey[]> {
  const before = await ownedItemKeys(deps.db, me.fanId, 'collection');
  let fetched = 0;
  for (const list of LISTS) {
    fetched = await syncList(deps, me.fanId, list, mode, fetched);
  }
  await markSynced(deps.db, deps.now());
  const after = await ownedItemKeys(deps.db, me.fanId, 'collection');
  // Its own failure leaves the followings as they were and doesn't undo the collection sync.
  await syncFollowing(deps, me.fanId).catch((error: unknown) =>
    console.error('dighead: following sync failed', error),
  );
  return [...after].filter((key) => !before.has(key));
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
      for (const key of keys) seen.add(key);
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

  if (mode === 'full') {
    await removeOwnershipExcept(db, fanId, list, seen);
    // Items that left the wishlist, bought or removed, take their tags with them (decisions §14).
    if (list === 'wishlist') await removeItemTagsExcept(db, seen);
  }
  return fetched;
}
