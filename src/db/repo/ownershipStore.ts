// Every read and write of ownership rows (decisions §27). They live packed in `fanOwnership`, with
// `matchOwnership` standing in for the old `matchKey` index. While the background migration is
// still copying old `ownership` rows, reads use those and writes go to both: to `ownership`
// always, and to the packed tables for fans already copied, so the copy never falls behind.

import Dexie from 'dexie';
import { type ItemKey, keyToNumber } from '../../bandcamp';
import {
  addMatchDeltas,
  applyMatchDelta,
  type MatchDelta,
  type MatchEntry,
  packFan,
  sameRows,
  sortRows,
  unpackFan,
  unpackMatch,
} from '../packedOwnership';
import type { CraterDb, OwnershipMigration, OwnershipRecord } from '../schema';
import { readOwnership, storeOwnership } from '../storage';

/** The tables every ownership read or write needs in its transaction. */
export function ownershipTables(db: CraterDb) {
  return [db.ownership, db.fanOwnership, db.matchOwnership, db.ownershipMigration];
}

export function migrationState(db: CraterDb): Promise<OwnershipMigration | undefined> {
  return db.ownershipMigration.get('state');
}

/** Rows are read from `ownership` until every fan is copied. */
const readsOld = (state: OwnershipMigration | undefined) => state?.phase === 'copy';

/** Runs `read` in a transaction over the ownership tables, joining the caller's if there is one. */
function reading<T>(db: CraterDb, read: (old: boolean) => Promise<T>): Promise<T> {
  return db.transaction('r', ownershipTables(db), async () =>
    read(readsOld(await migrationState(db))),
  );
}

function oldFanRows(db: CraterDb, fanId: number) {
  return db.ownership
    .where('[fanId+itemKey]')
    .between([fanId, Dexie.minKey], [fanId, Dexie.maxKey]);
}

async function rowsOf(
  db: CraterDb,
  fanIds: readonly number[],
  old: boolean,
): Promise<Map<number, OwnershipRecord[]>> {
  const lists = old
    ? await Promise.all(
        fanIds.map(async (fanId) => (await oldFanRows(db, fanId).toArray()).map(readOwnership)),
      )
    : (await db.fanOwnership.bulkGet([...fanIds])).map((record) =>
        record ? unpackFan(record) : [],
      );
  return new Map(fanIds.map((fanId, i) => [fanId, lists[i] ?? []]));
}

/** Every row of a fan's, collection and wishlist, in itemKey order. */
export function fanRows(db: CraterDb, fanId: number): Promise<OwnershipRecord[]> {
  return reading(db, async (old) => (await rowsOf(db, [fanId], old)).get(fanId) ?? []);
}

/** A fan's rows for these items, in order; undefined where they have none. */
export function fanRowsFor(
  db: CraterDb,
  fanId: number,
  itemKeys: readonly ItemKey[],
): Promise<(OwnershipRecord | undefined)[]> {
  return reading(db, async (old) => {
    if (old) {
      const rows = await db.ownership.bulkGet(
        itemKeys.map((key): [number, ItemKey] => [fanId, key]),
      );
      return rows.map((row) => (row ? readOwnership(row) : undefined));
    }
    const record = await db.fanOwnership.get(fanId);
    const byKey = new Map((record ? unpackFan(record) : []).map((row) => [row.itemKey, row]));
    return itemKeys.map((key) => byKey.get(key));
  });
}

/**
 * The collection rows under a matchKey, in `[fanId+itemKey]` order: track buyers and album buyers
 * alike. Wishlists aren't included.
 */
export function matchRows(db: CraterDb, matchKey: ItemKey): Promise<MatchEntry[]> {
  return reading(db, async (old) => {
    if (old) {
      const rows = await db.ownership.where('matchKey').equals(matchKey).toArray();
      return rows
        .map(readOwnership)
        .flatMap((row) =>
          row.source === 'collection' ? [{ fanId: row.fanId, itemKey: row.itemKey }] : [],
        );
    }
    const record = await db.matchOwnership.get(keyToNumber(matchKey));
    return record ? unpackMatch(record) : [];
  });
}

/** Edits a fan's rows in place, keyed by itemKey. */
export type RowEdit = (rows: Map<ItemKey, OwnershipRecord>, fanId: number) => void;

/**
 * Applies `edit` to each fan's rows and stores what changed. Returns the new rows of the fans
 * that changed, for the match index refresh. Call inside a write transaction over
 * ownershipTables.
 */
export async function editFans(
  db: CraterDb,
  fanIds: Iterable<number>,
  edit: RowEdit,
): Promise<Map<number, OwnershipRecord[]>> {
  const ids = [...new Set(fanIds)];
  const changed = new Map<number, OwnershipRecord[]>();
  if (ids.length === 0) return changed;
  const state = await migrationState(db);
  const old = readsOld(state);
  const before = await rowsOf(db, ids, old);
  for (const fanId of ids) {
    const rows = before.get(fanId) ?? [];
    const edited = new Map(rows.map((row) => [row.itemKey, row]));
    edit(edited, fanId);
    const after = sortRows([...edited.values()]);
    if (!sameRows(rows, after)) changed.set(fanId, after);
  }
  if (changed.size === 0) return changed;

  if (old) await writeOld(db, before, changed);
  // While copying, only fans already copied are kept in step; the copy picks up the rest.
  const packed =
    state?.phase === 'copy'
      ? new Map([...changed].filter(([fanId]) => fanId <= state.after))
      : changed;
  await writePacked(db, before, packed);
  return changed;
}

async function writeOld(
  db: CraterDb,
  before: Map<number, OwnershipRecord[]>,
  after: Map<number, OwnershipRecord[]>,
): Promise<void> {
  const put: OwnershipRecord[] = [];
  const gone: [number, ItemKey][] = [];
  for (const [fanId, rows] of after) {
    const kept = new Map(rows.map((row) => [row.itemKey, row]));
    for (const row of before.get(fanId) ?? []) {
      const next = kept.get(row.itemKey);
      if (!next) gone.push([fanId, row.itemKey]);
      else if (sameRows([row], [next])) kept.delete(row.itemKey);
    }
    put.push(...kept.values());
  }
  await db.ownership.bulkDelete(gone);
  await db.ownership.bulkPut(put.map(storeOwnership));
}

/** Stores fans' new rows packed, and moves their entries in the matchKey lists. */
export async function writePacked(
  db: CraterDb,
  before: Map<number, OwnershipRecord[]>,
  after: Map<number, OwnershipRecord[]>,
): Promise<void> {
  if (after.size === 0) return;
  const deltas = new Map<number, MatchDelta>();
  const put = [];
  const emptied: number[] = [];
  for (const [fanId, rows] of after) {
    addMatchDeltas(fanId, before.get(fanId) ?? [], rows, deltas);
    const record = packFan(fanId, rows);
    if (record) put.push(record);
    else emptied.push(fanId);
  }
  await db.fanOwnership.bulkPut(put);
  await db.fanOwnership.bulkDelete(emptied);

  const ids = [...deltas.keys()];
  const current = await db.matchOwnership.bulkGet(ids);
  const lists = [];
  const gone: number[] = [];
  for (const [i, matchId] of ids.entries()) {
    const list = applyMatchDelta(matchId, current[i], deltas.get(matchId) as MatchDelta);
    if (list) lists.push(list);
    else gone.push(matchId);
  }
  await db.matchOwnership.bulkPut(lists);
  await db.matchOwnership.bulkDelete(gone);
}

/** The packed rows of these fans, for the migration to diff against. */
export function packedRowsOf(db: CraterDb, fanIds: readonly number[]) {
  return rowsOf(db, fanIds, false);
}
