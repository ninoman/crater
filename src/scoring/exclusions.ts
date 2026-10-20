// What no recommender may suggest. Shared by Also bought and For you.

import { keyToNumber, type ItemKey } from '../bandcamp';

/** One ownership row of yours, as far as filtering cares. */
export interface MyRow {
  itemKey: ItemKey;
  matchKey: ItemKey;
  source: 'collection' | 'wishlist';
}

/** Keyed by match id (keyToNumber), like the lists they filter. */
export interface Exclusions {
  excluded: Set<number>;
  /** Albums you own some tracks of. They stay in, tagged with the count (decisions §3.8). */
  ownedTracks: Map<number, number>;
}

/**
 * What never gets recommended: hidden releases, releases you own or wishlisted as a whole, and
 * the release being recommended from, if any. Owning or wishlisting a track of an album keeps
 * the album in.
 */
export function exclusions(
  mine: readonly MyRow[],
  hidden: ReadonlySet<ItemKey>,
  release?: ItemKey,
): Exclusions {
  const excluded = new Set([...hidden].map(keyToNumber));
  if (release !== undefined) excluded.add(keyToNumber(release));
  const ownedTracks = new Map<number, number>();
  for (const row of mine) {
    const id = keyToNumber(row.matchKey);
    if (row.itemKey === row.matchKey) excluded.add(id);
    else if (row.source === 'collection') ownedTracks.set(id, (ownedTracks.get(id) ?? 0) + 1);
  }
  for (const key of excluded) ownedTracks.delete(key);
  return { excluded, ownedTracks };
}
