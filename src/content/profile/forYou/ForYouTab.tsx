import { useState } from 'react';
import type { RowActions } from '../../../hooks/rowActions';
import { useForYou, type ForYouView } from '../../../hooks/useForYou';
import { useStoredFlag } from '../../../hooks/useStoredFlag';
import type { ForYouMode, ForYouResult } from '../../../shared/forYou';
import {
  Button,
  EmptyState,
  LinkButton,
  Segmented,
  type WorkingRows,
  WorkingState,
} from '../../../ui';
import { AllHeard } from '../../shared/AllHeard';
import { FindingCrateMates } from '../../shared/FindingCrateMates';
import { ScanningProgress } from '../../shared/ScanningProgress';
import { HideHeardToggle } from '../../shared/RowControls';
import { ForYouList } from './ForYouList';
import { formatForYouSummary } from './forYouText';

const MODES = [
  { value: 'all', label: 'All time' },
  { value: 'fresh', label: 'Fresh' },
  { value: 'deep', label: 'Deep cuts' },
] as const;

/** Picks are ranked ReleaseRows. */
const PICK_ROWS: WorkingRows = { kind: 'releases', ranked: true };

const LOADING_TITLES: Record<ForYouMode, string> = {
  all: 'Finding releases for you',
  fresh: 'Finding fresh releases for you',
  deep: 'Digging for deep cuts',
};

/**
 * The For you tab on your profile: picks from your top crate mates, or from what your lately crate mates
 * bought recently, or why there aren't any yet. The switch stays put in every state, so an
 * empty Fresh list can be switched back from.
 */
export function ForYouTab() {
  const [mode, setMode] = useState<ForYouMode>('all');
  const [hideHeard, setHideHeard] = useStoredFlag('hideHeard.forYou', false);
  const { view, reload, refresh, ...actions } = useForYou(mode, hideHeard);
  const picks = view.state === 'ready' ? view.result.rows.length : 0;

  return (
    <>
      <div className="dh-profile__toolbar">
        <p className="dh-profile__summary">
          {picks > 0 &&
            view.state === 'ready' &&
            formatForYouSummary(picks, view.result.crateMatesUsed, mode)}
        </p>
        {picks > 0 && <ScanningProgress onFansRead={refresh} />}
        <div className="dh-profile__controls">
          <HideHeardToggle checked={hideHeard} onChange={setHideHeard} />
          <Segmented label="Which picks" options={MODES} value={mode} onChange={setMode} />
        </div>
      </div>
      <ForYouBody
        view={view}
        mode={mode}
        reload={reload}
        refresh={refresh}
        actions={actions}
        onShowHeard={hideHeard ? () => setHideHeard(false) : null}
      />
    </>
  );
}

interface ForYouBodyProps {
  view: ForYouView;
  mode: ForYouMode;
  reload: () => void;
  /** Fetches again quietly, as a scan finds crate mates. */
  refresh: () => void;
  actions: RowActions;
  /** Set while "Hide heard" is on, for an empty list to offer turning it off. */
  onShowHeard: (() => void) | null;
}

function ForYouBody({ view, mode, reload, refresh, actions, onShowHeard }: ForYouBodyProps) {
  switch (view.state) {
    case 'loading':
      return <WorkingState title={LOADING_TITLES[mode]} rows={PICK_ROWS} />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Couldn't load For you"
          description="Crater's background worker didn't answer. Try again, or reload the extension from chrome://extensions."
          action={<Button onClick={reload}>Try again</Button>}
        />
      );
    case 'ready':
      if (view.result.rows.length > 0) {
        return (
          <ForYouList rows={view.result.rows} mode={mode} now={view.loadedAt} actions={actions} />
        );
      }
      if (onShowHeard && view.result.basis === 'ready' && view.result.crateMatesUsed > 0) {
        return <AllHeard onShowHeard={onShowHeard} />;
      }
      return <NoPicks result={view.result} mode={mode} onFansRead={refresh} />;
  }
}

interface NoPicksProps {
  result: ForYouResult;
  mode: ForYouMode;
  onFansRead: () => void;
}

function NoPicks({ result, mode, onFansRead }: NoPicksProps) {
  if (result.basis === 'no-viewer') {
    return (
      <EmptyState
        title="Crater hasn't seen you log in yet"
        description="Reload this page so Crater can pick up your account and sync your collection."
      />
    );
  }
  if (result.basis === 'unsynced') {
    return (
      <WorkingState
        title="Syncing your collection"
        line="Picks come once your crate mates are found."
        rows={PICK_ROWS}
      />
    );
  }
  // Fresh can lack lately crate mates long after crate mates are found, so it doesn't wait on the scan.
  if (mode === 'fresh') return <NoFreshPicks crateMatesUsed={result.crateMatesUsed} />;
  if (result.crateMatesUsed === 0) {
    return <FindingCrateMates onFansRead={onFansRead} idle={<NoCrateMates />} rows={PICK_ROWS} />;
  }
  if (mode === 'deep') return <NoDeepCuts />;
  return (
    <EmptyState
      title="Nothing new from your crate mates yet"
      description={`Your ${result.crateMatesUsed} closest crate mates own nothing you haven't already got, wishlisted or hidden. More turns up as Crater scans more fans.`}
      action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
    />
  );
}

/** No crate mates, and the scanner has nothing left to find them with. */
function NoCrateMates() {
  return (
    <EmptyState
      title="No crate mates yet"
      description="Picks come from fans who own what you own. Open releases you love to scan their supporters."
      action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
    />
  );
}

function NoFreshPicks({ crateMatesUsed }: { crateMatesUsed: number }) {
  if (crateMatesUsed === 0) {
    return (
      <EmptyState
        title="No lately crate mates yet"
        description="None of the fans read so far bought what you bought around the same time. All time may still have picks."
        action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
      />
    );
  }
  return (
    <EmptyState
      title="Nothing fresh from your lately crate mates"
      description={`Your ${crateMatesUsed} lately ${crateMatesUsed === 1 ? 'crate mate has' : 'crate mates have'} bought nothing in the last year that you haven't already got, wishlisted or hidden. Try All time, or check back after Crater scans more fans.`}
      action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
    />
  );
}

function NoDeepCuts() {
  return (
    <EmptyState
      title="No deep cuts yet"
      description="Your crate mates' rare records show up as more of them are scanned. You can raise the owner limit in Crater's settings."
      action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
    />
  );
}
