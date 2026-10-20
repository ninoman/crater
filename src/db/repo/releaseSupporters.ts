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

/** When each release's supporter list was last fetched, for the ones that have one. */
export async function supportersFetchedAt(
  db: DigheadDb,
  itemKeys: ItemKey[],
): Promise<Map<ItemKey, number>> {
  const records = await db.releaseSupporters.bulkGet(itemKeys);
  return new Map(
    records.filter((record) => record !== undefined).map((r) => [r.itemKey, r.fetchedAt]),
  );
}

/** Which of these releases have a supporter list. Reads keys only, so it's cheap to poll. */
export async function listedReleases(db: DigheadDb, itemKeys: ItemKey[]): Promise<Set<ItemKey>> {
  if (itemKeys.length === 0) return new Set();
  return new Set(await db.releaseSupporters.where('itemKey').anyOf(itemKeys).primaryKeys());
}
