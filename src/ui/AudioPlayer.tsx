import type { CSSProperties } from 'react';
import { Button } from './Button';
import { cx } from './cx';
import { formatTime } from './formatTime';
import { PauseIcon, PlayIcon } from './icons';

export type AudioPlayerState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; title: string; playing: boolean; position: number; duration: number };

export interface AudioPlayerProps {
  state: AudioPlayerState;
  /** What is playing, for screen readers, e.g. "Artist – Title". */
  label: string;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
}

/** A compact player: play / pause, track title, and a seek bar with elapsed and total time. */
export function AudioPlayer({ state, label, onToggle, onSeek }: AudioPlayerProps) {
  const ready = state.kind === 'ready';
  const playing = ready && state.playing;
  const position = ready ? state.position : 0;
  const duration = ready ? state.duration : 0;
  const fill = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    // Opens with a height reveal; the inner box clips the player while it grows.
    <div className="dh-player-reveal">
      <div className="dh-player-reveal__inner">
        <div className="dh-player">
          <Button
            variant="ghost"
            icon
            aria-label={`${playing ? 'Pause' : 'Play'} ${label}`}
            disabled={!ready}
            onClick={onToggle}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </Button>
          {/* Loading and error keep the title and timeline lines, so the box doesn't jump. */}
          <div className="dh-player__body">
            {state.kind === 'ready' ? (
              <span className="dh-player__title" title={state.title}>
                {state.title}
              </span>
            ) : (
              <span
                className={cx(
                  'dh-player__title',
                  'dh-player__status',
                  state.kind === 'error' && 'dh-player__status--error',
                )}
                role={state.kind === 'error' ? 'alert' : 'status'}
              >
                {state.kind === 'error' ? state.message : 'Loading preview…'}
              </span>
            )}
            <div className="dh-player__timeline">
              <input
                type="range"
                className="dh-player__seek"
                aria-label={`Seek in ${label}`}
                aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`}
                min={0}
                max={duration || 0}
                step="any"
                value={position}
                disabled={duration <= 0}
                // The fill left of the thumb, which a range input can't draw on its own.
                style={{ '--dh-seek-fill': `${fill}%` } as CSSProperties}
                onChange={(event) => onSeek(Number(event.currentTarget.value))}
              />
              <span className="dh-player__time">
                {formatTime(position)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
