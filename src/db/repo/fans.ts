import type { Supporter } from '../../bandcamp';
import { fanFromSupporter } from '../mappers';
import type { DigheadDb, FanRecord, FanStatus } from '../schema';

const READ_STATUSES: FanStatus[] = ['done', 'partial'];

/** Fans whose collection we've actually read. Private and failed fans own nothing we can see. */
export function collectionRead(status: FanStatus | undefined): boolean {
  return status !== undefined && READ_STATUSES.includes(status);
}

/**
 * Records fans seen in a supporter list. New fans start `queued`; known fans only get their
 * name and avatar refreshed, keeping their scan state.
 */
export async function upsertSupporterFans(
  db: DigheadDb,
  supporters: Supporter[],
): Promise<FanRecord[]> {
  return db.transaction('rw', db.fans, async () => {
    const existing = await db.fans.bulkGet(supporters.map((s) => s.fanId));
    const records = supporters.map((supporter, i): FanRecord => {
      const fresh = fanFromSupporter(supporter);
      const old = existing[i];
      return old
        ? { ...old, username: fresh.username, name: fresh.name, imageId: fresh.imageId }
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
    await db.fans.update(fanId, { status });
    return;
  }
  await db.fans.update(fanId, {
    status,
    scannedItems,
    collectionFetchedAt: now,
    ...(status === 'done' ? { collectionSize: scannedItems } : {}),
  });
}
