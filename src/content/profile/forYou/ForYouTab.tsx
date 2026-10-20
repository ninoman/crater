import { useForYou } from '../../../hooks/useForYou';
import type { ForYouResult } from '../../../shared/forYou';
import { Button, EmptyState, LinkButton } from '../../../ui';
import { ForYouList } from './ForYouList';

/** The For you tab on your profile: picks from your top twins, or why there aren't any yet. */
export function ForYouTab() {
  const { view, reload, hide } = useForYou();

  switch (view.state) {
    case 'loading':
      return <EmptyState title="Finding releases for you…" />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Couldn't load For you"
          description="Dighead's background worker didn't answer. Try again, or reload the extension from chrome://extensions."
          action={<Button onClick={reload}>Try again</Button>}
        />
      );
    case 'ready':
      return view.result.rows.length > 0 ? (
        <ForYouList result={view.result} onHide={hide} />
      ) : (
        <NoPicks result={view.result} />
      );
  }
}

function NoPicks({ result }: { result: ForYouResult }) {
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
        description="For you is built from your taste twins, and they're worked out once your collection's first sync finishes. The Dighead popup shows how far it has got."
      />
    );
  }
  if (result.twinsUsed === 0) {
    return (
      <EmptyState
        title="No taste twins yet"
        description="For you is built from what your closest twins own. Dighead finds them as its scanner reads the collections of your releases' supporters, so give it time, or open the pages of releases you love to scan their supporters first."
        action={<LinkButton href="#twins">See the Twins tab</LinkButton>}
      />
    );
  }
  return (
    <EmptyState
      title="Nothing new from your twins yet"
      description={`Your ${result.twinsUsed} closest twins own nothing you haven't already got, wishlisted or hidden. More turns up as Dighead scans more fans.`}
      action={<LinkButton href="#twins">See the Twins tab</LinkButton>}
    />
  );
}
