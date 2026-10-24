import { Button } from './Button';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon, StopIcon } from './icons';
import { Tooltip } from './Tooltip';

export interface PlayQueueBarProps {
  /** 1-based place of the release playing, or null while the queue is stopped. */
  position: number | null;
  total: number;
  playing: boolean;
  onPlayAll: () => void;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onStop: () => void;
}

/**
 * Plays a list through, one release after another: "Play all" while stopped, then previous,
 * play / pause, next, stop and where it's got to. The keys are the list's shortcuts.
 */
export function PlayQueueBar({
  position,
  total,
  playing,
  onPlayAll,
  onToggle,
  onPrevious,
  onNext,
  onStop,
}: PlayQueueBarProps) {
  if (position === null) {
    return (
      <div className="dh-play-queue">
        <Button variant="secondary" onClick={onPlayAll} disabled={total === 0}>
          <PlayIcon />
          Play all
        </Button>
      </div>
    );
  }
  return (
    <div className="dh-play-queue" role="toolbar" aria-label="Playing through the list">
      <Tooltip content="Previous (P)">
        <Button
          variant="ghost"
          icon
          aria-label="Previous release"
          aria-keyshortcuts="P"
          disabled={position <= 1}
          onClick={onPrevious}
        >
          <PreviousIcon />
        </Button>
      </Tooltip>
      <Tooltip content={playing ? 'Pause (K)' : 'Play (K)'}>
        <Button
          variant="ghost"
          icon
          aria-label={playing ? 'Pause' : 'Play'}
          aria-keyshortcuts="K"
          onClick={onToggle}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
      </Tooltip>
      <Tooltip content="Next (N)">
        <Button
          variant="ghost"
          icon
          aria-label="Next release"
          aria-keyshortcuts="N"
          disabled={position >= total}
          onClick={onNext}
        >
          <NextIcon />
        </Button>
      </Tooltip>
      <Tooltip content="Stop (Esc)">
        <Button
          variant="ghost"
          icon
          aria-label="Stop playing the list"
          aria-keyshortcuts="Escape"
          onClick={onStop}
        >
          <StopIcon />
        </Button>
      </Tooltip>
      <span className="dh-play-queue__position" aria-live="polite">
        {position} of {total}
      </span>
    </div>
  );
}
