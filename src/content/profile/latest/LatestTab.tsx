import { useCrateMatesLatest } from '../../../hooks/useCrateMatesLatest';
import type { CrateMatesLatestResult } from '../../../shared/crateMatesLatest';
import { Button, EmptyState, LinkButton } from '../../../ui';
import { formatChecking } from './latestText';
import { LatestList } from './LatestList';

/** Crate mates' latest on your profile: what your top crate mates just bought, or why there's nothing yet. */
export function LatestTab() {
  const { view, reload, hide } = useCrateMatesLatest();

  switch (view.state) {
    case 'loading':
      return <EmptyState title="Looking at what your crate mates bought lately…" />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Couldn't load Crate mates' latest"
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

function NoPurchases({ result }: { result: CrateMatesLatestResult }) {
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
        description="Crate mates' latest follows your crate mates, and they're worked out once your collection's first sync finishes. The Dighead popup shows how far it has got."
      />
    );
  }
  if (result.crateMatesUsed === 0) {
    return (
      <EmptyState
        title="No crate mates yet"
        description="Crate mates' latest shows what your closest crate mates just bought. Dighead finds them as its scanner reads the collections of your releases' supporters, so give it time."
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
