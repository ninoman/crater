import type { CraterDb } from '../schema';

/** Empties every table, in one transaction so nothing is left half-cleared. */
export async function clearAllData(db: CraterDb): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
