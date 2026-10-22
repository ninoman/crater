import { addOwnerDeltas, fanMatchLists } from '../matchIndex';
import type { DigheadDb, FanMatchesRecord } from '../schema';
import { fanRows } from './fanRows';

const EMPTY = new Float64Array();

/**
 * Recomputes the fans' match lists from their ownership rows and adjusts owner counts. Call it
 * inside the transaction that changed their rows, with ownership, fanMatches and matchOwners in
 * scope, so the index never drifts from `ownership`.
 */
export async function refreshFanMatches(db: DigheadDb, fanIds: Iterable<number>): Promise<void> {
  const ids = [...new Set(fanIds)];
  if (ids.length === 0) return;
  const [before, rows] = await Promise.all([
    db.fanMatches.bulkGet(ids),
    Promise.all(ids.map((fanId) => fanRows(db, fanId))),
  ]);

  const deltas = new Map<number, number>();
  const put: FanMatchesRecord[] = [];
  const emptied: number[] = [];
  for (const [i, fanId] of ids.entries()) {
    const lists = fanMatchLists(rows[i] ?? []);
    addOwnerDeltas(before[i]?.matchIds ?? EMPTY, lists.matchIds, deltas);
    if (lists.matchIds.length > 0) put.push({ fanId, ...lists });
    else if (before[i]) emptied.push(fanId);
  }
  await db.fanMatches.bulkPut(put);
  await db.fanMatches.bulkDelete(emptied);
  await applyOwnerDeltas(db, deltas);
}

async function applyOwnerDeltas(db: DigheadDb, deltas: Map<number, number>): Promise<void> {
  const changed = [...deltas].filter(([, delta]) => delta !== 0);
  if (changed.length === 0) return;
  const current = await db.matchOwners.bulkGet(changed.map(([id]) => id));
  const put = [];
  const gone: number[] = [];
  for (const [i, [matchId, delta]] of changed.entries()) {
    const owners = (current[i]?.owners ?? 0) + delta;
    if (owners > 0) put.push({ matchId, owners });
    else gone.push(matchId);
  }
  await db.matchOwners.bulkPut(put);
  await db.matchOwners.bulkDelete(gone);
}

/** How many fans' collections hold each match id. Ids nobody holds are left out. */
export async function getOwnerCounts(
  db: DigheadDb,
  matchIds: readonly number[],
): Promise<Map<number, number>> {
  const records = await db.matchOwners.bulkGet([...matchIds]);
  return new Map(records.flatMap((record) => (record ? [[record.matchId, record.owners]] : [])));
}
