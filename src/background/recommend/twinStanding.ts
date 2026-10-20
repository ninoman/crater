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

export async function getTwinStanding(db: DigheadDb, fanId: number): Promise<TwinStanding | null> {
  return twinStanding(await getTwins(db), fanId);
}
