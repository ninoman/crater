import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemKey } from '../../bandcamp';
import { notifyFollowingChanged } from '../../hooks/followingChanges';
import { useTags } from '../../hooks/useTags';
import { useWishlist } from '../../hooks/useWishlist';
import type { Tag } from '../../shared/following';
import type { WishlistItem } from '../../shared/wishlist';
import { Button, EmptyState, Notice, RowList } from '../../ui';
import { BulkBar } from '../shared/BulkBar';
import { EmptyWishlist } from './EmptyWishlist';
import { FilterControls } from '../shared/FilterControls';
import { itemTagHandlers } from '../shared/tagActions';
import { actionable, isFiltering, liveTagIds, NO_FILTER, toggled } from '../shared/tagFilter';
import { commonItemTagIds, visibleItemKeys } from './wishlistFilter';
import { WishlistRow } from './WishlistRow';

const NO_ITEMS: WishlistItem[] = [];
const NO_TAGS: Tag[] = [];

export interface WishlistViewProps {
  /** Whether the wishlist tab is on screen; the empty state polls the sync only then. */
  open: boolean;
  showBandcampList: (shown: boolean) => void;
}

/**
 * Your whole wishlist in place of Bandcamp's paged one: a filter bar, then every release with
 * its tags, one preview open at a time, and bulk tagging of the checked ones (decisions §14).
 */
export function WishlistView({ open, showBandcampList }: WishlistViewProps) {
  const view = useWishlist();
  const tagsQuery = useTags();
  const { create, assign, assignItems } = tagsQuery;
  const mutations = useMemo(() => ({ create, assign, assignItems }), [create, assign, assignItems]);
  const items = view.state === 'ready' ? view.data : NO_ITEMS;
  const tags = tagsQuery.view.state === 'ready' ? tagsQuery.view.data : NO_TAGS;

  const [rawFilter, setFilter] = useState(NO_FILTER);
  const filter = useMemo(
    () => ({ ...rawFilter, tagIds: liveTagIds(rawFilter.tagIds, tags) }),
    [rawFilter, tags],
  );
  const visible = useMemo(() => visibleItemKeys(items, filter), [items, filter]);
  const shown = useMemo(() => items.filter((item) => visible.has(item.itemKey)), [items, visible]);
  const [selected, setSelected] = useState<ReadonlySet<ItemKey>>(new Set());
  const [previewing, setPreviewing] = useState<ItemKey | null>(null);
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

  const picked = actionable(selected, visible);
  const common = commonItemTagIds(items, picked);

  function body() {
    switch (view.state) {
      case 'loading':
        return <EmptyState title="Loading your wishlist…" />;
      case 'unreachable':
        return (
          <EmptyState
            tone="error"
            title="Couldn't load your wishlist"
            description="Dighead's background worker didn't answer, so Bandcamp's own list is below. Try again, or reload the extension from chrome://extensions."
            action={<Button onClick={notifyFollowingChanged}>Try again</Button>}
          />
        );
      case 'ready':
        if (items.length === 0) {
          return open && <EmptyWishlist showBandcampList={showBandcampList} />;
        }
        return (
          <>
            <FilterControls
              tags={tags}
              filter={filter}
              onChange={setFilter}
              modeLabel="Show releases with"
              searchLabel="Search artists and titles"
            />
            {tags.length === 0 && (
              <p className="dh-tag-bar__note">
                No tags yet. Use “+ tag” on a release to make your first, or check a few to tag them
                together.
              </p>
            )}
            {shown.length === 0 ? (
              <EmptyState
                title="No releases match these filters"
                action={<Button onClick={() => setFilter(NO_FILTER)}>Clear filters</Button>}
              />
            ) : (
              isFiltering(filter) && (
                <p className="dh-tag-bar__note" aria-live="polite">
                  Showing {shown.length} of {items.length}
                </p>
              )
            )}
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
      <section className="dh-tag-bar" aria-label="Dighead: your wishlist">
        {error && (
          <Notice tone="error" title="Couldn't save that change.">
            {error}
          </Notice>
        )}
        {body()}
      </section>
      {shown.length > 0 && (
        <div className="dh-wishlist__list">
          <RowList label="Your wishlist">
            {shown.map((item) => (
              <WishlistRow
                key={item.itemKey}
                item={item}
                tags={tags}
                mutations={mutations}
                selected={selected.has(item.itemKey)}
                previewing={previewing === item.itemKey}
                onSelect={onSelect}
                onPreview={onPreview}
                onError={setError}
              />
            ))}
          </RowList>
        </div>
      )}
    </>
  );
}
