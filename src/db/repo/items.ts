import {
  keyFromNumber,
  type CollectionItem,
  type ItemKey,
  type ReleasePageItem,
} from '../../bandcamp';
import { itemFromCollection, itemFromReleasePage } from '../mappers';
import type { BandRecord, DigheadDb, ItemFields, ItemRecord, StoredItem } from '../schema';
import { readItem, readItemFields, storeItem } from '../storage';

/**
 * Item records for stored rows, URLs rebuilt from their bands' hosts (decisions §19). Call
 * inside a transaction that includes `bands`. Readers that show no URL use the fields reads.
 */
export async function readItems(db: DigheadDb, rows: StoredItem[]): Promise<ItemRecord[]> {
  const bandIds = [...new Set(rows.map((row) => row.bandId))];
  const bands = await db.bands.bulkGet(bandIds);
  const byId = new Map<number, BandRecord>();
  for (const band of bands) if (band) byId.set(band.bandId, band);
  return rows.map((row) => readItem(row, byId.get(row.bandId)));
}

/** Like readItems, keeping missing rows as undefined. */
async function readSome(
  db: DigheadDb,
  rows: (StoredItem | undefined)[],
): Promise<(ItemRecord | undefined)[]> {
  const found = await readItems(
    db,
    rows.filter((row) => row !== undefined),
  );
  let next = 0;
  return rows.map((row) => (row ? found[next++] : undefined));
}

/** Writes item records, adding any new host to its band. Call inside a transaction with `bands`. */
async function storeItems(db: DigheadDb, items: ItemRecord[]): Promise<void> {
  const bandIds = [...new Set(items.map((item) => item.bandId))];
  const known = new Map<number, BandRecord>();
  for (const band of await db.bands.bulkGet(bandIds)) if (band) known.set(band.bandId, band);
  const changed = new Map<number, BandRecord>();
  const rows = items.map((item) => {
    const { stored, band } = storeItem(item, known.get(item.bandId));
    if (band) {
      known.set(band.bandId, band);
      changed.set(band.bandId, band);
    }
    return stored;
  });
  await db.bands.bulkPut([...changed.values()]);
  await db.items.bulkPut(rows);
}

/** Saves whole item records, e.g. seeding a test database. */
export function putItems(db: DigheadDb, items: ItemRecord[]): Promise<void> {
  return db.transaction('rw', [db.items, db.bands], () => storeItems(db, items));
}

/**
 * Saves release metadata seen in a collection page. Keeps what collection items don't carry
 * (tags from a release page) and a known supporter count when the new one is missing. A
 * collection page can't see track artists, so it never clears a compilation flag (§17).
 */
export async function upsertCollectionItems(db: DigheadDb, items: CollectionItem[]): Promise<void> {
  if (items.length === 0) return;
  await db.transaction('rw', [db.items, db.bands], async () => {
    const existing = await getItemFields(
      db,
      items.map((item) => item.itemKey),
    );
    const records = items.map((item, i): ItemRecord => {
      const fresh = itemFromCollection(item);
      const old = existing[i];
      if (!old) return fresh;
      return {
        ...fresh,
        tags: old.tags,
        supporterCount: fresh.supporterCount ?? old.supporterCount,
        compilation: fresh.compilation || old.compilation,
      };
    });
    await storeItems(db, records);
  });
}

/**
 * Saves what a release page says about itself. Keeps what only collection pages tell us: the
 * supporter count and the label.
 */
export async function upsertReleasePageItem(db: DigheadDb, item: ReleasePageItem): Promise<void> {
  await db.transaction('rw', [db.items, db.bands], async () => {
    const [old] = await getItemFields(db, [item.itemKey]);
    await storeItems(db, [
      {
        ...itemFromReleasePage(item),
        supporterCount: old?.supporterCount ?? null,
        label: old?.label ?? null,
        labelId: old?.labelId ?? null,
      },
    ]);
  });
}

export async function getItem(db: DigheadDb, itemKey: ItemKey): Promise<ItemRecord | undefined> {
  return (await getItemList(db, [itemKey]))[0];
}

/** Records for these keys, in order; undefined where there's none. */
export function getItemList(
  db: DigheadDb,
  itemKeys: readonly ItemKey[],
): Promise<(ItemRecord | undefined)[]> {
  return db.transaction('r', [db.items, db.bands], async () =>
    readSome(db, await db.items.bulkGet([...itemKeys])),
  );
}

export async function getItems(
  db: DigheadDb,
  itemKeys: ItemKey[],
): Promise<Map<ItemKey, ItemRecord>> {
  const items = await getItemList(db, itemKeys);
  return new Map(items.filter((item) => item !== undefined).map((item) => [item.itemKey, item]));
}

/** Rows under these index values. `equals` for one value: `anyOf` is far slower in fake-indexeddb. */
function itemRowsWhere(
  db: DigheadDb,
  index: 'bandId' | 'labelId',
  values: readonly number[],
): Promise<StoredItem[]> {
  const [only] = values;
  if (only === undefined) return Promise.resolve([]);
  const where = db.items.where(index);
  return (values.length === 1 ? where.equals(only) : where.anyOf([...values])).toArray();
}

/** Fields of the items with these keys, in order, without their URLs (no band lookup). */
export async function getItemFields(
  db: DigheadDb,
  itemKeys: readonly ItemKey[],
): Promise<(ItemFields | undefined)[]> {
  const rows = await db.items.bulkGet([...itemKeys]);
  return rows.map((row) => row && readItemFields(row));
}

/** Fields of every item stored under these values of an index, without their URLs. */
export async function itemFieldsWhere(
  db: DigheadDb,
  index: 'bandId' | 'labelId',
  values: readonly number[],
): Promise<ItemFields[]> {
  return (await itemRowsWhere(db, index, values)).map(readItemFields);
}

/** Every item stored under these values of an index, e.g. a band's releases by `bandId`. */
export function itemsWhere(
  db: DigheadDb,
  index: 'bandId' | 'labelId',
  values: readonly number[],
): Promise<ItemRecord[]> {
  return db.transaction('r', [db.items, db.bands], async () =>
    readItems(db, await itemRowsWhere(db, index, values)),
  );
}

/** Which of these match ids have a record flagged as a compilation (decisions §17). */
export async function getCompilations(
  db: DigheadDb,
  matchIds: readonly number[],
): Promise<Set<number>> {
  const items = await db.items.bulkGet(matchIds.map(keyFromNumber));
  return new Set(matchIds.filter((_, i) => items[i]?.compilation));
}
