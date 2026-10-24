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
  pricedItemKeys,
  pruneItemData,
  putItemPrices,
  putOwnership,
  removeOwnershipExcept,
  upsertCollectionItems,
  type DigheadDb,
  type MeRecord,
} from '../db';
import type { SyncMode, SyncStep } from '../shared/sync';
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
  const fetched = await syncList(deps, me.fanId, 'wishlist', mode, 0);
  deps.onStep('following');
  // Its own failure leaves the followings as they were and doesn't stop the collection sync.
  await syncFollowing(deps, me.fanId).catch((error: unknown) =>
    console.error('dighead: following sync failed', error),
  );
  deps.onStep('collection');
  await syncList(deps, me.fanId, 'collection', mode, fetched);
  // After both lists: a wishlisted item bought since is in the collection now and keeps its tags.
  if (mode === 'full') await pruneItemData(deps.db, me.fanId);
  await markSynced(deps.db, deps.now());
  const after = await ownedItemKeys(deps.db, me.fanId, 'collection');
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
  // A wishlist item whose price was never read counts as new, so one incremental sync fills in
  // prices for a wishlist synced before they were kept (decisions §24).
  const owned = await ownedItemKeys(db, fanId, list);
  const priced = list === 'wishlist' ? await pricedItemKeys(db) : owned;
  const known = new Set([...owned].filter((key) => priced.has(key)));
  const seen = new Set<ItemKey>();
  let fetched = fetchedSoFar;
  let first = true;

  try {
    for await (const page of collectionPages(deps.fetchJson, list, fanId, deps.batchSize)) {
      const keys = page.items.map((item) => item.itemKey);
      if (mode === 'incremental' && keys.length > 0 && keys.every((key) => known.has(key))) {
        return fetched;
      }
      await upsertCollectionItems(db, page.items);
      await putOwnership(db, fanId, page.items, list);
      if (list === 'wishlist') await putItemPrices(db, page.items);
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
  }
  return fetched;
}
