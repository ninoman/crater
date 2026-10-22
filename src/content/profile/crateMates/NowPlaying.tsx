import type { CrateMateBuy } from '../../../shared/crateMates';
import { Button, StopIcon, Tooltip } from '../../../ui';
import { ReleasePreview } from '../../shared/ReleasePreview';

export interface NowPlayingProps {
  buy: CrateMateBuy;
  /** The crate mate whose purchase it is. */
  crateMateName: string;
  onStop: () => void;
}

/** The preview of a crate mate's purchase, pinned under the leaderboard while it plays. */
export function NowPlaying({ buy, crateMateName, onStop }: NowPlayingProps) {
  const name = `${buy.artist} – ${buy.title}`;
  return (
    <section className="dh-now-playing" aria-label="Now previewing">
      <div className="dh-now-playing__head">
        <a className="dh-now-playing__title" href={buy.url}>
          {name}
        </a>
        <span className="dh-now-playing__by">bought by {crateMateName}</span>
        <Tooltip content="Stop preview">
          <Button variant="ghost" icon aria-label="Stop preview" onClick={onStop}>
            <StopIcon />
          </Button>
        </Tooltip>
      </div>
      {/* Keyed so a new release remounts the player, which starts it playing. */}
      <ReleasePreview key={buy.url} url={buy.url} name={name} />
    </section>
  );
}
