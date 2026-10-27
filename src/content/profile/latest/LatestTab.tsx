import { useCrateMatesLatest, type CrateMatesLatestView } from '../../../hooks/useCrateMatesLatest';
import type { RowActions } from '../../../hooks/rowActions';
import { useStoredFlag } from '../../../hooks/useStoredFlag';
import type { CrateMatesLatestResult } from '../../../shared/crateMatesLatest';
import { Button, EmptyState, LinkButton, StatusDot } from '../../../ui';
import { AllHeard } from '../../shared/AllHeard';
import { HideHeardToggle } from '../../shared/RowControls';
import { formatChecking, formatLatestSummary } from './latestText';
import { LatestList } from './LatestList';

/** Crate mates' latest on your profile: what your top crate mates just bought, or why there's nothing yet. */
export function LatestTab() {
  const [hideHeard, setHideHeard] = useStoredFlag('hideHeard.latest', false);
  const { view, reload, ...actions } = useCrateMatesLatest(hideHeard);

  return (
    <>
      <div className="dh-profile__toolbar">
        <p className="dh-profile__summary">
          {view.state === 'ready' &&
            view.result.rows.length > 0 &&
            formatLatestSummary(
              view.result.rows.length,
              view.result.crateMatesUsed,
              view.result.windowDays,
            )}
        </p>
        <div className="dh-profile__controls">
          {view.state === 'ready' && view.result.checking > 0 && (
            <StatusDot tone="neutral">{formatChecking(view.result.checking)}</StatusDot>
          )}
          <HideHeardToggle checked={hideHeard} onChange={setHideHeard} />
        </div>
      </div>
      <LatestBody
        view={view}
        reload={reload}
        actions={actions}
        onShowHeard={hideHeard ? () => setHideHeard(false) : null}
      />
    </>
  );
}

interface LatestBodyProps {
  view: CrateMatesLatestView;
  reload: () => void;
  actions: RowActions;
  /** Set while "Hide heard" is on, for an empty list to offer turning it off. */
  onShowHeard: (() => void) | null;
}

function LatestBody({ view, reload, actions, onShowHeard }: LatestBodyProps) {
  switch (view.state) {
    case 'loading':
      return <EmptyState title="Looking at what your crate mates bought lately…" />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Couldn't load Crate mates' latest"
          description="Crater's background worker didn't answer. Try again, or reload the extension from chrome://extensions."
          action={<Button onClick={reload}>Try again</Button>}
        />
      );
    case 'ready':
      if (view.result.rows.length > 0) {
        return <LatestList result={view.result} now={Date.now()} actions={actions} />;
      }
      if (onShowHeard && view.result.basis === 'ready' && view.result.crateMatesUsed > 0) {
        return <AllHeard onShowHeard={onShowHeard} />;
      }
      return <NoPurchases result={view.result} />;
  }
}

function NoPurchases({ result }: { result: CrateMatesLatestResult }) {
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
      <EmptyState
        title="Your collection is still syncing"
        description="Crate mates' latest follows your crate mates, and they're worked out once your collection's first sync finishes. The Crater popup shows how far it has got."
      />
    );
  }
  if (result.crateMatesUsed === 0) {
    return (
      <EmptyState
        title="No crate mates yet"
        description="Crate mates' latest shows what your closest crate mates just bought. Crater finds them as its scanner reads the collections of your releases' supporters, so give it time."
        action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
      />
    );
  }
  return (
    <EmptyState
      title="Nothing new from your crate mates lately"
      description={
        result.checking > 0
          ? `${formatChecking(result.checking)}. Come back in a little while.`
          : `Your ${result.crateMatesUsed} top crate mates bought nothing you don't already have in the last ${result.windowDays} days.`
      }
      action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
    />
  );
}
