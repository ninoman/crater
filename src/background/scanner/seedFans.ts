// The seed backlog goes horizontal (decisions §5): every seed supporter list first, then their
// fans in one order across all your releases. Free: no requests.

import {
  followedFanIds,
  gatherSeedFans,
  getMe,
  hasDueJob,
  promoteFans,
  rankFanJobs,
  waitingFans,
  type CraterDb,
} from '../../db';
import { followedFirst } from '../../scoring/following';
import { seedFanOrder } from '../../scoring/supporterRank';
import { supporters, weight } from '../../scoring/weights';
import { FIRST_FANS_AFTER_LISTS } from '../../shared/scanEta';
import { SEED, SEED_FANS, SEED_FIRST_FANS } from './priority';

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

/** How many fans are read ahead. */
export const FIRST_FANS = 60;

/**
 * Moves the top seed fans so far ahead of the unread lists, once, as the list count passes
 * `FIRST_FANS_AFTER_LISTS`. Collections too small to need it are left alone.
 */
export async function promoteFirstSeedFans(
  db: CraterDb,
  lists: { scanned: number; total: number },
): Promise<void> {
  if (lists.scanned !== FIRST_FANS_AFTER_LISTS || lists.total <= FIRST_FANS_AFTER_LISTS) return;
  const order = await seedFanRanking(db);
  await promoteFans(db, order.slice(0, FIRST_FANS), SEED_FIRST_FANS);
}

/** Fans you follow first (decisions §16), then the seed order. */
async function rankSeedFans(db: CraterDb): Promise<void> {
  const order = await seedFanRanking(db);
  await rankFanJobs(db, new Map(order.map((fanId, i) => [fanId, i + 1])));
}

/** The waiting seed fans, best first. */
async function seedFanRanking(db: CraterDb): Promise<number[]> {
  const fanIds = await waitingFans(db, SEED_FANS);
  if (fanIds.length === 0) return [];
  const me = await getMe(db);
  const basis = await gatherSeedFans(db, me?.fanId ?? null, fanIds);
  const weights = new Map(
    [...basis.counts].map(([id, count]) => [id, weight(supporters([count.bandcamp], count.known))]),
  );
  return followedFirst(seedFanOrder({ ...basis, weights }), await followedFanIds(db));
}
