import type { ReactNode } from 'react';
import { Cover } from './Cover';
import { cx } from './cx';
import { PlayIcon, StopIcon } from './icons';
import { Tooltip } from './Tooltip';

export interface PlayableCoverProps {
  src: string | null;
  playing: boolean;
  /** What plays, for screen readers, e.g. "Artist – Title". */
  label: string;
  onToggle: () => void;
  /** Tooltip while stopped, e.g. what it is when no title is shown next to it. */
  hint?: ReactNode;
}

/** Artwork that is also the play / stop button. The icon shows on hover, focus or while playing. */
export function PlayableCover({
  src,
  playing,
  label,
  onToggle,
  hint = 'Preview',
}: PlayableCoverProps) {
  return (
    <Tooltip content={playing ? 'Stop preview' : hint}>
      <button
        type="button"
        className={cx('dh-playable-cover', playing && 'dh-playable-cover--playing')}
        aria-label={`Preview ${label}`}
        aria-pressed={playing}
        onClick={onToggle}
      >
        <Cover src={src} />
        <span className="dh-playable-cover__icon" aria-hidden="true">
          {playing ? <StopIcon /> : <PlayIcon />}
        </span>
      </button>
    </Tooltip>
  );
}
