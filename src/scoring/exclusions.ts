// What no recommender may suggest. Shared by Also bought and For you.

import { keyToNumber, type ItemKey } from '../bandcamp';

/** One ownership row of yours, as far as filtering cares. */
export interface MyRow {
  itemKey: ItemKey;
  matchKey: ItemKey;
  source: 'collection' | 'wishlist';
}

/**
 * Match ids (keyToNumber) that never get recommended: hidden releases, releases you own or
 * wishlisted as a whole, albums you own a track of, and the release being recommended from, if
 * any. Owning a track almost always means you've heard the album; wishlisting one doesn't, so
 * that album stays in (decisions §3.8).
 */
export function exclusions(
  mine: readonly MyRow[],
  hidden: ReadonlySet<ItemKey>,
  release?: ItemKey,
): Set<number> {
  const excluded = new Set([...hidden].map(keyToNumber));
  if (release !== undefined) excluded.add(keyToNumber(release));
  for (const row of mine) {
    if (row.itemKey === row.matchKey || row.source === 'collection') {
      excluded.add(keyToNumber(row.matchKey));
    }
  }
  return excluded;
}
