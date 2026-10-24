import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemKey } from '../../bandcamp';
import { notifyFollowingChanged } from '../../hooks/followingChanges';
import { useListItems } from '../../hooks/useListItems';
import { useSyncReload } from '../../hooks/useSyncReload';
import { useTags } from '../../hooks/useTags';
import type { Tag } from '../../shared/following';
import type { ListedItem } from '../../shared/itemList';
import { Button, CardGrid, EmptyState, LoadMore, Notice } from '../../ui';
import { BulkBar } from '../shared/BulkBar';
import { FilterControls } from '../shared/FilterControls';
import { syncingStep } from '../shared/syncEmpty';
import { itemTagHandlers } from '../shared/tagActions';
import { actionable, isFiltering, liveTagIds, NO_FILTER, toggled } from '../shared/tagFilter';
import { EmptyItemList } from './EmptyItemList';
import { ItemCard } from './ItemCard';
import { commonItemTagIds, visibleItemKeys } from './itemListFilter';
import type { ListConfig } from './lists';

const NO_ITEMS: readonly ListedItem[] = [];
const NO_TAGS: Tag[] = [];
/** Cards rendered at a time. A 2,000-item list all at once is ~60k elements. */
const PAGE_SIZE = 120;

export interface ItemListViewProps {
  list: ListConfig;
  /** Whether the tab is on screen; the empty state polls the sync only then. */
  open: boolean;
  showBandcampList: (shown: boolean) => void;
}

/**
 * Your whole wishlist or collection in place of Bandcamp's paged one: a filter bar, then every
 * release as a grid card with its tags, one preview open at a time, and bulk tagging
 * of the checked ones (decisions §14, §24).
 */
export function ItemListView({ list, open, showBandcampList }: ItemListViewProps) {
  const { source, noun } = list;
  const view = useListItems(source);
  const tagsQuery = useTags();
  const { create, assign, assignItems } = tagsQuery;
  const mutations = useMemo(() => ({ create, assign, assignItems }), [create, assign, assignItems]);
  const items = view.state === 'ready' ? view.data : NO_ITEMS;
  const tags = tagsQuery.view.state === 'ready' ? tagsQuery.view.data : NO_TAGS;
  const sync = useSyncReload(open, list.countOf);
  const stillSyncing = sync.state === 'ready' && syncingStep(sync.status, list.step);

  const [rawFilter, setFilter] = useState(NO_FILTER);
  const filter = useMemo(
    () => ({ ...rawFilter, tagIds: liveTagIds(rawFilter.tagIds, tags) }),
    [rawFilter, tags],
  );
  const visible = useMemo(() => visibleItemKeys(items, filter), [items, filter]);
  const shown = useMemo(() => items.filter((item) => visible.has(item.itemKey)), [items, visible]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  // A new filter starts from the top. Keyed on the raw filter: tag refetches rebuild `filter`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when what's shown changes
  useEffect(() => setLimit(PAGE_SIZE), [rawFilter]);
  const rendered = useMemo(() => shown.slice(0, limit), [shown, limit]);
  const [selected, setSelected] = useState<ReadonlySet<ItemKey>>(new Set());
  const [previewing, setPreviewing] = useState<ItemKey | null>(null);
  // Previews mark heard in the worker; the card shows it now rather than at the next read.
  const [heardNow, setHeardNow] = useState<ReadonlySet<ItemKey>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Ours can't stand in for Bandcamp's list until it has loaded; an empty list decides itself.
  useEffect(() => {
    if (view.state === 'unreachable') showBandcampList(true);
    else if (view.state === 'loading' || items.length > 0) showBandcampList(false);
  }, [view.state, items.length, showBandcampList]);

  const onSelect = useCallback(
    (itemKey: ItemKey, on: boolean) => setSelected((keys) => toggled(keys, itemKey, on)),
    [],
  );
  const onPreview = useCallback(
    (itemKey: ItemKey, on: boolean) => setPreviewing(on ? itemKey : null),
    [],
  );
  const onHeard = useCallback(
    (itemKey: ItemKey) => setHeardNow((keys) => toggled(keys, itemKey, true)),
    [],
  );

  const picked = actionable(selected, visible);
  const common = commonItemTagIds(items, picked);

  function emptyShown() {
    if (shown.length === 0) {
      return (
        <EmptyState
          title="No releases match these filters"
          action={<Button onClick={() => setFilter(NO_FILTER)}>Clear filters</Button>}
        />
      );
    }
    return isFiltering(filter) ? (
      <p className="dh-tag-bar__note" aria-live="polite">
        Showing {shown.length} of {items.length}
      </p>
    ) : null;
  }

  function body() {
    switch (view.state) {
      case 'loading':
        return <EmptyState title={`Loading your ${noun}…`} />;
      case 'unreachable':
        return (
          <EmptyState
            tone="error"
            title={`Couldn't load your ${noun}`}
            description="Dighead's background worker didn't answer, so Bandcamp's own list is below. Try again, or reload the extension from chrome://extensions."
            action={<Button onClick={notifyFollowingChanged}>Try again</Button>}
          />
        );
      case 'ready':
        if (items.length === 0) {
          return (
            open && <EmptyItemList list={list} view={sync} showBandcampList={showBandcampList} />
          );
        }
        return (
          <>
            <FilterControls
              tags={tags}
              filter={filter}
              onChange={setFilter}
              modeLabel="Show releases with"
              searchLabel="Search artists, titles and labels"
            />
            {stillSyncing && (
              <p className="dh-tag-bar__note" aria-live="polite">
                Still syncing your {noun}: {items.length} releases so far. The rest show up here as
                they arrive.
              </p>
            )}
            {tags.length === 0 && (
              <p className="dh-tag-bar__note">
                No tags yet. Use “+ tag” on a release to make your first, or check a few to tag them
                together.
              </p>
            )}
            {emptyShown()}
            {picked.length > 0 && (
              <BulkBar
                label="Selected releases"
                count={picked.length}
                tags={tags}
                commonIds={common}
                onClear={() => setSelected(new Set())}
                {...itemTagHandlers(mutations, picked, common, setError)}
              />
            )}
          </>
        );
    }
  }

  return (
    <>
      <section className="dh-tag-bar" aria-label={`Dighead: ${list.label}`}>
        {error && (
          <Notice tone="error" title="Couldn't save that change.">
            {error}
          </Notice>
        )}
        {body()}
      </section>
      {shown.length > 0 && (
        <div className="dh-itemlist__list">
          <CardGrid label={`Your ${noun}`}>
            {rendered.map((item) => (
              <ItemCard
                key={item.itemKey}
                item={item}
                source={source}
                tags={tags}
                mutations={mutations}
                selected={selected.has(item.itemKey)}
                previewing={previewing === item.itemKey}
                heard={item.heard || heardNow.has(item.itemKey)}
                onSelect={onSelect}
                onPreview={onPreview}
                onHeard={onHeard}
                onError={setError}
              />
            ))}
          </CardGrid>
          <LoadMore
            remaining={shown.length - rendered.length}
            onMore={() => setLimit((current) => current + PAGE_SIZE)}
          />
        </div>
      )}
    </>
  );
}
