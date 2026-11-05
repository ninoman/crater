import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey, Supporter } from '../../bandcamp';
import { buildMatchIndex } from '../matchIndex';
import { buildPackedOwnership, sortRows } from '../packedOwnership';
import { CraterDb, type OwnershipRecord, startOwnershipMigration } from '../schema';
import { storeOwnership } from '../storage';
import { forgetFansNotSeenSince } from './fans';
import {
  addSupporterOwnership,
  collectorsOf,
  markUnwishlisted,
  markWishlisted,
  putOwnership,
  removeOwnershipExcept,
} from './ownership';
import { migrateOwnershipStep } from './ownershipMigration';
import { fanRows, migrationState } from './ownershipStore';

const row = (
  fanId: number,
  itemKey: ItemKey,
  matchKey: ItemKey = itemKey,
  source: OwnershipRecord['source'] = 'collection',
): OwnershipRecord => ({ fanId, itemKey, matchKey, source, addedAt: fanId * 1000 });

/** Six fans' rows: albums, tracks of an album, and a wishlist. */
const ROWS: OwnershipRecord[] = [10, 20, 30, 40, 50, 60].flatMap((fanId) => [
  row(fanId, 'a1'),
  row(fanId, `t${fanId}`, 'a2'),
  row(fanId, `a${fanId}`),
  row(fanId, 'a99', 'a99', 'wishlist'),
]);

function collectionItem(itemKey: ItemKey, albumKey: ItemKey | null): CollectionItem {
  return {
    itemKey,
    albumKey,
    title: 'Title',
    artist: 'Artist',
    bandId: 1,
    url: 'https://artist.bandcamp.com/album/title',
    artId: null,
    purchaseKind: 'album',
    label: null,
    labelId: null,
    otherOwners: null,
    addedAt: 5,
    compilation: false,
  };
}

const supporter = (fanId: number): Supporter => ({
  fanId,
  username: `f${fanId}`,
  name: `F${fanId}`,
  imageId: null,
  token: '1:7:1:0:1:0',
  purchasedAt: 7000,
  isReviewer: false,
});

/** Writes that land while the migration is partway: on copied fans, uncopied ones and new ones. */
async function writeDuring(db: CraterDb): Promise<void> {
  await putOwnership(
    db,
    20,
    [collectionItem('t5', 'a1'), collectionItem('a7', null)],
    'collection',
  );
  await putOwnership(db, 50, [collectionItem('a7', null)], 'collection');
  await addSupporterOwnership(db, { itemKey: 'a3', albumKey: null }, [
    supporter(10),
    supporter(15),
    supporter(60),
    supporter(70),
  ]);
  await markWishlisted(db, 10, { itemKey: 'a8', albumKey: null }, 9);
  await markUnwishlisted(db, 60, 'a99');
  await removeOwnershipExcept(db, 30, 'collection', new Set(['a1']));
  await db.fans.bulkPut(
    [40, 50].map((fanId) => ({
      fanId,
      username: `f${fanId}`,
      name: '',
      imageId: null,
      collectionSize: null,
      scannedItems: 0,
      collectionFetchedAt: null,
      status: 'done' as const,
      lastSeenAt: 0,
    })),
  );
  await forgetFansNotSeenSince(db, 1, null);
}

/** Every derived table, to compare two databases. */
async function snapshot(db: CraterDb) {
  return {
    fanOwnership: await db.fanOwnership.toArray(),
    matchOwnership: await db.matchOwnership.toArray(),
    fanMatches: await db.fanMatches.toArray(),
    matchOwners: await db.matchOwners.toArray(),
  };
}

/** The old layout as v20 left it: rows in `ownership` and the match index built from them. */
async function seedOld(db: CraterDb): Promise<void> {
  await db.ownership.bulkPut(ROWS.map(storeOwnership));
  const index = buildMatchIndex(ROWS);
  await db.fanMatches.bulkPut(index.fanMatches);
  await db.matchOwners.bulkPut(index.matchOwners);
  await startOwnershipMigration(db.ownership, db.ownershipMigration);
}

async function seedPacked(db: CraterDb): Promise<void> {
  const packed = buildPackedOwnership(ROWS);
  await db.fanOwnership.bulkPut(packed.fanOwnership);
  await db.matchOwnership.bulkPut(packed.matchOwnership);
  const index = buildMatchIndex(ROWS);
  await db.fanMatches.bulkPut(index.fanMatches);
  await db.matchOwners.bulkPut(index.matchOwners);
}

async function finish(db: CraterDb, chunk: number): Promise<number> {
  let steps = 0;
  while (await migrateOwnershipStep(db, chunk)) steps++;
  return steps;
}

let db: CraterDb;
let reference: CraterDb;

beforeEach(async () => {
  db = new CraterDb(`migrate-${crypto.randomUUID()}`);
  reference = new CraterDb(`packed-${crypto.randomUUID()}`);
  await Promise.all([db.open(), reference.open()]);
});

afterEach(async () => {
  await Promise.all([db.delete(), reference.delete()]);
});

describe('migrateOwnershipStep', () => {
  it('does nothing on a database that never had old rows', async () => {
    expect(await migrationState(db)).toBeUndefined();
    expect(await migrateOwnershipStep(db)).toBe(false);
  });

  it('copies whole fans per chunk, then clears the old rows, ending packed', async () => {
    await seedOld(db);
    await seedPacked(reference);

    // 4 rows per fan: a 6-row chunk ends partway through the second fan, which waits.
    await migrateOwnershipStep(db, 6);
    expect(await migrationState(db)).toEqual({ id: 'state', phase: 'copy', after: 10 });
    // A fan bigger than the chunk is read whole.
    await migrateOwnershipStep(db, 3);
    expect(await migrationState(db)).toEqual({ id: 'state', phase: 'copy', after: 20 });

    await finish(db, 6);
    expect(await db.ownership.count()).toBe(0);
    expect(await snapshot(db)).toEqual(await snapshot(reference));
  });

  it('reads the old rows until every fan is copied, then the packed ones', async () => {
    await seedOld(db);
    const fan30 = sortRows(ROWS.filter((r) => r.fanId === 30));
    await migrateOwnershipStep(db, 4);
    // Fan 30 isn't copied yet, so reads must come from `ownership`.
    expect(await fanRows(db, 30)).toEqual(fan30);
    while ((await migrationState(db))?.phase === 'copy') await migrateOwnershipStep(db, 4);
    // Old rows are still there while clearing, but reads have moved on.
    await db.ownership.put(storeOwnership(row(30, 'a555')));
    expect(await fanRows(db, 30)).toEqual(fan30);
    expect([...(await collectorsOf(db, 'a1'))]).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it('keeps copied fans in step with writes made during the copy', async () => {
    await seedOld(db);
    await seedPacked(reference);
    await migrateOwnershipStep(db, 9); // fans 10 and 20 copied
    await writeDuring(db);
    await writeDuring(reference);
    await finish(db, 5);
    expect(await snapshot(db)).toEqual(await snapshot(reference));
  });

  it('copies a fan again without counting them twice', async () => {
    await seedOld(db);
    await seedPacked(reference);
    await migrateOwnershipStep(db, 8);
    // As if a copy had been cut off after writing but before saving how far it got.
    await db.ownershipMigration.put({ id: 'state', phase: 'copy', after: -1 });
    await finish(db, 8);
    expect(await snapshot(db)).toEqual(await snapshot(reference));
  });
});
