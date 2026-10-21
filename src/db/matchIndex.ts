// The match index: each fan's distinct collection matchKeys (plus the album tracks behind them)
// and, per matchKey, how many fans hold it. Derived from `ownership`; these pure helpers compute it, repo/matchIndex.ts stores it.
// Keys are stored as numbers (keyToNumber): reading and counting them is about twice as fast.

import { keyToNumber } from '../bandcamp';
import type { FanMatchesRecord, MatchOwnersRecord, OwnershipRecord } from './schema';

const sorted = (ids: Set<number>) => Float64Array.from(ids).sort();

/** What a fan owns, as sorted lists. Wishlists don't count as owning. */
export function fanMatchLists(rows: Iterable<OwnershipRecord>): Omit<FanMatchesRecord, 'fanId'> {
  const matches = new Set<number>();
  const wholes = new Set<number>();
  const tracks = new Set<number>();
  for (const row of rows) {
    if (row.source !== 'collection') continue;
    const id = keyToNumber(row.matchKey);
    matches.add(id);
    if (row.itemKey === row.matchKey) wholes.add(id);
    else tracks.add(keyToNumber(row.itemKey));
  }
  const partials = new Set<number>();
  for (const id of matches) if (!wholes.has(id)) partials.add(id);
  return { matchIds: sorted(matches), trackIds: sorted(tracks), partialIds: sorted(partials) };
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
    const lists = fanMatchLists(fanRows);
    if (lists.matchIds.length === 0) continue;
    fanMatches.push({ fanId, ...lists });
    for (const id of lists.matchIds) owners.set(id, (owners.get(id) ?? 0) + 1);
  }
  return {
    fanMatches,
    matchOwners: [...owners].map(([matchId, count]) => ({ matchId, owners: count })),
  };
}
