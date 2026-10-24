// A list tab's filter and selection over its items (decisions §14).

import type { ItemKey } from '../../bandcamp';
import type { ListedItem } from '../../shared/itemList';
import { commonTagIds, type TaggedRows, type TagFilter, visibleKeys } from '../shared/tagFilter';

const ITEMS: TaggedRows<ListedItem, ItemKey> = {
  keyOf: (item) => item.itemKey,
  tagIdsOf: (item) => item.tagIds,
  // The search finds a release by its artist, title or label.
  textOf: (item) => `${item.artist} ${item.title} ${item.label ?? ''}`,
};

/** Keys of the items passing the tag filter and the search. */
export function visibleItemKeys(items: readonly ListedItem[], filter: TagFilter): Set<ItemKey> {
  return visibleKeys(items, filter, ITEMS);
}

/** Tags every one of `keys` has, so the bulk picker can show them as assigned. */
export function commonItemTagIds(items: readonly ListedItem[], keys: readonly ItemKey[]): number[] {
  return commonTagIds(items, keys, ITEMS);
}
