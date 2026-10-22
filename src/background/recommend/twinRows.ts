// Dresses the stored twins leaderboards for display: names, avatars, profile links and trends.

import { fanImageUrl, fanPageUrl } from '../../bandcamp';
import {
  countReadFans,
  followedFanIds,
  getFans,
  getLatelyTwins,
  getMe,
  getTwins,
  type DigheadDb,
  type MeRecord,
  type TwinRecord,
} from '../../db';
import { trendOf } from '../../scoring/lately';
import type { TwinBuy, TwinRow, TwinsBasis, TwinsResult } from '../../shared/twins';
import { readTwinBuys } from './twinBuys';

export async function readTwinsResult(
  db: DigheadDb,
  latelyHalfLifeMonths: number,
): Promise<TwinsResult> {
  const [me, twins, latelyTwins, fansRead, followed] = await Promise.all([
    getMe(db),
    getTwins(db),
    getLatelyTwins(db),
    countReadFans(db),
    followedFanIds(db),
  ]);
  const buys = await readTwinBuys(db, [
    ...new Set([...twins, ...latelyTwins].map((twin) => twin.fanId)),
  ]);
  return {
    basis: twinsBasis(me),
    rows: await twinRows(db, twins, followed, buys),
    latelyRows: await twinRows(db, latelyTwins, followed, buys),
    latelyHalfLifeMonths,
    computedAt: twins[0]?.computedAt ?? latelyTwins[0]?.computedAt ?? null,
    fansRead,
  };
}

/** One leaderboard's rows, ranked in the order given. */
async function twinRows(
  db: DigheadDb,
  twins: readonly TwinRecord[],
  followed: ReadonlySet<number>,
  buys: ReadonlyMap<number, TwinBuy[]>,
): Promise<TwinRow[]> {
  const fans = await getFans(
    db,
    twins.map((twin) => twin.fanId),
  );
  return twins.flatMap((twin, i): TwinRow[] => {
    const fan = fans[i];
    if (!fan) return [];
    return [
      {
        fanId: twin.fanId,
        rank: i + 1,
        username: fan.username,
        name: fan.name || fan.username,
        avatarUrl: fan.imageId === null ? null : fanImageUrl(fan.imageId),
        url: fanPageUrl(fan.username),
        overlap: twin.overlap,
        jaccard: twin.jaccard,
        score: twin.score,
        labelCluster: twin.labelCluster,
        followed: followed.has(twin.fanId),
        lately: twin.lately,
        latelyOverlap: twin.latelyOverlap,
        trend: trendOf(twin.lately, twin.yearAgo),
        recentBuys: buys.get(twin.fanId) ?? [],
      },
    ];
  });
}

/** Whether there's a synced collection of yours for twins to be worked out from. */
export function twinsBasis(me: MeRecord | undefined): TwinsBasis {
  return !me ? 'no-viewer' : me.syncedAt === null ? 'unsynced' : 'ready';
}
