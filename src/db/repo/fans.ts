import type { Supporter } from '../../bandcamp';
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
      [db.fans, db.ownership, db.fanMatches, db.matchOwners, db.twins, db.queue],
      async () => {
        await db.ownership.where('fanId').anyOf(ids).delete();
        // Their rows are gone, so this drops their lists and lowers the owner counts.
        await refreshFanMatches(db, ids);
        await db.twins.bulkDelete(ids);
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
