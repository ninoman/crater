import { describe, expect, it } from 'vitest';
import type { SyncActivity, SyncStatus, SyncStep } from '../../shared/sync';
import { emptyReason, showsBandcampList, syncingStep } from './syncEmpty';

function known(activity: SyncActivity, syncedAt: number | null = 1): SyncStatus {
  return {
    state: 'known',
    username: 'me',
    owned: 0,
    wishlisted: 0,
    followed: 0,
    syncedAt,
    activity,
  };
}

describe('emptyReason', () => {
  it('says why a list is empty, from the sync status', () => {
    expect(emptyReason({ state: 'logged-out' })).toEqual({ kind: 'no-viewer' });
    expect(
      emptyReason(
        known({
          state: 'syncing',
          mode: 'full',
          step: 'following',
          itemsFetched: 10,
          followingFetched: 42,
        }),
      ),
    ).toEqual({ kind: 'syncing', itemsFetched: 10, followingFetched: 42 });
    expect(emptyReason(known({ state: 'error', message: 'Parser broke.' }))).toEqual({
      kind: 'sync-failed',
      message: 'Parser broke.',
    });
    expect(emptyReason(known({ state: 'idle' }, null))).toEqual({ kind: 'unsynced' });
    expect(emptyReason(known({ state: 'idle' }))).toEqual({ kind: 'none' });
  });

  it('hides Bandcamp’s list only once a finished sync found nothing', () => {
    expect(showsBandcampList({ kind: 'none' })).toBe(false);
    expect(showsBandcampList({ kind: 'syncing', itemsFetched: 0, followingFetched: 0 })).toBe(true);
    expect(showsBandcampList({ kind: 'unsynced' })).toBe(true);
    expect(showsBandcampList({ kind: 'no-viewer' })).toBe(true);
  });
});

describe('syncingStep', () => {
  const on = (step: SyncStep) =>
    known({ state: 'syncing', mode: 'full', step, itemsFetched: 0, followingFetched: 0 });

  it('is true only for the list the sync is fetching', () => {
    expect(syncingStep(on('wishlist'), 'wishlist')).toBe(true);
    expect(syncingStep(on('collection'), 'wishlist')).toBe(false);
    expect(syncingStep(on('following'), 'following')).toBe(true);
  });

  it('is false when no sync is running', () => {
    expect(syncingStep(known({ state: 'idle' }), 'wishlist')).toBe(false);
    expect(syncingStep({ state: 'logged-out' }, 'following')).toBe(false);
  });
});
