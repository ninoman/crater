// Pulls the logged-in fan's own collection and wishlist into the DB. No cap for yourself.

import {
  BandcampApiError,
  collectionPages,
  type CollectionList,
  type CollectionOrderEntry,
  type FetchJson,
  type ItemKey,
} from '../bandcamp';
import {
  getCollectionOrder,
  markSynced,
  mergeTopOfOrder,
  putCollectionOrder,
  ownedItemKeys,
  pruneItemData,
  putOwnership,
  removeOwnershipExcept,
  upsertCollectionItems,
  type CraterDb,
  type MeRecord,
} from '../db';
import type { SyncMode, SyncStep } from '../shared/sync';
import { syncFollowing } from './syncFollowing';

export interface SyncDeps {
  db: CraterDb;
  fetchJson: FetchJson;
  batchSize: number;
  /** Waits between page requests, to stay polite. */
  pause: () => Promise<void>;
  now: () => number;
  onProgress: (itemsFetched: number) => void;
  onFollowingProgress: (followingFetched: number) => void;
  onStep: (step: SyncStep) => void;
}

/**
 * Syncs your wishlist, then your followings, then your collection. The two short lists go
 * first, so their tabs fill in within seconds of a first sync instead of after a big
 * collection (decisions §14). The wishlist goes before the collection so that, if an item was
 * bought since, the collection pass overwrites its row. Returns the collection items that
 * weren't in your collection before.
 */
export async function syncMe(deps: SyncDeps, me: MeRecord, mode: SyncMode): Promise<ItemKey[]> {
  const before = await ownedItemKeys(deps.db, me.fanId, 'collection');
  deps.onStep('wishlist');
  const { fetched } = await syncList(deps, me.fanId, 'wishlist', mode, 0);
  deps.onStep('following');
  // Its own failure leaves the followings as they were and doesn't stop the collection sync.
  await syncFollowing(deps, me.fanId).catch((error: unknown) =>
    console.error('crater: following sync failed', error),
  );
  deps.onStep('collection');
  await syncCollection(deps, me.fanId, mode, fetched);
  // After both lists: a wishlisted item bought since is in the collection now and keeps its tags.
  if (mode === 'full') await pruneItemData(deps.db, me.fanId);
  await markSynced(deps.db, deps.now());
  const after = await ownedItemKeys(deps.db, me.fanId, 'collection');
  return [...after].filter((key) => !before.has(key));
}

/**
 * The collection, and its order (decisions §29). Without a stored order the collection syncs in
 * full, so the order is whole; an incremental sync updates only the top of it.
 */
async function syncCollection(
  deps: SyncDeps,
  fanId: number,
  requested: SyncMode,
  fetchedSoFar: number,
): Promise<void> {
  const stored = await getCollectionOrder(deps.db, fanId);
  const mode = stored === null ? 'full' : requested;
  const { order } = await syncList(deps, fanId, 'collection', mode, fetchedSoFar);
  const entries = mode === 'full' || stored === null ? order : mergeTopOfOrder(stored, order);
  await putCollectionOrder(deps.db, fanId, entries);
}

interface ListSync {
  fetched: number;
  /** The entries read, in Bandcamp's order: the whole list in a full sync, its top otherwise. */
  order: CollectionOrderEntry[];
}

async function syncList(
  deps: SyncDeps,
  fanId: number,
  list: CollectionList,
  mode: SyncMode,
  fetchedSoFar: number,
): Promise<ListSync> {
  const { db } = deps;
  const known = await ownedItemKeys(db, fanId, list);
  const seen = new Set<ItemKey>();
  const order: CollectionOrderEntry[] = [];
  let fetched = fetchedSoFar;
  let first = true;

  try {
    for await (const page of collectionPages(deps.fetchJson, list, fanId, deps.batchSize)) {
      // Kept even from the page that ends an incremental sync, so a release moved into it counts.
      order.push(...page.order);
      const keys = page.items.map((item) => item.itemKey);
      if (mode === 'incremental' && keys.length > 0 && keys.every((key) => known.has(key))) {
        return { fetched, order };
      }
      await upsertCollectionItems(db, page.items);
      await putOwnership(db, fanId, page.items, list);
      for (const key of keys) seen.add(key);
      fetched += page.items.length;
      deps.onProgress(fetched);
      first = false;
      if (page.moreAvailable) await deps.pause();
    }
  } catch (error) {
    // A hidden wishlist answers {"error": true} on the first page (decisions §1). Keep what we have.
    if (list === 'wishlist' && first && error instanceof BandcampApiError) {
      return { fetched, order };
    }
    throw error;
  }

  if (mode === 'full') {
    await removeOwnershipExcept(db, fanId, list, seen);
  }
  return { fetched, order };
}
