import type { ReactNode } from 'react';
import { useScanActivity } from '../../hooks/useScanActivity';
import { formatScanLine } from '../../shared/scanActivity';
import { type WorkingRows, WorkingState } from '../../ui';

export interface FindingCrateMatesProps {
  /** Runs as more fans are read, to fetch the list again. */
  onFansRead: () => void;
  /** Shown when the scanner has nothing left to do, so waiting won't help. */
  idle: ReactNode;
  /** The shape of the list's rows, for the placeholders. */
  rows: WorkingRows;
}

/** A list built from crate mates while there are none yet: when they'll come, and the scan. */
export function FindingCrateMates({ onFansRead, idle, rows }: FindingCrateMatesProps) {
  const activity = useScanActivity(onFansRead);

  if (!activity) return <WorkingState title="Finding your crate mates" rows={rows} />;
  if (activity.kind === 'idle') return idle;
  const stopped = activity.kind === 'stopped';
  const line = formatScanLine(activity);
  return (
    <WorkingState
      title={stopped ? 'Scanning is paused' : 'Finding your crate mates'}
      line={
        stopped
          ? 'Crate mates show up once it resumes. The Crater popup says why.'
          : 'The first ones usually show up within a few minutes.'
      }
      progress={
        activity.releases.total > 0
          ? { value: activity.releases.scanned, max: activity.releases.total, label: line }
          : undefined
      }
      paused={stopped}
      rows={rows}
    />
  );
}
