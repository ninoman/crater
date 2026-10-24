import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFanPage, type CollectionItem } from '../bandcamp';
import { fixtureText } from '../../tests/fixtures';
import { itemFromCollection, ownershipFromCollection } from './mappers';
import { fanRows, getItem, putItems, readItems } from './repo';
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
  compilation: false,
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
    await putItems(db, page.firstItems.map(itemFromCollection));
    await db.ownership.bulkPut(
      page.firstItems.map((item) => ownershipFromCollection(page.fanId, item, 'collection')),
    );

    expect(await fanRows(db, page.fanId)).toHaveLength(10);
    expect((await getItem(db, 'a3149089081'))?.supporterCount).toBe(18412);
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
      via: null,
      priority: 1,
      rank: 0,
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

  it('keys followings by kind and id, and indexes their tags', async () => {
    const row = {
      name: 'N',
      url: 'https://bandcamp.com/n',
      imageId: null,
      location: null,
      followedAt: 0,
      unfollowed: false,
    };
    await db.following.bulkPut([
      { ...row, kind: 'fan', id: 1, tagIds: [3, 4] },
      { ...row, kind: 'band', id: 1, tagIds: [4] },
    ]);

    expect(await db.following.count()).toBe(2);
    expect(await db.following.where('tagIds').equals(4).count()).toBe(2);
    expect(await db.following.where('kind').equals('fan').primaryKeys()).toEqual([['fan', 1]]);
  });

  it('rejects a second tag with the same name key', async () => {
    await db.tags.add({ name: 'Ambient', nameKey: 'ambient' });

    await expect(db.tags.add({ name: 'ambient', nameKey: 'ambient' })).rejects.toThrow();
  });

  it('keeps v4 data when adding the following tables in v5', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(4).stores({ hidden: 'matchKey' });
    await old.table('hidden').put({ matchKey: 'a1', hiddenAt: 5 });
    old.close();

    const upgraded = new DigheadDb(name);
    expect(await upgraded.hidden.get('a1')).toEqual({ matchKey: 'a1', hiddenAt: 5 });
    expect(await upgraded.following.count()).toBe(0);
    expect(await upgraded.tags.count()).toBe(0);
    await upgraded.delete();
  });

  it('keeps v8 data when adding item tags in v9, and indexes them by tag', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(8).stores({ tags: '++id, &nameKey' });
    await old.table('tags').add({ name: 'dub', nameKey: 'dub' });
    old.close();

    const upgraded = new DigheadDb(name);
    expect(await upgraded.tags.count()).toBe(1);
    await upgraded.itemTags.bulkPut([
      { itemKey: 'a1', tagIds: [1, 2] },
      { itemKey: 't2', tagIds: [2] },
    ]);
    expect(await upgraded.itemTags.where('tagIds').equals(2).primaryKeys()).toEqual(['a1', 't2']);
    await upgraded.delete();
  });

  it('flags compilations on v9 items from their artist and title in v11', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(9).stores({ items: 'itemKey, bandId, albumKey, labelId' });
    const url = 'https://b.bandcamp.com/album/x';
    await old.table('items').bulkAdd([
      { itemKey: 'a1', artist: 'Various Artists', title: 'Benefit', bandId: 1, url },
      { itemKey: 'a2', artist: 'Some Label', title: 'VA - Sampler', bandId: 1, url },
      { itemKey: 'a3', artist: 'Someone', title: 'LP', bandId: 1, url },
    ]);
    old.close();

    const upgraded = new DigheadDb(name);
    const items = await readItems(upgraded, await upgraded.items.toArray());
    expect(items.map((item) => [item.itemKey, item.compilation])).toEqual([
      ['a1', true],
      ['a2', true],
      ['a3', false],
    ]);
    await upgraded.delete();
  });

  it('ranks v7 jobs at 0 and stages their fan cursors in v8', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(7).stores({ queue: '++id, &[kind+target], [priority+nextAttemptAt]' });
    const base = { priority: 1, attempts: 0, nextAttemptAt: 5 };
    await old.table('queue').bulkAdd([
      { ...base, kind: 'release', target: 'a1', url: 'u', cursor: null },
      { ...base, kind: 'fan', target: '2', cursor: { token: 't', scanned: 100 } },
      { ...base, kind: 'fan', target: '3', cursor: null },
    ]);
    old.close();

    const upgraded = new DigheadDb(name);
    const jobs = await upgraded.queue.orderBy('[priority+nextAttemptAt+rank]').toArray();
    expect(jobs.map((job) => [job.target, job.rank])).toEqual([
      ['a1', 0],
      ['2', 0],
      ['3', 0],
    ]);
    expect(jobs[1]).toMatchObject({
      via: null,
      cursor: { stage: 'full', token: 't', scanned: 100 },
    });
    expect(jobs[2]).toMatchObject({ via: null, cursor: null });
    await upgraded.delete();
  });

  it('moves the v12 twins leaderboards into the crate mates tables in v13', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(12).stores({ twins: 'fanId, score', latelyTwins: 'fanId, lately' });
    await old.table('twins').bulkAdd([
      { fanId: 1, score: 3 },
      { fanId: 2, score: 1 },
    ]);
    await old.table('latelyTwins').add({ fanId: 2, lately: 0.5 });
    old.close();

    const upgraded = new DigheadDb(name);
    await upgraded.open();
    expect(await upgraded.crateMates.orderBy('score').primaryKeys()).toEqual([2, 1]);
    expect(await upgraded.latelyCrateMates.toArray()).toEqual([{ fanId: 2, lately: 0.5 }]);
    expect(upgraded.tables.map((table) => table.name)).not.toContain('twins');
    expect([...upgraded.backendDB().objectStoreNames]).not.toContain('latelyTwins');
    await upgraded.delete();
  });

  it('adds notes and prices in v16 and keeps what was there', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(13).stores({
      itemTags: 'itemKey, *tagIds',
      crateMates: 'fanId, score',
      latelyCrateMates: 'fanId, lately',
    });
    await old.table('itemTags').add({ itemKey: 'a1', tagIds: [3] });
    old.close();

    const upgraded = new DigheadDb(name);
    await upgraded.open();
    expect(await upgraded.itemTags.get('a1')).toEqual({ itemKey: 'a1', tagIds: [3] });
    expect(await upgraded.itemNotes.count()).toBe(0);
    expect(await upgraded.itemPrices.count()).toBe(0);
    await upgraded.itemNotes.put({ itemKey: 'a1', text: 'x', rating: 2, updatedAt: 1 });
    expect(await upgraded.itemNotes.get('a1')).toMatchObject({ rating: 2 });
    await upgraded.delete();
  });
});
