// What wishlisted releases cost, as the wishlist sync last read it (decisions §22).

import type { CollectionItem, ItemKey } from '../../bandcamp';
import type { DigheadDb } from '../schema';

/** Saves the price of each item, or that it has none. Prices the sync reads again overwrite. */
export async function putItemPrices(
  db: DigheadDb,
  items: readonly CollectionItem[],
): Promise<void> {
  await db.itemPrices.bulkPut(
    items.map((item) => ({ itemKey: item.itemKey, price: item.price ?? null })),
  );
}

/** Items whose price has been read at least once. An incremental sync reads the others again. */
export async function pricedItemKeys(db: DigheadDb): Promise<Set<ItemKey>> {
  return new Set(await db.itemPrices.toCollection().primaryKeys());
}
