import type { SyncStatus } from '../shared/sync';
import { timeAgo } from '../shared/timeAgo';
import { Button, EmptyState, Stat, StatusDot } from '../ui';

type KnownStatus = Extract<SyncStatus, { state: 'known' }>;

function ActivityLine({ status, now }: { status: KnownStatus; now: number }) {
  const { activity, syncedAt } = status;
  switch (activity.state) {
    case 'syncing':
      return <StatusDot tone="neutral">Syncing… {activity.itemsFetched} items fetched</StatusDot>;
    case 'error':
      return <StatusDot tone="error">Sync failed: {activity.message}</StatusDot>;
    case 'idle':
      return syncedAt === null ? (
        <StatusDot tone="warning">Not synced yet</StatusDot>
      ) : (
        <StatusDot tone="ok">Last synced {timeAgo(syncedAt, now)}</StatusDot>
      );
  }
}

export interface SyncSummaryProps {
  status: KnownStatus;
  now: number;
  onResync: () => void;
}

/** Your synced collection: counts, when it was last synced, and a re-sync button. */
export function SyncSummary({ status, now, onResync }: SyncSummaryProps) {
  const { activity } = status;

  if (status.syncedAt === null && activity.state === 'syncing') {
    return (
      <EmptyState
        title={`Syncing ${status.username}'s collection…`}
        description={`${activity.itemsFetched} items so far. It runs in the background, so you can close this popup.`}
      />
    );
  }

  const syncing = activity.state === 'syncing';

  return (
    <div className="dh-sync">
      <div className="dh-sync__stats">
        <Stat value={status.owned} label="items synced" />
        <Stat value={status.wishlisted} label="wishlisted" />
      </div>
      <div className="dh-sync__footer">
        <span className="dh-sync__activity">
          <ActivityLine status={status} now={now} />
        </span>
        <Button onClick={onResync} disabled={syncing}>
          {activity.state === 'error' ? 'Retry' : 'Re-sync'}
        </Button>
      </div>
    </div>
  );
}
