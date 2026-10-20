import type { CollectionItem, ItemKey, ReleasePageItem } from '../../bandcamp';
import { itemFromCollection, itemFromReleasePage } from '../mappers';
import type { DigheadDb, ItemRecord } from '../schema';

/**
 * Saves release metadata seen in a collection page. Keeps what collection items don't carry
 * (tags from a release page) and a known supporter count when the new one is missing.
 */
export async function upsertCollectionItems(
  db: DigheadDb,
  items: CollectionItem[],
  now: number,
): Promise<void> {
  if (items.length === 0) return;
  const existing = await db.items.bulkGet(items.map((item) => item.itemKey));
  const records = items.map((item, i): ItemRecord => {
    const fresh = itemFromCollection(item, now);
    const old = existing[i];
    if (!old) return fresh;
    return { ...fresh, tags: old.tags, supporterCount: fresh.supporterCount ?? old.supporterCount };
  });
  await db.items.bulkPut(records);
}

/** Saves what a release page says about itself. Keeps the supporter count from collection pages. */
export async function upsertReleasePageItem(
  db: DigheadDb,
  item: ReleasePageItem,
  now: number,
): Promise<void> {
  await db.transaction('rw', db.items, async () => {
    const old = await db.items.get(item.itemKey);
    await db.items.put({
      ...itemFromReleasePage(item, now),
      supporterCount: old?.supporterCount ?? null,
    });
  });
}

export function getItem(db: DigheadDb, itemKey: ItemKey): Promise<ItemRecord | undefined> {
  return db.items.get(itemKey);
}
