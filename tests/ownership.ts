// Ownership rows for tests, written and read through the store as the code does (decisions §27).

import type { ItemKey } from '../src/bandcamp';
import {
  type CraterDb,
  editFans,
  fanRows,
  fanRowsFor,
  matchRows,
  type OwnershipRecord,
  ownershipTables,
  readOwnership,
  refreshFanMatches,
  type StoredOwnership,
} from '../src/db';

type Row = OwnershipRecord | StoredOwnership;

async function writeRows(db: CraterDb, rows: readonly Row[], index: boolean): Promise<void> {
  const byFan = new Map<number, OwnershipRecord[]>();
  for (const row of rows.map(readOwnership)) {
    byFan.set(row.fanId, [...(byFan.get(row.fanId) ?? []), row]);
  }
  await db.transaction('rw', [...ownershipTables(db), db.fanMatches, db.matchOwners], async () => {
    const changed = await editFans(db, byFan.keys(), (current, fanId) => {
      for (const row of byFan.get(fanId) ?? []) current.set(row.itemKey, row);
    });
    if (index) await refreshFanMatches(db, changed);
  });
}

/** Writes rows (replacing any under the same key) and refreshes the match index, as scans do. */
export const seedOwnership = (db: CraterDb, rows: readonly Row[]) => writeRows(db, rows, true);

/** Writes rows without touching the match index. */
export const putOwnershipRows = (db: CraterDb, rows: readonly Row[]) => writeRows(db, rows, false);

/** Deletes one row, without touching the match index. */
export async function deleteOwnershipRow(db: CraterDb, fanId: number, itemKey: ItemKey) {
  await db.transaction('rw', ownershipTables(db), () =>
    editFans(db, [fanId], (rows) => rows.delete(itemKey)),
  );
}

export async function ownershipRow(db: CraterDb, fanId: number, itemKey: ItemKey) {
  return (await fanRowsFor(db, fanId, [itemKey]))[0];
}

export async function countFanRows(db: CraterDb, fanId: number): Promise<number> {
  return (await fanRows(db, fanId)).length;
}

export async function countMatchRows(db: CraterDb, matchKey: ItemKey): Promise<number> {
  return (await matchRows(db, matchKey)).length;
}
