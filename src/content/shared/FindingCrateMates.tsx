import type { ReactNode } from 'react';
import { useScanEta } from '../../hooks/useScanEta';
import { formatEta, listsUntilFans } from '../../shared/scanEta';
import type { ScanActivity } from '../../shared/scanActivity';
import { InlineProgress, WorkingState } from '../../ui';
import { SyncingView } from './SyncingCollection';

export interface FindingCrateMatesProps {
  /** What the scanner is doing; null until it answers. */
  activity: ScanActivity | null;
  /** Shown when the scanner has nothing left to do, so waiting won't help. */
  idle: ReactNode;
}

/**
 * A list built from crate mates while there are none yet. The wait is the scanner reading who
 * bought your releases, then those fans, so the two stages are counted rather than left a spinner.
 */
export function FindingCrateMates({ activity, idle }: FindingCrateMatesProps) {
  const counting = activity?.kind === 'scanning' || activity?.kind === 'stopped';
  const scanned = counting ? activity.releases.scanned : 0;
  const total = counting ? activity.releases.total : 0;
  const eta = useScanEta(scanned, listsUntilFans(scanned, total), activity?.kind !== 'scanning');
  if (!activity) return <WorkingState title="Finding your crate mates" />;
  if (activity.kind === 'syncing') {
    return <SyncingView activity={activity.sync} then="Crate mates are found once it's in." />;
  }
  if (activity.kind === 'idle') return idle;
  const stopped = activity.kind === 'stopped';
  const readingReleases = total > 0 && scanned < total;
  const counted = `${scanned} of ${total} releases`;
  return (
    <WorkingState
      title={stopped ? 'Scanning is paused' : 'Finding your crate mates'}
      line={line(stopped, listsUntilFans(scanned, total) > 0, activity.fansRead, eta)}
      progress={
        readingReleases && (
          <InlineProgress
            label={stopped ? `Paused at ${counted}` : `Read ${counted}`}
            value={scanned}
            max={total}
          />
        )
      }
      paused={stopped}
    />
  );
}

function line(stopped: boolean, beforeFans: boolean, fansRead: number, eta: number | null): string {
  if (stopped) return 'Crate mates show up once it resumes. The Crater popup says why.';
  if (beforeFans) {
    const first =
      'First, who bought each of your releases. Crate mates come from comparing those fans with you.';
    return eta === null
      ? first
      : `${first} The first crate mates should show in ${formatEta(eta)}.`;
  }
  return fansRead > 0
    ? `${fansRead} ${fansRead === 1 ? 'fan' : 'fans'} compared so far. Crate mates show up as they're found.`
    : 'Now reading those fans’ collections. The first crate mates show up soon.';
}
