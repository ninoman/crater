import type { ReactNode } from 'react';
import { cx } from './cx';
import { Progress } from './Progress';
import { SkeletonPeopleTable, SkeletonRows } from './Skeleton';

/** The shape of the content on its way, so the placeholders look like it. */
export type WorkingRows =
  | { kind: 'releases'; ranked?: boolean }
  | { kind: 'people'; covers: number; numbers: number };

const RELEASES: WorkingRows = { kind: 'releases' };

export interface WorkingStateProps {
  title: ReactNode;
  /** One short line of detail, e.g. how far a scan has got. */
  line?: ReactNode;
  /** A bar with its label shown under it, e.g. "120 of 903 releases scanned". */
  progress?: { value: number; max: number; label: string };
  /** The wait isn't moving, e.g. the scanner is paused: the record and rows hold still. */
  paused?: boolean;
  rows?: WorkingRows;
}

/** A view whose content is on its way: a turning record, a short status and placeholder rows. */
export function WorkingState({
  title,
  line,
  progress,
  paused = false,
  rows = RELEASES,
}: WorkingStateProps) {
  return (
    <div
      className={cx('dh-working', paused && 'dh-working--paused')}
      role="status"
      aria-busy={!paused}
    >
      <div className="dh-working__head">
        <Record />
        <p className="dh-working__title">{title}</p>
        {line && <p className="dh-working__line">{line}</p>}
        {progress && (
          <div className="dh-working__progress">
            <Progress value={progress.value} max={progress.max} label={progress.label} />
            <p className="dh-working__caption">{progress.label}</p>
          </div>
        )}
      </div>
      {rows.kind === 'people' ? (
        <SkeletonPeopleTable
          count={3}
          paused={paused}
          covers={rows.covers}
          numbers={rows.numbers}
        />
      ) : (
        <SkeletonRows count={3} paused={paused} ranked={rows.ranked} />
      )}
    </div>
  );
}

/** A record with a light catching its grooves, so the turn is visible. */
function Record() {
  return (
    <svg className="dh-working__record" viewBox="0 0 48 48" aria-hidden="true">
      <circle className="dh-working__disc" cx="24" cy="24" r="23" />
      <circle className="dh-working__groove" cx="24" cy="24" r="18" />
      <circle className="dh-working__groove" cx="24" cy="24" r="14" />
      <path className="dh-working__shine" d="M24 4 A20 20 0 0 1 41.3 14" />
      <circle className="dh-working__label" cx="24" cy="24" r="8" />
      <circle className="dh-working__hole" cx="24" cy="24" r="1.5" />
    </svg>
  );
}
