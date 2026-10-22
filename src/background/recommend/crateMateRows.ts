// Dresses the stored crate mates leaderboards for display: names, avatars, profile links and trends.

import { fanImageUrl, fanPageUrl } from '../../bandcamp';
import {
  countReadFans,
  followedFanIds,
  getFans,
  getLatelyCrateMates,
  getMe,
  getCrateMates,
  type DigheadDb,
  type MeRecord,
  type CrateMateRecord,
} from '../../db';
import { trendOf } from '../../scoring/lately';
import type {
  CrateMateBuy,
  CrateMateRow,
  CrateMatesBasis,
  CrateMatesResult,
} from '../../shared/crateMates';
import { readCrateMateBuys } from './crateMateBuys';

export async function readCrateMatesResult(
  db: DigheadDb,
  latelyHalfLifeMonths: number,
): Promise<CrateMatesResult> {
  const [me, crateMates, latelyCrateMates, fansRead, followed] = await Promise.all([
    getMe(db),
    getCrateMates(db),
    getLatelyCrateMates(db),
    countReadFans(db),
    followedFanIds(db),
  ]);
  const buys = await readCrateMateBuys(db, [
    ...new Set([...crateMates, ...latelyCrateMates].map((crateMate) => crateMate.fanId)),
  ]);
  return {
    basis: crateMatesBasis(me),
    rows: await crateMateRows(db, crateMates, followed, buys),
    latelyRows: await crateMateRows(db, latelyCrateMates, followed, buys),
    latelyHalfLifeMonths,
    computedAt: crateMates[0]?.computedAt ?? latelyCrateMates[0]?.computedAt ?? null,
    fansRead,
  };
}

/** One leaderboard's rows, ranked in the order given. */
async function crateMateRows(
  db: DigheadDb,
  crateMates: readonly CrateMateRecord[],
  followed: ReadonlySet<number>,
  buys: ReadonlyMap<number, CrateMateBuy[]>,
): Promise<CrateMateRow[]> {
  const fans = await getFans(
    db,
    crateMates.map((crateMate) => crateMate.fanId),
  );
  return crateMates.flatMap((crateMate, i): CrateMateRow[] => {
    const fan = fans[i];
    if (!fan) return [];
    return [
      {
        fanId: crateMate.fanId,
        rank: i + 1,
        username: fan.username,
        name: fan.name || fan.username,
        avatarUrl: fan.imageId === null ? null : fanImageUrl(fan.imageId),
        url: fanPageUrl(fan.username),
        overlap: crateMate.overlap,
        jaccard: crateMate.jaccard,
        score: crateMate.score,
        labelCluster: crateMate.labelCluster,
        followed: followed.has(crateMate.fanId),
        lately: crateMate.lately,
        latelyOverlap: crateMate.latelyOverlap,
        trend: trendOf(crateMate.lately, crateMate.yearAgo),
        recentBuys: buys.get(crateMate.fanId) ?? [],
      },
    ];
  });
}

/** Whether there's a synced collection of yours for crate mates to be worked out from. */
export function crateMatesBasis(me: MeRecord | undefined): CrateMatesBasis {
  return !me ? 'no-viewer' : me.syncedAt === null ? 'unsynced' : 'ready';
}
