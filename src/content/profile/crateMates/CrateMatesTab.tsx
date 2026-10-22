import { useCrateMates } from '../../../hooks/useCrateMates';
import type { CrateMatesResult } from '../../../shared/crateMates';
import { Button, EmptyState } from '../../../ui';
import { CrateMatesBoard } from './CrateMatesBoard';

/** The Crate mates tab on your profile: the leaderboard, or why there isn't one yet. */
export function CrateMatesTab() {
  const { view, reload } = useCrateMates();

  switch (view.state) {
    case 'loading':
      return <EmptyState title="Loading your crate mates…" />;
    case 'unreachable':
      return (
        <EmptyState
          tone="error"
          title="Couldn't load your crate mates"
          description="Dighead's background worker didn't answer. Try again, or reload the extension from chrome://extensions."
          action={<Button onClick={reload}>Try again</Button>}
        />
      );
    case 'ready':
      return view.result.rows.length > 0 ? (
        <CrateMatesBoard result={view.result} now={view.loadedAt} />
      ) : (
        <NoCrateMates result={view.result} />
      );
  }
}

function NoCrateMates({ result }: { result: CrateMatesResult }) {
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
          description="Crate mates are worked out from your collection once its first sync finishes. The Dighead popup shows how far it has got."
        />
      );
    case 'ready':
      return (
        <EmptyState
          title="No crate mates yet"
          description={`Crate mates are fans who own what you own. Dighead has read ${result.fansRead} fan ${result.fansRead === 1 ? 'collection' : 'collections'} so far. Open the pages of releases you love: Dighead scans their supporters in the background and updates this list as it goes.`}
        />
      );
  }
}
