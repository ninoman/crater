import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, Supporter } from '../../bandcamp';
import { DigheadDb } from '../schema';
import { finishFanScan, upsertSupporterFans } from './fans';
import { upsertCollectionItems } from './items';
import { getMe, markSynced, saveViewer } from './me';
import {
  addSupporterOwnership,
  countOwnership,
  ownedItemKeys,
  putOwnership,
  removeOwnershipExcept,
} from './ownership';
import {
  appendReleaseSupporters,
  releasesSupportedBy,
  saveReleaseSupporters,
} from './releaseSupporters';

function item(itemKey: CollectionItem['itemKey'], otherOwners: number | null = 4): CollectionItem {
  return {
    itemKey,
    albumKey: null,
    title: 'Title',
    artist: 'Artist',
    bandId: 1,
    url: 'https://artist.bandcamp.com/album/title',
    artId: null,
    purchaseKind: 'album',
    label: null,
    labelId: null,
    otherOwners,
    addedAt: null,
  };
}

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('upsertCollectionItems', () => {
  it('keeps tags and a known supporter count', async () => {
    await upsertCollectionItems(db, [item('a1', 9)], 1);
    await db.items.update('a1', { tags: ['ambient'] });

    await upsertCollectionItems(db, [item('a1', null)], 2);

    expect(await db.items.get('a1')).toMatchObject({
      tags: ['ambient'],
      supporterCount: 10,
      fetchedAt: 2,
    });
  });
});

describe('ownership', () => {
  it('counts and lists keys per source', async () => {
    await putOwnership(db, 7, [item('a1'), item('a2')], 'collection');
    await putOwnership(db, 7, [item('a3')], 'wishlist');
    await putOwnership(db, 8, [item('a1')], 'collection');

    expect(await countOwnership(db, 7, 'collection')).toBe(2);
    expect(await countOwnership(db, 7, 'wishlist')).toBe(1);
    expect(await ownedItemKeys(db, 7, 'wishlist')).toEqual(new Set(['a3']));
  });

  it('removes only stale rows of one fan and source', async () => {
    await putOwnership(db, 7, [item('a1'), item('a2')], 'wishlist');
    await putOwnership(db, 7, [item('a3')], 'collection');
    await putOwnership(db, 8, [item('a2')], 'wishlist');

    await removeOwnershipExcept(db, 7, 'wishlist', new Set(['a1']));

    expect(await ownedItemKeys(db, 7, 'wishlist')).toEqual(new Set(['a1']));
    expect(await countOwnership(db, 7, 'collection')).toBe(1);
    expect(await countOwnership(db, 8, 'wishlist')).toBe(1);
  });
});

describe('me', () => {
  it('keeps the sync time for the same fan and resets it for a new one', async () => {
    await saveViewer(db, { fanId: 1, username: 'a' });
    await markSynced(db, 100);

    expect((await saveViewer(db, { fanId: 1, username: 'a' })).syncedAt).toBe(100);
    expect((await saveViewer(db, { fanId: 2, username: 'b' })).syncedAt).toBeNull();
    expect(await getMe(db)).toMatchObject({ fanId: 2, username: 'b' });
  });
});

function supporter(fanId: number, name = `Fan ${fanId}`): Supporter {
  return {
    fanId,
    username: `fan${fanId}`,
    name,
    imageId: null,
    token: `1:1700000000:${fanId}:0:1:0`,
    purchasedAt: 1_700_000_000_000,
    isReviewer: false,
  };
}

describe('fans', () => {
  it('queues new supporters and keeps the scan state of known ones', async () => {
    await upsertSupporterFans(db, [supporter(1)], 0);
    await finishFanScan(db, 1, 'done', 12, 500);

    const [known, fresh] = await upsertSupporterFans(
      db,
      [supporter(1, 'Renamed'), supporter(2)],
      0,
    );

    expect(known).toMatchObject({
      name: 'Renamed',
      status: 'done',
      collectionSize: 12,
      collectionFetchedAt: 500,
    });
    expect(fresh).toMatchObject({ status: 'queued', collectionFetchedAt: null });
  });

  it('does not mark an errored scan as fresh', async () => {
    await upsertSupporterFans(db, [supporter(1)], 0);
    await finishFanScan(db, 1, 'error', 0, 500);
    await finishFanScan(db, 2, 'done', 3, 500); // unknown fan: no-op

    expect(await db.fans.get(1)).toMatchObject({ status: 'error', collectionFetchedAt: null });
    expect(await db.fans.get(2)).toBeUndefined();
  });
});

describe('releaseSupporters', () => {
  it('appends pages in order and finds releases by fan', async () => {
    await saveReleaseSupporters(db, 'a1', [3, 1], 10);
    await appendReleaseSupporters(db, 'a1', [1, 2], 20);
    await saveReleaseSupporters(db, 'a2', [2], 10);

    expect(await db.releaseSupporters.get('a1')).toEqual({
      itemKey: 'a1',
      fanIds: [3, 1, 2],
      fetchedAt: 20,
    });
    expect(await releasesSupportedBy(db, 2)).toEqual(['a1', 'a2']);
  });

  it('records supporters as owners without overwriting known rows', async () => {
    await putOwnership(db, 1, [{ ...item('t5'), albumKey: 'a4', addedAt: 99 }], 'collection');

    await addSupporterOwnership(db, { itemKey: 't5', albumKey: 'a4' }, [
      supporter(1),
      supporter(2),
    ]);

    expect(await db.ownership.get([1, 't5'])).toMatchObject({ addedAt: 99 });
    expect(await db.ownership.get([2, 't5'])).toMatchObject({
      matchKey: 'a4',
      addedAt: 1_700_000_000_000,
    });
  });
});
