// "Twins who own this": your taste twins among the fans who own a release, in leaderboard order.

import { fanPageUrl, type ItemKey } from '../../bandcamp';
import { collectorsOf, getFans, getTwins, type DigheadDb } from '../../db';
import type { ReleaseTwinRow, ReleaseTwinsResult } from '../../shared/releaseTwins';

export async function computeReleaseTwins(
  db: DigheadDb,
  releaseKey: ItemKey,
): Promise<ReleaseTwinsResult> {
  const [twins, collectors] = await Promise.all([getTwins(db), collectorsOf(db, releaseKey)]);
  const owning = twins
    .map((twin, i) => ({ twin, rank: i + 1 }))
    .filter(({ twin }) => collectors.has(twin.fanId));
  const fans = await getFans(
    db,
    owning.map(({ twin }) => twin.fanId),
  );
  const rows = owning.flatMap(({ twin, rank }, i): ReleaseTwinRow[] => {
    const fan = fans[i];
    if (!fan) return [];
    return [
      {
        fanId: twin.fanId,
        rank,
        name: fan.name || fan.username,
        profileUrl: fanPageUrl(fan.username),
        overlap: twin.overlap,
        labelCluster: twin.labelCluster,
      },
    ];
  });
  return { releaseKey, rows, twinCount: twins.length };
}
