import { useEffect, useRef } from 'react';
import type { SyncStatus } from '../shared/sync';
import { notifyFollowingChanged } from './followingChanges';
import { type SyncStatusView, useSyncStatus } from './useSyncStatus';

/**
 * Your sync status while a synced list's tab is open. Whenever `countOf` the status changes,
 * the list reloads, so a running sync fills the tab page by page instead of once at the end
 * (decisions §14). The first count seen reloads too: the list may have loaded before it.
 */
export function useSyncReload(
  open: boolean,
  countOf: (status: Extract<SyncStatus, { state: 'known' }>) => number,
): SyncStatusView {
  const { view } = useSyncStatus(open);
  const count =
    view.state === 'ready' && view.status.state === 'known' ? countOf(view.status) : null;
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (count === null || count === seen.current) return;
    seen.current = count;
    notifyFollowingChanged();
  }, [count]);

  return view;
}
