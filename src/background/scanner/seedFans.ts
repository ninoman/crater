// The seed backlog goes horizontal (decisions §5): every seed supporter list first, then their
// fans in one order across all your releases. Free: no requests.

import {
  followedFanIds,
  gatherSeedFans,
  getMe,
  hasDueJob,
  rankFanJobs,
  waitingFans,
  type CraterDb,
} from '../../db';
import { followedFirst } from '../../scoring/following';
import { seedFanOrder } from '../../scoring/supporterRank';
import { supporters, weight } from '../../scoring/weights';
import { SEED, SEED_FANS } from './priority';

/**
 * Ranks the seed fans waiting to start, once no other seed list is due. `except` is the release
 * job that just finished its list and is still queued. A list waiting on a retry doesn't hold
 * the backlog up: it ranks again when it lands.
 */
export async function rankSeedFansOnceListed(
  db: CraterDb,
  now: number,
  except?: number,
): Promise<void> {
  if (await hasDueJob(db, 'release', SEED, now, except)) return;
  await rankSeedFans(db);
}

/** Fans you follow first (decisions §16), then the seed order. */
async function rankSeedFans(db: CraterDb): Promise<void> {
  const fanIds = await waitingFans(db, SEED_FANS);
  if (fanIds.length === 0) return;
  const me = await getMe(db);
  const basis = await gatherSeedFans(db, me?.fanId ?? null, fanIds);
  const weights = new Map(
    [...basis.counts].map(([id, count]) => [id, weight(supporters([count.bandcamp], count.known))]),
  );
  const order = followedFirst(seedFanOrder({ ...basis, weights }), await followedFanIds(db));
  await rankFanJobs(db, new Map(order.map((fanId, i) => [fanId, i + 1])));
}
