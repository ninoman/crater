import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, ReleaseSupportersRecord } from '../schema';

export function getReleaseSupporters(
  db: DigheadDb,
  itemKey: ItemKey,
): Promise<ReleaseSupportersRecord | undefined> {
  return db.releaseSupporters.get(itemKey);
}

/** Starts a release's supporter list over, from the first page. */
export async function saveReleaseSupporters(
  db: DigheadDb,
  itemKey: ItemKey,
  fanIds: number[],
  now: number,
): Promise<void> {
  await db.releaseSupporters.put({ itemKey, fanIds: [...new Set(fanIds)], fetchedAt: now });
}

/** Adds a later page of supporters, keeping page order. */
export async function appendReleaseSupporters(
  db: DigheadDb,
  itemKey: ItemKey,
  fanIds: number[],
  now: number,
): Promise<void> {
  await db.transaction('rw', db.releaseSupporters, async () => {
    const current = (await db.releaseSupporters.get(itemKey))?.fanIds ?? [];
    await saveReleaseSupporters(db, itemKey, [...current, ...fanIds], now);
  });
}

/** Releases whose supporter list includes this fan. */
export async function releasesSupportedBy(db: DigheadDb, fanId: number): Promise<ItemKey[]> {
  return db.releaseSupporters.where('fanIds').equals(fanId).primaryKeys();
}
