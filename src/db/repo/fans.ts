import type { ItemKey, Supporter } from '../../bandcamp';
import { fanFromSupporter } from '../mappers';
import type { DigheadDb, FanRecord, FanStatus } from '../schema';
import { refreshFanMatches } from './matchIndex';

const READ_STATUSES: FanStatus[] = ['done', 'partial'];

/** Fans whose collection we've actually read. Private and failed fans own nothing we can see. */
export function collectionRead(status: FanStatus | undefined): boolean {
  return status !== undefined && READ_STATUSES.includes(status);
}

/**
 * Records fans seen in a supporter list. New fans start `queued`; known fans only get their
 * name, avatar and last-seen time refreshed, keeping their scan state.
 */
export async function upsertSupporterFans(
  db: DigheadDb,
  supporters: Supporter[],
  now: number,
): Promise<FanRecord[]> {
  return db.transaction('rw', db.fans, async () => {
    const existing = await db.fans.bulkGet(supporters.map((s) => s.fanId));
    const records = supporters.map((supporter, i): FanRecord => {
      const fresh = fanFromSupporter(supporter, now);
      const old = existing[i];
      return old
        ? {
            ...old,
            username: fresh.username,
            name: fresh.name,
            imageId: fresh.imageId,
            lastSeenAt: now,
          }
        : fresh;
    });
    await db.fans.bulkPut(records);
    return records;
  });
}

/** How many fans' collections we've read: the pool twins and Also bought draw from. */
export function countReadFans(db: DigheadDb): Promise<number> {
  return db.fans.where('status').anyOf(READ_STATUSES).count();
}

export function getFan(db: DigheadDb, fanId: number): Promise<FanRecord | undefined> {
  return db.fans.get(fanId);
}

export async function getFans(db: DigheadDb, fanIds: number[]): Promise<(FanRecord | undefined)[]> {
  return db.fans.bulkGet(fanIds);
}

/**
 * Ends a fan's scan. Every outcome but `error` counts as a fresh read, so the fan isn't
 * fetched again for a while. Only a full read tells us the collection size.
 */
export async function finishFanScan(
  db: DigheadDb,
  fanId: number,
  status: Exclude<FanStatus, 'queued'>,
  scannedItems: number,
  now: number,
): Promise<void> {
  if (status === 'error') {
    await db.fans.update(fanId, { status, lastSeenAt: now });
    return;
  }
  await db.fans.update(fanId, {
    status,
    lastSeenAt: now,
    scannedItems,
    collectionFetchedAt: now,
    ...(status === 'done' ? { collectionSize: scannedItems } : {}),
  });
}

/** What a fan's profile page told us (pass 1, decisions §12). */
export async function saveFanProfile(
  db: DigheadDb,
  fanId: number,
  profile: Pick<FanRecord, 'itemCount' | 'inCommon'>,
): Promise<void> {
  await db.fans.update(fanId, { itemCount: profile.itemCount, inCommon: profile.inCommon });
}

/**
 * Bandcamp's in-common counts for a release's supporters whose profile was read signed in,
 * with their collection sizes.
 */
export async function profiledSupporters(
  db: DigheadDb,
  releaseKey: ItemKey,
): Promise<{ inCommon: number; itemCount: number }[]> {
  const list = await db.releaseSupporters.get(releaseKey);
  if (!list) return [];
  const fans = await db.fans.bulkGet(list.fanIds);
  return fans.flatMap((fan) =>
    fan?.inCommon != null && fan.itemCount !== undefined
      ? [{ inCommon: fan.inCommon, itemCount: fan.itemCount }]
      : [],
  );
}

/** How many releases your collection holds, as one side of the in-common ratio. */
export async function collectionMatchCount(db: DigheadDb, fanId: number): Promise<number> {
  return (await db.fanMatches.get(fanId))?.matchIds.length ?? 0;
}

/** Fans whose scan has ended, whatever the outcome. */
export function countScannedFans(db: DigheadDb): Promise<number> {
  return db.fans.where('status').noneOf(['queued']).count();
}

/** Fans forgotten per transaction, so one cleanup never holds a huge one. */
const FORGET_BATCH = 100;

/**
 * Forgets fans last seen before `before`, with their ownership rows, match-index entries,
 * twin rows and queued scans. `keepFanId` (you) is never forgotten. Returns how many went.
 */
export async function forgetFansNotSeenSince(
  db: DigheadDb,
  before: number,
  keepFanId: number | null,
): Promise<number> {
  let forgotten = 0;
  for (;;) {
    const ids = (
      await db.fans
        .where('lastSeenAt')
        .below(before)
        .limit(FORGET_BATCH + 1)
        .primaryKeys()
    )
      .filter((fanId) => fanId !== keepFanId)
      .slice(0, FORGET_BATCH);
    if (ids.length === 0) return forgotten;
    await db.transaction(
      'rw',
      [db.fans, db.ownership, db.fanMatches, db.matchOwners, db.twins, db.latelyTwins, db.queue],
      async () => {
        await db.ownership.where('fanId').anyOf(ids).delete();
        // Their rows are gone, so this drops their lists and lowers the owner counts.
        await refreshFanMatches(db, ids);
        await db.twins.bulkDelete(ids);
        await db.latelyTwins.bulkDelete(ids);
        await db.queue
          .where('[kind+target]')
          .anyOf(ids.map((fanId) => ['fan', `${fanId}`]))
          .delete();
        await db.fans.bulkDelete(ids);
      },
    );
    forgotten += ids.length;
  }
}
