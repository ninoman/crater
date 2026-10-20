import { describe, expect, it } from 'vitest';
import type { SyncActivity, SyncStatus } from '../../shared/sync';
import { emptyReason, showsBandcampList } from './followingEmpty';

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
        known({ state: 'syncing', mode: 'full', itemsFetched: 10, followingFetched: 42 }),
      ),
    ).toEqual({ kind: 'syncing', fetched: 42 });
    expect(emptyReason(known({ state: 'error', message: 'Parser broke.' }))).toEqual({
      kind: 'sync-failed',
      message: 'Parser broke.',
    });
    expect(emptyReason(known({ state: 'idle' }, null))).toEqual({ kind: 'unsynced' });
    expect(emptyReason(known({ state: 'idle' }))).toEqual({ kind: 'none' });
  });

  it('hides Bandcamp’s list only once a finished sync found nothing', () => {
    expect(showsBandcampList({ kind: 'none' })).toBe(false);
    expect(showsBandcampList({ kind: 'syncing', fetched: 0 })).toBe(true);
    expect(showsBandcampList({ kind: 'unsynced' })).toBe(true);
    expect(showsBandcampList({ kind: 'no-viewer' })).toBe(true);
  });
});
