import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFanPage, type CollectionItem } from '../bandcamp';
import { fixtureText } from '../../tests/fixtures';
import { itemFromCollection, ownershipFromCollection } from './mappers';
import { DigheadDb } from './schema';

const album: CollectionItem = {
  itemKey: 'a100',
  albumKey: null,
  title: 'Album',
  artist: 'Artist',
  bandId: 1,
  url: 'https://artist.bandcamp.com/album/album',
  artId: null,
  purchaseKind: 'album',
  label: null,
  labelId: null,
  otherOwners: 11,
  addedAt: null,
};
const trackFromAlbum: CollectionItem = {
  ...album,
  itemKey: 't101',
  albumKey: 'a100',
  purchaseKind: 'track',
};

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('DigheadDb', () => {
  it('stores items and ownership mapped from a real fan page', async () => {
    const page = parseFanPage(fixtureText('fan-page.html'));
    const now = Date.now();
    await db.items.bulkPut(page.firstItems.map((item) => itemFromCollection(item, now)));
    await db.ownership.bulkPut(
      page.firstItems.map((item) => ownershipFromCollection(page.fanId, item, 'collection')),
    );

    expect(await db.ownership.where('fanId').equals(page.fanId).count()).toBe(10);
    expect((await db.items.get('a3149089081'))?.supporterCount).toBe(18412);
  });

  it('matches an album owner with a fan who owns one of its tracks', async () => {
    await db.ownership.bulkPut([
      ownershipFromCollection(1, album, 'collection'),
      ownershipFromCollection(2, trackFromAlbum, 'collection'),
    ]);

    const owners = await db.ownership.where('matchKey').equals('a100').toArray();
    expect(owners.map((row) => row.fanId).sort()).toEqual([1, 2]);
  });

  it('rejects a duplicate queue job for the same target', async () => {
    const job = {
      kind: 'fan' as const,
      target: '42' as const,
      priority: 1,
      attempts: 0,
      nextAttemptAt: 0,
      cursor: null,
    };
    await db.queue.add(job);

    await expect(db.queue.add({ ...job })).rejects.toThrow();
  });

  it('indexes release supporters by fan', async () => {
    await db.releaseSupporters.bulkPut([
      { itemKey: 'a1', fanIds: [7, 8], fetchedAt: 0 },
      { itemKey: 'a2', fanIds: [8], fetchedAt: 0 },
    ]);

    expect(await db.releaseSupporters.where('fanIds').equals(8).primaryKeys()).toEqual([
      'a1',
      'a2',
    ]);
  });

  it('gives fans from before v4 a last-seen time', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(3).stores({ fans: 'fanId, status, collectionFetchedAt' });
    const fan = {
      username: 'f',
      name: 'F',
      imageId: null,
      collectionSize: null,
      scannedItems: 0,
      status: 'queued',
    };
    await old.table('fans').bulkPut([
      { ...fan, fanId: 1, collectionFetchedAt: 500 },
      { ...fan, fanId: 2, collectionFetchedAt: null },
    ]);
    old.close();

    const upgraded = new DigheadDb(name);
    const before = Date.now();
    const [scanned, queued] = await upgraded.fans.bulkGet([1, 2]);
    expect(scanned?.lastSeenAt).toBe(500);
    expect(queued?.lastSeenAt).toBeGreaterThanOrEqual(before);
    await upgraded.delete();
  });
});
