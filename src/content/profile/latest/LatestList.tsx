import type { RowActions } from '../../../hooks/rowActions';
import { useListPlayer } from '../../../hooks/useListPlayer';
import type { CrateMatesLatestResult } from '../../../shared/crateMatesLatest';
import { ReleaseRow, RowList, SkeletonRows, Toolbar } from '../../../ui';
import { ListNowPlaying, PlayThrough, rowControls } from '../../shared/RowControls';
import { formatLatestReason } from './latestText';

export interface LatestListProps {
  result: CrateMatesLatestResult;
  /** For "3 days ago". */
  now: number;
  actions: RowActions;
  /** A scan is running: placeholders under the rows show where more will come, until the list is full. */
  moreComing: boolean;
}

/** Your crate mates' recent buys, newest first, played one at a time or through in order. */
export function LatestList({ result, now, actions, moreComing }: LatestListProps) {
  const player = useListPlayer(result.rows, (matchKey) => actions.setHeard(matchKey, true, false));

  return (
    <>
      <Toolbar>
        <PlayThrough player={player} />
      </Toolbar>
      <div className="dh-profile__list">
        <RowList label="Crate mates' latest">
          {player.rows.map((row) => (
            <ReleaseRow
              key={row.matchKey}
              release={row}
              reason={formatLatestReason(row, now)}
              {...rowControls(row, player, actions, 'docked')}
            />
          ))}
        </RowList>
        {moreComing && result.rows.length < result.limit && <SkeletonRows count={3} />}
      </div>
      <ListNowPlaying player={player} actions={actions} />
      <p className="dh-profile__note">
        What your top crate mates on the Lately board, then the all-time one, bought recently and
        you don&apos;t own. Crater re-reads your closest lately crate mates every week, everyone
        else monthly. Hidden, owned and wishlisted releases are left out.
      </p>
    </>
  );
}
