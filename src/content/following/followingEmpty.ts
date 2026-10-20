// Why a list of followings is empty, from the sync status, so the tab can say what to do next.

import type { FollowKind } from '../../shared/following';
import type { SyncStatus } from '../../shared/sync';

export type EmptyReason =
  /** The worker hasn't seen you logged in. */
  | { kind: 'no-viewer' }
  /** Your sync is running; `fetched` counts followings of both kinds so far. */
  | { kind: 'syncing'; fetched: number }
  | { kind: 'sync-failed'; message: string }
  /** No sync has finished yet, and none is running. */
  | { kind: 'unsynced' }
  /** Synced, and you really follow no one of this kind. */
  | { kind: 'none' };

export function emptyReason(status: SyncStatus): EmptyReason {
  if (status.state === 'logged-out') return { kind: 'no-viewer' };
  const { activity, syncedAt } = status;
  if (activity.state === 'syncing') return { kind: 'syncing', fetched: activity.followingFetched };
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

/** The sub-tab's name for a kind, as Bandcamp words it. */
export function kindLabel(kind: FollowKind): string {
  return kind === 'band' ? 'artists or labels' : 'fans';
}
