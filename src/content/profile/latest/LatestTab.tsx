import { useTwinsLatest } from '../../../hooks/useTwinsLatest';
import type { TwinsLatestResult } from '../../../shared/twinsLatest';
import { Button, EmptyState, LinkButton } from '../../../ui';
import { formatChecking } from './latestText';
import { LatestList } from './LatestList';

/** Twins' latest on your profile: what your top twins just bought, or why there's nothing yet. */
export function LatestTab() {
  const { view, reload, hide } = useTwinsLatest();

  switch (view.state) {
    case 'loading':
      return <EmptyState title="Looking at what your twins bought lately…" />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Couldn't load Twins' latest"
          description="Dighead's background worker didn't answer. Try again, or reload the extension from chrome://extensions."
          action={<Button onClick={reload}>Try again</Button>}
        />
      );
    case 'ready':
      return view.result.rows.length > 0 ? (
        <LatestList result={view.result} now={Date.now()} onHide={hide} />
      ) : (
        <NoPurchases result={view.result} />
      );
  }
}

function NoPurchases({ result }: { result: TwinsLatestResult }) {
  if (result.basis === 'no-viewer') {
    return (
      <EmptyState
        title="Dighead hasn't seen you log in yet"
        description="Reload this page so Dighead can pick up your account and sync your collection."
      />
    );
  }
  if (result.basis === 'unsynced') {
    return (
      <EmptyState
        title="Your collection is still syncing"
        description="Twins' latest follows your taste twins, and they're worked out once your collection's first sync finishes. The Dighead popup shows how far it has got."
      />
    );
  }
  if (result.twinsUsed === 0) {
    return (
      <EmptyState
        title="No taste twins yet"
        description="Twins' latest shows what your closest twins just bought. Dighead finds them as its scanner reads the collections of your releases' supporters, so give it time."
        action={<LinkButton href="#twins">See the Twins tab</LinkButton>}
      />
    );
  }
  return (
    <EmptyState
      title="Nothing new from your twins lately"
      description={
        result.checking > 0
          ? `${formatChecking(result.checking)}. Come back in a little while.`
          : `Your ${result.twinsUsed} top twins bought nothing you don't already have in the last ${result.windowDays} days.`
      }
      action={<LinkButton href="#twins">See the Twins tab</LinkButton>}
    />
  );
}
