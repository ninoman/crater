import { useCrateMates } from '../../../hooks/useCrateMates';
import type { CrateMatesResult } from '../../../shared/crateMates';
import { Button, EmptyState, type WorkingRows, WorkingState } from '../../../ui';
import { FindingCrateMates } from '../../shared/FindingCrateMates';
import { ScanningProgress } from '../../shared/ScanningProgress';
import { CrateMatesBoard } from './CrateMatesBoard';

/** A board row: six latest buys, then in common, match, score and trend. */
const BOARD_ROWS: WorkingRows = { kind: 'people', covers: 6, numbers: 4 };

/** The Crate mates tab on your profile: the leaderboard, or why there isn't one yet. */
export function CrateMatesTab() {
  const { view, reload, refresh } = useCrateMates();

  switch (view.state) {
    case 'loading':
      return <WorkingState title="Loading your crate mates" rows={BOARD_ROWS} />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Couldn't load your crate mates"
          description="Crater's background worker didn't answer. Try again, or reload the extension from chrome://extensions."
          action={<Button onClick={reload}>Try again</Button>}
        />
      );
    case 'ready':
      return view.result.rows.length > 0 ? (
        <CrateMatesBoard
          result={view.result}
          now={view.loadedAt}
          progress={<ScanningProgress onFansRead={refresh} />}
        />
      ) : (
        <NoCrateMates result={view.result} onFansRead={refresh} />
      );
  }
}

interface NoCrateMatesProps {
  result: CrateMatesResult;
  onFansRead: () => void;
}

function NoCrateMates({ result, onFansRead }: NoCrateMatesProps) {
  switch (result.basis) {
    case 'no-viewer':
      return (
        <EmptyState
          title="Crater hasn't seen you log in yet"
          description="Reload this page so Crater can pick up your account and sync your collection."
        />
      );
    case 'unsynced':
      return (
        <WorkingState
          title="Syncing your collection"
          line="Crate mates are found once it's in."
          rows={BOARD_ROWS}
        />
      );
    case 'ready':
      return (
        <FindingCrateMates
          onFansRead={onFansRead}
          rows={BOARD_ROWS}
          idle={
            <EmptyState
              title="No crate mates yet"
              description={`None of the ${result.fansRead} fans read so far own what you own. Open releases you love to scan their supporters.`}
            />
          }
        />
      );
  }
}
