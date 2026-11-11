import type { CSSProperties, ReactNode } from 'react';
import { Button } from './Button';
import { cx } from './cx';
import { formatTime } from './formatTime';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon } from './icons';

export type AudioPlayerState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      title: string;
      /** 0-based place of the track in the release, and how many tracks it has. */
      trackIndex: number;
      trackCount: number;
      playing: boolean;
      position: number;
      duration: number;
    };

export interface AudioPlayerProps {
  state: AudioPlayerState;
  /** What is playing, for screen readers, e.g. "Artist – Title". */
  label: string;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  /** Buttons beside the track title, such as a heart and a cart. */
  actions?: ReactNode;
}

/**
 * A compact player: play / pause, track title, and a seek bar with elapsed and total time.
 * Releases of more than one track also get previous / next track and where it's got to.
 */
export function AudioPlayer({
  state,
  label,
  onToggle,
  onSeek,
  onPreviousTrack,
  onNextTrack,
  actions,
}: AudioPlayerProps) {
  const ready = state.kind === 'ready';
  const multiTrack = ready && state.trackCount > 1;
  const playing = ready && state.playing;
  const position = ready ? state.position : 0;
  const duration = ready ? state.duration : 0;
  const fill = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    // Opens with a height reveal; the inner box clips the player while it grows.
    <div className="dh-player-reveal">
      <div className="dh-player-reveal__inner">
        <div className="dh-player">
          <div className="dh-player__controls">
            {multiTrack && (
              <Button
                variant="ghost"
                icon
                aria-label="Previous track"
                disabled={state.trackIndex === 0}
                onClick={onPreviousTrack}
              >
                <PreviousIcon />
              </Button>
            )}
            <Button
              variant="ghost"
              icon
              aria-label={`${playing ? 'Pause' : 'Play'} ${label}`}
              disabled={!ready}
              onClick={onToggle}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Button>
            {multiTrack && (
              <Button
                variant="ghost"
                icon
                aria-label="Next track"
                disabled={state.trackIndex >= state.trackCount - 1}
                onClick={onNextTrack}
              >
                <NextIcon />
              </Button>
            )}
          </div>
          {/* Loading and error keep the title and timeline lines, so the box doesn't jump. */}
          <div className="dh-player__body">
            {state.kind === 'ready' ? (
              <div className="dh-player__heading">
                <span className="dh-player__title" title={state.title}>
                  {state.title}
                </span>
                {actions && <span className="dh-player__actions">{actions}</span>}
                {multiTrack && (
                  <span className="dh-player__track">
                    {state.trackIndex + 1} / {state.trackCount}
                  </span>
                )}
              </div>
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
