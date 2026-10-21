import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { notifyFollowingChanged } from '../../hooks/followingChanges';
import { useFollowing } from '../../hooks/useFollowing';
import { useScannerNotices } from '../../hooks/useScannerNotices';
import { useTags } from '../../hooks/useTags';
import { useTwinStandings } from '../../hooks/useTwinStandings';
import type { Following, FollowingKey, Tag } from '../../shared/following';
import { Button, EmptyState, Notice, NoticeStack, PortalContainerProvider } from '../../ui';
import { followTagHandlers } from '../shared/followTagActions';
import { BulkBar } from './BulkBar';
import { CardExtras } from './CardExtras';
import { CardSelect } from './CardSelect';
import { EmptyFollowing } from './EmptyFollowing';
import { FilterControls } from './FilterControls';
import {
  actionable,
  commonTagIds,
  isFiltering,
  liveTagIds,
  NO_FILTER,
  toggled,
  visibleIds,
} from './followingFilter';
import type { TakenList } from './takeOverList';
import { useCards } from './useCards';

const NO_TAG_IDS: number[] = [];
const NO_ROWS: Following[] = [];
const NO_TAGS: Tag[] = [];
/** As often as the profile tabs check the queue's health. */
const SCANNER_POLL_MS = 5000;

/**
 * One taken-over list: the filter bar above it, and our additions inside each of its cards,
 * all through portals from the one React root. Filtering hides cards; it never rebuilds them.
 */
export function FollowingTakeover({ taken, open }: { taken: TakenList; open: boolean }) {
  const { kind, list, bar, showBandcampList } = taken;
  const { view, setUnfollowed } = useFollowing(kind, NO_TAG_IDS, 'all');
  const tagsQuery = useTags();
  const { create, assign } = tagsQuery;
  const mutations = useMemo(() => ({ create, assign }), [create, assign]);
  const rows = view.state === 'ready' ? view.data : null;
  const allRows = rows ?? NO_ROWS;
  const tags = tagsQuery.view.state === 'ready' ? tagsQuery.view.data : NO_TAGS;
  const { cardList, cards } = useCards(list, rows);

  const fanIds = useMemo(
    () => (kind === 'fan' ? allRows.map((row) => row.id) : NO_TAG_IDS),
    [kind, allRows],
  );
  const standings = useTwinStandings(fanIds);

  const [rawFilter, setFilter] = useState(NO_FILTER);
  const filter = useMemo(
    () => ({ ...rawFilter, tagIds: liveTagIds(rawFilter.tagIds, tags) }),
    [rawFilter, tags],
  );
  const visible = useMemo(() => visibleIds(allRows, filter), [allRows, filter]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Runs after useCards' layout effect, so new cards are already in the list.
  useLayoutEffect(() => cardList.show(visible), [cardList, visible]);

  // Ours can't stand in for Bandcamp's list until it has loaded; an empty list decides itself.
  useEffect(() => {
    if (view.state === 'unreachable') showBandcampList(true);
    else if (view.state === 'loading' || allRows.length > 0) showBandcampList(false);
  }, [view.state, allRows.length, showBandcampList]);

  useEffect(
    () =>
      cardList.watchFollows((id, following) => {
        const key: FollowingKey = [kind, id];
        setUnfollowed(key, !following).catch((reason: unknown) => setError(String(reason)));
      }),
    [cardList, kind, setUnfollowed],
  );

  const onSelect = useCallback(
    (id: number, on: boolean) => setSelected((ids) => toggled(ids, id, on)),
    [],
  );

  const rowsById = useMemo(() => new Map(allRows.map((row) => [row.id, row])), [allRows]);
  const portals = cards.flatMap((card) => {
    const row = rowsById.get(card.id);
    if (!row) return [];
    return [
      createPortal(
        <CardSelect
          id={row.id}
          name={row.name}
          selected={selected.has(row.id)}
          onSelect={onSelect}
        />,
        card.selectSlot,
        `${card.id}-select`,
      ),
      createPortal(
        <PortalContainerProvider container={card.slot}>
          <CardExtras
            row={row}
            tags={tags}
            mutations={mutations}
            onError={setError}
            standing={standings.state === 'ready' ? (standings.data[row.id] ?? null) : null}
          />
        </PortalContainerProvider>,
        card.slot,
        String(card.id),
      ),
    ];
  });

  const picked = actionable(selected, visible);
  const pickedKeys = picked.map((id): FollowingKey => [kind, id]);
  const common = commonTagIds(allRows, picked);

  function body() {
    switch (view.state) {
      case 'loading':
        return <EmptyState title="Loading your follows…" />;
      case 'unreachable':
        return (
          <EmptyState
            tone="error"
            title="Couldn't load your follows"
            description="Dighead's background worker didn't answer, so Bandcamp's own list is below. Try again, or reload the extension from chrome://extensions."
            action={<Button onClick={notifyFollowingChanged}>Try again</Button>}
          />
        );
      case 'ready':
        // It polls the sync status, so only while this list is the one on screen.
        if (allRows.length === 0) {
          return open && <EmptyFollowing kind={kind} showBandcampList={showBandcampList} />;
        }
        return (
          <>
            <FilterControls tags={tags} filter={filter} onChange={setFilter} />
            {tags.length === 0 && (
              <p className="dh-following-bar__note">
                No tags yet. Use “+ tag” on a card to make your first, or check a few cards to tag
                them together.
              </p>
            )}
            {visible.size === 0 ? (
              <EmptyState
                title="No follows match these filters"
                action={<Button onClick={() => setFilter(NO_FILTER)}>Clear filters</Button>}
              />
            ) : (
              isFiltering(filter) && (
                <p className="dh-following-bar__note" aria-live="polite">
                  Showing {visible.size} of {allRows.length}
                </p>
              )
            )}
            {picked.length > 0 && (
              <BulkBar
                count={picked.length}
                tags={tags}
                commonIds={common}
                onClear={() => setSelected(new Set())}
                {...followTagHandlers(mutations, pickedKeys, common, setError)}
              />
            )}
          </>
        );
    }
  }

  return (
    <>
      {createPortal(
        <PortalContainerProvider container={bar.container}>
          <section className="dh-following-bar" aria-label="Dighead: your follows">
            {open && <ScannerNotices />}
            {error && (
              <Notice tone="error" title="Couldn't save that change.">
                {error}
              </Notice>
            )}
            {body()}
          </section>
        </PortalContainerProvider>,
        bar.container,
      )}
      {portals}
    </>
  );
}

/** Mounted only while the list is open, so a hidden list doesn't poll. */
function ScannerNotices() {
  return <NoticeStack notices={useScannerNotices(SCANNER_POLL_MS)} />;
}
