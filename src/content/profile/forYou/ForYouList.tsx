import type { RowActions } from '../../../hooks/rowActions';
import { useListPlayer } from '../../../hooks/useListPlayer';
import type { ForYouMode, ForYouRow } from '../../../shared/forYou';
import { ReleaseRow, RowList, Toolbar } from '../../../ui';
import { withFollowed } from '../../shared/followedText';
import { PlayThrough, rowControls } from '../../shared/RowControls';
import { formatDeepCutReason, formatPickReason } from './forYouText';

export interface ForYouListProps {
  rows: readonly ForYouRow[];
  mode: ForYouMode;
  /** When the list was loaded, for "latest 3 days ago". */
  now: number;
  actions: RowActions;
}

const LIST_LABELS: Record<ForYouMode, string> = {
  all: 'For you',
  fresh: 'For you, fresh',
  deep: 'For you, deep cuts',
};

const NOTES: Record<ForYouMode, string> = {
  all: "Releases your closest crate mates own and you don't, weighted by how alike each crate mate is and how rare the release is.",
  fresh:
    'What the fans most in step with you lately bought in the last year, weighted by how in step each crate mate is, how recently they bought it and how rare it is.',
  deep: "Releases few people own on Bandcamp but your closest crate mates do. The owner limit is in Crater's settings.",
};

function reasonFor(row: ForYouRow, mode: ForYouMode, now: number): string {
  return mode === 'deep' ? formatDeepCutReason(row) : formatPickReason(row, now);
}

/** The ranked picks, played one at a time or through in order. */
export function ForYouList({ rows, mode, now, actions }: ForYouListProps) {
  const player = useListPlayer(rows, (matchKey) => actions.setHeard(matchKey, true, false));

  return (
    <>
      <Toolbar>
        <PlayThrough player={player} />
      </Toolbar>
      <div className="dh-profile__list">
        <RowList label={LIST_LABELS[mode]}>
          {rows.map((row, i) => (
            <ReleaseRow
              key={row.matchKey}
              release={row}
              rank={i + 1}
              reason={withFollowed(reasonFor(row, mode, now), row.followed)}
              {...rowControls(row, player, actions)}
            />
          ))}
        </RowList>
      </div>
      <p className="dh-profile__note">
        {NOTES[mode]} Hidden, owned and wishlisted releases are left out.
      </p>
    </>
  );
}
