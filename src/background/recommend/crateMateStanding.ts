// Where one fan sits on your crate mates leaderboards, so a profile tab needn't download them.

import { getLatelyCrateMates, getCrateMates, type DigheadDb, type CrateMateRecord } from '../../db';
import type { CrateMateStanding } from '../../shared/crateMates';

function rankByFan(board: readonly CrateMateRecord[]): Map<number, number> {
  return new Map(board.map((crateMate, i) => [crateMate.fanId, i + 1]));
}

/**
 * Both boards must be best first, as `getCrateMates` and `getLatelyCrateMates` return them. Fans on neither
 * are left out. Overlap and match are the same pair's numbers on either board.
 */
export function crateMateStandings(
  crateMates: readonly CrateMateRecord[],
  latelyCrateMates: readonly CrateMateRecord[],
  fanIds: readonly number[],
): Record<number, CrateMateStanding> {
  const ranks = rankByFan(crateMates);
  const latelyRanks = rankByFan(latelyCrateMates);
  const records = new Map(
    [...latelyCrateMates, ...crateMates].map((crateMate) => [crateMate.fanId, crateMate]),
  );
  const standings: Record<number, CrateMateStanding> = {};
  for (const fanId of fanIds) {
    const crateMate = records.get(fanId);
    if (!crateMate) continue;
    standings[fanId] = {
      rank: ranks.get(fanId) ?? null,
      latelyRank: latelyRanks.get(fanId) ?? null,
      overlap: crateMate.overlap,
      matchPct: crateMate.jaccard * 100,
    };
  }
  return standings;
}

export function crateMateStanding(
  crateMates: readonly CrateMateRecord[],
  latelyCrateMates: readonly CrateMateRecord[],
  fanId: number,
): CrateMateStanding | null {
  return crateMateStandings(crateMates, latelyCrateMates, [fanId])[fanId] ?? null;
}

async function readBoards(db: DigheadDb): Promise<[CrateMateRecord[], CrateMateRecord[]]> {
  return Promise.all([getCrateMates(db), getLatelyCrateMates(db)]);
}

export async function getCrateMateStandings(
  db: DigheadDb,
  fanIds: readonly number[],
): Promise<Record<number, CrateMateStanding>> {
  const [crateMates, latelyCrateMates] = await readBoards(db);
  return crateMateStandings(crateMates, latelyCrateMates, fanIds);
}

export async function getCrateMateStanding(
  db: DigheadDb,
  fanId: number,
): Promise<CrateMateStanding | null> {
  const [crateMates, latelyCrateMates] = await readBoards(db);
  return crateMateStanding(crateMates, latelyCrateMates, fanId);
}
