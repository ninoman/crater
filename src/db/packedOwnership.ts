// Ownership rows packed one record per fan, and the per-matchKey lists derived from them
// (decisions §27). Pure; repo/ownershipStore.ts does the reads and writes.

import { type ItemKey, keyFromNumber, keyToNumber } from '../bandcamp';
import type { FanOwnershipRecord, MatchOwnershipRecord, OwnershipRecord } from './schema';

/** One fan's collection row under a matchKey: an entry of a MatchOwnershipRecord. */
export interface MatchEntry {
  fanId: number;
  itemKey: ItemKey;
}

/** Entries to take out of and put into one matchKey's list. */
export interface MatchDelta {
  remove: MatchEntry[];
  add: MatchEntry[];
}

const compareKeys = (a: ItemKey, b: ItemKey) => (a < b ? -1 : a > b ? 1 : 0);

/** A fan's rows in itemKey order, the order IndexedDB returned `ownership` rows in. */
export function sortRows(rows: OwnershipRecord[]): OwnershipRecord[] {
  return rows.sort((a, b) => compareKeys(a.itemKey, b.itemKey));
}

/** `[fanId+itemKey]` order, the order the `ownership.matchKey` index returned rows in. */
function compareEntries(a: MatchEntry, b: MatchEntry): number {
  return a.fanId - b.fanId || compareKeys(a.itemKey, b.itemKey);
}

/** One fan's rows, sorted, as a record. Null for a fan with no rows. */
export function packFan(
  fanId: number,
  rows: readonly OwnershipRecord[],
): FanOwnershipRecord | null {
  if (rows.length === 0) return null;
  const record: FanOwnershipRecord = {
    fanId,
    itemIds: Float64Array.from(rows, (row) => keyToNumber(row.itemKey)),
    matchIds: Float64Array.from(rows, (row) => keyToNumber(row.matchKey)),
    addedAt: Float64Array.from(rows, (row) => row.addedAt ?? Number.NaN),
  };
  const wishlist = rows.filter((row) => row.source === 'wishlist');
  if (wishlist.length > 0) {
    record.wishlistIds = Float64Array.from(wishlist, (row) => keyToNumber(row.itemKey));
  }
  return record;
}

export function unpackFan(record: FanOwnershipRecord): OwnershipRecord[] {
  const wishlist = new Set(record.wishlistIds ?? []);
  return Array.from(record.itemIds, (itemId, i) => {
    const addedAt = record.addedAt[i] as number;
    return {
      fanId: record.fanId,
      itemKey: keyFromNumber(itemId),
      matchKey: keyFromNumber(record.matchIds[i] as number),
      source: wishlist.has(itemId) ? 'wishlist' : 'collection',
      addedAt: Number.isNaN(addedAt) ? null : addedAt,
    };
  });
}

export function unpackMatch(record: MatchOwnershipRecord): MatchEntry[] {
  return Array.from(record.fanIds, (fanId, i) => ({
    fanId,
    itemKey: keyFromNumber(record.itemIds[i] as number),
  }));
}

/** Whether two sorted row lists hold the same rows. */
export function sameRows(a: readonly OwnershipRecord[], b: readonly OwnershipRecord[]): boolean {
  return (
    a.length === b.length &&
    a.every((row, i) => {
      const other = b[i] as OwnershipRecord;
      return (
        row.itemKey === other.itemKey &&
        row.matchKey === other.matchKey &&
        row.source === other.source &&
        row.addedAt === other.addedAt
      );
    })
  );
}

/** A fan's collection rows by `matchKey itemKey`. Wishlists aren't in the match lists. */
function collectionEntries(rows: readonly OwnershipRecord[]): Map<string, OwnershipRecord> {
  const entries = new Map<string, OwnershipRecord>();
  for (const row of rows) {
    if (row.source === 'collection') entries.set(`${row.matchKey} ${row.itemKey}`, row);
  }
  return entries;
}

function deltaFor(deltas: Map<number, MatchDelta>, matchKey: ItemKey): MatchDelta {
  const id = keyToNumber(matchKey);
  let delta = deltas.get(id);
  if (!delta) {
    delta = { remove: [], add: [] };
    deltas.set(id, delta);
  }
  return delta;
}

/** Adds the match-list changes of one fan's rows going from `before` to `after`. */
export function addMatchDeltas(
  fanId: number,
  before: readonly OwnershipRecord[],
  after: readonly OwnershipRecord[],
  deltas: Map<number, MatchDelta>,
): void {
  const old = collectionEntries(before);
  const next = collectionEntries(after);
  for (const [key, row] of old) {
    if (!next.has(key)) deltaFor(deltas, row.matchKey).remove.push({ fanId, itemKey: row.itemKey });
  }
  for (const [key, row] of next) {
    if (!old.has(key)) deltaFor(deltas, row.matchKey).add.push({ fanId, itemKey: row.itemKey });
  }
}

/** A matchKey's list with a delta applied. Null when nobody is left on it. */
export function applyMatchDelta(
  matchId: number,
  record: MatchOwnershipRecord | undefined,
  delta: MatchDelta,
): MatchOwnershipRecord | null {
  const id = (entry: MatchEntry) => `${entry.fanId} ${entry.itemKey}`;
  const gone = new Set(delta.remove.map(id));
  const entries = (record ? unpackMatch(record) : []).filter((entry) => !gone.delete(id(entry)));
  const present = new Set(entries.map(id));
  for (const entry of delta.add) {
    if (!present.has(id(entry))) {
      present.add(id(entry));
      entries.push(entry);
    }
  }
  if (entries.length === 0) return null;
  entries.sort(compareEntries);
  return {
    matchId,
    fanIds: Float64Array.from(entries, (entry) => entry.fanId),
    itemIds: Float64Array.from(entries, (entry) => keyToNumber(entry.itemKey)),
  };
}

/** Both packed tables from plain rows: for seeding test and benchmark databases. */
export function buildPackedOwnership(rows: Iterable<OwnershipRecord>): {
  fanOwnership: FanOwnershipRecord[];
  matchOwnership: MatchOwnershipRecord[];
} {
  const byFan = new Map<number, OwnershipRecord[]>();
  for (const row of rows) {
    const list = byFan.get(row.fanId);
    if (list) list.push(row);
    else byFan.set(row.fanId, [row]);
  }
  const fanOwnership: FanOwnershipRecord[] = [];
  const deltas = new Map<number, MatchDelta>();
  for (const [fanId, fanRows] of byFan) {
    const sorted = sortRows(fanRows);
    const record = packFan(fanId, sorted);
    if (record) fanOwnership.push(record);
    addMatchDeltas(fanId, [], sorted, deltas);
  }
  const matchOwnership = [...deltas].flatMap(([matchId, delta]) => {
    const record = applyMatchDelta(matchId, undefined, delta);
    return record ? [record] : [];
  });
  return { fanOwnership, matchOwnership };
}
