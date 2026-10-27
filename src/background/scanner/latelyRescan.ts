// Re-reads your top lately crate mates' newest purchases more often than the 30-day re-scan, so the
// Lately board and Crate mates' latest see what they bought this week (decisions §11).

import {
  collectionFullyRead,
  enqueueLatestReads,
  getFans,
  getLatelyCrateMates,
  queuedFans,
  type CraterDb,
  type FanRecord,
  type LatestRead,
} from '../../db';
import type { Settings } from '../../shared/settings';
import { LATELY_RESCAN } from './priority';

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * A latest read goes back this far before the last read, so a purchase Bandcamp dated just
 * before it, but listed after, isn't missed.
 */
export const LATEST_READ_OVERLAP_MS = DAY_MS;

/** One place on the lately board, with what we know of that fan. */
export interface RescanCandidate {
  fanId: number;
  fan: Pick<FanRecord, 'status' | 'collectionFetchedAt'> | undefined;
}

/**
 * The crate mates due a latest read, best first: the top `count` of the lately board whose collection
 * was fully read at least `days` ago, and who have nothing queued already (a queued scan reads
 * their newest purchases anyway).
 */
export function pickLatelyRescans(
  board: readonly RescanCandidate[],
  queued: ReadonlySet<number>,
  now: number,
  {
    latelyRescanCrateMates,
    latelyRescanDays,
  }: Pick<Settings, 'latelyRescanCrateMates' | 'latelyRescanDays'>,
): LatestRead[] {
  return board.slice(0, latelyRescanCrateMates).flatMap(({ fanId, fan }): LatestRead[] => {
    const at = fan?.collectionFetchedAt ?? null;
    if (queued.has(fanId) || !collectionFullyRead(fan?.status) || at === null) return [];
    if (now - at < latelyRescanDays * DAY_MS) return [];
    return [{ fanId, since: at - LATEST_READ_OVERLAP_MS }];
  });
}

/** Queues the latest reads that are due. Returns how many were queued. */
export async function queueLatelyRescans(
  db: CraterDb,
  settings: Settings,
  now: number,
): Promise<number> {
  if (settings.latelyRescanCrateMates === 0) return 0;
  const top = (await getLatelyCrateMates(db)).slice(0, settings.latelyRescanCrateMates);
  const fanIds = top.map((crateMate) => crateMate.fanId);
  const [fans, queued] = await Promise.all([getFans(db, fanIds), queuedFans(db, fanIds)]);
  const board = fanIds.map((fanId, i) => ({ fanId, fan: fans[i] }));
  return enqueueLatestReads(
    db,
    pickLatelyRescans(board, queued, now, settings),
    LATELY_RESCAN,
    now,
  );
}
