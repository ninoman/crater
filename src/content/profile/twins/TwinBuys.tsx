import type { ItemKey } from '../../../bandcamp';
import { timeAgo } from '../../../shared/timeAgo';
import type { TwinBuy } from '../../../shared/twins';
import { PlayableCover } from '../../../ui';

export interface TwinBuysProps {
  buys: readonly TwinBuy[];
  /** The release previewing in this row, if any. */
  playing: ItemKey | null;
  onToggle: (buy: TwinBuy) => void;
  now: number;
}

/** A twin's newest purchases as covers you can preview. */
export function TwinBuys({ buys, playing, onToggle, now }: TwinBuysProps) {
  if (buys.length === 0) return null;
  return (
    <ul className="dh-twin-buys">
      {buys.map((buy) => {
        const name = `${buy.artist} – ${buy.title}`;
        return (
          <li key={buy.matchKey}>
            <PlayableCover
              src={buy.coverUrl}
              playing={playing === buy.matchKey}
              label={name}
              hint={`${name} · bought ${timeAgo(buy.boughtAt, now)}`}
              onToggle={() => onToggle(buy)}
            />
          </li>
        );
      })}
    </ul>
  );
}
