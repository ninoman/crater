// Pure rules for your collection's order (decisions §29). Entries are Bandcamp's, in its order;
// the repo stores them and the list view sorts by them.

import type { CollectionOrderEntry, ItemKey } from '../bandcamp';

/**
 * After an incremental sync, which reads only the top of the list: those entries in their new
 * order, then every other stored entry in the order it had.
 */
export function mergeTopOfOrder(
  stored: readonly CollectionOrderEntry[],
  top: readonly CollectionOrderEntry[],
): CollectionOrderEntry[] {
  const fetched = new Set(top.map((entry) => entry.itemId));
  return [...top, ...stored.filter((entry) => !fetched.has(entry.itemId))];
}

/**
 * Puts the releases in the order of `itemKeys`. Entries that aren't releases (subscriptions)
 * keep their place, and entries of one release stay together. Releases `itemKeys` leaves out
 * follow, in the order they had.
 */
export function reorderEntries(
  entries: readonly CollectionOrderEntry[],
  itemKeys: readonly ItemKey[],
): CollectionOrderEntry[] {
  const groups = new Map<ItemKey, CollectionOrderEntry[]>();
  for (const entry of entries) {
    if (entry.itemKey === null) continue;
    const group = groups.get(entry.itemKey);
    if (group) group.push(entry);
    else groups.set(entry.itemKey, [entry]);
  }
  const queued = [...new Set(itemKeys)].filter((key) => groups.has(key));
  const named = new Set(queued);
  queued.push(...[...groups.keys()].filter((key) => !named.has(key)));

  const placed = new Set<ItemKey>();
  const result: CollectionOrderEntry[] = [];
  let next = 0;
  for (const entry of entries) {
    if (entry.itemKey === null) {
      result.push(entry);
    } else if (!placed.has(entry.itemKey)) {
      // The first entry of each release is a slot; the next release in the new order fills it.
      placed.add(entry.itemKey);
      const key = queued[next++];
      if (key !== undefined) result.push(...(groups.get(key) ?? []));
    }
  }
  return result;
}

/** Each release's position in the order, by its first entry. */
export function orderRanks(entries: readonly CollectionOrderEntry[]): Map<ItemKey, number> {
  const ranks = new Map<ItemKey, number>();
  entries.forEach((entry, i) => {
    if (entry.itemKey !== null && !ranks.has(entry.itemKey)) ranks.set(entry.itemKey, i);
  });
  return ranks;
}
