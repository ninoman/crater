// Decides when to sync the logged-in fan's collection, runs one sync at a time and tracks progress.

import type { ItemKey, Viewer } from '../bandcamp';
import { countFollowing, countOwnership, db, getMe, saveViewer, type MeRecord } from '../db';
import { loadSettings } from '../shared/settings';
import type { SyncActivity, SyncMode, SyncStatus } from '../shared/sync';
import { fetchJson } from './http';
import { refreshCrateMates } from './recommend';
import { paceDelayMs } from './scanner/pace';
import { chromeScannerStore } from './scanner/state';
import { syncMe } from './syncMe';

/** A page view re-syncs incrementally when the last sync is older than this. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** What a finished sync did, for whoever acts on it (the scanner seeds from it). */
export interface SyncResult {
  me: MeRecord;
  mode: SyncMode;
  /** Collection items that weren't owned before this sync. */
  added: ItemKey[];
}

let activity: SyncActivity = { state: 'idle' };
let afterSync: (result: SyncResult) => Promise<void> = async () => {};
let running: Promise<void> | null = null;

/** Starts a sync unless one is already running, in which case it joins that one. */
export function startSync(mode: SyncMode): Promise<void> {
  running ??= runSync(mode).finally(() => {
    running = null;
  });
  return running;
}

/** Runs after each successful sync, before the sync counts as settled. */
export function onSynced(listener: (result: SyncResult) => Promise<void>): void {
  afterSync = listener;
}

/** Resolves once no sync of your own is running, however it ends. */
export async function ownSyncSettled(): Promise<void> {
  await running?.catch(() => undefined);
}

async function runSync(requested: SyncMode): Promise<void> {
  // An import is replacing every table. Skipped, not queued: the next trigger syncs as usual.
  if ((await chromeScannerStore.load()).importing) return;
  const me = await getMe(db);
  if (!me) return;
  // Without a finished sync there's nothing to be incremental against.
  const mode = me.syncedAt === null ? 'full' : requested;
  const settings = await loadSettings();
  activity = { state: 'syncing', mode, step: 'wishlist', itemsFetched: 0, followingFetched: 0 };
  try {
    const added = await syncMe(
      {
        db,
        fetchJson,
        batchSize: settings.collectionBatchSize,
        // Re-reading settings is also an extension API call, which keeps the worker alive.
        pause: async () => {
          const [current, scanner] = await Promise.all([loadSettings(), chromeScannerStore.load()]);
          await sleep(paceDelayMs(current, Math.random, scanner.pace.factor));
        },
        now: Date.now,
        onProgress: (itemsFetched) => {
          if (activity.state === 'syncing') activity = { ...activity, itemsFetched };
        },
        onFollowingProgress: (followingFetched) => {
          if (activity.state === 'syncing') activity = { ...activity, followingFetched };
        },
        onStep: (step) => {
          if (activity.state === 'syncing') activity = { ...activity, step };
        },
      },
      me,
      mode,
    );
    activity = { state: 'idle' };
    refreshCrateMates();
    await afterSync({ me, mode, added }).catch((error: unknown) =>
      console.error('crater: after-sync step failed', error),
    );
  } catch (error) {
    console.error('crater: sync failed', error);
    activity = { state: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

/** A Bandcamp tab reported who is logged in and whether it's a purchase confirmation. */
export async function onPageSeen(viewer: Viewer | null, purchaseConfirmation: boolean) {
  if (!viewer) {
    if (purchaseConfirmation) void startSync('incremental');
    return;
  }
  const before = await getMe(db);
  const me = await saveViewer(db, viewer);
  if (before?.fanId !== me.fanId || me.syncedAt === null) {
    void startSync('full');
  } else if (purchaseConfirmation || Date.now() - me.syncedAt > STALE_AFTER_MS) {
    void startSync('incremental');
  }
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const me = await getMe(db);
  if (!me) return { state: 'logged-out' };
  const [owned, wishlisted, followed] = await Promise.all([
    countOwnership(db, me.fanId, 'collection'),
    countOwnership(db, me.fanId, 'wishlist'),
    countFollowing(db),
  ]);
  return {
    state: 'known',
    username: me.username,
    owned,
    wishlisted,
    followed,
    syncedAt: me.syncedAt,
    activity,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
