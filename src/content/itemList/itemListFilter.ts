// The wishlist tab's filter and selection over its items (decisions §14).

import type { ItemKey } from '../../bandcamp';
import type { WishlistItem } from '../../shared/wishlist';
import { commonTagIds, type TaggedRows, type TagFilter, visibleKeys } from '../shared/tagFilter';

const ITEMS: TaggedRows<WishlistItem, ItemKey> = {
  keyOf: (item) => item.itemKey,
  tagIdsOf: (item) => item.tagIds,
  // The search finds a release by its artist or its title.
  textOf: (item) => `${item.artist} ${item.title}`,
};

/** Keys of the items passing the tag filter and the search. */
export function visibleItemKeys(items: readonly WishlistItem[], filter: TagFilter): Set<ItemKey> {
  return visibleKeys(items, filter, ITEMS);
}

/** Tags every one of `keys` has, so the bulk picker can show them as assigned. */
export function commonItemTagIds(
  items: readonly WishlistItem[],
  keys: readonly ItemKey[],
): number[] {
  return commonTagIds(items, keys, ITEMS);
}

// Day first, as Bandcamp writes dates ("19 Oct 2026").
// Day first, as Bandcamp writes dates ("19 Oct 2026").
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "added 3 Oct 2026", or null when Bandcamp didn't say when. */
export function addedText(addedAt: number | null): string | null {
  return addedAt === null ? null : `added ${DATE.format(addedAt)}`;
}
