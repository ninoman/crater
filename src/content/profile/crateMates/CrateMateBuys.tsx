import type { ItemKey } from '../../../bandcamp';
import { timeAgo } from '../../../shared/timeAgo';
import type { CrateMateBuy } from '../../../shared/crateMates';
import { PlayableCover } from '../../../ui';

export interface CrateMateBuysProps {
  buys: readonly CrateMateBuy[];
  /** The release previewing in this row, if any. */
  playing: ItemKey | null;
  onToggle: (buy: CrateMateBuy) => void;
  now: number;
}

/** A crate mate's newest purchases as covers you can preview. */
export function CrateMateBuys({ buys, playing, onToggle, now }: CrateMateBuysProps) {
  if (buys.length === 0) return null;
  return (
    <ul className="dh-crate-mate-buys">
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
