import { useEffect } from 'react';
import type { SyncStatusView } from '../../hooks/useSyncStatus';
import type { FollowKind } from '../../shared/following';
import { EmptyState } from '../../ui';
import { emptyReason, showsBandcampList } from '../shared/syncEmpty';
import { kindLabel } from './followingEmpty';

const BELOW = "Bandcamp's own list is below.";

/** Why there are no followings of this kind, from the sync status the list polls while open. */
export function EmptyFollowing({
  kind,
  view,
  showBandcampList,
}: {
  kind: FollowKind;
  view: SyncStatusView;
  showBandcampList: (shown: boolean) => void;
}) {
  const reason = view.state === 'ready' ? emptyReason(view.status) : null;
  const shown = reason ? showsBandcampList(reason) : null;

  useEffect(() => {
    if (shown !== null) showBandcampList(shown);
  }, [shown, showBandcampList]);

  if (view.state === 'unreachable') {
    return (
      <EmptyState
        tone="error"
        title="Couldn't check your sync"
        description={`Crater's background worker didn't answer. Reload the extension from chrome://extensions. ${BELOW}`}
      />
    );
  }
  if (!reason) return <EmptyState title="Loading your follows…" />;

  switch (reason.kind) {
    case 'no-viewer':
      return (
        <EmptyState
          title="Crater hasn't seen you log in yet"
          description={`Reload this page so Crater can pick up your account and sync your follows. ${BELOW}`}
        />
      );
    case 'syncing':
      return (
        <EmptyState
          title="Syncing your follows…"
          description={`${reason.followingFetched} so far. They show up here, ready to tag, as they arrive. ${BELOW}`}
        />
      );
    case 'sync-failed':
      return (
        <EmptyState
          tone="error"
          title="Couldn't sync your follows"
          description={`${reason.message} Crater tries again on your next sync. ${BELOW}`}
        />
      );
    case 'unsynced':
      return (
        <EmptyState
          title="Your follows haven't synced yet"
          description={`They sync with your collection, which starts when Crater sees you on a Bandcamp page. ${BELOW}`}
        />
      );
    case 'none':
      return (
        <EmptyState
          title={`You don't follow any ${kindLabel(kind)} yet`}
          description="Follow them on Bandcamp and they show up here, ready to tag. Crater picks them up on your next sync."
        />
      );
  }
}
