import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem } from '../../bandcamp';
import { DigheadDb } from '../schema';
import { upsertCollectionItems } from './items';
import { getMe, markSynced, saveViewer } from './me';
import { countOwnership, ownedItemKeys, putOwnership, removeOwnershipExcept } from './ownership';

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
