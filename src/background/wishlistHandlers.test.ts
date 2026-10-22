import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem } from '../bandcamp';
import { createTag, DigheadDb, putOwnership, saveViewer, upsertCollectionItems } from '../db';
import { wishlistHandlers, type WishlistHandlers } from './wishlistHandlers';

const sender = {} as chrome.runtime.MessageSender;
const ME = 5;

const ITEM: CollectionItem = {
  itemKey: 'a1',
  albumKey: null,
  title: 'Promises',
  artist: 'Floating Points',
  bandId: 1,
  url: 'https://floatingpoints.bandcamp.com/album/promises',
  artId: 123,
  purchaseKind: 'album',
  label: null,
  labelId: null,
  otherOwners: null,
  addedAt: 1000,
  compilation: false,
};

let db: DigheadDb;
let h: WishlistHandlers;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
  h = wishlistHandlers(db);
  await upsertCollectionItems(db, [ITEM], 0);
  await putOwnership(db, ME, [ITEM], 'wishlist');
});

afterEach(async () => {
  await db.delete();
});

describe('wishlist handlers', () => {
  it('answers nothing before Dighead has seen you', async () => {
    expect(await h.listWishlist({}, sender)).toEqual([]);
    expect(await h.getItemTags({ itemKey: 'a1' }, sender)).toBeNull();
  });

  it('lists your wishlist with covers and tags, and tags items', async () => {
    await saveViewer(db, { fanId: ME, username: 'me' });
    const created = await createTag(db, 'dub');
    if (!created.ok) throw new Error(created.reason);

    expect(
      await h.assignItemTag({ tagId: created.tag.id, itemKeys: ['a1'], action: 'add' }, sender),
    ).toBe(1);

    const [row] = await h.listWishlist({}, sender);
    expect(row).toMatchObject({ itemKey: 'a1', title: 'Promises', addedAt: 1000 });
    expect(row?.coverUrl).toBe('https://f4.bcbits.com/img/a123_7.jpg');
    expect(row?.tagIds).toEqual([created.tag.id]);
    expect(await h.getItemTags({ itemKey: 'a1' }, sender)).toEqual([created.tag.id]);
  });
});
