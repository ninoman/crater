import { useTwins } from '../../../hooks/useTwins';
import type { TwinsResult } from '../../../shared/twins';
import { Button, EmptyState } from '../../../ui';
import { TwinsBoard } from './TwinsBoard';

/** The Twins tab on your profile: the leaderboard, or why there isn't one yet. */
export function TwinsTab() {
  const { view, reload } = useTwins();

  switch (view.state) {
    case 'loading':
      return <EmptyState title="Loading your taste twins…" />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Couldn't load your taste twins"
          description="Dighead's background worker didn't answer. Try again, or reload the extension from chrome://extensions."
          action={<Button onClick={reload}>Try again</Button>}
        />
      );
    case 'ready':
      return view.result.rows.length > 0 ? (
        <TwinsBoard result={view.result} now={view.loadedAt} />
      ) : (
        <NoTwins result={view.result} />
      );
  }
}

function NoTwins({ result }: { result: TwinsResult }) {
  switch (result.basis) {
    case 'no-viewer':
      return (
        <EmptyState
          title="Dighead hasn't seen you log in yet"
          description="Reload this page so Dighead can pick up your account and sync your collection."
        />
      );
    case 'unsynced':
      return (
        <EmptyState
          title="Your collection is still syncing"
          description="Twins are worked out from your collection once its first sync finishes. The Dighead popup shows how far it has got."
        />
      );
    case 'ready':
      return (
        <EmptyState
          title="No taste twins yet"
          description={`Twins are fans who own what you own. Dighead has read ${result.fansRead} fan ${result.fansRead === 1 ? 'collection' : 'collections'} so far. Open the pages of releases you love: Dighead scans their supporters in the background and updates this list as it goes.`}
        />
      );
  }
}
