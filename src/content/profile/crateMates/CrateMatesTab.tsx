import { useCrateMates } from '../../../hooks/useCrateMates';
import { useScanActivity } from '../../../hooks/useScanActivity';
import type { CrateMatesResult } from '../../../shared/crateMates';
import type { ScanActivity } from '../../../shared/scanActivity';
import { Button, EmptyState, SkeletonPeopleTable, WorkingState } from '../../../ui';
import { FindingCrateMates } from '../../shared/FindingCrateMates';
import { ScanningProgress } from '../../shared/ScanningProgress';
import { BOARD_ROWS, CrateMatesBoard } from './CrateMatesBoard';

/** The Crate mates tab on your profile: the leaderboard, or why there isn't one yet. */
export function CrateMatesTab() {
  const { view, reload, refresh } = useCrateMates();
  const activity = useScanActivity(refresh);

  switch (view.state) {
    case 'loading':
      return (
        <>
          <div className="dh-profile__toolbar">
            <p className="dh-profile__summary" role="status">
              Loading your crate mates…
            </p>
          </div>
          <SkeletonPeopleTable count={3} covers={BOARD_ROWS.covers} numbers={BOARD_ROWS.numbers} />
        </>
      );
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
          progress={<ScanningProgress activity={activity} />}
          moreComing={activity?.kind === 'scanning'}
        />
      ) : (
        <NoCrateMates result={view.result} activity={activity} />
      );
  }
}

interface NoCrateMatesProps {
  result: CrateMatesResult;
  activity: ScanActivity | null;
}

function NoCrateMates({ result, activity }: NoCrateMatesProps) {
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
        <WorkingState title="Syncing your collection" line="Crate mates are found once it's in." />
      );
    case 'ready':
      return (
        <FindingCrateMates
          activity={activity}
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
