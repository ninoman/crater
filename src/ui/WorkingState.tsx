import type { ReactNode } from 'react';
import { cx } from './cx';

export interface WorkingStateProps {
  title: ReactNode;
  /** One short line of detail, e.g. how far a scan has got. */
  line?: ReactNode;
  /** The wait isn't moving, e.g. the scanner is paused: the record and rows hold still. */
  paused?: boolean;
}

/**
 * A view held up by work that takes minutes, e.g. the first scan: a turning record and a short status.
 * No placeholder rows: a quick load shows those under a toolbar line instead, so nothing jumps.
 */
export function WorkingState({ title, line, paused = false }: WorkingStateProps) {
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
      </div>
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
