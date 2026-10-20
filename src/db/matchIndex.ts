// The match index: each fan's distinct collection matchKeys and, per matchKey, how many fans
// hold it. Derived from `ownership`; these pure helpers compute it, repo/matchIndex.ts stores it.
// Keys are stored as numbers (keyToNumber): reading and counting them is about twice as fast.

import { keyToNumber } from '../bandcamp';
import type { FanMatchesRecord, MatchOwnersRecord, OwnershipRecord } from './schema';

/** What a fan owns, as sorted match ids. Wishlists don't count as owning. */
export function collectionMatchIds(rows: Iterable<OwnershipRecord>): Float64Array {
  const ids = new Set<number>();
  for (const row of rows) if (row.source === 'collection') ids.add(keyToNumber(row.matchKey));
  return Float64Array.from(ids).sort();
}

/** Adds the owner-count changes of one fan's sorted list going from `before` to `after`. */
export function addOwnerDeltas(
  before: Float64Array,
  after: Float64Array,
  deltas: Map<number, number>,
): void {
  const bump = (id: number, by: number) => deltas.set(id, (deltas.get(id) ?? 0) + by);
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    const old = i < before.length ? (before[i] as number) : Infinity;
    const next = j < after.length ? (after[j] as number) : Infinity;
    if (old === next) {
      i++;
      j++;
    } else if (old < next) {
      bump(old, -1);
      i++;
    } else {
      bump(next, 1);
      j++;
    }
  }
}

/** Builds the whole index from scratch, e.g. when upgrading a database that predates it. */
export function buildMatchIndex(rows: Iterable<OwnershipRecord>): {
  fanMatches: FanMatchesRecord[];
  matchOwners: MatchOwnersRecord[];
} {
  const byFan = new Map<number, OwnershipRecord[]>();
  for (const row of rows) {
    const list = byFan.get(row.fanId);
    if (list) list.push(row);
    else byFan.set(row.fanId, [row]);
  }
  const fanMatches: FanMatchesRecord[] = [];
  const owners = new Map<number, number>();
  for (const [fanId, fanRows] of byFan) {
    const matchIds = collectionMatchIds(fanRows);
    if (matchIds.length === 0) continue;
    fanMatches.push({ fanId, matchIds });
    for (const id of matchIds) owners.set(id, (owners.get(id) ?? 0) + 1);
  }
  return {
    fanMatches,
    matchOwners: [...owners].map(([matchId, count]) => ({ matchId, owners: count })),
  };
}
