// Dresses the stored twins leaderboard for display: names, avatars and profile links.

import { fanImageUrl, fanPageUrl } from '../../bandcamp';
import { countReadFans, getFans, getMe, getTwins, type DigheadDb } from '../../db';
import type { TwinRow, TwinsBasis, TwinsResult } from '../../shared/twins';

export async function readTwinsResult(db: DigheadDb): Promise<TwinsResult> {
  const [me, twins, fansRead] = await Promise.all([getMe(db), getTwins(db), countReadFans(db)]);
  const fans = await getFans(
    db,
    twins.map((twin) => twin.fanId),
  );

  const rows = twins.flatMap((twin, i): TwinRow[] => {
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
      },
    ];
  });

  const basis: TwinsBasis = !me ? 'no-viewer' : me.syncedAt === null ? 'unsynced' : 'ready';
  return { basis, rows, computedAt: twins[0]?.computedAt ?? null, fansRead };
}
