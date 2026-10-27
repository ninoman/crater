import { useEffect } from 'react';
import type { SyncStatusView } from '../../hooks/useSyncStatus';
import { EmptyState } from '../../ui';
import { emptyReason, showsBandcampList } from '../shared/syncEmpty';
import type { ListConfig } from './lists';

const BELOW = "Bandcamp's own list is below.";

/** Why a list is empty, from the sync status the view polls while the tab is open. */
export function EmptyItemList({
  list,
  view,
  showBandcampList,
}: {
  list: ListConfig;
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
  if (!reason) return <EmptyState title={`Loading your ${list.noun}…`} />;

  switch (reason.kind) {
    case 'no-viewer':
      return (
        <EmptyState
          title="Crater hasn't seen you log in yet"
          description={`Reload this page so Crater can pick up your account and sync your ${list.noun}. ${BELOW}`}
        />
      );
    case 'syncing':
      return (
        <EmptyState
          title="Syncing your collection and wishlist…"
          description={`${reason.itemsFetched} items so far. Your ${list.noun} shows up here, ready to sort and tag, as it arrives. ${BELOW}`}
        />
      );
    case 'sync-failed':
      return (
        <EmptyState
          tone="error"
          title={`Couldn't sync your ${list.noun}`}
          description={`${reason.message} Crater tries again on your next sync. ${BELOW}`}
        />
      );
    case 'unsynced':
      return (
        <EmptyState
          title={`Your ${list.noun} hasn't synced yet`}
          description={
            list.source === 'wishlist'
              ? `It syncs with your collection, which starts when Crater sees you on a Bandcamp page. ${BELOW}`
              : `It syncs when Crater sees you on a Bandcamp page. ${BELOW}`
          }
        />
      );
    case 'none':
      return (
        <EmptyState
          title={`Your ${list.noun} is empty`}
          description={
            list.source === 'wishlist'
              ? 'Wishlist releases on Bandcamp and they show up here, ready to tag. Crater picks them up on your next sync.'
              : 'Buy something on Bandcamp and it shows up here, ready to tag. Crater picks it up on your next sync.'
          }
        />
      );
  }
}
