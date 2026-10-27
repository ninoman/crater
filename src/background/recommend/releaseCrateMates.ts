// "Crate mates who own this": your crate mates among the fans who own a release, in leaderboard order.

import { fanPageUrl, type ItemKey } from '../../bandcamp';
import { collectorsOf, getFans, getCrateMates, type CraterDb } from '../../db';
import type { ReleaseCrateMateRow, ReleaseCrateMatesResult } from '../../shared/releaseCrateMates';

export async function computeReleaseCrateMates(
  db: CraterDb,
  releaseKey: ItemKey,
): Promise<ReleaseCrateMatesResult> {
  const [crateMates, collectors] = await Promise.all([
    getCrateMates(db),
    collectorsOf(db, releaseKey),
  ]);
  const owning = crateMates
    .map((crateMate, i) => ({ crateMate, rank: i + 1 }))
    .filter(({ crateMate }) => collectors.has(crateMate.fanId));
  const fans = await getFans(
    db,
    owning.map(({ crateMate }) => crateMate.fanId),
  );
  const rows = owning.flatMap(({ crateMate, rank }, i): ReleaseCrateMateRow[] => {
    const fan = fans[i];
    if (!fan) return [];
    return [
      {
        fanId: crateMate.fanId,
        rank,
        name: fan.name || fan.username,
        profileUrl: fanPageUrl(fan.username),
        overlap: crateMate.overlap,
        labelCluster: crateMate.labelCluster,
      },
    ];
  });
  return { releaseKey, rows, crateMateCount: crateMates.length };
}
