// The background move of `ownership` rows into `fanOwnership` (decisions §27), one chunk per
// transaction so the worker can stop at any point and pick up where it left off. Scans and
// syncs keep running alongside: ownershipStore writes copied fans to both layouts.

import Dexie from 'dexie';
import type { ItemKey } from '../../bandcamp';
import { sortRows } from '../packedOwnership';
import type { CraterDb, OwnershipRecord } from '../schema';
import { readOwnership } from '../storage';
import { migrationState, ownershipTables, packedRowsOf, writePacked } from './ownershipStore';

/** Rows per transaction: about a second's work on a large database. */
export const MIGRATION_CHUNK = 20_000;

/** Copies or clears one chunk. False when there's nothing left to do. */
export async function migrateOwnershipStep(
  db: CraterDb,
  chunk = MIGRATION_CHUNK,
): Promise<boolean> {
  return db.transaction('rw', ownershipTables(db), async () => {
    const state = await migrationState(db);
    if (!state) return false;
    if (state.phase === 'copy') await copyChunk(db, state.after, chunk);
    else await clearChunk(db, state.after, chunk);
    return true;
  });
}

/** Copies whole fans after `after`. Once none are left, reads switch to the packed tables. */
async function copyChunk(db: CraterDb, after: number, chunk: number): Promise<void> {
  const stored = await db.ownership
    .where('[fanId+itemKey]')
    .above([after, Dexie.maxKey])
    .limit(chunk)
    .toArray();
  if (stored.length === 0) {
    await db.ownershipMigration.put({ id: 'state', phase: 'clear', after: null });
    return;
  }
  const byFan = new Map<number, OwnershipRecord[]>();
  for (const row of stored.map(readOwnership)) {
    const list = byFan.get(row.fanId);
    if (list) list.push(row);
    else byFan.set(row.fanId, [row]);
  }
  // The chunk may end partway through its last fan: leave them for the next one, unless they're
  // the only fan in it, in which case read all of theirs.
  const fanIds = [...byFan.keys()];
  const last = fanIds.at(-1) as number;
  if (stored.length === chunk) {
    if (fanIds.length > 1) byFan.delete(last);
    else {
      const all = await db.ownership
        .where('[fanId+itemKey]')
        .between([last, Dexie.minKey], [last, Dexie.maxKey])
        .toArray();
      byFan.set(last, all.map(readOwnership));
    }
  }
  for (const rows of byFan.values()) sortRows(rows);
  // Normally nothing is packed yet for these fans; diffing keeps a rerun from adding them twice.
  const before = await packedRowsOf(db, [...byFan.keys()]);
  await writePacked(db, before, byFan);
  await db.ownershipMigration.put({
    id: 'state',
    phase: 'copy',
    after: Math.max(...byFan.keys()),
  });
}

/** Deletes copied rows in key order, then marks the migration done. */
async function clearChunk(
  db: CraterDb,
  after: [number, ItemKey] | null,
  chunk: number,
): Promise<void> {
  const rows = after
    ? db.ownership.where('[fanId+itemKey]').above(after)
    : db.ownership.toCollection();
  const keys = await rows.limit(chunk).primaryKeys();
  if (keys.length === 0) {
    await db.ownershipMigration.delete('state');
    return;
  }
  await db.ownership.bulkDelete(keys);
  await db.ownershipMigration.put({
    id: 'state',
    phase: 'clear',
    after: keys.at(-1) as [number, ItemKey],
  });
}
