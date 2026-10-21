// Pass 0 (decisions §12): once a release's supporter list is in, order their scans by what we
// already know they own of yours. Free: no requests.

import type { ItemKey } from '../../bandcamp';
import { gatherPassZero, getMe, rankFanJobs, type DigheadDb } from '../../db';
import { passZeroOrder } from '../../scoring/supporterRank';
import { supporters, weight } from '../../scoring/weights';

/** Ranks the release's queued, not-yet-started fan jobs, best expected overlap first. */
export async function rankSupporters(db: DigheadDb, releaseKey: ItemKey): Promise<void> {
  const me = await getMe(db);
  const basis = await gatherPassZero(db, releaseKey, me?.fanId ?? null);
  if (!basis) return;
  const weights = new Map(
    [...basis.counts].map(([id, count]) => [id, weight(supporters([count.bandcamp], count.known))]),
  );
  const order = passZeroOrder({ ...basis, weights });
  // Ranks start at 1: a release job (rank 0) in the same place in line goes first.
  await rankFanJobs(db, new Map(order.map((fanId, i) => [fanId, i + 1])));
}
