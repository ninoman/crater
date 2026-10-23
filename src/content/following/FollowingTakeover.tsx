import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { notifyFollowingChanged } from '../../hooks/followingChanges';
import { useFollowing } from '../../hooks/useFollowing';
import { useScannerNotices } from '../../hooks/useScannerNotices';
import { useSyncReload } from '../../hooks/useSyncReload';
import { useTags } from '../../hooks/useTags';
import { useCrateMateStandings } from '../../hooks/useCrateMateStandings';
import type { Following, FollowingKey, Tag } from '../../shared/following';
import {
  Button,
  EmptyState,
  LoadMore,
  Notice,
  NoticeStack,
  PortalContainerProvider,
} from '../../ui';
import { BulkBar } from '../shared/BulkBar';
import { FilterControls } from '../shared/FilterControls';
import { syncingStep } from '../shared/syncEmpty';
import { followTagHandlers } from '../shared/tagActions';
import { CardExtras } from './CardExtras';
import { CardSelect } from './CardSelect';
import { EmptyFollowing } from './EmptyFollowing';
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
const NO_ROWS: readonly Following[] = [];
const NO_TAGS: Tag[] = [];
/** As often as the profile tabs check the queue's health. */
const SCANNER_POLL_MS = 5000;
/** Cards built at a time; each has two shadow roots, so hundreds at once is slow. */
const PAGE_SIZE = 120;
const followedCount = (status: { followed: number }) => status.followed;

/**
 * One taken-over list: the filter bar above it, our additions inside each of its cards and
 * "Show more" below, all through portals from the one React root. Only the first pages of the
 * rows passing the filter have cards; cards that stay are reused, not rebuilt.
 */
export function FollowingTakeover({ taken, open }: { taken: TakenList; open: boolean }) {
  const { kind, list, bar, showBandcampList } = taken;
  const { view, setUnfollowed } = useFollowing(kind, NO_TAG_IDS, 'all');
  const tagsQuery = useTags();
  const { create, assign, assignItems } = tagsQuery;
  const mutations = useMemo(() => ({ create, assign, assignItems }), [create, assign, assignItems]);
  const rows = view.state === 'ready' ? view.data : null;
  const allRows = rows ?? NO_ROWS;
  const tags = tagsQuery.view.state === 'ready' ? tagsQuery.view.data : NO_TAGS;
  const sync = useSyncReload(open, followedCount);
  const stillSyncing = sync.state === 'ready' && syncingStep(sync.status, 'following');

  const fanIds = useMemo(
    () => (kind === 'fan' ? allRows.map((row) => row.id) : NO_TAG_IDS),
    [kind, allRows],
  );
  const standings = useCrateMateStandings(fanIds);

  const [rawFilter, setFilter] = useState(NO_FILTER);
  const filter = useMemo(
    () => ({ ...rawFilter, tagIds: liveTagIds(rawFilter.tagIds, tags) }),
    [rawFilter, tags],
  );
  const visible = useMemo(() => visibleIds(allRows, filter), [allRows, filter]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  // A new filter starts from the top. Keyed on the raw filter: tag refetches rebuild `filter`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the filter changes
  useEffect(() => setLimit(PAGE_SIZE), [rawFilter]);
  const rendered = useMemo(
    () => rows?.filter((row) => visible.has(row.id)).slice(0, limit) ?? null,
    [rows, visible, limit],
  );
  const { cardList, cards } = useCards(list, rendered);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

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
          return (
            open && <EmptyFollowing kind={kind} view={sync} showBandcampList={showBandcampList} />
          );
        }
        return (
          <>
            <FilterControls
              tags={tags}
              filter={filter}
              onChange={setFilter}
              modeLabel="Show follows with"
              searchLabel="Search names"
            />
            {stillSyncing && (
              <p className="dh-tag-bar__note" aria-live="polite">
                Still syncing your follows: {allRows.length} so far. The rest show up here as they
                arrive.
              </p>
            )}
            {tags.length === 0 && (
              <p className="dh-tag-bar__note">
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
                <p className="dh-tag-bar__note" aria-live="polite">
                  Showing {visible.size} of {allRows.length}
                </p>
              )
            )}
            {picked.length > 0 && (
              <BulkBar
                label="Selected follows"
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
          <section className="dh-tag-bar" aria-label="Dighead: your follows">
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
      {createPortal(
        <LoadMore
          remaining={visible.size - (rendered?.length ?? 0)}
          onMore={() => setLimit((current) => current + PAGE_SIZE)}
        />,
        taken.footer.container,
      )}
    </>
  );
}

/** Mounted only while the list is open, so a hidden list doesn't poll. */
function ScannerNotices() {
  return <NoticeStack notices={useScannerNotices(SCANNER_POLL_MS)} />;
}
