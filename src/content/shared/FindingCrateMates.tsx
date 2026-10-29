import type { ReactNode } from 'react';
import type { ScanActivity } from '../../shared/scanActivity';
import { WorkingState } from '../../ui';

export interface FindingCrateMatesProps {
  /** What the scanner is doing; null until it answers. */
  activity: ScanActivity | null;
  /** Shown when the scanner has nothing left to do, so waiting won't help. */
  idle: ReactNode;
}

/** A list built from crate mates while there are none yet: when they'll come, and the scan. */
export function FindingCrateMates({ activity, idle }: FindingCrateMatesProps) {
  if (!activity) return <WorkingState title="Finding your crate mates" />;
  if (activity.kind === 'idle') return idle;
  const stopped = activity.kind === 'stopped';
  return (
    <WorkingState
      title={stopped ? 'Scanning is paused' : 'Finding your crate mates'}
      line={
        stopped
          ? 'Crate mates show up once it resumes. The Crater popup says why.'
          : 'The first ones usually show up within a few minutes.'
      }
      paused={stopped}
    />
  );
}
