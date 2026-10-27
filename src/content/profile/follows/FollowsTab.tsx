import { useFollowsDigest } from '../../../hooks/useFollowsDigest';
import { useStoredFlag } from '../../../hooks/useStoredFlag';
import type { FollowsDigestResult } from '../../../shared/followsDigest';
import { Button, EmptyState } from '../../../ui';
import { AllHeard } from '../../shared/AllHeard';
import { CheckingProgress } from './CheckingProgress';
import { FollowsList } from './FollowsList';

/**
 * New from your follows on your profile: what the artists and labels you follow released lately,
 * or why there's nothing yet (decisions §23).
 */
export function FollowsTab() {
  const [hideHeard, setHideHeard] = useStoredFlag('hideHeard.follows', false);
  const { view, reload, mute, ...actions } = useFollowsDigest(hideHeard);

  switch (view.state) {
    case 'loading':
      return <EmptyState title="Looking for new releases from your follows…" />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Couldn't load New from your follows"
          description="Crater's background worker didn't answer. Try again, or reload the extension from chrome://extensions."
          action={<Button onClick={reload}>Try again</Button>}
        />
      );
    case 'ready': {
      const { result } = view;
      const empty =
        hideHeard && result.readAccounts > 0 ? (
          <AllHeard onShowHeard={() => setHideHeard(false)} />
        ) : (
          <NoReleases result={result} />
        );
      return result.basis === 'ready' && result.accounts.length > 0 && result.readAccounts > 0 ? (
        <FollowsList
          result={result}
          now={view.loadedAt}
          onMute={mute}
          actions={actions}
          hideHeard={hideHeard}
          onHideHeardChange={setHideHeard}
          empty={empty}
        />
      ) : (
        empty
      );
    }
  }
}

function NoReleases({ result }: { result: FollowsDigestResult }) {
  if (result.basis === 'no-viewer') {
    return (
      <EmptyState
        title="Crater hasn't seen you log in yet"
        description="Reload this page so Crater can pick up your account and the artists and labels you follow."
      />
    );
  }
  if (result.accounts.length === 0) {
    return (
      <EmptyState
        title={
          result.basis === 'unsynced'
            ? 'Your follows are still syncing'
            : "You don't follow any artists or labels yet"
        }
        description="This tab lists what the artists and labels you follow on Bandcamp released lately. Follow some from their pages, and Crater reads their releases every week."
      />
    );
  }
  if (result.readAccounts === 0) {
    return (
      <EmptyState
        title={`Reading the releases of the ${result.accounts.length} accounts you follow…`}
        description="Crater reads one account at a time, politely, so the first round takes a while. Releases show up here as they come in."
        action={<CheckingProgress result={result} />}
      />
    );
  }
  return (
    <EmptyState
      title="Nothing new from your follows"
      description={`The artists and labels you follow released nothing you don't already own or hid in the last ${result.windowDays} days.${result.checking > 0 ? ' Some are still being checked.' : ''}`}
      action={result.checking > 0 ? <CheckingProgress result={result} /> : undefined}
    />
  );
}
