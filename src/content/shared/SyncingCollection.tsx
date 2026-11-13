import type { ReactNode } from 'react';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import type { SyncActivity } from '../../shared/sync';
import { WorkingState } from '../../ui';

/** `SyncingView` for a tab that has no sync status yet, reading it itself. */
export function SyncingCollection({ then }: { then: ReactNode }) {
  const { view } = useSyncStatus();
  const activity =
    view.state === 'ready' && view.status.state === 'known' ? view.status.activity : null;
  return <SyncingView activity={activity} then={then} />;
}

/**
 * Your own collection syncing, before anything can be compared. Bandcamp doesn't give a total up
 * front, so it counts what's been read rather than showing a bar that could jump.
 */
export function SyncingView({
  activity,
  then,
}: {
  activity: SyncActivity | null;
  then: ReactNode;
}) {
  return (
    <WorkingState title="Syncing your collection" line={`${syncLine(activity)} ${then}`.trim()} />
  );
}

function syncLine(activity: SyncActivity | null): string {
  if (activity?.state !== 'syncing') return '';
  switch (activity.step) {
    case 'wishlist':
      return 'Reading your wishlist.';
    case 'following':
      return `Reading who you follow: ${activity.followingFetched} so far.`;
    case 'collection':
      return `${activity.itemsFetched} items read so far.`;
    case 'seeding':
      return `${activity.itemsFetched} items read. Lining up your releases to scan.`;
  }
}
