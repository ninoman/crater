// Why a list synced from your account (followings, wishlist) is empty, from the sync status,
// so the tab can say what to do next.

import type { SyncStatus, SyncStep } from '../../shared/sync';

export type EmptyReason =
  /** The worker hasn't seen you logged in. */
  | { kind: 'no-viewer' }
  /** Your sync is running. */
  | { kind: 'syncing'; itemsFetched: number; followingFetched: number }
  | { kind: 'sync-failed'; message: string }
  /** No sync has finished yet, and none is running. */
  | { kind: 'unsynced' }
  /** Synced, and the list really is empty. */
  | { kind: 'none' };

export function emptyReason(status: SyncStatus): EmptyReason {
  if (status.state === 'logged-out') return { kind: 'no-viewer' };
  const { activity, syncedAt } = status;
  if (activity.state === 'syncing') {
    const { itemsFetched, followingFetched } = activity;
    return { kind: 'syncing', itemsFetched, followingFetched };
  }
  if (activity.state === 'error') return { kind: 'sync-failed', message: activity.message };
  return syncedAt === null ? { kind: 'unsynced' } : { kind: 'none' };
}

/**
 * Bandcamp's own list stays visible until we know ours is complete: while syncing, after a
 * failed sync, or logged out, its list is better than an empty one.
 */
export function showsBandcampList(reason: EmptyReason): boolean {
  return reason.kind !== 'none';
}

/** Whether a running sync is still fetching this list, so more of it is on its way. */
export function syncingStep(status: SyncStatus, step: SyncStep): boolean {
  return status.state === 'known' && status.activity.state === 'syncing'
    ? status.activity.step === step
    : false;
}
