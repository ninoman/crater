import { useEffect, useRef } from 'react';
import { notifyFollowingChanged } from '../../hooks/followingChanges';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import type { FollowKind } from '../../shared/following';
import { EmptyState } from '../../ui';
import { emptyReason, kindLabel, showsBandcampList } from './followingEmpty';

const BELOW = "Bandcamp's own list is below.";

/**
 * Why there are no followings of this kind. Mounted only while the list is empty, so the sync
 * status is polled only then. Refetches the list once a running sync finishes.
 */
export function EmptyFollowing({
  kind,
  showBandcampList,
}: {
  kind: FollowKind;
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
  if (!reason) return <EmptyState title="Loading your follows…" />;

  switch (reason.kind) {
    case 'no-viewer':
      return (
        <EmptyState
          title="Dighead hasn't seen you log in yet"
          description={`Reload this page so Dighead can pick up your account and sync your follows. ${BELOW}`}
        />
      );
    case 'syncing':
      return (
        <EmptyState
          title="Syncing your follows…"
          description={`${reason.fetched} so far. They show here with your tags once the sync finishes. ${BELOW}`}
        />
      );
    case 'sync-failed':
      return (
        <EmptyState
          tone="error"
          title="Couldn't sync your follows"
          description={`${reason.message} Dighead tries again on your next sync. ${BELOW}`}
        />
      );
    case 'unsynced':
      return (
        <EmptyState
          title="Your follows haven't synced yet"
          description={`They sync with your collection, which starts when Dighead sees you on a Bandcamp page. ${BELOW}`}
        />
      );
    case 'none':
      return (
        <EmptyState
          title={`You don't follow any ${kindLabel(kind)} yet`}
          description="Follow them on Bandcamp and they show up here, ready to tag. Dighead picks them up on your next sync."
        />
      );
  }
}
