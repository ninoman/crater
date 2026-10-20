// Where one fan sits on your twins leaderboard, so a profile tab needn't download the board.

import { getTwins, type DigheadDb, type TwinRecord } from '../../db';
import type { TwinStanding } from '../../shared/twins';

/** `twins` must be best first, as `getTwins` returns them. Null for a fan who isn't on it. */
export function twinStanding(twins: readonly TwinRecord[], fanId: number): TwinStanding | null {
  const i = twins.findIndex((twin) => twin.fanId === fanId);
  const twin = twins[i];
  if (!twin) return null;
  return { rank: i + 1, overlap: twin.overlap, matchPct: twin.jaccard * 100 };
}

/** `twinStanding` for many fans at once, indexing the board a single time. */
export function twinStandings(
  twins: readonly TwinRecord[],
  fanIds: readonly number[],
): Record<number, TwinStanding> {
  const wanted = new Set(fanIds);
  const standings: Record<number, TwinStanding> = {};
  twins.forEach((twin, i) => {
    if (wanted.has(twin.fanId)) {
      standings[twin.fanId] = { rank: i + 1, overlap: twin.overlap, matchPct: twin.jaccard * 100 };
    }
  });
  return standings;
}

export async function getTwinStandings(
  db: DigheadDb,
  fanIds: readonly number[],
): Promise<Record<number, TwinStanding>> {
  return twinStandings(await getTwins(db), fanIds);
}

export async function getTwinStanding(db: DigheadDb, fanId: number): Promise<TwinStanding | null> {
  return twinStanding(await getTwins(db), fanId);
}
