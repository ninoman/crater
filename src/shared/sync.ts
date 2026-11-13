// Shapes of "my collection" sync state, shared by the worker and the UI.

/** full: page everything and drop removed items. incremental: stop at already-known items. */
export type SyncMode = 'full' | 'incremental';

/** What a running sync is doing, in order: three fetches (syncMe), then queuing your releases to scan. */
export type SyncStep = 'wishlist' | 'following' | 'collection' | 'seeding';

export interface SyncingActivity {
  state: 'syncing';
  mode: SyncMode;
  step: SyncStep;
  itemsFetched: number;
  followingFetched: number;
}

export type SyncActivity =
  | { state: 'idle' }
  | SyncingActivity
  | { state: 'error'; message: string };

export type SyncStatus =
  | { state: 'logged-out' }
  | {
      state: 'known';
      username: string;
      owned: number;
      wishlisted: number;
      followed: number;
      /** ms since epoch of the last completed sync, or null if none has finished. */
      syncedAt: number | null;
      activity: SyncActivity;
    };
