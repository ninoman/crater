import { useEffect, useRef } from 'react';
import { notifyFollowingChanged } from '../../hooks/followingChanges';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { EmptyState } from '../../ui';
import { emptyReason, showsBandcampList } from '../shared/syncEmpty';

const BELOW = "Bandcamp's own list is below.";

/**
 * Why the wishlist is empty. Mounted only while it is, and while the tab is open, so the sync
 * status is polled only then. Refetches the wishlist once a running sync finishes.
 */
export function EmptyWishlist({
  showBandcampList,
}: {
  showBandcampList: (shown: boolean) => void;
}) {
  const { view } = useSyncStatus();
  const reason = view.state === 'ready' ? emptyReason(view.status) : null;
  const shown = reason ? showsBandcampList(reason) : null;
  const syncing = reason?.kind === 'syncing';

  useEffect(() => {
    if (shown !== null) showBandcampList(shown);
  }, [shown, showBandcampList]);

  const wasSyncing = useRef(false);
  useEffect(() => {
    if (wasSyncing.current && !syncing) notifyFollowingChanged();
    wasSyncing.current = syncing;
  }, [syncing]);

  if (view.state === 'unreachable') {
    return (
      <EmptyState
        tone="error"
        title="Couldn't check your sync"
        description={`Dighead's background worker didn't answer. Reload the extension from chrome://extensions. ${BELOW}`}
      />
    );
  }
  if (!reason) return <EmptyState title="Loading your wishlist…" />;

  switch (reason.kind) {
    case 'no-viewer':
      return (
        <EmptyState
          title="Dighead hasn't seen you log in yet"
          description={`Reload this page so Dighead can pick up your account and sync your wishlist. ${BELOW}`}
        />
      );
    case 'syncing':
      return (
        <EmptyState
          title="Syncing your collection and wishlist…"
          description={`${reason.itemsFetched} items so far. Your wishlist shows here, ready to tag, once the sync finishes. ${BELOW}`}
        />
      );
    case 'sync-failed':
      return (
        <EmptyState
          tone="error"
          title="Couldn't sync your wishlist"
          description={`${reason.message} Dighead tries again on your next sync. ${BELOW}`}
        />
      );
    case 'unsynced':
      return (
        <EmptyState
          title="Your wishlist hasn't synced yet"
          description={`It syncs with your collection, which starts when Dighead sees you on a Bandcamp page. ${BELOW}`}
        />
      );
    case 'none':
      return (
        <EmptyState
          title="Your wishlist is empty"
          description="Wishlist releases on Bandcamp and they show up here, ready to tag. Dighead picks them up on your next sync."
        />
      );
  }
}
