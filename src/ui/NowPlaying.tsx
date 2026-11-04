import type { ReactNode } from 'react';
import { Button } from './Button';
import { StopIcon } from './icons';
import { Tooltip } from './Tooltip';

export interface NowPlayingProps {
  /** "Artist – Title". */
  name: string;
  /** The release page. */
  href: string;
  /** A muted line after the name, e.g. "bought by Sam". */
  detail?: ReactNode;
  onStop: () => void;
  /** The player itself. */
  children: ReactNode;
}

/** The open preview: what's playing, a stop button, and the player under them. Lives in a `Dock`. */
export function NowPlaying({ name, href, detail, onStop, children }: NowPlayingProps) {
  return (
    <section className="dh-now-playing" aria-label="Now previewing">
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
