// Where one fan sits on your twins leaderboards, so a profile tab needn't download them.

import { getLatelyTwins, getTwins, type DigheadDb, type TwinRecord } from '../../db';
import type { TwinStanding } from '../../shared/twins';

function rankByFan(board: readonly TwinRecord[]): Map<number, number> {
  return new Map(board.map((twin, i) => [twin.fanId, i + 1]));
}

/**
 * Both boards must be best first, as `getTwins` and `getLatelyTwins` return them. Fans on neither
 * are left out. Overlap and match are the same pair's numbers on either board.
 */
export function twinStandings(
  twins: readonly TwinRecord[],
  latelyTwins: readonly TwinRecord[],
  fanIds: readonly number[],
): Record<number, TwinStanding> {
  const ranks = rankByFan(twins);
  const latelyRanks = rankByFan(latelyTwins);
  const records = new Map([...latelyTwins, ...twins].map((twin) => [twin.fanId, twin]));
  const standings: Record<number, TwinStanding> = {};
  for (const fanId of fanIds) {
    const twin = records.get(fanId);
    if (!twin) continue;
    standings[fanId] = {
      rank: ranks.get(fanId) ?? null,
      latelyRank: latelyRanks.get(fanId) ?? null,
      overlap: twin.overlap,
      matchPct: twin.jaccard * 100,
    };
  }
  return standings;
}

export function twinStanding(
  twins: readonly TwinRecord[],
  latelyTwins: readonly TwinRecord[],
  fanId: number,
): TwinStanding | null {
  return twinStandings(twins, latelyTwins, [fanId])[fanId] ?? null;
}

async function readBoards(db: DigheadDb): Promise<[TwinRecord[], TwinRecord[]]> {
  return Promise.all([getTwins(db), getLatelyTwins(db)]);
}

export async function getTwinStandings(
  db: DigheadDb,
  fanIds: readonly number[],
): Promise<Record<number, TwinStanding>> {
  const [twins, latelyTwins] = await readBoards(db);
  return twinStandings(twins, latelyTwins, fanIds);
}

export async function getTwinStanding(db: DigheadDb, fanId: number): Promise<TwinStanding | null> {
  const [twins, latelyTwins] = await readBoards(db);
  return twinStanding(twins, latelyTwins, fanId);
}
