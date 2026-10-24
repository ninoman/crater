import { useState } from 'react';
import type { RowActions } from '../../../hooks/rowActions';
import { useForYou, type ForYouView } from '../../../hooks/useForYou';
import { useListFilters } from '../../../hooks/useListFilters';
import { useStoredFlag } from '../../../hooks/useStoredFlag';
import type { ForYouMode, ForYouResult } from '../../../shared/forYou';
import { NO_FILTERS } from '../../../shared/listFilters';
import { Button, EmptyState, LinkButton, ListFilterBar, Segmented } from '../../../ui';
import { AllHeard } from '../../shared/AllHeard';
import { FILTER_GENRES } from '../../shared/filterGenres';
import { NoMatches } from '../../shared/NoMatches';
import { HideHeardToggle } from '../../shared/RowControls';
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
 * The For you tab on your profile: picks from your top crate mates, or from what your lately crate mates
 * bought recently, or why there aren't any yet. The switch stays put in every state, so an
 * empty Fresh list can be switched back from.
 */
export function ForYouTab() {
  const [mode, setMode] = useState<ForYouMode>('all');
  const [hideHeard, setHideHeard] = useStoredFlag('hideHeard.forYou', false);
  const { filters, setFilters, ready, place } = useListFilters('forYou');
  const { view, reload, ...actions } = useForYou(mode, hideHeard, filters, ready);
  const picks = view.state === 'ready' ? view.result.rows.length : 0;

  return (
    <>
      <div className="dh-profile__toolbar">
        <p className="dh-profile__summary">
          {picks > 0 &&
            view.state === 'ready' &&
            formatForYouSummary(picks, view.result.crateMatesUsed, mode)}
        </p>
        <div className="dh-profile__controls">
          <HideHeardToggle checked={hideHeard} onChange={setHideHeard} />
          <Segmented label="Which picks" options={MODES} value={mode} onChange={setMode} />
        </div>
      </div>
      <ListFilterBar
        filters={filters}
        onChange={setFilters}
        genres={FILTER_GENRES}
        place={place}
        summary={view.state === 'ready' ? (view.result.filtered?.summary ?? null) : null}
      />
      <ForYouBody
        view={view}
        mode={mode}
        reload={reload}
        actions={actions}
        onShowHeard={hideHeard ? () => setHideHeard(false) : null}
        onClearFilters={() => setFilters(NO_FILTERS)}
      />
    </>
  );
}

interface ForYouBodyProps {
  view: ForYouView;
  mode: ForYouMode;
  reload: () => void;
  actions: RowActions;
  /** Set while "Hide heard" is on, for an empty list to offer turning it off. */
  onShowHeard: (() => void) | null;
  onClearFilters: () => void;
}

function ForYouBody({ view, mode, reload, actions, onShowHeard, onClearFilters }: ForYouBodyProps) {
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
      if (view.result.rows.length > 0) {
        return (
          <ForYouList rows={view.result.rows} mode={mode} now={view.loadedAt} actions={actions} />
        );
      }
      if (view.result.filtered && view.result.filtered.summary.hidden > 0) {
        return <NoMatches summary={view.result.filtered.summary} onClear={onClearFilters} />;
      }
      if (onShowHeard && view.result.basis === 'ready' && view.result.crateMatesUsed > 0) {
        return <AllHeard onShowHeard={onShowHeard} />;
      }
      return <NoPicks result={view.result} mode={mode} />;
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
        description="For you is built from your crate mates, and they're worked out once your collection's first sync finishes. The Dighead popup shows how far it has got."
      />
    );
  }
  if (mode === 'deep') return <NoDeepCuts crateMatesUsed={result.crateMatesUsed} />;
  if (mode === 'fresh') return <NoFreshPicks crateMatesUsed={result.crateMatesUsed} />;
  if (result.crateMatesUsed === 0) {
    return (
      <EmptyState
        title="No crate mates yet"
        description="For you is built from what your closest crate mates own. Dighead finds them as its scanner reads the collections of your releases' supporters, so give it time, or open the pages of releases you love to scan their supporters first."
        action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
      />
    );
  }
  return (
    <EmptyState
      title="Nothing new from your crate mates yet"
      description={`Your ${result.crateMatesUsed} closest crate mates own nothing you haven't already got, wishlisted or hidden. More turns up as Dighead scans more fans.`}
      action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
    />
  );
}

function NoFreshPicks({ crateMatesUsed }: { crateMatesUsed: number }) {
  if (crateMatesUsed === 0) {
    return (
      <EmptyState
        title="No lately crate mates yet"
        description="Fresh is built from the fans whose recent buying is most in step with yours. Either you haven't bought much lately, or none of the fans read so far bought the same releases around the same time. All time still has picks from your closest crate mates overall."
        action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
      />
    );
  }
  return (
    <EmptyState
      title="Nothing fresh from your lately crate mates"
      description={`Your ${crateMatesUsed} lately ${crateMatesUsed === 1 ? 'crate mate has' : 'crate mates have'} bought nothing in the last year that you haven't already got, wishlisted or hidden. Try All time, or check back after Dighead scans more fans.`}
      action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
    />
  );
}

function NoDeepCuts({ crateMatesUsed }: { crateMatesUsed: number }) {
  if (crateMatesUsed === 0) {
    return (
      <EmptyState
        title="No crate mates yet"
        description="Deep cuts are built from what your closest crate mates own. Dighead finds them as its scanner reads the collections of your releases' supporters, so give it time."
        action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
      />
    );
  }
  return (
    <EmptyState
      title="No deep cuts yet"
      description="Your crate mates' rare records show up as more of them are scanned. You can raise the owner limit in Dighead's settings."
      action={<LinkButton href="#crate-mates">See the Crate mates tab</LinkButton>}
    />
  );
}
