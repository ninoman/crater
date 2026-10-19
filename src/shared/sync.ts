// Shapes of "my collection" sync state, shared by the worker and the UI.

/** full: page everything and drop removed items. incremental: stop at already-known items. */
export type SyncMode = 'full' | 'incremental';

export type SyncActivity =
  | { state: 'idle' }
  | { state: 'syncing'; mode: SyncMode; itemsFetched: number }
  | { state: 'error'; message: string };

export type SyncStatus =
  | { state: 'logged-out' }
  | {
      state: 'known';
      username: string;
      owned: number;
      wishlisted: number;
      /** ms since epoch of the last completed sync, or null if none has finished. */
      syncedAt: number | null;
      activity: SyncActivity;
    };
