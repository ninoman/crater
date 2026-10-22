import { useState } from 'react';
import type { ItemKey } from '../../../bandcamp';
import { useForYou, type ForYouView } from '../../../hooks/useForYou';
import type { ForYouMode, ForYouResult } from '../../../shared/forYou';
import { Button, EmptyState, LinkButton, Segmented } from '../../../ui';
import { ForYouList } from './ForYouList';
import { formatForYouSummary } from './forYouText';

const MODES = [
  { value: 'all', label: 'All time' },
  { value: 'fresh', label: 'Fresh' },
  { value: 'deep', label: 'Deep cuts' },
] as const;

const LOADING_TITLES: Record<ForYouMode, string> = {
  all: 'Finding releases for you…',
  fresh: 'Finding fresh releases for you…',
  deep: 'Digging for deep cuts…',
};

/**
 * The For you tab on your profile: picks from your top twins, or from what your lately twins
 * bought recently, or why there aren't any yet. The switch stays put in every state, so an
 * empty Fresh list can be switched back from.
 */
export function ForYouTab() {
  const [mode, setMode] = useState<ForYouMode>('all');
  const { view, reload, hide } = useForYou(mode);
  const picks = view.state === 'ready' ? view.result.rows.length : 0;

  return (
    <>
      <div className="dh-profile__toolbar">
        <p className="dh-profile__summary">
          {picks > 0 &&
            view.state === 'ready' &&
            formatForYouSummary(picks, view.result.twinsUsed, mode)}
        </p>
        <div className="dh-profile__controls">
          <Segmented label="Which picks" options={MODES} value={mode} onChange={setMode} />
        </div>
      </div>
      <ForYouBody view={view} mode={mode} reload={reload} hide={hide} />
    </>
  );
}

interface ForYouBodyProps {
  view: ForYouView;
  mode: ForYouMode;
  reload: () => void;
  hide: (matchKey: ItemKey) => void;
}

function ForYouBody({ view, mode, reload, hide }: ForYouBodyProps) {
  switch (view.state) {
    case 'loading':
      return <EmptyState title={LOADING_TITLES[mode]} />;
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
        <ForYouList rows={view.result.rows} mode={mode} now={view.loadedAt} onHide={hide} />
      ) : (
        <NoPicks result={view.result} mode={mode} />
      );
  }
}

function NoPicks({ result, mode }: { result: ForYouResult; mode: ForYouMode }) {
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
  if (mode === 'deep') return <NoDeepCuts twinsUsed={result.twinsUsed} />;
  if (mode === 'fresh') return <NoFreshPicks twinsUsed={result.twinsUsed} />;
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

function NoFreshPicks({ twinsUsed }: { twinsUsed: number }) {
  if (twinsUsed === 0) {
    return (
      <EmptyState
        title="No lately twins yet"
        description="Fresh is built from the fans whose recent buying is most in step with yours. Either you haven't bought much lately, or none of the fans read so far bought the same releases around the same time. All time still has picks from your closest twins overall."
        action={<LinkButton href="#twins">See the Twins tab</LinkButton>}
      />
    );
  }
  return (
    <EmptyState
      title="Nothing fresh from your lately twins"
      description={`Your ${twinsUsed} lately ${twinsUsed === 1 ? 'twin has' : 'twins have'} bought nothing in the last year that you haven't already got, wishlisted or hidden. Try All time, or check back after Dighead scans more fans.`}
      action={<LinkButton href="#twins">See the Twins tab</LinkButton>}
    />
  );
}

function NoDeepCuts({ twinsUsed }: { twinsUsed: number }) {
  if (twinsUsed === 0) {
    return (
      <EmptyState
        title="No taste twins yet"
        description="Deep cuts are built from what your closest twins own. Dighead finds them as its scanner reads the collections of your releases' supporters, so give it time."
        action={<LinkButton href="#twins">See the Twins tab</LinkButton>}
      />
    );
  }
  return (
    <EmptyState
      title="No deep cuts yet"
      description="Your twins' rare records show up as more of them are scanned. You can raise the owner limit in Dighead's settings."
      action={<LinkButton href="#twins">See the Twins tab</LinkButton>}
    />
  );
}
