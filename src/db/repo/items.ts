import type { CollectionItem } from '../../bandcamp';
import { itemFromCollection } from '../mappers';
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
