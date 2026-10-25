import type { ReactNode } from 'react';
import { Button } from './Button';
import { cx } from './cx';
import { StopIcon } from './icons';
import { Tooltip } from './Tooltip';

export interface NowPlayingProps {
  /** "Artist – Title". */
  name: string;
  /** The release page. */
  href: string;
  /** A muted line after the name, e.g. "bought by Sam". */
  detail?: ReactNode;
  /**
   * `docked`: a fixed-width panel for a Dock. `sticky`: full width, sticking to the bottom of the
   * window while its container scrolls under it.
   */
  layout: 'docked' | 'sticky';
  onStop: () => void;
  /** The player itself. */
  children: ReactNode;
}

/** The open preview: what's playing, a stop button, and the player under them. */
export function NowPlaying({ name, href, detail, layout, onStop, children }: NowPlayingProps) {
  return (
    <section
      className={cx('dh-now-playing', `dh-now-playing--${layout}`)}
      aria-label="Now previewing"
    >
      <div className="dh-now-playing__head">
        <span className="dh-now-playing__text">
          <a className="dh-now-playing__title" href={href} title={name}>
            {name}
          </a>
          {detail && <span className="dh-now-playing__detail">{detail}</span>}
        </span>
        <Tooltip content="Stop preview">
          <Button variant="ghost" icon aria-label="Stop preview" onClick={onStop}>
            <StopIcon />
          </Button>
        </Tooltip>
      </div>
      {children}
    </section>
  );
}
